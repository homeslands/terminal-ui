# P2: HTTP Client Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the dead `http.unified.ts` file, fix the inconsistent `login()` return type, and update CLAUDE.md to reflect the real HTTP client.

**Architecture:** `src/utils/http.ts` is the active HTTP client — it handles token refresh, NProgress, and loading state. `src/utils/http.unified.ts` (162 lines) is dead code with zero imports pointing to it. `login()` in `src/api/auth.ts` returns `Promise<ILoginResponse>` (the full response shape), while every other auth function returns `Promise<IApiResponse<T>>`. `IRefreshTokenResponse` already exists with the same shape as `ILoginResponse.result`, so `login()` should return `Promise<IApiResponse<IRefreshTokenResponse>>` — no callers break because they access `response.result.accessToken` either way.

**Tech Stack:** TypeScript, Axios, Zustand, TanStack Query

---

### Task 1: Delete http.unified.ts

**Files:**
- Delete: `src/utils/http.unified.ts`

- [ ] **Step 1: Confirm no imports point to the file**

```bash
grep -rn "http.unified" src/
```

Expected: zero results. If any imports are found, update them to use `src/utils/http.ts` before deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm src/utils/http.unified.ts
```

- [ ] **Step 3: Verify build still passes**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(http): delete dead http.unified.ts"
```

---

### Task 2: Update CLAUDE.md HTTP Client section

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Find the HTTP client section**

Open `CLAUDE.md` and find the section starting with `### HTTP client`.

- [ ] **Step 2: Update the reference**

Change the paragraph that says **"Use `src/utils/http.unified.ts`"** to say:

```markdown
### HTTP client

**Use `src/utils/http.ts`** for all API calls. The client:
- Attaches the Bearer token from `useAuthStore` automatically.
- Auto-refreshes the access token when expired (queues concurrent requests, calls `POST /auth/refresh`).
- Shows NProgress loading bar unless the request opts out with `doNotShowLoading: true`.
- On failed refresh, clears auth state and redirects to login, preserving the current URL for post-login redirect.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reference http.ts (not the deleted http.unified.ts)"
```

---

### Task 3: Fix login() return type

**Files:**
- Modify: `src/api/auth.ts`
- Modify: `src/types/auth.type.ts`

**Context:**

`ILoginResponse` is currently defined as a full API response shape (with `message`, `result`, `method`, `status`, `timestamp`). But `IRefreshTokenResponse` already exists with the inner token fields:

```ts
export interface IRefreshTokenResponse {
  expireTime: string
  expireTimeRefreshToken: string
  accessToken: string
  refreshToken: string
}
```

The `login()` caller in `src/components/app/form/login-form.tsx` accesses:
- `response.result.accessToken`
- `response.result.refreshToken`
- `response.result.expireTime`
- `response.result.expireTimeRefreshToken`

All of these are on `IRefreshTokenResponse`, so changing `login()` to `Promise<IApiResponse<IRefreshTokenResponse>>` maintains the same `response.result.*` access pattern.

- [ ] **Step 1: Update login() in src/api/auth.ts**

Change:
```ts
export async function login(params: {
  phonenumber: string
  password: string
}): Promise<ILoginResponse> {
  const response = await http.post<ILoginResponse>('/auth/login', params)
  return response.data
}
```

To:
```ts
export async function login(params: {
  phonenumber: string
  password: string
}): Promise<IApiResponse<IRefreshTokenResponse>> {
  const response = await http.post<IApiResponse<IRefreshTokenResponse>>('/auth/login', params)
  return response.data
}
```

Also update the `register()` return type (it incorrectly uses `ILoginResponse` as the inner type):
```ts
export async function register(
  params: IRegisterRequest,
): Promise<IApiResponse<IRefreshTokenResponse>> {
  const response = await http.post<IApiResponse<IRefreshTokenResponse>>(
    '/auth/register',
    params,
  )
  return response.data
}
```

- [ ] **Step 2: Remove ILoginResponse import from src/api/auth.ts**

The import line:
```ts
  ILoginResponse,
```
must be removed from the imports at the top of `src/api/auth.ts`. Add `IRefreshTokenResponse` to the import if it is not already present.

Final import block should look like:
```ts
import {
  IApiResponse,
  IRefreshTokenResponse,
  IVerifyEmailRequest,
  IGetAuthorityGroupsRequest,
  IAuthorityGroup,
  ICreatePermissionRequest,
  IRegisterRequest,
  IEmailVerificationResponse,
  IVerifyPhoneNumberRequest,
  IInitiateForgotPasswordRequest,
  IVerifyOTPForgotPasswordRequest,
  IResendOTPForgotPasswordRequest,
  IConfirmForgotPasswordRequest,
  IVerifyOTPForgotPasswordResponse,
  IInitiateForgotPasswordResponse,
} from '@/types'
```

- [ ] **Step 3: Remove ILoginResponse from src/types/auth.type.ts**

Delete the interface definition:
```ts
export interface ILoginResponse {
  message: string
  result: {
    accessToken: string
    expireTime: string
    refreshToken: string
    expireTimeRefreshToken: string
  }
  method: string
  status: number
  timestamp: string
}
```

- [ ] **Step 4: Verify no remaining references to ILoginResponse**

```bash
grep -rn "ILoginResponse" src/
```

Expected: zero results.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/api/auth.ts src/types/auth.type.ts
git commit -m "fix(auth): align login() return type with IApiResponse<IRefreshTokenResponse>"
```
