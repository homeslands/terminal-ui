import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StatusTransitionConfirmDialog } from '@/components/app/dialog/status-transition-confirm-dialog'
import { VatRequestStatus } from '@/types'

const mutate = vi.fn()
vi.mock('@/hooks/use-vat-admin', () => ({
  useUpdateVatStatus: () => ({ mutate, isPending: false }),
}))

const sample = {
  slug: 'VAT-1',
  invoiceSlug: 'INV-1',
  status: VatRequestStatus.PENDING,
  invoiceNumber: undefined,
} as never

describe('StatusTransitionConfirmDialog', () => {
  it('requires invoiceNumber for COMPLETED', async () => {
    mutate.mockReset()
    render(
      <StatusTransitionConfirmDialog
        open={true}
        vatRequest={sample}
        targetStatus={VatRequestStatus.COMPLETED}
        onClose={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('vat-transition-confirm'))
    await waitFor(() => {
      expect(screen.getByTestId('vat-transition-invoice-error')).toBeInTheDocument()
    })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('requires note >= 3 chars for REJECTED', async () => {
    mutate.mockReset()
    render(
      <StatusTransitionConfirmDialog
        open={true}
        vatRequest={sample}
        targetStatus={VatRequestStatus.REJECTED}
        onClose={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByTestId('vat-transition-note'), {
      target: { value: 'no' },
    })
    fireEvent.click(screen.getByTestId('vat-transition-confirm'))
    await waitFor(() => {
      expect(screen.getByTestId('vat-transition-note-error')).toBeInTheDocument()
    })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('submits valid COMPLETED payload', async () => {
    mutate.mockReset()
    render(
      <StatusTransitionConfirmDialog
        open={true}
        vatRequest={sample}
        targetStatus={VatRequestStatus.COMPLETED}
        onClose={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByTestId('vat-transition-invoice'), {
      target: { value: 'HD-001' },
    })
    fireEvent.click(screen.getByTestId('vat-transition-confirm'))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'VAT-1',
          body: expect.objectContaining({
            status: VatRequestStatus.COMPLETED,
            invoiceNumber: 'HD-001',
          }),
        }),
        expect.any(Object),
      )
    })
  })

  it('shows email-not-sent warning for COMPLETED', () => {
    render(
      <StatusTransitionConfirmDialog
        open={true}
        vatRequest={sample}
        targetStatus={VatRequestStatus.COMPLETED}
        onClose={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    expect(screen.getByTestId('vat-transition-email-notice')).toBeInTheDocument()
  })

  it('renders PENDING target dialog without invoice or note inputs', () => {
    mutate.mockReset()
    render(
      <StatusTransitionConfirmDialog
        open={true}
        vatRequest={sample}
        targetStatus={VatRequestStatus.PENDING}
        onClose={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    // No required fields for PENDING rollback
    expect(screen.queryByTestId('vat-transition-invoice')).not.toBeInTheDocument()
    expect(screen.queryByTestId('vat-transition-note')).not.toBeInTheDocument()
    // Confirm button present
    expect(screen.getByTestId('vat-transition-confirm')).toBeInTheDocument()
  })

  it('submits valid PENDING payload without required fields', async () => {
    mutate.mockReset()
    mutate.mockImplementation((_, callbacks) => {
      callbacks?.onSuccess?.({
        statusCode: 200,
        message: '',
        result: { slug: 'VAT-1', status: VatRequestStatus.PENDING },
      })
    })
    render(
      <StatusTransitionConfirmDialog
        open={true}
        vatRequest={sample}
        targetStatus={VatRequestStatus.PENDING}
        onClose={vi.fn()}
        onConfirmed={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('vat-transition-confirm'))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'VAT-1',
          body: expect.objectContaining({
            status: VatRequestStatus.PENDING,
          }),
        }),
        expect.any(Object),
      )
    })
  })
})
