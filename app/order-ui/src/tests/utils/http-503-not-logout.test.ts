import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios, { type AxiosInstance } from 'axios'

/**
 * GIAI ĐOẠN 1 — `503` KHÔNG được xử lý như `401`.
 *
 * Từ giai đoạn 1, **mọi** request có auth tới `terminal` có thể ra `503`:
 * `JwtStrategy.validate()` hỏi `shared-user` trên từng request và ném
 * `ServiceUnavailableException` khi bên kia không trả lời (đo 28/09/2026: tắt
 * `shared-user` thì `GET /user`, `GET /user/:slug`, `GET /auth/profile`,
 * `GET /user/lookup-recipient` đều 503).
 *
 * Nếu interceptor coi đó là lỗi xác thực thì một đợt `shared-user` chập chờn sẽ
 * **đăng xuất toàn bộ nhân viên đang đứng quầy** và đá họ về màn đăng nhập —
 * hỏng nặng hơn nhiều so với chính sự cố gốc. Phép đo gốc trong
 * `progress/terminal-ui.md` là "tắt `shared-user`, mở màn danh sách người dùng
 * ⇒ không bị đăng xuất"; ở đây dựng lại đúng điều kiện đó bằng một adapter giả,
 * không cần tắt service thật.
 */

const setLogout = vi.fn()
const removeUserInfo = vi.fn()

vi.mock('@/stores', () => ({
  useAuthStore: Object.assign(vi.fn(), {
    getState: () => ({
      token: 'fake-token',
      refreshToken: 'fake-refresh',
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
    getState: () => ({ removeUserInfo, clearUserData: vi.fn() }),
  }),
  useCurrentUrlStore: Object.assign(vi.fn(), {
    getState: () => ({ setCurrentUrl: vi.fn() }),
  }),
  // `http.ts` dung ca `getState()` lan `setState()` cua request store, va doc
  // `incrementRequestQueueSize` / `requestQueueSize` - thieu mot cai la
  // interceptor nem TypeError va test do vi ly do khong lien quan gi toi 503.
  useRequestStore: Object.assign(vi.fn(), {
    getState: () => ({
      requestQueueSize: 0,
      incrementRequestQueueSize: vi.fn(),
      decrementRequestQueueSize: vi.fn(),
      setRequestQueueSize: vi.fn(),
    }),
    setState: vi.fn(),
  }),
  useLoadingStore: Object.assign(vi.fn(), {
    getState: () => ({ setIsLoading: vi.fn() }),
  }),
}))

vi.mock('@/services/fcm-token-sync', () => ({
  syncFcmTokenAfterRefresh: vi.fn().mockResolvedValue(undefined),
}))

import { attachAuthInterceptors } from '@/utils/http'

/** Adapter giả: mọi request đều hỏng với đúng mã HTTP truyền vào. */
function failingInstance(status: number): AxiosInstance {
  const inst = axios.create()
  inst.defaults.adapter = async (config) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err: any = new Error(`gia lap ${status}`)
    err.isAxiosError = true
    err.config = config
    err.response = { status, data: {}, headers: {}, config, statusText: '' }
    throw err
  }
  attachAuthInterceptors(inst)
  return inst
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Interceptor — 503 khác 401 (GĐ1)', () => {
  it('503: ném lỗi lên cho nơi gọi, KHÔNG đăng xuất, KHÔNG refresh', async () => {
    const postSpy = vi.spyOn(axios, 'post')
    const inst = failingInstance(503)

    await expect(inst.get('/user?page=1')).rejects.toMatchObject({
      response: { status: 503 },
    })

    expect(setLogout).not.toHaveBeenCalled()
    // Không được kích hoạt vòng refresh: refresh token còn tốt, vấn đề nằm ở
    // `shared-user` chứ không ở phiên đăng nhập.
    expect(postSpy).not.toHaveBeenCalled()
    postSpy.mockRestore()
  })

  it('500 cũng vậy — chỉ 401 mới là lỗi xác thực', async () => {
    const postSpy = vi.spyOn(axios, 'post')
    const inst = failingInstance(500)

    await expect(inst.get('/user/abc')).rejects.toMatchObject({
      response: { status: 500 },
    })

    expect(setLogout).not.toHaveBeenCalled()
    expect(postSpy).not.toHaveBeenCalled()
    postSpy.mockRestore()
  })

  it('401 thì NGƯỢC LẠI: có thử refresh (đối chứng cho hai ca trên)', async () => {
    // Không có ca này thì hai ca trên xanh cả khi interceptor chẳng làm gì —
    // ví dụ bị gắn nhầm, hoặc `willRetry` luôn false.
    const postSpy = vi
      .spyOn(axios, 'post')
      .mockRejectedValue(new Error('refresh cung hong'))
    const inst = failingInstance(401)

    await expect(inst.get('/user?page=1')).rejects.toBeTruthy()

    expect(postSpy).toHaveBeenCalled()
    expect(String(postSpy.mock.calls[0][0])).toContain('/auth/refresh')
    postSpy.mockRestore()
  })
})
