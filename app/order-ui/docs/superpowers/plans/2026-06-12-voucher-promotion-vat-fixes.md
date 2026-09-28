# Voucher × Promotion × VAT Logic Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> **DO NOT git commit per task** — leave changes in working tree for user.

**Goal:** Fix 3 bugs trong logic voucher × promotion × VAT — đảm bảo stacking đúng theo policy nhà hàng, đồng bộ FE/BE.

**Architecture:**
- Phase A (CRITICAL): Fix B1 — AT_LEAST + FIXED stack promotion trước voucher
- Phase B (DECISION-REQUIRED): Confirm B2 policy với business (% AT_LEAST stack hay không) trước khi fix
- Phase C (BE COORDINATION): Audit B3 BE/FE alignment cho VAT order

**Risk:** Medium. Bug B1 chạm core cart math → cần unit test bao bọc. Bug B2 cần stakeholder decision trước.

**Tech Stack:** React 18, TS, Vitest, BE PATCH order endpoint

---

## File scope

### Files to modify
- `src/utils/cart.ts` — main cart math
- `src/tests/utils/cart.test.ts` (nếu chưa có, tạo mới) — unit tests

### Files to read (no modify)
- `src/types/voucher.type.ts` — voucher shape
- `src/types/session.ts` — OrderItem shape
- `src/utils/voucher.ts` — applicability helpers
- `src/constants/voucher.ts` — VOUCHER_TYPE + APPLICABILITY_RULE enums

---

# Phase A — Critical bug B1

## Task VPV-1: AT_LEAST + FIXED stack với promotion

**Why:** Hiện code `cart.ts:271-282` (AT_LEAST + FIXED + eligible) reset `priceAfterPromotion = original` và `promotionDiscount = 0` → bỏ promotion. Expected: stack — promotion áp trước, voucher fixed trừ trên giá sau promotion.

**Files:**
- Modify: `src/utils/cart.ts`
- Test: `src/tests/utils/cart.test.ts` (mới hoặc augment)

### Step 1: Re-read current bug

```bash
sed -n '244,310p' src/utils/cart.ts
```

Focus on the `AT_LEAST_ONE_REQUIRED + FIXED_VALUE` branch.

### Step 2: Fix item-level math

Replace:
```tsx
if (type === VOUCHER_TYPE.FIXED_VALUE) {
  // Trừ thẳng full giá trị voucher vào từng món hợp lệ
  const voucherDiscount = Math.min(original, voucher.value || 0)
  const finalPrice = Math.max(0, original - voucherDiscount)
  return {
    ...item,
    finalPrice,
    priceAfterPromotion: original, // bỏ promotion
    promotionDiscount: 0,
    voucherDiscount,
  }
}
```

With:
```tsx
if (type === VOUCHER_TYPE.FIXED_VALUE) {
  // Stack: promotion áp trước (priceAfterPromotion đã tính ở trên),
  // sau đó voucher fixed trừ thẳng trên priceAfterPromotion.
  const voucherDiscount = Math.min(priceAfterPromotion, voucher.value || 0)
  const finalPrice = Math.max(0, priceAfterPromotion - voucherDiscount)
  return {
    ...item,
    finalPrice,
    priceAfterPromotion,  // GIỮ promotion-applied price
    promotionDiscount,    // GIỮ promotion discount (đã tính ở Math.round trên)
    voucherDiscount,
  }
}
```

### Step 3: Fix totals exclusion logic

Find `cart.ts:528-534`:
```tsx
((voucher?.type === VOUCHER_TYPE.PERCENT_ORDER ||
  voucher?.type === VOUCHER_TYPE.FIXED_VALUE) &&
  voucher?.applicabilityRule ===
    APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED)
```

REMOVE `VOUCHER_TYPE.FIXED_VALUE` from this exclusion since we no longer drop promotion for FIXED:

```tsx
// AT_LEAST_ONE với PERCENT → vẫn loại promotion nếu item hợp lệ (B2 quyết định sau)
// (FIXED không còn ở đây — đã stack đúng)
(voucher?.type === VOUCHER_TYPE.PERCENT_ORDER &&
  voucher?.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED)
```

### Step 4: Same fix in calculateOrderItemDisplay

The same bug exists in `cart.ts:457-475` (`AT_LEAST_ONE_REQUIRED` + `FIXED_VALUE`). Apply the same stack fix:

```tsx
} else if (type === VOUCHER_TYPE.FIXED_VALUE) {
  if (isEligible) {
    voucherDiscount = Math.min(priceAfterPromotion, voucher?.value || 0)
    finalPrice = Math.max(0, priceAfterPromotion - voucherDiscount)
    return {
      ...item,
      name,
      productSlug,
      originalPrice: original,
      finalPrice,
      priceAfterPromotion,  // KEEP
      promotionDiscount,    // KEEP
      voucherDiscount,
    }
  }
}
```

### Step 5: Add unit test

`src/tests/utils/cart.test.ts` — case AT_LEAST + FIXED + promotion:

```tsx
describe('calculateCartTotals — AT_LEAST + FIXED + promotion', () => {
  it('stacks promotion before fixed voucher discount', () => {
    const cart: ICartItem = {
      orderItems: [
        {
          slug: 'item-1',
          originalPrice: 100_000,
          promotionValue: 20,  // 20% promo
          promotionDiscount: 20_000,
          quantity: 1,
          // ... other fields as fixture
        },
      ],
    }
    const voucher: IVoucher = {
      type: VOUCHER_TYPE.FIXED_VALUE,
      applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
      value: 10_000,
      voucherProducts: [{ product: { slug: 'item-1' } }],
      // ...
    }

    const display = calculateCartItemDisplay(cart, voucher)
    expect(display[0].promotionDiscount).toBe(20_000)  // promotion preserved
    expect(display[0].voucherDiscount).toBe(10_000)    // voucher on top
    expect(display[0].finalPrice).toBe(70_000)         // 100k - 20k - 10k

    const totals = calculateCartTotals(display, voucher)
    expect(totals.promotionDiscount).toBe(20_000)
    expect(totals.voucherDiscount).toBe(10_000)
    expect(totals.finalTotal).toBe(70_000)
  })
})
```

> Add `calculateOrderItemDisplay` equivalent test for AT_LEAST + FIXED with promotion.

### Step 6: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/utils/cart.ts 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Expect: clean tsc, clean eslint, 550+ tests pass (new tests included).

### Step 7: Manual smoke

1. Tạo voucher FIXED_VALUE, AT_LEAST_ONE_REQUIRED, voucherProducts = [productA]
2. Add productA (giá 100k, có promotion 20%) + productB vào cart
3. Áp voucher
4. Check: productA hiển thị priceAfterPromotion = 80k, voucherDiscount = 10k, final = 70k
5. Tổng đơn: subtotal 100k+priceB - 20k promo - 10k voucher

**NO COMMIT.**

---

# Phase B — Policy decision required B2

## Task VPV-2: Decide policy cho AT_LEAST + PERCENT + promotion

**Decision needed (BUSINESS):**
- Option 1: Stack (giống ALL_REQUIRED case 9) — promotion áp trước, voucher % tính trên giá sau promo
- Option 2: Drop promotion (current behavior) — voucher % tính trên giá gốc

**Stakeholders:** Marketing manager + Kế toán

### Step 1: Document policy options

Tạo file `docs/business-rules/voucher-promotion-stacking.md`:

```markdown
# Voucher × Promotion Stacking Policy

## Context
Voucher % với AT_LEAST_ONE_REQUIRED có thể được áp dụng trên đơn có item promotion. Hai cách xử lý:

### Option 1: Stack
- Item A: giá 100k, promo 20% → 80k
- Voucher %30 AT_LEAST → áp lên 80k → 56k
- Khách trả: 56k (44k giảm tổng cộng)

### Option 2: Drop promotion (current)
- Item A: giá 100k, promo 20% → 80k (display)
- Voucher %30 AT_LEAST → áp lên 100k → 70k
- Khách trả: 70k (30k giảm — promotion bị bỏ)

## Recommendation
Tham khảo nhà hàng ngành F&B: Option 1 (stack) là chuẩn ngành — khách hưởng đầy đủ promotion + voucher.
Option 2 thường dùng cho voucher "chỉ áp 1 trong các giảm" — cần label rõ.
```

### Step 2: After business confirms

If **Option 1 (stack)** — apply fix similar to VPV-1:

```tsx
// cart.ts:256-268 (AT_LEAST + PERCENT + eligible)
if (type === VOUCHER_TYPE.PERCENT_ORDER) {
  // Stack: promotion áp trước, voucher % áp trên giá sau promo
  const voucherDiscount = Math.round(
    ((voucher.value || 0) / 100) * priceAfterPromotion,
  )
  const finalPrice = Math.max(0, priceAfterPromotion - voucherDiscount)
  return {
    ...item,
    finalPrice,
    priceAfterPromotion,
    promotionDiscount,
    voucherDiscount,
  }
}
```

And remove `VOUCHER_TYPE.PERCENT_ORDER` from `shouldExcludePromotion` (similar to VPV-1.Step 3).

If **Option 2 (current behavior is correct)** — add code comment explaining business rule, add explicit unit test cementing the behavior so future devs don't accidentally "fix" it.

### Step 3: Add unit test for chosen option

Mirror VPV-1.Step 5 with PERCENT type.

### Step 4: Verify

```bash
npx tsc -b && npx vitest run 2>&1 | tail -5
```

**NO COMMIT.**

---

# Phase C — BE/FE alignment B3

## Task VPV-3: Audit VAT order + total computation BE vs FE

**Why:** Case 7 tester ghi "bill sai BE". FE formula đúng (voucher → VAT inclusive) nhưng BE trả total khác. Cần align.

**Approach:** FE không có thẩm quyền sửa BE. Task này là **AUDIT + DOCUMENT** mismatch, không sửa code.

### Step 1: Pull BE order endpoint response

```bash
# Mock data hoặc sample response từ env staging
# Endpoint: GET /orders/:slug
# Check: subtotal vs subtotalWithVat vs totalAmount vs vatTotal
```

Document:
- BE field names (e.g. `subtotal`, `totalAfterDiscount`, `vatTotal`, `totalAmount`)
- Computation BE thực hiện (VAT before voucher? VAT-inclusive in priceNum? Separate VAT field?)

### Step 2: FE current behavior

In `src/components/staff/table-payment-screen.tsx`:
- `totalWithDiscount` = FE-computed `calculateCartTotals(display, voucher).finalTotal`
- `totalVatAmount` = sum of `orderData.orderItems[].vatValue` (BE-computed VAT per item)
- Display: `Tổng tiền: {totalWithDiscount} (Trong đó VAT: {totalVatAmount})`

### Step 3: Identify mismatch

Run a manual test:
- Order 2 items: A (no VAT, 100k), B (10% VAT, 110k VAT-incl, 100k pre-VAT)
- Voucher 30% ALL_REQUIRED
- FE display: `(100k + 110k) * 0.7 = 147k`, vatValue B = 10k from BE
- BE total: depends on BE math — maybe `100k + 100k_pre_vat = 200k, voucher 30% = 60k, total = 140k + VAT (10k) = 150k`
- Mismatch: 147k vs 150k

### Step 4: Document mismatch + recommendation

`docs/business-rules/vat-voucher-computation.md`:

```markdown
# VAT × Voucher Computation Mismatch

## Observed
FE displays: 147,000đ (voucher trên giá VAT-inclusive)
BE bill shows: 150,000đ (voucher trên giá pre-VAT, then add VAT)

## Root cause hypothesis
- FE: `priceNum` includes VAT → voucher trừ trên VAT-inclusive subtotal
- BE: stores `pricePreVat` and `vatValue` separate → voucher trừ pre-VAT → add VAT

## Recommendation
Align on ONE convention:
1. **VAT-inclusive (recommended for F&B retail)** — sticker price = customer pays. Voucher trên VAT-inclusive. BE should compute same as FE.
2. **VAT-exclusive (B2B/invoicing)** — sticker pre-VAT. Voucher pre-VAT then add VAT. FE must change priceNum convention.

## Action items
- [ ] BE team confirm computation
- [ ] Update API contract docs
- [ ] FE align to BE OR vice versa
- [ ] Add E2E test verifying FE display = BE bill = final invoice
```

### Step 5: Verify

No code changes. Output: docs + JIRA ticket for BE team.

**NO COMMIT.**

---

# Final verification

## Task FINAL: Run all tests + manual smoke

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -3
npx eslint src/ 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

### Smoke checklist
1. AT_LEAST + FIXED + có promotion → cart hiện priceAfterPromotion + voucherDiscount riêng, total = subtotal - promo - voucher (B1 fix)
2. AT_LEAST + PERCENT + có promotion → behavior theo Option chosen ở B2
3. ALL + PERCENT + có promotion → stack đúng (regression check)
4. ALL + FIXED + có promotion → behavior unchanged (regression check)
5. Custom price item + voucher list → UI vẫn block (case 20)
6. Order với VAT → invoice xuất đúng VAT (regression)

**NO COMMIT.**

---

# Design Decisions

1. **B1 fix scope:** Both `calculateCartItemDisplay` AND `calculateCartOrderItemDisplay` — used in different UIs (cart vs payment history). Bug must be fixed in both.
2. **Why not fix B2 immediately:** Policy ambiguity — stacking AT_LEAST + PERCENT may have business intent that's not documented. Skip until confirmed.
3. **Why not fix B3 in FE:** VAT computation mismatch is data convention issue. Either FE accepts BE's total (current — `orderData.totalAmount` if exists) or BE updates to match FE. FE-only change would hide the bug.
4. **Why unit tests required for B1:** Cart math is critical financial logic. Past changes have drifted (e.g. AT_LEAST behavior). Tests prevent regression.

---

# Out of scope

- SAME_PRICE_PRODUCT voucher type (excluded by tester scope)
- Custom price item voucher logic (UI already blocks per case 20)
- Bill export rounding edge cases (case 19 only flags general rounding, already correct)
- Multi-voucher stacking (not currently supported, separate feature)
