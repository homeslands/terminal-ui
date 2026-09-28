import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import moment from 'moment'

import { IAuthStore, AuthState } from '@/types'
import { ROUTE } from '@/constants'
import { useUserStore } from './user.store'
import { useCartItemStore } from './cart.store'
import { useCurrentUrlStore } from './current-url.store'
import { isValidRedirectUrl } from '@/utils'

export const useAuthStore = create<IAuthStore>()(
  persist(
    (set, get) => ({
      slug: undefined,
      token: undefined,
      refreshToken: undefined,
      expireTime: undefined,
      expireTimeRefreshToken: undefined,
      isAuthenticated: () => {
        try {
          const { token, expireTime, refreshToken, expireTimeRefreshToken } =
            get()

          if (!token || !expireTime || !refreshToken || !expireTimeRefreshToken)
            return false

          // ⚠️ Validate data trước khi parse với moment
          if (typeof expireTime !== 'string' || typeof expireTimeRefreshToken !== 'string') {
            // eslint-disable-next-line no-console
            console.error('❌ Invalid token expire time format')
            return false
          }

          const now = moment()
          const tokenExpiresAt = moment(expireTime)
          const refreshExpiresAt = moment(expireTimeRefreshToken)

          // Kiểm tra moment parse có valid không
          if (!tokenExpiresAt.isValid() || !refreshExpiresAt.isValid()) {
            // eslint-disable-next-line no-console
            console.error('❌ Invalid date in token expiration')
            return false
          }

          // Nếu refresh token đã hết hạn thì chắc chắn not authenticated
          if (now.isAfter(refreshExpiresAt)) {
            return false
          }

          // Nếu access token vẫn còn hạn thì OK
          if (now.isBefore(tokenExpiresAt)) {
            return true
          }

          // Nếu access token hết hạn nhưng refresh token còn hạn thì still valid
          return true
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('❌ Error checking authentication:', error)
          return false
        }
      },

      isTokenValid: () => {
        try {
          const { token, expireTime, refreshToken, expireTimeRefreshToken } =
            get()

          if (!token || !expireTime || !refreshToken || !expireTimeRefreshToken) {
            return false
          }

          // ⚠️ Validate data type
          if (typeof expireTime !== 'string' || typeof expireTimeRefreshToken !== 'string') {
            return false
          }

          const now = moment()
          const tokenExpiresAt = moment(expireTime)
          const refreshExpiresAt = moment(expireTimeRefreshToken)

          // Validate moment objects
          if (!tokenExpiresAt.isValid() || !refreshExpiresAt.isValid()) {
            return false
          }

          // Nếu refresh token đã hết hạn thì token invalid
          if (now.isAfter(refreshExpiresAt)) {
            return false
          }

          // Nếu access token vẫn còn hạn thì valid
          if (now.isBefore(tokenExpiresAt)) {
            return true
          }

          // Nếu access token hết hạn nhưng refresh token còn hạn thì still valid
          return true
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('❌ Error validating token:', error)
          return false
        }
      },

      needsUserInfo: () => {
        // Basic implementation - để tránh circular dependency
        // Full logic sẽ được implement trong auth-helpers.ts
        return false
      },

      getAuthState: () => {
        if (!get().isTokenValid()) {
          return AuthState.UNAUTHENTICATED
        }

        // Note: Full userInfo check được implement trong auth-helpers.ts
        // để tránh circular dependency
        return AuthState.AUTHENTICATED
      },
      setSlug: (slug: string) => set({ slug }),
      setToken: (token: string) => set({ token }),
      setRefreshToken: (refreshToken: string) => set({ refreshToken }),
      setExpireTime: (expireTime: string) => set({ expireTime }),
      setExpireTimeRefreshToken: (expireTimeRefreshToken) =>
        set({ expireTimeRefreshToken }),
      /**
       * Full session cleanup: clears auth tokens, user info, cart, and any
       * scheduled proactive token refresh. Call on logout or forced sign-out.
       */
      setLogout: () => {
        set({
          token: undefined,
          expireTime: undefined,
          refreshToken: undefined,
          expireTimeRefreshToken: undefined,
          slug: undefined,
        })
        useUserStore.getState().clearUserData()
        useCartItemStore.getState().clearCart()
        // Cancel any scheduled proactive refresh. Dynamic import avoids the
        // circular dep between auth.store and http (http imports useAuthStore).
        import('@/utils/http')
          .then(({ clearProactiveRefresh }) => clearProactiveRefresh())
          .catch(() => undefined)
      },
    }),
    {
      name: 'auth-storage',
    },
  ),
)

/**
 * Subscribe to cross-tab auth changes via localStorage `storage` event.
 * Call once at app boot. Returns cleanup function for useEffect.
 *
 * When another tab clears auth (logout) or token becomes invalid,
 * this tab will also force-logout + redirect to login.
 */
export function subscribeToCrossTabAuthChanges(): () => void {
  const STORAGE_KEY = 'auth-storage'

  const handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return
    if (e.newValue === e.oldValue) return

    // Zustand persist has already updated this tab's store from the new value.
    const state = useAuthStore.getState()

    // If token cleared in other tab, or current state is invalid → logout here too
    if (!state.token || !state.isAuthenticated()) {
      state.setLogout()
      if (window.location.pathname !== ROUTE.LOGIN) {
        const currentUrl = window.location.pathname
        const { setCurrentUrl, shouldUpdateUrl } = useCurrentUrlStore.getState()
        if (isValidRedirectUrl(currentUrl) && shouldUpdateUrl(currentUrl)) {
          setCurrentUrl(currentUrl)
        }
        window.location.href = ROUTE.LOGIN
      }
    }
  }

  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
