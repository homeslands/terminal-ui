# Auth Flow Fixes — HIGH + MED Tier

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.
> 
> **IMPORTANT FOR ALL TASKS:** Do NOT run `git commit`. Leave changes in working tree (modified, can be staged or unstaged) for the user to review + commit themselves.

**Goal:** Fix 5 issues found in login + token expiry analysis. Cover 1 HIGH bug (no redirect after refresh fail) and 4 MED gaps (cross-tab sync, proactive refresh, redundant cleanup, FCM timing).

**Risk level:** Medium. Touches auth core paths — careful smoke testing required.

**Tech Stack:** React 18, Zustand persist, axios interceptors, TanStack Query, React Router v6.

---

## Issues recap

| # | Severity | Issue | File:Line |
|---|---|---|---|
| 1 | 🔴 HIGH | Refresh fail → `setLogout()` nhưng KHÔNG navigate → stale UI on unprotected pages | `http.ts:130-145, 233-247` |
| 2 | 🟡 MED | No cross-tab sync — Tab B vẫn dùng token sau khi Tab A logout | `auth.store.ts` |
| 3 | 🟡 MED | Reactive refresh only — chỉ refresh sau khi expired, không có proactive | `auth.store.ts`, `http.ts` |
| 4 | 🟡 MED | 2 cleanup paths redundant — `useGlobalTokenValidator` + `App.tsx` effect | `App.tsx:69,87-137`, `use-global-token-validator.ts` |
| 5 | 🟡 MED | FCM token registration timing unclear sau login | `login-form.tsx:69`, `notification-provider.tsx` |

---

## Task AUTH-1: Hard redirect after refresh fail (HIGH)

**Scope:** Add navigation trigger trong cả 2 nơi refresh fail (request interceptor + response interceptor) để guarantee user về `/login` khi auth invalid.

**Files:**
- Modify: `src/utils/http.ts:130-145` (request interceptor refresh fail)
- Modify: `src/utils/http.ts:233-247` (response interceptor refresh fail)

**Approach:** Use `window.location.href` (hard redirect) — chuẩn cho session-end scenario vì:
- State đã invalid, fresh page load chuẩn hơn React state restore
- Không phụ thuộc React Router context (interceptor là pure axios, không có hook access)
- Tránh edge case stale closures hay router race

```ts
// Helper to add near top of http.ts (after imports):
function forceLogoutRedirect() {
  // Avoid redirect loop if already on login page
  if (window.location.pathname === '/login') return
  // Hard redirect — state is invalid, fresh load is cleanest
  window.location.href = '/login'
}
```

**Wire into both fail paths:**

Tại `http.ts:130-145` (request interceptor refresh fail), sau `showErrorToast(1017)` và sau save currentUrl, thêm:

```ts
setLogout()
showErrorToast(1017)
// Save currentUrl ... (existing)
forceLogoutRedirect()  // NEW
```

Tại `http.ts:233-247` (response interceptor refresh fail), tương tự — sau `setLogout()` + `showErrorToast(1017)` + save currentUrl, thêm `forceLogoutRedirect()`.

**Smoke test:**
1. Login → wait for refresh token expiry (or manually edit `expireTimeRefreshToken` in localStorage to past)
2. Click any button triggering API call
3. Confirm: toast "Phiên làm việc đã hết hạn" + immediate redirect to `/login`
4. Login lại → confirm redirect về URL ban đầu (currentUrl preserved)

**Verify:**
```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -3
npx eslint src/utils/http.ts 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Expect: 556/556, clean.

**DO NOT COMMIT.** Leave changes in working tree.

---

## Task AUTH-2: Cross-tab sync via storage event (MED)

**Scope:** Tab B nghe `storage` event của localStorage `auth-storage`. Khi Tab A logout → Tab B detect → tự logout + redirect.

**Files:**
- Modify: `src/stores/auth.store.ts` (export storage event listener helper)
- Modify: `src/app/App.tsx` (attach listener in useEffect)

**Approach:**

Add to `auth.store.ts`:

```ts
/**
 * Subscribe to cross-tab auth changes. Call once at app boot.
 * Returns cleanup function for useEffect.
 */
export function subscribeToCrossTabAuthChanges(): () => void {
  const STORAGE_KEY = 'auth-storage'

  const handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return
    if (e.newValue === e.oldValue) return

    // Re-read state from localStorage (Zustand persist auto-syncs)
    // If auth cleared in other tab → state.token should now be undefined
    const state = useAuthStore.getState()
    if (!state.token) {
      // Already cleared in this tab too — no-op
      return
    }

    // Validate current state — if invalid after other tab's change → logout here too
    if (!state.isAuthenticated()) {
      state.setLogout()
      // Force redirect on this tab too
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
  }

  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
```

Wire vào App.tsx (trong useEffect early):

```ts
useEffect(() => {
  const unsubscribe = subscribeToCrossTabAuthChanges()
  return unsubscribe
}, [])
```

**Smoke test:**
1. Mở 2 tab cùng URL `/system` (cả 2 đã login)
2. Tab A: click logout
3. Tab B: trong vài giây, tự navigate về `/login` không cần làm gì

**Verify:**
```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/stores/auth.store.ts src/app/App.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

**DO NOT COMMIT.**

---

## Task AUTH-3: Proactive refresh scheduler (MED)

**Scope:** Schedule a timer to call refresh **2 phút trước khi access token expire**. Tránh delay khi user thao tác đúng lúc token vừa hết hạn.

**Files:**
- Modify: `src/utils/http.ts` (export `scheduleProactiveRefresh()` + cleanup)
- Modify: `src/app/App.tsx` (call on boot + after login)
- Modify: `src/components/app/form/login-form.tsx` (call after successful login)

**Approach:**

```ts
// In http.ts:
let refreshTimerId: ReturnType<typeof setTimeout> | null = null

export function scheduleProactiveRefresh() {
  clearProactiveRefresh()  // clear any existing timer

  const state = useAuthStore.getState()
  if (!state.expireTime) return

  const expireAt = moment(state.expireTime)
  const refreshAt = expireAt.clone().subtract(2, 'minutes')
  const delayMs = Math.max(0, refreshAt.diff(moment()))

  // If already past refreshAt (within 2 min of expiry), refresh immediately
  if (delayMs === 0) {
    triggerRefresh().catch(() => {/* logout handled in catch */})
    return
  }

  refreshTimerId = setTimeout(() => {
    triggerRefresh()
      .then(() => scheduleProactiveRefresh())  // schedule next cycle after success
      .catch(() => {/* logout handled in catch */})
  }, delayMs)
}

export function clearProactiveRefresh() {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId)
    refreshTimerId = null
  }
}

// triggerRefresh is internal: extract existing refresh logic into a callable function
async function triggerRefresh() {
  // ... same logic as request interceptor refresh block
  // (DRY-up — extract once, use in both interceptor and scheduler)
}
```

**Wire:**

In `App.tsx` useEffect (after auth validation):
```ts
if (token && isAuthenticated()) {
  scheduleProactiveRefresh()
}
// On unmount:
return () => clearProactiveRefresh()
```

In `login-form.tsx` onSuccess (after setToken + setUserInfo):
```ts
scheduleProactiveRefresh()
```

In `setLogout` (or as part of AUTH-1 hard redirect path):
```ts
clearProactiveRefresh()
```

**Edge cases to handle:**
- React StrictMode double-mount → cleanup function called → clearTimeout
- Tab background mode → setTimeout may fire late, but acceptable
- User logout manually → must clear timer

**Smoke test:**
1. Set up test: temporary log inside the timer to verify it fires
2. Login → wait 2 min before expiry (or shorten expiry in code for testing)
3. Confirm timer fires + new token issued
4. Confirm interceptor's reactive refresh no longer kicks in (token already fresh)

**Verify:**
```bash
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

**DO NOT COMMIT.**

---

## Task AUTH-4: Consolidate cleanup paths (MED)

**Scope:** Hiện tại có 2 paths cùng làm job clear expired token: `useGlobalTokenValidator` hook + `App.tsx` cleanup effect. Gộp về 1 chỗ duy nhất, dễ maintain.

**Files:**
- Modify: `src/app/App.tsx` (giữ inline effect, remove hook call)
- Delete: `src/hooks/use-global-token-validator.ts` (nếu KHÔNG có caller khác)
- Modify: `src/hooks/index.ts` (remove export nếu hook bị delete)

**Approach:**

1. Grep verify `useGlobalTokenValidator` chỉ dùng ở App.tsx:
   ```bash
   grep -rn "useGlobalTokenValidator" src/
   ```
   Nếu chỉ ở App.tsx + hook file + index export → safe to remove.

2. Remove `useGlobalTokenValidator()` call ở `App.tsx:69`.

3. Đảm bảo logic của hook đã có trong App.tsx cleanup effect (line 87-137). Nếu hook làm gì extra mà effect chưa làm → merge in trước khi xóa.

4. Delete hook file + remove export.

**Smoke test:**
1. Clear localStorage, set expired token manually
2. Reload page
3. Confirm: token cleared + redirect to /login (same behavior as before)

**Verify:**
```bash
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

**DO NOT COMMIT.**

---

## Task AUTH-5: Explicit FCM token registration after login (MED)

**Scope:** Hiện tại login form có comment "FCM token will be handled by NotificationProvider" — implicit, không guarantee timing. Gọi explicit để rõ ràng.

**Files:**
- Read: `src/services/fcm-token-manager.ts` (verify hàm explicit registration nào tồn tại)
- Modify: `src/components/app/form/login-form.tsx:69` (call explicit registration sau setUserInfo)

**Approach:**

1. Grep `fcm` trong services và hooks:
   ```bash
   grep -rn "fcm\|FCM\|registerFcm\|getFcmToken" src/services src/hooks src/utils
   ```

2. Tìm function dạng `registerFcmToken()` hoặc `setupFcmToken()` — đã được implement sẵn cho `NotificationProvider`.

3. Trong `login-form.tsx` onSuccess (sau `setUserInfo(profile)` và `scheduleProactiveRefresh()`), gọi:
   ```ts
   try {
     await registerFcmToken()  // hoặc function tương ứng
   } catch (err) {
     // Don't block login — just log
     console.error('[Login] FCM registration failed:', err)
   }
   ```

4. Update comment cũ (line 69 hiện tại): xóa comment "will be handled by NotificationProvider" — giờ là explicit.

**Smoke test:**
1. Clear FCM token in browser dev tools
2. Login
3. Check Network: confirm FCM register endpoint được gọi trong vòng 1 giây sau login (không cần đợi NotificationProvider mount)

**Verify:**
```bash
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

**DO NOT COMMIT.**

---

## Final Review (manual, after all 5 tasks)

- [ ] Full test suite: 556/556 pass
- [ ] tsc + lint clean
- [ ] Manual smoke (each task's flow above)
- [ ] User reviews `git diff` and commits when satisfied
- [ ] Suggested commit grouping (optional, for user):
  - Commit 1: AUTH-1 (HIGH bug fix) — standalone, can deploy immediately
  - Commit 2: AUTH-2 + AUTH-3 + AUTH-4 (auth core improvements) — grouped
  - Commit 3: AUTH-5 (FCM polish) — standalone

---

## Notes / Design Decisions

1. **Hard redirect via `window.location.href`** thay vì React Router `navigate`: Auth state đã invalid, fresh page load đảm bảo không có stale closure. Trade-off: loss of state during transition is OK vì user phải re-login.

2. **2 minutes proactive buffer**: Industry standard 1-5 phút trước expiry. Chọn 2 cho cân bằng (đủ time refresh round-trip + buffer network delay, không quá sớm wasted calls).

3. **NOT encrypt token**: Out of scope. Cần dedicated crypto lib + key management. Industry common (vẫn dùng localStorage plain) — main protection là HttpOnly cookies + short TTL, không phải client-side encrypt.

4. **NOT commit per task**: User explicit yêu cầu. Implementer phải verify tsc + lint + tests but NOT commit. User reviews `git diff --stat` + `git diff` trước khi commit.

5. **AUTH-3 timer cleanup**: setTimeout trong module scope cần careful — React StrictMode mount/unmount lifecycle phải clear timer đúng cách. Test trong dev mode để confirm.
