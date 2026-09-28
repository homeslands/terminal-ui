import { useMemo } from 'react'
import {
  usePublicVouchersForOrder,
  useVouchersForOrder,
} from '@/hooks/use-voucher'
import {
  mergeVoucherSources,
  type IVoucherDisplay,
} from '@/lib/voucher-rules'
import type { IGetAllVoucherRequest, IVoucher } from '@/types'

interface Options {
  /** Sheet open / list visible. Skips fetch when false. */
  enabled: boolean
  /** Eligible API params. */
  params: IGetAllVoucherRequest
  /** Voucher currently applied to the order (snapshot). */
  appliedVoucher: IVoucher | null
  /** Extra vouchers to inject (e.g. result of "input code" specific search). */
  extraVouchers?: IVoucher[]
  /** Use the public (customer) endpoint instead of the authenticated staff one. */
  variant?: 'staff' | 'public'
}

interface Result {
  list: IVoucherDisplay[]
  hasMore: boolean
  isLoading: boolean
  refetch: () => void
}

/**
 * Source-of-truth hook for voucher sheets.
 *
 * Merges the eligible response with the order's current applied voucher so the
 * sheet ALWAYS renders the applied voucher, even when it has dropped out of
 * eligibility (e.g. user just consumed the last remaining usage).
 */
export function useVoucherDisplayList(opts: Options): Result {
  const isPublic = opts.variant === 'public'

  const staffQuery = useVouchersForOrder(
    opts.params,
    opts.enabled && !isPublic,
  )
  const publicQuery = usePublicVouchersForOrder(
    opts.params,
    opts.enabled && isPublic,
  )

  const data = isPublic ? publicQuery.data : staffQuery.data
  const refetch = isPublic ? publicQuery.refetch : staffQuery.refetch
  const isLoading = isPublic ? publicQuery.isLoading : staffQuery.isLoading

  const list = useMemo<IVoucherDisplay[]>(() => {
    const eligible: IVoucher[] = data?.result?.items ?? []
    let combined: IVoucher[] = eligible
    if (opts.extraVouchers?.length) {
      const seen = new Set(eligible.map((v) => v.slug))
      const extras = opts.extraVouchers.filter((v) => !seen.has(v.slug))
      combined = [...extras, ...eligible]
    }
    return mergeVoucherSources(combined, opts.appliedVoucher)
  }, [data?.result?.items, opts.appliedVoucher, opts.extraVouchers])

  return {
    list,
    hasMore: !!data?.result?.hasNext,
    isLoading,
    refetch: () => {
      refetch()
    },
  }
}
