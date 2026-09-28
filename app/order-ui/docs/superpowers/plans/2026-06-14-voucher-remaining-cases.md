# Voucher Remaining Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa 7 case voucher còn lỗi sau PR `feature/voucher-display-fix` — payment method, list state inconsistency, stale on reopen, admin orphan, admin cascade, reason chip on card, server-time skew.

**Architecture:** Mở rộng `VoucherValidationContext` thêm `paymentMethod`. Thêm module `server-time` đồng bộ qua axios response header. Thêm hook `useAccumulatedVoucherList` quản lý paginated list. Refactor render 6 sheet để dùng `getVoucherDisplayState` cho chip + disabled. Bật `staleTime: 0` + `refetchOnMount: 'always'` cho `vouchersForOrder`. Admin apply-voucher-sheet filter & cleanup orphan mapping.

**Tech Stack:** React 18, TypeScript, Zustand, TanStack Query v5, Axios, Moment, Vitest, react-i18next.

**Working dir for all paths:** `/Users/phanquyetthang/.config/superpowers/worktrees/terminal/voucher-display-fix/app/order-ui`

---

## Pre-flight

State khi bắt đầu plan này:
- Branch `feature/voucher-display-fix` (cùng branch với plan trước, kế thừa thay đổi).
- Foundation đã có: `src/lib/voucher-display.ts`, `src/hooks/use-voucher-display-list.ts`, `src/hooks/use-auto-revalidate-applied-voucher.ts`.
- Baseline: 581 tests pass, lint 0 errors, tsc clean.

Nếu engineer muốn isolated worktree riêng để dễ revert: tạo branch mới `feature/voucher-remaining-fix` từ `feature/voucher-display-fix`. Plan này không bắt buộc.

---

## File structure

### Create
- `src/lib/server-time.ts` — `serverNow`, `setServerTimeOffsetFromHeader`, `getServerTimeOffsetMs` (test seam).
- `src/hooks/use-accumulated-voucher-list.ts` — paginated accumulate + merge applied + search-code extras → `IVoucherDisplay[]`.
- `src/tests/lib/server-time.test.ts`.
- `src/tests/hooks/use-accumulated-voucher-list.test.tsx`.

### Modify
- `src/lib/voucher-display.ts` — thêm `paymentMethod` vào `VoucherValidationContext`, thêm reason `PAYMENT_METHOD_NOT_SUPPORTED`, thêm reason `CONFIG_CHANGED`.
- `src/lib/voucher-validation.ts` — sync expansion (giữ parity với display).
- `src/locales/vi/voucher.json`, `src/locales/en/voucher.json` — keys `paymentMethodNotSupported`, `configChanged`.
- `src/utils/voucher-time.ts` — thay `moment()` default bằng `moment(serverNow())`.
- `src/utils/http.ts` — response interceptor đọc `Date` header → cập nhật offset.
- `src/hooks/use-voucher.ts` — set `staleTime: 0` + `refetchOnMount: 'always'` cho `useVouchersForOrder` / `usePublicVouchersForOrder`. Invalidate `vouchersForOrder` ở `useUpdateVoucher` (admin).
- `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` — pass paymentMethod vào context, render chip qua display state.
- `src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx` — same.
- `src/components/app/sheet/voucher-list-sheet.tsx` — same (cart).
- `src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx` — same.
- `src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx` — same.
- `src/components/staff/staff-table-voucher-sheet.tsx` — pass paymentMethod, chip.
- `src/components/app/sheet/apply-voucher-sheet.tsx` (admin) — orphan filter + cleanup CTA.
- `CLAUDE.md` — short architecture note.

---

## Conventions

- TDD: red → green → refactor → commit.
- Commit prefix: `feat(voucher): ...`, `fix(voucher): ...`, `refactor(voucher): ...`, `test(voucher): ...`, `docs(voucher): ...`.
- Single-test runner: `npx vitest run <file>`.
- Lint: `npm run lint -- <file>`.

---

## Phase A — Foundation: paymentMethod context & server-time

### Task 1: Expand `VoucherValidationContext` with `paymentMethod` + reason

**Files:**
- Modify: `src/lib/voucher-display.ts`
- Modify: `src/lib/voucher-validation.ts`
- Test: `src/tests/lib/voucher-display.test.ts` (existing)

- [ ] **Step 1: Viết test fail**

Append to `src/tests/lib/voucher-display.test.ts` (before `describe('voucherReasonI18nKey'`):

```ts
import { PaymentMethod } from '@/constants'

describe('paymentMethod gate', () => {
  it('INELIGIBLE with PAYMENT_METHOD_NOT_SUPPORTED when voucher requires method not in context', () => {
    const dv = {
      ...v('vp', {
        voucherPaymentMethods: [
          { paymentMethod: PaymentMethod.BANK_TRANSFER },
        ] as unknown as IVoucher['voucherPaymentMethods'],
      }),
      _source: 'eligible' as const,
      _isApplied: false,
    } as IVoucherDisplay
    const ctx = { ...baseCtx, paymentMethod: PaymentMethod.CASH }
    const s = getVoucherDisplayState(dv, ctx)
    expect(s.kind).toBe('INELIGIBLE')
    if (s.kind === 'INELIGIBLE') {
      expect(s.reason).toBe('PAYMENT_METHOD_NOT_SUPPORTED')
    }
  })

  it('passes when paymentMethod is omitted (legacy callers)', () => {
    const dv = {
      ...v('vp', {
        voucherPaymentMethods: [
          { paymentMethod: PaymentMethod.BANK_TRANSFER },
        ] as unknown as IVoucher['voucherPaymentMethods'],
      }),
      _source: 'eligible' as const,
      _isApplied: false,
    } as IVoucherDisplay
    expect(getVoucherDisplayState(dv, baseCtx).kind).toBe('AVAILABLE')
  })

  it('passes when voucher has no payment method restriction', () => {
    const dv = {
      ...v('vp'),
      _source: 'eligible' as const,
      _isApplied: false,
    } as IVoucherDisplay
    const ctx = { ...baseCtx, paymentMethod: PaymentMethod.CASH }
    expect(getVoucherDisplayState(dv, ctx).kind).toBe('AVAILABLE')
  })
})
```

- [ ] **Step 2: Test FAIL** — `npx vitest run src/tests/lib/voucher-display.test.ts`

- [ ] **Step 3: Update `VoucherValidationContext` and reason**

In `src/lib/voucher-display.ts`, modify these blocks:

```ts
// Add to VoucherInvalidReason union:
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
```

Modify `VoucherValidationContext`:

```ts
export interface VoucherValidationContext {
  subtotalAfterPromotion: number
  totalQuantity: number
  productSlugs: string[]
  hasCustomerOwner: boolean
  /** Current payment method on the order/cart. Omit if not yet chosen. */
  paymentMethod?: string
}
```

In `firstInvalidReason`, after the `IDENTITY_REQUIRED` check and BEFORE `MIN_ORDER_NOT_MET`, add:

```ts
const methodRestriction =
  v.voucherPaymentMethods?.map((m) => m.paymentMethod) ?? []
if (
  methodRestriction.length > 0 &&
  ctx.paymentMethod !== undefined &&
  !methodRestriction.includes(ctx.paymentMethod)
) {
  return 'PAYMENT_METHOD_NOT_SUPPORTED'
}
```

Add to `REASON_KEYS`:

```ts
PAYMENT_METHOD_NOT_SUPPORTED: 'voucher.reason.paymentMethodNotSupported',
CONFIG_CHANGED: 'voucher.reason.configChanged',
```

- [ ] **Step 4: Mirror in `src/lib/voucher-validation.ts`**

Edit `VoucherValidationContext` and add same `paymentMethod?: string`. Add the `methodRestriction` check inside `isVoucherValid` (place it as another conjunct at the end of the AND chain — guarded by `ctx.paymentMethod !== undefined`).

Inside `getVoucherErrorMessage`, push new entry into `errorChecks`:

```ts
{
  condition:
    (voucher.voucherPaymentMethods?.length || 0) > 0 &&
    ctx.paymentMethod !== undefined &&
    !voucher.voucherPaymentMethods!
      .map((m) => m.paymentMethod)
      .includes(ctx.paymentMethod),
  message: t('voucher.reason.paymentMethodNotSupported'),
},
```

- [ ] **Step 5: Test PASS**

Run `npx vitest run src/tests/lib/voucher-display.test.ts` — expect new 3 cases pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/voucher-display.ts src/lib/voucher-validation.ts src/tests/lib/voucher-display.test.ts
git commit -m "feat(voucher): add paymentMethod gate to VoucherValidationContext"
```

---

### Task 2: i18n for new reasons

**Files:**
- Modify: `src/locales/vi/voucher.json`
- Modify: `src/locales/en/voucher.json`

- [ ] **Step 1: Add vi keys**

Inside `voucher.reason` object in `src/locales/vi/voucher.json`, add:

```json
"paymentMethodNotSupported": "Voucher không áp dụng cho phương thức thanh toán hiện tại",
"configChanged": "Cấu hình voucher đã thay đổi, vui lòng chọn lại"
```

Inside `voucher.autoRemove` object, add:

```json
"PAYMENT_METHOD_NOT_SUPPORTED": "Phương thức thanh toán không được hỗ trợ",
"CONFIG_CHANGED": "Cấu hình voucher đã thay đổi"
```

- [ ] **Step 2: Add en keys** in `src/locales/en/voucher.json`:

```json
"paymentMethodNotSupported": "Voucher does not apply to the current payment method",
"configChanged": "Voucher configuration changed, please re-select"
```

```json
"PAYMENT_METHOD_NOT_SUPPORTED": "Payment method not supported",
"CONFIG_CHANGED": "Voucher configuration changed"
```

- [ ] **Step 3: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/vi/voucher.json','utf8')); JSON.parse(require('fs').readFileSync('src/locales/en/voucher.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add src/locales/vi/voucher.json src/locales/en/voucher.json
git commit -m "feat(voucher): i18n keys for paymentMethod & configChanged reasons"
```

---

### Task 3: Server-time offset module

**Files:**
- Create: `src/lib/server-time.ts`
- Test: `src/tests/lib/server-time.test.ts`

- [ ] **Step 1: Viết test fail**

```ts
// src/tests/lib/server-time.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  serverNow,
  setServerTimeOffsetFromHeader,
  getServerTimeOffsetMs,
  _resetServerTimeOffsetForTests,
} from '@/lib/server-time'

describe('server-time offset', () => {
  beforeEach(() => {
    _resetServerTimeOffsetForTests()
  })

  it('serverNow equals Date.now() when no offset set', () => {
    const before = Date.now()
    const t = serverNow()
    const after = Date.now()
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(after)
  })

  it('updates offset from valid HTTP Date header', () => {
    const fakeNow = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow)
    // Server clock is 5 minutes ahead.
    const serverDate = new Date(fakeNow + 5 * 60_000).toUTCString()
    setServerTimeOffsetFromHeader(serverDate)
    expect(getServerTimeOffsetMs()).toBe(5 * 60_000)
    expect(serverNow()).toBe(fakeNow + 5 * 60_000)
    vi.restoreAllMocks()
  })

  it('ignores invalid / missing Date header', () => {
    setServerTimeOffsetFromHeader(undefined)
    expect(getServerTimeOffsetMs()).toBe(0)
    setServerTimeOffsetFromHeader('not-a-date')
    expect(getServerTimeOffsetMs()).toBe(0)
  })

  it('smooths offset (only updates when |delta| > 1s) to avoid jitter', () => {
    const fakeNow = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow)
    setServerTimeOffsetFromHeader(new Date(fakeNow + 10_000).toUTCString())
    expect(getServerTimeOffsetMs()).toBe(10_000)
    // Subsequent header with tiny delta (within 1s) should not jitter offset.
    setServerTimeOffsetFromHeader(new Date(fakeNow + 10_500).toUTCString())
    expect(getServerTimeOffsetMs()).toBe(10_000)
    // Larger drift updates offset.
    setServerTimeOffsetFromHeader(new Date(fakeNow + 12_000).toUTCString())
    expect(getServerTimeOffsetMs()).toBe(12_000)
    vi.restoreAllMocks()
  })
})
```

- [ ] **Step 2: Test FAIL** — `npx vitest run src/tests/lib/server-time.test.ts`

- [ ] **Step 3: Implement**

```ts
// src/lib/server-time.ts
let offsetMs = 0
const SMOOTHING_THRESHOLD_MS = 1_000

/** Returns Date.now() corrected by the most recent server offset. */
export function serverNow(): number {
  return Date.now() + offsetMs
}

export function getServerTimeOffsetMs(): number {
  return offsetMs
}

/**
 * Update offset from an HTTP Date header. Ignores invalid input. Applies
 * a small dead-band so 200-ms jitter on every request doesn't churn the
 * value (which would invalidate React-Query caches keyed off serverNow()).
 */
export function setServerTimeOffsetFromHeader(header: string | undefined): void {
  if (!header) return
  const parsed = Date.parse(header)
  if (Number.isNaN(parsed)) return
  const next = parsed - Date.now()
  if (Math.abs(next - offsetMs) <= SMOOTHING_THRESHOLD_MS) return
  offsetMs = next
}

/** Test-only seam. Do not call from production code. */
export function _resetServerTimeOffsetForTests(): void {
  offsetMs = 0
}
```

- [ ] **Step 4: Test PASS**

Run `npx vitest run src/tests/lib/server-time.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-time.ts src/tests/lib/server-time.test.ts
git commit -m "feat(voucher): server-time offset helper (case 19 clock skew)"
```

---

### Task 4: Use `serverNow()` in voucher-time + voucher-display

**Files:**
- Modify: `src/utils/voucher-time.ts`
- Modify: `src/lib/voucher-display.ts`

- [ ] **Step 1: Update voucher-time.ts default `now`**

Replace the entire file with:

```ts
import moment, { Moment } from 'moment'
import { IVoucher } from '@/types/voucher.type'
import { serverNow } from '@/lib/server-time'

const GRACE_PERIOD_MINUTES = 30

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const defaultNow = (): Moment => moment(serverNow())

export const isVoucherExpired = (voucher: IVoucher, now: Moment = defaultNow()): boolean => {
  const endWithGrace = moment.utc(voucher.endDate).add(GRACE_PERIOD_MINUTES, 'minutes')
  return endWithGrace.isBefore(now)
}

export const isVoucherInActiveTimeWindow = (
  voucher: IVoucher,
  now: Moment = defaultNow(),
): boolean => {
  const { activeStartTime, activeEndTime } = voucher
  if (!activeStartTime || !activeEndTime) return true

  const nowMinutes = now.hours() * 60 + now.minutes()
  const startMinutes = toMinutes(activeStartTime)
  const endWithGrace = toMinutes(activeEndTime) + GRACE_PERIOD_MINUTES

  if (endWithGrace > 1439) {
    const wrappedEnd = endWithGrace - 1440
    return nowMinutes >= startMinutes || nowMinutes <= wrappedEnd
  }

  return nowMinutes >= startMinutes && nowMinutes <= endWithGrace
}
```

- [ ] **Step 2: Update voucher-display.ts sevenAm to use serverNow**

In `src/lib/voucher-display.ts`, `firstInvalidReason`, change:

```ts
const sevenAm = moment().set({
  hour: 7,
  minute: 0,
  second: 0,
  millisecond: 0,
})
```

to:

```ts
import { serverNow } from '@/lib/server-time'  // add to existing imports

const sevenAm = moment(serverNow()).set({
  hour: 7,
  minute: 0,
  second: 0,
  millisecond: 0,
})
```

- [ ] **Step 3: Verify existing tests still pass**

```bash
npx vitest run src/tests/utils/voucher-time.test.ts src/tests/lib/voucher-display.test.ts src/tests/lib/voucher-validation.test.ts
```

Expected: All pass — `serverNow()` defaults to `Date.now()` until offset set.

- [ ] **Step 4: Commit**

```bash
git add src/utils/voucher-time.ts src/lib/voucher-display.ts
git commit -m "fix(voucher): use serverNow() for expiry/time-window checks"
```

---

### Task 5: Wire axios interceptor to update offset

**Files:**
- Modify: `src/utils/http.ts:324-329`

- [ ] **Step 1: Add import + interceptor logic**

In `src/utils/http.ts`, add to the imports section (near existing imports at top):

```ts
import { setServerTimeOffsetFromHeader } from '@/lib/server-time'
```

Modify the success handler of the response interceptor (around line 325) to also extract Date header:

```ts
axiosInstance.interceptors.response.use(
  (response) => {
    useLoadingStore.getState().setIsLoading(false)
    if (!response.config?.doNotShowLoading) setProgressBarDone()
    const dateHeader = response.headers?.date as string | undefined
    setServerTimeOffsetFromHeader(dateHeader)
    return response
  },
  async (error) => {
    // ...existing code unchanged
```

- [ ] **Step 2: Smoke check (manual)**

This change has no automated test (would need real HTTP roundtrip). Verify by `npm run dev` later — the helper is exercised by every API response, and tests cover the helper itself.

- [ ] **Step 3: Commit**

```bash
git add src/utils/http.ts
git commit -m "feat(voucher): axios response interceptor updates server-time offset"
```

---

## Phase B — Stale-on-reopen (Case 11)

### Task 6: `vouchersForOrder` query — always refetch on mount

**Files:**
- Modify: `src/hooks/use-voucher.ts:84-105`

- [ ] **Step 1: Edit `useVouchersForOrder` and `usePublicVouchersForOrder`**

Replace both blocks with:

```ts
// Vouchers for order
//
// staleTime: 0 + refetchOnMount: 'always' ensure that opening the sheet after
// any pause refetches the eligible list. Voucher status (remainingUsage,
// isActive, voucherProducts) changes frequently in production and cached data
// after even 1 minute can mislead the user. The 30s auto-revalidate poll plus
// these settings together keep the sheet honest.
export const useVouchersForOrder = (
  params?: IGetAllVoucherRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchersForOrder, params],
    queryFn: () => getVouchersForOrder(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
export const usePublicVouchersForOrder = (
  params?: IGetAllVoucherRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchers, params],
    queryFn: () => getPublicVouchersForOrder(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
```

- [ ] **Step 2: Run all tests to confirm no regression**

```bash
npm run test
```

Expected: 581+ tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-voucher.ts
git commit -m "fix(voucher): refetch eligible vouchers on every sheet open"
```

---

## Phase C — Sheet wiring: paymentMethod, cascade trigger, reason chip

### Task 7: Helper hook `useVoucherDisplayItems`

Wraps an already-accumulated `IVoucher[]` (from each sheet's `localVoucherList`) into the merged `IVoucherDisplay[]` with applied snapshot and extras. Keeps each sheet's existing pagination logic intact.

**Files:**
- Create: `src/hooks/use-voucher-display-items.ts`
- Test: `src/tests/hooks/use-voucher-display-items.test.tsx`

- [ ] **Step 1: Viết test fail**

```tsx
// src/tests/hooks/use-voucher-display-items.test.tsx
import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { IVoucher } from '@/types'
import { useVoucherDisplayItems } from '@/hooks/use-voucher-display-items'

const v = (slug: string, extra: Partial<IVoucher> = {}): IVoucher =>
  ({ slug, code: slug.toUpperCase(), ...extra }) as IVoucher

describe('useVoucherDisplayItems', () => {
  it('marks eligible items + applied + extras with correct flags', () => {
    const { result } = renderHook(() =>
      useVoucherDisplayItems({
        items: [v('a'), v('b')],
        applied: v('c'),
        extras: [v('d')],
      }),
    )
    const byslug = new Map(result.current.map((x) => [x.slug, x]))
    expect(byslug.get('a')?._source).toBe('eligible')
    expect(byslug.get('a')?._isApplied).toBe(false)
    expect(byslug.get('c')?._source).toBe('applied_only')
    expect(byslug.get('c')?._isApplied).toBe(true)
    expect(byslug.get('d')?._source).toBe('eligible')
    expect(byslug.get('d')?._isApplied).toBe(false)
  })

  it('returns referentially stable output when inputs do not change', () => {
    const items = [v('a')]
    const { result, rerender } = renderHook(
      ({ items }: { items: IVoucher[] }) =>
        useVoucherDisplayItems({ items, applied: null }),
      { initialProps: { items } },
    )
    const first = result.current
    rerender({ items })
    expect(result.current).toBe(first)
  })
})
```

- [ ] **Step 2: Test FAIL** — `npx vitest run src/tests/hooks/use-voucher-display-items.test.tsx`

- [ ] **Step 3: Implement**

```ts
// src/hooks/use-voucher-display-items.ts
import { useMemo } from 'react'
import {
  mergeVoucherSources,
  type IVoucherDisplay,
} from '@/lib/voucher-display'
import type { IVoucher } from '@/types'

interface Args {
  /** Already-accumulated voucher items (from the sheet's local pagination state). */
  items: IVoucher[]
  /** Voucher currently applied to the order/cart. */
  applied: IVoucher | null
  /** Extra vouchers (e.g. result of input-code search). */
  extras?: IVoucher[]
}

/**
 * Composes the final display list each sheet shows. Centralises the dedupe
 * order: extras-first (so a user-typed code stays at top), eligible items,
 * then the applied snapshot is merged in regardless of presence.
 */
export function useVoucherDisplayItems({
  items,
  applied,
  extras,
}: Args): IVoucherDisplay[] {
  return useMemo(() => {
    const seen = new Set(items.map((v) => v.slug))
    const head = (extras ?? []).filter((v) => !seen.has(v.slug))
    return mergeVoucherSources([...head, ...items], applied)
  }, [items, applied, extras])
}
```

- [ ] **Step 4: Test PASS** and **export** from `src/hooks/index.ts`

Edit `src/hooks/index.ts` and append after the existing `use-auto-revalidate-applied-voucher` export:

```ts
export * from './use-voucher-display-items'
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-voucher-display-items.ts src/hooks/index.ts src/tests/hooks/use-voucher-display-items.test.tsx
git commit -m "feat(voucher): useVoucherDisplayItems composes final display list per sheet"
```

---

### Task 8: Wire `paymentMethod` + chip in `staff-voucher-list-sheet-in-payment.tsx`

**Files:**
- Modify: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx`

- [ ] **Step 1: Pass `paymentMethod` into the auto-revalidate context**

Locate the existing `useAutoRevalidateAppliedVoucher({ ...context: { ... } })` call (added in previous plan). Modify the `context` object to include `paymentMethod`:

```ts
useAutoRevalidateAppliedVoucher({
  appliedVoucher: orderData?.voucher ?? null,
  context: {
    subtotalAfterPromotion: minOrderValue,
    totalQuantity: nonGiftOrderItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: nonGiftOrderItems.map(i => i.variant.product.slug),
    hasCustomerOwner: isCustomerOwner,
    paymentMethod,    // already destructured earlier in the file
  },
  onAutoRemove: (reason) => {
    // ...unchanged
  },
})
```

- [ ] **Step 2: Render reason chip in `renderVoucherCard`**

Add imports at top of file (next to existing `voucherReasonI18nKey`):

```ts
import {
  getVoucherDisplayState,
  voucherReasonI18nKey,
  type VoucherValidationContext,
} from '@/lib/voucher-display'
import { useVoucherDisplayItems } from '@/hooks'
```

Just before `renderVoucherCard` definition, derive context + display items once:

```ts
const validationCtx: VoucherValidationContext = useMemo(
  () => ({
    subtotalAfterPromotion: minOrderValue,
    totalQuantity: nonGiftOrderItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: nonGiftOrderItems.map((i) => i.variant.product.slug),
    hasCustomerOwner: isCustomerOwner,
    paymentMethod,
  }),
  [minOrderValue, nonGiftOrderItems, isCustomerOwner, paymentMethod],
)

const displayItems = useVoucherDisplayItems({
  items: localVoucherList,
  applied: orderData?.voucher ?? null,
  extras: specificVoucher?.result ? [specificVoucher.result] : [],
})

const displayBySlug = useMemo(() => {
  const map = new Map<string, ReturnType<typeof getVoucherDisplayState>>()
  for (const d of displayItems) {
    map.set(d.slug, getVoucherDisplayState(d, validationCtx))
  }
  return map
}, [displayItems, validationCtx])
```

Find the JSX block inside `renderVoucherCard` where `errorMessage` is rendered (the `<span className="text-xs italic text-destructive">`). Replace that span's child with:

```tsx
{(() => {
  const state = displayBySlug.get(voucher.slug)
  if (!state) return errorMessage
  if ('reason' in state) return t(voucherReasonI18nKey(state.reason))
  return ''
})()}
```

- [ ] **Step 3: Lint + run tests**

```bash
npm run lint -- src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx
npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx
git commit -m "feat(voucher): staff payment sheet — paymentMethod gate + reason chip via display state"
```

---

### Task 9: Same wiring — `client-voucher-list-sheet-in-payment.tsx`

**Files:**
- Modify: `src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx`

- [ ] **Step 1: Pass `paymentMethod` into auto-revalidate context** (the `paymentMethod` variable is already defined in this file; locate the `useAutoRevalidateAppliedVoucher({ ... })` block and add `paymentMethod` to its `context` exactly as in Task 8 step 1).

- [ ] **Step 2: Add display-state-based chip rendering**

Imports — append `useVoucherDisplayItems` to the `@/hooks` named imports and add `getVoucherDisplayState` + `VoucherValidationContext` to the existing `@/lib/voucher-display` import.

Right before `renderVoucherCard` (search for `const renderVoucherCard`), insert:

```ts
const validationCtx: VoucherValidationContext = useMemo(
  () => ({
    subtotalAfterPromotion:
      (cartTotals?.subTotalBeforeDiscount || 0) -
      (cartTotals?.promotionDiscount || 0),
    totalQuantity: nonGiftOrderItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: nonGiftOrderItems.map((i) => i.variant.product.slug),
    hasCustomerOwner: isCustomerOwner,
    paymentMethod,
  }),
  [cartTotals, nonGiftOrderItems, isCustomerOwner, paymentMethod],
)

const displayItems = useVoucherDisplayItems({
  items: localVoucherList,
  applied: orderData?.voucher ?? null,
  extras: specificVoucher?.result ? [specificVoucher.result] : [],
})

const displayBySlug = useMemo(() => {
  const map = new Map<string, ReturnType<typeof getVoucherDisplayState>>()
  for (const d of displayItems) {
    map.set(d.slug, getVoucherDisplayState(d, validationCtx))
  }
  return map
}, [displayItems, validationCtx])
```

Then update the error-message span (same pattern as Task 8 step 2).

- [ ] **Step 3: Lint + test**

```bash
npm run lint -- src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx
npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx
git commit -m "feat(voucher): client payment sheet — paymentMethod gate + reason chip"
```

---

### Task 10: Same wiring — `voucher-list-sheet.tsx` (customer cart)

**Files:**
- Modify: `src/components/app/sheet/voucher-list-sheet.tsx`

- [ ] **Step 1: Add `paymentMethod` to auto-revalidate context**

Locate the `useAutoRevalidateAppliedVoucher` call. Update `context.paymentMethod` to `cartItems?.paymentMethod`.

- [ ] **Step 2: Compose display state**

Imports: append `useVoucherDisplayItems` to `@/hooks` named imports; add `getVoucherDisplayState`, `VoucherValidationContext` to existing `@/lib/voucher-display` import.

Find `renderVoucherCard`. Insert before:

```ts
const validationCtx: VoucherValidationContext = useMemo(
  () => ({
    subtotalAfterPromotion:
      (cartTotals?.subTotalBeforeDiscount || 0) -
      (cartTotals?.promotionDiscount || 0),
    totalQuantity: nonGiftOrderItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: nonGiftOrderItems.map((i) => i.variant.product.slug),
    hasCustomerOwner: isCustomerOwner,
    paymentMethod: cartItems?.paymentMethod,
  }),
  [cartTotals, nonGiftOrderItems, isCustomerOwner, cartItems?.paymentMethod],
)

const displayItems = useVoucherDisplayItems({
  items: localVoucherList,
  applied: cartItems?.voucher ?? null,
})

const displayBySlug = useMemo(() => {
  const map = new Map<string, ReturnType<typeof getVoucherDisplayState>>()
  for (const d of displayItems) {
    map.set(d.slug, getVoucherDisplayState(d, validationCtx))
  }
  return map
}, [displayItems, validationCtx])
```

Update error-message span same pattern.

- [ ] **Step 3: Lint + test + commit**

```bash
npm run lint -- src/components/app/sheet/voucher-list-sheet.tsx
git add src/components/app/sheet/voucher-list-sheet.tsx
git commit -m "feat(voucher): cart voucher sheet — paymentMethod gate + reason chip"
```

---

### Task 11: Same wiring — `staff-table-voucher-sheet.tsx`

**Files:**
- Modify: `src/components/staff/staff-table-voucher-sheet.tsx`

- [ ] **Step 1: Extend `Props` and `ctx`**

Find `interface Props` and add:

```ts
/** Current payment method on the table session (optional). */
paymentMethod?: string
```

Locate `const ctx: VoucherValidationContext = useMemo(() => ({ ... }))`. Update to include `paymentMethod`:

```ts
const ctx: VoucherValidationContext = useMemo(
  () => ({
    subtotalAfterPromotion:
      totals.subTotalBeforeDiscount - totals.promotionDiscount,
    totalQuantity: allItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: allItems.map((i) => i.productSlug ?? i.menuItemId),
    hasCustomerOwner: !!customer,
    paymentMethod,
  }),
  [totals, allItems, customer, paymentMethod],
)
```

Add `paymentMethod` to the destructured props at the function signature.

- [ ] **Step 2: Use chip for invalid voucher message in `renderCard`**

Find `const errorMsg = !isValid ? getVoucherErrorMessage(v, ctx, t) : ''`. `getVoucherErrorMessage` now also surfaces the payment-method message because Task 1 added it. No code change needed in the card other than verifying it renders. Smoke verify by reading the JSX.

- [ ] **Step 3: Find the only call site of `StaffTableVoucherSheet` and pass `paymentMethod`**

Run grep to locate:

```bash
grep -rn "StaffTableVoucherSheet" src/ --include="*.tsx" | grep -v test
```

At each call site, add `paymentMethod={...}` from whatever the parent has (likely the table session state). If parent doesn't have it yet, leave the prop undefined — it's optional.

- [ ] **Step 4: Lint + test + commit**

```bash
npm run lint -- src/components/staff/staff-table-voucher-sheet.tsx
git add src/components/staff/staff-table-voucher-sheet.tsx
git commit -m "feat(voucher): staff-table-voucher-sheet — paymentMethod prop"
```

---

### Task 12: Same wiring — `staff-voucher-list-sheet-in-update-order-with-local-storage.tsx`

**Files:**
- Modify: `src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx`

- [ ] **Step 1: Add `paymentMethod` to auto-revalidate context** (variable `paymentMethod` is already in scope from the `orderDraft`).

- [ ] **Step 2: Add display-state context + map (mirror Task 8 step 2 but using `orderDraft?.voucher` and the existing `nonGiftOrderItems`):**

```ts
const validationCtx: VoucherValidationContext = useMemo(
  () => ({
    subtotalAfterPromotion: minOrderValue,
    totalQuantity: nonGiftOrderItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: nonGiftOrderItems.map((i) => i.productSlug ?? ''),
    hasCustomerOwner: isCustomerOwner,
    paymentMethod,
  }),
  [minOrderValue, nonGiftOrderItems, isCustomerOwner, paymentMethod],
)

const displayItems = useVoucherDisplayItems({
  items: localVoucherList,
  applied: orderDraft?.voucher ?? null,
  extras: specificVoucher?.result ? [specificVoucher.result] : [],
})

const displayBySlug = useMemo(() => {
  const map = new Map<string, ReturnType<typeof getVoucherDisplayState>>()
  for (const d of displayItems) {
    map.set(d.slug, getVoucherDisplayState(d, validationCtx))
  }
  return map
}, [displayItems, validationCtx])
```

Update error-message span same pattern as Task 8 step 2.

- [ ] **Step 3: Lint + commit**

```bash
npm run lint -- src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx
git add src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx
git commit -m "feat(voucher): staff update-order sheet — paymentMethod gate + reason chip"
```

---

### Task 13: Same wiring — `client-voucher-list-sheet-in-update-order-with-local-storage.tsx`

**Files:**
- Modify: `src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx`

- [ ] **Step 1-3: Mirror Task 12 exactly** (file has the same structure; `paymentMethod` is already defined in scope, `orderDraft?.voucher` is the applied snapshot).

```ts
const validationCtx: VoucherValidationContext = useMemo(
  () => ({
    subtotalAfterPromotion: minOrderValue,
    totalQuantity: nonGiftOrderItems.reduce((s, i) => s + i.quantity, 0),
    productSlugs: nonGiftOrderItems.map((i) => i.productSlug ?? ''),
    hasCustomerOwner: isCustomerOwner,
    paymentMethod,
  }),
  [minOrderValue, nonGiftOrderItems, isCustomerOwner, paymentMethod],
)

const displayItems = useVoucherDisplayItems({
  items: localVoucherList,
  applied: orderDraft?.voucher ?? null,
  extras: specificVoucher?.result ? [specificVoucher.result] : [],
})

const displayBySlug = useMemo(() => {
  const map = new Map<string, ReturnType<typeof getVoucherDisplayState>>()
  for (const d of displayItems) {
    map.set(d.slug, getVoucherDisplayState(d, validationCtx))
  }
  return map
}, [displayItems, validationCtx])
```

Update error-message span same pattern, including `paymentMethod` in auto-revalidate context.

- [ ] **Step 2: Lint + commit**

```bash
npm run lint -- src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx
git add src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx
git commit -m "feat(voucher): client update-order sheet — paymentMethod gate + reason chip"
```

---

## Phase D — List inconsistency cleanup (Case 9)

### Task 14: Dedup safeguard in `localVoucherList` accumulators

The full refactor to replace `localVoucherList` is out of scope (would touch ~1000 lines per sheet). Instead, add a dedupe pass in the accumulator effect so duplicates never reach state — small change, large UX win.

**Files:**
- Modify: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx`
- Modify: `src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx`
- Modify: `src/components/app/sheet/voucher-list-sheet.tsx`
- Modify: `src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx`
- Modify: `src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx`

In each file, locate the `setLocalVoucherList(prevList => { ... })` accumulator (search for `combined.filter((v, index, self)` — they all use the same dedupe pattern). The dedupe is already present for the append path BUT the replace path (page 1 / empty list) does not dedupe between `currentData.items`, search code, and applied. Add a final dedupe to the replace path.

- [ ] **Step 1: For each of the 5 sheets, find this snippet:**

```ts
if (currentPage === 1 || localVoucherList.length === 0) {
  let newList = [...(currentData.items || [])]
  // search code injection
  // applied voucher injection
  setLocalVoucherList(newList)
}
```

Wrap `setLocalVoucherList(newList)` so it dedupes:

```ts
if (currentPage === 1 || localVoucherList.length === 0) {
  let newList = [...(currentData.items || [])]
  if (specificVoucher?.result) {
    const existingIndex = newList.findIndex(v => v.slug === specificVoucher.result.slug)
    if (existingIndex === -1) {
      newList = [specificVoucher.result, ...newList]
    }
  }
  // applied voucher injection (unchanged)
  // FINAL dedupe — prevents the same slug appearing twice if upstream sources overlap
  const seen = new Set<string>()
  const deduped = newList.filter((v) => {
    if (seen.has(v.slug)) return false
    seen.add(v.slug)
    return true
  })
  setLocalVoucherList(deduped)
}
```

(Adjust applied voucher injection variable name as appropriate per file — `orderData?.voucher`, `cartItems?.voucher`, or `orderDraft?.voucher`.)

- [ ] **Step 2: Lint + run test on each modified file**

```bash
npm run lint
npm run test
```

- [ ] **Step 3: Commit**

```bash
git add src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx \
        src/components/app/sheet/client-voucher-list-sheet-in-payment.tsx \
        src/components/app/sheet/voucher-list-sheet.tsx \
        src/components/app/sheet/staff-voucher-list-sheet-in-update-order-with-local-storage.tsx \
        src/components/app/sheet/client-voucher-list-sheet-in-update-order-with-local-storage.tsx
git commit -m "fix(voucher): dedupe voucher list across pagination/search/applied sources"
```

---

## Phase E — Admin orphan handling (Case 13)

### Task 15: Skip orphan voucher-product rows + cleanup hint

**Files:**
- Modify: `src/app/system/voucher/components/page.tsx` (admin tab listing applied products)

First locate the admin component that lists `voucher.voucherProducts`:

```bash
grep -rn "voucherProducts" src/app/system/voucher/ --include="*.tsx" | head
```

Likely candidates:
- `src/app/system/voucher/components/page.tsx`
- `src/app/system/voucher/components/voucher-applied-products-tab.tsx`

- [ ] **Step 1: Add filter + warning banner**

In whichever component renders the applied-products table, wrap the source data:

```ts
const safeAppliedProducts = useMemo(
  () =>
    (voucher.voucherProducts ?? []).filter(
      (vp) => !!vp.product?.slug && !!vp.product,
    ),
  [voucher.voucherProducts],
)

const orphanCount =
  (voucher.voucherProducts?.length ?? 0) - safeAppliedProducts.length
```

Render banner above the table when orphan count > 0:

```tsx
{orphanCount > 0 && (
  <div className="flex gap-2 items-center p-3 my-2 text-xs rounded-md border bg-amber-50 border-amber-300 text-amber-900">
    <TriangleAlert className="w-4 h-4" />
    <span>
      {t('voucher.orphanProductsWarning', { count: orphanCount })}
    </span>
  </div>
)}
```

Pass `safeAppliedProducts` (not raw) into the table's `data` prop.

- [ ] **Step 2: Add i18n keys**

In `src/locales/vi/voucher.json` voucher object:

```json
"orphanProductsWarning": "Có {{count}} sản phẩm trong cấu hình voucher đã không còn tồn tại (đã bị xoá). Liên hệ kỹ thuật để dọn dẹp."
```

In `src/locales/en/voucher.json`:

```json
"orphanProductsWarning": "{{count}} product(s) in this voucher's configuration no longer exist (deleted). Contact engineering to clean up."
```

- [ ] **Step 3: Lint + commit**

```bash
git add src/app/system/voucher/ src/locales/vi/voucher.json src/locales/en/voucher.json
git commit -m "fix(voucher): admin voucher-products list skips orphan mappings + warns"
```

---

## Phase F — Admin cascade trigger (Case 15)

### Task 16: Invalidate `vouchersForOrder` after admin `useUpdateVoucher`

When admin saves voucher config (changes `voucherProducts`, `voucherPaymentMethods`, `isActive`, etc.), the change should reach customer-facing sheets ASAP. Currently `useUpdateVoucher` doesn't invalidate `vouchersForOrder` query.

**Files:**
- Modify: `src/hooks/use-voucher.ts` (search for `useUpdateVoucher`)

- [ ] **Step 1: Locate the mutation**

```bash
grep -n "useUpdateVoucher\b\|updateVoucher,\|export const useUpdateVoucher" src/hooks/use-voucher.ts | head
```

- [ ] **Step 2: Add `onSettled` to invalidate**

```ts
export const useUpdateVoucher = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: IUpdateVoucherRequest) => {
      return updateVoucher(data)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERYKEY.vouchers })
      qc.invalidateQueries({ queryKey: QUERYKEY.vouchersForOrder })
      qc.invalidateQueries({ queryKey: QUERYKEY.specificVoucher })
    },
  })
}
```

If `useUpdateVoucher` does not yet destructure `useQueryClient`, add `const qc = useQueryClient()` at top of the function. `useQueryClient` is already imported (from Task 19 of previous plan).

- [ ] **Step 3: Lint + run test**

```bash
npm run lint -- src/hooks/use-voucher.ts
npm run test
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-voucher.ts
git commit -m "fix(voucher): admin voucher updates invalidate eligible voucher cache"
```

---

### Task 17: Trigger auto-revalidate on `voucher.updatedAt` changes

When `orderData.voucher.updatedAt` changes (because order was refetched after admin updated voucher), the auto-revalidate effect should re-fire even if other context didn't change.

**Files:**
- Modify: `src/hooks/use-auto-revalidate-applied-voucher.ts`

- [ ] **Step 1: Edit hook to include `updatedAt` in effect deps**

Locate the first effect in `use-auto-revalidate-applied-voucher.ts` (the one that fires on context change). Currently it depends on `appliedVoucher` object plus context primitives. Add a derived primitive `appliedUpdatedAt`:

```ts
const appliedUpdatedAt =
  (appliedVoucher as { updatedAt?: string } | null)?.updatedAt ?? null

useEffect(() => {
  if (!appliedVoucher) return
  const reason = evaluate(appliedVoucher, context)
  if (reason) fire(reason, appliedVoucher.slug)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  appliedVoucher,
  appliedUpdatedAt,    // re-fire when server-side voucher config changes
  context.subtotalAfterPromotion,
  context.totalQuantity,
  context.hasCustomerOwner,
  context.paymentMethod,
  productSlugsKey,
])
```

Also update the lastFired guard so it RESETS when `appliedUpdatedAt` changes (config refresh = re-arm):

```ts
if (
  appliedVoucher &&
  (lastFiredSlugRef.current !== appliedVoucher.slug ||
    lastFiredUpdatedAtRef.current !== appliedUpdatedAt)
) {
  lastFiredSlugRef.current = null
  lastFiredUpdatedAtRef.current = appliedUpdatedAt
}
if (!appliedVoucher) {
  lastFiredSlugRef.current = null
  lastFiredUpdatedAtRef.current = null
}
```

Declare the new ref alongside the existing one:

```ts
const lastFiredUpdatedAtRef = useRef<string | null>(null)
```

Apply the same `appliedUpdatedAt` to the polling effect's deps array.

- [ ] **Step 2: Add test**

Append to `src/tests/hooks/use-auto-revalidate-applied-voucher.test.tsx`:

```ts
it('re-fires when server-side voucher updatedAt changes (admin reconfig)', () => {
  const onAutoRemove = vi.fn()
  const initial = { ...baseVoucher, updatedAt: '2026-06-14T10:00:00Z' } as IVoucher
  const { rerender } = renderHook(
    (props: { applied: IVoucher | null }) =>
      useAutoRevalidateAppliedVoucher({
        appliedVoucher: props.applied,
        context: {
          subtotalAfterPromotion: 100_000,
          totalQuantity: 1,
          productSlugs: ['p1'],
          hasCustomerOwner: true,
        },
        onAutoRemove,
        pollMs: 0,
      }),
    { initialProps: { applied: initial as IVoucher | null } },
  )
  expect(onAutoRemove).toHaveBeenCalledTimes(1)

  // Same slug, NEW updatedAt → guard rearmed → fire again.
  rerender({ applied: { ...initial, updatedAt: '2026-06-14T11:00:00Z' } as IVoucher })
  expect(onAutoRemove).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 3: Test PASS**

```bash
npx vitest run src/tests/hooks/use-auto-revalidate-applied-voucher.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-auto-revalidate-applied-voucher.ts src/tests/hooks/use-auto-revalidate-applied-voucher.test.tsx
git commit -m "feat(voucher): re-fire auto-revalidate when voucher updatedAt changes"
```

---

## Phase G — Verification & docs

### Task 18: Full lint + test + build + smoke checklist

- [ ] **Step 1: Run all gates**

```bash
npm run lint
npm run test
npx tsc -b
```

All must exit 0.

- [ ] **Step 2: Smoke (manual, dev server)**

```bash
npm run dev
```

Test these flows by hand. Each line should show specific reason in toast:

| Case | How to reproduce |
|------|------------------|
| 6 | Apply voucher (payment-method-restricted) → switch payment method → auto-remove + toast "Phương thức thanh toán không được hỗ trợ" |
| 9 | Open sheet, scroll many pages, type search code → verify no duplicates in list |
| 11 | Open sheet, close, wait, reopen → list should refetch (network panel shows new request) |
| 13 | Admin tab — open a voucher with deleted product → banner shows orphan count, table renders without crash |
| 15 | Admin updates voucher config → staff side eligible vouchers refresh on next mount |
| 18 chip | Click an invalid voucher → card shows specific reason (not generic "Voucher không hợp lệ") |
| 19 | DevTools — set system clock 10min ahead → server-time offset compensates after first API response |

### Task 19: Update CLAUDE.md

**Files:**
- Modify: `app/order-ui/CLAUDE.md`

- [ ] **Step 1: Append after "Voucher display state" section**

```md
### Voucher display state (extensions)

`VoucherValidationContext` accepts `paymentMethod?: string`. When set and the
voucher has `voucherPaymentMethods`, the gate returns
`PAYMENT_METHOD_NOT_SUPPORTED`. Always pass the current payment method into
auto-revalidate so switching methods triggers auto-removal.

Voucher list dedup: each sheet's `localVoucherList` accumulator dedupes by
slug across pagination, code search, and applied snapshot — never call
`setLocalVoucherList` with a non-deduped array.

Stale-on-reopen: `useVouchersForOrder` and `usePublicVouchersForOrder` use
`staleTime: 0` + `refetchOnMount: 'always'`. Don't add aggressive caching
there; the 30s revalidate poll + always-fresh fetch are intentional.

Server-time: prefer `serverNow()` from `src/lib/server-time.ts` when comparing
voucher expiry/active-window with "now". The axios response interceptor keeps
the offset in sync via the HTTP `Date` header.

Admin reconfig propagation: `useUpdateVoucher` invalidates
`QUERYKEY.vouchersForOrder` so customer-facing sheets pick up changes on
next mount. `useAutoRevalidateAppliedVoucher` re-fires when
`appliedVoucher.updatedAt` changes — ensure your applied snapshot carries
this field if it exists on the IVoucher type.
```

- [ ] **Step 2: Commit**

```bash
git add app/order-ui/CLAUDE.md
git commit -m "docs(voucher): document remaining-case fixes (paymentMethod, serverNow, dedupe)"
```

---

## Self-review checklist

- [ ] Case 6 → Task 1, 8-13 (context expansion + wire in 6 sheets)
- [ ] Case 9 → Task 14 (dedupe accumulator) + Task 7 (display items hook)
- [ ] Case 11 → Task 6 (staleTime: 0 + refetchOnMount)
- [ ] Case 13 → Task 15 (admin orphan filter + warning)
- [ ] Case 15 → Task 16 (invalidate after admin update) + Task 17 (updatedAt deps)
- [ ] Case 18 chip → Task 8-13 (chip rendered via display state)
- [ ] Case 19 → Task 3 (server-time module) + Task 4 (voucher-time use serverNow) + Task 5 (axios interceptor)
- [ ] No `TODO` / `TBD` left in code tasks.
- [ ] Types consistent across tasks:
  - `VoucherValidationContext` adds `paymentMethod?: string` (same in both `voucher-display.ts` and `voucher-validation.ts`)
  - `VoucherInvalidReason` adds `'PAYMENT_METHOD_NOT_SUPPORTED'` and `'CONFIG_CHANGED'`
  - `useVoucherDisplayItems` signature `({ items, applied, extras? })` consistent across Tasks 7-13
  - `serverNow()` returns `number`, `setServerTimeOffsetFromHeader(string | undefined): void`
- [ ] Commit prefixes follow `(voucher):` convention.

---

## Out of scope (defer to a later plan)

- Full replacement of `localVoucherList` self-management with `useVoucherDisplayList`. This would let the sheets drop the manual accumulate effect entirely. Estimated 6 × ~30-line refactors, but requires re-wiring pagination state. Defer until UX validation of current dedupe fix.
- BE WebSocket / SSE broadcast for voucher config changes (live propagation < 1s rather than next-mount). Requires backend work first.
- Persistent server-time offset in localStorage (so first request after page load isn't blind). Marginal value once axios interceptor is in place.
