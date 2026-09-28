import type { TableSession } from '@/types/session'
import type { InvoiceData, InvoiceRequest, SellerInfo } from '@/types/invoice'
import { mergeOrderItems } from '@/lib/staff-orders'
import { STORAGE_KEYS } from '@/data/staff-data'

const UNITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function readTriple(n: number, isLeading: boolean): string {
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const units = n % 10
  const parts: string[] = []

  if (hundreds > 0) {
    parts.push(`${UNITS[hundreds]} trăm`)
  } else if (!isLeading && (tens > 0 || units > 0)) {
    parts.push('không trăm')
  }

  if (tens === 0 && units > 0) {
    if (hundreds > 0 || !isLeading) parts.push('linh')
    parts.push(UNITS[units])
  } else if (tens === 1) {
    parts.push('mười')
    if (units === 5) parts.push('lăm')
    else if (units > 0) parts.push(UNITS[units])
  } else if (tens > 1) {
    parts.push(`${UNITS[tens]} mươi`)
    if (units === 1) parts.push('mốt')
    else if (units === 5) parts.push('lăm')
    else if (units > 0) parts.push(UNITS[units])
  }

  return parts.join(' ').trim()
}

const SCALES = ['', 'nghìn', 'triệu', 'tỷ']

export function numberToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Không đồng'
  const n = Math.floor(amount)
  if (n === 0) return 'Không đồng'

  const groups: number[] = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }

  const segments: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    if (g === 0) continue
    const isLeading = segments.length === 0
    const triple = readTriple(g, isLeading)
    const scale = SCALES[i]
    segments.push(scale ? `${triple} ${scale}` : triple)
  }

  const text = segments.join(' ').replace(/\s+/g, ' ').trim() + ' đồng'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const INVOICE_SYMBOL = 'AA/25E'

function nextInvoiceNumber(): string {
  const raw = window.localStorage.getItem(STORAGE_KEYS.invoiceCounter)
  const current = raw ? Number.parseInt(raw, 10) : 0
  const next = Number.isFinite(current) ? current + 1 : 1
  window.localStorage.setItem(STORAGE_KEYS.invoiceCounter, String(next))
  return String(next).padStart(7, '0')
}

export function buildInvoice(
  session: TableSession,
  request: InvoiceRequest,
  seller: SellerInfo,
  vatRate: number,
): InvoiceData {
  const merged = mergeOrderItems(session.submittedOrders)
  const items = merged.map((m) => {
    const unitPrice = Math.round(m.priceNum / (1 + vatRate))
    return {
      name: m.name,
      unit: 'phần',
      quantity: m.quantity,
      unitPrice,
      amount: unitPrice * m.quantity,
    }
  })

  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const vatAmount = Math.round(subtotal * vatRate)
  const total = subtotal + vatAmount

  return {
    number: nextInvoiceNumber(),
    symbol: INVOICE_SYMBOL,
    issuedAt: new Date().toISOString(),
    seller,
    buyer: request,
    items,
    subtotal,
    vatRate,
    vatAmount,
    total,
    totalInWords: numberToWords(total),
  }
}
