import { useMemo } from 'react'
import {
  mergeVoucherSources,
  type IVoucherDisplay,
} from '@/lib/voucher-rules'
import type { IVoucher } from '@/types'

interface Args {
  /** Already-accumulated voucher items (from the sheet's local pagination state). */
  items: IVoucher[]
  /** Voucher currently applied to the order/cart. */
  applied: IVoucher | null
  /** Extra vouchers (e.g. result of input-code search). */
  extras?: IVoucher[]
}

/**
 * Composes the final display list each sheet shows. Centralises the dedupe
 * order: extras-first (so a user-typed code stays at top), eligible items,
 * then the applied snapshot is merged in regardless of presence.
 */
export function useVoucherDisplayItems({
  items,
  applied,
  extras,
}: Args): IVoucherDisplay[] {
  return useMemo(() => {
    const seen = new Set(items.map((v) => v.slug))
    const head = (extras ?? []).filter((v) => !seen.has(v.slug))
    return mergeVoucherSources([...head, ...items], applied)
  }, [items, applied, extras])
}
