import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { computeSessionReconciliation } from '@/lib/staff-orders'
import { showErrorToastMessage, showToast } from '@/utils'
import { getOrderBySlug } from '@/api/order'
import { QUERYKEY } from '@/constants'
import { OrderStatus } from '@/types'
import type { IOrder } from '@/types'
import type { SubmittedOrder, TableSession } from '@/types/session'

/**
 * Khi BE không còn active order cho bàn, đơn local stale có thể đã bị:
 *  - PAID/COMPLETED/SHIPPING → thu ngân vừa thanh toán
 *  - FAILED → bị huỷ
 *  - 404 / lookup fail → không xác định
 * Trả i18n-free message phù hợp tuỳ status để toast tường minh thay vì
 * generic "đơn đã đóng từ thiết bị khác".
 */
function buildClearReasonMessage(
  status: OrderStatus | undefined,
  hasPending: boolean,
): string {
  if (
    status === OrderStatus.PAID ||
    status === OrderStatus.COMPLETED ||
    status === OrderStatus.SHIPPING
  ) {
    return hasPending
      ? 'Thu ngân đã thanh toán đơn cũ — món đang chọn được giữ lại'
      : 'Thu ngân đã thanh toán đơn này'
  }
  if (status === OrderStatus.FAILED) {
    return hasPending
      ? 'Đơn cũ đã bị huỷ — món đang chọn được giữ lại'
      : 'Đơn này đã bị huỷ bởi nhân viên khác'
  }
  return hasPending
    ? 'Đơn cũ đã đóng từ thiết bị khác — món đang chọn được giữ lại'
    : 'Đơn này đã đóng từ thiết bị khác'
}

interface SessionReconciliationInput {
  tableSlug: string
  session: TableSession | null | undefined
  serverActiveOrder: IOrder | null | undefined
  isLoadingActiveOrder: boolean
  isFetchingActiveOrder: boolean
  setOrderSlug: (tableSlug: string, slug: string) => void
  replaceSubmittedOrders: (tableSlug: string, orders: SubmittedOrder[]) => void
  cancelSession: (tableSlug: string) => void
  clearPendingItems: (tableSlug: string) => void
}

/**
 * Reconcile the in-memory session with the server-side active order.
 *
 * Mirrors the effect previously inlined in admin-cart-content.tsx
 * (and the equivalent in table-order-screen.tsx). Calls the pure helper
 * `computeSessionReconciliation` to decide which of 4 actions to take:
 *   - hydrate: session is empty, server has order → seed
 *   - refresh: session has orderSlug matching server → replace submitted
 *   - mismatch: session.orderSlug differs from server → cancel + reseed
 *   - clear: session has orderSlug but server has nothing → cancel
 *
 * `lastRefreshedServerRef` guards against acting on stale BE responses
 * (we only act when the response slug differs from the last one we acted on).
 */
export function useSessionReconciliation({
  tableSlug,
  session,
  serverActiveOrder,
  isLoadingActiveOrder,
  isFetchingActiveOrder,
  setOrderSlug,
  replaceSubmittedOrders,
  cancelSession,
}: SessionReconciliationInput): void {
  const lastRefreshedServerRef = useRef<typeof serverActiveOrder>(undefined)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!tableSlug) return
    if (isLoadingActiveOrder || isFetchingActiveOrder) return
    // Guard against keepPreviousData: query may briefly return a different table's order.
    if (serverActiveOrder && serverActiveOrder.table?.slug !== tableSlug) return

    const action = computeSessionReconciliation(
      session ?? null,
      serverActiveOrder ?? null,
    )
    switch (action.type) {
      case 'noop':
        return
      case 'hydrate': {
        // Admin only renders cart when a session already exists (see early return
        // below). If there's no local session, skip — the page should not auto-open one.
        if (!session) return
        setOrderSlug(tableSlug, action.orderSlug)
        replaceSubmittedOrders(tableSlug, [action.submittedOrder])
        lastRefreshedServerRef.current = serverActiveOrder
        return
      }
      case 'refresh': {
        if (lastRefreshedServerRef.current === serverActiveOrder) return
        lastRefreshedServerRef.current = serverActiveOrder
        replaceSubmittedOrders(tableSlug, [action.submittedOrder])
        return
      }
      case 'mismatch': {
        lastRefreshedServerRef.current = serverActiveOrder
        setOrderSlug(tableSlug, action.serverOrderSlug)
        replaceSubmittedOrders(tableSlug, [action.submittedOrder])
        showToast('Đơn đã được cập nhật từ thiết bị khác')
        return
      }
      case 'clear': {
        lastRefreshedServerRef.current = undefined
        const hasPending = (session?.pendingItems.length ?? 0) > 0
        if (hasPending) {
          setOrderSlug(tableSlug, '')
          replaceSubmittedOrders(tableSlug, [])
        } else {
          cancelSession(tableSlug)
        }
        // Lookup status cuối của đơn stale → toast tường minh.
        // Lookup fail → fallback generic. Fire-and-forget vì state đã được
        // dọn ở trên, toast chỉ là explainer thêm.
        void queryClient
          .fetchQuery({
            queryKey: [...QUERYKEY.order, action.staleOrderSlug],
            queryFn: () => getOrderBySlug(action.staleOrderSlug),
            staleTime: 0,
          })
          .then((res) => {
            showErrorToastMessage(
              buildClearReasonMessage(res.result?.status, hasPending),
            )
          })
          .catch(() => {
            showErrorToastMessage(
              buildClearReasonMessage(undefined, hasPending),
            )
          })
        return
      }
      default: {
        const _exhaustive: never = action
        return _exhaustive
      }
    }
  }, [
    tableSlug,
    isLoadingActiveOrder,
    isFetchingActiveOrder,
    serverActiveOrder,
    session,
    setOrderSlug,
    replaceSubmittedOrders,
    cancelSession,
    queryClient,
  ])
}
