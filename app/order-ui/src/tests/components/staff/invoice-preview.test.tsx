import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InvoicePreview } from '@/components/staff/invoice-preview'
import type { InvoiceData } from '@/types/invoice'

const invoice: InvoiceData = {
  number: '0000123',
  symbol: 'AA/25E',
  issuedAt: '2026-06-01T10:00:00Z',
  seller: {
    name: 'THE TERMINAL',
    address: '123 Lê Lợi',
    taxCode: '0312345678',
    phone: '0901234567',
  },
  buyer: {
    buyerName: 'Nguyễn Văn A',
    buyerTaxCode: '0301122334',
    buyerAddress: '456 Nguyễn Huệ',
    buyerEmail: 'a@example.com',
    paymentMethod: 'cash',
  },
  items: [
    { name: 'Cà phê đen', unit: 'phần', quantity: 2, unitPrice: 22_727, amount: 45_454 },
    { name: 'Trà đào', unit: 'phần', quantity: 1, unitPrice: 40_909, amount: 40_909 },
  ],
  subtotal: 86_363,
  vatRate: 0.1,
  vatAmount: 8_636,
  total: 94_999,
  totalInWords: 'Chín mươi bốn nghìn chín trăm chín mươi chín đồng',
}

describe('InvoicePreview', () => {
  it('renders the invoice number and symbol in the header area', () => {
    render(<InvoicePreview invoice={invoice} />)
    expect(screen.getByText(/0000123/)).toBeInTheDocument()
    expect(screen.getByText(/AA\/25E/)).toBeInTheDocument()
  })

  it('renders seller and buyer blocks', () => {
    render(<InvoicePreview invoice={invoice} />)
    expect(screen.getByText('THE TERMINAL')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText(/0312345678/)).toBeInTheDocument()
    expect(screen.getByText(/0301122334/)).toBeInTheDocument()
  })

  it('renders all line items', () => {
    render(<InvoicePreview invoice={invoice} />)
    expect(screen.getByText('Cà phê đen')).toBeInTheDocument()
    expect(screen.getByText('Trà đào')).toBeInTheDocument()
  })

  it('renders totals and the words representation', () => {
    render(<InvoicePreview invoice={invoice} />)
    expect(screen.getByTestId('invoice-subtotal')).toHaveTextContent('86.363')
    expect(screen.getByTestId('invoice-vat')).toHaveTextContent('8.636')
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('94.999')
    expect(screen.getByText(invoice.totalInWords)).toBeInTheDocument()
  })

  it('shows BẢN MẪU watermark that is hidden when printing', () => {
    render(<InvoicePreview invoice={invoice} />)
    const wm = screen.getByTestId('watermark')
    expect(wm).toHaveTextContent('BẢN MẪU')
    expect(wm.className).toMatch(/print:hidden/)
  })
})
