import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import type { IOrder, IVoucher } from '@/types'

export interface PendingFallback {
  subTotalBeforeDiscount: number
  promotionDiscount: number
  finalTotal: number
}

export interface OrderBreakdown {
  tongTienHang: number
  promotionDiscount: number
  voucherDiscount: number
  preVatTotal: number
  vatAmount: number
  total: number
  isPromoDroppedByVoucher: boolean
  vatRateLabel: string
  voucherCode: string | null
}

/**
 * 6-line breakdown shown in the admin "Sửa đơn" totals panel.
 *
 * Uses BE-authoritative subtotal when serverActiveOrder is loaded and BE state
 * is aligned with sessionVoucher. Otherwise computes FE expected total to
 * eliminate the ~500ms lag/jump that occurs while BE refetches after an
 * apply/remove/auto-remove of voucher.
 *
 * Stale-detection signals:
 *  - Slug mismatch (sessionVoucher.slug !== serverActiveOrder.voucher.slug):
 *    user just applied/removed; BE subtotal is stale.
 *  - Both null but BE subtotal differs >1đ from expectedTotalNoVoucher:
 *    auto-remove case where onMutate patched voucher field but subtotal
 *    has not refetched yet.
 *
 * For the apply case (sessionVoucher set, slug mismatch), we still trust BE
 * because computing FE voucher math for arbitrary voucher types is risky.
 * The brief flash before BE catches up is acceptable.
 */
export function computeOrderBreakdown(
  serverActiveOrder: IOrder | null | undefined,
  sessionVoucher: IVoucher | null,
  pendingFallback: PendingFallback,
): OrderBreakdown {
  const beItems = serverActiveOrder?.orderItems ?? []
  const beVoucher = serverActiveOrder?.voucher ?? null

  // Custom-price items are sold at staff-entered customPrice, NOT at the
  // underlying variant.price (which is just the placeholder SKU). They are
  // also exempt from promotion + VAT + voucher per getItemPriceDisplay rules.
  // Without these branches, tongTienHang + expectedTotalNoVoucher would show
  // the placeholder variant.price (e.g. 0đ/12đ) instead of the real
  // customPrice (e.g. 1200đ/5000đ), making the breakdown panel inconsistent
  // with the per-item display in CustomPriceCard.
  //
  // Detection covers THREE signals because the flag location varies by source:
  //  - `it.isCustomPrice`: FE local session items
  //  - `it.variant.product.isCustomPrice`: BE response (config on product)
  //  - `it.customPrice` truthy: BE response (the actual entered price)
  // Matches `hasCustomPriceItems` detection used in payment-page.tsx + client.
  const isCustomPriceItem = (it: (typeof beItems)[number]) => {
    const itemFlag = !!(it as { isCustomPrice?: boolean }).isCustomPrice
    const productFlag = !!it.variant?.product?.isCustomPrice
    const cp = (it as { customPrice?: number | null }).customPrice
    const hasCustomPriceValue = cp != null && cp > 0
    return itemFlag || productFlag || hasCustomPriceValue
  }
  const itemUnitPrice = (it: (typeof beItems)[number]) => {
    if (isCustomPriceItem(it)) {
      const cp = (it as { customPrice?: number | null }).customPrice
      // Fallback to per-item subtotal when customPrice missing (defensive).
      if (cp != null && cp > 0) return cp
      const sub = (it as { subtotal?: number }).subtotal
      if (sub != null && sub > 0) return sub / Math.max(1, it.quantity)
      return 0
    }
    return it.variant?.price ?? 0
  }

  if (beItems.length > 0) {
    const tongTienHang = beItems.reduce(
      (s, it) => s + itemUnitPrice(it) * it.quantity,
      0,
    )
    const beVatAmount = beItems.reduce(
      (s, it) => s + ((it as { vatValue?: number }).vatValue ?? 0),
      0,
    )

    const voucherAllowedSlugs =
      beVoucher?.voucherProducts?.map((vp) => vp.product?.slug) ?? []
    const voucherDropsPromotion =
      beVoucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT ||
      beVoucher?.applicabilityRule ===
        APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED

    const promotionDiscount = beItems.reduce((sum, it) => {
      if (isCustomPriceItem(it)) return sum
      const applied =
        (it as { isAppliedPromotion?: boolean }).isAppliedPromotion ??
        !!it.promotion
      if (!applied || !it.promotion) return sum
      if (voucherDropsPromotion) {
        const productSlug = it.variant?.product?.slug
        if (productSlug && voucherAllowedSlugs.includes(productSlug)) {
          return sum
        }
      }
      const unitDiscount =
        ((it.variant?.price ?? 0) * (it.promotion.value ?? 0)) / 100
      return sum + Math.round(unitDiscount * it.quantity)
    }, 0)

    const expectedTotalNoVoucher = beItems.reduce((sum, it) => {
      const quantity = it.quantity ?? 0
      // Custom-price items: no promo, no VAT — just customPrice × qty.
      if (isCustomPriceItem(it)) {
        return sum + itemUnitPrice(it) * quantity
      }
      const originalPrice = it.variant?.price ?? 0
      const vatRate =
        (it as { vatRate?: number }).vatRate ??
        it.variant?.product?.vatRate ??
        0
      const itemOriginal = originalPrice * quantity
      const applied =
        (it as { isAppliedPromotion?: boolean }).isAppliedPromotion ??
        !!it.promotion
      let itemPromo = 0
      if (applied && it.promotion) {
        itemPromo = Math.round(
          (originalPrice * (it.promotion.value ?? 0) * quantity) / 100,
        )
      }
      const preVAT = itemOriginal - itemPromo
      const vatVal = Math.round((preVAT * vatRate) / 100)
      return sum + preVAT + vatVal
    }, 0)

    const hasCustomItems = beItems.some(isCustomPriceItem)

    let beTotal = 0
    let beTotalFromSubtotal = false
    if (
      typeof serverActiveOrder?.subtotal === 'number' &&
      serverActiveOrder.subtotal > 0
    ) {
      beTotal = serverActiveOrder.subtotal
      beTotalFromSubtotal = true
    } else if (
      typeof serverActiveOrder?.originalSubtotal === 'number' &&
      serverActiveOrder.originalSubtotal > 0
    ) {
      beTotal = serverActiveOrder.originalSubtotal
    }

    const localSlug = sessionVoucher?.slug ?? null
    const beSlug = beVoucher?.slug ?? null
    const slugMismatch = localSlug !== beSlug
    const beStaleOnNoVoucher =
      !slugMismatch &&
      localSlug === null &&
      beTotalFromSubtotal &&
      beTotal > 0 &&
      Math.abs(beTotal - expectedTotalNoVoucher) > 1

    let total = beTotal
    let vatAmount = beVatAmount
    // Use FE math when:
    //  - voucher slug mismatch (apply/remove in flight; BE subtotal stale)
    //  - voucher removed but BE subtotal still has discount baked in
    //  - custom-price items present (BE subtotal/originalSubtotal use placeholder
    //    variant.price, not the staff-entered customPrice — FE has the right value)
    if (
      sessionVoucher === null &&
      (slugMismatch || beStaleOnNoVoucher || hasCustomItems)
    ) {
      total = expectedTotalNoVoucher
      const newPreVAT = tongTienHang - promotionDiscount
      vatAmount = Math.max(0, expectedTotalNoVoucher - newPreVAT)
    }

    const voucherDiscount = beVoucher
      ? Math.max(0, tongTienHang - promotionDiscount + vatAmount - total)
      : 0
    const preVatTotal = Math.max(0, total - vatAmount)

    const hasItemsWithPromotion = beItems.some(
      (it) => (it.promotion?.value ?? 0) > 0,
    )
    const isPromoDroppedByVoucher =
      hasItemsWithPromotion &&
      voucherDropsPromotion &&
      promotionDiscount === 0

    const vatRates = beItems
      .map(
        (it) =>
          (it as { vatRate?: number }).vatRate ??
          it.variant?.product?.vatRate ??
          0,
      )
      .filter((r) => r > 0)
    const uniqueRates = [...new Set(vatRates)]
    const vatRateLabel =
      uniqueRates.length === 1 ? `VAT (${uniqueRates[0]}%)` : 'VAT'

    return {
      tongTienHang,
      promotionDiscount,
      voucherDiscount,
      preVatTotal,
      vatAmount,
      total,
      isPromoDroppedByVoucher,
      vatRateLabel,
      voucherCode: beVoucher?.code ?? null,
    }
  }

  return {
    tongTienHang: pendingFallback.subTotalBeforeDiscount,
    promotionDiscount: pendingFallback.promotionDiscount,
    voucherDiscount: Math.max(
      0,
      pendingFallback.subTotalBeforeDiscount -
        pendingFallback.promotionDiscount -
        pendingFallback.finalTotal,
    ),
    preVatTotal: pendingFallback.finalTotal,
    vatAmount: 0,
    total: pendingFallback.finalTotal,
    isPromoDroppedByVoucher: false,
    vatRateLabel: 'VAT',
    voucherCode: sessionVoucher?.code ?? null,
  }
}
