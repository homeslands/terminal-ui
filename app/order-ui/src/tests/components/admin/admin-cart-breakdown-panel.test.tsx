import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminCartBreakdownPanel } from '@/app/system/menu/components/admin-cart-breakdown-panel'

const baseBreakdown = {
  tongTienHang: 50000,
  promotionDiscount: 0,
  voucherDiscount: 0,
  preVatTotal: 50000,
  vatAmount: 0,
  total: 50000,
  isPromoDroppedByVoucher: false,
  vatRateLabel: 'VAT (10%)',
  voucherCode: null,
}

describe('AdminCartBreakdownPanel', () => {
  it('renders tongTienHang and total', () => {
    render(<AdminCartBreakdownPanel breakdown={baseBreakdown} />)
    expect(screen.getByText('Tổng tiền hàng')).toBeTruthy()
    expect(screen.getByText('Tổng thanh toán')).toBeTruthy()
  })

  it('shows voucher discount when voucherCode is set', () => {
    render(
      <AdminCartBreakdownPanel
        breakdown={{ ...baseBreakdown, voucherDiscount: 5000, voucherCode: 'V1' }}
      />,
    )
    expect(screen.getByText(/V1/)).toBeTruthy()
  })

  it('hides voucher row when voucherDiscount=0', () => {
    render(<AdminCartBreakdownPanel breakdown={baseBreakdown} />)
    expect(screen.queryByText(/voucher/i)).toBeNull()
  })
})
