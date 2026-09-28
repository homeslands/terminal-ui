import { describe, it, expect } from 'vitest'
import { computeOrderBreakdown } from '@/lib/order-breakdown'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import type { IOrder, IOrderDetail, IVoucher } from '@/types'

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
  } as unknown as IOrderDetail
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
      voucher: null as unknown as IOrder['voucher'],
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
      voucher: null as unknown as IOrder['voucher'],
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
      voucher: null as unknown as IOrder['voucher'],
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

describe('computeOrderBreakdown — custom-price items', () => {
  // Custom-price scenario: staff uses a placeholder SKU (variant.price = 12)
  // to enter an arbitrary price (customPrice = 5000). The breakdown panel
  // must reflect the customPrice, not the placeholder variant.price.
  it('uses customPrice instead of variant.price for tongTienHang', () => {
    const order = makeOrder({
      orderItems: [
        makeItem({
          isCustomPrice: true,
          customPrice: 5000,
          variant: {
            slug: 'placeholder',
            price: 12,
            product: { slug: 'placeholder', name: 'Custom', vatRate: 0 },
          },
          vatRate: 0,
          vatValue: 0,
        }),
      ],
      subtotal: 12, // BE returns placeholder-based subtotal — wrong but observed in real screenshots
      originalSubtotal: 12,
    })
    const result = computeOrderBreakdown(order, null, pendingFallback)
    expect(result.tongTienHang).toBe(5000)
    expect(result.total).toBe(5000) // FE math overrides BE since hasCustomItems
    expect(result.preVatTotal).toBe(5000)
    expect(result.vatAmount).toBe(0)
    expect(result.promotionDiscount).toBe(0)
    expect(result.voucherDiscount).toBe(0)
  })

  it('mixes custom-price with regular items correctly', () => {
    // BBQ regular 50000 + Decoration custom 200000.
    // tongTienHang = 50000 + 200000 = 250000.
    // No voucher applied.
    const order = makeOrder({
      orderItems: [
        makeItem({
          // Regular BBQ
          variant: {
            slug: 'bbq',
            price: 50000,
            product: { slug: 'bbq', name: 'BBQ', vatRate: 10 },
          },
          vatRate: 10,
          vatValue: 5000,
        }),
        makeItem({
          isCustomPrice: true,
          customPrice: 200000,
          variant: {
            slug: 'placeholder',
            price: 12,
            product: { slug: 'placeholder', name: 'Decoration', vatRate: 0 },
          },
          vatRate: 0,
          vatValue: 0,
        }),
      ],
      subtotal: 0, // force FE fallback
      originalSubtotal: 0,
    })
    const result = computeOrderBreakdown(order, null, pendingFallback)
    expect(result.tongTienHang).toBe(250000)
    // BBQ expected: 50000 + 10% VAT = 55000; Decoration: 200000 flat → 255000.
    expect(result.total).toBe(255000)
  })

  it('detects custom-price via variant.product.isCustomPrice (BE response shape)', () => {
    // Real BE response from /active endpoint: top-level isCustomPrice is
    // absent; flag lives under variant.product.isCustomPrice and customPrice
    // is set on the item.
    const order = makeOrder({
      orderItems: [
        makeItem({
          customPrice: 1200,
          variant: {
            slug: 'custom-slug',
            price: 0,
            product: {
              slug: 'custom',
              name: 'Món tuỳ chỉnh',
              vatRate: 0,
              isCustomPrice: true,
            },
          },
          vatRate: 0,
          vatValue: 0,
        }),
      ],
      subtotal: 1200,
      originalSubtotal: 1200,
    })
    const result = computeOrderBreakdown(order, null, pendingFallback)
    expect(result.tongTienHang).toBe(1200)
    expect(result.total).toBe(1200)
  })

  it('detects custom-price via customPrice value alone when no flag set', () => {
    const order = makeOrder({
      orderItems: [
        makeItem({
          customPrice: 3000,
          variant: {
            slug: 'placeholder',
            price: 0,
            product: { slug: 'placeholder', name: 'X', vatRate: 0 },
          },
          vatRate: 0,
        }),
      ],
      subtotal: 3000,
      originalSubtotal: 3000,
    })
    const result = computeOrderBreakdown(order, null, pendingFallback)
    expect(result.tongTienHang).toBe(3000)
    expect(result.total).toBe(3000)
  })

  it('promotion does not apply to custom-price items', () => {
    const order = makeOrder({
      orderItems: [
        makeItem({
          isCustomPrice: true,
          customPrice: 100000,
          promotion: { slug: 'pr1', value: 15 },
          isAppliedPromotion: true,
          variant: {
            slug: 'placeholder',
            price: 12,
            product: { slug: 'placeholder', name: 'Custom', vatRate: 0 },
          },
          vatRate: 0,
        }),
      ],
      subtotal: 0,
      originalSubtotal: 0,
    })
    const result = computeOrderBreakdown(order, null, pendingFallback)
    expect(result.promotionDiscount).toBe(0)
    expect(result.total).toBe(100000)
  })
})
