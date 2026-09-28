import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import type { OrderItem } from '@/types/session'

vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return { ...actual, showErrorToastMessage: vi.fn() }
})

import { showErrorToastMessage } from '@/utils'

const tableId = 't1'

const regularItem = (over: Partial<OrderItem> = {}): OrderItem => ({
  menuItemId: 'reg-1',
  name: 'Regular',
  priceNum: 50_000,
  price: '50.000đ',
  quantity: 1,
  note: '',
  variantSlug: 'v-reg-1',
  productSlug: 'p-reg-1',
  isCustomPrice: false,
  promotion: null,
  vatRate: 0,
  ...over,
})

const customItem = (over: Partial<OrderItem> = {}): OrderItem => ({
  ...regularItem(),
  menuItemId: 'cp-1',
  customPriceId: 'cp-uuid-1',
  name: 'Custom',
  priceNum: 100_000,
  price: '100.000đ',
  variantSlug: 'v-cp-1',
  productSlug: 'p-cp-1',
  isCustomPrice: true,
  ...over,
})

describe('useTableSessionsStore.addItem — custom-price guards', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
    vi.mocked(showErrorToastMessage).mockClear()
    useTableSessionsStore.getState().openSession(tableId, 'Bàn 1')
  })

  it('blocks adding regular item when pending has custom-price item', () => {
    const added1 = useTableSessionsStore.getState().addItem(tableId, customItem())
    expect(added1).toBe(true)

    const added2 = useTableSessionsStore.getState().addItem(tableId, regularItem())
    expect(added2).toBe(false)
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.cannotMixCustomPriceItems')

    const session = useTableSessionsStore.getState().sessions[tableId]
    expect(session.pendingItems).toHaveLength(1)
    expect(session.pendingItems[0].isCustomPrice).toBe(true)
  })

  it('blocks adding custom-price item when pending has regular item', () => {
    useTableSessionsStore.getState().addItem(tableId, regularItem())

    const added = useTableSessionsStore.getState().addItem(tableId, customItem())
    expect(added).toBe(false)
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.cannotMixCustomPriceItems')

    const session = useTableSessionsStore.getState().sessions[tableId]
    expect(session.pendingItems).toHaveLength(1)
    expect(session.pendingItems[0].isCustomPrice).toBe(false)
  })

  it('blocks adding the same custom-price product twice', () => {
    const a = useTableSessionsStore.getState().addItem(tableId, customItem({
      customPriceId: 'cp-uuid-A',
      priceNum: 100_000,
    }))
    expect(a).toBe(true)

    const b = useTableSessionsStore.getState().addItem(tableId, customItem({
      customPriceId: 'cp-uuid-B',
      priceNum: 200_000,
    }))
    expect(b).toBe(false)
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.customPriceItemAlreadyInCart')

    const session = useTableSessionsStore.getState().sessions[tableId]
    expect(session.pendingItems).toHaveLength(1)
    expect(session.pendingItems[0].customPriceId).toBe('cp-uuid-A')
  })

  it('allows adding different custom-price products', () => {
    const a = useTableSessionsStore.getState().addItem(tableId, customItem({
      productSlug: 'p-cp-A',
      menuItemId: 'cp-A',
    }))
    const b = useTableSessionsStore.getState().addItem(tableId, customItem({
      productSlug: 'p-cp-B',
      menuItemId: 'cp-B',
    }))
    expect(a).toBe(true)
    expect(b).toBe(true)

    const session = useTableSessionsStore.getState().sessions[tableId]
    expect(session.pendingItems).toHaveLength(2)
    expect(showErrorToastMessage).not.toHaveBeenCalled()
  })

  it('also enforces no-mix against submittedOrders (not just pending)', () => {
    useTableSessionsStore.getState().addItem(tableId, customItem())
    useTableSessionsStore.getState().submitOrder(tableId)

    const session1 = useTableSessionsStore.getState().sessions[tableId]
    expect(session1.pendingItems).toHaveLength(0)
    expect(session1.submittedOrders).toHaveLength(1)
    expect(session1.submittedOrders[0].items).toHaveLength(1)

    const added = useTableSessionsStore.getState().addItem(tableId, regularItem())
    expect(added).toBe(false)
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.cannotMixCustomPriceItems')
    expect(useTableSessionsStore.getState().sessions[tableId].pendingItems).toHaveLength(0)
  })
})
