import { describe, it, expect } from 'vitest'
import { buildCreateOrderItems, buildAddOrderItemPayload } from '@/lib/staff-order-payload'
import type { OrderItem } from '@/types/session'

const base: OrderItem = {
  menuItemId: 'm-1',
  name: 'X',
  priceNum: 50_000,
  price: '50.000đ',
  quantity: 2,
  note: 'less ice',
  variantSlug: 'v-1',
  productSlug: 'p-1',
  promotion: null,
  vatRate: 0,
}

describe('buildCreateOrderItems', () => {
  it('maps a regular item with promotion preserved', () => {
    const result = buildCreateOrderItems([
      { ...base, promotion: { slug: 'promo-1', value: 10 } },
    ])
    expect(result).toEqual([
      {
        quantity: 2,
        variant: 'v-1',
        promotion: 'promo-1',
        note: 'less ice',
      },
    ])
  })

  it('maps a regular item without promotion → promotion: null', () => {
    const result = buildCreateOrderItems([base])
    expect(result[0].promotion).toBeNull()
    expect(result[0]).not.toHaveProperty('customPrice')
  })

  it('maps a custom-price item with customPrice from priceNum + drops promotion', () => {
    const result = buildCreateOrderItems([
      {
        ...base,
        isCustomPrice: true,
        priceNum: 123_000,
        promotion: { slug: 'should-be-stripped', value: 10 },
      },
    ])
    expect(result[0]).toEqual({
      quantity: 2,
      variant: 'v-1',
      promotion: null,
      note: 'less ice',
      customPrice: 123_000,
    })
  })

  it('omits customPrice if isCustomPrice but priceNum is 0', () => {
    const result = buildCreateOrderItems([
      { ...base, isCustomPrice: true, priceNum: 0 },
    ])
    expect(result[0]).not.toHaveProperty('customPrice')
  })

  it('filters out items missing variantSlug', () => {
    const result = buildCreateOrderItems([
      base,
      { ...base, variantSlug: '' },
      { ...base, variantSlug: undefined },
    ])
    expect(result).toHaveLength(1)
  })
})

describe('buildAddOrderItemPayload', () => {
  it('builds payload for a regular item with promotion', () => {
    const out = buildAddOrderItemPayload(
      { ...base, promotion: { slug: 'promo-1', value: 10 } },
      'order-slug-1',
    )
    expect(out).toEqual({
      quantity: 2,
      note: 'less ice',
      variant: 'v-1',
      promotion: 'promo-1',
      order: 'order-slug-1',
    })
  })

  it('builds payload for a custom-price item with customPrice', () => {
    const out = buildAddOrderItemPayload(
      { ...base, isCustomPrice: true, priceNum: 99_000 },
      'order-slug-1',
    )
    expect(out).toEqual({
      quantity: 2,
      note: 'less ice',
      variant: 'v-1',
      promotion: '',
      order: 'order-slug-1',
      customPrice: 99_000,
    })
  })

  it('respects quantityOverride for qty-increase branch', () => {
    const out = buildAddOrderItemPayload(base, 'order-slug-1', 5)
    expect(out.quantity).toBe(5)
  })

  it('omits customPrice if isCustomPrice but priceNum is 0', () => {
    const out = buildAddOrderItemPayload(
      { ...base, isCustomPrice: true, priceNum: 0 },
      'order-slug-1',
    )
    expect(out).not.toHaveProperty('customPrice')
  })

  it('regular item without promotion → promotion empty string', () => {
    const out = buildAddOrderItemPayload({ ...base, promotion: null }, 'order-slug-1')
    expect(out.promotion).toBe('')
  })
})
