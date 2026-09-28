import type { OrderItem } from '@/types/session'
import type { ICartItem, IOrderItem } from '@/types'

/**
 * Adapter: chuyển staff session OrderItem[] sang shape ICartItem mà
 * calculateCartItemDisplay / calculateCartTotals chấp nhận. Reuse calc
 * logic của system thay vì duplicate.
 *
 * `as unknown as IOrderItem` cast: IOrderItem ở system rất rộng (chục
 * field — owner, branch, tax, gift, ...), staff không cần đủ. Cast bypass
 * cho phép tạo shape tối thiểu mà calc cần. Tests verify field nào đủ.
 */
export function staffItemsToCartItem(items: OrderItem[]): ICartItem {
  const orderItems: IOrderItem[] = items.map((it) => {
    // For custom-price items the only meaningful price is `priceNum` — the
    // value the user just typed. `originalPrice` was set once at add time and
    // is NOT updated by the edit-price flow (patch only ships priceNum/quantity).
    // Falling back to it here makes calculateCartTotals show stale subtotals
    // after editing the custom price.
    const original = it.isCustomPrice
      ? (it.priceNum ?? it.originalPrice ?? 0)
      : (it.originalPrice ?? it.priceNum)
    const promoValue = it.promotion?.value ?? 0
    // Voucher applicability check (calculateCartItemDisplay → voucher.voucherProducts) compares
    // `vp.product.slug === item.slug`, so item.slug MUST be the product slug. Falling back to
    // menuItemId is a safety net for legacy session items; Task A2 will populate productSlug
    // when adding from menu so this fallback only kicks in for pre-A2 cached sessions.
    return {
      slug: it.productSlug ?? it.menuItemId,
      productSlug: it.productSlug ?? it.menuItemId,
      name: it.name,
      quantity: it.quantity,
      originalPrice: original,
      promotionValue: promoValue,
      promotion: it.promotion ? { slug: it.promotion.slug, value: it.promotion.value } : null,
      note: it.note ?? '',
      variant: { slug: it.variantSlug ?? '', price: original },
    } as unknown as IOrderItem
  })
  return {
    orderItems,
  } as unknown as ICartItem
}
