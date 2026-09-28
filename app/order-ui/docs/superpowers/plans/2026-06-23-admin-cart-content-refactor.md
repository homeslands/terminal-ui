# AdminCartContent Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink `src/app/system/menu/components/admin-cart-content.tsx` from 1313 → ≤650 lines by extracting pure functions, hooks, and presentational components, with zero behavior change.

**Architecture:** Three risk-ordered phases. Phase 1 extracts pure functions (no React deps, full unit tests). Phase 2 extracts custom hooks (renderHook tests). Phase 3 extracts presentational sub-components (smoke render tests). Each task replaces existing inline logic with an import — diff is mostly deletion + a single call site. Behavior preserved by extracting verbatim.

**Tech Stack:** React 18 + TypeScript strict, Vitest + @testing-library/react, Zustand stores, TanStack Query, Tailwind. Existing helpers: `staffItemsToCartItem`, `calculateCartItemDisplay`, `calculateCartTotals`, `computeSessionReconciliation`, `useTableSessions`, `useOwnerSync`, `useVoucherState`.

## Global Constraints

- Zero behavior change. UI + API call shape + toast keys + side-effect order all preserved.
- Every task ends GREEN: `npm run build`, `npm run lint`, `npm run test` all pass.
- Each new file ≤ 200 lines.
- Pure functions: TDD with full coverage. Hooks: 1 smoke test using `renderHook` covering the happy path. Components: 1 smoke test covering the standard render.
- Working-tree WIP files (`system-horizontal-catalog-selector.tsx`, `vite.config.ts`, etc.) MUST remain unstaged across every task.
- One new file per task minimum; no bundling extractions into a single commit.
- Each task touches exactly: new file(s) + test file + `admin-cart-content.tsx` call-site swap. No other file modified unless explicitly listed.
- The `breakdown` memo logic includes a recent (c) optimization for BE-stale subtotal detection (added 2026-06-23). Extract VERBATIM — do not "clean up" the math.
- Branch context: this plan executes AFTER the voucher refactor branch is merged. If executed on a different branch, the engineer must first verify that `useVoucherState` hook + `voucher-rules.ts` lib exist (they were added in the prior plan).

---

## File Structure

### New files (created across tasks)

| Path | Purpose | Task |
|---|---|---|
| `src/lib/cart-customer.ts` | Pure: derive effective customer from session + BE owner | 1 |
| `src/lib/order-breakdown.ts` | Pure: 6-line breakdown with BE-stale detection | 2 |
| `src/hooks/use-voucher-derived-items.ts` | Hook: voucherItems + cart + display + subtotal | 3 |
| `src/hooks/use-pending-submitted-totals.ts` | Hook: pendingDisplay + pendingTotals + submittedTotal + grandTotal | 4 |
| `src/hooks/use-session-reconciliation.ts` | Hook: effect that reconciles session ↔ BE order | 5 |
| `src/app/system/menu/components/admin-cart-header.tsx` | Component: table name + transfer + assist banner | 6 |
| `src/app/system/menu/components/admin-cart-confirm-submit-dialog.tsx` | Component: confirm pending items dialog | 7 |
| `src/app/system/menu/components/admin-cart-breakdown-panel.tsx` | Component: 6-line totals panel JSX | 8 |
| `src/app/system/menu/components/admin-cart-info-tab.tsx` | Component: customer + voucher tab content | 9 |
| `src/app/system/menu/components/admin-cart-pending-items-list.tsx` | Component: pending items list + CustomPriceCard | 10 |

### Test files

| Path | Task |
|---|---|
| `src/tests/lib/cart-customer.test.ts` | 1 |
| `src/tests/lib/order-breakdown.test.ts` | 2 |
| `src/tests/hooks/use-voucher-derived-items.test.tsx` | 3 |
| `src/tests/hooks/use-pending-submitted-totals.test.tsx` | 4 |
| `src/tests/hooks/use-session-reconciliation.test.tsx` | 5 |
| `src/tests/components/admin/admin-cart-header.test.tsx` | 6 |
| `src/tests/components/admin/admin-cart-confirm-submit-dialog.test.tsx` | 7 |
| `src/tests/components/admin/admin-cart-breakdown-panel.test.tsx` | 8 |
| `src/tests/components/admin/admin-cart-info-tab.test.tsx` | 9 |
| `src/tests/components/admin/admin-cart-pending-items-list.test.tsx` | 10 |

### Modified

- `src/app/system/menu/components/admin-cart-content.tsx` — replace inline blocks with imports across every task. Final ≤ 650 lines.

---

## PHASE 1 — Pure functions

### Task 1: Extract `deriveSessionCustomer`

**Files:**
- Create: `src/lib/cart-customer.ts`
- Create: `src/tests/lib/cart-customer.test.ts`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (replace `sessionCustomer` useMemo body at lines ~351–369 with a single function call)

**Interfaces:**
- Consumes: none
- Produces:
  ```ts
  export function deriveSessionCustomer(
    sessionCustomer: TableCustomer | null | undefined,
    fullOrderOwner: BEOrderOwner | null | undefined,
  ): TableCustomer | null

  interface BEOrderOwner {
    slug: string
    firstName?: string
    lastName?: string
    phonenumber?: string
    role?: { name?: string }
  }
  ```

- [ ] **Step 1: Write failing tests**

Create `src/tests/lib/cart-customer.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveSessionCustomer } from '@/lib/cart-customer'
import { Role } from '@/constants'

const customerOwner = {
  slug: 'u1',
  firstName: 'Jane',
  lastName: 'Doe',
  phonenumber: '0900000000',
  role: { name: Role.CUSTOMER },
}

describe('deriveSessionCustomer', () => {
  it('returns null when session has no customer and no owner', () => {
    expect(deriveSessionCustomer(null, null)).toBe(null)
    expect(deriveSessionCustomer(undefined, undefined)).toBe(null)
  })

  it('returns session.customer when present (FE wins)', () => {
    const session = { slug: 's1', firstName: 'A', lastName: 'B', phonenumber: '1' }
    expect(deriveSessionCustomer(session, customerOwner)).toBe(session)
  })

  it('returns owner mapped when role is CUSTOMER and phone not default', () => {
    expect(deriveSessionCustomer(null, customerOwner)).toEqual({
      slug: 'u1',
      firstName: 'Jane',
      lastName: 'Doe',
      phonenumber: '0900000000',
    })
  })

  it('returns null when owner role is not CUSTOMER', () => {
    const staff = { ...customerOwner, role: { name: Role.STAFF } }
    expect(deriveSessionCustomer(null, staff)).toBe(null)
  })

  it('returns null when phonenumber is default-customer placeholder', () => {
    const placeholder = { ...customerOwner, phonenumber: 'default-customer' }
    expect(deriveSessionCustomer(null, placeholder)).toBe(null)
  })

  it('handles missing firstName/lastName/phonenumber with empty strings', () => {
    const sparse = { slug: 'u2', role: { name: Role.CUSTOMER }, phonenumber: '1' }
    expect(deriveSessionCustomer(null, sparse)).toEqual({
      slug: 'u2',
      firstName: '',
      lastName: '',
      phonenumber: '1',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/lib/cart-customer.test.ts`
Expected: FAIL — `Cannot find module '@/lib/cart-customer'`.

- [ ] **Step 3: Implement**

Create `src/lib/cart-customer.ts`:

```ts
import { Role } from '@/constants'
import type { TableCustomer } from '@/types/session'

interface BEOrderOwner {
  slug: string
  firstName?: string
  lastName?: string
  phonenumber?: string
  role?: { name?: string }
}

/**
 * Resolve the customer to show in the cashier UI.
 *
 * Priority: session.customer (FE pick) wins over BE order.owner. BE owner is
 * accepted as fallback only when it represents a real customer account
 * (role === CUSTOMER and phonenumber is not the `default-customer` placeholder).
 * Staff/admin owners → null so the cashier sees "no customer picked".
 */
export function deriveSessionCustomer(
  sessionCustomer: TableCustomer | null | undefined,
  fullOrderOwner: BEOrderOwner | null | undefined,
): TableCustomer | null {
  if (sessionCustomer) return sessionCustomer
  const owner = fullOrderOwner
  if (!owner) return null
  const isCustomerOwner =
    owner.role?.name === Role.CUSTOMER &&
    owner.phonenumber !== 'default-customer'
  if (!isCustomerOwner) return null
  return {
    slug: owner.slug,
    firstName: owner.firstName ?? '',
    lastName: owner.lastName ?? '',
    phonenumber: owner.phonenumber ?? '',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/lib/cart-customer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Find the existing `sessionCustomer` useMemo (lines ~351–369):

```tsx
// BEFORE
const sessionCustomer = useMemo(() => {
  if (session?.customer) return session.customer
  const owner = fullOrderData?.owner
  if (!owner) return null
  const isCustomerOwner =
    owner.role?.name === Role.CUSTOMER &&
    owner.phonenumber !== 'default-customer'
  if (!isCustomerOwner) return null
  return {
    slug: owner.slug,
    firstName: owner.firstName ?? '',
    lastName: owner.lastName ?? '',
    phonenumber: owner.phonenumber ?? '',
  } satisfies TableCustomer
}, [session?.customer, fullOrderData?.owner])
```

Replace with:

```tsx
// AFTER
const sessionCustomer = useMemo(
  () => deriveSessionCustomer(session?.customer, fullOrderData?.owner),
  [session?.customer, fullOrderData?.owner],
)
```

Add at top of file:

```ts
import { deriveSessionCustomer } from '@/lib/cart-customer'
```

If `Role` import is now unused in this file (it was added for the inline role check), remove it from the constants import block.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```
Expected: all clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cart-customer.ts src/tests/lib/cart-customer.test.ts src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract deriveSessionCustomer to lib"
```

---

### Task 2: Extract `computeOrderBreakdown`

**Files:**
- Create: `src/lib/order-breakdown.ts`
- Create: `src/tests/lib/order-breakdown.test.ts`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (replace the `breakdown` useMemo body at lines ~492–649 with a single function call)

**Interfaces:**
- Consumes: none
- Produces:
  ```ts
  export interface PendingFallback {
    subTotalBeforeDiscount: number
    promotionDiscount: number
    finalTotal: number
  }
  export interface OrderBreakdown {
    tongTienHang: number
    promotionDiscount: number
    voucherDiscount: number
    preVatTotal: number
    vatAmount: number
    total: number
    isPromoDroppedByVoucher: boolean
    vatRateLabel: string
    voucherCode: string | null
  }
  export function computeOrderBreakdown(
    serverActiveOrder: IOrder | null | undefined,
    sessionVoucher: IVoucher | null,
    pendingFallback: PendingFallback,
  ): OrderBreakdown
  ```

- [ ] **Step 1: Write failing tests**

Create `src/tests/lib/order-breakdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeOrderBreakdown } from '@/lib/order-breakdown'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import type { IOrder, IVoucher } from '@/types'

const pendingFallback = {
  subTotalBeforeDiscount: 0,
  promotionDiscount: 0,
  finalTotal: 0,
}

function makeOrder(over: Partial<IOrder> = {}): IOrder {
  return {
    orderItems: [],
    voucher: null,
    subtotal: 0,
    originalSubtotal: 0,
    ...over,
  } as unknown as IOrder
}

function makeItem(over: Record<string, unknown>) {
  return {
    quantity: 1,
    variant: {
      slug: 'v1',
      price: 50000,
      product: { slug: 'p1', name: 'BBQ', vatRate: 10 },
    },
    promotion: null,
    vatRate: 10,
    vatValue: 0,
    isAppliedPromotion: false,
    ...over,
  }
}

describe('computeOrderBreakdown — pending fallback', () => {
  it('uses pendingFallback when no BE items', () => {
    const result = computeOrderBreakdown(null, null, {
      subTotalBeforeDiscount: 50000,
      promotionDiscount: 5000,
      finalTotal: 45000,
    })
    expect(result.tongTienHang).toBe(50000)
    expect(result.promotionDiscount).toBe(5000)
    expect(result.total).toBe(45000)
    expect(result.voucherCode).toBe(null)
  })
})

describe('computeOrderBreakdown — BE-authoritative path', () => {
  it('uses BE subtotal when slugs match and subtotal looks healthy', () => {
    const voucher = { slug: 'v1', code: 'V1' } as unknown as IVoucher
    const order = makeOrder({
      orderItems: [
        makeItem({
          isAppliedPromotion: true,
          promotion: { slug: 'pr1', value: 15 },
          vatValue: 3400,
        }),
      ],
      voucher: voucher as unknown as IOrder['voucher'],
      subtotal: 37400,
      originalSubtotal: 50000,
    })
    const result = computeOrderBreakdown(order, voucher, pendingFallback)
    expect(result.total).toBe(37400)
    expect(result.tongTienHang).toBe(50000)
    expect(result.promotionDiscount).toBe(7500)
    expect(result.voucherCode).toBe('V1')
  })

  it('falls back to originalSubtotal when subtotal=0 (custom-price case)', () => {
    const order = makeOrder({
      orderItems: [makeItem({ vatValue: 0 })],
      subtotal: 0,
      originalSubtotal: 42000,
    })
    expect(computeOrderBreakdown(order, null, pendingFallback).total).toBe(42000)
  })
})

describe('computeOrderBreakdown — FE fallback on stale BE', () => {
  it('uses FE expected total when sessionVoucher is null but BE subtotal still has voucher discount baked in', () => {
    // 1 item, originalPrice 50000, promotion 15%, vatRate 10%, no voucher.
    // Expected: (50000 - 7500) * 1.10 = 46750.
    // BE subtotal=37400 (stale, had voucher discount). BE voucher=null already (onMutate patched).
    const order = makeOrder({
      orderItems: [
        makeItem({
          isAppliedPromotion: true,
          promotion: { slug: 'pr1', value: 15 },
          vatValue: 3400, // stale VAT too
        }),
      ],
      voucher: null,
      subtotal: 37400,
      originalSubtotal: 50000,
    })
    const result = computeOrderBreakdown(order, null, pendingFallback)
    expect(result.total).toBe(46750)
    expect(result.voucherDiscount).toBe(0)
  })

  it('keeps BE subtotal when stale-detection threshold not exceeded (within 1đ)', () => {
    const order = makeOrder({
      orderItems: [
        makeItem({
          isAppliedPromotion: true,
          promotion: { slug: 'pr1', value: 15 },
          vatValue: 4250,
        }),
      ],
      voucher: null,
      subtotal: 46750,
      originalSubtotal: 50000,
    })
    expect(computeOrderBreakdown(order, null, pendingFallback).total).toBe(46750)
  })
})

describe('computeOrderBreakdown — promotion dropped by voucher', () => {
  it('drops promotion on eligible items for AT_LEAST_ONE_REQUIRED voucher', () => {
    const voucher = {
      slug: 'v1',
      code: 'V1',
      applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
      type: VOUCHER_TYPE.FIXED_VALUE,
      voucherProducts: [{ product: { slug: 'p1' } }],
    } as unknown as IVoucher
    const order = makeOrder({
      orderItems: [
        makeItem({
          isAppliedPromotion: true,
          promotion: { slug: 'pr1', value: 15 },
          vatValue: 4250,
        }),
      ],
      voucher: voucher as unknown as IOrder['voucher'],
      subtotal: 46750,
      originalSubtotal: 50000,
    })
    const result = computeOrderBreakdown(order, voucher, pendingFallback)
    expect(result.promotionDiscount).toBe(0)
    expect(result.isPromoDroppedByVoucher).toBe(true)
  })
})

describe('computeOrderBreakdown — VAT rate label', () => {
  it('shows single rate when all items share the rate', () => {
    const order = makeOrder({
      orderItems: [makeItem({ vatRate: 10 }), makeItem({ vatRate: 10 })],
      subtotal: 100000,
    })
    expect(computeOrderBreakdown(order, null, pendingFallback).vatRateLabel).toBe('VAT (10%)')
  })

  it('shows generic VAT label when rates differ', () => {
    const order = makeOrder({
      orderItems: [makeItem({ vatRate: 10 }), makeItem({ vatRate: 5 })],
      subtotal: 100000,
    })
    expect(computeOrderBreakdown(order, null, pendingFallback).vatRateLabel).toBe('VAT')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/lib/order-breakdown.test.ts`
Expected: FAIL — `Cannot find module '@/lib/order-breakdown'`.

- [ ] **Step 3: Implement — extract VERBATIM from admin-cart-content.tsx:492–649**

Create `src/lib/order-breakdown.ts`. The body is the existing `breakdown` useMemo factor inlined into a pure function — including the (c) optimization for BE-stale detection. Copy the logic verbatim, change only function signature.

```ts
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import type { IOrder, IVoucher } from '@/types'

export interface PendingFallback {
  subTotalBeforeDiscount: number
  promotionDiscount: number
  finalTotal: number
}

export interface OrderBreakdown {
  tongTienHang: number
  promotionDiscount: number
  voucherDiscount: number
  preVatTotal: number
  vatAmount: number
  total: number
  isPromoDroppedByVoucher: boolean
  vatRateLabel: string
  voucherCode: string | null
}

/**
 * 6-line breakdown shown in the admin "Sửa đơn" totals panel.
 *
 * Uses BE-authoritative subtotal when serverActiveOrder is loaded and BE state
 * is aligned with sessionVoucher. Otherwise computes FE expected total to
 * eliminate the ~500ms lag/jump that occurs while BE refetches after an
 * apply/remove/auto-remove of voucher.
 *
 * Stale-detection signals:
 *  - Slug mismatch (sessionVoucher.slug !== serverActiveOrder.voucher.slug):
 *    user just applied/removed; BE subtotal is stale.
 *  - Both null but BE subtotal differs >1đ from expectedTotalNoVoucher:
 *    auto-remove case where onMutate patched voucher field but subtotal
 *    has not refetched yet.
 *
 * For the apply case (sessionVoucher set, slug mismatch), we still trust BE
 * because computing FE voucher math for arbitrary voucher types is risky.
 * The brief flash before BE catches up is acceptable.
 */
export function computeOrderBreakdown(
  serverActiveOrder: IOrder | null | undefined,
  sessionVoucher: IVoucher | null,
  pendingFallback: PendingFallback,
): OrderBreakdown {
  const beItems = serverActiveOrder?.orderItems ?? []
  const beVoucher = serverActiveOrder?.voucher ?? null

  if (beItems.length > 0) {
    const tongTienHang = beItems.reduce(
      (s, it) => s + (it.variant?.price ?? 0) * it.quantity,
      0,
    )
    const beVatAmount = beItems.reduce(
      (s, it) => s + ((it as { vatValue?: number }).vatValue ?? 0),
      0,
    )

    const voucherAllowedSlugs =
      beVoucher?.voucherProducts?.map((vp) => vp.product?.slug) ?? []
    const voucherDropsPromotion =
      beVoucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT ||
      beVoucher?.applicabilityRule ===
        APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED

    const promotionDiscount = beItems.reduce((sum, it) => {
      const applied =
        (it as { isAppliedPromotion?: boolean }).isAppliedPromotion ??
        !!it.promotion
      if (!applied || !it.promotion) return sum
      if (voucherDropsPromotion) {
        const productSlug = it.variant?.product?.slug
        if (productSlug && voucherAllowedSlugs.includes(productSlug)) {
          return sum
        }
      }
      const unitDiscount =
        ((it.variant?.price ?? 0) * (it.promotion.value ?? 0)) / 100
      return sum + Math.round(unitDiscount * it.quantity)
    }, 0)

    const expectedTotalNoVoucher = beItems.reduce((sum, it) => {
      const originalPrice = it.variant?.price ?? 0
      const quantity = it.quantity ?? 0
      const vatRate =
        (it as { vatRate?: number }).vatRate ??
        it.variant?.product?.vatRate ??
        0
      const itemOriginal = originalPrice * quantity
      const applied =
        (it as { isAppliedPromotion?: boolean }).isAppliedPromotion ??
        !!it.promotion
      let itemPromo = 0
      if (applied && it.promotion) {
        itemPromo = Math.round(
          (originalPrice * (it.promotion.value ?? 0) * quantity) / 100,
        )
      }
      const preVAT = itemOriginal - itemPromo
      const vatVal = Math.round((preVAT * vatRate) / 100)
      return sum + preVAT + vatVal
    }, 0)

    let beTotal = 0
    if (
      typeof serverActiveOrder?.subtotal === 'number' &&
      serverActiveOrder.subtotal > 0
    ) {
      beTotal = serverActiveOrder.subtotal
    } else if (
      typeof serverActiveOrder?.originalSubtotal === 'number' &&
      serverActiveOrder.originalSubtotal > 0
    ) {
      beTotal = serverActiveOrder.originalSubtotal
    }

    const localSlug = sessionVoucher?.slug ?? null
    const beSlug = beVoucher?.slug ?? null
    const slugMismatch = localSlug !== beSlug
    const beStaleOnNoVoucher =
      !slugMismatch &&
      localSlug === null &&
      beTotal > 0 &&
      Math.abs(beTotal - expectedTotalNoVoucher) > 1

    let total = beTotal
    let vatAmount = beVatAmount
    if (slugMismatch || beStaleOnNoVoucher) {
      if (sessionVoucher === null) {
        total = expectedTotalNoVoucher
        const newPreVAT = tongTienHang - promotionDiscount
        vatAmount = Math.max(0, expectedTotalNoVoucher - newPreVAT)
      }
    }

    const voucherDiscount = beVoucher
      ? Math.max(0, tongTienHang - promotionDiscount + vatAmount - total)
      : 0
    const preVatTotal = Math.max(0, total - vatAmount)

    const hasItemsWithPromotion = beItems.some(
      (it) => (it.promotion?.value ?? 0) > 0,
    )
    const isPromoDroppedByVoucher =
      hasItemsWithPromotion &&
      voucherDropsPromotion &&
      promotionDiscount === 0

    const vatRates = beItems
      .map(
        (it) =>
          (it as { vatRate?: number }).vatRate ??
          it.variant?.product?.vatRate ??
          0,
      )
      .filter((r) => r > 0)
    const uniqueRates = [...new Set(vatRates)]
    const vatRateLabel =
      uniqueRates.length === 1 ? `VAT (${uniqueRates[0]}%)` : 'VAT'

    return {
      tongTienHang,
      promotionDiscount,
      voucherDiscount,
      preVatTotal,
      vatAmount,
      total,
      isPromoDroppedByVoucher,
      vatRateLabel,
      voucherCode: beVoucher?.code ?? null,
    }
  }

  return {
    tongTienHang: pendingFallback.subTotalBeforeDiscount,
    promotionDiscount: pendingFallback.promotionDiscount,
    voucherDiscount: Math.max(
      0,
      pendingFallback.subTotalBeforeDiscount -
        pendingFallback.promotionDiscount -
        pendingFallback.finalTotal,
    ),
    preVatTotal: pendingFallback.finalTotal,
    vatAmount: 0,
    total: pendingFallback.finalTotal,
    isPromoDroppedByVoucher: false,
    vatRateLabel: 'VAT',
    voucherCode: sessionVoucher?.code ?? null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/lib/order-breakdown.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Replace the `breakdown` useMemo (lines ~492–649) with:

```tsx
const breakdown = useMemo(
  () =>
    computeOrderBreakdown(serverActiveOrder, sessionVoucher, {
      subTotalBeforeDiscount: pendingTotals.subTotalBeforeDiscount,
      promotionDiscount: pendingTotals.promotionDiscount,
      finalTotal: pendingTotals.finalTotal,
    }),
  [serverActiveOrder, sessionVoucher, pendingTotals],
)
```

Add at top of file:

```ts
import { computeOrderBreakdown } from '@/lib/order-breakdown'
```

Remove now-unused imports if any (e.g., `APPLICABILITY_RULE`, `VOUCHER_TYPE` if no other use site in the file — check with grep before removing).

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/order-breakdown.ts src/tests/lib/order-breakdown.test.ts src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract computeOrderBreakdown to lib"
```

---

## PHASE 2 — Custom hooks

### Task 3: Extract `useVoucherDerivedItems`

**Files:**
- Create: `src/hooks/use-voucher-derived-items.ts`
- Create: `src/tests/hooks/use-voucher-derived-items.test.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (lines ~371–407 collapse to one hook call)

**Interfaces:**
- Consumes: `staffItemsToCartItem`, `calculateCartItemDisplay`, `calculateCartTotals` from existing libs
- Produces:
  ```ts
  interface VoucherItemInput {
    menuItemId: string
    productSlug?: string
    quantity: number
  }
  interface VoucherDerived {
    allVoucherItems: VoucherItemInput[]
    voucherCart: ReturnType<typeof staffItemsToCartItem>
    voucherDisplay: ReturnType<typeof calculateCartItemDisplay>
    voucherSubtotal: ReturnType<typeof calculateCartTotals>
  }
  export function useVoucherDerivedItems(
    allItems: OrderItem[],
    pending: OrderItem[],
  ): VoucherDerived
  ```

- [ ] **Step 1: Write failing test**

Create `src/tests/hooks/use-voucher-derived-items.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVoucherDerivedItems } from '@/hooks/use-voucher-derived-items'
import type { OrderItem } from '@/types/session'

const item: OrderItem = {
  menuItemId: 'p1',
  productSlug: 'p1',
  name: 'BBQ',
  priceNum: 50000,
  originalPrice: 50000,
  price: '50,000đ',
  quantity: 1,
  variantSlug: 'v1',
  note: '',
  promotion: null,
} as OrderItem

describe('useVoucherDerivedItems', () => {
  it('returns merged voucher items + cart + display + subtotal', () => {
    const { result } = renderHook(() => useVoucherDerivedItems([item], [item]))
    expect(result.current.allVoucherItems).toHaveLength(2)
    expect(result.current.allVoucherItems[0]).toMatchObject({
      menuItemId: 'p1',
      productSlug: 'p1',
      quantity: 1,
    })
    expect(result.current.voucherSubtotal.subTotalBeforeDiscount).toBeGreaterThan(0)
  })

  it('keeps stable references across rerenders with same input', () => {
    const { result, rerender } = renderHook(
      ({ all, pen }) => useVoucherDerivedItems(all, pen),
      { initialProps: { all: [item], pen: [item] } },
    )
    const first = result.current.allVoucherItems
    rerender({ all: [item], pen: [item] })
    expect(result.current.allVoucherItems).toBe(first)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/hooks/use-voucher-derived-items.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/hooks/use-voucher-derived-items.ts`:

```ts
import { useMemo } from 'react'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import type { OrderItem } from '@/types/session'

interface VoucherItemInput {
  menuItemId: string
  productSlug?: string
  quantity: number
}

export interface VoucherDerived {
  allVoucherItems: VoucherItemInput[]
  voucherCart: ReturnType<typeof staffItemsToCartItem>
  voucherDisplay: ReturnType<typeof calculateCartItemDisplay>
  voucherSubtotal: ReturnType<typeof calculateCartTotals>
}

/**
 * Derive the voucher-validation-friendly item list + cart + display + totals.
 *
 * Inputs are the "all current items" array (allItems = submitted + pending)
 * and the "pending" array on its own. Both are mapped down to a narrow
 * {menuItemId, productSlug, quantity} shape and concatenated — this matches
 * the pre-refactor `allVoucherItems` semantic (pending counted twice
 * intentionally: once via allItems, once via pending — see admin-cart history).
 *
 * The returned `voucherSubtotal` is voucher-less (passed null) and is used
 * downstream as the `subtotalAfterPromotion` input to `useVoucherState`.
 */
export function useVoucherDerivedItems(
  allItems: OrderItem[],
  pending: OrderItem[],
): VoucherDerived {
  const voucherItems = useMemo<VoucherItemInput[]>(
    () =>
      allItems.map((i) => ({
        menuItemId: i.menuItemId,
        productSlug: i.productSlug,
        quantity: i.quantity,
      })),
    [allItems],
  )
  const pendingForVoucher = useMemo<VoucherItemInput[]>(
    () =>
      pending.map((i) => ({
        menuItemId: i.menuItemId,
        productSlug: i.productSlug,
        quantity: i.quantity,
      })),
    [pending],
  )
  const allVoucherItems = useMemo(
    () => [...voucherItems, ...pendingForVoucher],
    [voucherItems, pendingForVoucher],
  )
  const voucherCart = useMemo(
    () => staffItemsToCartItem(allVoucherItems as unknown as OrderItem[]),
    [allVoucherItems],
  )
  const voucherDisplay = useMemo(
    () => calculateCartItemDisplay(voucherCart, null),
    [voucherCart],
  )
  const voucherSubtotal = useMemo(
    () => calculateCartTotals(voucherDisplay, null),
    [voucherDisplay],
  )

  return { allVoucherItems, voucherCart, voucherDisplay, voucherSubtotal }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/hooks/use-voucher-derived-items.test.tsx`
Expected: PASS.

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Replace lines ~371–407 (`voucherItems`, `pendingForVoucher`, `allVoucherItems`, `voucherCart`, `voucherDisplay`, `voucherSubtotal` declarations) with:

```tsx
const { allVoucherItems, voucherSubtotal } = useVoucherDerivedItems(allItems, pending)
```

Add at top of file:

```ts
import { useVoucherDerivedItems } from '@/hooks/use-voucher-derived-items'
```

Remove now-unused imports: `staffItemsToCartItem` if no longer used at top level (it IS still used elsewhere — `calculateCartItemDisplay`, `calculateCartTotals` are still used by `pendingDisplay`, `pendingTotals`, `submittedTotal`). Verify with grep before removing.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-voucher-derived-items.ts src/tests/hooks/use-voucher-derived-items.test.tsx src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract useVoucherDerivedItems hook"
```

---

### Task 4: Extract `usePendingSubmittedTotals`

**Files:**
- Create: `src/hooks/use-pending-submitted-totals.ts`
- Create: `src/tests/hooks/use-pending-submitted-totals.test.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (lines ~463–488 collapse to one hook call)

**Interfaces:**
- Consumes: `staffItemsToCartItem`, `calculateCartItemDisplay`, `calculateCartTotals`
- Produces:
  ```ts
  interface PendingSubmittedTotals {
    pendingDisplay: ReturnType<typeof calculateCartItemDisplay>
    pendingTotals: ReturnType<typeof calculateCartTotals>
    submittedTotal: number
    grandTotal: number
  }
  export function usePendingSubmittedTotals(
    pending: OrderItem[],
    submittedOrders: SubmittedOrder[],
    sessionVoucher: IVoucher | null,
  ): PendingSubmittedTotals
  ```

- [ ] **Step 1: Write failing test**

Create `src/tests/hooks/use-pending-submitted-totals.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePendingSubmittedTotals } from '@/hooks/use-pending-submitted-totals'
import type { OrderItem, SubmittedOrder } from '@/types/session'

const item: OrderItem = {
  menuItemId: 'p1',
  productSlug: 'p1',
  name: 'BBQ',
  priceNum: 50000,
  originalPrice: 50000,
  price: '50,000đ',
  quantity: 1,
  variantSlug: 'v1',
  note: '',
  promotion: null,
} as OrderItem

const submitted: SubmittedOrder = {
  orderSlug: 'o1',
  items: [item],
  createdAt: new Date().toISOString(),
} as SubmittedOrder

describe('usePendingSubmittedTotals', () => {
  it('computes pendingTotals, submittedTotal, grandTotal', () => {
    const { result } = renderHook(() =>
      usePendingSubmittedTotals([item], [submitted], null),
    )
    expect(result.current.pendingTotals.finalTotal).toBeGreaterThan(0)
    expect(result.current.submittedTotal).toBeGreaterThan(0)
    expect(result.current.grandTotal).toBe(
      result.current.pendingTotals.finalTotal + result.current.submittedTotal,
    )
  })

  it('passes voucher to pending but not submitted', () => {
    const voucher = { slug: 'v', code: 'V', value: 20, type: 'percent_order' } as never
    const { result: withV } = renderHook(() =>
      usePendingSubmittedTotals([item], [submitted], voucher),
    )
    const { result: noV } = renderHook(() =>
      usePendingSubmittedTotals([item], [submitted], null),
    )
    expect(withV.current.pendingTotals.finalTotal).toBeLessThan(
      noV.current.pendingTotals.finalTotal,
    )
    expect(withV.current.submittedTotal).toBe(noV.current.submittedTotal)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/hooks/use-pending-submitted-totals.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/hooks/use-pending-submitted-totals.ts`:

```ts
import { useMemo } from 'react'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import type { IVoucher } from '@/types'
import type { OrderItem, SubmittedOrder } from '@/types/session'

export interface PendingSubmittedTotals {
  pendingDisplay: ReturnType<typeof calculateCartItemDisplay>
  pendingTotals: ReturnType<typeof calculateCartTotals>
  submittedTotal: number
  grandTotal: number
}

/**
 * Compute totals for pending + already-submitted orders.
 *
 * - pending: promotion-aware + voucher-aware (sessionVoucher is passed in
 *   so the voucher discount reflects in the user-visible "Tổng tiền hàng".
 * - submitted: NOT voucher-aware — voucher is applied at the BE payment step.
 *   Passing voucher here would double-discount.
 * - grandTotal: simple sum used by the action-button gate.
 */
export function usePendingSubmittedTotals(
  pending: OrderItem[],
  submittedOrders: SubmittedOrder[],
  sessionVoucher: IVoucher | null,
): PendingSubmittedTotals {
  const pendingDisplay = useMemo(
    () =>
      calculateCartItemDisplay(staffItemsToCartItem(pending), sessionVoucher),
    [pending, sessionVoucher],
  )
  const pendingTotals = useMemo(
    () => calculateCartTotals(pendingDisplay, sessionVoucher),
    [pendingDisplay, sessionVoucher],
  )
  const submittedTotal = useMemo(
    () =>
      submittedOrders.reduce((s, o) => {
        const display = calculateCartItemDisplay(
          staffItemsToCartItem(o.items),
          null,
        )
        return s + calculateCartTotals(display, null).finalTotal
      }, 0),
    [submittedOrders],
  )
  const grandTotal = pendingTotals.finalTotal + submittedTotal

  return { pendingDisplay, pendingTotals, submittedTotal, grandTotal }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/hooks/use-pending-submitted-totals.test.tsx`
Expected: PASS.

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Replace lines ~463–488 (`pendingDisplay`, `pendingTotals`, `submittedTotal`, `grandTotal` declarations) with:

```tsx
const { pendingTotals, submittedTotal, grandTotal } = usePendingSubmittedTotals(
  pending,
  session?.submittedOrders ?? [],
  sessionVoucher,
)
```

Add import:

```ts
import { usePendingSubmittedTotals } from '@/hooks/use-pending-submitted-totals'
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-pending-submitted-totals.ts src/tests/hooks/use-pending-submitted-totals.test.tsx src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract usePendingSubmittedTotals hook"
```

---

### Task 5: Extract `useSessionReconciliation`

**Files:**
- Create: `src/hooks/use-session-reconciliation.ts`
- Create: `src/tests/hooks/use-session-reconciliation.test.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (lines ~225–307 collapse to one hook call)

**Interfaces:**
- Consumes: `computeSessionReconciliation` from `@/lib/staff-orders`, store actions (`setOrderSlug`, `replaceSubmittedOrders`, `cancelSession`, `clearPendingItems`)
- Produces:
  ```ts
  export function useSessionReconciliation(input: {
    tableSlug: string
    session: TableSession | null | undefined
    serverActiveOrder: IOrder | null | undefined
    setOrderSlug: (tableSlug: string, slug: string) => void
    replaceSubmittedOrders: (tableSlug: string, orders: SubmittedOrder[]) => void
    cancelSession: (tableSlug: string) => void
    clearPendingItems: (tableSlug: string) => void
  }): void
  ```

- [ ] **Step 1: Write failing test**

Create `src/tests/hooks/use-session-reconciliation.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSessionReconciliation } from '@/hooks/use-session-reconciliation'

describe('useSessionReconciliation', () => {
  it('does not call any store action when serverActiveOrder is null', () => {
    const actions = {
      setOrderSlug: vi.fn(),
      replaceSubmittedOrders: vi.fn(),
      cancelSession: vi.fn(),
      clearPendingItems: vi.fn(),
    }
    renderHook(() =>
      useSessionReconciliation({
        tableSlug: 't1',
        session: { orderSlug: null, submittedOrders: [], pendingItems: [] } as never,
        serverActiveOrder: null,
        ...actions,
      }),
    )
    expect(actions.setOrderSlug).not.toHaveBeenCalled()
    expect(actions.replaceSubmittedOrders).not.toHaveBeenCalled()
    expect(actions.cancelSession).not.toHaveBeenCalled()
    expect(actions.clearPendingItems).not.toHaveBeenCalled()
  })

  it('does not run when tableSlug is empty', () => {
    const actions = {
      setOrderSlug: vi.fn(),
      replaceSubmittedOrders: vi.fn(),
      cancelSession: vi.fn(),
      clearPendingItems: vi.fn(),
    }
    renderHook(() =>
      useSessionReconciliation({
        tableSlug: '',
        session: null,
        serverActiveOrder: { slug: 'o1', orderItems: [] } as never,
        ...actions,
      }),
    )
    expect(actions.setOrderSlug).not.toHaveBeenCalled()
  })
})
```

> **Note for the implementer:** The reconciliation effect's full happy-path semantics (4-case switch hydrate/refresh/mismatch/clear, stale-query guards via `lastRefreshedServerRef`) are complex enough that comprehensive testing is out of scope for this extraction task — the goal is **mechanically lift the existing effect** preserving behavior, not retest the logic. Keep the smoke tests minimal; rely on the existing manual-test suite to verify reconciliation still works.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/hooks/use-session-reconciliation.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement — extract verbatim from admin-cart-content.tsx:225–307**

Create `src/hooks/use-session-reconciliation.ts`. The effect body is the existing reconciliation `useEffect` at lines ~242–307 of admin-cart-content.tsx, with input args plumbed through the hook signature. Also lift the `lastRefreshedServerRef` ref into the hook.

```ts
import { useEffect, useRef } from 'react'
import { computeSessionReconciliation } from '@/lib/staff-orders'
import type { IOrder } from '@/types'
import type { SubmittedOrder, TableSession } from '@/types/session'

interface SessionReconciliationInput {
  tableSlug: string
  session: TableSession | null | undefined
  serverActiveOrder: IOrder | null | undefined
  setOrderSlug: (tableSlug: string, slug: string) => void
  replaceSubmittedOrders: (tableSlug: string, orders: SubmittedOrder[]) => void
  cancelSession: (tableSlug: string) => void
  clearPendingItems: (tableSlug: string) => void
}

/**
 * Reconcile the in-memory session with the server-side active order.
 *
 * Mirrors the effect previously inlined in admin-cart-content.tsx
 * (and the equivalent in table-order-screen.tsx). Calls the pure helper
 * `computeSessionReconciliation` to decide which of 4 actions to take:
 *   - hydrate: session is empty, server has order → seed
 *   - refresh: session has orderSlug matching server → replace submitted
 *   - mismatch: session.orderSlug differs from server → cancel + reseed
 *   - clear: session has orderSlug but server has nothing → cancel
 *
 * `lastRefreshedServerRef` guards against acting on stale BE responses
 * (we only act when the response slug differs from the last one we acted on).
 */
export function useSessionReconciliation({
  tableSlug,
  session,
  serverActiveOrder,
  setOrderSlug,
  replaceSubmittedOrders,
  cancelSession,
  clearPendingItems,
}: SessionReconciliationInput): void {
  const lastRefreshedServerRef = useRef<string | null>(null)

  useEffect(() => {
    if (!tableSlug) return
    if (!session) return
    // EXTRACT the body of the existing `useEffect` at admin-cart-content.tsx:242–307
    // VERBATIM here. Replace references to local helpers/state with the
    // destructured inputs above. Preserve the 4-case switch, the stale-query
    // guard via lastRefreshedServerRef, the conditional toasts, and the order
    // of store mutations.
  }, [
    tableSlug,
    session?.orderSlug,
    session?.submittedOrders,
    session?.pendingItems,
    serverActiveOrder,
    setOrderSlug,
    replaceSubmittedOrders,
    cancelSession,
    clearPendingItems,
  ])
}
```

The implementer must copy the existing effect body verbatim (lines ~242–307 of the current admin-cart-content.tsx). The `// EXTRACT VERBATIM` comment marks where it goes. After extracting, the original effect block in admin-cart-content.tsx is removed entirely.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/hooks/use-session-reconciliation.test.tsx`
Expected: PASS (2 smoke tests).

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Remove the inline reconciliation `useEffect` (lines ~242–307) AND the `lastRefreshedServerRef` declaration (line ~230). Replace with:

```tsx
useSessionReconciliation({
  tableSlug,
  session,
  serverActiveOrder,
  setOrderSlug,
  replaceSubmittedOrders,
  cancelSession,
  clearPendingItems,
})
```

Add import:

```ts
import { useSessionReconciliation } from '@/hooks/use-session-reconciliation'
```

Remove now-unused imports (e.g., `useRef` if it's only used by this section — verify with grep; it's likely used elsewhere).

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-session-reconciliation.ts src/tests/hooks/use-session-reconciliation.test.tsx src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract useSessionReconciliation hook"
```

---

## PHASE 3 — Presentational components

### Task 6: Extract `<AdminCartHeader>`

**Files:**
- Create: `src/app/system/menu/components/admin-cart-header.tsx`
- Create: `src/tests/components/admin/admin-cart-header.test.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (lines ~826–874 collapse to one element)

**Interfaces:**
- Consumes: `TransferTableDialog`, `Table[]`
- Produces:
  ```ts
  interface AdminCartHeaderProps {
    tableName: string
    tableSlug: string
    tables: Table[]
    sessions: Record<string, TableSession>
    assistBannerVisible: boolean
    assistOrderSlug: string | null
    onTransfer: (newTable: Table) => void
    onDismissAssistBanner: () => void
  }
  export function AdminCartHeader(props: AdminCartHeaderProps): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/admin/admin-cart-header.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminCartHeader } from '@/app/system/menu/components/admin-cart-header'

vi.mock('@/components/staff/transfer-table-dialog', () => ({
  TransferTableDialog: () => <div data-testid="transfer-dialog" />,
}))

describe('AdminCartHeader', () => {
  it('renders table name', () => {
    render(
      <AdminCartHeader
        tableName="Bàn 1"
        tableSlug="t1"
        tables={[]}
        sessions={{}}
        assistBannerVisible={false}
        assistOrderSlug={null}
        onTransfer={vi.fn()}
        onDismissAssistBanner={vi.fn()}
      />,
    )
    expect(screen.getByText('Bàn 1')).toBeTruthy()
  })

  it('renders assist banner when visible', () => {
    render(
      <AdminCartHeader
        tableName="Bàn 1"
        tableSlug="t1"
        tables={[]}
        sessions={{}}
        assistBannerVisible={true}
        assistOrderSlug="o1"
        onTransfer={vi.fn()}
        onDismissAssistBanner={vi.fn()}
      />,
    )
    expect(screen.getByText(/o1/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components/admin/admin-cart-header.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/app/system/menu/components/admin-cart-header.tsx`. Extract the JSX block from admin-cart-content.tsx:826–874 verbatim, parameterize via props. Suggested skeleton:

```tsx
import { TransferTableDialog } from '@/components/staff/transfer-table-dialog'
import type { Table } from '@/data/staff-data'
import type { TableSession } from '@/types/session'

interface AdminCartHeaderProps {
  tableName: string
  tableSlug: string
  tables: Table[]
  sessions: Record<string, TableSession>
  assistBannerVisible: boolean
  assistOrderSlug: string | null
  onTransfer: (newTable: Table) => void
  onDismissAssistBanner: () => void
}

export function AdminCartHeader({
  tableName,
  tableSlug,
  tables,
  sessions,
  assistBannerVisible,
  assistOrderSlug,
  onTransfer,
  onDismissAssistBanner,
}: AdminCartHeaderProps) {
  return (
    <>
      {/* PASTE the header JSX from admin-cart-content.tsx:826–874 VERBATIM here.
          Replace the local references:
          - `session.tableName` → `tableName` (prop)
          - `tableSlug` → `tableSlug` (prop)
          - `tables` → `tables` (prop)
          - `sessions` → `sessions` (prop)
          - `handleTransferred` → `onTransfer` (prop)
          - `assistBannerVisible` → `assistBannerVisible` (prop)
          - `assistOrderSlug` → `assistOrderSlug` (prop)
          - `dismissAssistBanner` → `onDismissAssistBanner` (prop)
          Keep all Tailwind classes and inline conditionals intact. */}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/components/admin/admin-cart-header.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Replace the JSX block at lines ~826–874 with:

```tsx
<AdminCartHeader
  tableName={session.tableName}
  tableSlug={tableSlug}
  tables={tables}
  sessions={sessions}
  assistBannerVisible={assistBannerVisible}
  assistOrderSlug={assistOrderSlug}
  onTransfer={handleTransferred}
  onDismissAssistBanner={dismissAssistBanner}
/>
```

Add import:

```ts
import { AdminCartHeader } from '@/app/system/menu/components/admin-cart-header'
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/app/system/menu/components/admin-cart-header.tsx src/tests/components/admin/admin-cart-header.test.tsx src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract AdminCartHeader component"
```

---

### Task 7: Extract `<AdminCartConfirmSubmitDialog>`

**Files:**
- Create: `src/app/system/menu/components/admin-cart-confirm-submit-dialog.tsx`
- Create: `src/tests/components/admin/admin-cart-confirm-submit-dialog.test.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (lines ~1258–1300 collapse to one element)

**Interfaces:**
- Consumes: `Dialog`, `DialogClose`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `Button` from `@/components/ui`; `formatCurrency` from `@/utils`
- Produces:
  ```ts
  interface AdminCartConfirmSubmitDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    pendingItems: OrderItem[]
    pendingTotalFinal: number
    isSubmitting: boolean
    onConfirm: () => void | Promise<void>
  }
  export function AdminCartConfirmSubmitDialog(
    props: AdminCartConfirmSubmitDialogProps,
  ): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/admin/admin-cart-confirm-submit-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminCartConfirmSubmitDialog } from '@/app/system/menu/components/admin-cart-confirm-submit-dialog'
import type { OrderItem } from '@/types/session'

const item: OrderItem = {
  menuItemId: 'p1',
  name: 'BBQ',
  priceNum: 50000,
  quantity: 2,
} as OrderItem

describe('AdminCartConfirmSubmitDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AdminCartConfirmSubmitDialog
        open={false}
        onOpenChange={vi.fn()}
        pendingItems={[item]}
        pendingTotalFinal={100000}
        isSubmitting={false}
        onConfirm={vi.fn()}
      />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders item name and quantity when open', () => {
    render(
      <AdminCartConfirmSubmitDialog
        open={true}
        onOpenChange={vi.fn()}
        pendingItems={[item]}
        pendingTotalFinal={100000}
        isSubmitting={false}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByText('BBQ')).toBeTruthy()
    expect(screen.getByText(/2/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components/admin/admin-cart-confirm-submit-dialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement — extract verbatim from admin-cart-content.tsx:1258–1300**

Create `src/app/system/menu/components/admin-cart-confirm-submit-dialog.tsx`:

```tsx
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { formatCurrency } from '@/utils'
import { ButtonLoading } from '@/components/app/loading'
import type { OrderItem } from '@/types/session'

interface AdminCartConfirmSubmitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingItems: OrderItem[]
  pendingTotalFinal: number
  isSubmitting: boolean
  onConfirm: () => void | Promise<void>
}

export function AdminCartConfirmSubmitDialog({
  open,
  onOpenChange,
  pendingItems,
  pendingTotalFinal,
  isSubmitting,
  onConfirm,
}: AdminCartConfirmSubmitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* PASTE the <DialogContent>...</DialogContent> body from
          admin-cart-content.tsx:1258–1300 VERBATIM here. Replace local
          references:
          - `pending` → `pendingItems`
          - `pendingTotals.finalTotal` → `pendingTotalFinal`
          - `isSubmitting` → `isSubmitting`
          - `handleSubmitBatch` → `onConfirm` */}
    </Dialog>
  )
}
```

Confirm `ButtonLoading` is the right import path — check existing import in admin-cart-content.tsx and copy verbatim.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/components/admin/admin-cart-confirm-submit-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Replace lines ~1258–1300 with:

```tsx
<AdminCartConfirmSubmitDialog
  open={confirmOpen}
  onOpenChange={setConfirmOpen}
  pendingItems={pending}
  pendingTotalFinal={pendingTotals.finalTotal}
  isSubmitting={isSubmitting}
  onConfirm={handleSubmitBatch}
/>
```

Add import:

```ts
import { AdminCartConfirmSubmitDialog } from '@/app/system/menu/components/admin-cart-confirm-submit-dialog'
```

Remove now-unused `Dialog`, `DialogClose`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle` imports if no other call site uses them in this file. Verify with grep.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/app/system/menu/components/admin-cart-confirm-submit-dialog.tsx src/tests/components/admin/admin-cart-confirm-submit-dialog.test.tsx src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract AdminCartConfirmSubmitDialog component"
```

---

### Task 8: Extract `<AdminCartBreakdownPanel>`

**Files:**
- Create: `src/app/system/menu/components/admin-cart-breakdown-panel.tsx`
- Create: `src/tests/components/admin/admin-cart-breakdown-panel.test.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (lines ~1125–1215 collapse to one element)

**Interfaces:**
- Consumes: `OrderBreakdown` (from `@/lib/order-breakdown` Task 2), `formatCurrency`, Tooltip components
- Produces:
  ```ts
  interface AdminCartBreakdownPanelProps {
    breakdown: OrderBreakdown
  }
  export function AdminCartBreakdownPanel(
    props: AdminCartBreakdownPanelProps,
  ): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/admin/admin-cart-breakdown-panel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminCartBreakdownPanel } from '@/app/system/menu/components/admin-cart-breakdown-panel'

const baseBreakdown = {
  tongTienHang: 50000,
  promotionDiscount: 0,
  voucherDiscount: 0,
  preVatTotal: 50000,
  vatAmount: 0,
  total: 50000,
  isPromoDroppedByVoucher: false,
  vatRateLabel: 'VAT (10%)',
  voucherCode: null,
}

describe('AdminCartBreakdownPanel', () => {
  it('renders tongTienHang and total', () => {
    render(<AdminCartBreakdownPanel breakdown={baseBreakdown} />)
    expect(screen.getByText(/50/)).toBeTruthy()
  })

  it('shows voucher discount when voucherCode is set', () => {
    render(
      <AdminCartBreakdownPanel
        breakdown={{ ...baseBreakdown, voucherDiscount: 5000, voucherCode: 'V1' }}
      />,
    )
    expect(screen.getByText(/V1/)).toBeTruthy()
  })

  it('hides voucher row when voucherDiscount=0', () => {
    render(<AdminCartBreakdownPanel breakdown={baseBreakdown} />)
    expect(screen.queryByText(/voucher/i)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components/admin/admin-cart-breakdown-panel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement — extract verbatim from admin-cart-content.tsx:1125–1215**

Create `src/app/system/menu/components/admin-cart-breakdown-panel.tsx`:

```tsx
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { formatCurrency } from '@/utils'
import type { OrderBreakdown } from '@/lib/order-breakdown'

interface AdminCartBreakdownPanelProps {
  breakdown: OrderBreakdown
}

export function AdminCartBreakdownPanel({ breakdown }: AdminCartBreakdownPanelProps) {
  return (
    <>
      {/* PASTE the JSX from admin-cart-content.tsx:1125–1215 VERBATIM here.
          The only reference is `breakdown.*` — already a prop. No other
          state needed. Keep all class names, conditional renders, tooltip
          content (the "Khuyến mãi không áp dụng khi món đang dùng voucher"
          message) exactly as-is. */}
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/components/admin/admin-cart-breakdown-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Replace JSX at lines ~1125–1215 with:

```tsx
<AdminCartBreakdownPanel breakdown={breakdown} />
```

Add import:

```ts
import { AdminCartBreakdownPanel } from '@/app/system/menu/components/admin-cart-breakdown-panel'
```

Remove now-unused imports (`Info`, `Tooltip*`) from admin-cart-content.tsx if they have no other call site in this file. Verify with grep.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/app/system/menu/components/admin-cart-breakdown-panel.tsx src/tests/components/admin/admin-cart-breakdown-panel.test.tsx src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract AdminCartBreakdownPanel component"
```

---

### Task 9: Extract `<AdminCartInfoTab>`

**Files:**
- Create: `src/app/system/menu/components/admin-cart-info-tab.tsx`
- Create: `src/tests/components/admin/admin-cart-info-tab.test.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (lines ~1017–1049 collapse to one element)

**Interfaces:**
- Consumes: `StaffCustomerSearchInput`, `StaffTableVoucherSheet`
- Produces:
  ```ts
  interface AdminCartInfoTabProps {
    sessionCustomer: TableCustomer | null
    sessionVoucher: IVoucher | null
    pendingItems: OrderItem[]
    submittedItems: OrderItem[]
    onSelectCustomer: (c: TableCustomer) => void
    onClearCustomer: () => void
    onApplyVoucher: (v: IVoucher) => Promise<void>
    onRemoveVoucher: () => Promise<void>
  }
  export function AdminCartInfoTab(props: AdminCartInfoTabProps): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/admin/admin-cart-info-tab.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { AdminCartInfoTab } from '@/app/system/menu/components/admin-cart-info-tab'

vi.mock('@/components/staff/staff-customer-search-input', () => ({
  StaffCustomerSearchInput: ({ customer }: { customer: { phonenumber?: string } | null }) =>
    <div data-testid="customer-search">{customer?.phonenumber ?? 'empty'}</div>,
}))
vi.mock('@/components/staff/staff-table-voucher-sheet', () => ({
  StaffTableVoucherSheet: () => <div data-testid="voucher-sheet" />,
}))

describe('AdminCartInfoTab', () => {
  it('renders both customer search and voucher sheet', () => {
    const { getByTestId } = render(
      <AdminCartInfoTab
        sessionCustomer={null}
        sessionVoucher={null}
        pendingItems={[]}
        submittedItems={[]}
        onSelectCustomer={vi.fn()}
        onClearCustomer={vi.fn()}
        onApplyVoucher={vi.fn()}
        onRemoveVoucher={vi.fn()}
      />,
    )
    expect(getByTestId('customer-search')).toBeTruthy()
    expect(getByTestId('voucher-sheet')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components/admin/admin-cart-info-tab.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement — extract verbatim from admin-cart-content.tsx:1017–1049**

Create `src/app/system/menu/components/admin-cart-info-tab.tsx`:

```tsx
import { TabsContent } from '@/components/ui'
import { StaffCustomerSearchInput } from '@/components/staff/staff-customer-search-input'
import { StaffTableVoucherSheet } from '@/components/staff/staff-table-voucher-sheet'
import type { IVoucher } from '@/types'
import type { OrderItem, TableCustomer } from '@/types/session'

interface AdminCartInfoTabProps {
  sessionCustomer: TableCustomer | null
  sessionVoucher: IVoucher | null
  pendingItems: OrderItem[]
  submittedItems: OrderItem[]
  onSelectCustomer: (c: TableCustomer) => void
  onClearCustomer: () => void
  onApplyVoucher: (v: IVoucher) => Promise<void> | void
  onRemoveVoucher: () => Promise<void> | void
}

export function AdminCartInfoTab({
  sessionCustomer,
  sessionVoucher,
  pendingItems,
  submittedItems,
  onSelectCustomer,
  onClearCustomer,
  onApplyVoucher,
  onRemoveVoucher,
}: AdminCartInfoTabProps) {
  return (
    <TabsContent
      value="info"
      className="mt-0 min-h-0 flex-1 px-3 data-[state=inactive]:hidden"
    >
      {/* PASTE the inner <div data-testid="admin-cart-info-tab"> ... block
          from admin-cart-content.tsx:1021–1048 VERBATIM here. Replace local
          refs:
          - `sessionCustomer` → `sessionCustomer` (prop)
          - `selectCustomer` → `onSelectCustomer` (prop, signature matches)
          - `setClearCustomerOpen(true)` → `onClearCustomer` (prop)
          - `session.pendingItems` → `pendingItems` (prop)
          - `session.submittedOrders.flatMap(...)` → `submittedItems` (prop)
          - `sessionVoucher` → `sessionVoucher` (prop)
          - `handleApplyVoucher` → `onApplyVoucher` (prop)
          - `handleRemoveVoucher` → `onRemoveVoucher` (prop) */}
    </TabsContent>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/components/admin/admin-cart-info-tab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Replace lines ~1017–1049 with:

```tsx
<AdminCartInfoTab
  sessionCustomer={sessionCustomer}
  sessionVoucher={sessionVoucher}
  pendingItems={session.pendingItems}
  submittedItems={session.submittedOrders.flatMap((o) => o.items)}
  onSelectCustomer={(c) => { void selectCustomer(c) }}
  onClearCustomer={() => setClearCustomerOpen(true)}
  onApplyVoucher={handleApplyVoucher}
  onRemoveVoucher={handleRemoveVoucher}
/>
```

Add import:

```ts
import { AdminCartInfoTab } from '@/app/system/menu/components/admin-cart-info-tab'
```

Remove now-unused `StaffCustomerSearchInput`, `StaffTableVoucherSheet` imports (verify with grep — they have no other call site after this swap).

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/app/system/menu/components/admin-cart-info-tab.tsx src/tests/components/admin/admin-cart-info-tab.test.tsx src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract AdminCartInfoTab component"
```

---

### Task 10: Extract `<AdminCartPendingItemsList>` (with relocated `CustomPriceCard`)

**Files:**
- Create: `src/app/system/menu/components/admin-cart-pending-items-list.tsx`
- Create: `src/app/system/menu/components/admin-cart-custom-price-card.tsx` (relocated from inline)
- Create: `src/tests/components/admin/admin-cart-pending-items-list.test.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` — remove the inline `CustomPriceCard` function (lines 77–164) AND the items-tab JSX block (lines ~885–1015)

**Interfaces:**
- Consumes: `OrderItemPrice`, `getItemPriceDisplay`, `SubmittedOrdersDialog`, motion components
- Produces:
  ```ts
  interface AdminCartPendingItemsListProps {
    pending: OrderItem[]
    submitted: OrderItem[]
    submittedTotal: number
    sessionVoucher: IVoucher | null
    serverActiveOrder: IOrder | null | undefined
    onUpdateItem: (id: string, patch: Partial<OrderItem>) => void
    onUpdateNote: (id: string, note: string) => void
    onRemoveItem: (id: string) => void
    onSubmittedChanges: (...) => Promise<void>
    onCancelOrder: () => Promise<void>
  }
  export function AdminCartPendingItemsList(
    props: AdminCartPendingItemsListProps,
  ): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/admin/admin-cart-pending-items-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminCartPendingItemsList } from '@/app/system/menu/components/admin-cart-pending-items-list'
import type { OrderItem } from '@/types/session'

vi.mock('@/components/staff/submitted-orders-dialog', () => ({
  SubmittedOrdersDialog: () => <div data-testid="submitted-dialog" />,
}))

const item: OrderItem = {
  menuItemId: 'p1',
  productSlug: 'p1',
  name: 'BBQ',
  priceNum: 50000,
  originalPrice: 50000,
  price: '50,000đ',
  quantity: 2,
  variantSlug: 'v1',
  note: '',
  promotion: null,
} as OrderItem

describe('AdminCartPendingItemsList', () => {
  it('renders pending item name', () => {
    render(
      <AdminCartPendingItemsList
        pending={[item]}
        submitted={[]}
        submittedTotal={0}
        sessionVoucher={null}
        serverActiveOrder={null}
        onUpdateItem={vi.fn()}
        onUpdateNote={vi.fn()}
        onRemoveItem={vi.fn()}
        onSubmittedChanges={vi.fn()}
        onCancelOrder={vi.fn()}
      />,
    )
    expect(screen.getByText('BBQ')).toBeTruthy()
  })

  it('renders empty-state when both lists empty', () => {
    render(
      <AdminCartPendingItemsList
        pending={[]}
        submitted={[]}
        submittedTotal={0}
        sessionVoucher={null}
        serverActiveOrder={null}
        onUpdateItem={vi.fn()}
        onUpdateNote={vi.fn()}
        onRemoveItem={vi.fn()}
        onSubmittedChanges={vi.fn()}
        onCancelOrder={vi.fn()}
      />,
    )
    expect(screen.queryByText('BBQ')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/components/admin/admin-cart-pending-items-list.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3a: Relocate `CustomPriceCard`**

Create `src/app/system/menu/components/admin-cart-custom-price-card.tsx`. Move lines 77–164 of admin-cart-content.tsx (the entire `CustomPriceCard` function component) into the new file VERBATIM. Add the same imports. Keep the same prop signature.

Export it as a named export:

```ts
export function CustomPriceCard(...) { ... }
```

- [ ] **Step 3b: Implement `<AdminCartPendingItemsList>`**

Create `src/app/system/menu/components/admin-cart-pending-items-list.tsx`. Extract the JSX block at admin-cart-content.tsx:885–1015 VERBATIM, parameterized via props.

```tsx
import { TabsContent } from '@/components/ui'
import { CustomPriceCard } from './admin-cart-custom-price-card'
// ... copy remaining imports needed (motion, AnimatePresence, OrderItemPrice,
//     getItemPriceDisplay, SubmittedOrdersDialog, Button, formatCurrency, etc)
//     from admin-cart-content.tsx
import type { IOrder, IVoucher } from '@/types'
import type { OrderItem } from '@/types/session'

interface AdminCartPendingItemsListProps {
  pending: OrderItem[]
  submitted: OrderItem[]
  submittedTotal: number
  sessionVoucher: IVoucher | null
  serverActiveOrder: IOrder | null | undefined
  onUpdateItem: (id: string, patch: Partial<OrderItem>) => void
  onUpdateNote: (id: string, note: string) => void
  onRemoveItem: (id: string) => void
  onSubmittedChanges: (
    changes: { orderItemSlug: string; newQty: number; newNote?: string }[],
  ) => Promise<void>
  onCancelOrder: () => Promise<void>
}

export function AdminCartPendingItemsList({
  pending,
  submitted,
  submittedTotal,
  sessionVoucher,
  serverActiveOrder,
  onUpdateItem,
  onUpdateNote,
  onRemoveItem,
  onSubmittedChanges,
  onCancelOrder,
}: AdminCartPendingItemsListProps) {
  return (
    <TabsContent
      value="items"
      className="scrollbar-hide mt-0 min-h-0 flex-1 overflow-y-auto px-2 pt-3 data-[state=inactive]:hidden"
    >
      {/* PASTE the inner JSX from admin-cart-content.tsx:885–1015 VERBATIM here.
          Replace local refs:
          - `pending` → `pending` (prop)
          - `submitted` → `submitted` (prop)
          - `submittedTotal` → `submittedTotal` (prop)
          - `sessionVoucher` → `sessionVoucher` (prop)
          - `serverActiveOrder` → `serverActiveOrder` (prop)
          - `updateItem(tableSlug, id, ...)` → `onUpdateItem(id, ...)` (prop)
          - `removeItem(tableSlug, id)` → `onRemoveItem(id)` (prop)
          - `setOrderDescription(tableSlug, ...)` is NOT here (it's outside the items tab)
          - `handleSubmittedChanges` → `onSubmittedChanges`
          - `handleCancelOrder` → `onCancelOrder`
          - The local `<CustomPriceCard>` JSX usage stays the same (imported now). */}
    </TabsContent>
  )
}
```

The implementer must thread props through correctly — particularly note that the original `updateItem`, `removeItem` store mutations took `tableSlug` as the first arg; the wrapped versions in props ALREADY have `tableSlug` baked in (via the call site closure). The component itself only knows the item id + patch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/components/admin/admin-cart-pending-items-list.test.tsx`
Expected: PASS.

- [ ] **Step 5: Swap call site in admin-cart-content.tsx**

Delete the inline `CustomPriceCard` function (lines 77–164). Replace JSX block at ~885–1015 with:

```tsx
<AdminCartPendingItemsList
  pending={pending}
  submitted={submitted}
  submittedTotal={submittedTotal}
  sessionVoucher={sessionVoucher}
  serverActiveOrder={serverActiveOrder}
  onUpdateItem={(id, patch) => updateItem(tableSlug, id, patch)}
  onUpdateNote={(id, note) => updateItem(tableSlug, id, { note })}
  onRemoveItem={(id) => removeItem(tableSlug, id)}
  onSubmittedChanges={handleSubmittedChanges}
  onCancelOrder={handleCancelOrder}
/>
```

Add import:

```ts
import { AdminCartPendingItemsList } from '@/app/system/menu/components/admin-cart-pending-items-list'
```

Remove now-unused imports (motion, AnimatePresence, Minus, Plus, NotepadText, Pencil, Trash2, OrderItemPrice, getItemPriceDisplay, SubmittedOrdersDialog, CustomPriceDialog, formatCurrency, etc) from admin-cart-content.tsx if they have no other call site. Verify each with grep.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit 2>&1 | grep admin-cart-content | head
npm run lint 2>&1 | grep admin-cart-content | head
npm run test 2>&1 | tail -10
wc -l src/app/system/menu/components/admin-cart-content.tsx
```
Expected: ≤ 650 lines (this is the biggest single extraction).

- [ ] **Step 7: Commit**

```bash
git add src/app/system/menu/components/admin-cart-pending-items-list.tsx src/app/system/menu/components/admin-cart-custom-price-card.tsx src/tests/components/admin/admin-cart-pending-items-list.test.tsx src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): extract AdminCartPendingItemsList + CustomPriceCard"
```

---

## PHASE 4 — Final validation

### Task 11: Full suite + manual smoke test + line-count check

**Files:**
- No code changes.

- [ ] **Step 1: Full test suite**

```bash
npm run test
```
Expected: all PASS, no regressions vs branch start.

- [ ] **Step 2: Production build**

```bash
npm run build
```
Expected: succeed, no TS errors.

- [ ] **Step 3: Lint**

```bash
npm run lint 2>&1 | tail -10
```
Expected: 0 errors. Warnings unchanged from branch start (verify with `git diff main -- '*.tsx' '*.ts' | grep -E "^[+-].*eslint" | head` — no new disables).

- [ ] **Step 4: Line-count check**

```bash
wc -l src/app/system/menu/components/admin-cart-content.tsx
wc -l src/app/system/menu/components/admin-cart-*.tsx
wc -l src/hooks/use-voucher-derived-items.ts src/hooks/use-pending-submitted-totals.ts src/hooks/use-session-reconciliation.ts
wc -l src/lib/cart-customer.ts src/lib/order-breakdown.ts
```

Targets:
- `admin-cart-content.tsx`: ≤ 650 lines (down from 1313)
- Each new component file: ≤ 250 lines
- Each new hook file: ≤ 100 lines
- Each new lib file: ≤ 200 lines

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

Click through:
- `/system/menu?table=<slug>` opens, customer info pulls from session/BE correctly.
- Add 3 items → submit batch → confirm dialog shows totals.
- Apply voucher → tổng tiền updates without delay (no number jump).
- Remove voucher → tổng tiền updates instantly.
- Add item not in voucher rule → auto-remove triggers, toast fires, tổng tiền updates without jump.
- Transfer table dialog opens + works.
- "Cancel" on an order works.
- Assist banner shows when `?assistOrder=` is in URL; dismiss button hides + strips param.

- [ ] **Step 6: No code commit (validation only)**

If any smoke test fails, fix root cause and commit separately. Do not bundle fixes into a generic "fix validation issues" commit — each fix gets its own commit referencing the affected task.

---

## Self-Review Notes

**1. Spec coverage:**
- ✅ Pure functions extracted: `deriveSessionCustomer` (Task 1), `computeOrderBreakdown` (Task 2)
- ✅ Hooks extracted: `useVoucherDerivedItems` (3), `usePendingSubmittedTotals` (4), `useSessionReconciliation` (5)
- ✅ Components extracted: header (6), confirm-submit (7), breakdown panel (8), info tab (9), pending list (10) + relocated CustomPriceCard
- ✅ Zero behavior change (each extraction copies logic verbatim then swaps the call site)
- ✅ Line-count target ≤ 650 (final validation in Task 11)

**2. Out of scope (NOT in this plan):**
- Extracting handler functions (`handleSubmitBatch`, `handleSubmittedChanges`, `handleCancelOrder`, etc.) — they have deep dependencies on local state + multiple mutations; isolating them risks more API surface than it saves. Leave inline.
- Extracting `useAdminCartActions` — bundling handlers into a hook saves few lines and adds indirection.
- Refactoring `table-payment-screen.tsx` or `table-order-screen.tsx` — separate concerns, separate plan. The new `lib/order-breakdown.ts` and `lib/cart-customer.ts` should be REUSED in those screens later, but that's a follow-up.

**3. Type consistency:**
- `OrderBreakdown` interface used identically in Task 2 (lib) and Task 8 (component prop).
- `PendingFallback` interface defined in Task 2 only; consumer in admin-cart-content passes a literal matching the shape (Task 2 step 5).
- `VoucherDerived`, `PendingSubmittedTotals` interfaces stay in their respective hook files; consumers destructure named fields.
- Component prop interfaces are inlined per file (kept private — consumers see the named export).

**4. Pre-existing concerns acknowledged:**
- The `breakdown` memo's recent (c) optimization is preserved verbatim in Task 2. Engineer must not "clean up" any inline comments referencing "BE staleness".
- `useRef` for `lastRefreshedServerRef` is lifted into `useSessionReconciliation` (Task 5) — the admin-cart-content lifecycle no longer needs the ref outside the hook.

**5. Recovery if a task is partially complete:**
- Each task ends with a single commit. `git reset --hard HEAD~1` rewinds one task cleanly.
- The plan ledger lives in `.superpowers/sdd/progress.md` (created automatically by the SDD skill).
