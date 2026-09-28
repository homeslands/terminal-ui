import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants/voucher'
import type { IVoucher } from '@/types'

export interface VoucherSummary {
  typeLabel: string
  valueLabel: string
  applicabilityLabel: string
  productCount?: number
}

export function getVoucherSummary(
  voucher: IVoucher | null | undefined,
): VoucherSummary | null {
  if (!voucher) return null

  const formatVnd = (n: number) =>
    `${new Intl.NumberFormat('vi-VN').format(n)}đ`

  let typeLabel: string
  let valueLabel: string

  switch (voucher.type) {
    case VOUCHER_TYPE.PERCENT_ORDER:
      typeLabel = 'Giảm phần trăm'
      valueLabel = `-${voucher.value}%`
      break
    case VOUCHER_TYPE.FIXED_VALUE:
      typeLabel = 'Giảm tiền cố định'
      valueLabel = `-${formatVnd(voucher.value)}`
      break
    case VOUCHER_TYPE.SAME_PRICE_PRODUCT:
      typeLabel = 'Đồng giá'
      valueLabel = formatVnd(voucher.value)
      break
    default:
      typeLabel = 'Voucher'
      valueLabel = `${voucher.value}`
  }

  const isAtLeastOne =
    voucher.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED
  const applicabilityLabel = isAtLeastOne
    ? 'Áp trên từng món được chọn'
    : 'Áp trên tổng đơn'

  const productCount = voucher.voucherProducts?.length

  return {
    typeLabel,
    valueLabel,
    applicabilityLabel,
    productCount,
  }
}
