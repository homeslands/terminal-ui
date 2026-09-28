import { useMemo } from 'react'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import type { IVoucher } from '@/types'
import type { OrderItem, SubmittedOrder } from '@/types/session'

export interface PendingSubmittedTotals {
  pendingDisplay: ReturnType<typeof calculateCartItemDisplay>
  pendingTotals: ReturnType<typeof calculateCartTotals>
  submittedTotal: number
  grandTotal: number
}

/**
 * Compute totals for pending + already-submitted orders.
 *
 * - pending: promotion-aware + voucher-aware (sessionVoucher is passed in
 *   so the voucher discount reflects in the user-visible "Tổng tiền hàng".
 * - submitted: NOT voucher-aware — voucher is applied at the BE payment step.
 *   Passing voucher here would double-discount.
 * - grandTotal: simple sum used by the action-button gate.
 */
export function usePendingSubmittedTotals(
  pending: OrderItem[],
  submittedOrders: SubmittedOrder[],
  sessionVoucher: IVoucher | null,
): PendingSubmittedTotals {
  const pendingDisplay = useMemo(
    () =>
      calculateCartItemDisplay(staffItemsToCartItem(pending), sessionVoucher),
    [pending, sessionVoucher],
  )
  const pendingTotals = useMemo(
    () => calculateCartTotals(pendingDisplay, sessionVoucher),
    [pendingDisplay, sessionVoucher],
  )
  const submittedTotal = useMemo(
    () =>
      submittedOrders.reduce((s, o) => {
        const display = calculateCartItemDisplay(
          staffItemsToCartItem(o.items),
          null,
        )
        return s + calculateCartTotals(display, null).finalTotal
      }, 0),
    [submittedOrders],
  )
  const grandTotal = pendingTotals.finalTotal + submittedTotal

  return { pendingDisplay, pendingTotals, submittedTotal, grandTotal }
}
