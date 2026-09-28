import { useMemo } from 'react'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import type { OrderItem } from '@/types/session'

interface VoucherItemInput {
  menuItemId: string
  productSlug?: string
  quantity: number
}

export interface VoucherDerived {
  allVoucherItems: VoucherItemInput[]
  voucherCart: ReturnType<typeof staffItemsToCartItem>
  voucherDisplay: ReturnType<typeof calculateCartItemDisplay>
  voucherSubtotal: ReturnType<typeof calculateCartTotals>
}

/**
 * Derive the voucher-validation-friendly item list + cart + display + totals.
 *
 * Inputs are the "all current items" array (allItems = submitted + pending)
 * and the "pending" array on its own. Both are mapped down to a narrow
 * {menuItemId, productSlug, quantity} shape and concatenated — this matches
 * the pre-refactor `allVoucherItems` semantic (pending counted twice
 * intentionally: once via allItems, once via pending — see admin-cart history).
 *
 * The returned `voucherSubtotal` is voucher-less (passed null) and is used
 * downstream as the `subtotalAfterPromotion` input to `useVoucherState`.
 */
export function useVoucherDerivedItems(
  allItems: OrderItem[],
  pending: OrderItem[],
): VoucherDerived {
  const voucherItems = useMemo<VoucherItemInput[]>(
    () =>
      allItems.map((i) => ({
        menuItemId: i.menuItemId,
        productSlug: i.productSlug,
        quantity: i.quantity,
      })),
    [allItems],
  )
  const pendingForVoucher = useMemo<VoucherItemInput[]>(
    () =>
      pending.map((i) => ({
        menuItemId: i.menuItemId,
        productSlug: i.productSlug,
        quantity: i.quantity,
      })),
    [pending],
  )
  const allVoucherItems = useMemo(
    () => [...voucherItems, ...pendingForVoucher],
    [voucherItems, pendingForVoucher],
  )
  const voucherCart = useMemo(
    () => staffItemsToCartItem(allVoucherItems as unknown as OrderItem[]),
    [allVoucherItems],
  )
  const voucherDisplay = useMemo(
    () => calculateCartItemDisplay(voucherCart, null),
    [voucherCart],
  )
  const voucherSubtotal = useMemo(
    () => calculateCartTotals(voucherDisplay, null),
    [voucherDisplay],
  )

  return { allVoucherItems, voucherCart, voucherDisplay, voucherSubtotal }
}
