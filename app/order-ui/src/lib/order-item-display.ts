import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants/voucher'
import type { IVoucher } from '@/types'

export interface ItemPriceInput {
  /** Giá gốc 1 đơn vị */
  unitPrice: number
  /** Số lượng */
  quantity: number
  /** Product slug để check eligibility */
  productSlug?: string | null
  /** Promotion % nếu có */
  promotionValue?: number | null
  /** Custom price 1 đơn vị (nếu có) */
  customPrice?: number | null
  isCustomPrice?: boolean
}

export interface ItemPriceDisplay {
  originalPrice: number // unitPrice × qty
  finalPrice: number // giá thực tế customer trả × qty
  showStrikethrough: boolean
  promoLabel?: string // vd "-20%"
  voucherLabel?: string // vd "Voucher" hoặc "Đồng giá"
}

/**
 * Tính giá hiển thị + quyết định strikethrough.
 *
 * Strikethrough RULE:
 * - Custom-price: KHÔNG bao giờ gạch
 * - Voucher AT_LEAST_ONE_REQUIRED hoặc SAME_PRICE_PRODUCT + item eligible: GẠCH
 * - Voucher ALL_REQUIRED: KHÔNG gạch item (chỉ ảnh hưởng total)
 * - Không voucher: KHÔNG gạch (giá promoted nếu có là giá hiện tại)
 */
export function getItemPriceDisplay(
  item: ItemPriceInput,
  voucher: IVoucher | null | undefined,
): ItemPriceDisplay {
  const {
    unitPrice,
    quantity,
    isCustomPrice,
    customPrice,
    promotionValue,
    productSlug,
  } = item

  // Custom-price: ưu tiên customPrice, không apply promo/voucher
  if (isCustomPrice && customPrice != null && customPrice > 0) {
    return {
      originalPrice: customPrice * quantity,
      finalPrice: customPrice * quantity,
      showStrikethrough: false,
    }
  }

  const originalTotal = unitPrice * quantity

  // Tính giá sau promotion (regular item)
  const hasPromo = !!promotionValue && promotionValue > 0
  const promoUnitPrice = hasPromo
    ? Math.max(0, Math.round(unitPrice * (1 - promotionValue! / 100)))
    : unitPrice
  const priceAfterPromo = promoUnitPrice * quantity
  const promoLabel = hasPromo ? `-${promotionValue}%` : undefined

  // No voucher
  if (!voucher) {
    return {
      originalPrice: originalTotal,
      finalPrice: priceAfterPromo,
      showStrikethrough: false, // promo only → không gạch
      promoLabel,
    }
  }

  const voucherType = voucher.type
  const isAtLeastOne =
    voucher.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED
  const voucherAllowedSlugs = (voucher.voucherProducts ?? [])
    .map((vp) => vp.product?.slug)
    .filter((s): s is string => !!s)
  const itemEligible =
    !!productSlug && voucherAllowedSlugs.includes(productSlug)

  // SAME_PRICE_PRODUCT: item eligible → đặt giá voucher, drop promo
  if (voucherType === VOUCHER_TYPE.SAME_PRICE_PRODUCT && itemEligible) {
    const voucherUnitPrice = Math.min(unitPrice, voucher.value ?? unitPrice)
    return {
      originalPrice: originalTotal,
      finalPrice: voucherUnitPrice * quantity,
      showStrikethrough: true,
      voucherLabel: 'Đồng giá',
    }
  }

  // AT_LEAST_ONE + PERCENT_ORDER, item eligible → giá gốc × (1 - %), drop promo
  if (
    isAtLeastOne &&
    voucherType === VOUCHER_TYPE.PERCENT_ORDER &&
    itemEligible
  ) {
    const voucherUnitPrice = Math.max(
      0,
      Math.round(unitPrice * (1 - (voucher.value ?? 0) / 100)),
    )
    return {
      originalPrice: originalTotal,
      finalPrice: voucherUnitPrice * quantity,
      showStrikethrough: true,
      voucherLabel: `-${voucher.value}%`,
    }
  }

  // AT_LEAST_ONE + FIXED_VALUE, item eligible → giá gốc − fixed (drop promo, match BE)
  if (
    isAtLeastOne &&
    voucherType === VOUCHER_TYPE.FIXED_VALUE &&
    itemEligible
  ) {
    const voucherDeduction = Math.min(voucher.value ?? 0, unitPrice)
    const voucherUnitPrice = Math.max(0, unitPrice - voucherDeduction)
    return {
      originalPrice: originalTotal,
      finalPrice: voucherUnitPrice * quantity,
      showStrikethrough: true,
      voucherLabel: 'Voucher',
    }
  }

  // ALL_REQUIRED hoặc item không eligible → voucher không gạch item
  return {
    originalPrice: originalTotal,
    finalPrice: priceAfterPromo,
    showStrikethrough: false,
    promoLabel,
  }
}
