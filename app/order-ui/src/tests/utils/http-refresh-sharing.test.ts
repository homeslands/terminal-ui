import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios, { type AxiosInstance } from 'axios'

/**
 * GIAI ĐOẠN 1 — hai client, MỘT trạng thái refresh.
 *
 * Từ giai đoạn 1 app có hai axios client: `http` (→ `terminal`) và `httpAuth`
 * (→ `shared-user`). Cả hai gắn **cùng một bộ** interceptor qua
 * `attachAuthInterceptors`, và dùng chung `isRefreshing` / `failedQueue` đặt ở
 * module scope của `utils/http.ts`.
 *
 * Hai bất biến được khoá ở đây, cả hai đều hỏng **âm thầm** nếu sai:
 *
 * 1. **Phát lại trên ĐÚNG client đã gãy.** Nhánh retry sau 401 gọi
 *    `instance(originalRequest)` với `instance` là client mà interceptor được
 *    gắn vào. Nếu nó cố định về client `terminal` thì một request gãy ở
 *    `shared-user` sẽ được phát lại sang `terminal` ⇒ sai baseURL ⇒ 404, còn
 *    log chỉ thấy "retry xong vẫn lỗi".
 *
 * 2. **Hàng đợi dùng chung.** Hai hàng đợi riêng ⇒ hai client cùng thấy 401 sẽ
 *    refresh song song; client thứ hai gửi đi refresh token mà client thứ nhất
 *    vừa xoay vòng ⇒ `shared-user` từ chối ⇒ **đăng xuất ngẫu nhiên giữa
 *    phiên**. Đây là loại lỗi gần như không tái hiện được bằng tay.
 *
 * Cố ý **không** `vi.resetModules()` giữa các ca: làm vậy thì `utils/http` nạp
 * lại một bản `axios` khác với bản mà test đã `spyOn`, nên lượt refresh thoát
 * ra mạng thật và ca test treo tới timeout. Trạng thái module tự sạch sau mỗi
 * ca vì mọi nhánh refresh đều đặt lại `isRefreshing` trong `finally`.
 */

const setLogout = vi.fn()

vi.mock('@/stores', () => ({
  useAuthStore: Object.assign(vi.fn(), {
    getState: () => ({
      token: 'token-cu',
      refreshToken: 'refresh-con-tot',
      // `null` ⇒ không đi nhánh "token đã hết hạn" ở request interceptor, và
      // `scheduleProactiveRefresh()` thoát sớm nên không để lại timer treo.
      expireTime: null,
      setLogout,
      setToken: vi.fn(),
      setRefreshToken: vi.fn(),
      setExpireTime: vi.fn(),
      setExpireTimeRefreshToken: vi.fn(),
      isAuthenticated: () => true,
    }),
  }),
  useUserStore: Object.assign(vi.fn(), {
    getState: () => ({ removeUserInfo: vi.fn(), clearUserData: vi.fn() }),
  }),
  useCurrentUrlStore: Object.assign(vi.fn(), {
    getState: () => ({ setCurrentUrl: vi.fn(), shouldUpdateUrl: () => false }),
  }),
  useRequestStore: Object.assign(vi.fn(), {
    getState: () => ({
      requestQueueSize: 0,
      incrementRequestQueueSize: vi.fn(),
      decrementRequestQueueSize: vi.fn(),
    }),
    setState: vi.fn(),
  }),
  useLoadingStore: Object.assign(vi.fn(), {
    getState: () => ({ setIsLoading: vi.fn() }),
  }),
}))

// `vi.fn(impl)` chứ không `vi.fn().mockResolvedValue(…)`: `afterRefreshSuccess`
// gọi `syncFcmTokenAfterRefresh().catch(…)`, nên hàm này BẮT BUỘC trả promise ở
// mọi ca. Implementation truyền thẳng vào `vi.fn` sống sót qua `clearAllMocks`.
vi.mock('@/services/fcm-token-sync', () => ({
  syncFcmTokenAfterRefresh: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/server-time', () => ({
  setServerTimeOffsetFromHeader: vi.fn(),
}))

import { attachAuthInterceptors } from '@/utils/http'

/** Thứ tự các lượt phục vụ: nhãn client + lần thứ mấy. */
let served: string[] = []

/**
 * Client giả mang nhãn `label`: lần đầu trả 401, các lần sau trả 200. Đúng
 * hình dạng "access token vừa hết hiệu lực, refresh rồi gọi lại thì được".
 */
function instanceFailsOnce(label: string): AxiosInstance {
  let lan = 0
  const inst = axios.create()
  inst.defaults.adapter = async (config) => {
    lan += 1
    served.push(`${label}#${lan}`)
    if (lan === 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err: any = new Error(`${label} 401`)
      err.isAxiosError = true
      err.config = config
      err.response = {
        status: 401,
        data: {},
        headers: {},
        config,
        statusText: '',
      }
      throw err
    }
    return {
      data: { served: label },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  attachAuthInterceptors(inst)
  return inst
}

/**
 * Spy đang đặt trên `axios.post`. Gỡ ở `afterEach` — `restoreAllMocks()` thì
 * không dùng được, vì nó xoá luôn implementation của các mock module ở trên.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let postSpy: any = null

/** Giả lập `POST {authURL}/auth/refresh` trả về bộ token mới. */
function mockRefresh(delayMs = 0) {
  postSpy = vi.spyOn(axios, 'post').mockImplementation(async () => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    return {
      data: {
        result: {
          accessToken: 'token-moi',
          refreshToken: 'refresh-moi',
          expireTime: null,
          expireTimeRefreshToken: null,
        },
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
  return postSpy
}

beforeEach(() => {
  vi.clearAllMocks()
  served = []
})

afterEach(() => {
  postSpy?.mockRestore()
  postSpy = null
})

describe('Refresh dùng chung giữa hai client (GĐ1)', () => {
  it('401 ở client `shared-user` ⇒ phát lại trên CHÍNH client đó, không nhảy sang `terminal`', async () => {
    const postSpy = mockRefresh()
    // Cả hai client cùng tồn tại, đúng như trong app.
    instanceFailsOnce('terminal')
    const sharedUser = instanceFailsOnce('shared-user')

    const res = await sharedUser.post('/auth/change-password', {})

    // Lượt 1 là 401, lượt 2 là lần phát lại — cả hai phải do CHÍNH
    // `shared-user` phục vụ. Một mục `terminal#…` ở đây nghĩa là retry đã đi
    // nhầm client.
    expect(served).toEqual(['shared-user#1', 'shared-user#2'])
    expect(res.data).toEqual({ served: 'shared-user' })
    expect(postSpy).toHaveBeenCalledTimes(1)
    expect(String(postSpy.mock.calls[0][0])).toContain('/auth/refresh')
  })

  it('401 ở client `terminal` ⇒ cũng phát lại trên chính nó (đối xứng)', async () => {
    mockRefresh()
    const terminal = instanceFailsOnce('terminal')
    instanceFailsOnce('shared-user')

    const res = await terminal.get('/user?page=1')

    expect(served).toEqual(['terminal#1', 'terminal#2'])
    expect(res.data).toEqual({ served: 'terminal' })
  })

  it('hai client cùng dính 401 ⇒ CHỈ MỘT lượt `/auth/refresh`', async () => {
    // Có độ trễ để cửa sổ đua thực sự mở: client thứ hai gặp 401 trong lúc
    // lượt refresh của client thứ nhất còn đang bay.
    const postSpy = mockRefresh(20)
    const terminal = instanceFailsOnce('terminal')
    const sharedUser = instanceFailsOnce('shared-user')

    const [a, b] = await Promise.all([
      terminal.get('/user?page=1'),
      sharedUser.get('/auth/profile'),
    ])

    // Hai hàng đợi riêng thì con số này là 2 — và lượt thứ hai gửi đi một
    // refresh token đã bị xoay vòng.
    expect(postSpy).toHaveBeenCalledTimes(1)

    // Cả hai request vẫn phải thành công, mỗi cái trên client của mình.
    expect(a.data).toEqual({ served: 'terminal' })
    expect(b.data).toEqual({ served: 'shared-user' })
    expect(served.filter((s) => s.startsWith('terminal'))).toEqual([
      'terminal#1',
      'terminal#2',
    ])
    expect(served.filter((s) => s.startsWith('shared-user'))).toEqual([
      'shared-user#1',
      'shared-user#2',
    ])

    expect(setLogout).not.toHaveBeenCalled()
  })

  it('refresh hỏng ⇒ cả hai request cùng gãy và đăng xuất, không ai treo', async () => {
    postSpy = vi.spyOn(axios, 'post').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20))
      throw new Error('refresh token het han')
    })
    const terminal = instanceFailsOnce('terminal')
    const sharedUser = instanceFailsOnce('shared-user')

    const ketQua = await Promise.allSettled([
      terminal.get('/user?page=1'),
      sharedUser.get('/auth/profile'),
    ])

    // Quan trọng là KHÔNG có cái nào `pending` mãi: request xếp hàng phải được
    // `processQueue(error)` đánh thức để reject, không thì màn hình đứng im.
    expect(ketQua.map((r) => r.status)).toEqual(['rejected', 'rejected'])
    expect(postSpy).toHaveBeenCalledTimes(1)
    expect(setLogout).toHaveBeenCalled()
  })
})
