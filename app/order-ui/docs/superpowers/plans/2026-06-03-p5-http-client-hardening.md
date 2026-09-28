# P5: HTTP Client Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three structural bugs in `src/utils/http.ts`: add a reactive 401 response interceptor with retry, remove the dual `isRefreshing` source of truth, and extract FCM sync out of the Axios interceptor into its own service.

**Architecture:** The current request interceptor proactively refreshes tokens based on client-side `expireTime`. This is an optimization but is insufficient on its own — if the server invalidates a token early (revoke, backend redeploy, clock skew), the client silently fails with a 401. A reactive 401 response interceptor handles this case by catching the 401, refreshing, and retrying the original request. The proactive check is kept as an optimization. The dual `isRefreshing` (module-level variable vs `auth.store.ts` flag) creates two sources of truth; only the module-level variable is needed. The FCM re-registration logic (120 lines) inside the Axios interceptor is moved to `src/services/fcm-token-sync.ts` so the HTTP client has no knowledge of FCM.

**Tech Stack:** TypeScript, Axios 1.x, Zustand, Capacitor, Vitest

---

### Task 1: Remove isRefreshing from auth store

**Files:**
- Modify: `src/stores/auth.store.ts`
- Modify: `src/utils/http.ts`

The auth store declares `isRefreshing: boolean` (line ~14), exposes `setIsRefreshing` (line ~131), and references it in `isAuthenticated()` (line ~54, ~111). `http.ts` sets both the module-level `isRefreshing` and `setIsRefreshing` from the store in sync — this is the dual source of truth. The fix: use only the module-level variable in `http.ts`, delete the state from the store.

- [ ] **Step 1: Open `src/stores/auth.store.ts` and find all references to `isRefreshing`**

```bash
grep -n "isRefreshing" src/stores/auth.store.ts
```

Expected output: lines with `isRefreshing: false`, `setIsRefreshing`, and usages inside `isAuthenticated` guard.

- [ ] **Step 2: Remove `isRefreshing` from auth store state and actions**

In `src/stores/auth.store.ts`, delete:
- The `isRefreshing: false` initial state field
- The `setIsRefreshing: (isRefreshing: boolean) => set({ isRefreshing })` action
- Any `isRefreshing` usage inside `isAuthenticated()` (the guard `if (isRefreshing) return false` — this check must be done via the module-level var in http.ts instead; the store's `isAuthenticated` should not read this)

- [ ] **Step 3: Remove `setIsRefreshing` calls from `src/utils/http.ts`**

In `src/utils/http.ts`, delete the two lines that call `setIsRefreshing`:

```ts
// DELETE these two lines (one in the try block, one in finally):
setIsRefreshing(true)   // line ~115
setIsRefreshing(false)  // line ~181
```

Also remove `setIsRefreshing` from the destructure of `authStore` at line ~88–103:

```ts
const {
  token,
  expireTime,
  refreshToken,
  setExpireTime,
  setToken,
  setLogout,
  setRefreshToken,
  setExpireTimeRefreshToken,
  // DELETE: setIsRefreshing,
  isAuthenticated,
} = authStore
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Verify no remaining references to setIsRefreshing**

```bash
grep -rn "setIsRefreshing" src/
```

Expected: zero results.

---

### Task 2: Extract FCM sync to its own service

**Files:**
- Create: `src/services/fcm-token-sync.ts`
- Modify: `src/utils/http.ts`

The current FCM sync block in `http.ts` (lines ~132–162) imports `Capacitor`, `getNativeFcmToken`, `unregisterDeviceToken`, `tokenRegistrationQueue`, `useUserStore`, and writes to `localStorage`. Extract this to a dedicated service so `http.ts` has no FCM knowledge.

- [ ] **Step 1: Create `src/services/fcm-token-sync.ts`**

```ts
import { Capacitor } from '@capacitor/core'
import { unregisterDeviceToken } from '@/api/notification'
import { getNativeFcmToken } from '@/utils/getNativeFcmToken'
import { tokenRegistrationQueue } from '@/services/token-registration-queue'
import { useUserStore } from '@/stores'

export async function syncFcmTokenAfterRefresh(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const newFcmToken = await getNativeFcmToken()
  const savedFcmToken = useUserStore.getState().getDeviceToken()

  if (!newFcmToken || newFcmToken === savedFcmToken || !savedFcmToken) return

  await unregisterDeviceToken(savedFcmToken)

  const userInfo = useUserStore.getState().getUserInfo()
  await tokenRegistrationQueue.enqueue({
    token: newFcmToken,
    platform: Capacitor.getPlatform(),
    userAgent: navigator.userAgent,
    userId: userInfo?.slug,
  })

  useUserStore.getState().setDeviceToken(newFcmToken)
  localStorage.setItem('fcm_token_registered_at', Date.now().toString())
}
```

- [ ] **Step 2: Replace the FCM block in `src/utils/http.ts`**

Remove the `if (Capacitor.isNativePlatform()) { getNativeFcmToken().then(...) }` block (lines ~132–162).

Replace with a single fire-and-forget call after `processQueue(null, newToken)`:

```ts
processQueue(null, newToken)

// Sync FCM token after successful refresh (fire and forget, never blocks)
syncFcmTokenAfterRefresh().catch(() => undefined)
```

- [ ] **Step 3: Update imports in `src/utils/http.ts`**

Remove these imports (no longer needed):
```ts
import { Capacitor } from '@capacitor/core'
import { unregisterDeviceToken } from '@/api/notification'
import { getNativeFcmToken } from './getNativeFcmToken'
import { tokenRegistrationQueue } from '@/services/token-registration-queue'
```

Add the new import:
```ts
import { syncFcmTokenAfterRefresh } from '@/services/fcm-token-sync'
```

Also remove `useUserStore` from imports in `http.ts` if it is no longer used elsewhere in that file:
```bash
grep -n "useUserStore" src/utils/http.ts
```
If no other reference exists, delete `import { useUserStore } from '@/stores'`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

---

### Task 3: Add 401 response interceptor with retry

**Files:**
- Modify: `src/utils/http.ts`

The response interceptor at `src/utils/http.ts:217–228` currently only handles loading state. Extend it to catch 401 errors, refresh the token, and retry the original request.

The `_retry` flag on the request config prevents infinite loops (refresh request itself returning 401 must not trigger another refresh).

- [ ] **Step 1: Extend the InternalAxiosRequestConfig augmentation to include `_retry`**

Open `src/types/axios-extensions.d.ts` and add the `_retry` field:

```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    doNotShowLoading?: boolean
    _retry?: boolean
  }
  interface InternalAxiosRequestConfig {
    doNotShowLoading?: boolean
    _retry?: boolean
  }
}
```

- [ ] **Step 2: Replace the response interceptor in `src/utils/http.ts`**

The current response error handler (lines ~223–228):
```ts
async (error) => {
  useLoadingStore.getState().setIsLoading(false)
  if (!error.config?.doNotShowLoading) setProgressBarDone()
  return Promise.reject(error)
},
```

Replace with:
```ts
async (error) => {
  useLoadingStore.getState().setIsLoading(false)
  if (!error.config?.doNotShowLoading) setProgressBarDone()

  const originalRequest = error.config as InternalAxiosRequestConfig
  const is401 = error.response?.status === 401
  const alreadyRetried = originalRequest?._retry === true
  const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh')

  if (is401 && !alreadyRetried && !isRefreshEndpoint) {
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
    const { refreshToken, token, setToken, setRefreshToken, setExpireTime, setExpireTimeRefreshToken, setLogout } = authStore

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

      originalRequest.headers['Authorization'] = `Bearer ${newToken}`
      return axiosInstance(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
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
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }

  return Promise.reject(error)
},
```

- [ ] **Step 3: Add `AxiosResponse` to imports at the top of `src/utils/http.ts`**

The `AxiosResponse` type is needed for the Promise generic. Verify it is in the import:
```ts
import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
```

`AxiosResponse` is already imported (line 3 before our changes), so no change needed.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Manual smoke test**

Start the dev server:
```bash
npm run dev
```

1. Log in normally — confirm the app loads.
2. Open DevTools → Application → Local Storage. Manually clear `token` and set `expireTime` to a past date in the auth store persisted state. Reload the page — confirm the app redirects to login (proactive refresh fails correctly).
3. Log in again. Open Network tab, locate a request to `/api/v1/orders`. In the auth store, manually set an invalid token (DevTools console: `useAuthStore.getState().setToken('invalid')`). Trigger any data refetch. Confirm the 401 is caught, token is refreshed, and the original request is retried successfully (the data still loads).
