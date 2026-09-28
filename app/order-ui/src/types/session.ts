import type { InvoiceRequest } from './invoice'
import type { IVoucher } from './voucher.type'

export interface OrderItem {
  menuItemId: string
  /**
   * Unique per-pending-row UUID. Assigned by addItem so that multiple rows of
   * the same menuItemId can be distinguished as React keys and as identifiers
   * for updateItem / removeItem. Not persisted to BE (submitted items are
   * keyed by orderItemSlug).
   */
  rowId?: string
  customPriceId?: string // UUID for custom-price entries; differentiates same product at different prices
  orderItemSlug?: string // API order-item slug; set after createOrder / addNewOrderItem
  variantSlug?: string // product variant slug required by the order API
  name: string
  priceNum: number // giá hiển thị sau promotion nếu có (giữ ngữ nghĩa hiện tại)
  price: string
  quantity: number
  note: string
  isCustomPrice?: boolean
  // === Promotion fields (optional; populated when item has a promotion) ===
  productSlug?: string // slug của product (cần cho voucher applicability)
  originalPrice?: number // giá gốc trước promotion (= priceNum nếu không có promotion)
  promotion?: { slug: string; value: number } | null // promotion áp lên item (null = không có)
  /** Per-item VAT rate, mirrored from product.vatRate. Default 0 when unknown. */
  vatRate?: number
}

export interface SubmittedOrder {
  id: string
  items: OrderItem[]
  submittedAt: string
}

export type TableSessionStatus =
  | 'empty'
  | 'serving'
  | 'waiting_payment'
  | 'done'

/**
 * Subset of IUserInfo stored on a TableSession when a customer is linked to
 * the order. Display info + slug for API payload. Full customer record stays
 * in the user store / BE.
 */
export interface TableCustomer {
  slug: string
  firstName: string
  lastName: string
  phonenumber: string
}

export interface TableSession {
  tableId: string
  tableName: string
  status: TableSessionStatus
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  openedAt: string
  orderSlug?: string // slug of the real API order created on first submit
  invoiceRequest?: InvoiceRequest
  /**
   * Free-text note for the whole order (vd: "khách dị ứng tôm"). Set before
   * first submit; included in createOrder payload as `description`.
   */
  description?: string
  /**
   * Customer attached to this table session. Set from the Order panel's
   * "Khách & voucher" Info tab via setOrderCustomer. Payment screen reads
   * this field — it no longer owns the input.
   */
  customer?: TableCustomer
  /**
   * Voucher applied to this table session. Set from the Order panel's
   * "Khách & voucher" Info tab or from the payment screen via setOrderVoucher.
   * useAutoRevalidateAppliedVoucher (wired in OrderSummary / payment screen)
   * clears this when the cart/customer makes it invalid.
   */
  voucher?: IVoucher | null
}
