import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTableSessions } from '../useTableSessions'
import { useTableSessionsStore } from '@/stores'
import { STORAGE_KEYS } from '@/data/staff-data'
import type { OrderItem } from '@/types/session'

// Mock MODULE CỤ THỂ `@/utils/toast`, không phải barrel `@/utils`.
//
// Từ giai đoạn 1, `stores/table-sessions.store.ts` import
// `showErrorToastMessage` thẳng từ `@/utils/toast` để gỡ vòng import qua
// barrel (xem `tests/utils/barrel-import-cycle.test.ts`). Mock barrel sau đợt
// đó không còn chặn được lệnh gọi nào — hai ca "custom price" dưới đây đỏ vì
// spy không bao giờ được gọi, trong khi store vẫn chạy đúng.
//
// Mock ở module cụ thể thì chặt hơn: barrel re-export từ chính `./toast` nên
// cả hai đường import đều nhận bản mock này.
vi.mock('@/utils/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/toast')>()
  return { ...actual, showErrorToastMessage: vi.fn() }
})

import { showErrorToastMessage } from '@/utils/toast'

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  menuItemId: 'm1',
  name: 'Cà phê đen',
  priceNum: 25_000,
  price: '25.000đ',
  quantity: 1,
  note: '',
  ...overrides,
})

function readPersistedSessions(): Record<string, unknown> {
  const raw = window.localStorage.getItem(STORAGE_KEYS.sessions)
  if (!raw) return {}
  const parsed = JSON.parse(raw) as { state?: { sessions?: Record<string, unknown> } }
  return parsed.state?.sessions ?? {}
}

function writePersistedSessions(sessions: Record<string, unknown>): void {
  window.localStorage.setItem(
    STORAGE_KEYS.sessions,
    JSON.stringify({ state: { sessions }, version: 1 }),
  )
}

describe('useTableSessions', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useTableSessionsStore.setState({ sessions: {} })
  })

  it('starts with no sessions', () => {
    const { result } = renderHook(() => useTableSessions())
    expect(result.current.sessions).toEqual({})
  })

  it('openSession creates an empty serving session and persists it', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    expect(result.current.sessions.t1.status).toBe('serving')
    expect(result.current.sessions.t1.pendingItems).toEqual([])
    expect(result.current.sessions.t1.submittedOrders).toEqual([])
    const stored = readPersistedSessions() as Record<string, { status: string }>
    expect(stored.t1.status).toBe('serving')
  })

  it('openSession does not overwrite an existing session', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.addItem('t1', item()))
    act(() => result.current.openSession('t1', 'Bàn 01'))
    expect(result.current.sessions.t1.pendingItems).toHaveLength(1)
  })

  it('addItem appends a new pending row on every add (no consolidation)', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.addItem('t1', item({ quantity: 1 })))
    act(() => result.current.addItem('t1', item({ quantity: 2 })))
    expect(result.current.sessions.t1.pendingItems).toHaveLength(2)
    expect(result.current.sessions.t1.pendingItems[0].quantity).toBe(1)
    expect(result.current.sessions.t1.pendingItems[1].quantity).toBe(2)
  })

  it('updateItem patches quantity or note (matched by rowId)', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.addItem('t1', item()))
    const rowId = result.current.sessions.t1.pendingItems[0].rowId!
    act(() => result.current.updateItem('t1', rowId, { quantity: 5, note: 'ít đường' }))
    expect(result.current.sessions.t1.pendingItems[0].quantity).toBe(5)
    expect(result.current.sessions.t1.pendingItems[0].note).toBe('ít đường')
  })

  it('updateItem patches priceNum and price for custom-price items', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.addItem('t1', item({ customPriceId: 'cp-1', isCustomPrice: true, priceNum: 50_000, price: '50.000đ' })))
    const rowId = result.current.sessions.t1.pendingItems[0].rowId!
    act(() => result.current.updateItem('t1', rowId, { priceNum: 80_000, price: '80.000đ' }))
    expect(result.current.sessions.t1.pendingItems[0].priceNum).toBe(80_000)
    expect(result.current.sessions.t1.pendingItems[0].price).toBe('80.000đ')
  })

  it('removeItem deletes the matching pending item (by rowId)', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.addItem('t1', item()))
    const rowId = result.current.sessions.t1.pendingItems[0].rowId!
    act(() => result.current.removeItem('t1', rowId))
    expect(result.current.sessions.t1.pendingItems).toEqual([])
  })

  it('submitOrder moves pendingItems into a new SubmittedOrder and clears pending', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.addItem('t1', item({ quantity: 2 })))
    act(() => result.current.submitOrder('t1'))
    expect(result.current.sessions.t1.pendingItems).toEqual([])
    expect(result.current.sessions.t1.submittedOrders).toHaveLength(1)
    expect(result.current.sessions.t1.submittedOrders[0].items[0].quantity).toBe(2)
    expect(result.current.sessions.t1.submittedOrders[0].id).toMatch(/^order-/)
  })

  it('submitOrder is a no-op when pendingItems is empty', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.submitOrder('t1'))
    expect(result.current.sessions.t1.submittedOrders).toEqual([])
  })

  it('requestPayment flips serving → waiting_payment', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.requestPayment('t1'))
    expect(result.current.sessions.t1.status).toBe('waiting_payment')
  })

  it('closeSession deletes the session', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.closeSession('t1'))
    expect(result.current.sessions.t1).toBeUndefined()
    const stored = readPersistedSessions()
    expect(stored.t1).toBeUndefined()
  })

  it('setInvoiceRequest attaches invoice metadata to the session', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.setInvoiceRequest('t1', {
      buyerName: 'Nguyễn Văn A',
      buyerTaxCode: '03011',
      buyerAddress: 'addr',
      buyerEmail: 'a@b.com',
      paymentMethod: 'transfer',
    }))
    expect(result.current.sessions.t1.invoiceRequest?.paymentMethod).toBe('transfer')
  })

  it('hydrates from localStorage on first render', async () => {
    writePersistedSessions({
      t1: {
        tableId: 't1',
        status: 'serving',
        pendingItems: [],
        submittedOrders: [],
        openedAt: '2026-06-01T00:00:00Z',
      },
    })
    await useTableSessionsStore.persist.rehydrate()
    const { result } = renderHook(() => useTableSessions())
    expect(result.current.sessions.t1.status).toBe('serving')
  })

  it('hydrates legacy (pre-Zustand) bare Sessions shape from localStorage', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sessions,
      JSON.stringify({
        t1: {
          tableId: 't1',
          tableName: 'Bàn 01',
          status: 'serving',
          pendingItems: [
            {
              menuItemId: 'm1',
              name: 'Cà phê đen',
              priceNum: 25_000,
              price: '25.000đ',
              quantity: 2,
              note: '',
            },
          ],
          submittedOrders: [],
          openedAt: '2026-06-01T00:00:00Z',
        },
      }),
    )
    await useTableSessionsStore.persist.rehydrate()
    const { result } = renderHook(() => useTableSessions())
    expect(result.current.sessions.t1.tableName).toBe('Bàn 01')
    expect(result.current.sessions.t1.pendingItems[0].quantity).toBe(2)
  })

  it('transferSession moves session to the new table and removes the old one', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.addItem('t1', item()))
    act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
    expect(result.current.sessions.t1).toBeUndefined()
    expect(result.current.sessions.t2).toBeDefined()
    expect(result.current.sessions.t2.tableName).toBe('Bàn 02')
    expect(result.current.sessions.t2.pendingItems).toHaveLength(1)
  })

  it('transferSession persists the new session to localStorage', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
    const stored = readPersistedSessions()
    expect(stored.t1).toBeUndefined()
    expect(stored.t2).toBeDefined()
  })

  it('transferSession is a no-op when target is occupied', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.openSession('t2', 'Bàn 02'))
    act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
    expect(result.current.sessions.t1).toBeDefined()
    expect(result.current.sessions.t2.tableName).toBe('Bàn 02')
  })

  it('addSubmittedOrderItem appends a synthetic submitted order with the given item', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.submitOrder('t1')) // no-op — pendingItems empty

    act(() => result.current.addSubmittedOrderItem('t1', item({ orderItemSlug: 'oi-x', quantity: 2 })))
    expect(result.current.sessions.t1.submittedOrders).toHaveLength(1)
    expect(result.current.sessions.t1.submittedOrders[0].items[0].orderItemSlug).toBe('oi-x')
    expect(result.current.sessions.t1.submittedOrders[0].items[0].quantity).toBe(2)
  })

  it('updateSubmittedItemNote replaces note on all matching items', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() =>
      result.current.addSubmittedOrderItem(
        't1',
        item({ menuItemId: 'm1', note: 'ít đường', quantity: 1 }),
      )
    )
    act(() => result.current.updateSubmittedItemNote('t1', 'm1', 'ít đường', 'không đường'))
    expect(result.current.sessions.t1.submittedOrders[0].items[0].note).toBe('không đường')
  })

  it('updateSubmittedItemNote is a no-op when no item matches', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.addSubmittedOrderItem('t1', item({ note: '' })))
    act(() => result.current.updateSubmittedItemNote('t1', 'm1', 'không tồn tại', 'mới'))
    expect(result.current.sessions.t1.submittedOrders[0].items[0].note).toBe('')
  })

  it('replaceSubmittedOrders overwrites submittedOrders for the table', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() =>
      result.current.replaceSubmittedOrders('t1', [
        {
          id: 'order-abc',
          submittedAt: '2026-06-06T10:30:00Z',
          items: [item({ menuItemId: 'm1', quantity: 3, orderItemSlug: 'oi-1' })],
        },
      ]),
    )
    expect(result.current.sessions.t1.submittedOrders).toHaveLength(1)
    expect(result.current.sessions.t1.submittedOrders[0].id).toBe('order-abc')
    expect(result.current.sessions.t1.submittedOrders[0].items[0].quantity).toBe(3)
  })

  it('replaceSubmittedOrders is a no-op when the session does not exist', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.replaceSubmittedOrders('nonexistent', []))
    expect(result.current.sessions.nonexistent).toBeUndefined()
  })

  it('setOrderDescription sets description on the session', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.setOrderDescription('t1', 'khách dị ứng tôm'))
    expect(result.current.sessions.t1.description).toBe('khách dị ứng tôm')
  })

  it('setOrderCustomer attaches and clears customer', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() =>
      result.current.setOrderCustomer('t1', {
        slug: 'cus-1',
        firstName: 'Nguyễn',
        lastName: 'A',
        phonenumber: '0901234567',
      }),
    )
    expect(result.current.sessions.t1.customer?.slug).toBe('cus-1')

    act(() => result.current.setOrderCustomer('t1', null))
    expect(result.current.sessions.t1.customer).toBeUndefined()
  })

  it('setOrderDescription is a no-op when the session does not exist', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.setOrderDescription('nonexistent', 'note'))
    expect(result.current.sessions.nonexistent).toBeUndefined()
  })
})

describe('useTableSessions — addItem custom-price guard', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useTableSessionsStore.setState({ sessions: {} })
    vi.mocked(showErrorToastMessage).mockClear()
  })

  it('blocks adding the same custom-price product twice (Guard 2)', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 1'))
    act(() => result.current.addItem('t1', item({ menuItemId: 'cp-1', customPriceId: 'id-1', priceNum: 50_000, isCustomPrice: true })))
    act(() => result.current.addItem('t1', item({ menuItemId: 'cp-1', customPriceId: 'id-2', priceNum: 80_000, isCustomPrice: true })))
    expect(result.current.sessions.t1.pendingItems).toHaveLength(1)
    expect(result.current.sessions.t1.pendingItems[0].priceNum).toBe(50_000)
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.customPriceItemAlreadyInCart')
  })

  it('blocks mixing regular item alongside custom-price item (Guard 1)', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 1'))
    act(() => result.current.addItem('t1', item({ menuItemId: 'cp-1', isCustomPrice: true })))
    act(() => result.current.addItem('t1', item({ menuItemId: 'reg-1', isCustomPrice: false })))
    expect(result.current.sessions.t1.pendingItems).toHaveLength(1)
    expect(result.current.sessions.t1.pendingItems[0].isCustomPrice).toBe(true)
    expect(showErrorToastMessage).toHaveBeenCalledWith('toast.cannotMixCustomPriceItems')
  })

  it('regular item creates a separate pending row on every add (no quantity merge)', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 1'))
    const reg = item({ menuItemId: 'reg-1' })
    act(() => result.current.addItem('t1', reg))
    act(() => result.current.addItem('t1', reg))
    const pending = result.current.sessions.t1.pendingItems
    expect(pending).toHaveLength(2)
    expect(pending[0].quantity).toBe(1)
    expect(pending[1].quantity).toBe(1)
    expect(pending[0].rowId).toBeDefined()
    expect(pending[1].rowId).toBeDefined()
    expect(pending[0].rowId).not.toBe(pending[1].rowId)
  })
})
