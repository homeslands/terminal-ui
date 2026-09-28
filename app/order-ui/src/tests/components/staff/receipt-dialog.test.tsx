import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReceiptDialog } from '@/components/staff/receipt-dialog'
import type { SubmittedOrder } from '@/types/session'

const orders: SubmittedOrder[] = [
  {
    id: 'o1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
    ],
  },
]

describe('ReceiptDialog', () => {
  const originalOpen = window.open
  beforeEach(() => {
    window.open = vi.fn() as unknown as typeof window.open
  })
  afterEach(() => {
    window.open = originalOpen
  })

  it('renders embedded ReceiptPreview content', () => {
    render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Cà phê đen')).toBeInTheDocument()
  })

  it('print button opens a popup with the correct staff receipt url', () => {
    render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft={true}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /IN/ }))
    expect(window.open).toHaveBeenCalledWith('/staff/table/t1/receipt?draft=true', '_blank')
  })

  it('print uses draft=false when isDraft prop is false', () => {
    render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft={false}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /IN/ }))
    expect(window.open).toHaveBeenCalledWith('/staff/table/t1/receipt?draft=false', '_blank')
  })

  it('shows HOÀN TẤT only when onDone is provided', () => {
    const { rerender } = render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft
        onClose={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /HOÀN TẤT/ })).not.toBeInTheDocument()

    const onDone = vi.fn()
    rerender(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft={false}
        onClose={() => {}}
        onDone={onDone}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HOÀN TẤT/ }))
    expect(onDone).toHaveBeenCalled()
  })

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn()
    render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByTestId('receipt-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
