import { describe, it, expect, vi } from 'vitest'
import { shouldShowEmptyItemsBanner } from '../update-order-helpers'

describe('shouldShowEmptyItemsBanner', () => {
  it('returns true when orderItems is empty array', () => {
    expect(shouldShowEmptyItemsBanner([])).toBe(true)
  })

  it('returns true when orderItems is undefined', () => {
    expect(shouldShowEmptyItemsBanner(undefined)).toBe(true)
  })

  it('returns false when orderItems has at least one item', () => {
    expect(shouldShowEmptyItemsBanner([{ id: 'x' } as never])).toBe(false)
  })
})

import { hasServerOrderDiverged } from '../update-order-helpers'
import type { IOrder } from '@/types'

function makeOrder(orderItems: Array<{ slug: string; quantity: number; note?: string }>): IOrder {
  return {
    slug: 'order-x',
    orderItems: orderItems.map((it) => ({
      slug: it.slug,
      quantity: it.quantity,
      note: it.note ?? '',
    })),
  } as unknown as IOrder
}

describe('hasServerOrderDiverged', () => {
  it('returns false when both orders have identical item slug+quantity+note', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 2, note: 'ít đá' }])
    const b = makeOrder([{ slug: 'i1', quantity: 2, note: 'ít đá' }])
    expect(hasServerOrderDiverged(a, b)).toBe(false)
  })

  it('returns true when item quantity differs', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 2 }])
    const b = makeOrder([{ slug: 'i1', quantity: 5 }])
    expect(hasServerOrderDiverged(a, b)).toBe(true)
  })

  it('returns true when item note differs', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 2, note: 'ít đá' }])
    const b = makeOrder([{ slug: 'i1', quantity: 2, note: 'không đá' }])
    expect(hasServerOrderDiverged(a, b)).toBe(true)
  })

  it('returns true when item count differs (added on server)', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 1 }])
    const b = makeOrder([{ slug: 'i1', quantity: 1 }, { slug: 'i2', quantity: 1 }])
    expect(hasServerOrderDiverged(a, b)).toBe(true)
  })

  it('returns true when slug differs (item replaced)', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 1 }])
    const b = makeOrder([{ slug: 'i2', quantity: 1 }])
    expect(hasServerOrderDiverged(a, b)).toBe(true)
  })

  it('returns false when both orders have empty orderItems', () => {
    const a = makeOrder([])
    const b = makeOrder([])
    expect(hasServerOrderDiverged(a, b)).toBe(false)
  })

  it('returns false when null is compared with null', () => {
    expect(hasServerOrderDiverged(null, null)).toBe(false)
  })

  it('returns true when one side is null and other has data', () => {
    expect(hasServerOrderDiverged(null, makeOrder([{ slug: 'i1', quantity: 1 }]))).toBe(true)
    expect(hasServerOrderDiverged(makeOrder([{ slug: 'i1', quantity: 1 }]), null)).toBe(true)
  })
})

import { rollbackAddedItems } from '../update-order-helpers'

describe('rollbackAddedItems', () => {
  it('calls deleteFn for each slug in reverse order and returns count', async () => {
    const calls: string[] = []
    const deleteFn = vi.fn(async (slug: string) => {
      calls.push(slug)
    })
    const result = await rollbackAddedItems(['a', 'b', 'c'], deleteFn)
    expect(calls).toEqual(['c', 'b', 'a'])
    expect(result.succeeded).toBe(3)
    expect(result.failed).toBe(0)
  })

  it('continues rolling back even if some deletes fail', async () => {
    const deleteFn = vi.fn(async (slug: string) => {
      if (slug === 'b') throw new Error('boom')
    })
    const result = await rollbackAddedItems(['a', 'b', 'c'], deleteFn)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(deleteFn).toHaveBeenCalledTimes(3)
  })

  it('returns zero counts when slug list is empty', async () => {
    const deleteFn = vi.fn()
    const result = await rollbackAddedItems([], deleteFn)
    expect(result).toEqual({ succeeded: 0, failed: 0 })
    expect(deleteFn).not.toHaveBeenCalled()
  })
})
