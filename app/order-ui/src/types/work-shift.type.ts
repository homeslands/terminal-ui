import type { IBranch } from './branch.type'

export enum WorkShiftStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

/** Tham chiếu ca gắn trên order/invoice. */
export interface IOrderWorkShiftRef {
  slug: string
  status: WorkShiftStatus
}

export interface IWorkShiftUserSummary {
  slug: string
  firstName: string
  lastName: string
  phonenumber: string
}

/** WorkShiftBasicDto — spec §Phụ lục. */
export interface IWorkShiftBasic {
  slug: string
  cashier: IWorkShiftUserSummary
  branch: Pick<IBranch, 'slug' | 'name'>
  actualStartTime: string
  actualEndTime: string | null
  status: WorkShiftStatus
  openingCash: number
  closingCash: number | null
  note: string | null
  createdAt: string
}

/** WorkShiftResponseDto — Basic + số liệu tổng hợp. */
export interface IWorkShift extends IWorkShiftBasic {
  totalOrders: number
  totalInvoicesPaid: number
  totalRevenue: number
  /** Chỉ có giá trị > 0 ngay tại response mở ca. */
  preShiftOrdersLinked: number
}

export interface IWorkShiftPaymentSummaryItem {
  paymentMethod: string
  displayName: string
  totalAmount: number
  invoiceCount: number
}

export interface IWorkShiftStaffSummaryItem {
  staff: IWorkShiftUserSummary
  totalOrdersCreated: number
  totalOrdersRevenue: number
}

/** WorkShiftSummaryResponseDto — trả về bởi close / force-close / summary. */
export interface IWorkShiftSummary {
  workShift: IWorkShiftBasic
  openingCash: number
  closingCash: number | null
  cashRevenue: number
  /** null khi ca còn ACTIVE (chưa có closingCash). */
  cashDifference: number | null
  paymentSummary: IWorkShiftPaymentSummaryItem[]
  totalRevenue: number
  totalOrders: number
  totalInvoicesPaid: number
  crossShiftOrdersCount: number
  staffSummary: IWorkShiftStaffSummaryItem[]
  totalStaffWorked: number
}

export interface IWorkShiftInvoice {
  slug: string
  referenceNumber: number
  paymentMethod: string
  amount: number
  status: string
  /** BE trả tên thu ngân dạng chuỗi, không phải object. */
  cashier: string
  createdAt: string
  // ----- các field mở rộng cho sheet chi tiết hoá đơn -----
  loss?: number
  voucherValue?: number
  logo?: string | null
  qrcode?: string | null
  tableName?: string | null
  branchAddress?: string | null
  customer?: string | null
  voucherType?: string | null
  valueEachVoucher?: number | null
  voucherRule?: string | null
  voucherCode?: string | null
  accumulatedPointsToUse?: number
  deliveryTo?: string | null
  deliveryPhone?: string | null
  type?: string | null
  deliveryDistance?: string | null
  deliveryFee?: number
  totalVatValue?: number
}

export interface IOpenWorkShiftRequest {
  openingCash: number
}

export interface ICloseWorkShiftRequest {
  closingCash?: number
  note?: string
}

export interface IForceCloseWorkShiftRequest {
  note: string
}

export interface IWorkShiftListQuery {
  page?: number
  size?: number
  cashierSlug?: string
  branchSlug?: string
  startDate?: string
  endDate?: string
  status?: WorkShiftStatus
}

/**
 * BE work-shift phân trang theo shape { data, total, page, size }.
 * KHÔNG dùng IPaginationResponse (shape { items, pageSize, ... }).
 */
export interface IWorkShiftPage<T> {
  data: T[]
  total: number
  page: number
  size: number
}
