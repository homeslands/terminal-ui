import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useChangeOrderOwner } from '@/hooks/use-order'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import { useUserStore } from '@/stores/user.store'
import { QUERYKEY } from '@/constants/query'
import { showErrorToast, showErrorToastMessage, showToast } from '@/utils'
import type { TableCustomer } from '@/types/session'

interface UseOwnerSyncOptions {
  tableId: string
  orderSlug?: string | null
}

interface UseOwnerSyncResult {
  selectCustomer: (user: TableCustomer | null) => Promise<void>
  isOwnerSyncing: boolean
}

/**
 * Centralized owner-sync at the customer-pick callsite.
 *
 * - Cart pending (no orderSlug): optimistic local update only.
 *   `createOrder` later sends `owner` in the payload atomically.
 * - Order placed (orderSlug exists): optimistic local update + PATCH
 *   `/orders/{slug}/owner` immediately. PATCH failure rolls back the session
 *   customer and toasts the error code from BE.
 * - `selectCustomer(null)` on a placed order PATCHes back to the staff
 *   user (fallback). On success, toast confirming reassignment.
 *
 * The in-flight PATCH promise is published to `pendingOwnerSync` so voucher
 * sheets can `await` it before validate/apply (existing guards).
 */
export function useOwnerSync({
  tableId,
  orderSlug,
}: UseOwnerSyncOptions): UseOwnerSyncResult {
  const { mutateAsync: patchOwner } = useChangeOrderOwner()
  const setOrderCustomer = useTableSessionsStore((s) => s.setOrderCustomer)
  const setPendingOwnerSync = useTableSessionsStore(
    (s) => s.setPendingOwnerSync,
  )
  const isOwnerSyncing = useTableSessionsStore(
    (s) => s.pendingOwnerSync !== null,
  )
  const queryClient = useQueryClient()

  const selectCustomer = useCallback(
    async (user: TableCustomer | null): Promise<void> => {
      // Snapshot for rollback BEFORE optimistic mutation.
      const previousCustomer =
        useTableSessionsStore.getState().sessions[tableId]?.customer ?? null

      // Optimistic FE update — always run.
      setOrderCustomer(tableId, user)

      // Cart pending — `createOrder` payload sends owner atomically.
      if (!orderSlug) return

      // Determine desired owner (null user → staff fallback so the order
      // becomes a "khách lẻ" with the current staff as owner).
      const staffSlug = useUserStore.getState().userInfo?.slug ?? ''
      const desiredOwner = user?.slug ?? staffSlug
      if (!desiredOwner) {
        // No staff slug either — BE would reject empty owner.
        setOrderCustomer(tableId, previousCustomer ?? null)
        showErrorToastMessage('Không thể cập nhật khách: thiếu định danh.')
        return
      }

      const wasClearAction = user === null

      const syncPromise: Promise<void> = patchOwner({
        slug: orderSlug,
        owner: desiredOwner,
      })
        .then(() => {
          // Skip invalidate + toast if superseded by a newer dispatch — the newer
          // dispatch will invalidate on its own .then, and the clear-action toast
          // would mislead if a pick has already taken over.
          if (
            useTableSessionsStore.getState().pendingOwnerSync !== syncPromise
          ) {
            return
          }
          queryClient.invalidateQueries({
            queryKey: [...QUERYKEY.order, orderSlug],
          })
          if (wasClearAction) {
            const userInfo = useUserStore.getState().userInfo
            const staffName =
              `${userInfo?.firstName ?? ''} ${userInfo?.lastName ?? ''}`.trim() ||
              'nhân viên'
            showToast(
              `Đã chuyển sang đơn khách lẻ. Người phụ trách: ${staffName}`,
            )
          }
        })
        .catch((err: unknown) => {
          // Skip rollback + toast if a newer dispatch has superseded us.
          // The newer promise owns the user-visible state; A's rejection should
          // propagate silently to any awaiter awaiting A specifically, but must
          // NOT clobber B's session or toast about A's failure.
          if (
            useTableSessionsStore.getState().pendingOwnerSync !== syncPromise
          ) {
            throw err
          }
          // Rollback session customer first, so voucher sheets awaiting the
          // rejection see UI already reverted.
          setOrderCustomer(tableId, previousCustomer ?? null)
          const code = (
            err as { response?: { data?: { errorCodeValue?: number } } }
          )?.response?.data?.errorCodeValue
          if (code) showErrorToast(code)
          else showErrorToastMessage('Đổi khách thất bại.')
          throw err
        })
        .finally(() => {
          // Promise-identity guard: another selectCustomer may have superseded
          // us (A→B race); only clear if our promise is still the stored one.
          if (
            useTableSessionsStore.getState().pendingOwnerSync === syncPromise
          ) {
            setPendingOwnerSync(null)
          }
        })

      setPendingOwnerSync(syncPromise)
      // Silence the stored reference so an absent awaiter doesn't trigger
      // window.unhandledrejection. Voucher sheets await the same syncPromise
      // and still observe the rejection.
      syncPromise.catch(() => undefined)

      try {
        await syncPromise
      } catch {
        // Already handled inside `.catch`. We swallow here so callers don't
        // need try/catch — UI feedback (toast, rollback) is the contract.
      }
    },
    [
      tableId,
      orderSlug,
      patchOwner,
      setOrderCustomer,
      setPendingOwnerSync,
      queryClient,
    ],
  )

  return { selectCustomer, isOwnerSyncing }
}
