import { describe, it, expect, beforeEach } from 'vitest'
import { useTableSessionsStore } from '@/stores/table-sessions.store'

describe('useTableSessionsStore.addItem — always-push semantics', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
  })

  it('pushes a new pending row on every add (no consolidation) and refreshes economic snapshot via updateItem semantics elsewhere', () => {
    const tableId = 'table-1'
    useTableSessionsStore.getState().openSession(tableId, 'Bàn 1')

    // First add: no promotion
    useTableSessionsStore.getState().addItem(tableId, {
      menuItemId: 'prod-A',
      name: 'Product A',
      priceNum: 100_000,
      price: '100.000đ',
      quantity: 1,
      note: '',
      variantSlug: 'v-1',
      promotion: null,
      vatRate: 0,
    })

    let session = useTableSessionsStore.getState().sessions[tableId]
    expect(session.pendingItems).toHaveLength(1)
    expect(session.pendingItems[0].promotion).toBeNull()
    expect(session.pendingItems[0].quantity).toBe(1)

    // Second add: same product, now with promotion. Should produce a NEW row,
    // not consolidate into the existing one.
    useTableSessionsStore.getState().addItem(tableId, {
      menuItemId: 'prod-A',
      name: 'Product A',
      priceNum: 80_000,
      price: '80.000đ',
      quantity: 1,
      note: '',
      variantSlug: 'v-1',
      originalPrice: 100_000,
      promotion: { slug: 'promo-1', value: 20 },
      vatRate: 0,
    })

    session = useTableSessionsStore.getState().sessions[tableId]
    expect(session.pendingItems).toHaveLength(2)
    // First row preserved exactly as added.
    expect(session.pendingItems[0].promotion).toBeNull()
    expect(session.pendingItems[0].priceNum).toBe(100_000)
    expect(session.pendingItems[0].quantity).toBe(1)
    // Second row carries the incoming promotion / pricing.
    expect(session.pendingItems[1].promotion).toEqual({
      slug: 'promo-1',
      value: 20,
    })
    expect(session.pendingItems[1].priceNum).toBe(80_000)
    expect(session.pendingItems[1].originalPrice).toBe(100_000)
    expect(session.pendingItems[1].quantity).toBe(1)
  })

  it('preserves per-row note and orderItemSlug independently across separate adds', () => {
    const tableId = 'table-2'
    useTableSessionsStore.getState().openSession(tableId, 'Bàn 2')

    useTableSessionsStore.getState().addItem(tableId, {
      menuItemId: 'prod-B',
      name: 'Product B',
      priceNum: 50_000,
      price: '50.000đ',
      quantity: 1,
      note: 'ít cay',
      variantSlug: 'v-2',
      orderItemSlug: 'oi-1',
      promotion: null,
      vatRate: 0,
    })

    useTableSessionsStore.getState().addItem(tableId, {
      menuItemId: 'prod-B',
      name: 'Product B',
      priceNum: 50_000,
      price: '50.000đ',
      quantity: 1,
      note: '', // incoming has no note
      variantSlug: 'v-2',
      promotion: null,
      vatRate: 0,
    })

    const session = useTableSessionsStore.getState().sessions[tableId]
    expect(session.pendingItems).toHaveLength(2)
    // First row keeps its note / orderItemSlug.
    expect(session.pendingItems[0].note).toBe('ít cay')
    expect(session.pendingItems[0].orderItemSlug).toBe('oi-1')
    // Second row is independent.
    expect(session.pendingItems[1].note).toBe('')
    expect(session.pendingItems[1].orderItemSlug).toBeUndefined()
  })

  it('addItem A twice produces two separate rows with distinct rowIds, each quantity 1', () => {
    const tableId = 'table-3'
    useTableSessionsStore.getState().openSession(tableId, 'Bàn 3')

    const addA = () =>
      useTableSessionsStore.getState().addItem(tableId, {
        menuItemId: 'prod-A',
        name: 'Product A',
        priceNum: 100_000,
        price: '100.000đ',
        quantity: 1,
        note: '',
        variantSlug: 'v-1',
        promotion: null,
        vatRate: 0,
      })

    addA()
    addA()

    const session = useTableSessionsStore.getState().sessions[tableId]
    expect(session.pendingItems).toHaveLength(2)
    expect(session.pendingItems[0].quantity).toBe(1)
    expect(session.pendingItems[1].quantity).toBe(1)
    expect(session.pendingItems[0].rowId).toBeDefined()
    expect(session.pendingItems[1].rowId).toBeDefined()
    expect(session.pendingItems[0].rowId).not.toBe(
      session.pendingItems[1].rowId,
    )
  })
})
