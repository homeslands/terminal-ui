import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useSessionReconciliation } from '@/hooks/use-session-reconciliation'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSessionReconciliation', () => {
  it('does not call any store action when serverActiveOrder is null', () => {
    const actions = {
      setOrderSlug: vi.fn(),
      replaceSubmittedOrders: vi.fn(),
      cancelSession: vi.fn(),
      clearPendingItems: vi.fn(),
    }
    renderHook(
      () =>
        useSessionReconciliation({
          tableSlug: 't1',
          session: { orderSlug: null, submittedOrders: [], pendingItems: [] } as never,
          serverActiveOrder: null,
          isLoadingActiveOrder: false,
          isFetchingActiveOrder: false,
          ...actions,
        }),
      { wrapper },
    )
    expect(actions.setOrderSlug).not.toHaveBeenCalled()
    expect(actions.replaceSubmittedOrders).not.toHaveBeenCalled()
    expect(actions.cancelSession).not.toHaveBeenCalled()
    expect(actions.clearPendingItems).not.toHaveBeenCalled()
  })

  it('does not run when tableSlug is empty', () => {
    const actions = {
      setOrderSlug: vi.fn(),
      replaceSubmittedOrders: vi.fn(),
      cancelSession: vi.fn(),
      clearPendingItems: vi.fn(),
    }
    renderHook(
      () =>
        useSessionReconciliation({
          tableSlug: '',
          session: null,
          serverActiveOrder: { slug: 'o1', orderItems: [] } as never,
          isLoadingActiveOrder: false,
          isFetchingActiveOrder: false,
          ...actions,
        }),
      { wrapper },
    )
    expect(actions.setOrderSlug).not.toHaveBeenCalled()
  })
})
