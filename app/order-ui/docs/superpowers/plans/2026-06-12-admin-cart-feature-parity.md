# Admin Cart Feature Parity Plan (3 Phases)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> **DO NOT git commit per task** — leave changes in working tree for user.

**Goal:** Đưa `AdminCartContent` (`/system/menu`) lên ngang với `OrderSummary` của staff về functional + UX + visual, trong khi giữ visual chuẩn admin cart đã chốt.

**Architecture:**
- Phase A (CRITICAL): Đảm bảo flow đúng — active-order rehydration, totals chuẩn xác (promotion-aware), edit + cancel cho submitted orders
- Phase B (UX): Draft receipt, totals breakdown, custom-price dialog cho submitted, strikethrough price, submitted total separate
- Phase C (POLISH): Animations, clear-all, promotion badge

**Risk:** Medium. A1-A2 thay đổi data flow (totals + rehydration); A3-A4 thêm mutation flows. B-C purely additive.

**Tech Stack:** React 18, Vite, TypeScript, Zustand persist, TanStack Query, shadcn/ui, framer-motion, i18n react-i18next

---

## File scope

### Files to modify:
- `src/app/system/menu/components/admin-cart-content.tsx` — main component, all tasks touch this
- `src/locales/vi/menu.json` + `src/locales/en/menu.json` — i18n additions per phase

### Files to reuse (DO NOT modify):
- `src/components/staff/submitted-orders-dialog.tsx` — reuse as-is
- `src/components/staff/custom-price-dialog.tsx` — reuse for B3
- `src/components/staff/receipt-dialog.tsx` — reuse for B1
- `src/utils/cart.ts` — `calculateCartItemDisplay`, `calculateCartTotals`
- `src/lib/staff-cart-adapter.ts` — `staffItemsToCartItem`
- `src/lib/staff-orders.ts` — `computeSessionReconciliation`, `collectOrderItemsForKey`
- `src/hooks/useTableSessions.ts` — wraps store; store has `setSubmittedQuantity`, `updateSubmittedItemNote`, `cancelSession`, `replaceSubmittedOrders`
- `src/hooks/use-order.ts` — `useGetActiveOrderByTable`, `useDeleteOrder`, `useUpdateOrderItem`, `useUpdateNoteOrderItem`, `useDeleteOrderItem`

### Reference (read-only, mirror logic):
- `src/components/staff/table-order-screen.tsx` — staff flow, lines 130-460 (rehydration + mutations)
- `src/components/staff/order-summary.tsx` — visual + totals pattern

---

# Phase A — Critical Functional Gaps

## Task A1: Active order rehydration + accurate totals

**Why combined:** Both rely on the same `useGetActiveOrderByTable` data fetch and `staffItemsToCartItem` adapter. Doing them in one task keeps the data-flow refactor coherent.

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Add active order fetch on mount

Mirror staff TableOrderScreen pattern (`src/components/staff/table-order-screen.tsx:80-200`).

```tsx
import { useGetActiveOrderByTable } from '@/hooks'
import { computeSessionReconciliation } from '@/lib/staff-orders'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'

// Inside AdminCartContent:
const { data: activeOrderData, isLoading: isLoadingActiveOrder, isFetching: isFetchingActiveOrder } =
  useGetActiveOrderByTable(tableSlug)
const serverActiveOrder = activeOrderData?.result ?? null
const lastRefreshedServerRef = useRef<typeof serverActiveOrder>(null)
```

### Step 2: Reconcile session with server

Inside a `useEffect` keyed on `serverActiveOrder + isLoading + isFetching`:

1. Skip if loading or fetching.
2. Skip if `serverActiveOrder.table.slug !== tableSlug` (stale fetch).
3. If `serverActiveOrder` exists AND not yet reconciled (compare ref):
   - Compute reconciliation via `computeSessionReconciliation(session, serverActiveOrder)`
   - Apply via `replaceSubmittedOrders(tableSlug, reconciledOrders)` + `setOrderSlug(tableSlug, serverActiveOrder.slug)`
   - Set `lastRefreshedServerRef.current = serverActiveOrder`
4. If `serverActiveOrder == null` AND session has `orderSlug` (server cancelled it): call `cancelSession(tableSlug)`.

Look at `src/components/staff/table-order-screen.tsx:130-200` for exact pattern — copy structure, adapt to admin context (no waiting_payment toast yet, that's payment screen).

### Step 3: Replace totals computation

Remove the simple sum:
```tsx
// OLD
const total = useMemo(
  () => allItems.reduce((sum, it) => sum + (it.priceNum ?? 0) * it.quantity, 0),
  [allItems],
)
```

Add:
```tsx
const pendingDisplay = useMemo(
  () => calculateCartItemDisplay(staffItemsToCartItem(pending), null),
  [pending],
)
const pendingTotals = useMemo(
  () => calculateCartTotals(pendingDisplay, null),
  [pendingDisplay],
)

const submittedTotal = useMemo(
  () =>
    (session?.submittedOrders ?? []).reduce((s, o) => {
      const display = calculateCartItemDisplay(staffItemsToCartItem(o.items), null)
      return s + calculateCartTotals(display, null).finalTotal
    }, 0),
  [session?.submittedOrders],
)

const grandTotal = pendingTotals.finalTotal + submittedTotal
```

Replace usage of `total` with `grandTotal` in the footer total display. Replace confirm dialog's reduce with `pendingTotals.finalTotal`.

### Step 4: Verify build + smoke

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/app/system/menu/components/admin-cart-content.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Manual: open `/system/menu?tab=menu&table=<slug>` with an active order in DB → cart should auto-populate with submitted items. Reload → state persists.

**NO COMMIT.**

---

## Task A2: SubmittedOrdersDialog (edit submitted items qty + note)

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Wire mutations

Already-existing hooks:
```tsx
import {
  useUpdateOrderItem,
  useUpdateNoteOrderItem,
  useDeleteOrderItem,
} from '@/hooks'

// Inside component:
const { mutateAsync: updateOrderItemAsync } = useUpdateOrderItem()
const { mutateAsync: updateNoteAsync } = useUpdateNoteOrderItem()
const { mutateAsync: deleteOrderItemAsync } = useDeleteOrderItem()
```

### Step 2: Implement `handleSubmittedChanges`

Mirror staff `handleSubmittedChanges` (`src/components/staff/table-order-screen.tsx:380-440`):

```tsx
const handleSubmittedChanges = async (
  changes: { menuItemId: string; note: string; newQty: number }[],
) => {
  if (!session?.orderSlug) return
  for (const change of changes) {
    const orderItem = collectOrderItemsForKey(session.submittedOrders, change.menuItemId, change.note)
    if (!orderItem) continue
    if (change.newQty === 0) {
      await deleteOrderItemAsync(orderItem.slug)
    } else {
      if (change.newQty !== orderItem.quantity) {
        await updateOrderItemAsync({ slug: orderItem.slug, quantity: change.newQty })
      }
      // note updates handled separately if needed
    }
    // Update store-side
    setSubmittedQuantity(tableSlug, change.menuItemId, change.note, change.newQty)
  }
  queryClient.invalidateQueries({ queryKey: [QUERYKEY.activeOrderByTable, tableSlug] })
  showToast(tToast('toast.updateOrderSuccess'))
}
```

> Import `setSubmittedQuantity` from destructured `useTableSessions()` call.
> Import `collectOrderItemsForKey` from `@/lib/staff-orders`.

### Step 3: Add SubmittedOrdersDialog to JSX

```tsx
import { SubmittedOrdersDialog } from '@/components/staff/submitted-orders-dialog'

// In JSX, inside submitted section header:
<div className="flex items-center justify-between text-[10px] text-pos-muted uppercase tracking-wider mb-1">
  <span>{t('order.submittedSection')}</span>
  {session.submittedOrders.length > 0 && (
    <SubmittedOrdersDialog
      submittedOrders={session.submittedOrders}
      submittedTotal={submittedTotal}
      onConfirmChanges={handleSubmittedChanges}
      onCancelOrder={handleCancelOrder}  // implemented in A3
    />
  )}
</div>
```

> SubmittedOrdersDialog is a self-contained Radix Dialog with its own trigger button. Inspect its rendered button style — match admin context if needed via wrapper styling.

### Step 4: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/app/system/menu/components/admin-cart-content.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Manual: submit items → trigger dialog from submitted section → edit qty → confirm → server updated, cart reflects.

**NO COMMIT.**

---

## Task A3: Cancel order action

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

Already exposed via SubmittedOrdersDialog `onCancelOrder` prop. Implement the handler.

### Step 1: Add cancel mutation

```tsx
import { useDeleteOrder } from '@/hooks'

const { mutateAsync: deleteOrderAsync } = useDeleteOrder()
```

### Step 2: Implement `handleCancelOrder`

Mirror staff (`src/components/staff/table-order-screen.tsx:442-470`):

```tsx
const handleCancelOrder = async () => {
  if (!session?.orderSlug) return
  try {
    await deleteOrderAsync(session.orderSlug)
    cancelSession(tableSlug)
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.activeOrderByTable, tableSlug] })
    showToast(tToast('toast.cancelOrderSuccess'))
    // Navigate back to table picker
    navigate(ROUTE.STAFF_MENU)
  } catch {
    showErrorToastMessage(tToast('toast.cancelOrderFailed'))
  }
}
```

> Destructure `cancelSession` from `useTableSessions()`.

### Step 3: Add i18n keys

`src/locales/vi/toast.json` — add if not present:
```json
"cancelOrderSuccess": "Đã huỷ đơn",
"cancelOrderFailed": "Huỷ đơn thất bại",
"updateOrderSuccess": "Cập nhật đơn thành công"
```

Same in `src/locales/en/toast.json`.

### Step 4: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Manual: submit items → open SubmittedOrdersDialog → tap "Huỷ đơn" → server deletes order → navigated back to /system/menu (no table selected).

**NO COMMIT.**

---

# Phase B — UX Gaps

## Task B1: Draft receipt button + ReceiptDialog

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Import + state

```tsx
import { useState } from 'react'
import { ReceiptDialog } from '@/components/staff/receipt-dialog'

const [showDraft, setShowDraft] = useState(false)
```

### Step 2: Add button to footer

Restructure the bottom buttons into 3 columns OR keep 2 buttons + add draft as outlined separate row above.

Approach A (3-button grid):
```tsx
<div className="grid grid-cols-3 gap-2">
  <Button
    variant="outline"
    size="sm"
    disabled={(session.submittedOrders ?? []).length === 0}
    onClick={() => setShowDraft(true)}
  >
    {t('order.draftReceipt')}
  </Button>
  <Button
    variant="outline"
    disabled={pending.length === 0 || isSubmitting}
    onClick={() => setConfirmOpen(true)}
  >
    {isSubmitting ? t('order.submitting') : t('order.submit')}
  </Button>
  <Button
    disabled={submitted.length === 0}
    onClick={handleGoToPayment}
    className="bg-pos-gold text-white hover:bg-pos-gold/90"
  >
    {t('order.continueToPayment')}
  </Button>
</div>
```

Approach B (preferred — single row for draft above main grid):
```tsx
{(session.submittedOrders ?? []).length > 0 && (
  <Button
    variant="outline"
    size="sm"
    className="w-full"
    onClick={() => setShowDraft(true)}
  >
    {t('order.draftReceipt')}
  </Button>
)}
<div className="grid grid-cols-2 gap-2">
  {/* Đặt món + Thanh toán as-is */}
</div>
```

Use Approach B — cleaner.

### Step 3: Render dialog

```tsx
{showDraft && (
  <ReceiptDialog
    tableId={tableSlug}
    tableLabel={session.tableName}
    orders={session.submittedOrders}
    isDraft
    onClose={() => setShowDraft(false)}
  />
)}
```

### Step 4: i18n

`src/locales/vi/menu.json`:
```json
"draftReceipt": "Hoá đơn tạm"
```

`src/locales/en/menu.json`:
```json
"draftReceipt": "Draft receipt"
```

### Step 5: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -5
```

Manual: submit items → "Hoá đơn tạm" button hiện → click → ReceiptDialog mở với danh sách items đã submitted.

**NO COMMIT.**

---

## Task B2: Totals breakdown (subtotal + promotion discount + grand total)

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Replace single total row with breakdown

Find current total block:
```tsx
<div className="flex justify-between items-center pt-2 border-t">
  <span className="text-sm text-pos-muted">{t('order.total')}</span>
  <span className="text-xl font-bold text-pos-gold">{formatCurrency(total)}</span>
</div>
```

Replace with breakdown using `pendingTotals` + `submittedTotal` + `grandTotal` from A1:

```tsx
<div className="border-t pt-2 space-y-1">
  {/* Subtotal */}
  <div className="flex justify-between text-xs text-pos-muted">
    <span>{t('order.subtotal')}</span>
    <span>{formatCurrency(pendingTotals.subTotalBeforeDiscount + submittedTotal)}</span>
  </div>
  {/* Promotion discount (pending only — submitted promotions already baked) */}
  {pendingTotals.promotionDiscount > 0 && (
    <div className="flex justify-between text-xs text-emerald-600">
      <span>{t('order.promotionDiscount')}</span>
      <span>-{formatCurrency(pendingTotals.promotionDiscount)}</span>
    </div>
  )}
  {/* Submitted total separate (only if both pending + submitted exist) */}
  {submittedTotal > 0 && pending.length > 0 && (
    <div className="flex justify-between text-xs text-pos-muted">
      <span>{t('order.submittedTotal')}</span>
      <span>{formatCurrency(submittedTotal)}</span>
    </div>
  )}
  {/* Grand total */}
  <div className="flex justify-between items-baseline pt-1">
    <span className="text-sm font-semibold text-foreground">{t('order.total')}</span>
    <span className="text-xl font-bold text-pos-gold">{formatCurrency(grandTotal)}</span>
  </div>
</div>
```

### Step 2: i18n

`vi/menu.json`:
```json
"subtotal": "Tạm tính",
"promotionDiscount": "Giảm khuyến mãi",
"submittedTotal": "Đã đặt"
```

`en/menu.json`:
```json
"subtotal": "Subtotal",
"promotionDiscount": "Promotion discount",
"submittedTotal": "Submitted"
```

### Step 3: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: add 1 item with promo → totals show subtotal + discount + grand total. Submit → submitted total appears separately when pending again.

**NO COMMIT.**

---

## Task B3: CustomPriceDialog for editing custom-price items (both pending and submitted)

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Import dialog

```tsx
import { CustomPriceDialog } from '@/components/staff/custom-price-dialog'
import { Pencil } from 'lucide-react'
```

### Step 2: Replace inline Input in CustomPriceCard

Currently `CustomPriceCard` has an inline `<Input type="number">`. Keep that for ADD flow (user adding new custom item via menu — happens elsewhere).

For pending custom-price items already in cart, ADD a Pencil button (between qty and trash on row 2-style layout, OR replace inline input with pencil-triggered dialog).

Decision: **Replace inline input with dialog trigger** to match staff pattern. This means:

```tsx
// Inside CustomPriceCard, replace the inline Input row with:
<div className="flex items-center justify-between gap-1">
  <span className="text-xs text-muted-foreground">
    {item.quantity} × {(item.priceNum ?? 0) > 0 ? formatCurrency(item.priceNum ?? 0) : '—'}
  </span>
  <div className="flex items-center gap-1">
    <CustomPriceDialog
      mode="edit"
      menuItemId={item.menuItemId}
      name={item.name}
      initialPrice={item.priceNum ?? 0}
      initialQuantity={item.quantity}
      onEdit={(priceNum, price, quantity) => {
        onUpdate({ priceNum, price, quantity })
      }}
      trigger={
        <Button variant="ghost" size="icon" className="w-6 h-6">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      }
    />
    <Button
      variant="ghost"
      size="icon"
      onClick={onRemove}
      className="w-6 h-6 text-destructive"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  </div>
</div>
```

Update `CustomPriceCard` props to take `onUpdate(patch: { priceNum, price, quantity })` instead of just `onUpdatePrice(priceNum)`.

### Step 3: Update call site

In main `pending.map`, replace `onUpdatePrice` with `onUpdate`:

```tsx
<CustomPriceCard
  item={p}
  onUpdate={(patch) => updateItem(tableSlug, itemId, patch)}
  onUpdateNote={(note) => updateItem(tableSlug, itemId, { note })}
  onRemove={() => removeItem(tableSlug, itemId)}
/>
```

### Step 4: For submitted custom-price items

Optional: extend SubmittedOrdersDialog to handle custom-price edit. SubmittedOrdersDialog already shows submitted items — verify it has CustomPriceDialog inside (`src/components/staff/submitted-orders-dialog.tsx`). If not, that's a follow-up out of scope. Mark as TODO if needed.

### Step 5: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: add a custom-price product → cart shows orange card with pencil + trash → click pencil → dialog opens with current price/qty editable.

**NO COMMIT.**

---

## Task B4: Strikethrough original price on item card (promotion-aware)

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Update regular pending card price row

Currently:
```tsx
<span className="text-sm xl:text-base font-bold text-foreground shrink-0">
  {formatCurrency(lineTotal)}
</span>
```

Replace with conditional strikethrough (mirror staff order-summary.tsx:97-110):

```tsx
{p.promotion && p.originalPrice && p.originalPrice !== p.priceNum ? (
  <div className="shrink-0 flex flex-col items-end">
    <span className="text-[10px] text-pos-muted line-through">
      {formatCurrency(p.originalPrice * p.quantity)}
    </span>
    <span className="text-sm xl:text-base font-bold text-pos-gold">
      {formatCurrency((p.priceNum ?? 0) * p.quantity)}
    </span>
  </div>
) : (
  <span className="text-sm xl:text-base font-bold text-foreground shrink-0">
    {formatCurrency(lineTotal)}
  </span>
)}
```

### Step 2: Same for submitted items (read-only)

In submitted section card, add strikethrough display similarly when item has promo applied.

### Step 3: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: add product with active promotion → cart shows strikethrough original + gold discounted price. Items without promo show single dark price.

**NO COMMIT.**

---

# Phase C — Polish

## Task C1: framer-motion enter/exit animations

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Import + wrap pending list

```tsx
import { motion, AnimatePresence } from 'framer-motion'
```

Replace `<ul className="space-y-2">{...pending.map(...)}` with:

```tsx
<ul className="space-y-2">
  <AnimatePresence>
    {pending.map((p) => {
      ...
      return (
        <motion.li
          key={`p-${itemId}-${p.note}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.18 }}
          className="..."  // existing classes
        >
          {/* card content */}
        </motion.li>
      )
    })}
  </AnimatePresence>
</ul>
```

For CustomPriceCard, wrap its inner `<li>` similarly (replace with `motion.li`).

### Step 2: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: add item → smooth fade-in + slide-up. Remove item → fade-out + slide-left.

**NO COMMIT.**

---

## Task C2: Clear all pending button

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Wire clear-all

```tsx
const { clearPendingItems } = useTableSessions()
```

Already destructured probably — add if missing.

### Step 2: Add button in pending section header

```tsx
{pending.length > 0 && (
  <div className="flex items-center justify-between text-[10px] text-pos-muted uppercase tracking-wider mb-1 mt-3">
    <span>{t('order.pendingSection')}</span>
    <Button
      variant="ghost"
      size="sm"
      className="h-5 px-1 text-[10px] text-destructive hover:text-destructive/80 hover:bg-transparent"
      onClick={() => clearPendingItems(tableSlug)}
    >
      {t('order.clearAll')}
    </Button>
  </div>
)}
```

### Step 3: i18n

`vi/menu.json`: `"clearAll": "Xoá tất cả"`
`en/menu.json`: `"clearAll": "Clear all"`

### Step 4: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: add several items → "Xoá tất cả" appears in section header → click → all pending cleared.

**NO COMMIT.**

---

## Task C3: Promotion + custom badge prominence

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

### Step 1: Add "Tuỳ chỉnh" badge to custom-price card

Already implicit via orange border. Add explicit small badge in row 1:

```tsx
<div className="flex justify-between items-start gap-1">
  <div className="flex items-center gap-1.5 min-w-0 flex-1">
    <span className="text-[13px] xl:text-sm font-bold truncate">{item.name}</span>
    <span className="shrink-0 rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
      {t('order.customPriceBadge')}
    </span>
  </div>
  ...
</div>
```

### Step 2: Add "% Giảm" badge to promotion items

In regular pending card row 1, if `p.promotion?.value > 0`:

```tsx
<div className="flex items-center gap-1.5 min-w-0 flex-1">
  <span className="text-sm xl:text-base font-bold truncate text-foreground">{p.name}</span>
  {p.promotion && p.promotion.value > 0 && (
    <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
      -{p.promotion.value}%
    </span>
  )}
</div>
```

### Step 3: i18n

`vi/menu.json`: `"customPriceBadge": "Tuỳ chỉnh"`
`en/menu.json`: `"customPriceBadge": "Custom"`

### Step 4: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -3
```

Manual: custom-price item shows orange "Tuỳ chỉnh" badge next to name. Promo item shows emerald "-15%" badge.

**NO COMMIT.**

---

# Final verification

## Task FINAL: Full QA

Run all checks + manual smoke checklist.

### Step 1: All checks pass

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -5
npx eslint src/ 2>&1 | tail -5
npx vitest run 2>&1 | tail -5
```

Expect: clean tsc, 0 eslint errors, 550/550 tests pass.

### Step 2: Smoke checklist (manual)

1. Open `/system/menu` → click bàn → cart panel hiện
2. Add món thường → pending card với strikethrough nếu promo
3. Add món custom-price → orange card với "Tuỳ chỉnh" badge + pencil edit
4. Click pencil → CustomPriceDialog mở, edit qty + price → confirm
5. Click "Xoá tất cả" → tất cả pending xoá
6. Add lại + "Đặt món" → confirm dialog → xác nhận → toast success → items chuyển sang "Đã đặt"
7. "Hoá đơn tạm" button xuất hiện → click → ReceiptDialog hiện
8. Trong section "Đã đặt", click trigger SubmittedOrdersDialog → edit qty → confirm → server update
9. Trong SubmittedOrdersDialog, click "Huỷ đơn" → server delete → navigate về /system/menu
10. Refresh page → cart auto-rehydrate from server
11. Totals breakdown chính xác: Tạm tính + Giảm khuyến mãi + Tổng
12. Animations smooth khi add/remove

### Step 3: Report

Document final state in conversation:
- Phase A: DONE
- Phase B: DONE
- Phase C: DONE
- Files modified
- i18n keys added (total)
- Test results
- Smoke checklist outcome

**NO COMMIT.**

---

# Design Decisions

1. **A1+A2 combined:** Active order fetch + totals utility both need `staffItemsToCartItem` adapter. Splitting causes 2 passes over same code.
2. **Reuse staff components verbatim (SubmittedOrdersDialog, CustomPriceDialog, ReceiptDialog):** Don't duplicate; differences in admin context = chrome only (handled by parent).
3. **Cancel order navigates back to /system/menu:** Mirrors staff which goes back to /staff. Admin equivalent = table picker.
4. **Promo on pending uses strikethrough; on submitted not:** Submitted items have promotions already applied + immutable from cart side. Strikethrough only meaningful when comparing live promo state.
5. **Draft receipt button only when submitted exists:** Avoids dead UI when nothing to print.
6. **"Tuỳ chỉnh" badge in addition to orange border:** Border alone is subtle; badge gives explicit semantic.
7. **Animations with framer-motion:** Already a dep (used by staff). Adds 0 bundle cost.

---

# Out of scope (potential follow-ups)

- CustomPriceDialog editing for SUBMITTED custom-price items (Step B3.4 — depends on staff dialog internals)
- VAT breakdown line in totals (separate concern, related to existing VAT field plan)
- Voucher application in admin cart (BE design: voucher only at payment screen)
- Customer info in cart (BE design: customer only at payment screen)
- Print preview before final invoice (separate printer subsystem)
