import { useMemo } from 'react'
import { Info } from 'lucide-react'

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import type { OrderItem, SubmittedOrder, TableCustomer } from '@/types/session'
import type { IOrder, IVoucher } from '@/types'
import { formatVnd } from '@/data/staff-data'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import { computeOrderBreakdown } from '@/lib/order-breakdown'
import { ConfirmOrderDialog } from './confirm-order-dialog'
import { OrderSummaryTabs } from './order-summary-tabs'
import { useCurrentRole } from '@/hooks/use-current-role'
import { Role } from '@/constants/role'

interface Props {
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  /**
   * Server-authoritative active order for this table. When present, the
   * footer breakdown (subtotal/promo/voucher/VAT/total) renders from BE
   * values to match the bill — preview math (pendingItems) is only used
   * before any submission.
   */
  orderData?: IOrder | null
  onUpdateItem: (
    itemId: string,
    patch: {
      quantity?: number
      note?: string
      priceNum?: number
      price?: string
    },
  ) => void
  onRemoveItem: (menuItemId: string) => void
  onClearAll: () => void
  onSubmitOrder: () => void
  onPay: () => void
  onDraftReceipt: () => void
  onConfirmChanges: (
    changes: {
      orderItemSlug: string
      newQty: number
      newNote?: string
    }[],
  ) => Promise<void>
  onCancelOrder: () => Promise<void>
  isSubmittingOrder?: boolean
  isExportingBill?: boolean
  /**
   * Phase A: order-level note (description). Editable anytime — customer is
   * handled at the payment screen (Phase B).
   */
  description: string
  onDescriptionChange: (value: string) => void
  /** Customer linked to this order (info tab). */
  customer: TableCustomer | null
  /** Voucher applied to this order (info tab). */
  voucher: IVoucher | null
  onCustomerSelect: (customer: TableCustomer) => void
  onCustomerClear: () => void
  onApplyVoucher: (voucher: IVoucher) => void | Promise<void>
  onRemoveVoucher: () => void | Promise<void>
  voucherDisabled?: boolean
}

export function OrderSummary({
  pendingItems,
  submittedOrders,
  orderData,
  onUpdateItem,
  onRemoveItem,
  onSubmitOrder,
  onPay,
  // onDraftReceipt,
  onConfirmChanges,
  onCancelOrder,
  isSubmittingOrder,
  // isExportingBill,
  description,
  onDescriptionChange,
  customer,
  voucher,
  onCustomerSelect,
  onCustomerClear,
  onApplyVoucher,
  onRemoveVoucher,
  voucherDisabled,
}: Props) {
  const role = useCurrentRole()
  const canTakePayment = role !== Role.STAFF
  const submittedReadonly = role === Role.STAFF

  const pendingDisplay = useMemo(() => {
    const cart = staffItemsToCartItem(pendingItems)
    return calculateCartItemDisplay(cart, voucher)
  }, [pendingItems, voucher])

  const pendingTotals = useMemo(
    () => calculateCartTotals(pendingDisplay, voucher),
    [pendingDisplay, voucher],
  )

  const submittedTotal = useMemo(
    () =>
      submittedOrders.reduce((s, o) => {
        const cart = staffItemsToCartItem(o.items)
        const display = calculateCartItemDisplay(cart, voucher)
        return s + calculateCartTotals(display, voucher).finalTotal
      }, 0),
    [submittedOrders, voucher],
  )

  const canSubmit = pendingItems.length > 0
  const hasSubmitted = submittedOrders.length > 0

  // 6-line breakdown — shared with admin-cart-content via computeOrderBreakdown
  // (BE-authoritative when orderData present; FE fallback otherwise). Handles
  // custom-price items, BE-stale voucher detection, and promo-dropped-by-voucher
  // logic in one place to keep both cart panels in sync with the bill.
  const breakdown = useMemo(
    () =>
      computeOrderBreakdown(orderData, voucher, {
        subTotalBeforeDiscount: pendingTotals.subTotalBeforeDiscount,
        promotionDiscount: pendingTotals.promotionDiscount,
        finalTotal: pendingTotals.finalTotal,
      }),
    [orderData, voucher, pendingTotals],
  )

  const showPromotionRow =
    breakdown.promotionDiscount > 0 || breakdown.isPromoDroppedByVoucher
  const showVoucherRow = breakdown.voucherDiscount > 0
  const showVatRow = breakdown.vatAmount > 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-pos-surface text-pos-text">
      <OrderSummaryTabs
        pendingItems={pendingItems}
        submittedOrders={submittedOrders}
        submittedTotal={submittedTotal}
        orderData={orderData}
        onUpdateItem={onUpdateItem}
        onRemoveItem={onRemoveItem}
        description={description}
        onDescriptionChange={onDescriptionChange}
        onConfirmChanges={onConfirmChanges}
        onCancelOrder={onCancelOrder}
        customer={customer}
        voucher={voucher}
        onCustomerSelect={onCustomerSelect}
        onCustomerClear={onCustomerClear}
        onApplyVoucher={onApplyVoucher}
        onRemoveVoucher={onRemoveVoucher}
        voucherDisabled={voucherDisabled}
        submittedReadonly={submittedReadonly}
      />

      {/* Footer — 6-line breakdown matching BE bill */}
      <div className="space-y-1 border-t border-pos-border px-3 pb-2 pt-3">
        {/* 1. Tổng tiền hàng (catalog × qty) */}
        <div className="flex items-baseline justify-between text-xs text-pos-dim">
          <span>Tổng tiền hàng</span>
          <span className="tabular-nums">
            {formatVnd(breakdown.tongTienHang)}
          </span>
        </div>

        {/* 2. Giảm khuyến mãi (with tooltip when dropped by voucher) */}
        {showPromotionRow && (
          <div className="flex items-baseline justify-between text-xs">
            <span
              className={`inline-flex items-center gap-1 ${
                breakdown.isPromoDroppedByVoucher
                  ? 'text-pos-muted'
                  : 'text-emerald-500'
              }`}
            >
              Giảm khuyến mãi
              {breakdown.isPromoDroppedByVoucher && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 cursor-help text-pos-muted" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      Khuyến mãi không áp dụng khi món đang dùng voucher
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
            <span
              className={`tabular-nums ${
                breakdown.isPromoDroppedByVoucher
                  ? 'text-pos-muted'
                  : 'text-emerald-500'
              }`}
            >
              -{formatVnd(breakdown.promotionDiscount)}
            </span>
          </div>
        )}

        {/* 3. Voucher (code) */}
        {showVoucherRow && (
          <div className="flex items-baseline justify-between text-xs text-emerald-500">
            <span className="truncate">
              Mã giảm giá
              {breakdown.voucherCode ? ` (${breakdown.voucherCode})` : ''}
            </span>
            <span className="tabular-nums">
              -{formatVnd(breakdown.voucherDiscount)}
            </span>
          </div>
        )}

        {/* 4. Tạm tính sau giảm (pre-VAT) */}
        <div className="flex items-baseline justify-between border-t border-pos-border pt-1 text-xs text-pos-text">
          <span>Tạm tính sau giảm</span>
          <span className="tabular-nums">
            {formatVnd(breakdown.preVatTotal)}
          </span>
        </div>

        {/* 5. VAT */}
        {showVatRow && (
          <div className="flex items-baseline justify-between text-xs italic text-pos-muted">
            <span>{breakdown.vatRateLabel}</span>
            <span className="tabular-nums">
              +{formatVnd(breakdown.vatAmount)}
            </span>
          </div>
        )}

        {/* 6. Tổng thanh toán */}
        <div className="flex items-baseline justify-between border-t border-pos-border pt-1">
          <span className="text-xs font-bold tracking-widest text-pos-muted">
            TỔNG THANH TOÁN
          </span>
          <span
            data-testid="grand-total"
            className="text-xl font-bold tabular-nums text-pos-gold"
          >
            {formatVnd(breakdown.total)}
          </span>
        </div>
        <div className="mb-3" />

        <span data-testid="pending-total" className="hidden">
          {formatVnd(pendingTotals.finalTotal)}
        </span>
        <span data-testid="submitted-total" className="hidden">
          {formatVnd(submittedTotal)}
        </span>

        <div className={`mt-2 grid grid-cols-1 gap-2`}>
          <ConfirmOrderDialog
            pendingItems={pendingItems}
            pendingTotal={pendingTotals.finalTotal}
            disabled={!canSubmit}
            onConfirm={onSubmitOrder}
            submitting={isSubmittingOrder}
          />
          {canTakePayment && (
            <Button
              disabled={!hasSubmitted || canSubmit}
              onClick={onPay}
              className="w-full bg-pos-gold text-white hover:bg-pos-gold/80"
            >
              THANH TOÁN →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
