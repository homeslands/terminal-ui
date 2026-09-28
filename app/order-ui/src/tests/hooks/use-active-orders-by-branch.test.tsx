import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useActiveOrdersByBranch } from '@/hooks/use-order'

const getAllOrdersMock = vi.fn()

vi.mock('@/api/order', async () => {
  const actual = await vi.importActual<typeof import('@/api/order')>(
    '@/api/order',
  )
  return {
    ...actual,
    getAllOrders: (...args: unknown[]) => getAllOrdersMock(...args),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useActiveOrdersByBranch', () => {
  beforeEach(() => {
    getAllOrdersMock.mockReset()
    getAllOrdersMock.mockResolvedValue({
      result: { items: [], totalPages: 1, total: 0 },
    })
  })

  it('calls getAllOrders with branch + status=pending + hasPaging=false', async () => {
    renderHook(() => useActiveOrdersByBranch('branch-1'), { wrapper })
    await waitFor(() => {
      expect(getAllOrdersMock).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'branch-1',
          status: 'pending',
          hasPaging: false,
        }),
      )
    })
  })

  it('does not fetch when branch is empty', async () => {
    renderHook(() => useActiveOrdersByBranch(''), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(getAllOrdersMock).not.toHaveBeenCalled()
  })

  it('does not fetch when branch is undefined', async () => {
    renderHook(() => useActiveOrdersByBranch(undefined), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(getAllOrdersMock).not.toHaveBeenCalled()
  })
})
