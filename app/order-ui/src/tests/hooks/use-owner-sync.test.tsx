import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useOwnerSync } from '@/hooks/use-owner-sync'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import { useUserStore } from '@/stores/user.store'
import type { TableCustomer } from '@/types/session'

const patchOwnerMock = vi.fn()
const showErrorToastMock = vi.fn()
const showErrorToastMessageMock = vi.fn()
const showToastMock = vi.fn()

vi.mock('@/hooks/use-order', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-order')>(
    '@/hooks/use-order',
  )
  return {
    ...actual,
    useChangeOrderOwner: () => ({ mutateAsync: patchOwnerMock }),
  }
})

vi.mock('@/utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils')>('@/utils')
  return {
    ...actual,
    showErrorToast: (code: number) => showErrorToastMock(code),
    showErrorToastMessage: (msg: string) => showErrorToastMessageMock(msg),
    showToast: (msg: string) => showToastMock(msg),
  }
})

const sampleCustomer: TableCustomer = {
  slug: 'cust-1',
  firstName: 'Nguyễn',
  lastName: 'Văn A',
  phonenumber: '0900000001',
}

function setupStaff() {
  useUserStore.setState({
    userInfo: {
      slug: 'staff-1',
      firstName: 'Staff',
      lastName: 'A',
    } as never,
  } as never)
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useOwnerSync', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {}, pendingOwnerSync: null })
    setupStaff()
    patchOwnerMock.mockReset()
    showErrorToastMock.mockReset()
    showErrorToastMessageMock.mockReset()
    showToastMock.mockReset()
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
  })

  it('cart pending (no orderSlug): only updates session locally, no PATCH', async () => {
    const { result } = renderHook(
      () => useOwnerSync({ tableId: 't1', orderSlug: undefined }),
      { wrapper },
    )
    await act(async () => {
      await result.current.selectCustomer(sampleCustomer)
    })
    expect(useTableSessionsStore.getState().sessions['t1'].customer).toEqual(
      sampleCustomer,
    )
    expect(patchOwnerMock).not.toHaveBeenCalled()
  })

  it('order placed: PATCH owner with customer.slug + tracks pendingOwnerSync', async () => {
    patchOwnerMock.mockResolvedValue(undefined)
    const { result } = renderHook(
      () => useOwnerSync({ tableId: 't1', orderSlug: 'order-1' }),
      { wrapper },
    )
    await act(async () => {
      await result.current.selectCustomer(sampleCustomer)
    })
    expect(patchOwnerMock).toHaveBeenCalledWith({
      slug: 'order-1',
      owner: 'cust-1',
    })
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBeNull()
  })

  it('selectCustomer(null) on placed order: PATCH owner with staff fallback', async () => {
    patchOwnerMock.mockResolvedValue(undefined)
    useTableSessionsStore.getState().setOrderCustomer('t1', sampleCustomer)
    const { result } = renderHook(
      () => useOwnerSync({ tableId: 't1', orderSlug: 'order-1' }),
      { wrapper },
    )
    await act(async () => {
      await result.current.selectCustomer(null)
    })
    expect(patchOwnerMock).toHaveBeenCalledWith({
      slug: 'order-1',
      owner: 'staff-1',
    })
  })

  it('PATCH failure: rollback session customer + show error toast', async () => {
    const err = {
      response: { data: { errorCodeValue: 1234 } },
    }
    patchOwnerMock.mockRejectedValue(err)
    const { result } = renderHook(
      () => useOwnerSync({ tableId: 't1', orderSlug: 'order-1' }),
      { wrapper },
    )
    await act(async () => {
      await result.current.selectCustomer(sampleCustomer)
    })
    expect(useTableSessionsStore.getState().sessions['t1'].customer).toBeUndefined()
    expect(showErrorToastMock).toHaveBeenCalledWith(1234)
    expect(useTableSessionsStore.getState().pendingOwnerSync).toBeNull()
  })
})
