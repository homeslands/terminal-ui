import { useUserStore, useAuthStore } from '@/stores'
import { AuthState } from '@/types'

/**
 * Kiểm tra xem có cần load userInfo không
 * Sử dụng bên ngoài auth store để tránh circular dependency
 */
export const checkNeedsUserInfo = (): boolean => {
  const userStore = useUserStore.getState()
  return !userStore.userInfo
}

/**
 * Lấy auth state với đầy đủ logic kiểm tra userInfo
 */
export const getDetailedAuthState = (): AuthState => {
  // Import auth store methods
  const authStore = useAuthStore.getState()

  if (!authStore.isTokenValid()) {
    return AuthState.UNAUTHENTICATED
  }

  // Kiểm tra xem có cần userInfo không
  if (checkNeedsUserInfo()) {
    return AuthState.LOADING
  }

  return AuthState.AUTHENTICATED
}

/**
 * Check authentication với userInfo consideration
 */
export const isFullyAuthenticated = (): boolean => {
  return getDetailedAuthState() === AuthState.AUTHENTICATED
}

/**
 * Check nếu đang trong trạng thái loading (có token nhưng chưa có userInfo)
 */
export const isAuthLoading = (): boolean => {
  return getDetailedAuthState() === AuthState.LOADING
}

/**
 * Token của phiên bản CŨ (trước cutover giai đoạn 1) hay không.
 *
 * Trước cutover, `terminal` tự ký JWT bằng HS256 và nhét cả `scope` (role +
 * permissions) vào payload. Sau cutover nó chỉ còn VERIFY bằng public key RS256
 * của `shared-user`, và payload do shared-user ký có đúng ba field
 * `{ sub, jti, exp }`. Token cũ vì thế **401 ở mọi request**.
 *
 * Nhận diện bằng SHAPE, không verify chữ ký: client không có khoá, và đây cũng
 * không phải một phép kiểm bảo mật — chỉ là để dọn localStorage và đưa người
 * dùng về màn đăng nhập thay vì để họ nhìn một màn hỏng.
 *
 * Trả `false` khi không decode được: một token rác sẽ bị `isAuthenticated()` /
 * interceptor xử lý theo đường bình thường, không cần đường riêng ở đây.
 */
export const isLegacyToken = (token: string): boolean => {
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return false
    // base64url -> base64 trước khi atob: JWT dùng '-' và '_' thay cho '+' và '/'.
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as Record<string, unknown>
    return 'scope' in payload
  } catch {
    return false
  }
}
