# Owner Sync Before Voucher Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng race condition giữa owner-sync (`PATCH /orders/:slug/owner`) và apply voucher (`PATCH /orders/:slug/voucher`) trên `table-payment-screen` bằng cách track promise của owner-sync vào store và bắt các sheet voucher `await` promise đó trước khi gọi validate/apply.

**Architecture:** Thêm slice `pendingOwnerSync: Promise<void> | null` (không persist) vào `table-sessions.store.ts`. Owner-sync effect hiện có trong `table-payment-screen.tsx` (line 351-424) được augment để set promise khi PATCH owner đang in-flight và clear khi settled. Các sheet voucher (`StaffTableVoucherSheet`, `StaffVoucherListSheetInPayment`) đọc promise này và `await` trong handler apply trước khi gọi `validateVoucher`/`updateVoucherInOrder`. UI ô tìm khách hiển thị spinner khi đang pending.

**Tech Stack:** React 18, Zustand (persist middleware), TanStack Query v5, TypeScript, Vitest, react-testing-library

## Global Constraints

- Test framework: Vitest. Chạy: `npx vitest run <path>` cho 1 file.
- Lint + type-check: `npm run build` chạy `lint + tsc -b + vite build`. Lint riêng: `npm run lint`.
- `table-sessions.store.ts` được persist vào `localStorage` qua Zustand `persist`. Field `pendingOwnerSync` **KHÔNG được persist** (promise không serialize được) — phải dùng option `partialize` để loại trừ.
- Store reset trong test: `useTableSessionsStore.setState({ sessions: {}, pendingOwnerSync: null })` trong `beforeEach`.
- Test files đặt ở `src/tests/<mirror-src-path>/<name>.test.ts(x)` — KHÔNG đặt cạnh source.
- Tiếng Việt cho user-facing string; key i18n nằm trong `public/locales/`.
- KHÔNG đụng các flow OUT-OF-SCOPE: `table-order-screen.tsx` cart pending, `admin-cart-content.tsx`, `payment-page.tsx` đổi customer (read-only), `order-flow.store.ts` `updateDraftCustomer`, `cart.store.ts` customer flow client-side.

## File Structure

**Modify:**
- `src/stores/table-sessions.store.ts` — thêm interface field `pendingOwnerSync`, action `setPendingOwnerSync`; cập nhật `partialize` để skip field.
- `src/components/staff/table-payment-screen.tsx` (line 351-424) — wrap `changeOrderOwnerAsync().then().catch()` chain trong promise được track qua `setPendingOwnerSync`.
- `src/components/staff/staff-table-voucher-sheet.tsx` (line 252 `handleToggle`) — `await` `pendingOwnerSync` trước nhánh validate (skip nhánh remove/identity-check sớm).
- `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` (line 194 `handleCompleteSelection`) — `await` `pendingOwnerSync` ở đầu hàm trước khi build payload.
- `src/components/staff/staff-customer-search-input.tsx` — thêm spinner inline cạnh ô input khi `pendingOwnerSync !== null`.

**Create:**
- `src/tests/stores/table-sessions-pending-owner-sync.test.ts` — unit test cho slice mới.
- `src/tests/components/staff/staff-table-voucher-sheet-owner-sync-guard.test.tsx` — integration test cho guard `await`.

**NOT touched (out of scope):**
- `src/stores/cart.store.ts`, `src/stores/order-flow.store.ts`
- `src/components/staff/table-order-screen.tsx`
- `src/app/system/menu/components/admin-cart-content.tsx`
- `src/app/system/payment/payment-page.tsx`
- `src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx`
- `src/hooks/use-order.ts` (`useChangeOrderOwner`)
- `src/hooks/use-auto-revalidate-applied-voucher.ts`

---

## Task 1: Thêm slice `pendingOwnerSync` vào `table-sessions.store.ts`

**Files:**
- Modify: `src/stores/table-sessions.store.ts` (interface `ITableSessionsStore`, store factory, `partialize`)
- Test: `src/tests/stores/table-sessions-pending-owner-sync.test.ts` (mới)

**Interfaces:**
- Produces:
  - State field: `pendingOwnerSync: Promise<void> | null`
  - Action: `setPendingOwnerSync: (p: Promise<void> | null) => void`

- [ ] **Step 1: Write the failing test**

Tạo file mới `src/tests/stores/table-sessions-pending-owner-sync.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTableSessionsStore } from '@/stores/table-sessions.store'

describe('useTableSessionsStore.pendingOwnerSync', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {}, pendingOwnerSync: null })
  })

  it('defaults to null on a fresh store', () => {
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBeNull()
  })

  it('setPendingOwnerSync stores the given promise', () => {
    const p = Promise.resolve()
    useTableSessionsStore.getState().setPendingOwnerSync(p)
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBe(p)
  })

  it('setPendingOwnerSync(null) clears the promise', () => {
    const p = Promise.resolve()
    useTableSessionsStore.getState().setPendingOwnerSync(p)
    useTableSessionsStore.getState().setPendingOwnerSync(null)
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBeNull()
  })

  it('pendingOwnerSync is not persisted (partialize strips it)', () => {
    const p = Promise.resolve()
    useTableSessionsStore.getState().setPendingOwnerSync(p)
    const raw = localStorage.getItem('staff:table-sessions')
    if (!raw) return // store may not have persisted anything yet — acceptable
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> }
    expect(parsed.state?.pendingOwnerSync).toBeUndefined()
  })
})
```

Lưu ý: Storage key có thể khác `'staff:table-sessions'` — trong Step 3 sau khi đọc source, replace bằng key đúng (vd. xem `STORAGE_KEYS` trong `src/data/staff-data.ts`). Step này chỉ ép test fail trước.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/stores/table-sessions-pending-owner-sync.test.ts
```

Expected: FAIL — `setPendingOwnerSync is not a function` hoặc `pendingOwnerSync` undefined trên state.

- [ ] **Step 3: Add field + action to store interface**

Trong `src/stores/table-sessions.store.ts`, sau dòng khai báo `sessions: Sessions` (~line 51), thêm vào interface `ITableSessionsStore`:

```ts
  /** Promise of in-flight owner-sync PATCH. Voucher sheets await this in
   *  handleToggle so apply doesn't race the BE owner update. Memory-only —
   *  excluded from persist via `partialize`. */
  pendingOwnerSync: Promise<void> | null
  setPendingOwnerSync: (p: Promise<void> | null) => void
```

- [ ] **Step 4: Add initial state + action implementation**

Trong store factory (sau `sessions: {},` ở initial state), thêm:

```ts
      pendingOwnerSync: null,
      setPendingOwnerSync: (p) => set({ pendingOwnerSync: p }),
```

- [ ] **Step 5: Exclude `pendingOwnerSync` from persist via `partialize`**

Tìm khối `persist(..., { name: ..., storage: ... })` ở cuối file `table-sessions.store.ts`. Thêm option `partialize`:

```ts
    {
      name: STORAGE_KEYS.tableSessions, // hoặc key hiện tại
      storage: createJSONStorage(() => legacyMigratingStorage),
      partialize: (state) => ({ sessions: state.sessions }),
    },
```

Lưu ý: nếu options object đã có sẵn `partialize`, chỉ thêm field cần persist (giữ nguyên các field cũ) — KHÔNG include `pendingOwnerSync`.

- [ ] **Step 6: Sửa storage key trong test cho khớp**

Mở `src/stores/table-sessions.store.ts`, copy giá trị `name:` trong khối `persist`. Replace `'staff:table-sessions'` ở Step 1 bằng giá trị đúng.

- [ ] **Step 7: Run test to verify it passes**

```bash
npx vitest run src/tests/stores/table-sessions-pending-owner-sync.test.ts
```

Expected: PASS — cả 4 test.

- [ ] **Step 8: Commit**

```bash
git add src/stores/table-sessions.store.ts src/tests/stores/table-sessions-pending-owner-sync.test.ts
git commit -m "feat(staff): track pendingOwnerSync promise in table-sessions store"
```

---

## Task 2: Track promise trong owner-sync effect ở `table-payment-screen.tsx`

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx` (line 351-424 — owner-sync effect)

**Interfaces:**
- Consumes: `useTableSessionsStore().setPendingOwnerSync` từ Task 1
- Produces: hiệu ứng phụ — `pendingOwnerSync` luôn = promise đang chạy hoặc `null`

- [ ] **Step 1: Đọc lại effect hiện tại (line 351-424)**

Mở `src/components/staff/table-payment-screen.tsx`. Tìm `useEffect` bắt đầu ở line 351 (comment "Sync session customer → BE order owner"). Hiểu logic hiện tại: race-guarded qua `ownerSyncTokenRef`, rollback `setOrderCustomer(id, previousTableCustomer)` khi `.catch`, invalidate `[...QUERYKEY.order, orderSlug]` khi `.then`.

- [ ] **Step 2: Lấy `setPendingOwnerSync` từ store**

Trong component (cùng nơi đang lấy `setOrderCustomer`), thêm:

```ts
const setPendingOwnerSync = useTableSessionsStore((s) => s.setPendingOwnerSync)
```

(Nếu component đã destructure store qua selector khác, thêm field này vào selector tương ứng.)

- [ ] **Step 3: Wrap chain `.then/.catch` bằng promise được track**

Thay khối từ `changeOrderOwnerAsync({...}).then(...).catch(...)` (line 399-422) bằng:

```ts
    const syncPromise: Promise<void> = changeOrderOwnerAsync({
      slug: orderSlug,
      owner: desiredOwner,
    })
      .then(() => {
        if (ownerSyncTokenRef.current !== myToken) return
        queryClient.invalidateQueries({
          queryKey: [...QUERYKEY.order, orderSlug],
        })
        if (wasUserInitiatedClear) {
          showToast(
            `Đã chuyển sang đơn khách lẻ. Người phụ trách: ${staffName}`,
          )
        }
      })
      .catch((err) => {
        if (ownerSyncTokenRef.current !== myToken) return
        setOrderCustomer(id, previousTableCustomer)
        const code = (
          err as { response?: { data?: { errorCodeValue?: number } } }
        )?.response?.data?.errorCodeValue
        if (code) showErrorToast(code)
        else showErrorToastMessage(tToast('toast.updateCustomerFailed'))
        // Re-throw để voucher sheet đang await biết owner-sync fail và bỏ apply.
        throw err
      })
      .finally(() => {
        // Chỉ clear khi mình vẫn là dispatch mới nhất — tránh race khi user
        // chọn customer A → B liên tiếp, promise của A finally KHÔNG được phép
        // ghi đè promise của B.
        if (ownerSyncTokenRef.current === myToken) {
          setPendingOwnerSync(null)
        }
      })

    setPendingOwnerSync(syncPromise)
```

Lưu ý quan trọng:
- `setPendingOwnerSync(syncPromise)` phải gọi **sau** khi `.then/.catch/.finally` đã chain xong — nếu không, voucher sheet `await` promise raw có thể bị unhandled rejection.
- `.catch` cuối cùng phải re-throw `err` để voucher sheet phía dưới (`await pendingOwnerSync`) biết owner-sync fail và `return` không apply voucher.

- [ ] **Step 4: Verify type-check + lint pass**

```bash
npm run lint
```

Expected: không có error mới ở file vừa sửa.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Mở DevTools console, vào 1 bàn có đơn đã đặt:
1. Đổi customer ở payment screen.
2. Trong console: `useTableSessionsStore.getState().pendingOwnerSync` → kỳ vọng thấy `Promise` ngay khi click.
3. Đợi 1-2s → check lại → kỳ vọng `null`.
4. Quan sát Network: 1 request `PATCH /orders/:slug/owner`. Nếu 200 → cache invalidate, không toast. Nếu fail → rollback session.

Nếu manual test pass → tiếp tục. Nếu fail → kiểm tra `ownerSyncTokenRef` reset logic ở Step 3.

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/table-payment-screen.tsx
git commit -m "feat(staff): track owner-sync promise in pendingOwnerSync store slice"
```

---

## Task 3: Guard `StaffTableVoucherSheet.handleToggle` bằng `await pendingOwnerSync`

**Files:**
- Modify: `src/components/staff/staff-table-voucher-sheet.tsx` (line 252-284 `handleToggle`)
- Test: `src/tests/components/staff/staff-table-voucher-sheet-owner-sync-guard.test.tsx` (mới)

**Interfaces:**
- Consumes: `useTableSessionsStore().pendingOwnerSync` từ Task 1
- Produces: `handleToggle` trở thành `async`; gọi `validateVoucher` chỉ sau khi owner-sync settled

- [ ] **Step 1: Write the failing test**

Tạo `src/tests/components/staff/staff-table-voucher-sheet-owner-sync-guard.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { StaffTableVoucherSheet } from '@/components/staff/staff-table-voucher-sheet'
import { useTableSessionsStore } from '@/stores/table-sessions.store'

const validateVoucherMock = vi.fn((_payload, opts) => opts?.onSuccess?.())

vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/hooks')>('@/hooks')
  return {
    ...actual,
    useValidateVoucher: () => ({ mutate: validateVoucherMock }),
    useVouchersForOrder: () => ({
      data: {
        result: {
          items: [
            {
              slug: 'v1',
              code: 'CODE1',
              value: 10,
              isVerificationIdentity: false,
              maxUsage: 10,
              remainingUsage: 5,
            },
          ],
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    }),
    useAutoRevalidateAppliedVoucher: () => undefined,
  }
})

function renderSheet(props?: Partial<React.ComponentProps<typeof StaffTableVoucherSheet>>) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <StaffTableVoucherSheet
        pendingItems={[]}
        submittedItems={[]}
        customer={{ slug: 'c1', firstName: 'A', lastName: 'B', phonenumber: '0900' }}
        appliedVoucher={null}
        onApply={vi.fn()}
        onRemove={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('StaffTableVoucherSheet — owner-sync guard', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {}, pendingOwnerSync: null })
    validateVoucherMock.mockClear()
  })

  it('does not call validateVoucher while pendingOwnerSync is unresolved', async () => {
    let resolveOwner!: () => void
    const ownerPromise = new Promise<void>((r) => { resolveOwner = r })
    useTableSessionsStore.getState().setPendingOwnerSync(ownerPromise)

    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /voucher/i }))

    // Apply card. Tìm theo code voucher đã mock.
    const applyBtn = await screen.findByText(/CODE1/i)
    fireEvent.click(applyBtn)

    // Vẫn chưa gọi validate (đang đợi owner-sync)
    expect(validateVoucherMock).not.toHaveBeenCalled()

    resolveOwner()
    await waitFor(() => expect(validateVoucherMock).toHaveBeenCalled())
  })

  it('skips validateVoucher when pendingOwnerSync rejects', async () => {
    const ownerPromise = Promise.reject(new Error('owner sync failed'))
    // Catch để Vitest không log unhandled rejection.
    ownerPromise.catch(() => undefined)
    useTableSessionsStore.getState().setPendingOwnerSync(ownerPromise)

    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /voucher/i }))
    const applyBtn = await screen.findByText(/CODE1/i)
    fireEvent.click(applyBtn)

    await new Promise((r) => setTimeout(r, 0))
    expect(validateVoucherMock).not.toHaveBeenCalled()
  })
})
```

Lưu ý:
- Test sheet trigger: `getByRole('button', { name: /voucher/i })` — nếu trigger không có label phù hợp, đổi sang `getByTestId` hoặc selector trong source. Subagent verify selector thực tế khi run test.
- Tìm "apply" trên card voucher: dùng code voucher (`CODE1`) hoặc text rõ ràng từ render — verify khi run.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/components/staff/staff-table-voucher-sheet-owner-sync-guard.test.tsx
```

Expected: FAIL — `validateVoucherMock` được gọi ngay không đợi promise.

- [ ] **Step 3: Implement guard trong `handleToggle`**

Trong `src/components/staff/staff-table-voucher-sheet.tsx`:

(a) Thêm import (gần các import store khác):
```ts
import { useUserStore, useTableSessionsStore } from '@/stores'
```
(Nếu file đã import `useUserStore` riêng, gộp vào.)

(b) Lấy `pendingOwnerSync` getter ngay trong component body (sau khai báo các store khác):
```ts
const getPendingOwnerSync = () =>
  useTableSessionsStore.getState().pendingOwnerSync
```
(Dùng `getState()` thay vì hook subscribe để tránh re-render mỗi khi promise đổi — chỉ cần snapshot khi click.)

(c) Sửa `handleToggle` (line 252) thành `async` và thêm guard sau nhánh check `isVerificationIdentity`:

```ts
  const handleToggle = async (v: IVoucher) => {
    if (isApplied(v.slug)) {
      setStickyVoucher(v)
      onRemove()
      void refetch()
      return
    }
    if (v.isVerificationIdentity && !customer) {
      showErrorToast(1004)
      return
    }
    // Guard race: wait for any in-flight owner-sync so BE owner == FE customer
    // before validating the voucher (otherwise apply hits stale order.owner).
    const pending = getPendingOwnerSync()
    if (pending) {
      try {
        await pending
      } catch {
        // Owner sync failed; owner-sync effect đã toast + rollback. Bỏ apply.
        return
      }
    }
    validateVoucher(
      {
        voucher: v.slug,
        user: customer?.slug ?? userInfo?.slug ?? '',
        orderItems: allItems.map((i) => ({
          quantity: i.quantity,
          variant: i.variantSlug ?? '',
          note: i.note,
          promotion: i.promotion?.slug ?? null,
          order: null,
          vatRate: i.vatRate ?? 0,
        })),
      },
      {
        onSuccess: () => {
          onApply(v)
          setOpen(false)
        },
      },
    )
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/components/staff/staff-table-voucher-sheet-owner-sync-guard.test.tsx
```

Expected: PASS cả 2 test.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/staff-table-voucher-sheet.tsx src/tests/components/staff/staff-table-voucher-sheet-owner-sync-guard.test.tsx
git commit -m "fix(voucher): await pendingOwnerSync before validate in StaffTableVoucherSheet"
```

---

## Task 4: Guard `StaffVoucherListSheetInPayment.handleCompleteSelection`

**Files:**
- Modify: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` (line 194 `handleCompleteSelection`)

**Interfaces:**
- Consumes: `useTableSessionsStore().pendingOwnerSync` từ Task 1
- Produces: `handleCompleteSelection` đã guard

- [ ] **Step 1: Thêm import store**

Trong `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx`, thêm:
```ts
import { useTableSessionsStore } from '@/stores'
```
(Hoặc gộp vào import store sẵn có nếu file đã có.)

- [ ] **Step 2: Thêm helper getter trong component body**

Trong component body (sau khai báo store/hooks hiện có):
```ts
const getPendingOwnerSync = () =>
  useTableSessionsStore.getState().pendingOwnerSync
```

- [ ] **Step 3: Insert guard ngay đầu `handleCompleteSelection`**

Sửa hàm tại line 194:

```ts
  const handleCompleteSelection = async () => {
    if (!orderData) return

    // Guard race: voucher apply phụ thuộc order.owner trên BE — đợi owner-sync.
    const pending = getPendingOwnerSync()
    if (pending) {
      try {
        await pending
      } catch {
        return
      }
    }

    const orderSlug = orderData.slug
    // ... phần còn lại của hàm giữ nguyên
```

- [ ] **Step 4: Run lint + tsc**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Vào `/system/table/:id/payment` (cùng component table-payment-screen) — `StaffVoucherListSheetInPayment` chỉ dùng ở `/system/payment` (customer read-only ở đó), nên chủ yếu là sanity check không vỡ flow apply voucher hiện tại:
1. Mở 1 đơn ở `/system/payment`.
2. Click voucher → chọn → confirm.
3. Quan sát: voucher apply OK như trước. Network có 1 PATCH voucher.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx
git commit -m "fix(voucher): await pendingOwnerSync in StaffVoucherListSheetInPayment"
```

---

## Task 5: Spinner UX khi `pendingOwnerSync` đang in-flight

**Files:**
- Modify: `src/components/staff/staff-customer-search-input.tsx`

**Interfaces:**
- Consumes: `useTableSessionsStore().pendingOwnerSync` từ Task 1
- Produces: UI signal — spinner inline cạnh input khi owner-sync đang chạy

- [ ] **Step 1: Subscribe `pendingOwnerSync` trong component**

Trong `src/components/staff/staff-customer-search-input.tsx`, thêm import (nếu chưa có):
```ts
import { useTableSessionsStore } from '@/stores'
```

Trong component body:
```ts
const isOwnerSyncing = useTableSessionsStore((s) => s.pendingOwnerSync !== null)
```

- [ ] **Step 2: Render spinner inline cạnh input**

Tìm chỗ render `<Input ... />` (~line 138-149). Wrap trong relative container và thêm spinner:

```tsx
<div className="relative">
  <Input
    type="text"
    placeholder="Tìm khách theo số điện thoại..."
    // ... props cũ giữ nguyên
  />
  {isOwnerSyncing && (
    <div
      className="absolute right-2 top-1/2 -translate-y-1/2"
      title="Đang đồng bộ khách hàng…"
    >
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  )}
</div>
```

Thêm import `Loader2`:
```ts
import { Loader2 } from 'lucide-react'
```

(Nếu file đã có icon từ `lucide-react`, gộp vào dòng import sẵn có.)

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

1. Vào 1 bàn có đơn đã đặt, mở payment screen.
2. Chọn 1 customer khác.
3. Quan sát: spinner hiện cạnh ô search trong ~vài trăm ms (cho tới khi PATCH owner xong).
4. Spinner biến mất khi xong.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/staff-customer-search-input.tsx
git commit -m "feat(staff): show spinner while owner-sync is in flight"
```

---

## Task 6: End-to-end manual verification

**Files:** không sửa code.

- [ ] **Step 1: Chạy full test suite**

```bash
npm run test
```

Expected: tất cả test PASS. Nếu có regression liên quan voucher/owner — kiểm tra trước khi tiếp tục.

- [ ] **Step 2: Build production**

```bash
npm run build
```

Expected: lint + tsc + vite build đều OK.

- [ ] **Step 3: Reproduce bug case ban đầu**

```bash
npm run dev
```

Reproduce kịch bản:
1. Tạo 1 đơn lần 1 (chưa chọn khách) — `order.owner` = staff slug trên BE.
2. Trên payment screen, chọn 1 SĐT khách từ suggestion.
3. **Ngay lập tức** (trong ~1s, trước khi PATCH owner xong) mở sheet voucher.
4. Bấm apply 1 voucher.

Expected:
- Trước fix: validate OK, apply fail vì BE check theo `order.owner` cũ (staff).
- Sau fix: voucher sheet hiện spinner hoặc chờ → validate + apply chỉ chạy sau khi PATCH owner xong → apply success.

- [ ] **Step 4: Test path tắc** (network slow)

DevTools → Network → Throttling "Slow 3G". Lặp lại Step 3.

Expected: vẫn apply OK; spinner cạnh ô search hiển thị lâu hơn.

- [ ] **Step 5: Test rollback path**

Trong DevTools → Network → block `PATCH /orders/*/owner`. Lặp lại Step 3.

Expected:
- Spinner hiện rồi biến mất với toast lỗi.
- Customer trên UI rollback về owner cũ.
- Voucher KHÔNG được apply (handleToggle bắt `await pending` reject → return).

- [ ] **Step 6: Commit summary nếu cần**

Không có code commit — chỉ verify. Nếu phát hiện issue, tạo commit fix theo task tương ứng.

---

## Self-Review Checklist

Sau khi viết xong plan:

**1. Spec coverage:**
- ✅ Owner-sync race với voucher apply → Task 1-3
- ✅ POS staff payment + cashier `/system/table/:id/payment` (cùng component) → Task 2
- ✅ Voucher sheet ở `/system/payment` → Task 4
- ✅ UX signaling → Task 5
- ✅ End-to-end verification bug case ban đầu → Task 6
- ❌ Update-order voucher sheet (`staff-voucher-list-sheet-in-update-order-with-local-storage.tsx`) — **OUT OF SCOPE** vì update-order không có UI đổi customer (đã verify).
- ❌ Client cart `addCustomerInfo` — **OUT OF SCOPE** vì cart pending không gọi API owner.

**2. Placeholder scan:** đã rà — không có TBD/TODO/"add appropriate error handling" placeholders. Mỗi step có code/command cụ thể.

**3. Type consistency:**
- `setPendingOwnerSync: (p: Promise<void> | null) => void` — dùng đồng nhất Task 1, 2.
- `pendingOwnerSync: Promise<void> | null` — read trong Task 3, 4, 5 đều dùng `useTableSessionsStore.getState().pendingOwnerSync` (snapshot) hoặc selector `(s) => s.pendingOwnerSync !== null` (Task 5 — boolean).
- `useTableSessionsStore` được import từ `@/stores` ở Task 3, 4, 5 — nhất quán.

**4. Test pattern:** theo convention sẵn có (`src/tests/stores/table-sessions-voucher.test.ts`) — `beforeEach` reset store, `useTableSessionsStore.setState(...)`, dùng `getState()` cho action.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-owner-sync-before-voucher-apply.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch 1 implementer subagent per task, 2-stage code review giữa các task. Khuyến nghị vì user có memory feedback "Always use subagent-driven flow for code changes".

**2. Inline Execution** — Thực thi tuần tự trong session này qua `superpowers:executing-plans`, checkpoint sau Task 1, Task 3, Task 6.

Bạn chọn approach nào?
