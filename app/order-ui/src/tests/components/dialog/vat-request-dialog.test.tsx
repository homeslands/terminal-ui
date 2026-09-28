import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/api/vat', () => ({
  getVatLink: vi.fn(),
  getVatRequestPublic: vi.fn(),
  submitVatRequestPublic: vi.fn(),
}))

import * as api from '@/api/vat'
import { VatRequestDialog } from '@/components/app/dialog/vat-request/vat-request-dialog'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('VatRequestDialog', () => {
  it('does not render when open=false', () => {
    render(
      <VatRequestDialog
        open={false}
        onOpenChange={vi.fn()}
        orderSlug="order-1"
      />,
      { wrapper },
    )
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('fetches link on open=true', async () => {
    vi.mocked(api.getVatLink).mockResolvedValue({
      result: { url: '/vat-request/INV-1' },
    } as never)
    vi.mocked(api.getVatRequestPublic).mockResolvedValue({
      result: { invoiceSlug: 'INV-1', status: 'AVAILABLE' },
    } as never)
    render(
      <VatRequestDialog
        open={true}
        onOpenChange={vi.fn()}
        orderSlug="order-1"
      />,
      { wrapper },
    )
    await waitFor(() => expect(api.getVatLink).toHaveBeenCalledWith('order-1'))
  })

  it('shows submitted view when status=SUBMITTED', async () => {
    vi.mocked(api.getVatLink).mockResolvedValue({
      result: { url: '/vat-request/INV-1' },
    } as never)
    vi.mocked(api.getVatRequestPublic).mockResolvedValue({
      result: { invoiceSlug: 'INV-1', status: 'SUBMITTED' },
    } as never)
    render(
      <VatRequestDialog
        open={true}
        onOpenChange={vi.fn()}
        orderSlug="order-1"
      />,
      { wrapper },
    )
    await waitFor(() =>
      expect(screen.getByText(/đã được ghi nhận|already/i)).toBeTruthy(),
    )
  })
})
