import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import moment from 'moment'
import { useAutoRevalidateAppliedVoucher } from '@/hooks/use-auto-revalidate-applied-voucher'
import type { IVoucher } from '@/types'
import { VOUCHER_TYPE, APPLICABILITY_RULE } from '@/constants'

const baseVoucher: IVoucher = {
  slug: 'v',
  code: 'V',
  isActive: true,
  remainingUsage: 5,
  minOrderValue: 200_000,
  maxUsage: 10,
  type: VOUCHER_TYPE.PERCENT_ORDER,
  startDate: moment().subtract(1, 'day').toISOString(),
  endDate: moment().add(10, 'days').toISOString(),
  voucherProducts: [],
  applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
  isVerificationIdentity: false,
  maxItems: 0,
} as unknown as IVoucher

const baseValidCtx = {
  subtotalAfterPromotion: 500_000, // > minOrderValue 200k
  totalQuantity: 1,
  productSlugs: ['p1'],
  hasCustomerOwner: true,
}

describe('useAutoRevalidateAppliedVoucher (Option B v2 — trust BE, fire on reason change)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Pin to a deterministic time after 7AM UTC so the validator's
    // "must be valid through 7AM today" guard doesn't false-positive on CI
    // (which runs at random UTC times — some before 7AM).
    vi.setSystemTime(new Date('2026-06-15T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does NOT fire on initial mount even when FE thinks voucher is invalid (trust BE)', () => {
    const onAutoRemove = vi.fn()
    renderHook(() =>
      useAutoRevalidateAppliedVoucher({
        appliedVoucher: baseVoucher,
        context: {
          ...baseValidCtx,
          subtotalAfterPromotion: 100_000, // below minOrderValue → invalid
        },
        onAutoRemove,
        pollMs: 0,
      }),
    )
    expect(onAutoRemove).not.toHaveBeenCalled()
  })

  it('does NOT fire when valid voucher mounts', () => {
    const onAutoRemove = vi.fn()
    renderHook(() =>
      useAutoRevalidateAppliedVoucher({
        appliedVoucher: baseVoucher,
        context: baseValidCtx,
        onAutoRemove,
        pollMs: 0,
      }),
    )
    expect(onAutoRemove).not.toHaveBeenCalled()
  })

  it('does nothing when applied voucher is null', () => {
    const onAutoRemove = vi.fn()
    renderHook(() =>
      useAutoRevalidateAppliedVoucher({
        appliedVoucher: null,
        context: {
          subtotalAfterPromotion: 0,
          totalQuantity: 0,
          productSlugs: [],
          hasCustomerOwner: false,
        },
        onAutoRemove,
        pollMs: 0,
      }),
    )
    expect(onAutoRemove).not.toHaveBeenCalled()
  })

  it('fires when reason FLIPS from valid → invalid (user removes items)', () => {
    const onAutoRemove = vi.fn()
    const { rerender } = renderHook(
      (props: { ctx: typeof baseValidCtx }) =>
        useAutoRevalidateAppliedVoucher({
          appliedVoucher: baseVoucher,
          context: props.ctx,
          onAutoRemove,
          pollMs: 0,
        }),
      { initialProps: { ctx: baseValidCtx } },
    )
    expect(onAutoRemove).not.toHaveBeenCalled()

    // User removes items → subtotal drops below minOrderValue
    rerender({
      ctx: { ...baseValidCtx, subtotalAfterPromotion: 100_000 },
    })
    expect(onAutoRemove).toHaveBeenCalledTimes(1)
    expect(onAutoRemove).toHaveBeenCalledWith('MIN_ORDER_NOT_MET')
  })

  it('does NOT fire when ctx changes but reason stays the same (static FE/BE discrepancy)', () => {
    const onAutoRemove = vi.fn()
    const invalidCtx = {
      ...baseValidCtx,
      subtotalAfterPromotion: 100_000, // below minOrderValue → invalid from start
    }
    const { rerender } = renderHook(
      (props: { ctx: typeof invalidCtx }) =>
        useAutoRevalidateAppliedVoucher({
          appliedVoucher: baseVoucher,
          context: props.ctx,
          onAutoRemove,
          pollMs: 0,
        }),
      { initialProps: { ctx: invalidCtx } },
    )
    expect(onAutoRemove).not.toHaveBeenCalled()

    // Other ctx field changes (e.g. quantity) but reason still MIN_ORDER_NOT_MET
    rerender({
      ctx: { ...invalidCtx, totalQuantity: 2 },
    })
    expect(onAutoRemove).not.toHaveBeenCalled()
  })

  it('fires when reason changes from X to Y (e.g. MIN_ORDER → MAX_ITEMS)', () => {
    const onAutoRemove = vi.fn()
    const ctx1 = { ...baseValidCtx, subtotalAfterPromotion: 100_000 } // MIN_ORDER_NOT_MET
    const { rerender } = renderHook(
      (props: { ctx: typeof ctx1 }) =>
        useAutoRevalidateAppliedVoucher({
          appliedVoucher: { ...baseVoucher, maxItems: 1 } as IVoucher,
          context: props.ctx,
          onAutoRemove,
          pollMs: 0,
        }),
      { initialProps: { ctx: ctx1 } },
    )
    expect(onAutoRemove).not.toHaveBeenCalled()

    // User adds items → subtotal OK but quantity exceeds maxItems → reason FLIPS
    rerender({
      ctx: { ...baseValidCtx, totalQuantity: 5 }, // MAX_ITEMS_EXCEEDED
    })
    expect(onAutoRemove).toHaveBeenCalledTimes(1)
    expect(onAutoRemove).toHaveBeenCalledWith('MAX_ITEMS_EXCEEDED')
  })

  it('fires precisely at endDate boundary even on initial mount (time-based bypass)', () => {
    const onAutoRemove = vi.fn()
    const endingSoon: IVoucher = {
      ...baseVoucher,
      endDate: moment().add(60, 'seconds').toISOString(),
      minOrderValue: 0, // make every non-time check pass
    } as unknown as IVoucher
    renderHook(() =>
      useAutoRevalidateAppliedVoucher({
        appliedVoucher: endingSoon,
        context: baseValidCtx,
        onAutoRemove,
        pollMs: 300_000,
      }),
    )
    expect(onAutoRemove).not.toHaveBeenCalled()
    // 60s + 30-min grace + 1s buffer
    vi.advanceTimersByTime(60_000 + 30 * 60_000 + 1_500)
    expect(onAutoRemove).toHaveBeenCalledTimes(1)
    expect(onAutoRemove).toHaveBeenCalledWith('EXPIRED')
  })

  it('in-flight guard prevents duplicate fires for same slug after reason flip', () => {
    const onAutoRemove = vi.fn()
    const { rerender } = renderHook(
      (props: { ctx: typeof baseValidCtx }) =>
        useAutoRevalidateAppliedVoucher({
          appliedVoucher: baseVoucher,
          context: props.ctx,
          onAutoRemove,
          pollMs: 1_000,
        }),
      { initialProps: { ctx: baseValidCtx } },
    )

    // Flip ctx so reason becomes invalid.
    rerender({ ctx: { ...baseValidCtx, subtotalAfterPromotion: 100_000 } })
    expect(onAutoRemove).toHaveBeenCalledTimes(1)

    // Subsequent polls + identical context → guard blocks duplicate.
    vi.advanceTimersByTime(5_000)
    expect(onAutoRemove).toHaveBeenCalledTimes(1)
  })

  it('treats new voucher slug as fresh apply (re-baselines trust)', () => {
    const onAutoRemove = vi.fn()
    const invalidCtx = { ...baseValidCtx, subtotalAfterPromotion: 100_000 }
    const { rerender } = renderHook(
      (props: { applied: IVoucher | null }) =>
        useAutoRevalidateAppliedVoucher({
          appliedVoucher: props.applied,
          context: invalidCtx,
          onAutoRemove,
          pollMs: 0,
        }),
      { initialProps: { applied: baseVoucher as IVoucher | null } },
    )
    // Initial mount with invalid voucher → trust BE → no fire
    expect(onAutoRemove).not.toHaveBeenCalled()

    // User removes voucher, applies a different one → re-baseline trust
    rerender({ applied: null })
    rerender({ applied: { ...baseVoucher, slug: 'other' } as IVoucher })
    expect(onAutoRemove).not.toHaveBeenCalled()
  })
})
