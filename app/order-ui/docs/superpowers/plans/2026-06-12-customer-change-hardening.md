# Customer Change Hardening Plan (8 fixes, 3 phases)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> **DO NOT git commit per task** — leave changes in working tree for user.

**Goal:** Hardening tính năng đổi thông tin khách (customer) trong `TablePaymentScreen` shared by staff + admin. Fix sync drift, cross-device staleness, voucher invalidation, loading UX, error clarity, i18n.

**Scope:**
- `src/components/staff/table-payment-screen.tsx` — main file
- `src/components/staff/staff-customer-search-input.tsx` — pass loading prop
- `src/locales/{vi,en}/toast.json` + `src/locales/{vi,en}/menu.json` — i18n keys
- `src/stores/table-sessions.store.ts` — `setOrderCustomer` already exists; verify

**Architecture:**
- Phase 1 (CRITICAL): store + cache sync, voucher auto-remove on customer clear
- Phase 2 (UX): loading state, voucher revalidation, paid-order block
- Phase 3 (POLISH): error message clarity, i18n

**Risk:** Low–Medium. All changes touch a single shared component used by both staff + admin payment flows. Verify both contexts in smoke test.

---

# Phase 1 — Critical sync + voucher gating

## Task CC-1: Sync `session.customer` to store + invalidate cache

**Why:** Currently `setSelectedCustomer` only updates local React state. On page refresh, `session.customer` from store is stale. Other devices viewing same order don't see change until polling. Two fixes — same task because both fire after the same mutation.

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`

### Step 1: Verify store API

```bash
grep -n "setOrderCustomer" src/stores/table-sessions.store.ts | head -3
```

Should exist (added in earlier session for staff voucher/customer at payment). Signature: `setOrderCustomer(tableId: string, customer: TableCustomer | null) => void`.

### Step 2: Destructure from useTableSessions

In `TablePaymentScreen`, add to existing destructure:

```tsx
const { sessions, closeSession, cancelSession, setInvoiceRequest, setOrderCustomer } =
  useTableSessions()
```

### Step 3: Add QUERYKEY for orderBySlug invalidation

Add `queryClient` import + reference:

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { QUERYKEY } from '@/constants'

const queryClient = useQueryClient()
```

Check the existing `QUERYKEY.order` or similar key for `useOrderBySlug` invalidation:

```bash
grep -n "QUERYKEY\.\|order:\b\|orderBySlug" src/hooks/use-order.ts | head -10
```

### Step 4: Update `handleSelectCustomer`

Add 2 lines AFTER successful mutation:

```tsx
const handleSelectCustomer = async (customer: TableCustomer) => {
  const previous = selectedCustomer
  setSelectedCustomer(customer)
  if (!orderSlug) return
  try {
    await changeOrderOwnerAsync({ slug: orderSlug, owner: customer.slug })
    setOrderCustomer(id, customer)
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.orderBySlug, orderSlug] })
    showToast('Đã cập nhật khách hàng')
  } catch {
    setSelectedCustomer(previous)
    showErrorToastMessage('Không thể cập nhật khách hàng')
  }
}
```

### Step 5: Update `handleClearCustomer`

Same pattern — after successful clear:

```tsx
const handleClearCustomer = async () => {
  const previous = selectedCustomer
  if (!previous) return

  setSelectedCustomer(null)
  if (!orderSlug) return

  try {
    await changeOrderOwnerAsync({
      slug: orderSlug,
      owner: useUserStore.getState().userInfo?.slug ?? '',
    })
    setOrderCustomer(id, null)
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.orderBySlug, orderSlug] })
    // ... existing undo toast logic ...
  } catch {
    setSelectedCustomer(previous)
    showErrorToastMessage('Không thể bỏ khách hàng')
  }
}
```

### Step 6: Update the Undo handler inside Clear

Inside `onClick: async () => {...}` of the toast action button:

```tsx
onClick: async () => {
  setSelectedCustomer(previous)
  try {
    await changeOrderOwnerAsync({ slug: orderSlug, owner: previous.slug })
    setOrderCustomer(id, previous)
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.orderBySlug, orderSlug] })
    toast.success('Đã khôi phục khách hàng')
  } catch {
    setSelectedCustomer(null)
    showErrorToastMessage('Không thể khôi phục khách hàng')
  }
},
```

### Step 7: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/components/staff/table-payment-screen.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Expect clean. Manual smoke: change customer on staff/admin payment → reload page → customer persists. Open same order on second device → polling pulls fresh customer within 5s.

**NO COMMIT.**

---

## Task CC-2: Auto-remove voucher when customer cleared (if voucher requires identity)

**Why:** Voucher with `isVerificationIdentity: true` is bound to a specific customer. Clearing customer leaves an invalid voucher applied. Currently only blocked at confirm-payment step. Better UX: remove voucher automatically + show explicit toast.

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`

### Step 1: Update `handleClearCustomer`

After successful clear (before undo toast), check voucher and remove if needed:

```tsx
const handleClearCustomer = async () => {
  const previous = selectedCustomer
  const previousVoucher = selectedVoucher
  if (!previous) return

  setSelectedCustomer(null)
  if (!orderSlug) return

  try {
    await changeOrderOwnerAsync({
      slug: orderSlug,
      owner: useUserStore.getState().userInfo?.slug ?? '',
    })
    setOrderCustomer(id, null)
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.orderBySlug, orderSlug] })

    // CC-2: Auto-remove voucher if it required customer identity
    if (previousVoucher?.isVerificationIdentity) {
      try {
        setSelectedVoucher(null)
        await updateVoucherInOrderAsync({
          slug: orderSlug,
          voucher: null,
          orderItems: buildVoucherOrderItemsPayload(),
        })
        setOrderVoucher(id, null)
        showToast('Đã bỏ voucher do voucher yêu cầu khách hàng cụ thể')
      } catch {
        // Best-effort: voucher removal failure shouldn't block customer clear
        // eslint-disable-next-line no-console
        console.error('Failed to auto-remove voucher after customer clear')
      }
    }

    // ... existing undo toast logic ...
  } catch {
    setSelectedCustomer(previous)
    showErrorToastMessage('Không thể bỏ khách hàng')
  }
}
```

### Step 2: Destructure setOrderVoucher

Add to `useTableSessions()` destructure (likely already exists since voucher flow uses it).

### Step 3: Undo path

If user clicks "Hoàn tác", also restore voucher:

```tsx
onClick: async () => {
  setSelectedCustomer(previous)
  try {
    await changeOrderOwnerAsync({ slug: orderSlug, owner: previous.slug })
    setOrderCustomer(id, previous)
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.orderBySlug, orderSlug] })

    // CC-2: Restore voucher if we removed it during clear
    if (previousVoucher?.isVerificationIdentity) {
      try {
        setSelectedVoucher(previousVoucher)
        await updateVoucherInOrderAsync({
          slug: orderSlug,
          voucher: previousVoucher.slug,
          orderItems: buildVoucherOrderItemsPayload(),
        })
        setOrderVoucher(id, previousVoucher)
      } catch {
        // eslint-disable-next-line no-console
        console.error('Failed to restore voucher after undo')
      }
    }

    toast.success('Đã khôi phục khách hàng')
  } catch { ... }
},
```

### Step 4: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Manual: apply identity-required voucher → clear customer → voucher auto-removed + 2 toasts (clear customer + clear voucher). Click "Hoàn tác" → both restored.

**NO COMMIT.**

---

## Task CC-3: queryClient invalidate for voucher mutations too

**Why:** While we're at it — `handleApplyVoucher` and `handleRemoveVoucher` also need cache invalidation for cross-device sync. Same fix pattern.

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`

### Step 1: Add to handleApplyVoucher + handleRemoveVoucher

After successful mutation:

```tsx
const handleApplyVoucher = async (voucher: IVoucher) => {
  const previous = selectedVoucher
  setSelectedVoucher(voucher)
  if (!orderSlug) return
  try {
    await updateVoucherInOrderAsync({
      slug: orderSlug,
      voucher: voucher.slug,
      orderItems: buildVoucherOrderItemsPayload(),
    })
    setOrderVoucher(id, voucher)
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.orderBySlug, orderSlug] })
    showToast('Đã áp voucher')
  } catch {
    setSelectedVoucher(previous)
    showErrorToastMessage('Không thể áp voucher')
  }
}

// Similar for handleRemoveVoucher
```

### Step 2: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

**NO COMMIT.**

---

# Phase 2 — UX improvements

## Task CC-4: Loading state during customer change

**Why:** Click chọn customer → mutation pending nhưng input không disable → user can click again, fire double request, get unclear state.

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`
- Modify: `src/components/staff/staff-customer-search-input.tsx` (add `disabled` prop)

### Step 1: Inspect StaffCustomerSearchInput

```bash
grep -n "interface Props\|interface .*Props\|disabled" src/components/staff/staff-customer-search-input.tsx | head -10
```

Check if it accepts a `disabled` prop. If not, add one.

### Step 2: Add isPending to useChangeOrderOwner destructure

```tsx
const { mutateAsync: changeOrderOwnerAsync, isPending: isChangingOwner } = useChangeOrderOwner()
```

### Step 3: Pass disabled to StaffCustomerSearchInput

```tsx
<StaffCustomerSearchInput
  customer={selectedCustomer}
  onSelect={handleSelectCustomer}
  onClear={handleClearCustomer}
  disabled={isChangingOwner}  // NEW
/>
```

### Step 4: In StaffCustomerSearchInput, apply disabled to interactive elements

Mock pattern (adapt to actual JSX):

```tsx
interface Props {
  customer: TableCustomer | null
  onSelect: (c: TableCustomer) => void
  onClear: () => void
  disabled?: boolean
}

// Inside the trigger button / search dropdown:
<Button disabled={disabled || ...}>{ ... }</Button>
<Input disabled={disabled || ...} />
```

If the input has a clear (X) button, gate that too.

### Step 5: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: spam-click customer change → only first goes through, subsequent disabled until response.

**NO COMMIT.**

---

## Task CC-5: Voucher revalidation when customer changes

**Why:** Voucher applied for customer A becomes invalid when switched to customer B. Server may return different `eligible` flags. Trigger a fresh `validateVoucher` after customer change.

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`

### Step 1: Add validateVoucher hook

```tsx
import { useValidateVoucher } from '@/hooks'

const { mutate: validateVoucher } = useValidateVoucher()
```

### Step 2: After successful customer SELECT, revalidate applied voucher

```tsx
const handleSelectCustomer = async (customer: TableCustomer) => {
  // ... existing logic above ...
  try {
    await changeOrderOwnerAsync({ slug: orderSlug, owner: customer.slug })
    setOrderCustomer(id, customer)
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.orderBySlug, orderSlug] })

    // CC-5: Revalidate voucher with new customer context
    if (selectedVoucher && orderSlug) {
      validateVoucher(
        {
          voucher: selectedVoucher.slug,
          user: customer.slug,
          orderItems: buildVoucherOrderItemsPayload().map((it) => ({
            quantity: it.quantity,
            variant: it.variant,
            note: it.note,
            promotion: it.promotion,
            order: it.order,
            vatRate: 0,  // or pull from merged
          })),
        },
        {
          onError: () => {
            setSelectedVoucher(null)
            setOrderVoucher(id, null)
            updateVoucherInOrderAsync({
              slug: orderSlug,
              voucher: null,
              orderItems: buildVoucherOrderItemsPayload(),
            }).catch(() => {})
            showErrorToastMessage('Voucher không còn hợp lệ với khách hàng mới')
          },
        },
      )
    }

    showToast('Đã cập nhật khách hàng')
  } catch {
    // ... existing rollback ...
  }
}
```

### Step 3: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: apply voucher requiring customer A → switch to customer B → if voucher invalid, auto-removed + toast.

**NO COMMIT.**

---

## Task CC-6: Block customer change when order is paid/cancelled

**Why:** If order already paid (e.g. another device confirmed), customer change fails. Better: disable UI entirely with a hint.

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`

### Step 1: Compute isOrderEditable

```tsx
const isOrderEditable = useMemo(() => {
  const status = orderData?.status
  return status !== OrderStatus.PAID && status !== OrderStatus.CANCELLED
}, [orderData?.status])
```

Verify `OrderStatus` enum has those values:
```bash
grep -n "OrderStatus" src/types/order.type.ts | head -5
```

### Step 2: Gate inputs

```tsx
<StaffCustomerSearchInput
  customer={selectedCustomer}
  onSelect={handleSelectCustomer}
  onClear={handleClearCustomer}
  disabled={isChangingOwner || !isOrderEditable}
/>
<StaffTableVoucherSheet
  pendingItems={[]}
  submittedItems={orderItemsForVoucher}
  customer={selectedCustomer}
  appliedVoucher={selectedVoucher}
  onApply={handleApplyVoucher}
  onRemove={handleRemoveVoucher}
  disabled={!isOrderEditable}
/>
```

Add `disabled` prop to `StaffTableVoucherSheet` similar to Step CC-4.4.

### Step 3: Optional — show banner

```tsx
{!isOrderEditable && (
  <div className="px-4 py-2 bg-amber-100/60 border-l-4 border-amber-500 text-amber-800 text-xs">
    Đơn này đã thanh toán, không thể thay đổi khách hàng/voucher.
  </div>
)}
```

### Step 4: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: mock PAID order → customer search input disabled, voucher sheet disabled, banner shown.

**NO COMMIT.**

---

# Phase 3 — Polish

## Task CC-7: Surface specific BE error codes

**Why:** `'Không thể bỏ khách hàng'` doesn't say why. BE returns error codes (e.g. 401 auth, 404 order not found, 409 conflict). Use existing `showErrorToast(code)` pattern.

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`

### Step 1: Find showErrorToast vs showErrorToastMessage

```bash
grep -n "export function showErrorToast" src/utils/toast.tsx | head -5
```

Pattern: `showErrorToast(errorCode: number)` looks up i18n key. `showErrorToastMessage(message: string)` shows direct string.

### Step 2: Update catch blocks to extract code

```tsx
try {
  await changeOrderOwnerAsync({ ... })
  // ...
} catch (err) {
  setSelectedCustomer(previous)
  const code = (err as { response?: { data?: { errorCodeValue?: number } } })
    ?.response?.data?.errorCodeValue
  if (code) showErrorToast(code)
  else showErrorToastMessage('Không thể cập nhật khách hàng')
}
```

Apply to all 3 catch blocks (select, clear, undo).

### Step 3: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: trigger 401 (logout in another tab) → toast shows BE message instead of generic.

**NO COMMIT.**

---

## Task CC-8: i18n all hardcoded VN strings

**Why:** Strings like `'Đã cập nhật khách hàng'`, `'Đã bỏ khách'`, `'Hoàn tác'`, `'Đã khôi phục khách hàng'`, `'Voucher không còn hợp lệ...'` are hardcoded VN. Need i18n for en + future locales.

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`
- Modify: `src/locales/vi/toast.json`, `src/locales/en/toast.json`

### Step 1: Audit hardcoded strings in the file

```bash
grep -n "'[A-ZĐĨ].*[a-z]'" src/components/staff/table-payment-screen.tsx | grep -v "//" | head -20
```

List strings. Likely:
- 'Đã cập nhật khách hàng' → `toast.updateCustomerSuccess`
- 'Không thể cập nhật khách hàng' → `toast.updateCustomerFailed`
- 'Đã bỏ khách X' → `toast.removeCustomerSuccess` (interpolated name)
- 'Hoàn tác' → `toast.undo`
- 'Đã khôi phục khách hàng' → `toast.restoreCustomerSuccess`
- 'Không thể bỏ khách hàng' → `toast.removeCustomerFailed`
- 'Không thể khôi phục khách hàng' → `toast.restoreCustomerFailed`
- 'Đã bỏ voucher do voucher yêu cầu khách hàng cụ thể' → `toast.voucherAutoRemovedNoCustomer`
- 'Voucher không còn hợp lệ với khách hàng mới' → `toast.voucherInvalidForNewCustomer`
- 'Đơn này đã thanh toán...' → `menu.order.paidOrderReadonly`

### Step 2: Add to vi/toast.json + en/toast.json + menu.json

Add all keys with sensible defaults.

### Step 3: Replace hardcoded calls

Add `const { t: tToast } = useTranslation('toast')` if not already present.

Replace:
```tsx
showToast(tToast('toast.updateCustomerSuccess'))
showErrorToastMessage(tToast('toast.updateCustomerFailed'))
toast.success(tToast('toast.removeCustomerSuccess', { name: customerName }), { ... })
```

For interpolation: pass variables as second arg: `t('toast.removeCustomerSuccess', { name: customerName })` with i18n value `"Đã bỏ khách {{name}}"`.

### Step 4: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: switch language to en → toasts in English.

**NO COMMIT.**

---

# Final verification

## Task FINAL: Full QA

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -3
npx eslint src/ 2>&1 | tail -5
npx vitest run 2>&1 | tail -5
```

Smoke checklist:
1. Staff payment screen — select customer → success toast + store synced + cache invalidated
2. Staff payment screen — clear customer → undo toast → click "Hoàn tác" → restored
3. Apply identity-required voucher → clear customer → voucher auto-removed
4. Click "Hoàn tác" after step 3 → customer + voucher both restored
5. Apply customer A + voucher → switch to customer B → if voucher invalid, auto-removed
6. Open paid order in payment screen → customer input disabled + banner shown
7. Spam-click customer change → only first goes through
8. Logout in another tab → trigger 401 → BE error code displayed
9. Switch language to en → all toasts in English
10. 2 devices viewing same order — change customer on device A → device B polls update within 5s

---

# Design Decisions

1. **Why setOrderCustomer in addition to setSelectedCustomer:** Store is source of truth across mounts; local React state for current-render snapshot. Both must update or data drifts on refresh.
2. **Why invalidate orderBySlug:** Other devices share cache via TanStack Query polling. Invalidation triggers immediate refetch on this device and signals cross-device staleness.
3. **Why auto-remove voucher on customer clear:** Identity-required vouchers are bound to a specific user. Letting it persist invalidates payment at last step — bad UX. Better: remove early + tell user why.
4. **Why disabled prop instead of removing UI:** Keeps layout stable, communicates state clearly.
5. **Why BE error codes:** Codes carry semantics. Generic toast hides root cause from support/QA.
6. **Why i18n in Phase 3:** Functional fixes first; localization is polish but should not block hardening.

# Out of scope

- Real-time WebSocket sync (currently polling-based, fine for restaurant ops)
- Customer auto-suggest based on phone history (separate feature)
- Inline customer create from payment screen (existing dialog flow)
- Voucher allowlist enforcement at FE before applying (server-validated, OK)
