import { StrictMode, useState, useEffect } from 'react'
import { AxiosError, isAxiosError } from 'axios'
import { RouterProvider } from 'react-router-dom'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { has } from 'lodash'
import i18n from '@/i18n'

import { router } from '@/router'
import { IApiResponse } from '@/types'
import { showErrorToast } from '@/utils'
import { ThemeProvider } from '@/components/app/theme-provider'
import { useAuthStore, useUserStore, subscribeToCrossTabAuthChanges } from '@/stores'
import { Loader2 } from 'lucide-react'
import { deepLinkHandler } from '@/services/deep-link-handler'
import { scheduleProactiveRefresh, clearProactiveRefresh } from '@/utils/http'

// Create a client
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      try {
        if (query.meta && has(query.meta, 'ignoreGlobalError')) {
          if (query.meta.ignoreGlobalError) return
        }
        if (isAxiosError(error)) {
          const axiosError = error as AxiosError<IApiResponse<void>>
          const code = axiosError.response?.data.statusCode ?? axiosError.response?.data.code
          if (code) {
            showErrorToast(code)
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error in queryCache onError:', err)
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _, __, mutation) => {
      try {
        if (mutation.meta && has(mutation.meta, 'ignoreGlobalError')) {
          if (mutation.meta.ignoreGlobalError) return
        }
        if (isAxiosError(error)) {
          const axiosError = error as AxiosError<IApiResponse<void>>
          const code = axiosError.response?.data.statusCode ?? axiosError.response?.data.code
          if (code) {
            showErrorToast(code)
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error in mutationCache onError:', err)
      }
    },
  }),
})

function App() {
  // ✅ State để track auth initialization
  const [isAuthInitialized, setIsAuthInitialized] = useState(false)

  // ✅ Initialize Deep Link Handler SỚM (trước khi Router ready)
  useEffect(() => {
    // Wrap trong async function để có thể await
    const initDeepLink = async () => {
      try {
        await deepLinkHandler.initialize()
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize deep link handler:', error)
        // Không throw để app vẫn có thể tiếp tục
      }
    }
    initDeepLink()
  }, [])

  // ✅ Đảm bảo auth cleanup hoàn thành trước khi render UI
  useEffect(() => {
    try {
      // Sync cleanup expired tokens để tránh race condition
      const authStore = useAuthStore.getState()
      const userStore = useUserStore.getState()

      // ⚠️ Wrap trong try-catch để tránh crash nếu localStorage corrupt
      try {
        if (authStore.token && !authStore.isAuthenticated()) {
          authStore.setLogout()
          userStore.removeUserInfo()
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ Failed to validate auth, clearing storage:', error)
        // Clear corrupted storage
        try {
          localStorage.removeItem('auth-storage')
          localStorage.removeItem('user-info')
          authStore.setLogout()
          userStore.clearUserData()
        } catch (clearError) {
          // eslint-disable-next-line no-console
          console.error('❌ Failed to clear storage:', clearError)
        }
      }

      // Sync language từ userInfo nếu có (ưu tiên hơn localStorage)
      if (userStore.userInfo?.language) {
        try {
          i18n.changeLanguage(userStore.userInfo.language)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to change language:', error)
          // Continue với default language
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Critical error during app initialization:', error)
      // Clear all storage as last resort
      try {
        localStorage.clear()
      } catch {
        // Ignore
      }
    } finally {
      // Always mark as initialized để app không bị stuck
      setIsAuthInitialized(true)
    }
  }, [])

  // ✅ Cross-tab auth sync — when another tab logs out or auth becomes
  // invalid, this tab also force-logouts and redirects to /login.
  useEffect(() => {
    const unsubscribe = subscribeToCrossTabAuthChanges()
    return unsubscribe
  }, [])

  // ✅ Proactive token refresh scheduler — fires 2 min before access token
  // expires so users never hit the reactive refresh latency on the next call.
  // Re-runs only when auth initialization flips; cleanup cancels the timer
  // on unmount (StrictMode double-mount safe — second mount overrides first).
  useEffect(() => {
    if (!isAuthInitialized) return
    const { token, isAuthenticated } = useAuthStore.getState()
    if (token && isAuthenticated()) {
      scheduleProactiveRefresh()
    }
    return () => clearProactiveRefresh()
  }, [isAuthInitialized])

  // ✅ Show loading during auth initialization to prevent race conditions
  if (!isAuthInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col gap-4 items-center">
          <Loader2 className="w-8 h-8 rounded-full border-b-2 border-blue-600 animate-spin"></Loader2>
          <p className="text-sm text-gray-600">Đang khởi tạo...</p>
        </div>
      </div>
    )
  }

  return (
    <StrictMode>
      <ThemeProvider defaultTheme="light" storageKey="my-app-theme">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>
  )
}

export default App
