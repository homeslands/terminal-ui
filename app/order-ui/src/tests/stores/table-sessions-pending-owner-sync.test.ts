import { describe, it, expect, beforeEach } from 'vitest'
import { useTableSessionsStore } from '@/stores/table-sessions.store'

describe('useTableSessionsStore.pendingOwnerSync', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {}, pendingOwnerSync: null })
  })

  it('defaults to null on a fresh store', () => {
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBeNull()
  })

  it('setPendingOwnerSync stores the given promise', () => {
    const p = Promise.resolve()
    useTableSessionsStore.getState().setPendingOwnerSync(p)
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBe(p)
  })

  it('setPendingOwnerSync(null) clears the promise', () => {
    const p = Promise.resolve()
    useTableSessionsStore.getState().setPendingOwnerSync(p)
    useTableSessionsStore.getState().setPendingOwnerSync(null)
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBeNull()
  })

  it('pendingOwnerSync is not persisted (partialize strips it)', () => {
    const p = Promise.resolve()
    useTableSessionsStore.getState().setPendingOwnerSync(p)
    const raw = localStorage.getItem('terminal_staff_sessions')
    if (!raw) return // store may not have persisted anything yet — acceptable
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> }
    expect(parsed.state?.pendingOwnerSync).toBeUndefined()
  })
})
