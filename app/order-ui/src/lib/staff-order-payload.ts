import type { OrderItem } from '@/types/session'

export interface CreateOrderItemPayload {
  quantity: number
  variant: string
  promotion: string | null
  note: string
  customPrice?: number
}

/**
 * Build the orderItems array for POST /orders from session OrderItems.
 * Filters items missing variantSlug. For custom-price items, drops promotion
 * and attaches customPrice from priceNum when > 0.
 */
export function buildCreateOrderItems(items: OrderItem[]): CreateOrderItemPayload[] {
  return items
    .filter((item) => !!item.variantSlug)
    .map((item) => {
      const isCustom = !!item.isCustomPrice
      const hasCustomPrice = isCustom && (item.priceNum ?? 0) > 0
      return {
        quantity: item.quantity,
        variant: item.variantSlug!,
        promotion: isCustom ? null : (item.promotion?.slug ?? null),
        note: item.note || '',
        ...(hasCustomPrice ? { customPrice: item.priceNum } : {}),
      }
    })
}

export interface AddOrderItemPayload {
  quantity: number
  note?: string
  variant: string
  promotion: string
  order: string
  customPrice?: number
}

/**
 * Build the payload for POST /order-items to add a single item to an existing order.
 * Same custom-price encoding as buildCreateOrderItems (strip promotion, attach
 * customPrice when priceNum > 0). Use quantityOverride for qty-increase branches.
 */
export function buildAddOrderItemPayload(
  item: OrderItem,
  orderSlug: string,
  quantityOverride?: number,
): AddOrderItemPayload {
  const isCustom = !!item.isCustomPrice
  const hasCustomPrice = isCustom && (item.priceNum ?? 0) > 0
  return {
    quantity: quantityOverride ?? item.quantity,
    note: item.note ?? '',
    variant: item.variantSlug!,
    promotion: isCustom ? '' : (item.promotion?.slug ?? ''),
    order: orderSlug,
    ...(hasCustomPrice ? { customPrice: item.priceNum } : {}),
  }
}
