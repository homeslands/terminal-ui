import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios, { type AxiosInstance } from 'axios'

/**
 * GIAI ĐOẠN 1 — `publicRoutes` phải phủ ĐỦ các bước của luồng nhiều bước.
 *
 * Bảng `publicRoutes` nằm trong `utils/http.ts` và dùng chung cho CẢ HAI client
 * (`http` → terminal, `httpAuth` → shared-user). Một path không có trong bảng
 * mà người gọi chưa đăng nhập thì request interceptor **chặn ngay tại chỗ**
 * bằng `new Error('User is not authenticated')` — không phải 401 từ server, mà
 * là một Error do chính client ném ra, nên nhìn từ tab Network **không thấy gì
 * cả**: không có dòng request nào để mà đọc.
 *
 * Bản trước của bảng chỉ có `/auth/forgot-password` (một bước), không khớp
 * `/auth/forgot-password/initiate` của luồng nhiều bước đang dùng. Cùng kiểu
 * với `/auth/register/{initiate,resend,complete}`.
 *
 * Vì sao test ở mức interceptor chứ không so khớp regex trực tiếp: `isPublicRoute`
 * không được export, và điều cần khoá không phải "regex có khớp không" mà là
 * **request có đi được ra ngoài khi chưa đăng nhập hay không**. Đo ở đầu ra thì
 * một lần đổi thứ tự hay đổi cách gọi `isPublicRoute` cũng không qua mặt được.
 */

const setLogout = vi.fn()

vi.mock('@/stores', () => ({
  useAuthStore: Object.assign(vi.fn(), {
    getState: () => ({
      // Đúng trạng thái màn đăng ký / quên mật khẩu: CHƯA có token.
      token: null,
      refreshToken: null,
      expireTime: null,
      setLogout,
      setToken: vi.fn(),
      setRefreshToken: vi.fn(),
      setExpireTime: vi.fn(),
      setExpireTimeRefreshToken: vi.fn(),
      isAuthenticated: () => false,
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

vi.mock('@/services/fcm-token-sync', () => ({
  syncFcmTokenAfterRefresh: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/server-time', () => ({
  setServerTimeOffsetFromHeader: vi.fn(),
}))

import { attachAuthInterceptors } from '@/utils/http'

/** Những URL thực sự ra tới tầng mạng (adapter) trong một ca test. */
let served: string[] = []

/** Adapter giả: mọi request đi tới đây đều thành công. */
function okInstance(): AxiosInstance {
  const inst = axios.create()
  inst.defaults.adapter = async (config) => {
    served.push(`${config.method?.toLowerCase()} ${config.url}`)
    return {
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  attachAuthInterceptors(inst)
  return inst
}

beforeEach(() => {
  vi.clearAllMocks()
  served = []
})

describe('publicRoutes — luồng đăng ký / quên mật khẩu nhiều bước (GĐ1)', () => {
  const buocDangKy = [
    '/auth/register/initiate',
    '/auth/register/resend',
    '/auth/register/complete',
  ]
  const buocQuenMatKhau = [
    '/auth/forgot-password/initiate',
    '/auth/forgot-password/resend',
    '/auth/forgot-password/confirm',
    '/auth/forgot-password/change',
  ]

  it.each([...buocDangKy, ...buocQuenMatKhau])(
    'chưa đăng nhập vẫn gọi được `POST %s`',
    async (url) => {
      const inst = okInstance()

      await expect(inst.post(url, {})).resolves.toMatchObject({ status: 200 })

      expect(served).toEqual([`post ${url}`])
    },
  )

  it('các path một-bước cũ vẫn public (không bị thay thế nhầm)', async () => {
    const inst = okInstance()

    await inst.post('/auth/login', {})
    await inst.post('/auth/register', {})
    await inst.post('/auth/forgot-password', {})
    await inst.post('/auth/forgot-password/token', {})

    expect(served).toHaveLength(4)
  })

  it('hai bề mặt public riêng của `terminal` cũng đi được khi chưa có token', async () => {
    // Khách quét QR điền form VAT, và form đặt bàn công khai — hai đường không
    // có tài khoản nào đứng sau.
    const inst = okInstance()

    await inst.get('/vat-request/public/abc-123')
    await inst.post('/vat-request/public/abc-123', {})
    await inst.post('/table-booking', {})

    expect(served).toEqual([
      'get /vat-request/public/abc-123',
      'post /vat-request/public/abc-123',
      'post /table-booking',
    ])
  })

  /**
   * Đối chứng. Không có ca này thì mọi ca trên vẫn xanh kể cả khi interceptor
   * bị gỡ hẳn hoặc `isAuthenticated()` luôn trả `true` — tức test đo đúng cái
   * mình tưởng là đang đo.
   */
  it('đối chứng — path KHÔNG public thì bị chặn tại client, không ra tới mạng', async () => {
    const inst = okInstance()

    await expect(inst.post('/auth/change-password', {})).rejects.toThrow(
      'User is not authenticated',
    )
    await expect(inst.get('/user?page=1')).rejects.toThrow(
      'User is not authenticated',
    )

    expect(served).toEqual([])
  })

  it('đối chứng — khớp theo PHƯƠNG THỨC, không chỉ theo path', async () => {
    // `/auth/register/initiate` chỉ public với POST. Một `GET` cùng path là
    // đường khác, không được hưởng ngoại lệ.
    const inst = okInstance()

    await expect(inst.get('/auth/register/initiate')).rejects.toThrow(
      'User is not authenticated',
    )

    expect(served).toEqual([])
  })
})
