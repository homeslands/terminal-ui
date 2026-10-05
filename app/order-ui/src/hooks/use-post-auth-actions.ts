import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  useAuthStore,
  useCartItemStore,
  useCurrentUrlStore,
  useUserStore,
} from '@/stores'
import { calculateSmartNavigationUrl, safeNavigate } from '@/utils'
import { scheduleProactiveRefresh } from '@/utils/http'
import { IRefreshTokenResponse } from '@/types'
import { getAuthScope, getProfile } from '@/api'
import { QUERYKEY } from '@/constants'
import { fcmTokenManager } from '@/services/fcm-token-manager'

export interface IHandleAuthSuccessOptions {
  /**
   * Nhận quyền điều hướng thay cho hook. Dùng khi nơi gọi cần rẽ nhánh riêng
   * (luồng đăng ký đi tiếp sang màn hồ sơ thay vì về thẳng navigationUrl).
   */
  onSuccess?: (navigationUrl: string) => void
}

/**
 * Xử lý phần việc chung sau khi có token: lưu token, lấy hồ sơ + quyền, mồi
 * cache, tính điểm đến. Dùng chung cho đăng nhập và bước hoàn tất đăng ký.
 * Ném lỗi sau khi đã dọn sạch auth state nếu không lấy được hồ sơ.
 *
 * Trước đợt này logic đó nằm rải ở HAI chỗ (`login-form.tsx` và `Login.tsx`), và
 * cả hai đều tự decode quyền từ token — thứ token mới không còn mang.
 */
export const useHandleAuthSuccess = () => {
  const {
    setToken,
    setRefreshToken,
    setExpireTime,
    setExpireTimeRefreshToken,
    setLogout,
  } = useAuthStore()
  const { clearCart } = useCartItemStore()
  const { setUserInfo, removeUserInfo } = useUserStore()
  const { currentUrl, clearUrl } = useCurrentUrlStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useCallback(
    async (
      tokens: IRefreshTokenResponse,
      options?: IHandleAuthSuccessOptions,
    ) => {
      try {
        clearCart()

        setToken(tokens.accessToken)
        setRefreshToken(tokens.refreshToken)
        setExpireTime(tokens.expireTime)
        setExpireTimeRefreshToken(tokens.expireTimeRefreshToken)

        // Hẹn refresh chủ động (2 phút trước khi hết hạn) để request đầu tiên
        // sau khi hết hạn không phải trả giá một vòng refresh.
        scheduleProactiveRefresh()

        // ⛔ Gọi THẲNG hàm API, KHÔNG mount `useProfile()` / `usePermissions()`.
        //
        // `useProfile()` là một `useQuery` **không có `enabled`** (xem
        // hooks/use-profile.ts), nên chỉ cần một form dùng hook này là nó bắn
        // `/auth/profile` NGAY LÚC RENDER — kể cả màn nhập OTP, nơi khách chưa
        // có token, đẻ ra một chuỗi 401 kèm retry.
        //
        // `getProfile()` gọi `terminal` (không phải shared-user) — terminal tự
        // gọi nội bộ sang shared-user ghép identity, nên `profile.result` đã có
        // sẵn role/branch đúng (nguồn thật), không cần tự ghép ở đây
        // (architect-http.md mục 1.1 quy tắc 4). `scope` vẫn giữ để lấy
        // permissions cho việc điều hướng theo quyền.
        const profile = await getProfile()
        if (!profile?.result) {
          throw new Error('Failed to fetch user profile')
        }
        const scopeResponse = await getAuthScope()
        // Mồi cache để các màn dùng useProfile()/usePermissions() không gọi lại.
        queryClient.setQueryData([QUERYKEY.profile], profile)
        queryClient.setQueryData([QUERYKEY.authScope], scopeResponse)

        const userInfo = profile.result
        setUserInfo(userInfo)

        // FCM token registration flow:
        // 1. Initial register: handled by NotificationProvider's
        //    useFirebaseNotification(userInfo.slug) hook which fires after
        //    userInfo updates here.
        // 2. Refresh/rotation: fcmTokenManager.checkAndRefreshToken() on
        //    interval + visibility events.
        // Ping here as a safety net; it early-returns when nothing is saved yet.
        void fcmTokenManager.checkAndRefreshToken()

        const permissions = scopeResponse?.result?.permissions ?? []

        const navigationUrl = calculateSmartNavigationUrl({
          userInfo,
          permissions,
          currentUrl,
        })

        if (options?.onSuccess) {
          // navigationUrl đã được "tiêu thụ" tại đây — dọn currentUrl NGAY,
          // trước khi giao quyền điều hướng cho nơi gọi, để lần đăng nhập sau
          // không còn thấy currentUrl cũ (store này persist localStorage).
          clearUrl()
          options.onSuccess(navigationUrl)
          return
        }

        const navigationSuccess = safeNavigate(
          navigate,
          navigationUrl,
          window.location.pathname,
        )
        if (navigationSuccess) {
          clearUrl()
        }
      } catch (error) {
        setLogout()
        removeUserInfo()
        throw error
      }
    },
    [
      clearCart,
      clearUrl,
      currentUrl,
      navigate,
      queryClient,
      removeUserInfo,
      setExpireTime,
      setExpireTimeRefreshToken,
      setLogout,
      setRefreshToken,
      setToken,
      setUserInfo,
    ],
  )
}
