export interface InvoiceRequest {
  buyerName: string
  buyerTaxCode: string
  buyerAddress: string
  buyerEmail: string
  paymentMethod: 'cash' | 'transfer'
}

export interface SellerInfo {
  name: string
  address: string
  taxCode: string
  phone: string
}

export interface InvoiceLineItem {
  name: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface InvoiceData {
  number: string
  symbol: string
  issuedAt: string
  seller: SellerInfo
  buyer: InvoiceRequest
  items: InvoiceLineItem[]
  subtotal: number
  vatRate: number
  vatAmount: number
  total: number
  totalInWords: string
}
