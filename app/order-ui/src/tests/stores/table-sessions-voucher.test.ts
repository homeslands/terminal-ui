import { describe, it, expect, beforeEach } from 'vitest'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import type { IVoucher } from '@/types'

describe('useTableSessionsStore.setOrderVoucher', () => {
  beforeEach(() => {
    // Reset store between tests to avoid cross-test contamination via the
    // persist middleware's module-level state.
    useTableSessionsStore.setState({ sessions: {} })
  })

  it('attaches voucher to existing session', () => {
    const store = useTableSessionsStore.getState()
    store.openSession('t1', 'Bàn 1')
    const v = { slug: 'v1', code: 'CODE', value: 20 } as unknown as IVoucher
    store.setOrderVoucher('t1', v)
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toEqual(v)
  })

  it('removes voucher when called with null', () => {
    const store = useTableSessionsStore.getState()
    store.openSession('t1', 'Bàn 1')
    const v = { slug: 'v1', code: 'CODE', value: 20 } as unknown as IVoucher
    store.setOrderVoucher('t1', v)
    store.setOrderVoucher('t1', null)
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toBeUndefined()
  })

  it('is a no-op when session does not exist', () => {
    const store = useTableSessionsStore.getState()
    const v = { slug: 'v1', code: 'CODE', value: 20 } as unknown as IVoucher
    store.setOrderVoucher('nope', v)
    expect(useTableSessionsStore.getState().sessions['nope']).toBeUndefined()
  })

  it('is a no-op when removing voucher that was not set', () => {
    const store = useTableSessionsStore.getState()
    store.openSession('t1', 'Bàn 1')
    store.setOrderVoucher('t1', null)
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toBeUndefined()
  })
})
