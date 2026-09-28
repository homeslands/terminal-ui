import { describe, it, expect } from 'vitest'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import type { OrderItem } from '@/types/session'

describe('staffItemsToCartItem', () => {
  it('maps staff items to ICartItem shape with promotion fields', () => {
    const items: OrderItem[] = [
      {
        menuItemId: 'menu-1',
        name: 'Cà phê',
        priceNum: 25000,
        price: '25,000đ',
        quantity: 2,
        note: '',
        variantSlug: 'var-1',
        productSlug: 'prod-1',
        originalPrice: 25000,
        promotion: { slug: 'promo-1', value: 20 },
      },
    ]
    const cart = staffItemsToCartItem(items)
    expect(cart.orderItems).toHaveLength(1)
    const it = cart.orderItems[0]
    expect(it.slug).toBe('prod-1')
    expect(it.productSlug).toBe('prod-1')
    expect(it.variant.slug).toBe('var-1')
    expect(it.originalPrice).toBe(25000)
    expect(it.promotion?.slug).toBe('promo-1')
    expect(it.promotionValue).toBe(20)
    expect(it.quantity).toBe(2)
  })

  it('falls back to priceNum when originalPrice missing', () => {
    const items: OrderItem[] = [
      { menuItemId: 'm', name: 'X', priceNum: 10000, price: '10k', quantity: 1, note: '', variantSlug: 'v' },
    ]
    const cart = staffItemsToCartItem(items)
    expect(cart.orderItems[0].originalPrice).toBe(10000)
  })

  it('sets promotion to null when item has no promotion', () => {
    const items: OrderItem[] = [
      { menuItemId: 'm', name: 'X', priceNum: 10000, price: '10k', quantity: 1, note: '', variantSlug: 'v' },
    ]
    const cart = staffItemsToCartItem(items)
    expect(cart.orderItems[0].promotion).toBeNull()
    expect(cart.orderItems[0].promotionValue).toBe(0)
  })

  it('returns empty orderItems when items array is empty', () => {
    const cart = staffItemsToCartItem([])
    expect(cart.orderItems).toEqual([])
  })

  it('handles mixed items (some with promotion, some without) in one cart', () => {
    const items: OrderItem[] = [
      {
        menuItemId: 'm1', name: 'A', priceNum: 20000, price: '20k', quantity: 1, note: '',
        variantSlug: 'v1', productSlug: 'p1', originalPrice: 25000,
        promotion: { slug: 'promo-a', value: 20 },
      },
      {
        menuItemId: 'm2', name: 'B', priceNum: 30000, price: '30k', quantity: 2, note: '',
        variantSlug: 'v2', productSlug: 'p2',
      },
    ]
    const cart = staffItemsToCartItem(items)
    expect(cart.orderItems).toHaveLength(2)
    expect(cart.orderItems[0].promotion?.slug).toBe('promo-a')
    expect(cart.orderItems[0].promotionValue).toBe(20)
    expect(cart.orderItems[1].promotion).toBeNull()
    expect(cart.orderItems[1].promotionValue).toBe(0)
  })
})
