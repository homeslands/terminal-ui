import { describe, it, expect } from 'vitest'
import {
  calculateCartItemDisplay,
  calculateCartTotals,
} from '@/utils/cart'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'

describe('Cart math — AT_LEAST + FIXED + promotion (case 17)', () => {
  it('drops promotion + applies fixed voucher on original (matches BE)', () => {
    const cartItems = {
      orderItems: [
        {
          slug: 'item-1',
          originalPrice: 100_000,
          promotionValue: 20,
          promotionDiscount: 20_000,
          quantity: 1,
          name: 'Test Product',
          variant: null,
          size: '',
          allVariants: [],
          isLimit: false,
          isGift: false,
          isCustomPrice: false,
          promotion: { slug: 'promo-1', value: 20 },
          note: '',
          image: '',
          description: '',
          id: 'i-1',
        },
      ],
      type: 'at-table' as const,
      ownerFullName: '',
      ownerPhoneNumber: '',
      table: '',
      tableName: '',
      branch: '',
      owner: '',
      ownerRole: '',
      voucher: null,
    }

    const voucher = {
      slug: 'v-1',
      code: 'V1',
      type: VOUCHER_TYPE.FIXED_VALUE,
      applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
      value: 10_000,
      voucherProducts: [{ product: { slug: 'item-1' } }],
      isActive: true,
      remainingUsage: 10,
      maxUsage: 10,
      minOrderValue: 0,
      isVerificationIdentity: false,
      title: 'Test Voucher',
      endDate: '2099-12-31',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const display = calculateCartItemDisplay(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cartItems as any,
      voucher,
    )
    // BE drops promotion when voucher AT_LEAST_ONE + FIXED + eligible
    expect(display[0].promotionDiscount).toBe(0)
    expect(display[0].voucherDiscount).toBe(10_000)
    expect(display[0].finalPrice).toBe(90_000)
    expect(display[0].priceAfterPromotion).toBe(100_000)

    const totals = calculateCartTotals(display, voucher)
    expect(totals.subTotalBeforeDiscount).toBe(100_000)
    expect(totals.promotionDiscount).toBe(0)
    expect(totals.voucherDiscount).toBe(10_000)
    expect(totals.finalTotal).toBe(90_000)
  })
})

describe('Cart math — regression: ALL_REQUIRED + FIXED + promotion (case 14)', () => {
  it('applies promotion per-item then voucher on subtotal-after-promotion', () => {
    const cartItems = {
      orderItems: [
        {
          slug: 'item-1',
          originalPrice: 100_000,
          promotionValue: 20,
          promotionDiscount: 20_000,
          quantity: 1,
          name: 'Test Product',
          variant: null,
          size: '',
          allVariants: [],
          isLimit: false,
          isGift: false,
          isCustomPrice: false,
          promotion: { slug: 'promo-1', value: 20 },
          note: '',
          image: '',
          description: '',
          id: 'i-1',
        },
      ],
      type: 'at-table' as const,
      ownerFullName: '',
      ownerPhoneNumber: '',
      table: '',
      tableName: '',
      branch: '',
      owner: '',
      ownerRole: '',
      voucher: null,
    }

    const voucher = {
      slug: 'v-2',
      code: 'V2',
      type: VOUCHER_TYPE.FIXED_VALUE,
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      value: 10_000,
      voucherProducts: [{ product: { slug: 'item-1' } }],
      isActive: true,
      remainingUsage: 10,
      maxUsage: 10,
      minOrderValue: 0,
      isVerificationIdentity: false,
      title: 'Test Voucher',
      endDate: '2099-12-31',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const display = calculateCartItemDisplay(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cartItems as any,
      voucher,
    )
    // ALL_REQUIRED + FIXED keeps promotion at item level and defers voucher to totals
    expect(display[0].promotionDiscount).toBe(20_000)
    expect(display[0].priceAfterPromotion).toBe(80_000)
    expect(display[0].voucherDiscount).toBe(0)

    const totals = calculateCartTotals(display, voucher)
    expect(totals.subTotalBeforeDiscount).toBe(100_000)
    expect(totals.promotionDiscount).toBe(20_000)
    expect(totals.voucherDiscount).toBe(10_000)
    expect(totals.finalTotal).toBe(70_000)
  })
})
