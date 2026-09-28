import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReceiptPreview } from '@/components/staff/receipt-preview'
import type { SubmittedOrder } from '@/types/session'

const orders: SubmittedOrder[] = [
  {
    id: 'o1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
    ],
  },
  {
    id: 'o2',
    submittedAt: '2026-06-01T10:30:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
      { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 1, note: '' },
    ],
  },
]

describe('ReceiptPreview', () => {
  it('renders restaurant header and table label', () => {
    render(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={false} issuedAt="2026-06-01T10:30:00Z" />,
    )
    expect(screen.getByText(/THE TERMINAL/i)).toBeInTheDocument()
    expect(screen.getByText(/Bàn 01/)).toBeInTheDocument()
  })

  it('merges duplicate menu items', () => {
    render(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={false} issuedAt="2026-06-01T10:30:00Z" />,
    )
    expect(screen.getAllByText('Cà phê đen')).toHaveLength(1)
    expect(screen.getByTestId('row-qty-m1')).toHaveTextContent('3')
  })

  it('computes the receipt total over merged items', () => {
    render(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={false} issuedAt="2026-06-01T10:30:00Z" />,
    )
    // 3*25000 + 1*45000 = 120000
    expect(screen.getByTestId('receipt-total')).toHaveTextContent('120.000đ')
  })

  it('shows "BẢN TẠM" watermark only when isDraft is true', () => {
    const { rerender } = render(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={false} issuedAt="2026-06-01T10:30:00Z" />,
    )
    expect(screen.queryByTestId('watermark')).not.toBeInTheDocument()

    rerender(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={true} issuedAt="2026-06-01T10:30:00Z" />,
    )
    expect(screen.getByTestId('watermark')).toHaveTextContent('BẢN TẠM')
    expect(screen.getByTestId('watermark').className).toMatch(/print:hidden/)
  })
})
