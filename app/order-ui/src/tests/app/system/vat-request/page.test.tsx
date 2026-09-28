import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import VatRequestListPage from '@/app/system/vat-request/page'

vi.mock('@/hooks/use-vat-admin', () => ({
  useVatRequests: () => ({
    data: { items: [], total: 0, page: 1, size: 20 },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
    dataUpdatedAt: Date.now(),
  }),
  useHasVatPermission: () => ({
    canView: true,
    canEdit: true,
    canUpdateStatus: true,
  }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <BrowserRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </BrowserRouter>
  )
}

describe('VatRequestListPage', () => {
  it('mounts page title', () => {
    render(<VatRequestListPage />, { wrapper })
    expect(screen.getByText(/Quản lý yêu cầu VAT|VAT Request/i)).toBeInTheDocument()
  })
})
