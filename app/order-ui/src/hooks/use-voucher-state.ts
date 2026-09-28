import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { IVoucher } from '@/types'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import { evaluateVoucher, type VoucherContext, type VoucherInvalidReason } from '@/lib/voucher-rules'
import { useUpdateVoucherInOrder } from '@/hooks/use-order'
import { QUERYKEY } from '@/constants'

interface UseVoucherStateInput {
  tableSlug: string
  orderSlug: string | null | undefined
  items: { menuItemId?: string; productSlug?: string; quantity: number }[]
  hasCustomerOwner: boolean
  subtotalAfterPromotion: number
  paymentMethod?: string
  /** Voucher applied on the BE order (from useOrderBySlug). Used to seed
   *  session.voucher ONCE on initial mount when session is empty. After seed,
   *  session is source of truth and BE updates do not override local. */
  beVoucher?: IVoucher | null
}

interface UseVoucherStateResult {
  appliedVoucher: IVoucher | null
  isApplying: boolean
  isRemoving: boolean
  applyVoucher: (v: IVoucher) => Promise<void>
  removeVoucher: () => Promise<void>
  onAutoRemoved: (cb: (reason: VoucherInvalidReason) => void) => void
}

export function useVoucherState(
  input: UseVoucherStateInput,
): UseVoucherStateResult {
  const sessions = useTableSessionsStore((s) => s.sessions)
  const setOrderVoucher = useTableSessionsStore((s) => s.setOrderVoucher)
  const session = sessions[input.tableSlug]
  const appliedVoucher = session?.voucher ?? null

  const { mutateAsync: patchVoucher } = useUpdateVoucherInOrder()
  const queryClient = useQueryClient()

  const buildItemsPayload = useCallback(() => {
    return input.items.map((i) => ({
      quantity: i.quantity,
      variant: '',
      note: '',
      promotion: null,
      vatRate: 0,
    }))
  }, [input.items])

  const applyVoucher = useCallback(
    async (v: IVoucher) => {
      const previous = sessions[input.tableSlug]?.voucher ?? null
      setOrderVoucher(input.tableSlug, v)
      if (!input.orderSlug) return
      try {
        await patchVoucher({
          slug: input.orderSlug,
          voucher: v.slug,
          orderItems: buildItemsPayload(),
        })
        queryClient.invalidateQueries({
          queryKey: [...QUERYKEY.order, input.orderSlug],
        })
      } catch {
        setOrderVoucher(input.tableSlug, previous)
      }
    },
    [
      input.orderSlug,
      input.tableSlug,
      sessions,
      setOrderVoucher,
      patchVoucher,
      queryClient,
      buildItemsPayload,
    ],
  )

  const removeVoucher = useCallback(async () => {
    const previous = sessions[input.tableSlug]?.voucher ?? null
    if (!previous) return
    setOrderVoucher(input.tableSlug, null)
    if (!input.orderSlug) return
    try {
      await patchVoucher({
        slug: input.orderSlug,
        voucher: null,
        orderItems: buildItemsPayload(),
      })
      queryClient.invalidateQueries({
        queryKey: [...QUERYKEY.order, input.orderSlug],
      })
    } catch {
      setOrderVoucher(input.tableSlug, previous)
    }
  }, [
    input.orderSlug,
    input.tableSlug,
    sessions,
    setOrderVoucher,
    patchVoucher,
    queryClient,
    buildItemsPayload,
  ])

  const onAutoRemovedRef = useRef<((reason: VoucherInvalidReason) => void) | null>(
    null,
  )
  const onAutoRemoved = useCallback(
    (cb: (reason: VoucherInvalidReason) => void) => {
      onAutoRemovedRef.current = cb
    },
    [],
  )

  // auto-revalidate effect
  useEffect(() => {
    if (!appliedVoucher) return
    if (!input.orderSlug) return // pending cart: nothing to PATCH; trust user
    if (input.items.length === 0) return // wait for items
    const ctx: VoucherContext = {
      subtotalAfterPromotion: input.subtotalAfterPromotion,
      totalQuantity: input.items.reduce((s, i) => s + i.quantity, 0),
      productSlugs: input.items.map((i) => i.productSlug ?? i.menuItemId ?? ''),
      hasCustomerOwner: input.hasCustomerOwner,
      paymentMethod: input.paymentMethod,
    }
    const { valid, reason } = evaluateVoucher(appliedVoucher, ctx)
    if (!valid && reason) {
      // Auto-remove: silent, no rollback (would immediately re-fail).
      setOrderVoucher(input.tableSlug, null)
      void patchVoucher({
        slug: input.orderSlug,
        voucher: null,
        orderItems: buildItemsPayload(),
      }).then(() => {
        queryClient.invalidateQueries({
          queryKey: [...QUERYKEY.order, input.orderSlug!],
        })
      }).catch(() => undefined)
      onAutoRemovedRef.current?.(reason)
    }
  }, [
    appliedVoucher,
    input.orderSlug,
    input.tableSlug,
    input.items,
    input.hasCustomerOwner,
    input.subtotalAfterPromotion,
    input.paymentMethod,
    setOrderVoucher,
    patchVoucher,
    queryClient,
    buildItemsPayload,
  ])

  // BE seed effect
  const hasSeededRef = useRef(false)
  useEffect(() => {
    if (hasSeededRef.current) return
    if (!input.beVoucher) return
    if (sessions[input.tableSlug]?.voucher) {
      hasSeededRef.current = true
      return
    }
    hasSeededRef.current = true
    setOrderVoucher(input.tableSlug, input.beVoucher)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.beVoucher])

  return {
    appliedVoucher,
    isApplying: false,
    isRemoving: false,
    applyVoucher,
    removeVoucher,
    onAutoRemoved,
  }
}
