import { describe, it, expect } from 'vitest'
import { collectOrderItemsForKey, mergeOrderItems, applySubmittedQuantity, transferSession } from '@/lib/staff-orders'
import type { SubmittedOrder, TableSession } from '@/types/session'

const order = (id: string, items: SubmittedOrder['items']): SubmittedOrder => ({
  id,
  items,
  submittedAt: '2026-06-01T10:00:00Z',
})

describe('mergeOrderItems', () => {
  it('returns an empty array when there are no orders', () => {
    expect(mergeOrderItems([])).toEqual([])
  })

  it('returns a single item untouched when only one order has one item', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [{ menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' }]),
    ]
    expect(mergeOrderItems(orders)).toEqual([
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
    ])
  })

  it('sums quantities for items with the same menuItemId AND same note across orders', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
      ]),
      order('o2', [
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 3, note: '' },
        { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 2, note: '' },
      ]),
    ]
    const merged = mergeOrderItems(orders)
    expect(merged).toHaveLength(2)
    expect(merged.find((m) => m.menuItemId === 'm1')?.quantity).toBe(4)
    expect(merged.find((m) => m.menuItemId === 'm2')?.quantity).toBe(2)
  })

  it('preserves the order in which menuItemIds are first encountered', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [
        { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 1, note: '' },
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
      ]),
      order('o2', [
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
      ]),
    ]
    expect(mergeOrderItems(orders).map((m) => m.menuItemId)).toEqual(['m2', 'm1'])
  })

  it('preserves the note field in the merged result', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [{ menuItemId: 'm1', name: 'X', priceNum: 1000, price: '1.000đ', quantity: 1, note: 'keep me' }]),
    ]
    expect(mergeOrderItems(orders)[0]).toMatchObject({ note: 'keep me' })
  })

  it('keeps items with the same menuItemId but different notes as separate rows', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: 'ít đường' },
      ]),
      order('o2', [
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: 'không đường' },
      ]),
    ]
    const merged = mergeOrderItems(orders)
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({ menuItemId: 'm1', quantity: 1, note: 'ít đường' })
    expect(merged[1]).toMatchObject({ menuItemId: 'm1', quantity: 2, note: 'không đường' })
  })

  it('merges items with the same menuItemId AND same note', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [{ menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: 'ít đường' }]),
      order('o2', [{ menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 3, note: 'ít đường' }]),
    ]
    const merged = mergeOrderItems(orders)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ quantity: 4, note: 'ít đường' })
  })
})

const item = (
  menuItemId: string,
  quantity: number,
  note = '',
): SubmittedOrder['items'][number] => ({
  menuItemId,
  name: menuItemId,
  priceNum: 10_000,
  price: '10.000đ',
  quantity,
  note,
})

describe('applySubmittedQuantity', () => {
  it('reduces quantity of a single item in a single order', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 3)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 1)
    expect(result[0].items[0].quantity).toBe(1)
  })

  it('removes the item when newQty reaches 0', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 2), item('m2', 1)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 0)
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0].menuItemId).toBe('m2')
  })

  it('removes the order entirely when its last item is removed', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 1)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 0)
    expect(result).toHaveLength(0)
  })

  it('applies LIFO — removes from newest order first', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [item('m1', 2)]),
      order('o2', [item('m1', 1)]),
    ]
    const result = applySubmittedQuantity(orders, 'm1', '', 2)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('o1')
    expect(result[0].items[0].quantity).toBe(2)
  })

  it('spans multiple orders when needed (LIFO)', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [item('m1', 2)]),
      order('o2', [item('m1', 3)]),
    ]
    const result = applySubmittedQuantity(orders, 'm1', '', 1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('o1')
    expect(result[0].items[0].quantity).toBe(1)
  })

  it('is a no-op when newQty equals current total', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 2)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 2)
    expect(result).toBe(orders)
  })

  it('increases quantity in the most recent order containing the item', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [item('m1', 2)]),
      order('o2', [item('m2', 1)]),
    ]
    const result = applySubmittedQuantity(orders, 'm1', '', 5)
    expect(result[0].items[0].quantity).toBe(5)
    expect(result[1].items[0].quantity).toBe(1) // unrelated order untouched
  })

  it('is a no-op when item not found and newQty exceeds current total', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 2)])]
    const result = applySubmittedQuantity(orders, 'unknown', '', 5)
    expect(result).toBe(orders)
  })

  it('matches by note — different notes are treated as separate items', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [item('m1', 2, 'ít đường'), item('m1', 1, 'không đường')]),
    ]
    const result = applySubmittedQuantity(orders, 'm1', 'ít đường', 1)
    const ít = result[0].items.find((i) => i.note === 'ít đường')
    const không = result[0].items.find((i) => i.note === 'không đường')
    expect(ít?.quantity).toBe(1)
    expect(không?.quantity).toBe(1)
  })

  it('does not mutate the input array', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 3)])]
    const original = orders[0].items[0].quantity
    applySubmittedQuantity(orders, 'm1', '', 1)
    expect(orders[0].items[0].quantity).toBe(original)
  })
})

const makeSession = (tableId: string, tableName: string): TableSession => ({
  tableId,
  tableName,
  status: 'serving',
  pendingItems: [],
  submittedOrders: [],
  openedAt: '2026-06-01T10:00:00Z',
})

describe('transferSession', () => {
  it('is a no-op (same reference) when fromTableId equals toTableId', () => {
    const sessions = { t1: makeSession('t1', 'Bàn 01') }
    const result = transferSession(sessions, 't1', 't1', 'Bàn 01')
    expect(result).toBe(sessions)
  })

  it('moves the session to the target table with updated tableId and tableName', () => {
    const sessions = { t1: makeSession('t1', 'Bàn 01') }
    const result = transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(result.t1).toBeUndefined()
    expect(result.t2).toMatchObject({ tableId: 't2', tableName: 'Bàn 02', status: 'serving' })
  })

  it('preserves pendingItems, submittedOrders, and openedAt from the original session', () => {
    const base = makeSession('t1', 'Bàn 01')
    const sessions = {
      t1: {
        ...base,
        pendingItems: [{ menuItemId: 'm1', name: 'X', priceNum: 10_000, price: '10.000đ', quantity: 2, note: '' }],
        submittedOrders: [{ id: 'o1', submittedAt: '2026-06-01T10:00:00Z', items: [] }],
        openedAt: '2026-06-01T09:00:00Z',
      },
    }
    const result = transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(result.t2.pendingItems).toHaveLength(1)
    expect(result.t2.submittedOrders).toHaveLength(1)
    expect(result.t2.openedAt).toBe('2026-06-01T09:00:00Z')
  })

  it('is a no-op (same reference) when the source table does not have a session', () => {
    const sessions = { t2: makeSession('t2', 'Bàn 02') }
    const result = transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(result).toBe(sessions)
  })

  it('is a no-op (same reference) when the target table already has a session', () => {
    const sessions = { t1: makeSession('t1', 'Bàn 01'), t2: makeSession('t2', 'Bàn 02') }
    const result = transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(result).toBe(sessions)
  })

  it('does not mutate the input sessions object', () => {
    const sessions = { t1: makeSession('t1', 'Bàn 01') }
    const originalT1 = sessions.t1
    transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(sessions.t1).toBe(originalT1)
  })
})

const ordersForKey: SubmittedOrder[] = [
  {
    id: 'o1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê', priceNum: 25_000, price: '25k', quantity: 2, note: '', orderItemSlug: 'oi-a' },
    ],
  },
  {
    id: 'o2',
    submittedAt: '2026-06-01T10:05:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê', priceNum: 25_000, price: '25k', quantity: 1, note: '', orderItemSlug: 'oi-b' },
      { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45k', quantity: 1, note: '', orderItemSlug: 'oi-c' },
    ],
  },
]

describe('collectOrderItemsForKey', () => {
  it('returns items for the matching key, newest-first', () => {
    const result = collectOrderItemsForKey(ordersForKey, 'm1', '')
    expect(result).toEqual([
      { orderItemSlug: 'oi-b', variantSlug: '', quantity: 1 },
      { orderItemSlug: 'oi-a', variantSlug: '', quantity: 2 },
    ])
  })

  it('returns empty array when no items match', () => {
    expect(collectOrderItemsForKey(ordersForKey, 'unknown', '')).toEqual([])
  })

  it('filters out items without orderItemSlug', () => {
    const ordersNoSlug: SubmittedOrder[] = [
      {
        id: 'o1',
        submittedAt: '2026-06-01T10:00:00Z',
        items: [{ menuItemId: 'm1', name: 'X', priceNum: 1, price: '1k', quantity: 1, note: '' }],
      },
    ]
    expect(collectOrderItemsForKey(ordersNoSlug, 'm1', '')).toEqual([])
  })

  it('respects note as part of the key', () => {
    const result = collectOrderItemsForKey(ordersForKey, 'm1', 'ít đường')
    expect(result).toEqual([])
  })
})
