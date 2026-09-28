# Owner-Sync At Select-Customer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix gap "không có PATCH owner khi staff/cashier chọn khách ở cart context (trang `table-order-screen`, `admin-cart-content`)" bằng cách tập trung owner-sync về 1 hook `useOwnerSync` dùng đồng nhất ở mọi callsite, thay vì rải rác hiện tại (chỉ effect ở `table-payment-screen`).

**Architecture:** Tạo `useOwnerSync({ tableId, orderSlug })` hook đóng gói full pattern: optimistic local update qua `setOrderCustomer`, PATCH `/orders/{slug}/owner` nếu `orderSlug` tồn tại, track promise vào `pendingOwnerSync` slice, rollback session khi PATCH fail, invalidate `[QUERYKEY.order, slug]` khi success. Promise-identity check ở `.finally` (đã verified an toàn cross-remount). Silence stored promise (`syncPromise.catch(() => undefined)`) tránh unhandled rejection. Wire hook vào 3 trang có customer search (`table-payment-screen`, `table-order-screen`, `admin-cart-content`) — mỗi trang xài cùng API: `selectCustomer(user | null)`. Bỏ hoàn toàn effect cũ ở `table-payment-screen.tsx:351-424` (hook đã cover).

**Tech Stack:** React 18, Zustand (persist middleware), TanStack Query v5, TypeScript, Vitest, react-testing-library

## Global Constraints

- Test framework: Vitest. Chạy: `npx vitest run <path>` từ `/Users/phanquyetthang/terminal/app/order-ui`.
- Lint: `npm run lint`. Build: `npm run build`.
- TanStack Query hooks: `src/hooks/use-*.ts`. New hook: `src/hooks/use-owner-sync.ts`.
- Test files: `src/tests/<mirror-src-path>/<name>.test.ts(x)`.
- Working tree starts at base commit `1aada5105c408d0da3452eb421d8a9dcd611a5a0` (after user has committed previous owner-sync work — pendingOwnerSync slice + voucher sheet guards + spinner + tests đã có trong codebase). Implementer MUST verify these exist before starting Task 1 (see Pre-Task 1 check).
- Branch: `feature/TT-30-FE-Add-New-User-Roles-and-Implement-Permission-Mapping` — đang chứa cả TT-30 WIP, mỗi commit phải scope chính xác file của task.
- Tiếng Việt cho user-facing string; key i18n trong `public/locales/`.

## Pre-Task 1 Check (verify previous work in place)

Trước khi bắt đầu Task 1, implementer MUST verify codebase đã có các artifact sau (từ refactor trước):

1. `src/stores/table-sessions.store.ts` có:
   - Field `pendingOwnerSync: Promise<void> | null`
   - Action `setPendingOwnerSync: (p: Promise<void> | null) => void`
   - `partialize` loại field này khi persist
2. `src/components/staff/staff-table-voucher-sheet.tsx` có guard `await pendingOwnerSync` trong `handleToggle`.
3. `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` có guard tương tự trong `handleCompleteSelection`.
4. `src/components/staff/staff-customer-search-input.tsx` có spinner cạnh ô input khi `pendingOwnerSync !== null`.
5. `src/components/staff/table-payment-screen.tsx` có effect track promise (line 351-435) — Task 2 sẽ **xoá** effect này.

Nếu thiếu bất kỳ artifact nào → STOP và escalate (BLOCKED). Plan này build trên top của state đó.

## File Structure

**Create:**
- `src/hooks/use-owner-sync.ts` — hook chuẩn cho mọi select-customer callsite.
- `src/tests/hooks/use-owner-sync.test.tsx` — unit test cho hook.

**Modify:**
- `src/components/staff/table-payment-screen.tsx`:
  - Line ~1086 (`onSelect`) → dùng `selectCustomer` từ hook.
  - Line ~1150 (clear customer in confirm dialog) → dùng `selectCustomer(null)` từ hook.
  - Line 351-435 (owner-sync effect) → **XOÁ HOÀN TOÀN**.
  - Bỏ luôn `userInitiatedClearRef` (không còn cần) + `ownerSyncTokenRef` (hook tự handle qua promise-identity).
- `src/components/staff/table-order-screen.tsx`:
  - Line 653 (`onCustomerSelect`) → dùng `selectCustomer` từ hook.
  - Line 654 (`onCustomerClear`) → dùng `selectCustomer(null)` từ hook.
- `src/app/system/menu/components/admin-cart-content.tsx`:
  - Line 983 (`onSelect`) → dùng `selectCustomer` từ hook.
  - Line 1202 (`onConfirm` clear dialog) → dùng `selectCustomer(null)` từ hook.

**NOT touched:**
- `src/stores/table-sessions.store.ts` (slice đã đủ)
- `src/stores/cart.store.ts`, `src/stores/order-flow.store.ts` (out of scope — client cart, update-order)
- Các voucher sheet (đã có guard từ refactor trước)
- `src/hooks/use-order.ts` `useChangeOrderOwner` (hook con — giữ bare, hook mới sẽ wrap)
- `src/components/staff/staff-customer-search-input.tsx` (spinner đã có)

---

## Task 1: Tạo `useOwnerSync` hook + test

**Files:**
- Create: `src/hooks/use-owner-sync.ts`
- Create: `src/tests/hooks/use-owner-sync.test.tsx`

**Interfaces:**
- Consumes:
  - `useChangeOrderOwner` từ `@/hooks/use-order` — returns `{ mutateAsync: ({slug, owner}) => Promise<any> }`
  - `useTableSessionsStore` slice (`setOrderCustomer`, `setPendingOwnerSync`, `pendingOwnerSync`)
  - `useUserStore` (`userInfo.slug` — staff fallback)
  - `QUERYKEY` từ `@/constants/query`
- Produces:
  - `useOwnerSync(opts: { tableId: string; orderSlug?: string | null }): { selectCustomer: (user: TableCustomer | null) => Promise<void>; isOwnerSyncing: boolean }`

- [ ] **Step 1: Verify Pre-Task 1 check**

Đọc nhanh 3 file:
```bash
grep -n "pendingOwnerSync\|setPendingOwnerSync" /Users/phanquyetthang/terminal/app/order-ui/src/stores/table-sessions.store.ts
grep -n "pendingOwnerSync" /Users/phanquyetthang/terminal/app/order-ui/src/components/staff/staff-table-voucher-sheet.tsx
grep -n "pendingOwnerSync" /Users/phanquyetthang/terminal/app/order-ui/src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx
```

Expected: mỗi file đều có match. Nếu trống → BLOCKED, escalate.

- [ ] **Step 2: Write the failing test**

Tạo `src/tests/hooks/use-owner-sync.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useOwnerSync } from '@/hooks/use-owner-sync'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import { useUserStore } from '@/stores/user.store'
import type { TableCustomer } from '@/types/session'

const patchOwnerMock = vi.fn()
const showErrorToastMock = vi.fn()
const showErrorToastMessageMock = vi.fn()
const showToastMock = vi.fn()

vi.mock('@/hooks/use-order', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-order')>(
    '@/hooks/use-order',
  )
  return {
    ...actual,
    useChangeOrderOwner: () => ({ mutateAsync: patchOwnerMock }),
  }
})

vi.mock('@/utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils')>('@/utils')
  return {
    ...actual,
    showErrorToast: (code: number) => showErrorToastMock(code),
    showErrorToastMessage: (msg: string) => showErrorToastMessageMock(msg),
    showToast: (msg: string) => showToastMock(msg),
  }
})

const sampleCustomer: TableCustomer = {
  slug: 'cust-1',
  firstName: 'Nguyễn',
  lastName: 'Văn A',
  phonenumber: '0900000001',
}

function setupStaff() {
  useUserStore.setState({
    userInfo: {
      slug: 'staff-1',
      firstName: 'Staff',
      lastName: 'A',
    } as never,
  } as never)
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useOwnerSync', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {}, pendingOwnerSync: null })
    setupStaff()
    patchOwnerMock.mockReset()
    showErrorToastMock.mockReset()
    showErrorToastMessageMock.mockReset()
    showToastMock.mockReset()
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
  })

  it('cart pending (no orderSlug): only updates session locally, no PATCH', async () => {
    const { result } = renderHook(
      () => useOwnerSync({ tableId: 't1', orderSlug: undefined }),
      { wrapper },
    )
    await act(async () => {
      await result.current.selectCustomer(sampleCustomer)
    })
    expect(useTableSessionsStore.getState().sessions['t1'].customer).toEqual(
      sampleCustomer,
    )
    expect(patchOwnerMock).not.toHaveBeenCalled()
  })

  it('order placed: PATCH owner with customer.slug + tracks pendingOwnerSync', async () => {
    patchOwnerMock.mockResolvedValue(undefined)
    const { result } = renderHook(
      () => useOwnerSync({ tableId: 't1', orderSlug: 'order-1' }),
      { wrapper },
    )
    await act(async () => {
      await result.current.selectCustomer(sampleCustomer)
    })
    expect(patchOwnerMock).toHaveBeenCalledWith({
      slug: 'order-1',
      owner: 'cust-1',
    })
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBeNull()
  })

  it('selectCustomer(null) on placed order: PATCH owner with staff fallback', async () => {
    patchOwnerMock.mockResolvedValue(undefined)
    useTableSessionsStore.getState().setOrderCustomer('t1', sampleCustomer)
    const { result } = renderHook(
      () => useOwnerSync({ tableId: 't1', orderSlug: 'order-1' }),
      { wrapper },
    )
    await act(async () => {
      await result.current.selectCustomer(null)
    })
    expect(patchOwnerMock).toHaveBeenCalledWith({
      slug: 'order-1',
      owner: 'staff-1',
    })
  })

  it('PATCH failure: rollback session customer + show error toast', async () => {
    const err = {
      response: { data: { errorCodeValue: 1234 } },
    }
    patchOwnerMock.mockRejectedValue(err)
    const { result } = renderHook(
      () => useOwnerSync({ tableId: 't1', orderSlug: 'order-1' }),
      { wrapper },
    )
    await act(async () => {
      await result.current.selectCustomer(sampleCustomer)
    })
    expect(useTableSessionsStore.getState().sessions['t1'].customer).toBeUndefined()
    expect(showErrorToastMock).toHaveBeenCalledWith(1234)
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/tests/hooks/use-owner-sync.test.tsx
```

Expected: FAIL — `Cannot find module '@/hooks/use-owner-sync'` (file chưa tồn tại).

- [ ] **Step 4: Create hook**

Tạo `src/hooks/use-owner-sync.ts`:

```ts
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useChangeOrderOwner } from '@/hooks/use-order'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import { useUserStore } from '@/stores/user.store'
import { QUERYKEY } from '@/constants/query'
import { showErrorToast, showErrorToastMessage, showToast } from '@/utils'
import type { TableCustomer } from '@/types/session'

interface UseOwnerSyncOptions {
  tableId: string
  orderSlug?: string | null
}

interface UseOwnerSyncResult {
  selectCustomer: (user: TableCustomer | null) => Promise<void>
  isOwnerSyncing: boolean
}

/**
 * Centralized owner-sync at the customer-pick callsite.
 *
 * - Cart pending (no orderSlug): optimistic local update only.
 *   `createOrder` later sends `owner` in the payload atomically.
 * - Order placed (orderSlug exists): optimistic local update + PATCH
 *   `/orders/{slug}/owner` immediately. PATCH failure rolls back the session
 *   customer and toasts the error code from BE.
 * - `selectCustomer(null)` on a placed order PATCHes back to the staff
 *   user (fallback). On success, toast confirming reassignment.
 *
 * The in-flight PATCH promise is published to `pendingOwnerSync` so voucher
 * sheets can `await` it before validate/apply (existing guards).
 */
export function useOwnerSync({
  tableId,
  orderSlug,
}: UseOwnerSyncOptions): UseOwnerSyncResult {
  const { mutateAsync: patchOwner } = useChangeOrderOwner()
  const setOrderCustomer = useTableSessionsStore((s) => s.setOrderCustomer)
  const setPendingOwnerSync = useTableSessionsStore(
    (s) => s.setPendingOwnerSync,
  )
  const isOwnerSyncing = useTableSessionsStore(
    (s) => s.pendingOwnerSync !== null,
  )
  const queryClient = useQueryClient()

  const selectCustomer = useCallback(
    async (user: TableCustomer | null): Promise<void> => {
      // Snapshot for rollback BEFORE optimistic mutation.
      const previousCustomer =
        useTableSessionsStore.getState().sessions[tableId]?.customer ?? null

      // Optimistic FE update — always run.
      setOrderCustomer(tableId, user)

      // Cart pending — `createOrder` payload sends owner atomically.
      if (!orderSlug) return

      // Determine desired owner (null user → staff fallback so the order
      // becomes a "khách lẻ" with the current staff as owner).
      const staffSlug = useUserStore.getState().userInfo?.slug ?? ''
      const desiredOwner = user?.slug ?? staffSlug
      if (!desiredOwner) {
        // No staff slug either — BE would reject empty owner.
        setOrderCustomer(tableId, previousCustomer ?? null)
        showErrorToastMessage('Không thể cập nhật khách: thiếu định danh.')
        return
      }

      const wasClearAction = user === null

      const syncPromise: Promise<void> = patchOwner({
        slug: orderSlug,
        owner: desiredOwner,
      })
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: [...QUERYKEY.order, orderSlug],
          })
          if (wasClearAction) {
            const userInfo = useUserStore.getState().userInfo
            const staffName =
              `${userInfo?.firstName ?? ''} ${userInfo?.lastName ?? ''}`.trim() ||
              'nhân viên'
            showToast(
              `Đã chuyển sang đơn khách lẻ. Người phụ trách: ${staffName}`,
            )
          }
        })
        .catch((err: unknown) => {
          // Rollback session customer first, so voucher sheets awaiting the
          // rejection see UI already reverted.
          setOrderCustomer(tableId, previousCustomer ?? null)
          const code = (
            err as { response?: { data?: { errorCodeValue?: number } } }
          )?.response?.data?.errorCodeValue
          if (code) showErrorToast(code)
          else showErrorToastMessage('Đổi khách thất bại.')
          throw err
        })
        .finally(() => {
          // Promise-identity guard: another selectCustomer may have superseded
          // us (A→B race); only clear if our promise is still the stored one.
          if (
            useTableSessionsStore.getState().pendingOwnerSync === syncPromise
          ) {
            setPendingOwnerSync(null)
          }
        })

      setPendingOwnerSync(syncPromise)
      // Silence the stored reference so an absent awaiter doesn't trigger
      // window.unhandledrejection. Voucher sheets await the same syncPromise
      // and still observe the rejection.
      syncPromise.catch(() => undefined)

      try {
        await syncPromise
      } catch {
        // Already handled inside `.catch`. We swallow here so callers don't
        // need try/catch — UI feedback (toast, rollback) is the contract.
      }
    },
    [
      tableId,
      orderSlug,
      patchOwner,
      setOrderCustomer,
      setPendingOwnerSync,
      queryClient,
    ],
  )

  return { selectCustomer, isOwnerSyncing }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/tests/hooks/use-owner-sync.test.tsx
```

Expected: PASS — cả 4 test.

- [ ] **Step 6: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-owner-sync.ts src/tests/hooks/use-owner-sync.test.tsx
git commit -m "feat(hooks): add useOwnerSync hook for atomic customer pick + BE owner sync"
```

Verify only 2 files via `git status`.

---

## Task 2: Wire `useOwnerSync` vào `table-payment-screen.tsx` + XOÁ effect cũ

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`
  - Bỏ effect 351-435 (~85 dòng)
  - Bỏ `ownerSyncTokenRef` và `userInitiatedClearRef` (không còn dùng)
  - Replace `onSelect` ở line ~1086
  - Replace clear-customer call ở line ~1150

**Interfaces:**
- Consumes: `useOwnerSync({ tableId: id, orderSlug })` từ Task 1
- Produces: hành vi mới — customer pick/clear ở payment screen đi qua hook

- [ ] **Step 1: Đọc file để hiểu state hiện tại**

Đọc `src/components/staff/table-payment-screen.tsx`:
- Component nhận `id` prop (tableId) và lấy `orderSlug` từ session.
- Effect ở line 351-435 là `useEffect` có comment `// Sync session customer → BE order owner`.
- `userInitiatedClearRef` và `ownerSyncTokenRef` được khai báo somewhere phía trên (search trong file).
- Line ~1086: `<StaffCustomerSearchInput onSelect={(c) => setOrderCustomer(id, c)} />`.
- Line ~1150: `setOrderCustomer(id, null)` trong onConfirm của clear dialog.

- [ ] **Step 2: Import hook + lấy `selectCustomer`**

Thêm import:
```ts
import { useOwnerSync } from '@/hooks/use-owner-sync'
```

Trong component body (gần các hook khác, sau khi có `id` và `orderSlug`):
```ts
const { selectCustomer } = useOwnerSync({ tableId: id, orderSlug })
```

- [ ] **Step 3: Replace `onSelect` line ~1086**

Tìm:
```tsx
onSelect={(c) => setOrderCustomer(id, c)}
```

Thay bằng:
```tsx
onSelect={(c) => { void selectCustomer(c) }}
```

(`void` để rõ ràng là fire-and-forget; hook handle error qua toast nội bộ.)

- [ ] **Step 4: Replace clear-customer call line ~1150**

Tìm onConfirm của clear dialog:
```ts
setOrderCustomer(id, null)
```

Thay bằng:
```ts
void selectCustomer(null)
```

- [ ] **Step 5: XOÁ effect owner-sync 351-435**

Xoá toàn bộ block:
```ts
useEffect(() => {
  if (!orderSlug) return
  // ... (toàn bộ effect)
}, [session?.customer?.slug, orderData?.slug, orderData?.owner?.slug])
```

- [ ] **Step 6: XOÁ `userInitiatedClearRef` và `ownerSyncTokenRef`**

Search ref declarations:
```ts
const userInitiatedClearRef = useRef(...)
const ownerSyncTokenRef = useRef(...)
```

Xoá cả 2. Cũng tìm và xoá MỌI nơi gán hoặc đọc 2 ref này trong file (có thể có chỗ `userInitiatedClearRef.current = true` trước khi mở clear dialog — bỏ cả các gán đó).

- [ ] **Step 7: Bỏ các import không còn dùng**

Sau khi xoá effect, có thể không còn dùng `useChangeOrderOwner`, `queryClient`, `QUERYKEY`, `showErrorToastMessage`, `tToast` trong scope effect cũ. Lint sẽ flag — bỏ những import không còn reference. KHÔNG bỏ import đang được dùng ở chỗ khác trong file.

- [ ] **Step 8: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: no new errors. Nếu có unused import → bỏ.

- [ ] **Step 9: Run focused test suite cho file này**

```bash
npx vitest run src/tests/components/staff/staff-table-voucher-sheet-owner-sync-guard.test.tsx
```

Expected: 2/2 PASS — voucher sheet vẫn await `pendingOwnerSync` correctly (hook publish vào cùng slice).

- [ ] **Step 10: Commit**

```bash
git add src/components/staff/table-payment-screen.tsx
git commit -m "refactor(staff): replace owner-sync effect with useOwnerSync in payment screen"
```

Verify 1 file via `git status`.

---

## Task 3: Wire `useOwnerSync` vào `table-order-screen.tsx`

**Files:**
- Modify: `src/components/staff/table-order-screen.tsx` (line 653-654)

**Interfaces:**
- Consumes: `useOwnerSync({ tableId: id, orderSlug })` từ Task 1

Đây là TRƯỜNG HỢP BUG CỐT LÕI mà user report: cart context của đơn đã đặt — chọn khách KHÔNG trigger PATCH owner trước refactor.

- [ ] **Step 1: Đọc file**

Đọc `src/components/staff/table-order-screen.tsx` line 90-110 (xem `setOrderCustomer` được destructure ở đâu) và line 640-660 (xem prop wiring).

Xác định: component nhận `id` (tableId), `orderSlug` lấy từ `session.orderSlug` hoặc tương đương.

- [ ] **Step 2: Import + lấy hook**

Thêm import:
```ts
import { useOwnerSync } from '@/hooks/use-owner-sync'
```

Trong component body (sau khi có `id` và `orderSlug`):
```ts
const { selectCustomer } = useOwnerSync({ tableId: id, orderSlug: session.orderSlug })
```

Lưu ý: `session.orderSlug` có thể là `undefined` cho cart pending — hook handle đúng (skip PATCH).

- [ ] **Step 3: Replace line 653**

Tìm:
```tsx
onCustomerSelect={(c) => setOrderCustomer(id, c)}
```

Thay bằng:
```tsx
onCustomerSelect={(c) => { void selectCustomer(c) }}
```

- [ ] **Step 4: Replace line 654**

Tìm:
```tsx
onCustomerClear={() => setOrderCustomer(id, null)}
```

Thay bằng:
```tsx
onCustomerClear={() => { void selectCustomer(null) }}
```

- [ ] **Step 5: Bỏ destructure `setOrderCustomer` nếu không còn chỗ nào dùng**

Search:
```bash
grep -n "setOrderCustomer" src/components/staff/table-order-screen.tsx
```

Nếu CHỈ còn 2 chỗ vừa replace (giờ không gọi nữa) và 1 chỗ destructure ở ~line 100, bỏ cái destructure. Nếu còn chỗ khác dùng, GIỮ.

- [ ] **Step 6: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: no new errors.

- [ ] **Step 7: Run focused test**

```bash
npx vitest run src/tests/components/staff
```

Expected: tất cả test staff PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/staff/table-order-screen.tsx
git commit -m "fix(staff): use useOwnerSync in table-order-screen to PATCH owner on customer pick"
```

---

## Task 4: Wire `useOwnerSync` vào `admin-cart-content.tsx`

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (line 983, 1202)

**Interfaces:**
- Consumes: `useOwnerSync({ tableId: tableSlug, orderSlug })` từ Task 1

- [ ] **Step 1: Đọc file**

Đọc các đoạn quan trọng:
- Line 196 area: destructure `setOrderCustomer`.
- Line 983: `<StaffCustomerSearchInput onSelect={(c) => setOrderCustomer(tableSlug, c)} />`.
- Line 1202: `onConfirm={() => setOrderCustomer(tableSlug, null)}` trong `ConfirmClearCustomerDialog`.

Identify: component lấy `tableSlug` và `orderSlug` từ đâu. `orderSlug` thường lấy từ session (có thể `undefined` cho cart chưa đặt).

- [ ] **Step 2: Import + lấy hook**

Thêm import:
```ts
import { useOwnerSync } from '@/hooks/use-owner-sync'
```

Trong component body (sau khi có `tableSlug` và `orderSlug`):
```ts
const { selectCustomer } = useOwnerSync({ tableId: tableSlug, orderSlug })
```

- [ ] **Step 3: Replace line 983**

Tìm:
```tsx
onSelect={(c) => setOrderCustomer(tableSlug, c)}
```

Thay bằng:
```tsx
onSelect={(c) => { void selectCustomer(c) }}
```

- [ ] **Step 4: Replace line 1202**

Tìm:
```tsx
onConfirm={() => setOrderCustomer(tableSlug, null)}
```

Thay bằng:
```tsx
onConfirm={() => { void selectCustomer(null) }}
```

- [ ] **Step 5: Bỏ destructure nếu không còn chỗ dùng**

```bash
grep -n "setOrderCustomer" src/app/system/menu/components/admin-cart-content.tsx
```

Tương tự Task 3 Step 5.

- [ ] **Step 6: Run lint + focused test**

```bash
npm run lint 2>&1 | tail -20
npx vitest run src/tests
```

Expected: pass all.

- [ ] **Step 7: Commit**

```bash
git add src/app/system/menu/components/admin-cart-content.tsx
git commit -m "fix(admin): use useOwnerSync in admin-cart-content to PATCH owner on customer pick"
```

---

## Task 5: End-to-end manual verification

**Files:** không sửa code.

- [ ] **Step 1: Full test suite + build**

```bash
npm run test
npm run build
```

Expected: tất cả test PASS, build OK.

- [ ] **Step 2: Repro bug case ban đầu**

```bash
npm run dev
```

Trên browser:
1. Login role staff.
2. Mở 1 bàn, đặt đơn lần 1 KHÔNG chọn khách.
3. Tiếp tục thêm món (cart context của đơn đã đặt).
4. Nhập SDT → click khách trong suggestion.
5. **Mở Network tab**: kỳ vọng thấy 1 request `PATCH /orders/{slug}/owner` fire NGAY khi click.
6. Mở sheet voucher → apply 1 voucher.
7. Network: `POST /voucher/validate` → `PATCH /orders/{slug}/voucher` → cả 2 SUCCESS.

Expected: voucher được apply, không có error.

- [ ] **Step 3: Verify payment screen flow vẫn OK**

1. Đi tiếp đến payment screen (`/staff/table/:id/payment`).
2. Đổi customer ở đây.
3. Network: PATCH owner fire (qua hook, không qua effect cũ).
4. Apply voucher khác: cả validate + apply OK.

Expected: hành vi giống Task 5 Step 2.

- [ ] **Step 4: Verify clear-customer flow**

1. Trên đơn đã có khách, click "Xoá khách" → confirm dialog.
2. Network: PATCH owner với staff slug làm owner.
3. Toast "Đã chuyển sang đơn khách lẻ. Người phụ trách: ...".
4. Voucher require-identity (nếu đang apply) — voucher sheet auto-revalidate qua `useAutoRevalidateAppliedVoucher` (đã có sẵn).

- [ ] **Step 5: Verify failure path**

DevTools Network → block `PATCH /orders/*/owner`. Repeat Step 2.

Expected:
- Optimistic UI cho khách (hiện ngay).
- Spinner cạnh ô search hiển thị.
- Sau timeout/lỗi: rollback khách về trạng thái cũ, toast "Đổi khách thất bại" (hoặc error code BE).
- Voucher KHÔNG được apply (hook reject → voucher sheet awaiting cũng catch return).

- [ ] **Step 6: Verify cart pending (no slug) vẫn local-only**

1. Mở 1 bàn TRỐNG (chưa đặt đơn).
2. Thêm món.
3. Nhập SDT chọn khách.
4. Network: KHÔNG có PATCH owner (đơn chưa có slug).
5. Đặt đơn (createOrder).
6. Network: 1 POST createOrder với payload chứa `owner: customer.slug`. BE tạo đơn với owner đúng từ đầu.

- [ ] **Step 7: Verify /system/menu flow**

1. Vào `/system/menu`.
2. Thêm món vào cart.
3. Nhập SDT chọn khách.
4. Nếu cart pending → no PATCH (giống Step 6). Nếu order đã có slug → PATCH (giống Step 2).
5. Apply voucher: OK.

- [ ] **Step 8: Verify concurrent customer pick (A→B race)**

1. Vào payment screen với đơn đã đặt.
2. Click khách A từ suggestion → trong ~200ms click ngay khách B.
3. Network: 2 PATCH owner fire (A và B).
4. Kết quả cuối: BE order.owner = customer B (last-write-wins). UI hiển thị B.
5. Voucher apply (nếu thử trong khoảng đó) đợi promise mới nhất xong.

Expected: không có data divergence.

- [ ] **Step 9: Commit summary**

Không có code commit — chỉ verify. Nếu phát hiện regression, tạo commit fix theo task tương ứng.

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Bug case ban đầu user report (cart context placed order) → Task 3
- ✅ Replace effect cũ ở payment screen → Task 2
- ✅ Đồng nhất pattern qua 3 trang → Task 2, 3, 4
- ✅ Voucher sheet guard vẫn hoạt động (hook publish vào cùng `pendingOwnerSync` slice) → verified Step 9 của Task 2
- ✅ Spinner UX vẫn hoạt động (subscribe vào cùng slice) → no change needed
- ✅ Clear customer path → mỗi task cover line clear
- ✅ Failure rollback → Task 1 test #4 + Task 5 Step 5
- ✅ Race A→B → I2 fix carry forward (promise-identity check) — verified Task 5 Step 8
- ✅ Unhandled rejection silence → carry forward I1 fix trong hook

**2. Placeholder scan:** đã rà — không có "TBD/TODO/implement later". Mỗi step có code/command cụ thể.

**3. Type consistency:**
- `useOwnerSync({ tableId: string; orderSlug?: string | null })` → consistent ở Task 1, 2, 3, 4.
- `selectCustomer: (user: TableCustomer | null) => Promise<void>` → consistent.
- `TableCustomer` từ `@/types/session` → consistent với types file.
- `useTableSessionsStore.getState().pendingOwnerSync` → identity-check trong hook khớp với pattern Task 2 cũ (promise-identity).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-owner-sync-at-select-customer.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch 1 implementer subagent per task, 2-stage review giữa các task. Theo memory feedback của bạn — luôn dùng flow này cho code changes.

**2. Inline Execution** — Tuần tự trong session này qua `superpowers:executing-plans`, checkpoint sau Task 1, 4, 5.

Bạn chọn approach nào?
