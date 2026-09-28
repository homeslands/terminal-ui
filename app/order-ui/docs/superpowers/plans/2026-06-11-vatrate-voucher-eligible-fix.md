# VAT Rate — Type + Payload Fix for Voucher Eligible API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** BE đã thêm `vatRate` per-product trong response (vd `vatRate: 0.1` = 10%). FE 3 layer chưa support → payload gửi lên `POST /voucher/order/eligible` (và `/public/eligible`) đang thiếu `vatRate`, có khả năng làm BE filter sai voucher list. Plan này fix type + payload trên cả `/system` và `/staff` flow.

**Scope quan trọng:**
- KHÔNG đụng đến VAT calculation trong cart display (giá menu vẫn coi là tax-inclusive như docs hiện tại).
- KHÔNG đổi `STAFF_ADMIN_SETTINGS.vatRate` (vẫn dùng cho staff invoice — sẽ migration sang per-product sau ở plan riêng).
- CHỈ propagate `vatRate` từ BE response → cart item → voucher eligible payload.

**Tech Stack:** TypeScript, Zustand, TanStack Query, existing `useOrderFlowStore` + `useTableSessionsStore`.

---

## BE Contracts (assumed — verify trước Task 1)

### Response (BE → FE)

```
GET /menu/specific  → IMenuItem[]
  item.product.vatRate: number    ← NEW, per-product VAT rate, 0..1 (vd 0.1 = 10%)

GET /orders/active  → IOrder
  orderItems[i].variant.product.vatRate: number    ← NEW
```

### Request (FE → BE)

```
POST /voucher/order/eligible
  body.orderItems[i]: { quantity, variant, promotion, order, vatRate }   ← THÊM vatRate

POST /voucher/order/public/eligible
  body.orderItems[i]: { ..., vatRate }   ← THÊM
```

### Pre-flight check (Task 1 implementer)

Trước khi viết code, confirm với swagger / BE doc:
- `vatRate` ở response: trên `IProduct` hay trên `IProductVariant`?
- Format: float `0..1` (0.1 = 10%) hay int `0..100` (10 = 10%)?
- Payload `/eligible`: `vatRate` per-item là bắt buộc hay optional?
- Default value khi món không có VAT (vatRate=0)?

Nếu BE doc không rõ → mặc định: trên `IProduct`, float `0..1`, optional với default 0. Test trên 1 món có vatRate=0.1 + 1 món không có → verify BE response.

---

## File Structure

**Modify (types):**
- `src/types/product.type.ts` — thêm `vatRate?: number` vào `IProduct`
- `src/types/dish.type.ts` — thêm `vatRate?: number` vào `IOrderItem`
- `src/types/voucher.type.ts:90-95` — thêm `vatRate?: number` vào `IGetAllVoucherRequest.orderItems[]`
- `src/types/session.ts` — thêm `vatRate?: number` vào staff `OrderItem`

**Modify (capture vatRate from menu — system):**
- `src/app/system/menu/components/system-menus.tsx` (khoảng line 100-130 — chỗ add-to-cart) — set `vatRate: product.vatRate` khi gọi `addOrderItem`

**Modify (capture vatRate from menu — staff):**
- `src/components/staff/menu-panel.tsx:43-69` — map `vatRate: item.product.vatRate ?? 0` vào mapping
- `src/components/staff/menu-panel.tsx` onAdd call sites — spread `vatRate`

**Modify (rehydrate from BE):**
- `src/lib/staff-orders.ts:134-149` (`mapServerOrderItemToOrderItem`) — đọc `detail.variant.product.vatRate` → set vào `OrderItem.vatRate`
- (System tương tự — nếu có map equivalent, update; nếu BE return đầy đủ IOrderItem thì FE tự đọc field, không cần modify)

**Modify (payload — system, 3 sheets):**
- `src/components/app/sheet/staff-voucher-list-sheet.tsx:99-112`
- `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx:157-162`
- `src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx:163-176`
- (cộng `client-voucher-list-sheet-in-update-order-with-local-storage.tsx` + `staff-voucher-list-sheet-in-update-order-with-local-storage.tsx` nếu có pattern tương tự)

**Modify (payload — staff sheet mới):**
- `src/components/staff/staff-table-voucher-sheet.tsx` (`request` useMemo)

**Test:**
- Extend existing test files với assertion `vatRate` được passthrough đúng
- `src/tests/lib/staff-cart-adapter.test.ts` — assert adapter map vatRate
- `src/tests/components/staff/menu-panel.test.tsx` — assert onAdd nhận vatRate
- `src/lib/__tests__/staff-orders.test.ts` — assert mapServerOrderItem rehydrate vatRate

---

## Task 1: Extend types (cross-cutting)

**Files:**
- `src/types/product.type.ts`
- `src/types/dish.type.ts`
- `src/types/voucher.type.ts`
- `src/types/session.ts`

**Pre-flight**: Verify BE doc / swagger:
- `IProduct.vatRate` vs `IProductVariant.vatRate`
- Format (0..1 vs 0..100)
- Optional vs required
- Default

Nếu unclear → assume `IProduct.vatRate?: number` (0..1, optional, default 0).

- [ ] **Step 1: Modify product.type.ts**

```ts
// src/types/product.type.ts
export interface IProduct {
  // ... existing fields
  /** Per-product VAT rate as float 0..1. 0.1 = 10%. Optional (BE-controlled). */
  vatRate?: number
}
```

- [ ] **Step 2: Modify dish.type.ts**

Find `IOrderItem` interface. Add:

```ts
/** Per-item VAT rate, mirrored from product at add-to-cart time. */
vatRate?: number
```

- [ ] **Step 3: Modify voucher.type.ts**

```ts
// line ~90-95
orderItems?: {
  quantity: number
  variant: string
  promotion: string
  order: string
  vatRate?: number   // NEW: BE filters voucher eligibility based on per-item VAT context
}[]
```

- [ ] **Step 4: Modify session.ts**

```ts
// src/types/session.ts
export interface OrderItem {
  // ... existing fields
  vatRate?: number   // NEW
}
```

- [ ] **Step 5: Verify tsc clean**

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -5
```

Expect: clean (optional fields don't break existing usage).

- [ ] **Step 6: Commit**

```bash
git add src/types/product.type.ts src/types/dish.type.ts src/types/voucher.type.ts src/types/session.ts
git commit -m "types: add vatRate to product/order-item/voucher-eligible payload"
```

---

## Task 2: Capture vatRate when adding from /system menu

**Files:**
- `src/app/system/menu/components/system-menus.tsx`
- Test: existing or extend

### Step 1: Locate add-to-cart logic

Grep `addOrderItem\|onClickAdd\|addToCart` trong `system-menus.tsx`. Tìm chỗ build `IOrderItem` từ menu item — currently không gán `vatRate`.

### Step 2: Add vatRate to add-to-cart payload

```tsx
// existing:
addOrderItem({
  // ... existing fields
  promotion: product.promotion,
  // ADD:
  vatRate: product.vatRate ?? 0,
})
```

### Step 3: Verify tsc + tests

```bash
npx tsc -b
npx vitest run src/tests/app/system/menu/ 2>&1 | tail -8   # if test exists
```

### Step 4: Commit

```bash
git commit -m "feat(system): capture product.vatRate when adding to cart"
```

---

## Task 3: Send vatRate in /system voucher eligible payloads (3 sheets)

**Files:**
- `src/components/app/sheet/staff-voucher-list-sheet.tsx`
- `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx`
- `src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx`
- (Optional) update-order-with-local-storage variants if they exist

### Step 1: Update payload in each sheet

For each file, find the `voucherForOrderRequestParam` useMemo where `orderItems` is mapped. Add `vatRate`:

```ts
orderItems: nonGiftOrderItems.map(item => ({
  quantity: item.quantity,
  variant: item.variant.slug,
  promotion: item.promotion ? item.promotion.slug : '',
  order: item.slug || '',
  vatRate: item.vatRate ?? 0,   // NEW
})),
```

### Step 2: Verify tsc + lint clean

```bash
npx tsc -b
npx eslint src/components/app/sheet/staff-voucher-list-sheet.tsx src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx
```

### Step 3: Smoke test (manual recommended)

- Mở `/system/menu`, thêm 1 món có vatRate (ví dụ trà sữa 10%), mở Network tab.
- Click "Sử dụng voucher" → quan sát request body `POST /voucher/order/eligible` → confirm `orderItems[].vatRate = 0.1` cho item đó.

### Step 4: Commit

```bash
git commit -m "feat(system): send vatRate in voucher eligible payloads"
```

---

## Task 4: Capture vatRate in /staff menu + rehydrate

**Files:**
- `src/components/staff/menu-panel.tsx` (mapping + onAdd)
- `src/lib/staff-orders.ts` (`mapServerOrderItemToOrderItem`)
- `src/lib/staff-cart-adapter.ts` (adapter shape)
- Test files

### Step 1: Add `vatRate` to menu-panel mapping

```tsx
// src/components/staff/menu-panel.tsx — mapping useMemo
return {
  // ... existing fields
  vatRate: item.product.vatRate ?? 0,
}
```

### Step 2: Spread `vatRate` in onAdd call sites

Both inline `onAdd({...})` calls (stepper `+` and `Thêm` button) — add `vatRate: m.vatRate`.

### Step 3: Rehydrate from BE in `mapServerOrderItemToOrderItem`

```ts
// src/lib/staff-orders.ts:134-149
return {
  // ... existing fields
  vatRate: detail.variant.product.vatRate ?? 0,
}
```

### Step 4: Optional — adapter passthrough

Adapter `staffItemsToCartItem` currently doesn't pass `vatRate` to ICartItem shape because calc utils don't read it. KHÔNG cần thêm trừ khi sau này extend calc. Comment NOTE thì OK.

### Step 5: Extend tests

In `src/lib/__tests__/staff-orders.test.ts`:

```ts
it('rehydrates vatRate from server product', () => {
  const detail = {
    slug: 'oi-vat', quantity: 1, note: '',
    variant: { slug: 'v1', price: 25000, product: { slug: 'p1', name: 'X', vatRate: 0.1 } },
  } as unknown as IOrderDetail
  const item = mapServerOrderItemToOrderItem(detail)
  expect(item.vatRate).toBe(0.1)
})

it('defaults vatRate to 0 when server has no vatRate', () => {
  const detail = {
    slug: 'oi', quantity: 1, note: '',
    variant: { slug: 'v', price: 10000, product: { slug: 'p', name: 'Y' } },
  } as unknown as IOrderDetail
  expect(mapServerOrderItemToOrderItem(detail).vatRate).toBe(0)
})
```

In `src/tests/components/staff/menu-panel.test.tsx`:

```tsx
it('passes vatRate when adding item to cart', async () => {
  // mock useSpecificMenu returns 1 item with product.vatRate = 0.08
  // click Thêm
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ vatRate: 0.08 }))
})
```

### Step 6: Verify

```bash
npx vitest run src/lib/__tests__/staff-orders.test.ts src/tests/components/staff/menu-panel.test.tsx 2>&1 | tail -10
npx tsc -b
```

### Step 7: Commit

```bash
git commit -m "feat(staff): capture + rehydrate vatRate on menu add and order sync"
```

---

## Task 5: Send vatRate in /staff voucher eligible payload

**File:** `src/components/staff/staff-table-voucher-sheet.tsx`

### Step 1: Update payload

Find the `request` useMemo. Add `vatRate`:

```ts
orderItems: allItems.map((i) => ({
  quantity: i.quantity,
  variant: i.variantSlug ?? '',
  promotion: i.promotion?.slug ?? '',
  order: '',
  vatRate: i.vatRate ?? 0,   // NEW
})),
```

Also update the `validateVoucher` payload trong `handleToggle`:

```ts
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
      vatRate: i.vatRate ?? 0,   // NEW (also needed for /validate)
    })),
  },
  ...
)
```

> Check `IValidateVoucherRequest` type — nếu shape khác `IGetAllVoucherRequest.orderItems[]`, update đúng type. Có thể cũng cần thêm `vatRate` vào `IValidateVoucherRequest` type definition.

### Step 2: Verify

```bash
npx tsc -b
npx vitest run 2>&1 | tail -5
```

### Step 3: Smoke test

- Mở `/staff/table/<id>`, thêm món có vatRate, mở Network tab.
- Click "Áp voucher" sheet → confirm body `vatRate` present.
- Click "Sử dụng" voucher → confirm `validateVoucher` request body có `vatRate`.

### Step 4: Commit

```bash
git commit -m "feat(staff): send vatRate in voucher eligible + validate payloads"
```

---

## Final Review

- [ ] Full test suite green
- [ ] tsc + lint clean
- [ ] Manual smoke trên cả `/system/menu` và `/staff/table/<id>`:
  - Add 1 item có vatRate + 1 item không vatRate → cả 2 đều gửi đúng `vatRate` trong payload
  - Open voucher sheet → đúng list voucher hiển thị (so với pre-fix)
- [ ] BE verify: `/eligible` filter chính xác theo VAT context

---

## Notes / Design Decisions

1. **`vatRate` optional, default 0**: legacy products chưa có vatRate → FE gửi `0`. BE phải handle `0 = no VAT`. Nếu BE muốn `null` thay vì `0`, sửa default ở Task 1.

2. **KHÔNG đụng cart calc**: Giá menu vẫn coi là tax-inclusive (theo doc hiện tại `staff-assisted-ordering-feature.md:198`). VAT amount chỉ được derive ở invoice phase. Plan tách riêng nếu BE muốn FE tính `total + VAT` riêng biệt.

3. **KHÔNG đụng `STAFF_ADMIN_SETTINGS.vatRate`**: Hardcoded `0.1` ở `staff-data.ts` vẫn được dùng cho invoice computation. Migration sang per-product là plan separate (impact: invoice numbers thay đổi).

4. **Skip stores/order-flow update**: `useOrderFlowStore.addOrderItem` chỉ spread payload nhận vào — không cần modify store action. Chỉ caller (system-menus + menu-panel) cần truyền `vatRate`.

5. **Adapter (staff)**: `staffItemsToCartItem` không cần thêm `vatRate` vì calc utils chưa đọc. Nếu sau này calc cần, thêm vào adapter shape.
