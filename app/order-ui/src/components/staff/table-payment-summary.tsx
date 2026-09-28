import { ChevronLeft, Info, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OrderItemPrice } from '@/components/app/order-item-price'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { formatVnd } from '@/data/staff-data'
import { getItemPriceDisplay } from '@/lib/order-item-display'
import type { MergedItem } from '@/lib/staff-orders'
import type { IOrder, IVoucher } from '@/types'
import type { TableSession } from '@/types/session'

export interface TablePaymentSummaryProps {
  // Layout
  hideHeader: boolean
  onBack?: () => void
  session: TableSession
  orderData: IOrder | undefined

  // Items + voucher
  merged: MergedItem[]
  selectedVoucher: IVoucher | null

  // Price breakdown
  subTotalBeforeDiscount: number
  promotionDiscount: number
  voucherDiscount: number
  preVatTotal: number
  totalVatAmount: number
  totalWithDiscount: number

  // Action
  onCancel: () => void
}

export function TablePaymentSummary({
  hideHeader,
  onBack,
  session,
  orderData,
  merged,
  selectedVoucher,
  subTotalBeforeDiscount,
  promotionDiscount,
  voucherDiscount,
  preVatTotal,
  totalVatAmount,
  totalWithDiscount,
  onCancel,
}: TablePaymentSummaryProps) {
  const { t: tMenu } = useTranslation('menu')

  // VAT rate label — show "(X%)" only when all items share the same rate.
  const items = orderData?.orderItems ?? []
  const vatRates = items
    .map((it) => it.vatRate ?? it.variant?.product?.vatRate ?? 0)
    .filter((r) => r > 0)
  const uniqueRates = [...new Set(vatRates)]
  const vatRateLabel =
    uniqueRates.length === 1 ? `VAT (${uniqueRates[0]}%)` : 'VAT'

  // P2: detect "promotion dropped by voucher" → show 0đ row with tooltip
  const hasItemsWithPromotion = items.some(
    (it) => (it.promotion?.value ?? 0) > 0,
  )
  const voucher = orderData?.voucher
  const voucherDropsPromotion =
    !!voucher &&
    (voucher.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED ||
      voucher.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT)
  const isPromoDroppedByVoucher =
    hasItemsWithPromotion && voucherDropsPromotion && promotionDiscount === 0

  const showPromotionRow = promotionDiscount > 0 || isPromoDroppedByVoucher

  return (
    <div className="flex min-h-0 flex-col px-2">
      {hideHeader && onBack && (
        <div className="flex items-center justify-between pb-1 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 h-7 text-pos-muted hover:bg-transparent hover:text-pos-text"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {tMenu('order.backToOrdering')}
          </Button>
          <div className="flex items-center gap-2">
            <span className="rounded bg-pos-gold px-2 py-0.5 text-sm font-bold text-white">
              Bàn {session.tableName}
            </span>
            {orderData?.referenceNumber != null && (
              <span className="rounded bg-pos-elevated px-2 py-0.5 text-xs font-semibold text-pos-gold">
                #{orderData.referenceNumber}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Items list — NO header (UX-1 + UX-3) */}
      <ul className="flex-1 space-y-2 overflow-y-auto py-3 pr-2">
        {merged.map((m) => {
          const original = m.isCustomPrice
            ? m.priceNum
            : (m.originalPrice ?? m.priceNum)
          const hasPromotion = !!m.promotion && (m.promotion.value ?? 0) > 0
          const display = getItemPriceDisplay(
            {
              unitPrice: original,
              quantity: m.quantity,
              productSlug: m.menuItemId,
              promotionValue: m.promotion?.value,
              isCustomPrice: m.isCustomPrice,
              customPrice: m.isCustomPrice ? m.priceNum : null,
            },
            selectedVoucher,
          )
          return (
            <li key={`${m.menuItemId}::${m.note}`} className="py-2">
              <div className="flex items-baseline gap-3 text-base">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-pos-text">
                    {m.name}
                  </span>
                  {hasPromotion && (
                    <span className="text-xs italic text-pink-600">
                      Khuyến mãi -{m.promotion!.value}%
                    </span>
                  )}
                </div>
                <span className="w-14 shrink-0 text-center text-lg font-bold text-pos-text">
                  ×{m.quantity}
                </span>
                <OrderItemPrice
                  originalPrice={display.originalPrice}
                  finalPrice={display.finalPrice}
                  showStrikethrough={display.showStrikethrough}
                  promoLabel={display.promoLabel}
                  voucherLabel={display.voucherLabel}
                  className="w-28"
                />
              </div>
              {m.note && (
                <p className="mt-1 text-sm italic text-pos-dim">{m.note}</p>
              )}
            </li>
          )
        })}
      </ul>

      {/* Total + actions — UX-1 + UX-2 + UX-3 + UX-4 */}
      <div className="space-y-1 border-t border-pos-border py-3 pr-2">
        {/* Subtotal */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-pos-muted">
            {tMenu('order.subTotal')}
          </span>
          <span className="text-sm tabular-nums text-pos-text">
            {formatVnd(subTotalBeforeDiscount)}
          </span>
        </div>

        {/* Promotion discount — show 0đ row when voucher overrides it */}
        {showPromotionRow && (
          <div className="flex items-baseline justify-between">
            <span
              className={`inline-flex items-center gap-1 text-sm ${
                isPromoDroppedByVoucher ? 'text-pos-muted' : 'text-emerald-600'
              }`}
            >
              {tMenu('order.promotionDiscount')}
              {isPromoDroppedByVoucher && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      Khuyến mãi không áp dụng khi món đang dùng voucher
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
            <span
              className={`text-sm font-medium tabular-nums ${
                isPromoDroppedByVoucher ? 'text-pos-muted' : 'text-emerald-600'
              }`}
            >
              -{formatVnd(promotionDiscount)}
            </span>
          </div>
        )}

        {/* Voucher discount */}
        {voucherDiscount > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-emerald-600">
              {tMenu('order.voucherDiscount')}
            </span>
            <span className="text-sm font-medium tabular-nums text-emerald-600">
              -{formatVnd(voucherDiscount)}
            </span>
          </div>
        )}

        {/* P1: Tạm tính sau giảm (pre-VAT) */}
        <div className="flex items-baseline justify-between border-t border-pos-border pt-1">
          <span className="text-sm font-semibold text-pos-text">
            Tạm tính sau giảm
          </span>
          <span className="text-sm font-semibold tabular-nums text-pos-text">
            {formatVnd(preVatTotal)}
          </span>
        </div>

        {/* P1: VAT (explicit row, replaces "Trong đó VAT") */}
        {totalVatAmount > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm italic text-pos-muted">{vatRateLabel}</span>
            <span className="text-sm italic tabular-nums text-pos-muted">
              +{formatVnd(totalVatAmount)}
            </span>
          </div>
        )}

        {/* Grand total */}
        <div className="flex items-baseline justify-between border-t border-pos-border pt-1">
          <span className="text-sm font-semibold text-pos-text">Tổng tiền</span>
          <span className="text-3xl font-bold tabular-nums text-pos-gold">
            {formatVnd(totalWithDiscount)}
          </span>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="Huỷ đơn"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Huỷ đơn
          </Button>
        </div>
      </div>
    </div>
  )
}
