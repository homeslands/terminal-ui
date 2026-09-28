import { describe, it, expect } from 'vitest'
import { numberToWords } from '@/lib/staff-invoice'
import { afterEach, beforeEach } from 'vitest'
import { buildInvoice } from '@/lib/staff-invoice'
import type { TableSession } from '@/types/session'
import type { InvoiceRequest, SellerInfo } from '@/types/invoice'

describe('numberToWords', () => {
  it('returns "Không đồng" for zero', () => {
    expect(numberToWords(0)).toBe('Không đồng')
  })

  it('handles single digits 1..9', () => {
    expect(numberToWords(1)).toBe('Một đồng')
    expect(numberToWords(5)).toBe('Năm đồng')
    expect(numberToWords(9)).toBe('Chín đồng')
  })

  it('uses "mười" for 10 and "mười X" for 11..19 (lăm for 15)', () => {
    expect(numberToWords(10)).toBe('Mười đồng')
    expect(numberToWords(11)).toBe('Mười một đồng')
    expect(numberToWords(15)).toBe('Mười lăm đồng')
    expect(numberToWords(19)).toBe('Mười chín đồng')
  })

  it('uses "mốt" for trailing 1 in 21..91 and "lăm" for trailing 5 in 25..95', () => {
    expect(numberToWords(21)).toBe('Hai mươi mốt đồng')
    expect(numberToWords(25)).toBe('Hai mươi lăm đồng')
    expect(numberToWords(31)).toBe('Ba mươi mốt đồng')
    expect(numberToWords(95)).toBe('Chín mươi lăm đồng')
  })

  it('uses "linh" when tens is zero but units is non-zero inside a group', () => {
    expect(numberToWords(101)).toBe('Một trăm linh một đồng')
    expect(numberToWords(105)).toBe('Một trăm linh năm đồng')
  })

  it('handles full hundreds (no linh)', () => {
    expect(numberToWords(100)).toBe('Một trăm đồng')
    expect(numberToWords(200)).toBe('Hai trăm đồng')
  })

  it('handles thousands groupings', () => {
    expect(numberToWords(1_000)).toBe('Một nghìn đồng')
    expect(numberToWords(1_200)).toBe('Một nghìn hai trăm đồng')
    expect(numberToWords(1_205)).toBe('Một nghìn hai trăm linh năm đồng')
    expect(numberToWords(25_000)).toBe('Hai mươi lăm nghìn đồng')
    expect(numberToWords(340_000)).toBe('Ba trăm bốn mươi nghìn đồng')
  })

  it('handles millions', () => {
    expect(numberToWords(1_000_000)).toBe('Một triệu đồng')
    expect(numberToWords(1_200_000)).toBe('Một triệu hai trăm nghìn đồng')
    expect(numberToWords(2_345_000)).toBe('Hai triệu ba trăm bốn mươi lăm nghìn đồng')
  })

  it('handles billions ("tỷ")', () => {
    expect(numberToWords(1_000_000_000)).toBe('Một tỷ đồng')
    expect(numberToWords(1_234_567_890)).toMatch(/^Một tỷ/)
    expect(numberToWords(1_234_567_890)).toMatch(/đồng$/)
  })

  it('capitalizes the very first letter only', () => {
    const out = numberToWords(105)
    expect(out[0]).toBe(out[0].toUpperCase())
  })
})

const seller: SellerInfo = {
  name: 'THE TERMINAL',
  address: '123 Lê Lợi, Q1',
  taxCode: '0312345678',
  phone: '0901234567',
}

const buyer: InvoiceRequest = {
  buyerName: 'Nguyễn Văn A',
  buyerTaxCode: '0301122334',
  buyerAddress: '456 Nguyễn Huệ',
  buyerEmail: 'a@example.com',
  paymentMethod: 'cash',
}

function makeSession(): TableSession {
  return {
    tableId: 'table-01',
    tableName: 'Bàn 01',
    status: 'waiting_payment',
    pendingItems: [],
    openedAt: '2026-06-01T09:00:00Z',
    submittedOrders: [
      {
        id: 'order-1',
        submittedAt: '2026-06-01T09:30:00Z',
        items: [
          { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 33_000, price: '33.000đ', quantity: 2, note: '' },
        ],
      },
      {
        id: 'order-2',
        submittedAt: '2026-06-01T09:45:00Z',
        items: [
          { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 33_000, price: '33.000đ', quantity: 1, note: '' },
          { menuItemId: 'm2', name: 'Trà đào', priceNum: 44_000, price: '44.000đ', quantity: 2, note: '' },
        ],
      },
    ],
  }
}

describe('buildInvoice', () => {
  beforeEach(() => { window.localStorage.clear() })
  afterEach(() => { window.localStorage.clear() })

  it('uses symbol "AA/25E" and zero-padded 7-digit number', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(inv.symbol).toBe('AA/25E')
    expect(inv.number).toMatch(/^\d{7}$/)
  })

  it('auto-increments the invoice counter in localStorage', () => {
    const a = buildInvoice(makeSession(), buyer, seller, 0.1)
    const b = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(Number(b.number)).toBe(Number(a.number) + 1)
    expect(window.localStorage.getItem('terminal_invoice_counter')).toBe(String(Number(b.number)))
  })

  it('merges duplicate menu items across orders', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(inv.items).toHaveLength(2)
    const coffee = inv.items.find((i) => i.name === 'Cà phê đen')
    expect(coffee?.quantity).toBe(3)
  })

  it('reverse-calculates unitPrice from VAT-inclusive priceNum', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    const coffee = inv.items.find((i) => i.name === 'Cà phê đen')!
    expect(coffee.unitPrice).toBe(Math.round(33_000 / 1.1))
    expect(coffee.amount).toBe(coffee.unitPrice * coffee.quantity)
  })

  it('computes subtotal, vatAmount and total consistently', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    const sumAmount = inv.items.reduce((s, i) => s + i.amount, 0)
    expect(inv.subtotal).toBe(sumAmount)
    expect(inv.vatAmount).toBe(Math.round(inv.subtotal * inv.vatRate))
    expect(inv.total).toBe(inv.subtotal + inv.vatAmount)
  })

  it('populates totalInWords using numberToWords on total', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(inv.totalInWords).toMatch(/đồng$/)
    expect(inv.totalInWords[0]).toBe(inv.totalInWords[0].toUpperCase())
  })

  it('copies seller and buyer info into the result', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(inv.seller).toEqual(seller)
    expect(inv.buyer).toEqual(buyer)
  })

  it('sets issuedAt to an ISO datetime string', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(() => new Date(inv.issuedAt).toISOString()).not.toThrow()
  })
})
