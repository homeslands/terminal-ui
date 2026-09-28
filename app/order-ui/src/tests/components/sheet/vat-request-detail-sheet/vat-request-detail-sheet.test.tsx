import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { VatRequestDetailSheet } from '@/components/app/sheet/vat-request-detail-sheet'
import { VatRequestStatus } from '@/types'

vi.mock('@/hooks/use-vat-admin', () => ({
  useHasVatPermission: () => ({
    canView: true,
    canEdit: true,
    canUpdateStatus: true,
  }),
  useUpdateVatRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateVatStatus: () => ({ mutate: vi.fn(), isPending: false }),
}))

const sample = {
  slug: 'VAT-1',
  customerName: 'Co A',
  taxCode: '0123456789',
  email: 'a@x.com',
  address: '123',
  status: VatRequestStatus.PENDING,
  createdAt: '2026-06-26T10:00:00.000Z',
  invoice: {
    slug: 'INV-1',
    referenceNumber: 544,
    amount: 109950,
    totalVatValue: 1700,
  },
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('VatRequestDetailSheet', () => {
  it('does not render when vatRequest is null', () => {
    render(<VatRequestDetailSheet vatRequest={null} onClose={vi.fn()} />, {
      wrapper,
    })
    expect(screen.queryByTestId('vat-detail-sheet')).not.toBeInTheDocument()
  })

  it('renders header with reference # + status badge when vatRequest provided', () => {
    render(<VatRequestDetailSheet vatRequest={sample as never} onClose={vi.fn()} />, {
      wrapper,
    })
    expect(screen.getByTestId('vat-detail-sheet')).toBeInTheDocument()
    // #544 appears in SheetTitle header + Overview tab body; assertion picks both as OK.
    expect(screen.getAllByText('#544').length).toBeGreaterThan(0)
    expect(screen.getByTestId('vat-status-badge-PENDING')).toBeInTheDocument()
  })

  it('renders 2 tabs (overview/customer)', () => {
    render(<VatRequestDetailSheet vatRequest={sample as never} onClose={vi.fn()} />, {
      wrapper,
    })
    expect(screen.getByTestId('vat-tab-overview')).toBeInTheDocument()
    expect(screen.getByTestId('vat-tab-customer')).toBeInTheDocument()
    expect(screen.queryByTestId('vat-tab-accountant')).not.toBeInTheDocument()
    // Default tab: overview content visible.
    expect(screen.getByTestId('vat-overview-tab')).toBeInTheDocument()
  })

  it('renders footer with workflow transition buttons + close (from PENDING)', () => {
    render(<VatRequestDetailSheet vatRequest={sample as never} onClose={vi.fn()} />, {
      wrapper,
    })
    expect(screen.getByTestId('vat-detail-footer')).toBeInTheDocument()
    // PENDING button hidden (same-status block); others visible
    expect(screen.queryByTestId('vat-transition-PENDING')).not.toBeInTheDocument()
    expect(screen.getByTestId('vat-transition-PROCESSING')).toBeInTheDocument()
    expect(screen.getByTestId('vat-transition-COMPLETED')).toBeInTheDocument()
    expect(screen.getByTestId('vat-transition-REJECTED')).toBeInTheDocument()
  })

  it('hides all transition buttons when status is COMPLETED (hard terminal)', () => {
    const terminalSample = { ...sample, status: VatRequestStatus.COMPLETED }
    render(<VatRequestDetailSheet vatRequest={terminalSample as never} onClose={vi.fn()} />, {
      wrapper,
    })
    // COMPLETED is a hard terminal — no transitions allowed at all.
    const workflowSection = screen.getByTestId('vat-status-workflow-section')
    expect(workflowSection.querySelectorAll('button')).toHaveLength(0)
    expect(screen.queryByTestId('vat-transition-PENDING')).not.toBeInTheDocument()
    expect(screen.queryByTestId('vat-transition-PROCESSING')).not.toBeInTheDocument()
    expect(screen.queryByTestId('vat-transition-COMPLETED')).not.toBeInTheDocument()
    expect(screen.queryByTestId('vat-transition-REJECTED')).not.toBeInTheDocument()
  })

  it('shows transition buttons from REJECTED (still allowed)', () => {
    const rejectedSample = { ...sample, status: VatRequestStatus.REJECTED }
    render(<VatRequestDetailSheet vatRequest={rejectedSample as never} onClose={vi.fn()} />, {
      wrapper,
    })
    // REJECTED can transition to PENDING, PROCESSING, COMPLETED (free transitions).
    expect(screen.getByTestId('vat-transition-PENDING')).toBeInTheDocument()
    expect(screen.getByTestId('vat-transition-PROCESSING')).toBeInTheDocument()
    expect(screen.getByTestId('vat-transition-COMPLETED')).toBeInTheDocument()
    // REJECTED button hidden (same-status block).
    expect(screen.queryByTestId('vat-transition-REJECTED')).not.toBeInTheDocument()
  })

})
