import { describe, it, expect } from 'vitest'
import {
  computeSessionReconciliation,
  mapServerOrderItemToOrderItem,
  mapServerOrderToSubmitted,
} from '../staff-orders'
import type { IOrder, IOrderDetail } from '@/types'
import type { TableSession } from '@/types/session'

function makeDetail(overrides: Partial<IOrderDetail> = {}): IOrderDetail {
  return {
    createdAt: '2026-06-06T00:00:00Z',
    slug: 'oi-1',
    note: '',
    quantity: 2,
    subtotal: 50_000,
    status: { PENDING: 1, COMPLETED: 0, FAILED: 0, RUNNING: 0 },
    variant: {
      slug: 'v-coffee-m',
      price: 25_000,
      costPrice: 10_000,
      size: { name: 'M', description: '', slug: 'size-m' },
      product: {
        slug: 'p-coffee',
        name: 'Cà phê đen',
        description: '',
        isActive: true,
        isLimit: false,
        isTopSell: false,
        isNew: false,
        isCombo: false,
        isGift: false,
        image: '',
        images: [],
        rating: 0,
        catalog: { slug: '', name: '', description: '' },
        variants: [],
        createdAt: '',
        saleQuantityHistory: 0,
        productChefArea: '',
      },
    },
    size: { name: 'M', description: '', slug: 'size-m' },
    trackingOrderItems: [],
    ...overrides,
  } as IOrderDetail
}

describe('mapServerOrderItemToOrderItem', () => {
  it('maps standard fields from IOrderDetail', () => {
    const result = mapServerOrderItemToOrderItem(makeDetail())
    expect(result).toMatchObject({
      menuItemId: 'p-coffee',
      variantSlug: 'v-coffee-m',
      orderItemSlug: 'oi-1',
      name: 'Cà phê đen',
      priceNum: 25_000,
      quantity: 2,
      note: '',
    })
    expect(result.isCustomPrice).toBeFalsy()
  })

  it('uses customPrice when isCustomPrice=true and sets customPriceId from orderItemSlug', () => {
    const result = mapServerOrderItemToOrderItem(
      makeDetail({ slug: 'oi-cp-9', isCustomPrice: true, customPrice: 80_000 }),
    )
    expect(result.priceNum).toBe(80_000)
    expect(result.isCustomPrice).toBe(true)
    expect(result.customPriceId).toBe('oi-cp-9')
  })

  it('preserves note as-is', () => {
    const result = mapServerOrderItemToOrderItem(makeDetail({ note: 'ít đường' }))
    expect(result.note).toBe('ít đường')
  })

  it('falls back to variant.price and drops custom flags when isCustomPrice=true but customPrice is missing', () => {
    const result = mapServerOrderItemToOrderItem(
      makeDetail({ isCustomPrice: true, customPrice: undefined }),
    )
    expect(result.priceNum).toBe(25_000) // variant.price from makeDetail default
    expect(result.isCustomPrice).toBeFalsy()
    expect(result.customPriceId).toBeUndefined()
  })

  it('maps promotion fields from server order item', () => {
    const detail = {
      slug: 'oi-1',
      quantity: 2,
      note: '',
      variant: {
        slug: 'var-1',
        price: 25000,
        product: { slug: 'prod-a', name: 'Cà phê' },
      },
      promotion: { slug: 'promo-1', value: 20 },
    } as unknown as IOrderDetail

    const item = mapServerOrderItemToOrderItem(detail)
    expect(item.productSlug).toBe('prod-a')
    expect(item.originalPrice).toBe(25000)
    expect(item.promotion).toEqual({ slug: 'promo-1', value: 20 })
  })

  it('sets promotion to null when server item has no promotion', () => {
    const detail = {
      slug: 'oi-2',
      quantity: 1,
      note: '',
      variant: {
        slug: 'var-2',
        price: 10000,
        product: { slug: 'prod-b', name: 'Bánh' },
      },
    } as unknown as IOrderDetail

    const item = mapServerOrderItemToOrderItem(detail)
    expect(item.promotion).toBeNull()
    expect(item.productSlug).toBe('prod-b')
    expect(item.originalPrice).toBe(10000)
  })

  it('rehydrates vatRate from server product', () => {
    const detail = {
      slug: 'oi-vat',
      quantity: 1,
      note: '',
      variant: {
        slug: 'v1',
        price: 25000,
        product: { slug: 'p1', name: 'X', vatRate: 0.1 },
      },
    } as unknown as IOrderDetail
    expect(mapServerOrderItemToOrderItem(detail).vatRate).toBe(0.1)
  })

  it('defaults vatRate to 0 when server product has no vatRate', () => {
    const detail = {
      slug: 'oi',
      quantity: 1,
      note: '',
      variant: { slug: 'v', price: 10000, product: { slug: 'p', name: 'Y' } },
    } as unknown as IOrderDetail
    expect(mapServerOrderItemToOrderItem(detail).vatRate).toBe(0)
  })
})

function makeOrder(overrides: Partial<IOrder> = {}): IOrder {
  return {
    createdAt: '2026-06-06T10:30:00Z',
    slug: 'order-abc',
    orderItems: [
      makeDetail({ slug: 'oi-1', quantity: 2 }),
      makeDetail({ slug: 'oi-2', quantity: 1, note: 'thêm đá' }),
    ],
    ...overrides,
  } as unknown as IOrder
}

describe('mapServerOrderToSubmitted', () => {
  it('returns one SubmittedOrder containing all mapped items', () => {
    const order = makeOrder()
    const submitted = mapServerOrderToSubmitted(order)
    expect(submitted.id).toBe('order-abc')
    expect(submitted.submittedAt).toBe('2026-06-06T10:30:00Z')
    expect(submitted.items).toHaveLength(2)
    expect(submitted.items[0].orderItemSlug).toBe('oi-1')
    expect(submitted.items[1].note).toBe('thêm đá')
  })

  it('returns empty items array when server order has no orderItems', () => {
    const submitted = mapServerOrderToSubmitted(makeOrder({ orderItems: [] }))
    expect(submitted.items).toEqual([])
  })
})

function makeSession(overrides: Partial<TableSession> = {}): TableSession {
  return {
    tableId: 't1',
    tableName: 'Bàn 01',
    status: 'serving',
    pendingItems: [],
    submittedOrders: [],
    openedAt: '2026-06-06T10:00:00Z',
    ...overrides,
  }
}

describe('computeSessionReconciliation', () => {
  it('returns refresh when both sides have the same orderSlug (resync items from server)', () => {
    const local = makeSession({ orderSlug: 'order-abc' })
    const server = makeOrder({ slug: 'order-abc' })
    const action = computeSessionReconciliation(local, server)
    expect(action.type).toBe('refresh')
    if (action.type === 'refresh') {
      expect(action.submittedOrder.id).toBe('order-abc')
      expect(action.submittedOrder.items).toHaveLength(2)
    }
  })

  it('refresh action carries updated item quantities from server', () => {
    const local = makeSession({ orderSlug: 'order-abc' })
    const server = makeOrder({
      slug: 'order-abc',
      orderItems: [
        makeDetail({ slug: 'oi-1', quantity: 5 }), // server-side qty change
      ],
    } as unknown as Parameters<typeof makeOrder>[0])
    const action = computeSessionReconciliation(local, server)
    expect(action.type).toBe('refresh')
    if (action.type === 'refresh') {
      expect(action.submittedOrder.items).toHaveLength(1)
      expect(action.submittedOrder.items[0].quantity).toBe(5)
    }
  })

  it('returns noop when server has no active order and local has no orderSlug', () => {
    expect(computeSessionReconciliation(makeSession(), null)).toEqual({ type: 'noop' })
  })

  it('returns hydrate when local has no orderSlug but server has an active order', () => {
    const server = makeOrder({ slug: 'order-from-server' })
    const action = computeSessionReconciliation(makeSession(), server)
    expect(action.type).toBe('hydrate')
    if (action.type === 'hydrate') {
      expect(action.orderSlug).toBe('order-from-server')
      expect(action.submittedOrder.id).toBe('order-from-server')
    }
  })

  it('returns clear when local has orderSlug but server returns null', () => {
    const action = computeSessionReconciliation(makeSession({ orderSlug: 'order-stale' }), null)
    expect(action).toEqual({ type: 'clear', staleOrderSlug: 'order-stale' })
  })

  it('returns mismatch when local and server have different orderSlugs', () => {
    const local = makeSession({ orderSlug: 'order-local' })
    const server = makeOrder({ slug: 'order-server' })
    const action = computeSessionReconciliation(local, server)
    expect(action.type).toBe('mismatch')
    if (action.type === 'mismatch') {
      expect(action.localOrderSlug).toBe('order-local')
      expect(action.serverOrderSlug).toBe('order-server')
      expect(action.submittedOrder.id).toBe('order-server')
    }
  })

  it('returns noop when local session itself is null and server returns null', () => {
    expect(computeSessionReconciliation(null, null)).toEqual({ type: 'noop' })
  })

  it('returns hydrate when local session is null and server has an order', () => {
    const action = computeSessionReconciliation(null, makeOrder({ slug: 'order-1' }))
    expect(action.type).toBe('hydrate')
  })

})
