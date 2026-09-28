import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCurrentRole } from '@/hooks/use-current-role'
import { useUserStore } from '@/stores'
import { Role } from '@/constants/role'

describe('useCurrentRole', () => {
  beforeEach(() => {
    useUserStore.setState({ userInfo: null } as never)
  })

  it('returns null when no user info', () => {
    const { result } = renderHook(() => useCurrentRole())
    expect(result.current).toBeNull()
  })

  it('returns CASHIER when role.name is CASHIER', () => {
    useUserStore.setState({
      userInfo: { role: { name: 'CASHIER' } },
    } as never)
    const { result } = renderHook(() => useCurrentRole())
    expect(result.current).toBe(Role.CASHIER)
  })

  it('returns STAFF when role.name is STAFF', () => {
    useUserStore.setState({
      userInfo: { role: { name: 'STAFF' } },
    } as never)
    const { result } = renderHook(() => useCurrentRole())
    expect(result.current).toBe(Role.STAFF)
  })

  it('returns null when role.name is an unknown string', () => {
    useUserStore.setState({
      userInfo: { role: { name: 'UNKNOWN' } },
    } as never)
    const { result } = renderHook(() => useCurrentRole())
    expect(result.current).toBeNull()
  })
})
