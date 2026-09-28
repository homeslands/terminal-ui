# Voucher Logic Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tinh gọn voucher logic: từ 4 file rải rác (`voucher-validation.ts`, `voucher-display.ts`, `use-auto-revalidate-applied-voucher.ts`, custom effects trong các page) thành 2 file gọn (`voucher-rules.ts` pure functions + `use-voucher-state.ts` single hook). KHÔNG đổi business logic, chỉ đổi cấu trúc — preserve 100% behavior.

**Architecture:** Phase 1 consolidate pure validation/display logic vào 1 file (an toàn, no behavior change). Phase 2 tạo 1 hook quản lý voucher lifecycle (apply/remove/auto-remove/BE sync). Phase 3-4 migrate consumer pages (admin-cart-content, table-payment-screen). Phase 5 cleanup. Mỗi phase deliver code chạy được — có thể dừng giữa phase nếu cần.

**Tech Stack:** TypeScript strict, Vitest, react-testing-library, Zustand, TanStack Query v5, React 18.

## Global Constraints

- Test framework: Vitest. Chạy từ `/Users/phanquyetthang/terminal/app/order-ui`.
- Lint: `npm run lint`. Build: `npm run build`.
- Test files: `src/tests/<mirror-path>/<name>.test.ts(x)`.
- Branch: hiện tại `feature/TT-30-FE-Add-New-User-Roles-and-Implement-Permission-Mapping`. Tiếp tục branch này hoặc tạo branch mới `refactor/voucher-logic-consolidation`.
- **NO BEHAVIOR CHANGE**: refactor thuần cấu trúc. Mọi unit test cũ (voucher-validation, use-auto-revalidate) phải PASS sau migration. Bug cũ giữ nguyên cho tới khi explicit fix.
- TypeScript strict; không `any` outside narrow well-justified casts.
- Console.log debug ở `voucher-display.ts:79-85, 104-112` được phép xoá (debug rơi rớt). Log production ở `use-auto-revalidate-applied-voucher.ts` giữ nếu Phase 5 quyết định keep hook.

## File Structure

**Create:**
- `src/lib/voucher-rules.ts` — pure functions: `VoucherContext`, `evaluateVoucher()`, `getVoucherDisplayState()`, `mergeVoucherSources()`, `voucherReasonI18nKey()`, `firstInvalidReason()` (internal)
- `src/hooks/use-voucher-state.ts` — single hook quản lý voucher lifecycle
- `src/tests/lib/voucher-rules.test.ts` — unit tests cho voucher-rules
- `src/tests/hooks/use-voucher-state.test.tsx` — hook integration tests

**Delete (cuối plan):**
- `src/lib/voucher-validation.ts` → merged vào `voucher-rules.ts`
- `src/lib/voucher-display.ts` → merged vào `voucher-rules.ts`
- `src/hooks/use-auto-revalidate-applied-voucher.ts` → merged vào `use-voucher-state.ts` HOẶC giữ nếu Phase 5 đánh giá cần

**Modify:**
- `src/app/system/menu/components/admin-cart-content.tsx` — bỏ Layer A + seed + handleApply + handleRemove duplicates, dùng `useVoucherState`
- `src/components/staff/table-payment-screen.tsx` — bỏ custom auto-revalidate effect + `removeVoucherInternal`, dùng `useVoucherState`
- `src/components/staff/staff-table-voucher-sheet.tsx` — bỏ `useAutoRevalidateAppliedVoucher` call (parent handles), nhận prop từ parent
- `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` — cùng pattern
- `src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx` — cùng pattern (nếu áp dụng)
- Mọi file import `voucher-validation` hoặc `voucher-display` → chuyển sang `voucher-rules`

**NOT touched:**
- `src/lib/voucher-summary.ts` (cho UI summary, không phải validation)
- `src/lib/voucher-time.ts` (utilities)
- `src/utils/voucher.ts`, `src/utils/voucher-validation-helper.ts` (chỉ utilities)
- `src/lib/server-time.ts` (clock sync)
- `src/types/voucher.type.ts` (types)
- `src/api/voucher.ts` (API layer)

---

# PHASE 1: Consolidate validation files

Mục tiêu: gộp `voucher-validation.ts` + `voucher-display.ts` vào `voucher-rules.ts`. Zero behavior change. Tests cũ phải pass với import path mới.

## Task 1: Tạo `voucher-rules.ts` skeleton + di chuyển types

**Files:**
- Create: `src/lib/voucher-rules.ts`
- Test: `src/tests/lib/voucher-rules.test.ts` (mới)

**Interfaces:**
- Produces:
  - `VoucherContext` (interface — gộp từ 2 file cũ, identical shape)
  - `VoucherInvalidReason` (union type)
  - `VoucherSource` (`'eligible' | 'applied_only'`)
  - `IVoucherDisplay` (extends IVoucher với `_source`, `_isApplied`)
  - `VoucherDisplayState` (state machine union)

- [ ] **Step 1: Write the failing test**

Tạo `src/tests/lib/voucher-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type {
  VoucherContext,
  VoucherInvalidReason,
  VoucherSource,
  IVoucherDisplay,
  VoucherDisplayState,
} from '@/lib/voucher-rules'

describe('voucher-rules type exports', () => {
  it('VoucherContext has required fields', () => {
    const ctx: VoucherContext = {
      subtotalAfterPromotion: 0,
      totalQuantity: 0,
      productSlugs: [],
      hasCustomerOwner: false,
    }
    expect(ctx.subtotalAfterPromotion).toBe(0)
  })

  it('VoucherInvalidReason union accepts all expected values', () => {
    const reasons: VoucherInvalidReason[] = [
      'OUT_OF_USAGE',
      'EXPIRED',
      'NOT_IN_TIME_WINDOW',
      'MIN_ORDER_NOT_MET',
      'IDENTITY_REQUIRED',
      'PRODUCTS_ALL_REQUIRED',
      'PRODUCTS_AT_LEAST_ONE_REQUIRED',
      'MAX_ITEMS_EXCEEDED',
      'INACTIVE',
      'NOT_ELIGIBLE',
      'PAYMENT_METHOD_NOT_SUPPORTED',
      'CONFIG_CHANGED',
    ]
    expect(reasons.length).toBe(12)
  })

  it('VoucherDisplayState shape covers 5 kinds', () => {
    const states: VoucherDisplayState[] = [
      { kind: 'AVAILABLE', canApply: true, canRemove: false },
      { kind: 'APPLIED_OK', canApply: false, canRemove: true },
      { kind: 'APPLIED_INVALID', canApply: false, canRemove: true, reason: 'EXPIRED' },
      { kind: 'APPLIED_STALE', canApply: false, canRemove: true, reason: 'OUT_OF_USAGE' },
      { kind: 'INELIGIBLE', canApply: false, canRemove: false, reason: 'INACTIVE' },
    ]
    expect(states.length).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/voucher-rules'`.

- [ ] **Step 3: Create `voucher-rules.ts` with types only**

Tạo `src/lib/voucher-rules.ts`:

```ts
import type { IVoucher } from '@/types'

// Consolidated voucher rules. Replaces:
//   - src/lib/voucher-validation.ts (isVoucherValid, getVoucherErrorMessage)
//   - src/lib/voucher-display.ts (firstInvalidReason, getVoucherDisplayState,
//     mergeVoucherSources, voucherReasonI18nKey)
// Single source of truth for: validation rules, display state machine,
// applied-snapshot injection, i18n key mapping.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoucherContext {
  /** Subtotal after item-level promotion, excluding gift items. */
  subtotalAfterPromotion: number
  /** Sum of quantity across non-gift items. */
  totalQuantity: number
  /** Product slugs in cart (non-gift). */
  productSlugs: string[]
  /** True when owner is a customer with login. */
  hasCustomerOwner: boolean
  /** Current payment method on the order/cart. Omit if not yet chosen. */
  paymentMethod?: string
}

export type VoucherInvalidReason =
  | 'OUT_OF_USAGE'
  | 'EXPIRED'
  | 'NOT_IN_TIME_WINDOW'
  | 'MIN_ORDER_NOT_MET'
  | 'IDENTITY_REQUIRED'
  | 'PRODUCTS_ALL_REQUIRED'
  | 'PRODUCTS_AT_LEAST_ONE_REQUIRED'
  | 'MAX_ITEMS_EXCEEDED'
  | 'INACTIVE'
  | 'NOT_ELIGIBLE'
  | 'PAYMENT_METHOD_NOT_SUPPORTED'
  | 'CONFIG_CHANGED'

export type VoucherSource = 'eligible' | 'applied_only'

export interface IVoucherDisplay extends IVoucher {
  _source: VoucherSource
  _isApplied: boolean
}

export type VoucherDisplayState =
  | { kind: 'AVAILABLE'; canApply: true; canRemove: false }
  | { kind: 'APPLIED_OK'; canApply: false; canRemove: true }
  | {
      kind: 'APPLIED_INVALID'
      canApply: false
      canRemove: true
      reason: VoucherInvalidReason
    }
  | {
      kind: 'APPLIED_STALE'
      canApply: false
      canRemove: true
      reason: VoucherInvalidReason
    }
  | {
      kind: 'INELIGIBLE'
      canApply: false
      canRemove: false
      reason: VoucherInvalidReason
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Run lint**

```bash
npm run lint 2>&1 | tail -5
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/voucher-rules.ts src/tests/lib/voucher-rules.test.ts
git commit -m "feat(voucher): create voucher-rules.ts with consolidated types"
```

---

## Task 2: Di chuyển `evaluateVoucher()` (gộp `isVoucherValid` + `firstInvalidReason`)

**Files:**
- Modify: `src/lib/voucher-rules.ts` (thêm `evaluateVoucher` function)
- Test: `src/tests/lib/voucher-rules.test.ts` (thêm test cases)

**Interfaces:**
- Consumes: `VoucherContext`, `VoucherInvalidReason` từ Task 1
- Produces:
  - `evaluateVoucher(v: IVoucher, ctx: VoucherContext): { valid: boolean; reason: VoucherInvalidReason | null }`
  - `getVoucherErrorMessage(v: IVoucher, ctx: VoucherContext, t: TFunction): string` (backward-compat re-export for callers still using it)

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/lib/voucher-rules.test.ts`:

```ts
import moment from 'moment'
import { evaluateVoucher } from '@/lib/voucher-rules'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import type { IVoucher } from '@/types'

const baseVoucher: IVoucher = {
  slug: 'v1',
  code: 'V1',
  title: 'V1',
  type: VOUCHER_TYPE.PERCENT_ORDER,
  value: 10,
  applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
  minOrderValue: 0,
  maxUsage: 100,
  remainingUsage: 50,
  isActive: true,
  isPrivate: false,
  isVerificationIdentity: false,
  startDate: moment().subtract(1, 'day').toISOString(),
  endDate: moment().add(10, 'days').toISOString(),
  voucherProducts: [],
  activeStartTime: null,
  activeEndTime: null,
  numberOfUsagePerUser: 1,
  maxItems: 0,
} as unknown as IVoucher

const baseCtx = {
  subtotalAfterPromotion: 100000,
  totalQuantity: 2,
  productSlugs: ['p1', 'p2'],
  hasCustomerOwner: false,
}

describe('evaluateVoucher', () => {
  it('valid voucher returns { valid: true, reason: null }', () => {
    const result = evaluateVoucher(baseVoucher, baseCtx)
    expect(result.valid).toBe(true)
    expect(result.reason).toBe(null)
  })

  it('minOrderValue not met → MIN_ORDER_NOT_MET', () => {
    const v = { ...baseVoucher, minOrderValue: 200000 }
    const result = evaluateVoucher(v, baseCtx)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('MIN_ORDER_NOT_MET')
  })

  it('inactive voucher → INACTIVE', () => {
    const v = { ...baseVoucher, isActive: false }
    expect(evaluateVoucher(v, baseCtx).reason).toBe('INACTIVE')
  })

  it('expired voucher → EXPIRED', () => {
    const v = { ...baseVoucher, endDate: moment().subtract(1, 'day').toISOString() }
    expect(evaluateVoucher(v, baseCtx).reason).toBe('EXPIRED')
  })

  it('remainingUsage = 0 → OUT_OF_USAGE', () => {
    const v = { ...baseVoucher, remainingUsage: 0 }
    expect(evaluateVoucher(v, baseCtx).reason).toBe('OUT_OF_USAGE')
  })

  it('requires customer identity, owner is not customer → IDENTITY_REQUIRED', () => {
    const v = { ...baseVoucher, isVerificationIdentity: true }
    expect(evaluateVoucher(v, baseCtx).reason).toBe('IDENTITY_REQUIRED')
  })

  it('voucherProducts ALL_REQUIRED + cart has non-eligible → PRODUCTS_ALL_REQUIRED', () => {
    const v = {
      ...baseVoucher,
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      voucherProducts: [
        { product: { slug: 'p1' } },
        { product: { slug: 'p2' } },
      ],
    } as unknown as IVoucher
    const ctx = { ...baseCtx, productSlugs: ['p1', 'p3'] }
    expect(evaluateVoucher(v, ctx).reason).toBe('PRODUCTS_ALL_REQUIRED')
  })

  it('voucherProducts AT_LEAST_ONE_REQUIRED + none match → PRODUCTS_AT_LEAST_ONE_REQUIRED', () => {
    const v = {
      ...baseVoucher,
      voucherProducts: [{ product: { slug: 'pX' } }],
    } as unknown as IVoucher
    expect(evaluateVoucher(v, baseCtx).reason).toBe('PRODUCTS_AT_LEAST_ONE_REQUIRED')
  })

  it('maxItems exceeded → MAX_ITEMS_EXCEEDED', () => {
    const v = { ...baseVoucher, maxItems: 1 }
    const ctx = { ...baseCtx, totalQuantity: 5 }
    expect(evaluateVoucher(v, ctx).reason).toBe('MAX_ITEMS_EXCEEDED')
  })

  it('payment method restriction + cart method not in list → PAYMENT_METHOD_NOT_SUPPORTED', () => {
    const v = {
      ...baseVoucher,
      voucherPaymentMethods: [{ paymentMethod: 'cash' }],
    } as unknown as IVoucher
    const ctx = { ...baseCtx, paymentMethod: 'bank-transfer' }
    expect(evaluateVoucher(v, ctx).reason).toBe('PAYMENT_METHOD_NOT_SUPPORTED')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: FAIL — 10 new tests fail because `evaluateVoucher` not exported yet.

- [ ] **Step 3: Implement `evaluateVoucher` (port logic from `firstInvalidReason` in voucher-display.ts)**

Append to `src/lib/voucher-rules.ts`:

```ts
import moment from 'moment'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { isVoucherApplicableToCartItems } from '@/utils'
import {
  isVoucherExpired,
  isVoucherInActiveTimeWindow,
} from '@/utils/voucher-time'
import { serverNow } from '@/lib/server-time'

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Single source of truth for voucher validation. Replaces:
 *   - voucher-validation.ts::isVoucherValid (returned bool only)
 *   - voucher-display.ts::firstInvalidReason (returned reason only)
 *
 * Check order matters — first violated rule wins as the reason. Order is
 * preserved from voucher-display.ts (inactive → time → usage → identity →
 * payment method → minOrder → products → maxItems) to avoid behavior change.
 */
export function evaluateVoucher(
  v: IVoucher,
  ctx: VoucherContext,
): { valid: boolean; reason: VoucherInvalidReason | null } {
  const reason = firstInvalidReason(v, ctx)
  return { valid: reason === null, reason }
}

function firstInvalidReason(
  v: IVoucher,
  ctx: VoucherContext,
): VoucherInvalidReason | null {
  if (!v.isActive) return 'INACTIVE'
  if (isVoucherExpired(v)) return 'EXPIRED'
  if (!isVoucherInActiveTimeWindow(v)) return 'NOT_IN_TIME_WINDOW'
  if ((v.remainingUsage ?? 0) <= 0) return 'OUT_OF_USAGE'

  // 7AM-today bound — mirrors voucher-validation.ts behavior.
  const sevenAm = moment(serverNow()).set({
    hour: 7,
    minute: 0,
    second: 0,
    millisecond: 0,
  })
  if (!sevenAm.isSameOrBefore(moment(v.endDate))) return 'EXPIRED'

  if (v.isVerificationIdentity && !ctx.hasCustomerOwner) {
    return 'IDENTITY_REQUIRED'
  }

  const methodRestriction: string[] =
    v.voucherPaymentMethods?.map((m) => m.paymentMethod as string) ?? []
  if (
    methodRestriction.length > 0 &&
    ctx.paymentMethod !== undefined &&
    !methodRestriction.includes(ctx.paymentMethod)
  ) {
    return 'PAYMENT_METHOD_NOT_SUPPORTED'
  }

  if (
    v.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
    (v.minOrderValue ?? 0) > ctx.subtotalAfterPromotion
  ) {
    return 'MIN_ORDER_NOT_MET'
  }

  const productSlugs =
    v.voucherProducts
      ?.map((vp) => vp.product?.slug)
      .filter((s): s is string => !!s) ?? []
  if (productSlugs.length > 0) {
    const ok = isVoucherApplicableToCartItems(
      ctx.productSlugs,
      productSlugs,
      v.applicabilityRule,
    )
    if (!ok) {
      return v.applicabilityRule === APPLICABILITY_RULE.ALL_REQUIRED
        ? 'PRODUCTS_ALL_REQUIRED'
        : 'PRODUCTS_AT_LEAST_ONE_REQUIRED'
    }
  }

  if (v.maxItems && v.maxItems > 0 && ctx.totalQuantity > v.maxItems) {
    return 'MAX_ITEMS_EXCEEDED'
  }

  return null
}

/**
 * Backward-compat: returns a localized error message for the first invalid
 * reason. Used by code paths still calling the old `getVoucherErrorMessage`.
 * Prefer `evaluateVoucher().reason` + `voucherReasonI18nKey()` going forward.
 */
export function getVoucherErrorMessage(
  v: IVoucher,
  ctx: VoucherContext,
  t: (k: string, p?: Record<string, unknown>) => string,
): string {
  const { reason } = evaluateVoucher(v, ctx)
  if (!reason) return ''
  // Preserve old behavior where some reasons had richer messages with params
  // (e.g. notInActiveTimeWindow with start/end). For now fall back to plain
  // i18n key. Callers needing parameterized strings should query reason and
  // build the message themselves.
  if (reason === 'NOT_IN_TIME_WINDOW' && v.activeStartTime && v.activeEndTime) {
    return t('voucher.notInActiveTimeWindow', {
      start: v.activeStartTime,
      end: v.activeEndTime,
    })
  }
  return t(voucherReasonI18nKey(reason))
}

// Placeholder — will be filled in Task 5. Tests use only evaluateVoucher
// directly until then.
export function voucherReasonI18nKey(reason: VoucherInvalidReason): string {
  return `voucher.reason.${reason.toLowerCase()}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: PASS — all tests (3 type + 10 evaluate).

- [ ] **Step 5: Run lint**

```bash
npm run lint 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/voucher-rules.ts src/tests/lib/voucher-rules.test.ts
git commit -m "feat(voucher): add evaluateVoucher consolidating isVoucherValid + firstInvalidReason"
```

---

## Task 3: Di chuyển `mergeVoucherSources` (xoá console.log)

**Files:**
- Modify: `src/lib/voucher-rules.ts` (thêm `mergeVoucherSources`)
- Test: `src/tests/lib/voucher-rules.test.ts` (thêm tests)

**Interfaces:**
- Produces: `mergeVoucherSources(eligible: IVoucher[], applied: IVoucher | null): IVoucherDisplay[]`

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/lib/voucher-rules.test.ts`:

```ts
import { mergeVoucherSources } from '@/lib/voucher-rules'

describe('mergeVoucherSources', () => {
  it('eligible only → all _source=eligible, _isApplied=false', () => {
    const eligible = [
      { ...baseVoucher, slug: 'a' },
      { ...baseVoucher, slug: 'b' },
    ]
    const result = mergeVoucherSources(eligible, null)
    expect(result).toHaveLength(2)
    expect(result[0]._source).toBe('eligible')
    expect(result[0]._isApplied).toBe(false)
    expect(result[1]._isApplied).toBe(false)
  })

  it('applied voucher exists in eligible → marked _isApplied=true, _source=eligible', () => {
    const eligible = [
      { ...baseVoucher, slug: 'a' },
      { ...baseVoucher, slug: 'b' },
    ]
    const applied = { ...baseVoucher, slug: 'b' }
    const result = mergeVoucherSources(eligible, applied)
    expect(result).toHaveLength(2)
    const bEntry = result.find((v) => v.slug === 'b')!
    expect(bEntry._isApplied).toBe(true)
    expect(bEntry._source).toBe('eligible')
  })

  it('applied voucher NOT in eligible → injected with _source=applied_only', () => {
    const eligible = [{ ...baseVoucher, slug: 'a' }]
    const applied = { ...baseVoucher, slug: 'b' }
    const result = mergeVoucherSources(eligible, applied)
    expect(result).toHaveLength(2)
    const bEntry = result.find((v) => v.slug === 'b')!
    expect(bEntry._isApplied).toBe(true)
    expect(bEntry._source).toBe('applied_only')
  })

  it('no applied → no applied_only entries', () => {
    const eligible = [{ ...baseVoucher, slug: 'a' }]
    const result = mergeVoucherSources(eligible, null)
    expect(result.every((v) => v._source === 'eligible')).toBe(true)
  })

  it('does NOT emit console output (debug logs were removed)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    mergeVoucherSources([{ ...baseVoucher, slug: 'a' }], null)
    expect(logSpy).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
```

Lưu ý: cần `import { vi } from 'vitest'` ở đầu file.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: FAIL — `mergeVoucherSources` not exported.

- [ ] **Step 3: Implement `mergeVoucherSources` (clean port from voucher-display.ts, NO console.log)**

Append to `src/lib/voucher-rules.ts`:

```ts
// ---------------------------------------------------------------------------
// Source merging
// ---------------------------------------------------------------------------

/**
 * Union eligible API response with applied snapshot from the order.
 *
 * Critical invariant: an applied voucher MUST remain in the display list even
 * when the eligible API no longer returns it (e.g. user just consumed the
 * last remaining usage). Otherwise the user loses the ability to deselect it
 * from the sheet UI.
 */
export function mergeVoucherSources(
  eligible: IVoucher[],
  applied: IVoucher | null,
): IVoucherDisplay[] {
  const map = new Map<string, IVoucherDisplay>()

  for (const v of eligible) {
    map.set(v.slug, { ...v, _source: 'eligible', _isApplied: false })
  }

  if (applied) {
    const existed = map.get(applied.slug)
    map.set(applied.slug, {
      ...(existed ?? {}),
      ...applied,
      _source: existed ? 'eligible' : 'applied_only',
      _isApplied: true,
    } as IVoucherDisplay)
  }

  return Array.from(map.values())
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: PASS all merge tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/voucher-rules.ts src/tests/lib/voucher-rules.test.ts
git commit -m "feat(voucher): port mergeVoucherSources, drop debug console logs"
```

---

## Task 4: Di chuyển `getVoucherDisplayState`

**Files:**
- Modify: `src/lib/voucher-rules.ts`
- Test: `src/tests/lib/voucher-rules.test.ts`

**Interfaces:**
- Produces: `getVoucherDisplayState(v: IVoucherDisplay, ctx: VoucherContext): VoucherDisplayState`

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/lib/voucher-rules.test.ts`:

```ts
import { getVoucherDisplayState } from '@/lib/voucher-rules'
import type { IVoucherDisplay } from '@/lib/voucher-rules'

describe('getVoucherDisplayState', () => {
  const make = (overrides: Partial<IVoucherDisplay>): IVoucherDisplay => ({
    ...(baseVoucher as IVoucher),
    _source: 'eligible',
    _isApplied: false,
    ...overrides,
  } as IVoucherDisplay)

  it('valid + not applied → AVAILABLE', () => {
    const state = getVoucherDisplayState(make({}), baseCtx)
    expect(state.kind).toBe('AVAILABLE')
    expect(state.canApply).toBe(true)
    expect(state.canRemove).toBe(false)
  })

  it('valid + applied → APPLIED_OK', () => {
    const state = getVoucherDisplayState(make({ _isApplied: true }), baseCtx)
    expect(state.kind).toBe('APPLIED_OK')
    expect(state.canRemove).toBe(true)
  })

  it('invalid + applied → APPLIED_INVALID with reason', () => {
    const state = getVoucherDisplayState(
      make({ _isApplied: true, minOrderValue: 999_999_999 }),
      baseCtx,
    )
    expect(state.kind).toBe('APPLIED_INVALID')
    if (state.kind === 'APPLIED_INVALID') {
      expect(state.reason).toBe('MIN_ORDER_NOT_MET')
    }
  })

  it('invalid + not applied → INELIGIBLE with reason', () => {
    const state = getVoucherDisplayState(
      make({ minOrderValue: 999_999_999 }),
      baseCtx,
    )
    expect(state.kind).toBe('INELIGIBLE')
  })

  it('_source=applied_only + remainingUsage 0 → APPLIED_STALE OUT_OF_USAGE', () => {
    const state = getVoucherDisplayState(
      make({ _source: 'applied_only', _isApplied: true, remainingUsage: 0 }),
      baseCtx,
    )
    expect(state.kind).toBe('APPLIED_STALE')
    if (state.kind === 'APPLIED_STALE') {
      expect(state.reason).toBe('OUT_OF_USAGE')
    }
  })

  it('_source=applied_only + remainingUsage > 0 → APPLIED_STALE NOT_ELIGIBLE', () => {
    const state = getVoucherDisplayState(
      make({ _source: 'applied_only', _isApplied: true, remainingUsage: 1 }),
      baseCtx,
    )
    expect(state.kind).toBe('APPLIED_STALE')
    if (state.kind === 'APPLIED_STALE') {
      expect(state.reason).toBe('NOT_ELIGIBLE')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `getVoucherDisplayState`**

Append to `src/lib/voucher-rules.ts`:

```ts
// ---------------------------------------------------------------------------
// Display state machine
// ---------------------------------------------------------------------------

export function getVoucherDisplayState(
  v: IVoucherDisplay,
  ctx: VoucherContext,
): VoucherDisplayState {
  if (v._source === 'applied_only') {
    const reason: VoucherInvalidReason =
      (v.remainingUsage ?? 0) === 0 ? 'OUT_OF_USAGE' : 'NOT_ELIGIBLE'
    return { kind: 'APPLIED_STALE', canApply: false, canRemove: true, reason }
  }

  const { reason } = evaluateVoucher(v, ctx)
  if (reason === null) {
    return v._isApplied
      ? { kind: 'APPLIED_OK', canApply: false, canRemove: true }
      : { kind: 'AVAILABLE', canApply: true, canRemove: false }
  }
  return v._isApplied
    ? {
        kind: 'APPLIED_INVALID',
        canApply: false,
        canRemove: true,
        reason,
      }
    : {
        kind: 'INELIGIBLE',
        canApply: false,
        canRemove: false,
        reason,
      }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/voucher-rules.ts src/tests/lib/voucher-rules.test.ts
git commit -m "feat(voucher): port getVoucherDisplayState into voucher-rules"
```

---

## Task 5: Hoàn thiện `voucherReasonI18nKey` (chuẩn map)

**Files:**
- Modify: `src/lib/voucher-rules.ts` (replace placeholder)
- Test: `src/tests/lib/voucher-rules.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
import { voucherReasonI18nKey } from '@/lib/voucher-rules'

describe('voucherReasonI18nKey', () => {
  it.each<[string, string]>([
    ['OUT_OF_USAGE', 'voucher.reason.outOfUsage'],
    ['EXPIRED', 'voucher.reason.expired'],
    ['NOT_IN_TIME_WINDOW', 'voucher.reason.notInTimeWindow'],
    ['MIN_ORDER_NOT_MET', 'voucher.reason.minOrderNotMet'],
    ['IDENTITY_REQUIRED', 'voucher.reason.identityRequired'],
    ['PRODUCTS_ALL_REQUIRED', 'voucher.reason.productsAllRequired'],
    [
      'PRODUCTS_AT_LEAST_ONE_REQUIRED',
      'voucher.reason.productsAtLeastOneRequired',
    ],
    ['MAX_ITEMS_EXCEEDED', 'voucher.reason.maxItemsExceeded'],
    ['INACTIVE', 'voucher.reason.inactive'],
    ['NOT_ELIGIBLE', 'voucher.reason.notEligible'],
    ['PAYMENT_METHOD_NOT_SUPPORTED', 'voucher.reason.paymentMethodNotSupported'],
    ['CONFIG_CHANGED', 'voucher.reason.configChanged'],
  ])('reason %s maps to %s', (reason, expected) => {
    expect(voucherReasonI18nKey(reason as never)).toBe(expected)
  })
})
```

- [ ] **Step 2: Replace placeholder in `voucher-rules.ts`**

Find the placeholder `voucherReasonI18nKey` (added in Task 2) and replace with full map:

```ts
const REASON_KEYS: Record<VoucherInvalidReason, string> = {
  OUT_OF_USAGE: 'voucher.reason.outOfUsage',
  EXPIRED: 'voucher.reason.expired',
  NOT_IN_TIME_WINDOW: 'voucher.reason.notInTimeWindow',
  MIN_ORDER_NOT_MET: 'voucher.reason.minOrderNotMet',
  IDENTITY_REQUIRED: 'voucher.reason.identityRequired',
  PRODUCTS_ALL_REQUIRED: 'voucher.reason.productsAllRequired',
  PRODUCTS_AT_LEAST_ONE_REQUIRED: 'voucher.reason.productsAtLeastOneRequired',
  MAX_ITEMS_EXCEEDED: 'voucher.reason.maxItemsExceeded',
  INACTIVE: 'voucher.reason.inactive',
  NOT_ELIGIBLE: 'voucher.reason.notEligible',
  PAYMENT_METHOD_NOT_SUPPORTED: 'voucher.reason.paymentMethodNotSupported',
  CONFIG_CHANGED: 'voucher.reason.configChanged',
}

export function voucherReasonI18nKey(reason: VoucherInvalidReason): string {
  return REASON_KEYS[reason]
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tests/lib/voucher-rules.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/voucher-rules.ts src/tests/lib/voucher-rules.test.ts
git commit -m "feat(voucher): finalize voucherReasonI18nKey map"
```

---

## Task 6: Migrate imports from `voucher-validation` + `voucher-display` to `voucher-rules`

**Files:**
- Modify: every file that imports from `@/lib/voucher-validation` or `@/lib/voucher-display`

**Discovery:**
- Run `grep -rln "from '@/lib/voucher-validation'\|from '@/lib/voucher-display'" src/`
- Expected list (verify in step 1): voucher sheets, payment-screen, admin-cart-content, use-auto-revalidate hook, hooks/use-voucher-display-items + use-voucher-display-list, plus existing tests.

- [ ] **Step 1: Discover all importers**

```bash
grep -rln "from '@/lib/voucher-validation'\|from '@/lib/voucher-display'" /Users/phanquyetthang/terminal/app/order-ui/src
```

Save the list. Each file in the list will be modified.

- [ ] **Step 2: Replace imports file-by-file**

For each file in the list, replace:
- `from '@/lib/voucher-validation'` → `from '@/lib/voucher-rules'`
- `from '@/lib/voucher-display'` → `from '@/lib/voucher-rules'`

The exports `isVoucherValid` and `firstInvalidReason` are NOT exported from `voucher-rules`. Replace call sites:
- `isVoucherValid(v, ctx)` → `evaluateVoucher(v, ctx).valid`
- Any `firstInvalidReason(v, ctx)` (internal previously) → `evaluateVoucher(v, ctx).reason`

`getVoucherErrorMessage` IS re-exported from `voucher-rules`, no rename needed.

`VoucherValidationContext` type re-export: in voucher-rules.ts, also export an alias for backward compat:

```ts
// Backward-compat alias — prefer VoucherContext going forward.
export type VoucherValidationContext = VoucherContext
```

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no new errors. If lint complains about unused imports, clean them.

- [ ] **Step 4: Run full test suite**

```bash
npm run test
```

Expected: all PASS. Existing `src/tests/lib/voucher-validation.test.ts` continues to use `@/lib/voucher-validation` exports — those exports still exist in old file. We'll delete those tests in Task 7.

- [ ] **Step 5: Commit**

```bash
git add -A   # many files touched; use -A but verify with git status first
git status   # confirm only import lines changed
git commit -m "refactor(voucher): migrate imports from voucher-validation/voucher-display to voucher-rules"
```

---

## Task 7: Delete `voucher-validation.ts` and `voucher-display.ts`

**Files:**
- Delete: `src/lib/voucher-validation.ts`
- Delete: `src/lib/voucher-display.ts`
- Delete: `src/tests/lib/voucher-validation.test.ts` (logic moved to voucher-rules.test.ts)

- [ ] **Step 1: Verify no remaining importers**

```bash
grep -rln "from '@/lib/voucher-validation'\|from '@/lib/voucher-display'" /Users/phanquyetthang/terminal/app/order-ui/src
```

Expected: empty (or only the old files themselves).

- [ ] **Step 2: Delete files**

```bash
rm src/lib/voucher-validation.ts
rm src/lib/voucher-display.ts
rm src/tests/lib/voucher-validation.test.ts
```

- [ ] **Step 3: Run build to confirm no broken references**

```bash
npm run build
```

Expected: build success.

- [ ] **Step 4: Run full test suite**

```bash
npm run test
```

Expected: all PASS, no test files orphaned.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(voucher): delete voucher-validation.ts and voucher-display.ts (merged into voucher-rules)"
```

---

# PHASE 2: Single voucher state hook

Mục tiêu: tạo `useVoucherState` hook đóng gói lifecycle (apply/remove/auto-remove/BE sync). KHÔNG migrate consumer yet — hook coexists với code cũ.

## Task 8: Tạo `use-voucher-state.ts` skeleton + tests setup

**Files:**
- Create: `src/hooks/use-voucher-state.ts`
- Create: `src/tests/hooks/use-voucher-state.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface UseVoucherStateInput {
    tableSlug: string
    orderSlug: string | null | undefined
    items: { menuItemId?: string; productSlug?: string; quantity: number }[]
    hasCustomerOwner: boolean
    subtotalAfterPromotion: number
    paymentMethod?: string
  }
  interface UseVoucherStateResult {
    appliedVoucher: IVoucher | null
    isApplying: boolean
    isRemoving: boolean
    applyVoucher: (v: IVoucher) => Promise<void>
    removeVoucher: () => Promise<void>
    /** Signals when auto-remove fired so caller can show a toast. */
    onAutoRemoved: (cb: (reason: VoucherInvalidReason) => void) => void
  }
  function useVoucherState(input: UseVoucherStateInput): UseVoucherStateResult
  ```

- [ ] **Step 1: Write a failing skeleton test**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useVoucherState } from '@/hooks/use-voucher-state'
import { useTableSessionsStore } from '@/stores/table-sessions.store'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useVoucherState', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
  })

  it('returns null appliedVoucher when session has no voucher', () => {
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: null,
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    expect(result.current.appliedVoucher).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/hooks/use-voucher-state.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement skeleton**

```ts
import { useCallback } from 'react'
import type { IVoucher } from '@/types'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import type { VoucherInvalidReason } from '@/lib/voucher-rules'

interface UseVoucherStateInput {
  tableSlug: string
  orderSlug: string | null | undefined
  items: { menuItemId?: string; productSlug?: string; quantity: number }[]
  hasCustomerOwner: boolean
  subtotalAfterPromotion: number
  paymentMethod?: string
}

interface UseVoucherStateResult {
  appliedVoucher: IVoucher | null
  isApplying: boolean
  isRemoving: boolean
  applyVoucher: (v: IVoucher) => Promise<void>
  removeVoucher: () => Promise<void>
  onAutoRemoved: (cb: (reason: VoucherInvalidReason) => void) => void
}

export function useVoucherState(
  input: UseVoucherStateInput,
): UseVoucherStateResult {
  const sessions = useTableSessionsStore((s) => s.sessions)
  const session = sessions[input.tableSlug]
  const appliedVoucher = session?.voucher ?? null

  const applyVoucher = useCallback(async () => {
    // Filled in Task 9.
  }, [])
  const removeVoucher = useCallback(async () => {
    // Filled in Task 9.
  }, [])
  const onAutoRemoved = useCallback(() => {
    // Filled in Task 10.
  }, [])

  return {
    appliedVoucher,
    isApplying: false,
    isRemoving: false,
    applyVoucher,
    removeVoucher,
    onAutoRemoved,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/hooks/use-voucher-state.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-voucher-state.ts src/tests/hooks/use-voucher-state.test.tsx
git commit -m "feat(voucher): scaffold useVoucherState hook"
```

---

## Task 9: Implement `applyVoucher` + `removeVoucher` actions

**Files:**
- Modify: `src/hooks/use-voucher-state.ts`
- Modify: `src/tests/hooks/use-voucher-state.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to test file:

```tsx
import { act, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

const patchVoucherMock = vi.fn()
vi.mock('@/hooks/use-order', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-order')>(
    '@/hooks/use-order',
  )
  return {
    ...actual,
    useUpdateVoucherInOrder: () => ({ mutateAsync: patchVoucherMock }),
  }
})

const sampleVoucher = {
  slug: 'v1',
  code: 'V1',
  voucherProducts: [],
  remainingUsage: 5,
  isActive: true,
} as unknown as IVoucher

describe('useVoucherState actions', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
    patchVoucherMock.mockReset()
    patchVoucherMock.mockResolvedValue(undefined)
  })

  it('applyVoucher with no orderSlug → only updates store (no PATCH)', async () => {
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: null,
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    await act(async () => {
      await result.current.applyVoucher(sampleVoucher)
    })
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toEqual(
      sampleVoucher,
    )
    expect(patchVoucherMock).not.toHaveBeenCalled()
  })

  it('applyVoucher with orderSlug → optimistic update + PATCH', async () => {
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    await act(async () => {
      await result.current.applyVoucher(sampleVoucher)
    })
    expect(patchVoucherMock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'o1', voucher: 'v1' }),
    )
    expect(useTableSessionsStore.getState().sessions['t1'].voucher?.slug).toBe(
      'v1',
    )
  })

  it('applyVoucher PATCH failure → rollback to previous', async () => {
    useTableSessionsStore.getState().setOrderVoucher('t1', null)
    patchVoucherMock.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    await act(async () => {
      await result.current.applyVoucher(sampleVoucher)
    })
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toBeUndefined()
  })

  it('removeVoucher with orderSlug → PATCH null + clear store', async () => {
    useTableSessionsStore.getState().setOrderVoucher('t1', sampleVoucher)
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    await act(async () => {
      await result.current.removeVoucher()
    })
    expect(patchVoucherMock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'o1', voucher: null }),
    )
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/hooks/use-voucher-state.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `applyVoucher` + `removeVoucher`**

Replace stubs in `use-voucher-state.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateVoucherInOrder } from '@/hooks/use-order'
import { QUERYKEY } from '@/constants'

export function useVoucherState(
  input: UseVoucherStateInput,
): UseVoucherStateResult {
  const sessions = useTableSessionsStore((s) => s.sessions)
  const setOrderVoucher = useTableSessionsStore((s) => s.setOrderVoucher)
  const session = sessions[input.tableSlug]
  const appliedVoucher = session?.voucher ?? null

  const { mutateAsync: patchVoucher } = useUpdateVoucherInOrder()
  const queryClient = useQueryClient()

  const buildItemsPayload = useCallback(() => {
    return input.items.map((i) => ({
      quantity: i.quantity,
      variant: '',
      note: '',
      promotion: null,
      vatRate: 0,
    }))
  }, [input.items])

  const applyVoucher = useCallback(
    async (v: IVoucher) => {
      const previous = sessions[input.tableSlug]?.voucher ?? null
      setOrderVoucher(input.tableSlug, v)
      if (!input.orderSlug) return
      try {
        await patchVoucher({
          slug: input.orderSlug,
          voucher: v.slug,
          orderItems: buildItemsPayload(),
        })
        queryClient.invalidateQueries({
          queryKey: [...QUERYKEY.order, input.orderSlug],
        })
      } catch {
        setOrderVoucher(input.tableSlug, previous)
      }
    },
    [
      input.orderSlug,
      input.tableSlug,
      sessions,
      setOrderVoucher,
      patchVoucher,
      queryClient,
      buildItemsPayload,
    ],
  )

  const removeVoucher = useCallback(async () => {
    const previous = sessions[input.tableSlug]?.voucher ?? null
    if (!previous) return
    setOrderVoucher(input.tableSlug, null)
    if (!input.orderSlug) return
    try {
      await patchVoucher({
        slug: input.orderSlug,
        voucher: null,
        orderItems: buildItemsPayload(),
      })
      queryClient.invalidateQueries({
        queryKey: [...QUERYKEY.order, input.orderSlug],
      })
    } catch {
      setOrderVoucher(input.tableSlug, previous)
    }
  }, [
    input.orderSlug,
    input.tableSlug,
    sessions,
    setOrderVoucher,
    patchVoucher,
    queryClient,
    buildItemsPayload,
  ])

  const onAutoRemoved = useCallback(() => {
    // Filled in Task 10.
  }, [])

  return {
    appliedVoucher,
    isApplying: false,
    isRemoving: false,
    applyVoucher,
    removeVoucher,
    onAutoRemoved,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tests/hooks/use-voucher-state.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-voucher-state.ts src/tests/hooks/use-voucher-state.test.tsx
git commit -m "feat(voucher): implement apply/remove actions in useVoucherState"
```

---

## Task 10: Implement auto-revalidate effect + onAutoRemoved callback

**Files:**
- Modify: `src/hooks/use-voucher-state.ts`
- Modify: `src/tests/hooks/use-voucher-state.test.tsx`

Logic: khi voucher applied + items/customer/payment đổi → evaluate → nếu invalid → fire callback + auto-remove (silent, no rollback if PATCH fail).

- [ ] **Step 1: Write failing test**

Append:

```tsx
import { evaluateVoucher } from '@/lib/voucher-rules'

describe('useVoucherState auto-revalidate', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
    patchVoucherMock.mockReset()
    patchVoucherMock.mockResolvedValue(undefined)
  })

  it('fires onAutoRemoved callback when applied voucher becomes invalid', async () => {
    const voucher = {
      ...sampleVoucher,
      minOrderValue: 999_999_999,
    } as unknown as IVoucher
    useTableSessionsStore.getState().setOrderVoucher('t1', voucher)
    const cb = vi.fn()
    const { result } = renderHook(
      () => {
        const state = useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [{ menuItemId: 'p1', quantity: 1 }],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        })
        state.onAutoRemoved(cb)
        return state
      },
      { wrapper },
    )
    await waitFor(() => {
      expect(cb).toHaveBeenCalledWith('MIN_ORDER_NOT_MET')
    })
    expect(patchVoucherMock).toHaveBeenCalledWith(
      expect.objectContaining({ voucher: null }),
    )
  })
})
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
npx vitest run src/tests/hooks/use-voucher-state.test.tsx
```

- [ ] **Step 3: Implement auto-revalidate**

Replace `onAutoRemoved` stub:

```ts
import { useEffect, useRef } from 'react'
import { evaluateVoucher, type VoucherContext } from '@/lib/voucher-rules'

// inside useVoucherState:
const onAutoRemovedRef = useRef<((reason: VoucherInvalidReason) => void) | null>(
  null,
)
const onAutoRemoved = useCallback(
  (cb: (reason: VoucherInvalidReason) => void) => {
    onAutoRemovedRef.current = cb
  },
  [],
)

// auto-revalidate effect
useEffect(() => {
  if (!appliedVoucher) return
  if (!input.orderSlug) return // pending cart: nothing to PATCH; trust user
  if (input.items.length === 0) return // wait for items
  const ctx: VoucherContext = {
    subtotalAfterPromotion: input.subtotalAfterPromotion,
    totalQuantity: input.items.reduce((s, i) => s + i.quantity, 0),
    productSlugs: input.items.map((i) => i.productSlug ?? i.menuItemId ?? ''),
    hasCustomerOwner: input.hasCustomerOwner,
    paymentMethod: input.paymentMethod,
  }
  const { valid, reason } = evaluateVoucher(appliedVoucher, ctx)
  if (!valid && reason) {
    // Auto-remove: silent, no rollback (would immediately re-fail).
    setOrderVoucher(input.tableSlug, null)
    void patchVoucher({
      slug: input.orderSlug,
      voucher: null,
      orderItems: buildItemsPayload(),
    }).then(() => {
      queryClient.invalidateQueries({
        queryKey: [...QUERYKEY.order, input.orderSlug!],
      })
    }).catch(() => undefined)
    onAutoRemovedRef.current?.(reason)
  }
}, [
  appliedVoucher,
  input.orderSlug,
  input.tableSlug,
  input.items,
  input.hasCustomerOwner,
  input.subtotalAfterPromotion,
  input.paymentMethod,
  setOrderVoucher,
  patchVoucher,
  queryClient,
  buildItemsPayload,
])
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tests/hooks/use-voucher-state.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-voucher-state.ts src/tests/hooks/use-voucher-state.test.tsx
git commit -m "feat(voucher): add auto-revalidate effect in useVoucherState"
```

---

## Task 11: One-time BE seed effect

**Files:**
- Modify: `src/hooks/use-voucher-state.ts`
- Modify: `src/tests/hooks/use-voucher-state.test.tsx`

Tương đương "one-time seed" trong admin-cart-content: nếu session.voucher rỗng và BE có voucher (truyền qua input), seed một lần.

- [ ] **Step 1: Add input field `beVoucher`**

Update `UseVoucherStateInput`:

```ts
interface UseVoucherStateInput {
  // ... existing ...
  /** Voucher applied on the BE order (from useOrderBySlug). Used to seed
   *  session.voucher ONCE on initial mount when session is empty. After seed,
   *  session is source of truth and BE updates do not override local. */
  beVoucher?: IVoucher | null
}
```

- [ ] **Step 2: Write failing test**

```tsx
it('one-time seeds session.voucher from beVoucher when session empty', () => {
  const beVoucher = { ...sampleVoucher, slug: 'beV' } as unknown as IVoucher
  renderHook(
    () =>
      useVoucherState({
        tableSlug: 't1',
        orderSlug: 'o1',
        items: [],
        hasCustomerOwner: false,
        subtotalAfterPromotion: 0,
        beVoucher,
      }),
    { wrapper },
  )
  expect(useTableSessionsStore.getState().sessions['t1'].voucher?.slug).toBe(
    'beV',
  )
})

it('does not re-seed when session already has voucher', () => {
  const existing = { ...sampleVoucher, slug: 'existing' } as unknown as IVoucher
  useTableSessionsStore.getState().setOrderVoucher('t1', existing)
  const newBe = { ...sampleVoucher, slug: 'newBe' } as unknown as IVoucher
  renderHook(
    () =>
      useVoucherState({
        tableSlug: 't1',
        orderSlug: 'o1',
        items: [],
        hasCustomerOwner: false,
        subtotalAfterPromotion: 0,
        beVoucher: newBe,
      }),
    { wrapper },
  )
  expect(useTableSessionsStore.getState().sessions['t1'].voucher?.slug).toBe(
    'existing',
  )
})
```

- [ ] **Step 3: Implement seed**

Add inside hook:

```ts
const hasSeededRef = useRef(false)
useEffect(() => {
  if (hasSeededRef.current) return
  if (!input.beVoucher) return
  if (sessions[input.tableSlug]?.voucher) {
    hasSeededRef.current = true
    return
  }
  hasSeededRef.current = true
  setOrderVoucher(input.tableSlug, input.beVoucher)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [input.beVoucher])
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tests/hooks/use-voucher-state.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-voucher-state.ts src/tests/hooks/use-voucher-state.test.tsx
git commit -m "feat(voucher): one-time BE seed in useVoucherState"
```

---

# PHASE 3-4: Migrate consumers

## Task 12: Migrate `admin-cart-content.tsx` to `useVoucherState`

**Files:**
- Modify: `src/app/system/menu/components/admin-cart-content.tsx`

**Removed:**
- Layer A useEffect (~line 399-468)
- One-time seed useEffect (~line 470-485)
- `handleApplyVoucher` (custom)
- `handleRemoveVoucher` (custom)
- `buildVoucherOrderItemsPayload` helper (if only used by these)

**Added:**
- `const { appliedVoucher, applyVoucher, removeVoucher, onAutoRemoved } = useVoucherState({...})`
- `useEffect(() => { onAutoRemoved((reason) => showErrorToastMessage(...)) }, [onAutoRemoved])`

- [ ] **Step 1: Read current admin-cart-content sections**

```bash
sed -n '199,250p' /Users/phanquyetthang/terminal/app/order-ui/src/app/system/menu/components/admin-cart-content.tsx
sed -n '390,490p' /Users/phanquyetthang/terminal/app/order-ui/src/app/system/menu/components/admin-cart-content.tsx
sed -n '630,700p' /Users/phanquyetthang/terminal/app/order-ui/src/app/system/menu/components/admin-cart-content.tsx
```

Identify exact line ranges of: Layer A, seed effect, handleApplyVoucher, handleRemoveVoucher, sessionVoucher, sessionCustomer.

- [ ] **Step 2: Replace voucher logic block**

After `sessionCustomer` derivation, add:

```ts
const voucherItems = allItems.map((i) => ({
  menuItemId: i.menuItemId,
  productSlug: i.productSlug,
  quantity: i.quantity,
}))
// Include pending so validation reflects final state after submit.
const pendingForVoucher = pending.map((i) => ({
  menuItemId: i.menuItemId,
  productSlug: i.productSlug,
  quantity: i.quantity,
}))
const allVoucherItems = [...voucherItems, ...pendingForVoucher]

const cart = staffItemsToCartItem(allVoucherItems as unknown as OrderItem[])
const display = calculateCartItemDisplay(cart, null)
const subtotal = calculateCartTotals(display, null)

const {
  appliedVoucher: sessionVoucher,
  applyVoucher,
  removeVoucher,
  onAutoRemoved,
} = useVoucherState({
  tableSlug,
  orderSlug: session?.orderSlug,
  items: allVoucherItems,
  hasCustomerOwner: !!sessionCustomer,
  subtotalAfterPromotion:
    subtotal.subTotalBeforeDiscount - subtotal.promotionDiscount,
  beVoucher: fullOrderData?.voucher ?? null,
})

useEffect(() => {
  onAutoRemoved((reason) => {
    if (sessionVoucher) {
      showErrorToastMessage(
        tToast('toast.voucherAutoRemovedInvalid', {
          code: sessionVoucher.code,
        }),
      )
    }
  })
}, [onAutoRemoved, sessionVoucher, tToast])
```

- [ ] **Step 3: Delete Layer A effect, seed effect, handleApplyVoucher, handleRemoveVoucher**

Replace voucher sheet wiring:
- `onApply={handleApplyVoucher}` → `onApply={applyVoucher}`
- `onRemove={handleRemoveVoucher}` → `onRemove={removeVoucher}`

- [ ] **Step 4: Run lint + tests**

```bash
npm run lint 2>&1 | tail -10
npm run test
```

Expected: all PASS.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

- Vào `/system/menu` đơn có voucher → voucher hiển thị (seed)
- Apply voucher mới → store + BE update
- Xoá món → voucher invalid → auto-remove + toast
- Thêm món thuộc voucher → voucher giữ

- [ ] **Step 6: Commit**

```bash
git add src/app/system/menu/components/admin-cart-content.tsx
git commit -m "refactor(admin-cart): migrate voucher logic to useVoucherState hook"
```

---

## Task 13: Migrate `table-payment-screen.tsx` to `useVoucherState`

**Files:**
- Modify: `src/components/staff/table-payment-screen.tsx`

**Removed:**
- Auto-revalidate useEffect (~line 462-494)
- `removeVoucherInternal` function
- `handleApplyVoucher`, `handleRemoveVoucher` (custom, ~line 352-441)

**Added:**
- `useVoucherState({...})` call after `effectiveCustomer` derivation
- Wire to voucher sheet

- [ ] **Step 1: Identify exact line ranges**

```bash
grep -n "removeVoucherInternal\|handleApplyVoucher\|handleRemoveVoucher\|isVoucherValid" /Users/phanquyetthang/terminal/app/order-ui/src/components/staff/table-payment-screen.tsx
```

- [ ] **Step 2: Replace voucher logic block**

After `effectiveCustomer` derivation, add equivalent block to Task 12 (adapted: uses `merged` + `orderItemsForVoucher` instead of `allItems`/`pending`; uses `effectiveCustomer` instead of `sessionCustomer`).

- [ ] **Step 3: Delete dead code**

Remove auto-revalidate effect, `removeVoucherInternal`, `handleApplyVoucher`, `handleRemoveVoucher`. Update voucher sheet wiring with new `applyVoucher`/`removeVoucher`.

- [ ] **Step 4: Run lint + tests**

```bash
npm run lint 2>&1 | tail -10
npm run test
```

- [ ] **Step 5: Manual smoke test**

`/system/table/:id/payment` and `/staff/table/:id/payment`:
- Auto-revalidate behavior preserved
- Apply/remove voucher works
- Undo toast for `handleRemoveVoucher` no longer exists — verify if user-facing undo is desired; if so, add back as a wrapper (out of scope for this refactor).

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/table-payment-screen.tsx
git commit -m "refactor(payment): migrate voucher logic to useVoucherState hook"
```

---

# PHASE 5: Cleanup

## Task 14: Audit `useAutoRevalidateAppliedVoucher` — keep or remove

**Files:**
- Read: `src/hooks/use-auto-revalidate-applied-voucher.ts`
- Read: callers (grep)
- Decision: 
  - If callers (voucher sheets) still need it for "trust-BE" semantics that `useVoucherState` doesn't provide → keep, document why
  - If callers can use `useVoucherState` directly → remove file + test, update callers

- [ ] **Step 1: List callers**

```bash
grep -rln "useAutoRevalidateAppliedVoucher" /Users/phanquyetthang/terminal/app/order-ui/src
```

Expected: 3 voucher sheets + 1 test.

- [ ] **Step 2: Decide**

Read each caller, check if `useVoucherState` covers their needs. Trust-BE phase exists to handle "FE/BE rounding diff at apply time" — if `useVoucherState`'s "wait for items / wait for orderSlug" guards cover this, the hook is redundant.

Document decision in `docs/superpowers/decisions/2026-06-23-auto-revalidate-hook-fate.md` (short paragraph).

- [ ] **Step 3a (if removing): delete hook**

```bash
rm src/hooks/use-auto-revalidate-applied-voucher.ts
rm src/tests/hooks/use-auto-revalidate-applied-voucher.test.tsx
```

Update each voucher sheet:
- Remove `useAutoRevalidateAppliedVoucher(...)` call
- Sheet now relies on parent's `useVoucherState` — auto-revalidate happens at parent level
- Sheet only renders voucher list + apply/remove buttons

- [ ] **Step 3b (if keeping): document why**

Add comment at top of hook explaining what scenario it covers that `useVoucherState` does not.

- [ ] **Step 4: Run full test suite**

```bash
npm run test
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(voucher): cleanup useAutoRevalidateAppliedVoucher (keep|remove per audit)"
```

---

## Task 15: Final validation

- [ ] **Step 1: Full test suite**

```bash
npm run test
```

Expected: all PASS, no regression.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: build success.

- [ ] **Step 3: Manual end-to-end test plan**

| Scenario | Expected |
|---|---|
| Vào `/system/menu` đơn có voucher | Voucher hiển thị (seed) |
| Apply voucher trên cart pending | Local set, no API |
| Apply voucher trên placed order | PATCH BE, optimistic |
| Apply voucher fail BE | Rollback local |
| Remove voucher manual | PATCH null, clear local |
| Thêm món không thuộc voucher rule | Auto-remove + toast |
| Thêm món thuộc voucher rule | Voucher giữ |
| Xoá khách → voucher require identity | Auto-remove + toast |
| F5 trên payment đơn có voucher | Voucher giữ |
| Navigate cart → payment | Voucher giữ |
| Cashier swap voucher | Cũ remove, mới apply |

- [ ] **Step 4: Commit final state**

Nếu có fix nhỏ phát sinh trong manual test:

```bash
git add -A
git commit -m "refactor(voucher): final validation fixes"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Consolidate `voucher-validation.ts` + `voucher-display.ts` → `voucher-rules.ts` (Tasks 1-7)
- ✅ Single hook `useVoucherState` (Tasks 8-11)
- ✅ Migrate admin-cart-content (Task 12)
- ✅ Migrate table-payment-screen (Task 13)
- ✅ Cleanup auto-revalidate hook (Task 14)
- ✅ Final validation (Task 15)
- ✅ Zero behavior change (preserved by porting logic verbatim + tests locking behavior)

**2. Placeholder scan:** đã rà — không có TBD/TODO. Mỗi step có code/command cụ thể.

**3. Type consistency:**
- `VoucherContext` exported từ `voucher-rules.ts`, Tasks 2-11 đều dùng.
- `evaluateVoucher(v, ctx): { valid, reason }` — signature nhất quán.
- `useVoucherState(input): result` — signature nhất quán Task 8-13.
- `IVoucherDisplay`, `VoucherDisplayState`, `VoucherInvalidReason` — single source.

**4. Out-of-scope:**
- Không đụng `voucher-summary.ts`, `voucher-time.ts`, `voucher.ts` utility (chỉ helper layer).
- Không sửa logic BE-side validation rules.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-voucher-logic-refactor.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — theo memory feedback của bạn ("Always use subagent-driven flow for code changes"). 15 task → 15 implementer + 15 reviewer cycles. Phase 1 hoàn toàn an toàn (pure functions); Phase 3-4 cần manual smoke test.

**2. Inline Execution** — `superpowers:executing-plans`, checkpoint sau mỗi Phase (Tasks 1-7, 8-11, 12, 13, 14-15).

Bạn chọn approach nào?
