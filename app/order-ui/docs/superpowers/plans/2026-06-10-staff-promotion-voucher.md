# Staff Promotion + Voucher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring staff `/staff/table/:slug` flow lên ngang `/system/menu` về khả năng áp dụng promotion (per-item) và voucher (per-order), bao gồm: lưu trên cart line, hiển thị UI, tính toán đúng total, gửi đầy đủ payload lên BE.

**Architecture:** Giữ nguyên `OrderItem` staff đơn giản nhưng thêm field optional `productSlug` + `promotion` + `originalPrice`. Build **adapter layer** (`src/lib/staff-cart-adapter.ts`) chuyển staff `OrderItem[]` → system `ICartItem` shape để reuse `calculateCartItemDisplay`/`calculateCartTotals` (single source of truth). Extract voucher validation logic từ `StaffVoucherListSheet` sang util chung, build new `StaffTableVoucherSheet` props-based dùng cho staff session (giữ sheet cũ nguyên vẹn cho `/system`).

**Tech Stack:** React 18 + Zustand (`table-sessions.store.ts`), TanStack Query v5, shadcn Sheet/Dialog, existing utils `src/utils/cart.ts`, existing types `IPromotion`/`IVoucher`/`ICartItem`/`IOrderItem`.

---

## BE Contracts (đã verify từ /system flow)

### Endpoints — confirmed

```
POST /orders                          → createOrder (useCreateOrder)
  body: { type, table, branch, owner, approvalBy, description, voucher: <slug|null>,
          orderItems: [{ quantity, variant, promotion: <slug|null>, note, customPrice? }] }

POST /order-items                     → useAddNewOrderItem  (chú ý: tên hook "addNew", không phải "addOrderItem")
  body: { quantity, variant, promotion: <slug>, order: <order-slug>, customPrice? }

PATCH /order-items/{slug}             → useUpdateOrderItem
  body: { quantity, variant, promotion?: <slug|IPromotion>, note?, action? }

POST /voucher/validate                → useValidateVoucher
  body: { voucher: <slug>, user: <slug>,
          orderItems: [{ quantity, variant, note, promotion: <slug|null>, order: null }] }
  return: IApiResponse<IVoucher>     ← full voucher object

PATCH /orders/{slug}/voucher          → useUpdateVoucherInOrder  (POST-CREATE voucher change)
  body: { voucher: <new-slug|null>,
          orderItems: [{ quantity, variant, note, promotion?, order? }] }
  return: IApiResponse<IOrder>       ← FE dùng response không tính lại
```

### Key facts
- **Promotion attach**: lúc add-to-cart từ menu (`system-menus.tsx:115`). Cart item lưu `promotion` object + `promotionValue`; **không lưu `promotionDiscount`** (tính runtime).
- **Voucher validate**: chạy ngay khi user click apply trong sheet. Nếu OK → `addVoucher()` vào Zustand → gửi slug trong `createOrder.voucher`. **Không có endpoint apply riêng**.
- **Auto re-validate voucher** trên cart change: system tự re-check khi cart đổi (qty/items) → remove voucher tự động nếu fail minOrderValue/maxItems/applicability (`cart-content.tsx:128-187`).
- **Stacking rules** (`cart.ts:165-309`): promotion + voucher **không stack**:
  - `ALL_REQUIRED + PERCENT_ORDER` → giữ promotion, voucher tính top-level
  - `ALL_REQUIRED + SAME_PRICE_PRODUCT` → bỏ promotion, dùng giá cố định voucher
  - `AT_LEAST_ONE_REQUIRED` (mọi type) → bỏ promotion với item eligible, dùng voucher
- **Post-create voucher change**: `PATCH /orders/{slug}/voucher` accept `voucher: null` để remove. Body cần resend `orderItems` (slug + qty + note + promotion).
- **Promotion expiry pre-check**: system **KHÔNG validate** lúc submit (gap), defer hoàn toàn cho BE reject. Staff plan cũng theo pattern này (defer cho BE).

### Verify trước khi start

- [ ] **`useSpecificMenu` response có `item.product.slug` không?** Staff `menu-panel.tsx` hiện chỉ map `item.product.catalog.slug`. Cần `product.slug` để truyền lên voucher validate. Grep nhanh type `IMenuItem` để confirm — nếu có, A2 chỉ cần thêm 1 dòng.

---

## File Structure

**Create:**
- `src/lib/staff-cart-adapter.ts` — adapter staff `OrderItem[]` → system `ICartItem` shape
- `src/components/staff/staff-table-voucher-sheet.tsx` — sheet riêng cho staff session (props-based, không phụ thuộc `useOrderFlowStore`)
- `src/lib/voucher-validation.ts` — extract validation logic từ `StaffVoucherListSheet` (shared util)
- `src/tests/lib/staff-cart-adapter.test.ts`
- `src/tests/lib/voucher-validation.test.ts`

**Modify:**
- `src/types/session.ts` — thêm fields cho `OrderItem`
- `src/components/staff/menu-panel.tsx` — capture promotion + productSlug, hiển thị `<StaffPromotionTag>`
- `src/components/staff/order-summary.tsx` — dùng adapter + `calculateCartTotals`, hiển thị giá gạch + breakdown
- `src/stores/table-sessions.store.ts` — thêm `setOrderVoucher` action, persist voucher
- `src/app/staff/table-order.tsx` — pipe promotion + voucher vào payload (`createOrder`, `addOrderItem`)
- `src/data/staff-data.ts` (nếu có `STORAGE_KEYS`) — bump version cho session schema migration

---

# Phase A: Promotion (per-item discount)

## Task A1: Extend `OrderItem` type + adapter helper

**Files:**
- Modify: `src/types/session.ts:3`
- Create: `src/lib/staff-cart-adapter.ts`
- Test: `src/tests/lib/staff-cart-adapter.test.ts`

- [ ] **Step 1: Write failing test for `staffItemsToCartItem`**

```ts
// src/tests/lib/staff-cart-adapter.test.ts
import { describe, it, expect } from 'vitest'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import type { OrderItem } from '@/types/session'

describe('staffItemsToCartItem', () => {
  it('maps staff items to ICartItem shape with promotion fields', () => {
    const items: OrderItem[] = [
      {
        menuItemId: 'menu-1',
        name: 'Cà phê',
        priceNum: 25000,
        price: '25,000đ',
        quantity: 2,
        note: '',
        variantSlug: 'var-1',
        productSlug: 'prod-1',
        originalPrice: 25000,
        promotion: { slug: 'promo-1', value: 20 },
      },
    ]
    const cart = staffItemsToCartItem(items)
    expect(cart.orderItems).toHaveLength(1)
    const it = cart.orderItems[0]
    expect(it.slug).toBe('prod-1')
    expect(it.productSlug).toBe('prod-1')
    expect(it.variant.slug).toBe('var-1')
    expect(it.originalPrice).toBe(25000)
    expect(it.promotion?.slug).toBe('promo-1')
    expect(it.promotionValue).toBe(20)
    expect(it.quantity).toBe(2)
  })

  it('falls back to priceNum when originalPrice missing', () => {
    const items: OrderItem[] = [
      { menuItemId: 'm', name: 'X', priceNum: 10000, price: '10k', quantity: 1, note: '', variantSlug: 'v' },
    ]
    const cart = staffItemsToCartItem(items)
    expect(cart.orderItems[0].originalPrice).toBe(10000)
  })

  it('sets promotion to null when item has no promotion', () => {
    const items: OrderItem[] = [
      { menuItemId: 'm', name: 'X', priceNum: 10000, price: '10k', quantity: 1, note: '', variantSlug: 'v' },
    ]
    const cart = staffItemsToCartItem(items)
    expect(cart.orderItems[0].promotion).toBeNull()
    expect(cart.orderItems[0].promotionValue).toBe(0)
  })
})
```

- [ ] **Step 2: Run test, expect FAIL (module not found)**

```bash
npx vitest run src/tests/lib/staff-cart-adapter.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/staff-cart-adapter'`.

- [ ] **Step 3: Extend `OrderItem` type**

Modify `src/types/session.ts:3` — thêm field optional:

```ts
export interface OrderItem {
  menuItemId: string
  customPriceId?: string
  orderItemSlug?: string
  variantSlug?: string
  name: string
  priceNum: number       // giá hiển thị sau promotion nếu có (giữ ngữ nghĩa hiện tại)
  price: string
  quantity: number
  note: string
  isCustomPrice?: boolean
  // === NEW: promotion fields ===
  productSlug?: string                                     // slug của product (cần cho voucher applicability)
  originalPrice?: number                                    // giá gốc trước promotion (= priceNum nếu không có promotion)
  promotion?: { slug: string; value: number } | null       // promotion áp lên item (null = không có)
}
```

- [ ] **Step 4: Create adapter file**

Create `src/lib/staff-cart-adapter.ts`:

```ts
import type { OrderItem } from '@/types/session'
import type { ICartItem, IOrderItem } from '@/types'

/**
 * Adapter: chuyển staff session OrderItem[] sang shape ICartItem mà
 * calculateCartItemDisplay / calculateCartTotals chấp nhận. Reuse calc
 * logic của system thay vì duplicate.
 */
export function staffItemsToCartItem(items: OrderItem[]): ICartItem {
  const orderItems: IOrderItem[] = items.map((it) => {
    const original = it.originalPrice ?? it.priceNum
    const promoValue = it.promotion?.value ?? 0
    return {
      // Required fields cho calc utils (xem src/utils/cart.ts:178)
      slug: it.productSlug ?? it.menuItemId,
      productSlug: it.productSlug ?? it.menuItemId,
      name: it.name,
      quantity: it.quantity,
      originalPrice: original,
      promotionValue: promoValue,
      promotion: it.promotion ? { slug: it.promotion.slug, value: it.promotion.value } : null,
      note: it.note ?? '',
      variant: { slug: it.variantSlug ?? '', price: original },
    } as unknown as IOrderItem
  })
  return {
    // Minimal ICartItem cho calc — system mong owner/voucher/paymentMethod nhưng
    // calculateCartItemDisplay chỉ read orderItems + voucher (truyền riêng).
    orderItems,
  } as unknown as ICartItem
}
```

> **Why `as unknown as`**: `IOrderItem` ở system rất rộng (chục field), staff không cần đủ. Cast bypass cho phép tạo shape tối thiểu mà calc cần. Test ở Step 1 verify field nào đủ.

- [ ] **Step 5: Run tests, expect PASS**

```bash
npx vitest run src/tests/lib/staff-cart-adapter.test.ts
```

Expected: 3/3 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/session.ts src/lib/staff-cart-adapter.ts src/tests/lib/staff-cart-adapter.test.ts
git commit -m "feat(staff): add promotion fields to OrderItem + staff cart adapter"
```

---

## Task A2: Capture promotion + productSlug khi map menu

**Files:**
- Modify: `src/components/staff/menu-panel.tsx:43-60`
- Test: `src/tests/components/staff/menu-panel.test.tsx` (nếu chưa tồn tại, tạo mới)

- [ ] **Step 1: Write failing test**

```tsx
// src/tests/components/staff/menu-panel.test.tsx (excerpt)
it('passes promotion + productSlug when adding item to cart', async () => {
  const onAdd = vi.fn()
  // ... mock useSpecificMenu trả về 1 item có product.promotion = { slug:'p1', value:20 }
  // và product.slug = 'prod-a'
  render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: /thêm/i }))
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
    productSlug: 'prod-a',
    originalPrice: 25000,
    promotion: { slug: 'p1', value: 20 },
  }))
})
```

- [ ] **Step 2: Run test, expect FAIL**

`onAdd` called without `promotion`/`productSlug` fields.

- [ ] **Step 3: Update menu-panel mapping**

Modify `src/components/staff/menu-panel.tsx:43-60`:

```tsx
const menuItems = useMemo(
  () =>
    (menuData?.result?.menuItems ?? []).map((item) => {
      const isCustomPrice = !!item.product.isCustomPrice
      const original = isCustomPrice ? 0 : (item.product.variants[0]?.price ?? 0)
      const promo = item.promotion ?? null
      const promoValue = promo?.value ?? 0
      const priceNum = promo
        ? Math.max(0, Math.round(original * (1 - promoValue / 100)))
        : original
      return {
        id: item.slug,
        categoryId: item.product.catalog.slug,
        productSlug: item.product.slug,
        name: item.product.name,
        description: item.product.description,
        priceNum,
        originalPrice: original,
        price: isCustomPrice ? '' : formatVnd(priceNum),
        image: item.product.image,
        isCustomPrice,
        variantSlug: item.product.variants[0]?.slug ?? '',
        promotion: promo ? { slug: promo.slug, value: promoValue } : null,
      }
    }),
  [menuData],
)
```

- [ ] **Step 4: Update `onAdd` call sites trong menu-panel**

Tại tất cả `onAdd({ menuItemId: m.id, ... })` (lines 234, 245, custom-price dialog), spread thêm:

```tsx
onAdd({
  menuItemId: m.id,
  name: m.name,
  priceNum: m.priceNum,
  price: m.price,
  quantity: 1,
  variantSlug: m.variantSlug,
  productSlug: m.productSlug,
  originalPrice: m.originalPrice,
  promotion: m.promotion,
})
```

- [ ] **Step 5: Run test, expect PASS**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/menu-panel.tsx src/tests/components/staff/menu-panel.test.tsx
git commit -m "feat(staff): capture promotion + productSlug when adding menu item"
```

---

## Task A3: Hiển thị `<StaffPromotionTag>` trên menu card

**Files:**
- Modify: `src/components/staff/menu-panel.tsx` (JSX card render)

- [ ] **Step 1: Import + render badge**

Trong menu-panel.tsx, thêm import:

```tsx
import StaffPromotionTag from '@/components/app/badge/staff-promotion-tag'
```

Trong JSX card (line ~171, `<div key={m.id} className="relative ...">`), thêm trước `{m.image ?`:

```tsx
{m.promotion && m.promotion.value > 0 && (
  <StaffPromotionTag promotion={{ value: m.promotion.value } as any} />
)}
```

> **Why `as any`**: `StaffPromotionTag` accept `IPromotion` (full type). Card chỉ cần `value` field. Type assertion an toàn vì component chỉ read `promotion.value` (xem `src/components/app/badge/staff-promotion-tag.tsx:9`).

- [ ] **Step 2: Cải thiện strikethrough giá**

Trong card, đổi:

```tsx
<span className="text-xs font-bold text-pos-gold">{m.price}</span>
```

thành:

```tsx
{m.promotion && m.originalPrice !== m.priceNum ? (
  <div className="flex items-baseline gap-1">
    <span className="text-[10px] text-pos-faint line-through">{formatVnd(m.originalPrice)}</span>
    <span className="text-xs font-bold text-pos-gold">{m.price}</span>
  </div>
) : (
  <span className="text-xs font-bold text-pos-gold">{m.price}</span>
)}
```

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Mở `/staff/table/<id>`, chọn menu item có promotion → verify badge "Giảm X%" góc trên trái + giá gạch + giá sau giảm.

- [ ] **Step 4: Commit**

```bash
git add src/components/staff/menu-panel.tsx
git commit -m "feat(staff): show promotion tag + strikethrough price on menu cards"
```

---

## Task A4: Thay `sumItems()` bằng `calculateCartTotals` thông qua adapter

**Files:**
- Modify: `src/components/staff/order-summary.tsx:46-48,70-75`
- Test: `src/tests/components/staff/order-summary.test.tsx` (extend nếu tồn tại; tạo mới nếu không)

- [ ] **Step 1: Write failing test**

```tsx
it('shows promotion discount in subtotal breakdown', () => {
  const items: OrderItem[] = [
    {
      menuItemId: 'm1', name: 'A', priceNum: 20000, price: '20k', quantity: 2, note: '',
      variantSlug: 'v1', productSlug: 'p1', originalPrice: 25000,
      promotion: { slug: 'pr1', value: 20 },
    },
  ]
  render(<OrderSummary pendingItems={items} {...defaultProps} />)
  // Subtotal gốc = 25k * 2 = 50k
  // Promo discount = 5k * 2 = 10k
  // Final = 40k
  expect(screen.getByTestId('grand-total')).toHaveTextContent(/40[.,]?000/)
  expect(screen.getByText(/giảm khuyến mãi/i).parentElement).toHaveTextContent(/10[.,]?000/)
})
```

- [ ] **Step 2: Run test, expect FAIL**

Current `sumItems` chỉ tính `priceNum * qty`, không có breakdown.

- [ ] **Step 3: Replace `sumItems` với adapter + util**

Modify `src/components/staff/order-summary.tsx`:

```tsx
// xoá function sumItems

import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'

// Inside component, thay block pendingTotal:
const pendingDisplay = useMemo(() => {
  const cart = staffItemsToCartItem(pendingItems)
  return calculateCartItemDisplay(cart, /* voucher */ null)
}, [pendingItems])

const pendingTotals = useMemo(
  () => calculateCartTotals(pendingDisplay, null),
  [pendingDisplay],
)

const submittedTotal = useMemo(
  () =>
    submittedOrders.reduce((s, o) => {
      const cart = staffItemsToCartItem(o.items)
      const display = calculateCartItemDisplay(cart, null)
      return s + calculateCartTotals(display, null).subTotal
    }, 0),
  [submittedOrders],
)
```

> **Field names**: `calculateCartTotals` return shape — kiểm tra `src/utils/cart.ts:509+` để confirm: thường có `subTotal`, `promotionDiscount`, `voucherDiscount`, `total`. Đọc lại nếu cần.

- [ ] **Step 4: Update footer breakdown UI**

Thay block footer hiện tại với breakdown:

```tsx
<div className="border-t border-pos-border p-4 pb-3 space-y-1">
  <div className="flex justify-between text-xs text-pos-dim">
    <span>Tạm tính</span>
    <span>{formatVnd(pendingTotals.subTotalBeforeDiscount)}</span>
  </div>
  {pendingTotals.promotionDiscount > 0 && (
    <div className="flex justify-between text-xs text-emerald-500">
      <span>Giảm khuyến mãi</span>
      <span>-{formatVnd(pendingTotals.promotionDiscount)}</span>
    </div>
  )}
  <div className="flex items-baseline justify-between pt-1">
    <span className="text-xs font-bold tracking-widest text-pos-muted">TỔNG CỘNG</span>
    <span data-testid="grand-total" className="text-xl font-bold text-pos-gold">
      {formatVnd(pendingTotals.total)}
    </span>
  </div>
  {/* rest of buttons */}
</div>
```

> Confirm field names (`subTotalBeforeDiscount`, `promotionDiscount`, `total`) bằng cách đọc `src/utils/cart.ts:509-599`. Adjust nếu khác.

- [ ] **Step 5: Update cart item row hiển thị giá gạch**

Trong block `pendingItems.map((p) => ...)`, đổi span giá:

```tsx
{p.promotion && p.originalPrice && p.originalPrice !== p.priceNum ? (
  <div className="flex flex-col items-end">
    <span className="text-[10px] text-pos-faint line-through">
      {formatVnd(p.originalPrice * p.quantity)}
    </span>
    <span className="text-xs font-semibold text-pos-gold">
      {formatVnd(p.priceNum * p.quantity)}
    </span>
  </div>
) : (
  <span className="shrink-0 text-xs font-semibold text-pos-gold">
    {formatVnd(p.priceNum * p.quantity)}
  </span>
)}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/tests/components/staff/order-summary.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/staff/order-summary.tsx src/tests/components/staff/order-summary.test.tsx
git commit -m "feat(staff): use shared cart calc utils via adapter + show promotion breakdown"
```

---

## Task A5: Pipe promotion slug vào payload `createOrder` + `addNewOrderItem`

> Note: staff đang dùng `addOrderItemAsync` (xem `table-order.tsx:254`). Hook name có thể là `useAddNewOrderItem` (system) hoặc `useCreateOrderItem` — confirm tên hook hiện tại trong staff trước khi sửa, không đổi tên hook.

**Files:**
- Modify: `src/app/staff/table-order.tsx:237-242, 254-259, 326-331`

- [ ] **Step 1: Update `createOrder` payload**

Tại `:237-242`, thay:

```tsx
orderItems: apiItems.map((item) => ({
  quantity: item.quantity,
  variant: item.variantSlug!,
  promotion: item.promotion?.slug ?? null,
  note: item.note || '',
})),
```

- [ ] **Step 2: Update `addOrderItem` trong submit loop**

Tại `:254-259`:

```tsx
const data = await addOrderItemAsync({
  quantity: item.quantity,
  variant: item.variantSlug!,
  promotion: item.promotion?.slug ?? '',
  order: currentSession.orderSlug,
})
```

- [ ] **Step 3: Update `addOrderItem` trong submitted-changes**

Tại `:326-331`:

```tsx
const data = await addOrderItemAsync({
  quantity: newQty - currentTotal,
  variant: variantSlug,
  promotion: meta.promotion?.slug ?? '',
  order: currentSession.orderSlug!,
})
```

- [ ] **Step 4: Manual smoke**

- Tạo đơn có item promotion → mở Network tab → verify request body `orderItems[].promotion = "<slug>"`.
- Verify BE return order với promotion áp dụng (kiểm tra `total` từ response).

- [ ] **Step 5: Commit**

```bash
git add src/app/staff/table-order.tsx
git commit -m "feat(staff): send promotion slug in createOrder + addOrderItem payload"
```

---

## Task A6: Re-hydrate promotion từ submitted order khi reload session

**Files:**
- Modify: `src/app/staff/table-order.tsx` (chỗ map `IOrder.orderItems` → `OrderItem[]` khi sync từ BE)

- [ ] **Step 1: Tìm chỗ rehydrate**

Grep `replaceSubmittedOrders` trong table-order.tsx — nơi convert `IOrder` từ `useGetActiveOrderByTable` về local `OrderItem`. Confirm shape.

- [ ] **Step 2: Map promotion vào OrderItem khi rehydrate**

Tại nơi convert mỗi `IOrderItem` của API → local `OrderItem`, thêm:

```tsx
{
  // ... existing fields
  productSlug: apiItem.variant?.product?.slug,
  originalPrice: apiItem.variant?.price,
  promotion: apiItem.promotion ? { slug: apiItem.promotion.slug, value: apiItem.promotion.value } : null,
}
```

- [ ] **Step 3: Smoke test**

- Tạo đơn có promotion → submit → reload page → verify submitted orders vẫn show promotion + total đúng.

- [ ] **Step 4: Commit**

```bash
git add src/app/staff/table-order.tsx
git commit -m "feat(staff): rehydrate promotion fields when syncing order from BE"
```

---

# Phase B: Voucher (order-level discount)

## Task B1: Add `voucher` to session state

**Files:**
- Modify: `src/types/session.ts:36` (add `voucher?: IVoucher | null` to `TableSession`)
- Modify: `src/stores/table-sessions.store.ts` — add `setOrderVoucher` action

- [ ] **Step 1: Extend TableSession**

Modify `src/types/session.ts`:

```ts
import type { IVoucher } from './voucher' // verify đúng path

export interface TableSession {
  // ... existing fields
  voucher?: IVoucher | null
}
```

- [ ] **Step 2: Add store action**

Modify `src/stores/table-sessions.store.ts` — thêm vào `ITableSessionsStore`:

```ts
setOrderVoucher: (tableId: string, voucher: IVoucher | null) => void
```

Implementation:

```ts
setOrderVoucher: (tableId, voucher) =>
  set((state) =>
    patchSession(state, tableId, (session) => ({ ...session, voucher })),
  ),
```

- [ ] **Step 3: Add test**

```ts
// src/tests/stores/table-sessions-voucher.test.ts
it('setOrderVoucher attaches voucher to session', () => {
  const store = useTableSessionsStore.getState()
  store.openSession('t1', 'Bàn 1')
  const v = { slug: 'v1', code: 'CODE', value: 20 } as unknown as IVoucher
  store.setOrderVoucher('t1', v)
  expect(useTableSessionsStore.getState().sessions['t1'].voucher).toEqual(v)
  store.setOrderVoucher('t1', null)
  expect(useTableSessionsStore.getState().sessions['t1'].voucher).toBeNull()
})
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/types/session.ts src/stores/table-sessions.store.ts src/tests/stores/
git commit -m "feat(staff): add voucher slot to TableSession + setOrderVoucher action"
```

---

## Task B2: Extract voucher validation helpers

**Files:**
- Create: `src/lib/voucher-validation.ts`
- Test: `src/tests/lib/voucher-validation.test.ts`

- [ ] **Step 1: Extract logic from StaffVoucherListSheet**

Reuse logic từ `src/components/app/sheet/staff-voucher-list-sheet.tsx:166-236` (auto-check) và `:391-436` (`isVoucherValid`), `:438-537` (`getVoucherErrorMessage`).

Create `src/lib/voucher-validation.ts`:

```ts
import moment from 'moment'
import { APPLICABILITY_RULE, Role, VOUCHER_TYPE } from '@/constants'
import type { IVoucher } from '@/types'
import { isVoucherApplicableToCartItems } from '@/utils'
import { isVoucherExpired, isVoucherInActiveTimeWindow } from '@/utils/voucher-time'

export interface VoucherValidationContext {
  subtotalAfterPromotion: number  // tổng nonGift items sau promotion
  totalQuantity: number
  productSlugs: string[]
  hasCustomerOwner: boolean        // owner là customer (cho identity check)
}

export function isVoucherValid(voucher: IVoucher, ctx: VoucherValidationContext): boolean {
  const validAmount =
    voucher.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT ||
    (voucher.minOrderValue || 0) <= ctx.subtotalAfterPromotion
  const isActive = voucher.isActive
  const notExpired = !isVoucherExpired(voucher)
  const inWindow = isVoucherInActiveTimeWindow(voucher)
  const hasUsage = (voucher.remainingUsage || 0) > 0
  const sevenAm = moment().set({ hour: 7, minute: 0, second: 0, millisecond: 0 })
  const validDate = sevenAm.isSameOrBefore(moment(voucher.endDate))
  const identityOk = !voucher.isVerificationIdentity || ctx.hasCustomerOwner

  const voucherProductSlugs = voucher.voucherProducts?.map((vp) => vp.product.slug) ?? []
  const productsOk =
    voucherProductSlugs.length === 0
      ? true
      : isVoucherApplicableToCartItems(ctx.productSlugs, voucherProductSlugs, voucher.applicabilityRule)

  const maxItemsOk = !voucher.maxItems || voucher.maxItems === 0 || ctx.totalQuantity <= voucher.maxItems

  return isActive && notExpired && hasUsage && validAmount && validDate && identityOk && productsOk && inWindow && maxItemsOk
}

export function getVoucherErrorMessage(
  voucher: IVoucher,
  ctx: VoucherValidationContext,
  t: (k: string, p?: Record<string, unknown>) => string,
): string {
  // Reuse switch logic từ StaffVoucherListSheet:491-537 (errorChecks array).
  // ... full implementation per source ...
  return ''
}
```

- [ ] **Step 2: Test với 5 case**

```ts
// src/tests/lib/voucher-validation.test.ts
describe('isVoucherValid', () => {
  it('returns false when minOrderValue not met', () => { /* ... */ })
  it('returns false when voucher expired', () => { /* ... */ })
  it('returns false when ALL_REQUIRED but some products not in voucher list', () => { /* ... */ })
  it('returns true for valid SAME_PRICE_PRODUCT voucher', () => { /* ... */ })
  it('returns false when isVerificationIdentity but no customer owner', () => { /* ... */ })
})
```

- [ ] **Step 3: Run tests, expect PASS**

- [ ] **Step 4: Commit**

```bash
git add src/lib/voucher-validation.ts src/tests/lib/voucher-validation.test.ts
git commit -m "feat: extract voucher validation helpers from StaffVoucherListSheet"
```

---

## Task B3: Build `StaffTableVoucherSheet` (props-based)

**Files:**
- Create: `src/components/staff/staff-table-voucher-sheet.tsx`

- [ ] **Step 1: Write props-based sheet**

Sheet này nhận `pendingItems`, `customer`, `voucher`, `onApply`, `onRemove` qua props (không phụ thuộc `useOrderFlowStore`). Re-render khi mở/đóng.

```tsx
import { useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Button } from '@/components/ui'
import type { OrderItem, TableCustomer } from '@/types/session'
import type { IVoucher, IGetAllVoucherRequest } from '@/types'
import { useVouchersForOrder, useValidateVoucher } from '@/hooks'
import { useUserStore } from '@/stores'
import { Role } from '@/constants'
import { isVoucherValid, getVoucherErrorMessage } from '@/lib/voucher-validation'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import { showErrorToast, showToast } from '@/utils'
import { useTranslation } from 'react-i18next'
// + voucher card render (copy renderVoucherCard từ staff-voucher-list-sheet.tsx)

interface Props {
  pendingItems: OrderItem[]
  customer: TableCustomer | null
  appliedVoucher: IVoucher | null
  onApply: (voucher: IVoucher) => void
  onRemove: () => void
}

export function StaffTableVoucherSheet({ pendingItems, customer, appliedVoucher, onApply, onRemove }: Props) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('voucher')
  const { t: tToast } = useTranslation('toast')
  const { userInfo } = useUserStore()
  const { mutate: validateVoucher } = useValidateVoucher()

  const display = useMemo(
    () => calculateCartItemDisplay(staffItemsToCartItem(pendingItems), null),
    [pendingItems],
  )
  const totals = useMemo(() => calculateCartTotals(display, null), [display])

  const ctx = useMemo(() => ({
    subtotalAfterPromotion: totals.subTotal,
    totalQuantity: pendingItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: pendingItems.map((i) => i.productSlug ?? i.menuItemId),
    hasCustomerOwner: !!customer,
  }), [totals.subTotal, pendingItems, customer])

  const request: IGetAllVoucherRequest = useMemo(() => ({
    hasPaging: true,
    page: 1,
    size: 20,
    ...(customer ? { user: customer.slug } : {}),
    minOrderValue: ctx.subtotalAfterPromotion,
    orderItems: pendingItems.map((i) => ({
      quantity: i.quantity,
      variant: i.variantSlug ?? '',
      promotion: i.promotion?.slug ?? '',
      order: '',
    })),
  }), [customer, ctx.subtotalAfterPromotion, pendingItems])

  const { data: voucherList } = useVouchersForOrder(request, open)
  const vouchers = voucherList?.result?.items ?? []

  const handleToggle = (v: IVoucher) => {
    if (appliedVoucher?.slug === v.slug) {
      onRemove()
      showToast(tToast('toast.removeVoucherSuccess'))
      return
    }
    if (v.isVerificationIdentity && !customer) {
      showErrorToast(1004)
      return
    }
    validateVoucher({
      voucher: v.slug,
      user: customer?.slug ?? userInfo?.slug ?? '',
      orderItems: pendingItems.map((i) => ({
        quantity: i.quantity,
        variant: i.variantSlug ?? '',
        note: i.note,
        promotion: i.promotion?.slug ?? null,
        order: null,
      })),
    }, {
      onSuccess: () => {
        onApply(v)
        setOpen(false)
        showToast(tToast('toast.applyVoucherSuccess'))
      },
    })
  }

  // ... render sheet với valid/invalid groups (copy structure từ original sheet)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          {appliedVoucher ? `Voucher: ${appliedVoucher.code}` : t('voucher.useVoucher')}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('voucher.list')}</SheetTitle>
        </SheetHeader>
        {/* render vouchers, dùng isVoucherValid + getVoucherErrorMessage từ voucher-validation.ts */}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Smoke test render**

Render trong storybook (nếu có) hoặc test snapshot — verify mount mà không crash.

- [ ] **Step 3: Commit**

```bash
git add src/components/staff/staff-table-voucher-sheet.tsx
git commit -m "feat(staff): add StaffTableVoucherSheet props-based for table session"
```

---

## Task B4: Wire voucher sheet vào OrderSummary + pipe voucher vào totals

**Files:**
- Modify: `src/components/staff/order-summary.tsx`
- Modify: `src/app/staff/table-order.tsx` (pass voucher + handlers vào OrderSummary)

- [ ] **Step 1: Extend OrderSummary props**

```tsx
interface Props {
  // ... existing
  voucher: IVoucher | null
  onApplyVoucher: (v: IVoucher) => void
  onRemoveVoucher: () => void
}
```

- [ ] **Step 2: Re-run totals với voucher**

```tsx
const pendingDisplay = useMemo(
  () => calculateCartItemDisplay(staffItemsToCartItem(pendingItems), voucher),
  [pendingItems, voucher],
)
const pendingTotals = useMemo(
  () => calculateCartTotals(pendingDisplay, voucher),
  [pendingDisplay, voucher],
)
```

- [ ] **Step 3: Render sheet trong tab Info**

Trong `TabsContent value="info"`, thêm dưới phần GHI CHÚ:

```tsx
<div>
  <label className="block text-xs font-bold tracking-widest text-pos-muted mb-2">
    VOUCHER
  </label>
  <StaffTableVoucherSheet
    pendingItems={pendingItems}
    customer={customer}
    appliedVoucher={voucher}
    onApply={onApplyVoucher}
    onRemove={onRemoveVoucher}
  />
</div>
```

- [ ] **Step 4: Add voucher row vào footer breakdown**

```tsx
{voucher && pendingTotals.voucherDiscount > 0 && (
  <div className="flex justify-between text-xs text-emerald-500">
    <span>Voucher ({voucher.code})</span>
    <span>-{formatVnd(pendingTotals.voucherDiscount)}</span>
  </div>
)}
```

- [ ] **Step 5: Wire trong table-order.tsx**

```tsx
const session = sessions[id]
// ...
<OrderSummary
  // ... existing props
  voucher={session?.voucher ?? null}
  onApplyVoucher={(v) => setOrderVoucher(id, v)}
  onRemoveVoucher={() => setOrderVoucher(id, null)}
/>
```

- [ ] **Step 6: Smoke test**

Mở `/staff/table/<id>` → tab THÔNG TIN → click voucher → chọn voucher hợp lệ → verify discount hiển thị trong footer + grand total trừ đúng.

- [ ] **Step 7: Commit**

```bash
git add src/components/staff/order-summary.tsx src/app/staff/table-order.tsx
git commit -m "feat(staff): wire StaffTableVoucherSheet into OrderSummary + apply discount in totals"
```

---

## Task B5: Send voucher slug + handle post-submit voucher change via `useUpdateVoucherInOrder`

**Files:**
- Modify: `src/app/staff/table-order.tsx:243`
- Modify: `src/components/staff/order-summary.tsx` (gọi mutation khi có `orderSlug`)

> BE đã confirm có endpoint `PATCH /orders/{slug}/voucher` → KHÔNG cần disable post-submit. Reuse `useUpdateVoucherInOrder()` từ `src/hooks/use-order.ts:240`.

- [ ] **Step 1: Set voucher trong createOrder**

Modify `src/app/staff/table-order.tsx:243`:

```tsx
voucher: currentSession.voucher?.slug ?? null,
```

- [ ] **Step 2: Wire `useUpdateVoucherInOrder` cho post-submit change**

Trong handler `onApplyVoucher`/`onRemoveVoucher` ở `table-order.tsx`:

```tsx
const { mutateAsync: updateVoucherInOrder } = useUpdateVoucherInOrder()

const handleApplyVoucher = async (v: IVoucher | null) => {
  setOrderVoucher(id, v)  // optimistic FE update
  if (!session?.orderSlug) return  // pre-submit: chỉ update local store
  // Post-submit: sync với BE
  try {
    await updateVoucherInOrder({
      slug: session.orderSlug,
      data: {
        voucher: v?.slug ?? null,
        orderItems: session.pendingItems.concat(
          session.submittedOrders.flatMap((o) => o.items),
        ).map((it) => ({
          quantity: it.quantity,
          variant: it.variantSlug ?? '',
          note: it.note,
          promotion: it.promotion?.slug ?? null,
          order: session.orderSlug,
        })),
      },
    })
    showToast(v ? 'Đã áp voucher' : 'Đã bỏ voucher')
    invalidateActiveOrder()
  } catch {
    setOrderVoucher(id, session.voucher ?? null)  // rollback
    showErrorToastMessage('Không thể cập nhật voucher')
  }
}
```

> **Why concat pendingItems + submittedOrders**: BE cần full danh sách item hiện tại để re-validate voucher. Item đã submit + đang pending đều phải gửi.

- [ ] **Step 3: Smoke test full flow**

**Pre-submit:**
1. Bàn trống → thêm 3 món (1 món promotion 20%) → tab Info → chọn voucher 10% → verify total đúng (promotion + voucher cùng tính)
2. Gửi đơn → verify Network: request body có `voucher: "<slug>"` + items có `promotion: "<slug>"`

**Post-submit:**
3. Đơn đã có `orderSlug` → đổi voucher khác → verify `PATCH /orders/{slug}/voucher` được gọi với body đúng
4. Remove voucher → verify body có `voucher: null`

**Persistence:**
5. Reload page → verify voucher rehydrated từ `useGetActiveOrderByTable.result.voucher`

- [ ] **Step 4: Commit**

```bash
git add src/app/staff/table-order.tsx src/components/staff/order-summary.tsx
git commit -m "feat(staff): send voucher slug in createOrder + sync voucher updates post-submit"
```

---

## Task B6: Auto re-validate voucher khi cart thay đổi

> Mirror pattern từ `cart-content.tsx:128-187`. Khi user add/remove item → kiểm tra voucher còn valid không, nếu fail thì auto-remove + toast.

**Files:**
- Modify: `src/components/staff/order-summary.tsx` hoặc tạo `src/hooks/use-auto-revalidate-staff-voucher.ts`

- [ ] **Step 1: Add effect re-validate**

```tsx
import { isVoucherValid } from '@/lib/voucher-validation'

useEffect(() => {
  if (!voucher) return
  const ctx = {
    subtotalAfterPromotion: pendingTotals.subTotal,
    totalQuantity: pendingItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: pendingItems.map((i) => i.productSlug ?? i.menuItemId),
    hasCustomerOwner: !!customer,
  }
  if (!isVoucherValid(voucher, ctx)) {
    onRemoveVoucher()
    showErrorToastMessage(`Đã bỏ voucher ${voucher.code} (không còn hợp lệ)`)
  }
}, [voucher, pendingItems, customer, pendingTotals.subTotal, onRemoveVoucher])
```

- [ ] **Step 2: Smoke test**

1. Áp voucher có `minOrderValue: 100k` cho đơn 150k → OK
2. Remove 1 món → tổng còn 80k → voucher tự bỏ + toast hiện

- [ ] **Step 3: Commit**

```bash
git add src/components/staff/order-summary.tsx
git commit -m "feat(staff): auto re-validate voucher when cart changes"
```

---

## Final Review Tasks

- [ ] **Run full test suite**: `npx vitest run` — expect ALL PASS (517 + new tests)
- [ ] **tsc + lint**: `npm run lint && npx tsc -b` — expect clean
- [ ] **Manual full smoke**:
  - Bàn trống → add item (có promotion) → verify giá gạch + badge
  - Add multiple items mix promotion + không promotion → verify breakdown subtotal/promotion/total
  - Add voucher → verify voucher discount row + grand total
  - Submit order → verify BE response total match FE total
  - Reload → verify state rehydrated chính xác
  - Cancel order → verify voucher cleared
- [ ] **Update memory**: nếu phát hiện pattern mới đáng nhớ (vd "Staff session adapter pattern"), save memory

---

## Notes / Design Decisions

1. **Adapter thay vì refactor types**: Giữ `OrderItem` staff đơn giản, không merge với `IOrderItem` system (vốn rất bloated). Adapter cost ít hơn và an toàn hơn.

2. **New sheet thay vì refactor `StaffVoucherListSheet`**: Sheet cũ phụ thuộc `useOrderFlowStore` qua nhiều layer (970 dòng, 30+ usages của `cartItems.*`). Refactor có thể break /system. New sheet props-based + extract validation sang shared util cho ROI cao hơn.

3. **`StaffPromotionTag` reuse**: Card UI dùng absolute positioning + SVG asset. Đủ generic để reuse trên staff menu card mà không cần modify.

4. **Voucher post-submit**: BE đã confirm có `PATCH /orders/{slug}/voucher` (`useUpdateVoucherInOrder`). Task B5 sync local + remote khi `orderSlug` exists, rollback nếu fail. Pre-submit chỉ update local store (tránh round-trip thừa).

5. **Auto-revalidate**: Task B6 mirror pattern system — voucher bị bỏ tự động nếu cart change làm fail minOrderValue / maxItems / applicability. Match expectation của BE (BE cũng re-validate khi update).

6. **Promotion expiry pre-check**: KHÔNG add (match system gap) — defer cho BE reject. Nếu sau này BE return error code rõ ràng, có thể bổ sung toast tốt hơn.

5. **Gift items**: Plan này KHÔNG cover gift item flow (system có `isGift` trên `IOrderItem`, staff hiện chưa support). Out of scope — track riêng nếu cần.

6. **Migration**: `OrderItem` thêm fields optional → không cần version bump. Session cũ trong localStorage không có promotion fields → adapter fallback (`originalPrice ?? priceNum`, `promotion ?? null`) handle gracefully.
