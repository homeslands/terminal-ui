import { describe, it, expect } from 'vitest'
import { getItemPriceDisplay } from '@/lib/order-item-display'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants/voucher'
import type { IVoucher } from '@/types'

const baseItem = {
  unitPrice: 100000,
  quantity: 1,
  productSlug: 'p1',
}

const eligibleVoucher = (overrides: Partial<IVoucher>): IVoucher =>
  ({
    slug: 'v1',
    code: 'V1',
    type: VOUCHER_TYPE.PERCENT_ORDER,
    applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
    value: 30,
    voucherProducts: [{ product: { slug: 'p1' } }] as never,
    ...overrides,
  }) as IVoucher

describe('getItemPriceDisplay', () => {
  it('no voucher, no promo → no strikethrough, price = original', () => {
    const r = getItemPriceDisplay(baseItem, null)
    expect(r.showStrikethrough).toBe(false)
    expect(r.originalPrice).toBe(100000)
    expect(r.finalPrice).toBe(100000)
  })

  it('no voucher, có promo → no strikethrough, price = promoted', () => {
    const r = getItemPriceDisplay({ ...baseItem, promotionValue: 20 }, null)
    expect(r.showStrikethrough).toBe(false)
    expect(r.finalPrice).toBe(80000)
    expect(r.promoLabel).toBe('-20%')
  })

  it('voucher % ALL_REQUIRED → no strikethrough', () => {
    const v = eligibleVoucher({
      type: VOUCHER_TYPE.PERCENT_ORDER,
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      value: 30,
    })
    const r = getItemPriceDisplay(baseItem, v)
    expect(r.showStrikethrough).toBe(false)
    expect(r.finalPrice).toBe(100000)
  })

  it('voucher % AT_LEAST_ONE eligible → strikethrough, 30% off original', () => {
    const v = eligibleVoucher({
      type: VOUCHER_TYPE.PERCENT_ORDER,
      applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
      value: 30,
    })
    const r = getItemPriceDisplay(baseItem, v)
    expect(r.showStrikethrough).toBe(true)
    expect(r.originalPrice).toBe(100000)
    expect(r.finalPrice).toBe(70000)
  })

  it('voucher % AT_LEAST_ONE NOT eligible → no strikethrough', () => {
    const v = eligibleVoucher({
      type: VOUCHER_TYPE.PERCENT_ORDER,
      applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
      value: 30,
      voucherProducts: [{ product: { slug: 'OTHER' } }] as never,
    })
    const r = getItemPriceDisplay(baseItem, v)
    expect(r.showStrikethrough).toBe(false)
  })

  it('voucher FIXED ALL_REQUIRED → no strikethrough item', () => {
    const v = eligibleVoucher({
      type: VOUCHER_TYPE.FIXED_VALUE,
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      value: 10000,
    })
    const r = getItemPriceDisplay(baseItem, v)
    expect(r.showStrikethrough).toBe(false)
  })

  it('voucher FIXED AT_LEAST eligible → strikethrough, fixed deduction', () => {
    const v = eligibleVoucher({
      type: VOUCHER_TYPE.FIXED_VALUE,
      applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
      value: 10000,
    })
    const r = getItemPriceDisplay(baseItem, v)
    expect(r.showStrikethrough).toBe(true)
    expect(r.finalPrice).toBe(90000)
  })

  it('voucher FIXED AT_LEAST + promo → drop promo, match BE', () => {
    const v = eligibleVoucher({
      type: VOUCHER_TYPE.FIXED_VALUE,
      applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
      value: 10000,
    })
    const r = getItemPriceDisplay({ ...baseItem, promotionValue: 20 }, v)
    expect(r.showStrikethrough).toBe(true)
    expect(r.finalPrice).toBe(90000) // 100000 - 10000 (drop promo)
    expect(r.promoLabel).toBeUndefined() // promo bị drop, không hiển thị
  })

  it('SAME_PRICE eligible → strikethrough, override price', () => {
    const v = eligibleVoucher({
      type: VOUCHER_TYPE.SAME_PRICE_PRODUCT,
      value: 50000,
    })
    const r = getItemPriceDisplay(baseItem, v)
    expect(r.showStrikethrough).toBe(true)
    expect(r.finalPrice).toBe(50000)
    expect(r.voucherLabel).toBe('Đồng giá')
  })

  it('SAME_PRICE NOT eligible → no strikethrough', () => {
    const v = eligibleVoucher({
      type: VOUCHER_TYPE.SAME_PRICE_PRODUCT,
      value: 50000,
      voucherProducts: [{ product: { slug: 'OTHER' } }] as never,
    })
    const r = getItemPriceDisplay(baseItem, v)
    expect(r.showStrikethrough).toBe(false)
  })

  it('custom-price → no strikethrough, no voucher/promo apply', () => {
    const r = getItemPriceDisplay(
      {
        unitPrice: 100,
        quantity: 1,
        productSlug: 'p1',
        isCustomPrice: true,
        customPrice: 50000,
        promotionValue: 20,
      },
      eligibleVoucher({}),
    )
    expect(r.showStrikethrough).toBe(false)
    expect(r.finalPrice).toBe(50000)
    expect(r.originalPrice).toBe(50000)
  })

  it('quantity = 3 → originalPrice × 3', () => {
    const r = getItemPriceDisplay({ ...baseItem, quantity: 3 }, null)
    expect(r.originalPrice).toBe(300000)
    expect(r.finalPrice).toBe(300000)
  })
})
