# Staff: Move Voucher + Customer From Pre-Payment to Payment Step

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> **IMPORTANT:** Each task — do NOT `git commit`. Leave changes in working tree for user to commit themselves.

**Goal:** Refactor staff flow theo design mới của BE — voucher + customer (owner) chỉ được set ở **bước thanh toán**, không phải ở bước đặt món. Endpoints giữ nguyên, chỉ đổi vị trí UI + thời điểm gọi API.

**Architecture:**
- Phase 1 (Order screen `/staff/table/:id`): chỉ items + table + branch + note. Customer = staff slug (default). Voucher = null.
- Phase 2 (Payment screen `/staff/table/:id/payment`): customer search + voucher sheet + chọn payment method. Trước khi `initiatePayment`, sync customer + voucher với BE qua existing endpoints.

**Tech Stack:** React 18, Zustand persist (`useTableSessions`), TanStack Query, shadcn UI, existing hooks (`useUpdateVoucherInOrder`, `updateOrderType`, `useInitiatePayment`).

**Risk:** Medium. Touch nhiều file + có session migration. Test cẩn thận với reload + multi-tab.

---

## BE Contract Assumptions (cần confirm)

> Plan dưới đây giả định các điểm sau. **Confirm với BE trước Task B2 + B3.**

| # | Assumption | Confirm cách |
|---|---|---|
| 1 | `createOrder` với `owner = staff.slug` + `voucher = null` vẫn pass BE validation | Đã test ở môi trường dev |
| 2 | `PATCH /orders/{slug}` (`updateOrderType`) accept `owner` field (extra) → update khách hàng | Test với curl/Postman trước khi implement Task B2 |
| 3 | `PATCH /orders/{slug}/voucher` (`updateVoucherInOrder`) vẫn dùng được để set voucher ở payment step | Hỏi BE — endpoint cũ có còn nhận voucher = slug không, hay đã bỏ |
| 4 | `initiatePayment({orderSlug, paymentMethod})` payload **không đổi** — không cần thêm customer/voucher (BE đọc từ order state đã được PATCH ở trên) | Hỏi BE confirm |
| 5 | `GET /orders/{slug}` (sau paid) return đầy đủ voucher + owner | Đã verify từ response paid order trong session trước |
| 6 | `/orders/active` không trả voucher/owner top-level — chỉ trả items với `isAppliedVoucher` flag | Đã verify, BE cố ý không trả |

Nếu assumption nào fail → tạo follow-up plan riêng.

---

## File Structure

**Modify:**

Phase A (pre-payment cleanup):
- `src/components/staff/order-summary.tsx` — bỏ tab THÔNG TIN (customer + voucher), giữ tab MÓN với cart items + note
- `src/app/staff/table-order.tsx` — bỏ voucher/customer handlers, `createOrder` payload simplify, bỏ voucher rehydrate
- `src/lib/staff-orders.ts` — bỏ `voucher` khỏi `ReconcileAction` types
- `src/stores/table-sessions.store.ts` — `setOrderVoucher` + `setOrderCustomer` vẫn keep (dùng ở payment screen sau migration)

Phase B (payment screen):
- `src/app/staff/payment.tsx` — major refactor: thêm customer search + voucher sheet + sync với BE trước payment
- `src/components/staff/payment-panel.tsx` — có thể extract voucher/customer block ra component riêng nếu phình
- (Optional) `src/components/staff/payment-customer-and-voucher.tsx` — new component gom customer + voucher logic

**Tests:**
- Extend `src/tests/components/staff/order-summary.test.tsx` — bỏ test cho customer/voucher tab
- Extend (or create) `src/tests/app/staff/payment.test.tsx` — test customer + voucher trên payment screen

---

# PHASE A: Cleanup pre-payment (Order Screen)

## Task A1: Bỏ voucher sheet khỏi order-summary

**Files:**
- `src/components/staff/order-summary.tsx`

### Step 1: Remove voucher sheet rendering + breakdown

In `order-summary.tsx`:

1. Remove import `StaffTableVoucherSheet`
2. Remove Props: `voucher`, `onApplyVoucher`, `onRemoveVoucher`
3. Remove the `<StaffTableVoucherSheet ... />` block in footer (above breakdown)
4. In `pendingDisplay` + `pendingTotals` useMemos, pass `null` for voucher arg:
   ```tsx
   const pendingDisplay = useMemo(() => {
     const cart = staffItemsToCartItem(pendingItems)
     return calculateCartItemDisplay(cart, null)
   }, [pendingItems])
   const pendingTotals = useMemo(
     () => calculateCartTotals(pendingDisplay, null),
     [pendingDisplay],
   )
   ```
5. Remove `{voucher && pendingTotals.voucherDiscount > 0 && ...}` row in breakdown
6. Remove auto-revalidate useEffect (lines ~107-119) — voucher logic moves to payment screen
7. Remove `onRemoveVoucherRef` + `allOrderItems`/`allItemsSubtotalAfterPromotion` memos (only needed for auto-revalidate)

### Step 2: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/components/staff/order-summary.tsx 2>&1 | tail -3
npx vitest run src/tests/components/staff/order-summary.test.tsx 2>&1 | tail -5
```

Existing voucher tests will fail — they'll be updated in Step 3.

### Step 3: Update tests

In `src/tests/components/staff/order-summary.test.tsx`:
- Remove tests using `voucher` prop (e.g. "shows voucher discount row")
- Remove `voucher`, `onApplyVoucher`, `onRemoveVoucher` from `defaultProps`/`baseProps`
- Remove mock for `useVouchersForOrder` + `useValidateVoucher` if only used by voucher tests
- Verify 556+ tests still pass (count may decrease if voucher tests removed entirely)

---

## Task A2: Bỏ customer search khỏi order-summary tab THÔNG TIN

**Files:**
- `src/components/staff/order-summary.tsx`

### Step 1: Decide tab structure

Choice:
- **Option a**: Keep tab THÔNG TIN with only note (no customer) → tab vẫn hiển thị, chỉ note
- **Option b**: Merge note into tab MÓN footer (above breakdown) → bỏ Tabs hoàn toàn

**Recommend Option b** — tab THÔNG TIN với chỉ 1 field note bị "spaceous", không justify Tabs UI.

### Step 2: Apply Option b

Remove:
- `<Tabs>` wrapper + `<TabsList>`
- `<TabsContent value="items">` wrapper around cart items
- `<TabsContent value="info">` block entirely
- Import `StaffCustomerSearchInput`, `StaffOrderNoteInput`, Tabs primitives no longer needed

Replace with flat layout:
```tsx
<div className="flex flex-col h-full bg-pos-surface">
  <ul className="flex-1 overflow-y-auto bg-pos-surface py-2">
    {/* existing cart items */}
  </ul>

  {/* Note input above breakdown */}
  <div className="border-t border-pos-border px-3 py-2">
    <StaffOrderNoteInput value={description} onChange={onDescriptionChange} />
  </div>

  {/* Submitted orders line if any */}
  {hasSubmitted && <SubmittedOrdersDialog ... />}

  {/* Footer breakdown (without voucher row) */}
  <div className="border-t border-pos-border p-4 pb-3 space-y-1">
    {/* Tạm tính, Giảm khuyến mãi, TỔNG CỘNG */}
    <ConfirmOrderDialog ... />
    {/* Hoá đơn tạm + THANH TOÁN buttons */}
  </div>
</div>
```

### Step 3: Update Props interface

Remove from Props:
- `customer`
- `onSelectCustomer`
- `onClearCustomer`
- `isPostSubmit` (was used to disable customer/note edit — note giờ luôn editable, customer chuyển sang payment)

Keep:
- `pendingItems`, `submittedOrders`, `onUpdateItem`, `onRemoveItem`, `onClearAll`, `onSubmitOrder`, `onPay`, `onDraftReceipt`, `onConfirmChanges`, `onCancelOrder`, `isSubmittingOrder`, `description`, `onDescriptionChange`

### Step 4: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/components/staff/order-summary.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

---

## Task A3: Simplify createOrder payload + remove voucher handlers in table-order.tsx

**Files:**
- `src/app/staff/table-order.tsx`

### Step 1: Update createOrder payload

Find `handleSubmitOrder` (~line 222-265). Simplify:

```tsx
const data = await createOrderAsync({
  type: OrderTypeEnum.AT_TABLE,
  table: id,
  branch: userInfo?.branch?.slug ?? '',
  owner: userInfo?.slug ?? '',           // ← always staff slug (customer set ở payment)
  approvalBy: userInfo?.slug ?? '',
  description: currentSession.description ?? '',
  orderItems: apiItems.map((item) => ({
    quantity: item.quantity,
    variant: item.variantSlug!,
    promotion: item.promotion?.slug ?? null,
    note: item.note || '',
  })),
  voucher: null,                          // ← always null (voucher set ở payment)
})
```

### Step 2: Remove voucher handlers

Remove:
- `useUpdateVoucherInOrder` import + `updateVoucherInOrderAsync` extraction
- `handleApplyVoucher` function (async voucher sync)
- `handleRemoveVoucher` function
- Pass into `<OrderSummary>`: remove `voucher`, `onApplyVoucher`, `onRemoveVoucher` props
- `setOrderVoucher` from `useTableSessions` destructure (no longer used at order screen)

### Step 3: Remove customer handler

Remove pass into `<OrderSummary>`: `customer`, `onSelectCustomer`, `onClearCustomer`.

Keep `setOrderCustomer` import — still needed for payment screen.

### Step 4: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/app/staff/table-order.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

---

## Task A4: Bỏ voucher khỏi ReconcileAction + reconcile logic

**Files:**
- `src/lib/staff-orders.ts`
- `src/app/staff/table-order.tsx` (the reconcile switch)

### Step 1: Strip `voucher` from ReconcileAction types

In `src/lib/staff-orders.ts`:

```ts
export type ReconcileAction =
  | { type: 'noop' }
  | { type: 'hydrate'; orderSlug: string; submittedOrder: SubmittedOrder }   // ← remove voucher
  | { type: 'refresh'; submittedOrder: SubmittedOrder }                       // ← remove voucher
  | { type: 'clear'; staleOrderSlug: string }
  | {
      type: 'mismatch'
      localOrderSlug: string
      serverOrderSlug: string
      submittedOrder: SubmittedOrder                                          // ← remove voucher
    }
```

In `computeSessionReconciliation`, remove `voucher: serverOrder.voucher ?? null` from each case.

### Step 2: Remove setOrderVoucher calls in reconcile switch

In `table-order.tsx` reconcile useEffect (~line 119-186):
- Remove `setOrderVoucher(id, action.voucher)` from `hydrate`, `refresh`, `mismatch` cases
- Remove `setOrderVoucher(id, null)` from `clear` case
- Remove `setOrderVoucher` from useEffect deps + destructure

> **Why**: Voucher state ở order screen không còn relevance. Khi payment screen mount, nó tự fetch order + decide voucher state.

### Step 3: Update tests in staff-orders.test.ts

Remove tests that check `voucher` field passed in reconcile actions (added in earlier B7 task).

### Step 4: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx vitest run src/lib/__tests__/staff-orders.test.ts 2>&1 | tail -5
npx vitest run 2>&1 | tail -5
```

---

# PHASE B: Add Customer + Voucher to Payment Screen

## Task B1: Add customer search + voucher sheet UI to payment.tsx

**Files:**
- `src/app/staff/payment.tsx`

### Step 1: Add local state

Above existing state:
```tsx
import { useUserStore } from '@/stores'
import { useGetOrderBySlug } from '@/hooks'
// ... existing imports

// Inside component:
const { userInfo } = useUserStore()
const [selectedCustomer, setSelectedCustomer] = useState<TableCustomer | null>(
  session?.customer ?? null,
)
const [selectedVoucher, setSelectedVoucher] = useState<IVoucher | null>(
  session?.voucher ?? null,
)
```

`session.customer` + `session.voucher` may exist from old flow (backwards compat). Or use as cache.

### Step 2: Fetch full order with voucher (post-create state)

The `/orders/active` doesn't include voucher. But once at payment screen, we want to know if order already has voucher applied (vd staff đã apply qua hệ thống khác). Use `useGetOrderBySlug`:

```tsx
const { data: fullOrder } = useGetOrderBySlug(orderSlug, {
  enabled: !!orderSlug,
})

useEffect(() => {
  if (!fullOrder?.result) return
  // Sync local state with server state (if any)
  if (fullOrder.result.voucher && !selectedVoucher) {
    setSelectedVoucher(fullOrder.result.voucher)
  }
  if (fullOrder.result.owner && !selectedCustomer) {
    setSelectedCustomer({
      slug: fullOrder.result.owner.slug,
      firstName: fullOrder.result.owner.firstName,
      lastName: fullOrder.result.owner.lastName,
      phonenumber: fullOrder.result.owner.phonenumber,
    })
  }
}, [fullOrder?.result])
```

### Step 3: Render customer search + voucher sheet trên left column

After cart items list (~line 167), before footer breakdown, add:

```tsx
<div className="border-t border-pos-border px-3 py-3 space-y-2">
  <div>
    <label className="block text-xs font-bold tracking-widest text-pos-muted mb-2">
      KHÁCH HÀNG
    </label>
    <StaffCustomerSearchInput
      customer={selectedCustomer}
      onSelect={handleSelectCustomer}
      onClear={handleClearCustomer}
    />
  </div>
  <div>
    <StaffTableVoucherSheet
      pendingItems={[]}
      submittedItems={merged}
      customer={selectedCustomer}
      appliedVoucher={selectedVoucher}
      onApply={handleApplyVoucher}
      onRemove={handleRemoveVoucher}
    />
  </div>
</div>
```

(Adjust position to fit existing layout — probably between items list and total breakdown.)

### Step 4: Add handlers — Local only first

```tsx
const handleSelectCustomer = (customer: TableCustomer) => {
  setSelectedCustomer(customer)
  // BE sync in Task B2
}
const handleClearCustomer = () => {
  setSelectedCustomer(null)
  // BE sync in Task B2
}
const handleApplyVoucher = (voucher: IVoucher) => {
  setSelectedVoucher(voucher)
  // BE sync in Task B3
}
const handleRemoveVoucher = () => {
  setSelectedVoucher(null)
  // BE sync in Task B3
}
```

### Step 5: Update total computation to include voucher discount

Currently `total` = sum of priceNum × quantity (line 49). Update with voucher discount:

```tsx
const totalWithDiscount = useMemo(() => {
  if (!selectedVoucher) return total
  // Use shared calc util
  const cart = staffItemsToCartItem(merged)
  const display = calculateCartItemDisplay(cart, selectedVoucher)
  return calculateCartTotals(display, selectedVoucher).finalTotal
}, [total, merged, selectedVoucher])
```

Update PaymentPanel call: `total={totalWithDiscount}`.

### Step 6: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/app/staff/payment.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Smoke: navigate to /staff/table/:id/payment → confirm customer + voucher UI render. Apply voucher → confirm total update. (BE sync not yet.)

---

## Task B2: Sync customer (owner) to BE via PATCH /orders/{slug}

**Files:**
- `src/app/staff/payment.tsx`

> **DEPENDS ON BE CONFIRMATION** — assumption #2 (PATCH /orders/{slug} accept `owner` field).

### Step 1: Verify BE accept owner

Quick Postman check:
```
PATCH /orders/{slug}
{
  "type": "at-table",
  "table": "<table-slug>",
  "owner": "<customer-slug>"
}
```

If 200 + `response.owner.slug` = sent slug → continue.
If 400/422 → file BE ticket, BLOCK on this task.

### Step 2: Wire updateOrderType call in handlers

```tsx
const { mutateAsync: updateOrderAsync } = useUpdateOrder()  // need to confirm hook name

const handleSelectCustomer = async (customer: TableCustomer) => {
  const previous = selectedCustomer
  setSelectedCustomer(customer)
  try {
    await updateOrderAsync({
      slug: orderSlug,
      data: {
        type: fullOrder?.result?.type ?? 'at-table',
        table: id,
        description: fullOrder?.result?.description ?? '',
        owner: customer.slug,
      },
    })
  } catch {
    setSelectedCustomer(previous)
    showErrorToastMessage('Không thể cập nhật khách hàng')
  }
}

const handleClearCustomer = async () => {
  const previous = selectedCustomer
  setSelectedCustomer(null)
  try {
    await updateOrderAsync({
      slug: orderSlug,
      data: {
        type: fullOrder?.result?.type ?? 'at-table',
        table: id,
        description: fullOrder?.result?.description ?? '',
        owner: userInfo?.slug ?? '',   // ← reset về staff default
      },
    })
  } catch {
    setSelectedCustomer(previous)
    showErrorToastMessage('Không thể bỏ khách hàng')
  }
}
```

> Grep `useUpdateOrder|useUpdateOrderType` để xác nhận hook tên gì. Nếu chưa có hook wrapper cho `updateOrderType`, create it ở `src/hooks/use-order.ts`.

### Step 3: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Smoke: chọn khách → confirm Network call `PATCH /orders/{slug}` với `owner` field. Refresh → confirm khách giữ nguyên.

---

## Task B3: Sync voucher to BE via PATCH /orders/{slug}/voucher

**Files:**
- `src/app/staff/payment.tsx`

> **DEPENDS ON BE CONFIRMATION** — assumption #3 (endpoint still active).

### Step 1: Wire updateVoucherInOrder in handlers

```tsx
const { mutateAsync: updateVoucherInOrderAsync } = useUpdateVoucherInOrder()

const handleApplyVoucher = async (voucher: IVoucher) => {
  const previous = selectedVoucher
  setSelectedVoucher(voucher)
  try {
    await updateVoucherInOrderAsync({
      slug: orderSlug,
      voucher: voucher.slug,
      orderItems: merged.map((it) => ({
        quantity: it.quantity,
        variant: it.variantSlug ?? '',
        note: it.note,
        promotion: it.promotion?.slug ?? null,
        order: orderSlug,
      })),
    })
  } catch {
    setSelectedVoucher(previous)
    showErrorToastMessage('Không thể áp voucher')
  }
}

const handleRemoveVoucher = async () => {
  const previous = selectedVoucher
  setSelectedVoucher(null)
  try {
    await updateVoucherInOrderAsync({
      slug: orderSlug,
      voucher: null,
      orderItems: merged.map((it) => ({ ... })),
    })
  } catch {
    setSelectedVoucher(previous)
    showErrorToastMessage('Không thể bỏ voucher')
  }
}
```

### Step 2: Verify

Smoke: chọn voucher → Network `PATCH /orders/{slug}/voucher` với slug. Refresh → confirm voucher giữ (via `useGetOrderBySlug` rehydrate).

### Step 3: Auto re-validate voucher on payment screen

If voucher requires `minOrderValue` and items don't meet, auto-remove:

```tsx
useEffect(() => {
  if (!selectedVoucher) return
  const cart = staffItemsToCartItem(merged)
  const display = calculateCartItemDisplay(cart, null)
  const ctx: VoucherValidationContext = {
    subtotalAfterPromotion: calculateCartTotals(display, null).subTotalBeforeDiscount,
    totalQuantity: merged.reduce((s, i) => s + i.quantity, 0),
    productSlugs: merged.map((i) => i.productSlug ?? i.menuItemId),
    hasCustomerOwner: !!selectedCustomer,
  }
  if (!isVoucherValid(selectedVoucher, ctx)) {
    handleRemoveVoucher()
    showErrorToastMessage(`Đã bỏ voucher ${selectedVoucher.code} (không còn hợp lệ)`)
  }
}, [selectedVoucher, merged, selectedCustomer])
```

---

## Task B4: Confirm payment payload + final integration

**Files:**
- `src/app/staff/payment.tsx`

### Step 1: Verify payment payload

Current:
```ts
initiatePayment({ orderSlug, paymentMethod: PaymentMethod.CASH })
```

Per assumption #4, payload không đổi. BE đọc customer + voucher từ order state đã update qua PATCH.

If BE confirm needs voucher/customer in payment payload → extend `initiatePayment` payload. Currently keep as-is.

### Step 2: Pre-payment validation

Before calling `initiatePayment`, validate:
- Voucher.isVerificationIdentity && !selectedCustomer → block + toast "Voucher yêu cầu khách hàng đã đăng ký"
- Voucher.minOrderValue > total → block + toast

```tsx
const handleConfirm = () => {
  if (selectedVoucher?.isVerificationIdentity && !selectedCustomer) {
    showErrorToastMessage('Voucher này yêu cầu khách hàng. Vui lòng chọn khách trước khi thanh toán.')
    return
  }
  // ... existing logic
}
```

### Step 3: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/app/staff/payment.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Smoke test full E2E:
1. Đặt món ở /staff/table/:id → submit (no customer, no voucher in payload)
2. Navigate /payment screen
3. Search customer SĐT → select → confirm `PATCH /orders/{slug}` được gọi
4. Apply voucher → confirm `PATCH /orders/{slug}/voucher` được gọi
5. Click "Xác nhận thanh toán" → `POST /payments` → confirm thành công
6. Reload payment screen sau khi đã apply → state khôi phục (customer + voucher)

---

# PHASE C: Migration + Cleanup

## Task C1: Session migration

**Files:**
- `src/stores/table-sessions.store.ts`

### Issue

Existing sessions in localStorage có `voucher` + `customer` từ flow cũ. Sau migration, ở order screen các field này ignored. Cần:
- Không break legacy sessions
- `voucher`/`customer` vẫn có thể tồn tại trong session — payment screen dùng làm initial state

### Action

KHÔNG cần version bump store — fields đều optional, không cần data migration. Pre-existing data tự nhiên ignored ở order screen, sẽ được payment screen pick up nếu user vào.

Document trong comment ở session.ts:
```ts
/**
 * @deprecated post-2026-06 — Voucher chỉ set ở payment screen.
 * Field này giữ lại cho backward compat với session đã persist trước migration.
 * Payment screen sẽ pick up làm initial state nếu có.
 */
voucher?: IVoucher | null
```

## Task C2: Documentation update

**Files:**
- `docs/superpowers/staff-assisted-ordering-feature.md` (nếu exists)

Update flow diagram + step description theo design mới.

---

## Final Review Tasks

- [ ] Full test suite: `npx vitest run` — expect ALL PASS (existing 556+ tests, possibly minus voucher-related ones removed)
- [ ] tsc + lint clean
- [ ] Manual E2E:
  - Login STAFF → mở bàn → đặt món → submit (KHÔNG cần khách + voucher)
  - Vào payment → chọn khách + voucher → confirm Network calls
  - Reload payment → state giữ
  - Thanh toán cash → success → close session
  - Multi-tab: 2 tab cùng bàn → tab A chọn voucher → tab B refresh thấy voucher (via useGetOrderBySlug)
- [ ] Backward compat: session cũ trên localStorage có voucher → payment screen vẫn nhận làm initial → KHÔNG drop user state

---

## Notes / Design Decisions

1. **Owner default = staff slug ở createOrder**: BE cần ít nhất 1 owner. Staff slug là default hợp lý — sau payment screen sẽ update đúng customer.

2. **`PATCH /orders/{slug}` cho customer update**: dùng existing `updateOrderType` endpoint với extra `owner` field. Cần BE confirm. Nếu BE từ chối → cần endpoint mới.

3. **Voucher sync optimistic + rollback**: UI update trước, gọi BE sau, fail thì rollback. Tương tự pattern cũ ở table-order.tsx pre-migration.

4. **Auto re-validate**: chuyển từ order screen sang payment screen. Cùng logic, khác location.

5. **`StaffTableVoucherSheet` không đổi**: component props-based, dùng được ở mọi vị trí. Chỉ thay đổi nơi mount.

6. **`StaffCustomerSearchInput` không đổi**: tương tự, props-based.

7. **`useGetOrderBySlug` ở payment screen**: dùng để rehydrate voucher + customer (BE return đầy đủ vì /orders/{slug} có voucher). Different từ /active của order screen.

8. **Note (description) vẫn ở order screen**: không liên quan customer/voucher, không cần move. Vẫn dùng pre-submit flow.

9. **Migration không có version bump**: Vì chỉ ignore fields chứ không rename/delete. An toàn.

10. **Test coverage**: tests cho voucher/customer ở order screen sẽ delete. Tests mới sẽ add cho payment screen. Net test count có thể giảm trước khi tăng lại.
