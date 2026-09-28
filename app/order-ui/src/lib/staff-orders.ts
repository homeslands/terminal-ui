import type { OrderItem, SubmittedOrder, TableSession } from '@/types/session'
import type { IOrder, IOrderDetail } from '@/types'
import { formatVnd } from '@/data/staff-data'

export function parsePrice(price: string): number {
  const digits = price.replace(/\D+/g, '')
  return digits ? Number.parseInt(digits, 10) : 0
}

export interface MergedItem {
  menuItemId: string
  name: string
  priceNum: number
  price: string
  quantity: number
  note: string
  /**
   * Original price before any promotion was applied (mirrors OrderItem.originalPrice).
   * Used by the payment screen to compute the pre-discount subtotal so the
   * "Tạm tính / Giảm khuyến mãi" breakdown is accurate.
   */
  originalPrice?: number
  isCustomPrice?: boolean
  /**
   * Promotion snapshot (mirrors OrderItem.promotion). Used by payment screen
   * to show a per-item "Khuyến mãi -X%" label.
   */
  promotion?: { slug: string; value: number } | null
}

export function mergeOrderItems(orders: SubmittedOrder[]): MergedItem[] {
  const map = new Map<string, MergedItem>()
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.menuItemId}::${item.note}`
      const existing = map.get(key)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        map.set(key, {
          menuItemId: item.menuItemId,
          name: item.name,
          priceNum: item.priceNum,
          price: item.price,
          quantity: item.quantity,
          note: item.note,
          originalPrice: item.originalPrice,
          promotion: item.promotion,
          isCustomPrice: item.isCustomPrice,
        })
      }
    }
  }
  return Array.from(map.values())
}

export function applySubmittedQuantity(
  orders: SubmittedOrder[],
  menuItemId: string,
  note: string,
  newQty: number,
): SubmittedOrder[] {
  const currentTotal = orders.reduce((sum, o) => {
    const found = o.items.find((i) => i.menuItemId === menuItemId && i.note === note)
    return sum + (found?.quantity ?? 0)
  }, 0)

  if (newQty === currentTotal) return orders

  if (newQty > currentTotal) {
    const toAdd = newQty - currentTotal
    // Add to the most recent order that contains this item
    const lastIdx = [...orders]
      .reverse()
      .findIndex((o) => o.items.some((i) => i.menuItemId === menuItemId && i.note === note))
    if (lastIdx === -1) return orders
    const targetIdx = orders.length - 1 - lastIdx
    return orders.map((o, i) => {
      if (i !== targetIdx) return o
      return {
        ...o,
        items: o.items.map((it) =>
          it.menuItemId === menuItemId && it.note === note
            ? { ...it, quantity: it.quantity + toAdd }
            : it,
        ),
      }
    })
  }

  let toRemove = currentTotal - newQty

  const result = [...orders]
    .reverse()
    .map((o) => {
      if (toRemove <= 0) return o
      const idx = o.items.findIndex((i) => i.menuItemId === menuItemId && i.note === note)
      if (idx === -1) return o

      const take = Math.min(toRemove, o.items[idx].quantity)
      toRemove -= take
      const newQtyForItem = o.items[idx].quantity - take
      const newItems =
        newQtyForItem === 0
          ? o.items.filter((_, i) => i !== idx)
          : o.items.map((it, i) => (i === idx ? { ...it, quantity: newQtyForItem } : it))
      return { ...o, items: newItems }
    })
    .reverse()

  return result.filter((o) => o.items.length > 0)
}

export function collectOrderItemsForKey(
  orders: SubmittedOrder[],
  menuItemId: string,
  note: string,
): Array<{ orderItemSlug: string; variantSlug: string; quantity: number }> {
  return [...orders]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) // newest first
    .flatMap((o) =>
      o.items
        .filter((i) => i.menuItemId === menuItemId && i.note === note && !!i.orderItemSlug)
        .map((i) => ({ orderItemSlug: i.orderItemSlug!, variantSlug: i.variantSlug ?? '', quantity: i.quantity })),
    )
}

type Sessions = Record<string, TableSession>

export function transferSession(
  sessions: Sessions,
  fromTableId: string,
  toTableId: string,
  newTableName: string,
): Sessions {
  const source = sessions[fromTableId]
  if (!source) return sessions
  if (sessions[toTableId]) return sessions // target occupied — no-op
  const next = { ...sessions }
  delete next[fromTableId]
  next[toTableId] = {
    ...source,
    tableId: toTableId,
    tableName: newTableName,
  }
  return next
}

export function mapServerOrderItemToOrderItem(detail: IOrderDetail): OrderItem {
  // BE puts the custom-price flag on `variant.product.isCustomPrice`, NOT on
  // the order item itself. The order item only carries `customPrice` (the
  // numeric value typed by staff). Detect via either signal — primary check
  // is `customPrice > 0` since that's what actually drives pricing.
  const variantProductCustom =
    (detail.variant?.product as { isCustomPrice?: boolean } | undefined)
      ?.isCustomPrice === true
  const hasCustomPriceValue = (detail.customPrice ?? 0) > 0
  const isCustom =
    hasCustomPriceValue || (variantProductCustom && detail.customPrice !== undefined)
  const originalPrice = detail.variant.price
  const promo = detail.promotion
    ? { slug: detail.promotion.slug, value: detail.promotion.value }
    : null
  // Treats promotion.value as percentage (matches /system and A2 behavior).
  // If BE introduces other promotion types, handle here.
  const priceNum = isCustom
    ? (detail.customPrice as number)
    : promo
    ? Math.max(0, Math.round(originalPrice * (1 - promo.value / 100)))
    : originalPrice
  return {
    menuItemId: detail.variant.product.slug,
    productSlug: detail.variant.product.slug,
    variantSlug: detail.variant.slug,
    orderItemSlug: detail.slug,
    name: detail.variant.product.name,
    priceNum,
    price: formatVnd(priceNum),
    originalPrice,
    quantity: detail.quantity,
    note: detail.note ?? '',
    isCustomPrice: isCustom || undefined,
    customPriceId: isCustom ? detail.slug : undefined,
    promotion: promo,
    vatRate: detail.variant.product.vatRate ?? 0,
  }
}

export function mapServerOrderToSubmitted(order: IOrder): SubmittedOrder {
  return {
    id: order.slug,
    submittedAt: order.createdAt,
    items: (order.orderItems ?? []).map(mapServerOrderItemToOrderItem),
  }
}

export type ReconcileAction =
  | { type: 'noop' }
  | { type: 'hydrate'; orderSlug: string; submittedOrder: SubmittedOrder }
  | { type: 'refresh'; submittedOrder: SubmittedOrder }
  | { type: 'clear'; staleOrderSlug: string }
  | {
      type: 'mismatch'
      localOrderSlug: string
      serverOrderSlug: string
      submittedOrder: SubmittedOrder
    }

export function computeSessionReconciliation(
  localSession: TableSession | null,
  serverOrder: IOrder | null,
): ReconcileAction {
  const localSlug = localSession?.orderSlug
  if (!serverOrder) {
    if (!localSlug) return { type: 'noop' }
    return { type: 'clear', staleOrderSlug: localSlug }
  }
  if (!localSlug) {
    return {
      type: 'hydrate',
      orderSlug: serverOrder.slug,
      submittedOrder: mapServerOrderToSubmitted(serverOrder),
    }
  }
  if (localSlug === serverOrder.slug) {
    return {
      type: 'refresh',
      submittedOrder: mapServerOrderToSubmitted(serverOrder),
    }
  }
  return {
    type: 'mismatch',
    localOrderSlug: localSlug,
    serverOrderSlug: serverOrder.slug,
    submittedOrder: mapServerOrderToSubmitted(serverOrder),
  }
}
