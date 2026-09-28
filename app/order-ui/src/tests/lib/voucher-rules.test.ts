import { describe, it, expect, vi } from 'vitest'
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
    // Validate all types are assignable
    const _source: VoucherSource = 'eligible'
    const _applied: IVoucherDisplay = {
      slug: 'test',
      code: 'TEST',
      voucherType: 'DISCOUNT',
      _source: 'eligible',
      _isApplied: true,
    } as unknown as IVoucherDisplay
    expect(_source).toBeDefined()
    expect(_applied).toBeDefined()
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

import moment from 'moment'
import { evaluateVoucher, mergeVoucherSources } from '@/lib/voucher-rules'
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

import { getVoucherDisplayState, voucherReasonI18nKey } from '@/lib/voucher-rules'

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
