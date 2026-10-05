import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { QUERYKEY } from '@/constants'

/**
 * GIAI ĐOẠN 1 — `useHandleAuthSuccess`, khúc nối giữa "vừa có token" và "đã ở
 * đúng trang".
 *
 * ## Vì sao khúc này đáng một tệp test riêng
 *
 * Trước cutover, logic sau đăng nhập nằm rải ở **hai** chỗ (`login-form.tsx`
 * và `Login.tsx`) và **cả hai đều decode quyền từ token** — thứ token do
 * `shared-user` ký không còn mang. Đợt này gom về một hook. Nhưng bản
 * `terminal-ui` **không phải bản chép nguyên** của `trend-ui`: nó thêm
 * `scheduleProactiveRefresh()` và `fcmTokenManager.checkAndRefreshToken()`.
 * `trend-ui` có test cho hook của nó; `terminal-ui` thì chưa có gì, đúng vào
 * bản đã bị sửa nhiều hơn.
 *
 * ## Ba bất biến, và cái giá khi hỏng
 *
 * 1. **Mồi cache TRƯỚC `setUserInfo`.** `Login.tsx` bật điều hướng ngay khi
 *    `token + userInfo` cùng có mặt, và nó đọc quyền qua `usePermissions()`.
 *    Mồi sau ⇒ có một khoảnh khắc `userInfo` đã có mà cache quyền còn rỗng ⇒
 *    `calculateSmartNavigationUrl` tính ra `/403`.
 * 2. **Mồi vào ĐÚNG khoá mà bên đọc dùng.** `QUERYKEY.profile` là một *mảng*,
 *    nên `[QUERYKEY.profile]` và `[...QUERYKEY.profile]` là **hai khoá khác
 *    nhau** với react-query. Ghi một đằng đọc một nẻo thì hỏng **im lặng**:
 *    mở màn hồ sơ vẫn bắn thêm một `GET /auth/profile`, kéo theo một lượt
 *    lookup sang `shared-user`. Đây là lỗi thật đã xảy ra ở `terminal-ui`.
 * 3. **Hỏng giữa chừng thì dọn sạch auth state rồi mới ném.** Không dọn là để
 *    lại một phiên nửa vời: có token, không có hồ sơ.
 */

const calls: string[] = []

const setUserInfo = vi.fn(() => {
  calls.push('setUserInfo')
})
const setToken = vi.fn(() => {
  calls.push('setToken')
})
const setLogout = vi.fn(() => {
  calls.push('setLogout')
})
const removeUserInfo = vi.fn(() => {
  calls.push('removeUserInfo')
})
const clearUrl = vi.fn(() => {
  calls.push('clearUrl')
})
const clearCart = vi.fn()
const navigate = vi.fn()

vi.mock('@/stores', () => ({
  useAuthStore: () => ({
    setToken,
    setRefreshToken: vi.fn(),
    setExpireTime: vi.fn(),
    setExpireTimeRefreshToken: vi.fn(),
    setLogout,
  }),
  useCartItemStore: () => ({ clearCart }),
  useUserStore: () => ({ setUserInfo, removeUserInfo }),
  useCurrentUrlStore: () => ({ currentUrl: null, clearUrl }),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

vi.mock('@/utils', () => ({
  calculateSmartNavigationUrl: vi.fn(() => '/system/home'),
  safeNavigate: vi.fn(() => true),
}))

vi.mock('@/utils/http', () => ({
  scheduleProactiveRefresh: vi.fn(() => {
    calls.push('scheduleProactiveRefresh')
  }),
}))

vi.mock('@/services/fcm-token-manager', () => ({
  fcmTokenManager: { checkAndRefreshToken: vi.fn() },
}))

vi.mock('@/api', () => ({
  getProfile: vi.fn(),
  getAuthScope: vi.fn(),
}))

import { getAuthScope, getProfile } from '@/api'
import { calculateSmartNavigationUrl } from '@/utils'
import { scheduleProactiveRefresh } from '@/utils/http'
import { useHandleAuthSuccess } from '@/hooks/use-post-auth-actions'

const TOKENS = {
  accessToken: 'at',
  refreshToken: 'rt',
  expireTime: '2030-01-01T00:00:00.000Z',
  expireTimeRefreshToken: '2030-01-02T00:00:00.000Z',
} as never

const PROFILE = {
  statusCode: 200,
  message: '',
  result: { slug: 'nv-1', role: { name: 'MANAGER' }, branch: { slug: 'cn-1' } },
} as never

const SCOPE = {
  statusCode: 200,
  message: '',
  result: { role: 'MANAGER', permissions: ['REPORT', 'EMPLOYEE'], branch: null },
} as never

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

/**
 * Gọi hook rồi **bắt lỗi bên trong `act()`**, trả về lỗi bắt được.
 *
 * Cố ý không dùng `await expect(act(...)).rejects.toBeTruthy()`: khi thenable
 * của `act` bị reject, phép khẳng định đó hoàn tất **trước** khi các
 * microtask của khối `catch` trong hook chạy xong, nên `setLogout` /
 * `removeUserInfo` chưa kịp được ghi nhận và ca test đỏ oan. Đã mất một lượt
 * vì chuyện này — giữ lại ghi chú để không ai "dọn cho gọn" về dạng kia.
 */
async function goiVaBatLoi(
  handle: (tokens: never, options?: never) => Promise<void>,
): Promise<unknown> {
  let caught: unknown
  await act(async () => {
    try {
      await handle(TOKENS)
    } catch (e) {
      caught = e
    }
  })
  return caught
}

describe('useHandleAuthSuccess — đường chung sau khi có token (GĐ1)', () => {
  it('gọi THẲNG getProfile/getAuthScope, mỗi hàm đúng một lần', async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE)
    vi.mocked(getAuthScope).mockResolvedValue(SCOPE)

    const { result } = renderHook(() => useHandleAuthSuccess(), { wrapper })
    await act(async () => {
      await result.current(TOKENS)
    })

    // Gọi thẳng hàm API thay vì mount `useProfile()` / `usePermissions()`:
    // hai hook đó là `useQuery` KHÔNG có `enabled`, nên chỉ cần một form dùng
    // chúng là request bắn ngay lúc render — kể cả màn nhập OTP, nơi khách
    // chưa có token.
    expect(getProfile).toHaveBeenCalledTimes(1)
    expect(getAuthScope).toHaveBeenCalledTimes(1)
  })

  it('mồi cache vào ĐÚNG khoá mà `useProfile()`/`usePermissionsStatus()` đọc', async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE)
    vi.mocked(getAuthScope).mockResolvedValue(SCOPE)

    const { result } = renderHook(() => useHandleAuthSuccess(), { wrapper })
    await act(async () => {
      await result.current(TOKENS)
    })

    // `[QUERYKEY.profile]` — đúng dạng mà `hooks/use-profile.ts` dùng.
    expect(queryClient.getQueryData([QUERYKEY.profile])).toEqual(PROFILE)
    expect(queryClient.getQueryData([QUERYKEY.authScope])).toEqual(SCOPE)

    // Và KHÔNG phải dạng spread — ghi dạng này là ghi vào khoá không ai đọc.
    // Giữ ca đối chứng để lần sau ai đó "dọn cho nhất quán" sẽ thấy đỏ ở đây
    // thay vì thấy một request thừa mà không hiểu từ đâu.
    expect(queryClient.getQueryData([...QUERYKEY.profile])).toBeUndefined()
  })

  it('mồi cache TRƯỚC khi `setUserInfo` — thứ tự này là load-bearing', async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE)
    vi.mocked(getAuthScope).mockResolvedValue(SCOPE)

    let scopeCoSanLucSetUserInfo: unknown
    setUserInfo.mockImplementationOnce(() => {
      calls.push('setUserInfo')
      scopeCoSanLucSetUserInfo = queryClient.getQueryData([QUERYKEY.authScope])
    })

    const { result } = renderHook(() => useHandleAuthSuccess(), { wrapper })
    await act(async () => {
      await result.current(TOKENS)
    })

    // Ngay tại thời điểm `userInfo` xuất hiện, quyền PHẢI đã nằm trong cache.
    // `Login.tsx` bật điều hướng đúng lúc đó và đọc quyền qua
    // `usePermissions()`; cache rỗng ⇒ `findFirstAllowedRoute` trả `/403`.
    expect(scopeCoSanLucSetUserInfo).toEqual(SCOPE)
  })

  it('hẹn refresh chủ động ngay sau khi lưu token', async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE)
    vi.mocked(getAuthScope).mockResolvedValue(SCOPE)

    const { result } = renderHook(() => useHandleAuthSuccess(), { wrapper })
    await act(async () => {
      await result.current(TOKENS)
    })

    expect(scheduleProactiveRefresh).toHaveBeenCalledTimes(1)
    // Trước khi đi lấy hồ sơ: nếu hẹn sau, một lỗi ở `getProfile` sẽ bỏ luôn
    // lịch refresh của phiên vừa tạo.
    expect(calls.indexOf('scheduleProactiveRefresh')).toBeLessThan(
      calls.indexOf('setUserInfo'),
    )
  })

  it('điều hướng theo quyền LẤY TỪ `/auth/scope`, không từ token', async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE)
    vi.mocked(getAuthScope).mockResolvedValue(SCOPE)

    const { result } = renderHook(() => useHandleAuthSuccess(), { wrapper })
    await act(async () => {
      await result.current(TOKENS)
    })

    expect(calculateSmartNavigationUrl).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: ['REPORT', 'EMPLOYEE'] }),
    )
  })

  it('`onSuccess` nhận quyền điều hướng, và `clearUrl()` chạy TRƯỚC nó', async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE)
    vi.mocked(getAuthScope).mockResolvedValue(SCOPE)

    const onSuccess = vi.fn(() => {
      calls.push('onSuccess')
    })

    const { result } = renderHook(() => useHandleAuthSuccess(), { wrapper })
    await act(async () => {
      await result.current(TOKENS, { onSuccess })
    })

    expect(onSuccess).toHaveBeenCalledWith('/system/home')
    // `currentUrl` persist `localStorage`; dọn sau khi giao quyền điều hướng
    // là lần đăng nhập sau còn thấy URL cũ.
    expect(calls.indexOf('clearUrl')).toBeLessThan(calls.indexOf('onSuccess'))
  })

  it('không lấy được hồ sơ ⇒ dọn sạch auth state rồi mới ném lỗi', async () => {
    vi.mocked(getProfile).mockResolvedValue({ statusCode: 200, message: '' } as never)

    const { result } = renderHook(() => useHandleAuthSuccess(), { wrapper })

    const caught = await goiVaBatLoi(result.current)
    expect(caught).toBeTruthy()

    expect(setLogout).toHaveBeenCalledTimes(1)
    expect(removeUserInfo).toHaveBeenCalledTimes(1)
    // Không được để lại một phiên nửa vời: có token, không có hồ sơ.
    expect(setUserInfo).not.toHaveBeenCalled()
  })

  it('`/auth/scope` hỏng ⇒ cũng dọn sạch, không đăng nhập nửa vời', async () => {
    vi.mocked(getProfile).mockResolvedValue(PROFILE)
    vi.mocked(getAuthScope).mockRejectedValue(new Error('503'))

    const { result } = renderHook(() => useHandleAuthSuccess(), { wrapper })

    const caught = await goiVaBatLoi(result.current)
    expect(caught).toBeTruthy()

    expect(setLogout).toHaveBeenCalledTimes(1)
    expect(removeUserInfo).toHaveBeenCalledTimes(1)
    expect(setUserInfo).not.toHaveBeenCalled()
  })
})
