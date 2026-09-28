import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import NProgress from 'nprogress'
import moment from 'moment'

import { useCurrentUrlStore, useRequestStore } from '@/stores'
import { useAuthStore } from '@/stores'
import { IApiResponse, IRefreshTokenResponse } from '@/types'
import { baseURL, ROUTE } from '@/constants'
import { useLoadingStore } from '@/stores'
import { showErrorToast } from './toast'
import { isValidRedirectUrl } from './current-url-manager'
import { syncFcmTokenAfterRefresh } from '@/services/fcm-token-sync'
import { setServerTimeOffsetFromHeader } from '@/lib/server-time'

NProgress.configure({ showSpinner: false, trickleSpeed: 200 })

let isRefreshing = false
let failedQueue: {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}[] = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token)
    } else {
      prom.reject(error)
    }
  })
  failedQueue = []
}

const isTokenExpired = (expiryTime: string): boolean => {
  const currentDate = moment()
  const expireDate = moment(expiryTime)
  return currentDate.isAfter(expireDate)
}

/**
 * Hard redirect to the login route. Used when auth state is invalidated (refresh fail).
 * Hard redirect (not React Router) because:
 * - Auth state is invalid → fresh page load avoids stale closures
 * - Interceptor runs outside React tree → no access to navigate()
 */
function forceLogoutRedirect() {
  if (window.location.pathname === ROUTE.LOGIN) return // avoid redirect loop
  window.location.href = ROUTE.LOGIN
}

/**
 * Classify a refresh error as "auth-fatal" (refresh token cannot be reused)
 * vs. transient (network blip, 5xx). Auth-fatal errors warrant immediate logout;
 * transient errors leave tokens in place so the next request can retry.
 */
function isAuthFatalRefreshError(err: unknown): boolean {
  if (err instanceof Error && (
    err.message === 'No refresh token available' ||
    err.message === 'Refresh response missing accessToken'
  )) {
    return true
  }
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    return status === 401 || status === 403
  }
  return false
}

/**
 * Full logout sequence: clears auth state, shows session-expired toast,
 * saves current URL for post-login redirect, and hard-redirects to login.
 * Use when refresh is known to be unrecoverable (auth-fatal error).
 */
function forceLogoutAndRedirect() {
  const { setLogout } = useAuthStore.getState()
  setLogout()
  showErrorToast(1017)
  const currentUrl = window.location.pathname
  const { setCurrentUrl, shouldUpdateUrl } = useCurrentUrlStore.getState()
  if (
    currentUrl !== ROUTE.LOGIN &&
    isValidRedirectUrl(currentUrl) &&
    shouldUpdateUrl(currentUrl)
  ) {
    setCurrentUrl(currentUrl)
  }
  forceLogoutRedirect()
}

/**
 * Trigger a token refresh. Used by both interceptor (reactive) and scheduler (proactive).
 * Updates auth store on success. Throws on failure (caller decides logout/redirect).
 * Returns the new access token on success.
 *
 * Uses plain `axios.post` (not `axiosInstance`) to bypass our own interceptors
 * and avoid recursion.
 */
async function triggerRefresh(): Promise<string> {
  const state = useAuthStore.getState()
  const { refreshToken, token: oldToken } = state

  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  const response: AxiosResponse<IApiResponse<IRefreshTokenResponse>> =
    await axios.post(`${baseURL}/auth/refresh`, {
      refreshToken,
      accessToken: oldToken,
    })

  const data = response.data?.result
  if (!data?.accessToken) {
    throw new Error('Refresh response missing accessToken')
  }

  state.setToken(data.accessToken)
  state.setRefreshToken(data.refreshToken)
  state.setExpireTime(data.expireTime)
  state.setExpireTimeRefreshToken(data.expireTimeRefreshToken)
  return data.accessToken
}

let refreshTimerId: ReturnType<typeof setTimeout> | null = null

/**
 * Schedule a proactive token refresh 2 minutes before access token expiry.
 * Idempotent — clears any existing timer first. Call on app boot + after login.
 *
 * Coordination with axios interceptors:
 * - Bails if `isRefreshing` is already true (interceptor is handling it; it
 *   will chain the next cycle via its own success path).
 * - Sets `isRefreshing` while refreshing so concurrent requests queue instead
 *   of triggering a parallel refresh.
 *
 * On successful refresh, processes any queued requests, syncs FCM, and
 * schedules the next cycle.
 * On auth-fatal failure (401/403, missing credentials, malformed response),
 * triggers full logout + redirect via `forceLogoutAndRedirect`.
 * On transient failure (network blip, 5xx), logs the error silently — the
 * next request will trigger the reactive interceptor path.
 */
export function scheduleProactiveRefresh() {
  clearProactiveRefresh()

  const state = useAuthStore.getState()
  if (!state.expireTime) return

  const REFRESH_BUFFER_MS = 2 * 60 * 1000 // 2 minutes
  const expireAt = new Date(state.expireTime).getTime()
  const refreshAt = expireAt - REFRESH_BUFFER_MS
  const delayMs = Math.max(0, refreshAt - Date.now())

  refreshTimerId = setTimeout(async () => {
    // If an interceptor is already refreshing, bail out — that path will
    // call scheduleProactiveRefresh() on success to chain the next cycle.
    if (isRefreshing) return

    isRefreshing = true
    try {
      const newToken = await triggerRefresh()
      // Unblock any requests that queued up while we were refreshing.
      processQueue(null, newToken)
      // Best-effort FCM sync to mirror the reactive refresh path.
      syncFcmTokenAfterRefresh().catch(() => undefined)
      // Chain the next proactive cycle using the new expireTime.
      scheduleProactiveRefresh()
    } catch (err) {
      // Reject any queued requests so they don't hang.
      processQueue(err, null)
      // eslint-disable-next-line no-console
      console.error('[Auth] Proactive refresh failed:', err)
      if (isAuthFatalRefreshError(err)) {
        // Refresh token rejected or missing — full logout + redirect,
        // mirroring the interceptor's failure path.
        forceLogoutAndRedirect()
      }
    } finally {
      isRefreshing = false
    }
  }, delayMs)
}

/**
 * Cancel any scheduled proactive refresh. Call on logout or component unmount.
 */
export function clearProactiveRefresh() {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId)
    refreshTimerId = null
  }
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
})
// Public routes configuration
const publicRoutes = [
  { path: /^\/auth\/login$/, methods: ['post'] },
  { path: /^\/auth\/register$/, methods: ['post'] },
  { path: /^\/auth\/refresh$/, methods: ['post'] },
  { path: /^\/auth\/forgot-password$/, methods: ['post'] },
  { path: /^\/auth\/forgot-password\/token$/, methods: ['post'] },
  { path: /^\/orders\/public$/, methods: ['post'] },
  { path: /^\/orders\/[^/]+$/, methods: ['get'] }, // get order by slug
  { path: /^\/orders\/[^/]+\/public$/, methods: ['delete'] }, // delete order by slug
  { path: /^\/invoice\/export\/public$/, methods: ['post'] }, // export public order invoice
  { path: /^\/menu\/specific\/public$/, methods: ['get'] },
  { path: /^\/payment\/initiate\/public$/, methods: ['post'] },
  { path: /^\/products\/[^/]+$/, methods: ['get'] }, // get product by slug
  { path: /^\/products$/, methods: ['get'] },
  { path: /^\/tables$/, methods: ['get'] },
  { path: /^\/branch$/, methods: ['get'] },
  { path: /^\/menu-item\/[^/]+$/, methods: ['get'] },
  { path: /^\/product-analysis\/top-sell\/branch\/[^/]+$/, methods: ['get'] },
  { path: /^\/catalogs$/, methods: ['get'] },
  { path: /^\/voucher\/order\/public$/, methods: ['get'] },
  { path: /^\/voucher\/specific\/public$/, methods: ['get'] },
  { path: /^\/voucher\/validate\/public$/, methods: ['post'] },
  { path: /^\/orders\/[^/]+\/voucher\/public$/, methods: ['patch'] },
  { path: /^\/banner$/, methods: ['get'] },
  { path: /^\/static-page\/[^/]+$/, methods: ['get'] },
  // Public VAT request — khách quét QR điền form, không có auth token.
  { path: /^\/vat-request\/public\/[^/]+$/, methods: ['get', 'post'] },
  { path: /^\/table-booking$/, methods: ['post'] }, // public table booking submission
]

const isPublicRoute = (url: string, method: string): boolean => {
  return publicRoutes.some(
    (route) => route.path.test(url) && route.methods.includes(method),
  )
}

// Consolidated request interceptor
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const authStore = useAuthStore.getState()
    // const {clearCart} = useCartItemStore()
    const {
      token,
      expireTime,
      refreshToken,
      setExpireTime,
      setToken,
      setRefreshToken,
      setExpireTimeRefreshToken,
      isAuthenticated,
    } = authStore

    if (config.url) {
      if (isPublicRoute(config.url, config.method || '')) return config
    }

    if (!isAuthenticated()) {
      return Promise.reject(new Error('User is not authenticated'))
    }

    if (expireTime && isTokenExpired(expireTime) && !isRefreshing) {
      isRefreshing = true
      try {
        const response: AxiosResponse<IApiResponse<IRefreshTokenResponse>> =
          await axios.post(`${baseURL}/auth/refresh`, {
            refreshToken,
            accessToken: token,
          })

        const newToken = response.data.result.accessToken
        setToken(newToken)
        setRefreshToken(response.data.result.refreshToken)
        setExpireTime(response.data.result.expireTime)
        setExpireTimeRefreshToken(response.data.result.expireTimeRefreshToken)

        // ✅ Process queue trước để unblock API calls
        processQueue(null, newToken)

        syncFcmTokenAfterRefresh().catch(() => undefined)
        // Chain the next proactive refresh cycle (in case the previous one bailed
        // because we were already refreshing).
        scheduleProactiveRefresh()
      } catch (error) {
        processQueue(error, null)
        // clearCart()
        forceLogoutAndRedirect()
      } finally {
        isRefreshing = false
      }
    } else if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (currentToken: string) => {
            config.headers['Authorization'] = `Bearer ${currentToken}`
            resolve(config)
          },
          reject: (error: unknown) => {
            reject(error)
          },
        })
      })
    }

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
      if (!config.doNotShowLoading) {
        useLoadingStore.getState().setIsLoading(true)
        const requestStore = useRequestStore.getState()
        if (requestStore.requestQueueSize === 0) {
          NProgress.start()
        }
        requestStore.incrementRequestQueueSize()
      }
    }
    return config
  },
  (error) => {
    useLoadingStore.getState().setIsLoading(false)
    return Promise.reject(error)
  },
)

// Consolidated response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    useLoadingStore.getState().setIsLoading(false)
    if (!response.config?.doNotShowLoading) setProgressBarDone()
    // Keep client clock in sync with the server (case 19 — clock skew).
    const dateHeader = response.headers?.date as string | undefined
    setServerTimeOffsetFromHeader(dateHeader)
    return response
  },
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig
    const is401 = error.response?.status === 401
    const alreadyRetried = originalRequest?._retry === true
    const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh')
    const willRetry = is401 && !alreadyRetried && !isRefreshEndpoint

    useLoadingStore.getState().setIsLoading(false)
    if (!willRetry && !error.config?.doNotShowLoading) setProgressBarDone()

    if (willRetry) {
      originalRequest._retry = true

      if (isRefreshing) {
        return new Promise<AxiosResponse>((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`
              resolve(axiosInstance(originalRequest))
            },
            reject,
          })
        })
      }

      const authStore = useAuthStore.getState()
      const { refreshToken, token, setToken, setRefreshToken, setExpireTime, setExpireTimeRefreshToken } = authStore

      isRefreshing = true
      try {
        const refreshResponse: AxiosResponse<IApiResponse<IRefreshTokenResponse>> =
          await axios.post(`${baseURL}/auth/refresh`, {
            refreshToken,
            accessToken: token,
          })

        const newToken = refreshResponse.data.result.accessToken
        setToken(newToken)
        setRefreshToken(refreshResponse.data.result.refreshToken)
        setExpireTime(refreshResponse.data.result.expireTime)
        setExpireTimeRefreshToken(refreshResponse.data.result.expireTimeRefreshToken)

        processQueue(null, newToken)
        syncFcmTokenAfterRefresh().catch(() => undefined)
        // Chain the next proactive refresh cycle (in case the previous one bailed
        // because we were already refreshing).
        scheduleProactiveRefresh()

        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        forceLogoutAndRedirect()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

async function setProgressBarDone() {
  useRequestStore.setState({
    requestQueueSize: useRequestStore.getState().requestQueueSize - 1,
  })
  if (useRequestStore.getState().requestQueueSize > 0) {
    NProgress.inc()
  } else {
    NProgress.done()
  }
}

export default axiosInstance
