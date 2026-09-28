// Demo-only mock for the order-sheet UI preview page. Mirrors the fields the
// preview variants need from IOrder — keep this loose / partial so we don't
// have to fill the entire IOrder shape for a UI sandbox.

export interface DemoOrder {
  slug: string
  status: 'completed' | 'paid' | 'pending'
  createdAt: string
  cashierName: string
  customer: { name: string; phone: string }
  table: string
  type: 'dine-in' | 'takeaway' | 'delivery'
  paymentMethod: 'cash' | 'bank' | 'point' | 'card'
  paymentStatus: 'paid' | 'pending'
  note?: string
  items: Array<{
    slug: string
    name: string
    size: string
    quantity: number
    note?: string
    originalPrice: number
    finalPrice: number
    vatRate?: number
    subtotal: number
  }>
  subtotal: number
  promotionDiscount: number
  voucherDiscount: number
  voucherCode?: string
  total: number
}

export const demoOrder: DemoOrder = {
  slug: '182f23d4cc',
  status: 'paid',
  createdAt: '2026-06-15T08:42:35',
  cashierName: 'Nhân viên TREND',
  customer: { name: 'User Testttt', phone: '0324567894' },
  table: 'Bàn số 60',
  type: 'dine-in',
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  items: [
    {
      slug: 'i1',
      name: 'Cà phê sữa',
      size: 'Tiêu chuẩn',
      quantity: 1,
      originalPrice: 5000,
      finalPrice: 4500,
      vatRate: 0,
      subtotal: 4500,
    },
  ],
  subtotal: 5000,
  promotionDiscount: 0,
  voucherDiscount: 500,
  voucherCode: 'AT-LEAST-PHẦN-TRĂM-CÀ-PHÊ-SỮA',
  total: 4500,
}
