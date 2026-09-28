import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { Role } from '@/constants'
import { useBranchShiftGate } from '../use-branch-shift-gate'

const mockCurrent = vi.fn()
const mockActive = vi.fn()
const mockRole = vi.fn()

vi.mock('../use-work-shift', () => ({
  useCurrentWorkShift: (enabled: boolean) => mockCurrent(enabled),
  useActiveWorkShifts: (branchSlug?: string, enabled?: boolean) =>
    mockActive(branchSlug, enabled),
}))

vi.mock('@/stores', () => ({
  useUserStore: (selector: (s: unknown) => unknown) =>
    selector({ getUserInfo: () => ({ role: { name: mockRole() } }) }),
}))

beforeEach(() => {
  mockCurrent.mockReturnValue({ data: undefined, isLoading: false })
  mockActive.mockReturnValue({ data: undefined, isLoading: false })
})

describe('useBranchShiftGate', () => {
  it('blocks STAFF without calling any shift endpoint', () => {
    mockRole.mockReturnValue(Role.STAFF)
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(false)
    expect(result.current.reason).toBe('STAFF_CANNOT_PAY')
    expect(mockCurrent).toHaveBeenCalledWith(false)
    expect(mockActive).toHaveBeenCalledWith('branch-1', false)
  })

  it('allows CASHIER when they have an active shift', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockCurrent.mockReturnValue({ data: { slug: 'ws-1' }, isLoading: false })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(true)
    expect(result.current.reason).toBe('OK')
  })

  it('blocks CASHIER with no active shift', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockCurrent.mockReturnValue({ data: undefined, isLoading: false })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(false)
    expect(result.current.reason).toBe('NO_ACTIVE_SHIFT')
  })

  it('allows MANAGER when the branch has at least one active shift', () => {
    mockRole.mockReturnValue(Role.MANAGER)
    mockActive.mockReturnValue({ data: [{ slug: 'ws-1' }], isLoading: false })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(true)
    expect(result.current.reason).toBe('OK')
  })

  it('blocks MANAGER when the branch has no active shift', () => {
    mockRole.mockReturnValue(Role.MANAGER)
    mockActive.mockReturnValue({ data: [], isLoading: false })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(false)
    expect(result.current.reason).toBe('NO_ACTIVE_SHIFT')
  })

  it('does not block while still loading', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockCurrent.mockReturnValue({ data: undefined, isLoading: true })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.canPay).toBe(false)
    expect(result.current.reason).toBe('UNKNOWN')
  })
})
