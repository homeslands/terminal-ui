export interface IVatLinkResponse {
  url: string
}

export type VatPublicStatus = 'AVAILABLE' | 'SUBMITTED'

export interface IVatPublicStatus {
  invoiceSlug: string
  status: VatPublicStatus
}

export interface IVatSubmitRequest {
  customerName: string
  taxCode: string
  address: string
  email: string
  companyName?: string
  note?: string
}

export enum VatRequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export interface IVatRequest {
  slug: string
  status: VatRequestStatus
  customerName: string
  taxCode: string
  address: string
  email: string
  companyName?: string
  note?: string
  createdAt: string
}

/**
 * Context hoá đơn gốc (nested trong VAT request response). Cần thiết cho
 * kế toán: số đơn để tra ngược, amount + totalVatValue để khớp với hoá đơn
 * thực tế phát hành.
 */
export interface IVatInvoiceContext {
  slug: string
  referenceNumber: number
  amount: number
  totalVatValue: number
  branchAddress?: string
  cashier?: string
  customer?: string
  tableName?: string
  type?: string
  status?: string
  paymentMethod?: string
  date?: string
  createdAt?: string
}

export interface IVatRequestListItem {
  slug: string
  customerName: string
  taxCode: string
  email: string
  address?: string
  companyName?: string
  note?: string
  invoiceNumber?: string | null
  status: VatRequestStatus
  createdAt: string
  updatedAt?: string
  invoiceId?: string
  invoice?: IVatInvoiceContext
}

export interface IVatRequestListParams {
  /** BE chỉ accept 1 status per request (không support multi-status filter). */
  status?: VatRequestStatus
  startDate?: string
  endDate?: string
  customerName?: string
  taxCode?: string
  email?: string
  invoiceNumber?: string
  referenceNumber?: number
  /** Sort fields, vd ["createdAt,desc"]. */
  sort?: string[]
  page: number
  size: number
}

export interface IVatRequestListResponse {
  items: IVatRequestListItem[]
  total: number
  page: number
  size: number
}

export interface IUpdateVatRequestBody {
  customerName?: string
  taxCode?: string
  address?: string
  email?: string
  companyName?: string
  note?: string
}

export interface IUpdateVatStatusBody {
  status: VatRequestStatus
  /** Null khi chưa có (BE từ chối empty string ""). */
  invoiceNumber?: string | null
  /** Null khi không có note. */
  note?: string | null
}
