import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CustomerInfoSection } from '@/components/app/sheet/vat-request-detail-sheet/customer-info-section'
import { VatRequestStatus } from '@/types'

const mutate = vi.fn()
vi.mock('@/hooks/use-vat-admin', () => ({
  useUpdateVatRequest: () => ({ mutate, isPending: false }),
}))

const sample = {
  slug: 'VAT-1',
  invoiceSlug: 'INV-1',
  customerName: 'Co A',
  taxCode: '0123456789',
  email: 'a@x.com',
  address: '123',
  status: VatRequestStatus.PENDING,
  createdAt: '2026-06-26T10:00:00.000Z',
}

describe('CustomerInfoSection', () => {
  it('renders fields as inputs when not locked', () => {
    render(
      <CustomerInfoSection
        vatRequest={sample as never}
        isLocked={false}
        onUpdated={vi.fn()}
      />,
    )
    expect(screen.getByTestId('vat-customer-name')).not.toBeDisabled()
    expect(screen.getByTestId('vat-customer-email')).not.toBeDisabled()
  })

  it('renders read-only when locked', () => {
    render(
      <CustomerInfoSection
        vatRequest={{ ...sample, status: VatRequestStatus.COMPLETED } as never}
        isLocked={true}
        onUpdated={vi.fn()}
      />,
    )
    expect(screen.getByTestId('vat-customer-name')).toBeDisabled()
    expect(screen.queryByTestId('vat-customer-save')).not.toBeInTheDocument()
  })

  it('opens confirm dialog on save → submits dirty fields after confirm', async () => {
    mutate.mockReset()
    render(
      <CustomerInfoSection
        vatRequest={sample as never}
        isLocked={false}
        onUpdated={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByTestId('vat-customer-email'), {
      target: { value: 'new@x.com' },
    })
    fireEvent.click(screen.getByTestId('vat-customer-save'))
    // Confirm dialog opens, mutation NOT yet called.
    const confirmBtn = await screen.findByTestId('vat-confirm-update')
    expect(mutate).not.toHaveBeenCalled()
    // Click confirm → mutation fires with dirty field only.
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'VAT-1',
          body: expect.objectContaining({ email: 'new@x.com' }),
        }),
        expect.any(Object),
      )
    })
  })
})
