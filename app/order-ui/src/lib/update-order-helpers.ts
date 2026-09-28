import type { IOrder, IOrderItem } from '@/types'

export function shouldShowEmptyItemsBanner(orderItems: IOrderItem[] | undefined): boolean {
  return !orderItems || orderItems.length === 0
}

/**
 * Returns true if `local` and `server` differ in item slug, quantity, or note.
 * Order-insensitive (compares sorted fingerprints). Use to decide whether to
 * prompt user to reload after server-side changes.
 */
export function hasServerOrderDiverged(
  local: IOrder | null,
  server: IOrder | null,
): boolean {
  if (local === null && server === null) return false
  if (local === null || server === null) return true
  return fingerprint(local) !== fingerprint(server)
}

function fingerprint(order: IOrder): string {
  const items = order.orderItems ?? []
  return items
    .map((it) => `${it.slug}:${it.quantity}:${it.note ?? ''}`)
    .sort()
    .join('|')
}

/**
 * Roll back items we successfully added by deleting them in reverse order.
 * Continues on individual delete failures (best-effort cleanup).
 * Returns counts so caller can show a "Rolled back X of Y" toast.
 */
export async function rollbackAddedItems(
  slugs: string[],
  deleteFn: (slug: string) => Promise<unknown>,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0
  let failed = 0
  for (const slug of [...slugs].reverse()) {
    try {
      await deleteFn(slug)
      succeeded++
    } catch {
      failed++
    }
  }
  return { succeeded, failed }
}
