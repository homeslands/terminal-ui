import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  loadDataToPrinter,
  showErrorToastMessage,
  showToast,
} from '@/utils'
import { QUERYKEY } from '@/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@/components/ui'
import { MenuPanel } from '@/components/staff/menu-panel'
import { OrderSummary } from '@/components/staff/order-summary'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { TableStatusBadge } from '@/components/staff/table-status-badge'
import { TransferTableDialog } from '@/components/staff/transfer-table-dialog'
import { useTableSessions } from '@/hooks/useTableSessions'
import { useOwnerSync } from '@/hooks/use-owner-sync'
import {
  useAddNewMultipleOrderItems,
  useCreateOrder,
  useDeleteOrder,
  useDeleteOrderItem,
  useGetOrderProvisionalBill,
  useUpdateNoteOrderItem,
  useUpdateOrderItem,
  useTables,
  useGetActiveOrderByTable,
} from '@/hooks'
import { useVoucherState } from '@/hooks/use-voucher-state'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import { useTableSessionsStore, useUserStore } from '@/stores'
import { computeSessionReconciliation } from '@/lib/staff-orders'
import { getOrderBySlug } from '@/api/order'
import {
  buildCreateOrderItems,
  buildAddOrderItemPayload,
} from '@/lib/staff-order-payload'
import type { OrderItem } from '@/types/session'
import { OrderStatus, OrderTypeEnum } from '@/types'
import type { IVoucher } from '@/types'
import type { Table } from '@/data/staff-data'

export interface TableOrderScreenProps {
  /**
   * Custom back handler. Default: navigate to /staff.
   * Admin context: navigate to /system/tables.
   */
  onBack?: () => void
  /**
   * Hide PosPageHeader. Admin uses SystemLayout breadcrumb instead.
   */
  hideHeader?: boolean
  /**
   * Override payment screen path. Default: /staff/table/:id/payment.
   * Admin: /system/table/:id/payment.
   */
  paymentPath?: (tableId: string) => string
}

export function TableOrderScreen({
  onBack,
  hideHeader = false,
  paymentPath = (id) => `/staff/table/${id}/payment`,
}: TableOrderScreenProps) {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { t: tToast } = useTranslation('toast')
  const fromPath = (location.state as { from?: string } | null)?.from ?? null
  const backRoute = fromPath ?? '/staff'
  const backLabel = '← Sơ đồ bàn'
  const queryClient = useQueryClient()
  const {
    sessions,
    addItem,
    updateItem,
    removeItem,
    submitOrder,
    requestPayment,
    cancelPaymentIntent,
    setOrderSlug,
    setPendingItemOrderItemSlug,
    closeSession,
    cancelSession,
    clearPendingItems,
    transferSession,
    openSession,
    replaceSubmittedOrders,
    setOrderDescription,
  } = useTableSessions()

  const {
    data: serverActiveOrder,
    isLoading: isLoadingActiveOrder,
    isFetching: isFetchingActiveOrder,
  } = useGetActiveOrderByTable(id)

  const lastRefreshedServerRef = useRef<typeof serverActiveOrder>(undefined)

  const { mutateAsync: createOrderAsync, isPending: isCreatingOrder } =
    useCreateOrder()
  const { mutateAsync: addMultipleAsync, isPending: isAddingMultiple } =
    useAddNewMultipleOrderItems()
  const { mutateAsync: deleteOrderItemAsync } = useDeleteOrderItem()
  const { mutateAsync: updateOrderItemAsync } = useUpdateOrderItem()
  const { mutateAsync: updateNoteOrderItemAsync } = useUpdateNoteOrderItem()
  const { mutateAsync: deleteOrderAsync } = useDeleteOrder()
  const { mutate: getOrderProvisionalBill, isPending: isExportingBill } =
    useGetOrderProvisionalBill()

  const { userInfo } = useUserStore()
  const { data: tablesData } = useTables(userInfo?.branch?.slug ?? '')
  const tables: Table[] = useMemo(
    () =>
      (tablesData?.result ?? []).map((t) => ({
        id: t.slug,
        label: t.name,
        seats: 4,
      })),
    [tablesData],
  )

  const [showDiscardPendingDialog, setShowDiscardPendingDialog] =
    useState(false)
  const [time, setTime] = useState(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setTime(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      )
    }
    const timerId = setInterval(tick, 10_000)
    return () => clearInterval(timerId)
  }, [])

  const session = sessions[id]
  const { selectCustomer } = useOwnerSync({
    tableId: id,
    orderSlug: session?.orderSlug,
  })

  // Edge case: user clicked THANH TOÁN by mistake → navigated to payment →
  // pressed back. Session is stuck on 'waiting_payment' which hides Transfer.
  // Revert to 'serving' so transfer + edit work again.
  useEffect(() => {
    if (session?.status === 'waiting_payment') {
      cancelPaymentIntent(id)
    }
    // Only run on mount / when navigating to different table — not when status
    // changes (would create infinite loop with the action that flips it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const sessionForReconcile = sessions[id] ?? null
  useEffect(() => {
    if (isLoadingActiveOrder || isFetchingActiveOrder) return
    // Guard against keepPreviousData: when navigating tables, the query may
    // briefly return the previous table's order before the new fetch resolves.
    if (serverActiveOrder && serverActiveOrder.table?.slug !== id) return
    const action = computeSessionReconciliation(
      sessionForReconcile,
      serverActiveOrder ?? null,
    )
    switch (action.type) {
      case 'noop':
        return
      case 'hydrate': {
        if (!sessionForReconcile) {
          const tableName = tables.find((t) => t.id === id)?.label ?? id
          openSession(id, tableName)
        }
        setOrderSlug(id, action.orderSlug)
        replaceSubmittedOrders(id, [action.submittedOrder])
        return
      }
      case 'refresh': {
        // Skip if we already wrote this exact server payload — prevents the
        // self-induced re-run loop where our own write to sessions[id] changes
        // sessionForReconcile (in deps), causing the effect to re-fire with
        // the same identity-stable serverActiveOrder.
        if (lastRefreshedServerRef.current === serverActiveOrder) return
        lastRefreshedServerRef.current = serverActiveOrder
        // Silent re-sync of submitted items when another device modified the order
        // (item quantity edit, item deleted, new item added) without changing orderSlug.
        // No toast — this is normal background sync.
        replaceSubmittedOrders(id, [action.submittedOrder])
        return
      }
      case 'mismatch': {
        lastRefreshedServerRef.current = serverActiveOrder
        setOrderSlug(id, action.serverOrderSlug)
        replaceSubmittedOrders(id, [action.submittedOrder])
        showToast('Đơn đã được cập nhật từ thiết bị khác')
        return
      }
      case 'clear': {
        lastRefreshedServerRef.current = null
        const hasPending = (sessionForReconcile?.pendingItems.length ?? 0) > 0
        if (hasPending) {
          // Keep the session + pending items so the user doesn't lose unsubmitted work.
          // Drop only the stale orderSlug + submittedOrders; next submit will create a new order.
          setOrderSlug(id, '')
          replaceSubmittedOrders(id, [])
        } else {
          cancelSession(id)
          if (onBack) {
            onBack()
          } else {
            navigate('/staff')
          }
        }
        // Lookup status cuối của đơn stale để toast tường minh (PAID = thu
        // ngân thanh toán, FAILED = bị huỷ). Fire-and-forget vì state đã
        // được dọn ở trên.
        const buildMsg = (status: OrderStatus | undefined) => {
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
        void queryClient
          .fetchQuery({
            queryKey: [...QUERYKEY.order, action.staleOrderSlug],
            queryFn: () => getOrderBySlug(action.staleOrderSlug),
            staleTime: 0,
          })
          .then((res) => showErrorToastMessage(buildMsg(res.result?.status)))
          .catch(() => showErrorToastMessage(buildMsg(undefined)))
        return
      }
      default: {
        // Exhaustiveness check — if a new ReconcileAction variant is added without
        // a case here, TS will fail to assign `action` (narrowed to `never`) to `_exhaustive`.
        const _exhaustive: never = action
        return _exhaustive
      }
    }
  }, [
    id,
    isLoadingActiveOrder,
    isFetchingActiveOrder,
    serverActiveOrder,
    sessionForReconcile,
    tables,
    openSession,
    setOrderSlug,
    replaceSubmittedOrders,
    cancelSession,
    navigate,
    onBack,
  ])

  // Build items list for voucher validation: all submitted + pending items.
  const voucherItems = useMemo(() => {
    const submitted = session?.submittedOrders?.flatMap((o) => o.items) ?? []
    const pending = session?.pendingItems ?? []
    return [...submitted, ...pending].map((i) => ({
      menuItemId: i.menuItemId,
      productSlug: i.productSlug,
      quantity: i.quantity,
    }))
  }, [session?.submittedOrders, session?.pendingItems])

  const voucherCart = useMemo(
    () => staffItemsToCartItem(voucherItems as unknown as OrderItem[]),
    [voucherItems],
  )
  const voucherDisplay = useMemo(
    () => calculateCartItemDisplay(voucherCart, null),
    [voucherCart],
  )
  const voucherSubtotal = useMemo(
    () => calculateCartTotals(voucherDisplay, null),
    [voucherDisplay],
  )

  const {
    appliedVoucher: sessionVoucher,
    applyVoucher: applyVoucherHook,
    removeVoucher: removeVoucherHook,
    onAutoRemoved,
  } = useVoucherState({
    tableSlug: id,
    orderSlug: session?.orderSlug,
    items: voucherItems,
    hasCustomerOwner: !!session?.customer,
    subtotalAfterPromotion:
      voucherSubtotal.subTotalBeforeDiscount - voucherSubtotal.promotionDiscount,
    beVoucher: serverActiveOrder?.voucher ?? null,
  })

  useEffect(() => {
    onAutoRemoved((_reason) => {
      if (sessionVoucher) {
        showErrorToastMessage(
          tToast('toast.voucherAutoRemovedInvalid', { code: sessionVoucher.code }),
        )
      }
    })
  }, [onAutoRemoved, sessionVoucher, tToast])

  if (!session) {
    if (isLoadingActiveOrder) {
      return <PosNotFoundState message="Đang tải phiên bàn..." />
    }
    return <PosNotFoundState message="Không tìm thấy bàn hoặc phiên đã đóng." />
  }

  const handleAdd = (item: Omit<OrderItem, 'note'>) => {
    const added = addItem(id, { ...item, note: '' })
    if (added) showToast(`Đã thêm ${item.name}`)
  }

  const handleDecrement = (menuItemId: string) => {
    const item = session.pendingItems.find((i) => i.menuItemId === menuItemId)
    if (!item) return
    if (item.quantity <= 1) {
      removeItem(id, menuItemId)
      showErrorToastMessage(`Đã xóa ${item.name}`)
    } else {
      updateItem(id, menuItemId, { quantity: item.quantity - 1 })
    }
  }

  const handleRemoveItem = (itemId: string) => {
    const name =
      session.pendingItems.find(
        (i) => (i.rowId ?? i.customPriceId ?? i.menuItemId) === itemId,
      )?.name ?? 'Món'
    removeItem(id, itemId)
    showErrorToastMessage(`Đã xóa ${name}`)
  }

  const invalidateActiveOrder = () =>
    queryClient.invalidateQueries({
      queryKey: [QUERYKEY.activeOrderByTable, id],
    })

  const handleApplyVoucher = async (voucher: IVoucher) => {
    await applyVoucherHook(voucher)
    const current =
      useTableSessionsStore.getState().sessions[id]?.voucher ?? null
    if (current?.slug === voucher.slug) {
      showToast(tToast('toast.applyVoucherSuccess'))
    } else {
      showErrorToastMessage(tToast('toast.applyVoucherFailed'))
    }
  }

  const handleRemoveVoucher = async () => {
    const before = sessions[id]?.voucher ?? null
    if (!before) return
    await removeVoucherHook()
    const current =
      useTableSessionsStore.getState().sessions[id]?.voucher ?? null
    if (current === null) {
      showToast(tToast('toast.removeVoucherSuccess'))
    } else {
      showErrorToastMessage(tToast('toast.removeVoucherFailed'))
    }
  }

  const handleSubmitOrder = async () => {
    const currentSession = sessions[id]
    if (!currentSession || currentSession.pendingItems.length === 0) return

    const apiItemsPayload = buildCreateOrderItems(currentSession.pendingItems)
    if (apiItemsPayload.length === 0) return

    try {
      if (!currentSession.orderSlug) {
        const data = await createOrderAsync({
          type: OrderTypeEnum.AT_TABLE,
          table: id,
          branch: userInfo?.branch?.slug ?? '',
          owner: currentSession.customer?.slug ?? userInfo?.slug ?? '',
          approvalBy: userInfo?.slug ?? '',
          description: currentSession.description ?? '',
          orderItems: apiItemsPayload,
          voucher: currentSession.voucher?.slug ?? null,
        })

        // Backfill orderItemSlug from response before submitOrder moves items
        for (const apiItem of data.result.orderItems) {
          setPendingItemOrderItemSlug(id, apiItem.variant.slug, apiItem.slug)
        }
        setOrderSlug(id, data.result.slug)
        showToast('Đã đặt món thành công')
      } else {
        const apiItems = currentSession.pendingItems.filter(
          (item) => item.variantSlug,
        )
        if (apiItems.length === 0) {
          showToast('Đã cập nhật đơn')
        } else {
          const payload = apiItems.map((item) =>
            buildAddOrderItemPayload(item, currentSession.orderSlug!),
          )
          const data = await addMultipleAsync(payload)
          // BE batch endpoint trả full IOrder với toàn bộ orderItems[] (cả cũ + mới).
          // Chỉ backfill slug cho các variant vừa thêm — tránh ghi đè các item đã có
          // trong submittedOrders với slug từ items khác cùng variant.
          const newVariantSlugs = new Set(apiItems.map((i) => i.variantSlug))
          for (const apiItem of data.result) {
            if (newVariantSlugs.has(apiItem.variant.slug)) {
              setPendingItemOrderItemSlug(
                id,
                apiItem.variant.slug,
                apiItem.slug,
              )
            }
          }
          showToast('Đã cập nhật đơn')
        }
      }
      submitOrder(id)
      invalidateActiveOrder()
    } catch {
      showErrorToastMessage('Không thể gửi đơn. Vui lòng thử lại.')
    }
  }

  const handleSubmittedChanges = async (
    changes: Array<{
      orderItemSlug: string
      newQty: number
      newNote?: string
    }>,
  ) => {
    const currentSession = sessions[id]
    if (!currentSession) return

    // Each entry targets one orderItemSlug — rows are independent in SubmittedOrdersDialog.
    try {
      for (const { orderItemSlug, newQty, newNote } of changes) {
        const item = currentSession.submittedOrders
          .flatMap((o) => o.items)
          .find((i) => i.orderItemSlug === orderItemSlug)
        if (!item) continue

        // Defensive: skip noop entries
        if (newQty === item.quantity && newNote === undefined) continue

        if (newQty === 0) {
          await deleteOrderItemAsync(orderItemSlug)
        } else if (newQty < item.quantity) {
          await updateOrderItemAsync({
            slug: orderItemSlug,
            data: {
              quantity: newQty,
              variant: item.variantSlug ?? '',
              note: item.note ?? '',
              promotion: item.promotion?.slug ?? '',
              action: 'decrement',
            },
          })
        } else if (newQty > item.quantity) {
          await updateOrderItemAsync({
            slug: orderItemSlug,
            data: {
              quantity: newQty,
              variant: item.variantSlug ?? '',
              note: item.note ?? '',
              promotion: item.promotion?.slug ?? '',
              action: 'increment',
            },
          })
        }

        // Note change (processed after qty ops; skip if item was fully deleted)
        if (newNote !== undefined && newNote !== item.note && newQty > 0) {
          await updateNoteOrderItemAsync({
            slug: orderItemSlug,
            data: { note: newNote },
          })
        }
      }

      showToast('Đã cập nhật đơn')
      invalidateActiveOrder()
    } catch {
      showErrorToastMessage('Không thể cập nhật đơn. Vui lòng thử lại.')
    }
  }

  const handleCancelOrder = async () => {
    const currentSession = sessions[id]
    if (!currentSession?.orderSlug) return

    await deleteOrderAsync(currentSession.orderSlug)
    invalidateActiveOrder()
    cancelSession(id)
    showToast('Đã hủy đơn')
    if (onBack) {
      onBack()
    } else {
      navigate('/staff')
    }
  }

  const handleBack = () => {
    const hasPending = session.pendingItems.length > 0
    const hasSubmitted =
      session.submittedOrders.length > 0 || !!session.orderSlug
    if (!hasPending && !hasSubmitted) {
      closeSession(id)
      if (onBack) {
        onBack()
      } else {
        navigate(backRoute)
      }
      return
    }
    if (hasPending && !hasSubmitted) {
      // Pending items without any server-side state — prompt before discarding
      setShowDiscardPendingDialog(true)
      return
    }
    // Has server-side state — leave the session intact for next visit
    if (onBack) {
      onBack()
    } else {
      navigate(backRoute)
    }
  }

  const handleDiscardPendingConfirm = () => {
    setShowDiscardPendingDialog(false)
    closeSession(id)
    if (onBack) {
      onBack()
    } else {
      navigate(backRoute)
    }
  }

  const handlePay = () => {
    requestPayment(id)
    navigate(paymentPath(id))
  }

  const handleTransferred = (newTable: { id: string; label: string }) => {
    const currentSession = sessions[id]
    if (!currentSession) return

    // Move the local session to the new table.
    transferSession(id, newTable.id, newTable.label)

    // If this was a server-backed order, invalidate caches so any device
    // viewing either table picks up the change.
    if (currentSession.orderSlug) {
      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.activeOrderByTable, id],
      })
      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.activeOrderByTable, newTable.id],
      })
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.tables] })
    }

    showToast('Đã chuyển bàn thành công')
    navigate(`/staff/table/${newTable.id}`)
  }

  const requiresTransferConfirm = !!(
    session.orderSlug || session.submittedOrders.length > 0
  )

  const isSubmittingOrder = isCreatingOrder || isAddingMultiple

  return (
    <div className="flex h-full flex-col bg-pos-bg text-pos-text">
      {!hideHeader && (
        <PosPageHeader
          backTo={backRoute}
          backLabel={backLabel}
          onBack={handleBack}
          center={
            <TableStatusBadge
              tableName={session.tableName}
              status={session.status}
            />
          }
          right={
            <div className="flex items-center gap-2">
              {session.status !== 'waiting_payment' && (
                <TransferTableDialog
                  orderSlug={session.orderSlug ?? null}
                  currentTableId={id}
                  currentTableName={session.tableName}
                  tables={tables}
                  sessions={sessions}
                  onTransferred={handleTransferred}
                  requiresConfirm={requiresTransferConfirm}
                />
              )}
              <span className="font-mono text-sm text-pos-muted">{time}</span>
            </div>
          }
        />
      )}
      <main className="grid min-h-0 flex-1 grid-cols-[1fr_300px]">
        <div className="min-h-0">
          <MenuPanel
            pendingItems={session.pendingItems}
            onAdd={handleAdd}
            onDecrement={handleDecrement}
          />
        </div>
        <div className="min-h-0 border-l border-pos-border">
          <OrderSummary
            pendingItems={session.pendingItems}
            submittedOrders={session.submittedOrders}
            orderData={serverActiveOrder ?? null}
            onUpdateItem={(menuItemId, patch) =>
              updateItem(id, menuItemId, patch)
            }
            onRemoveItem={handleRemoveItem}
            onClearAll={() => clearPendingItems(id)}
            onSubmitOrder={handleSubmitOrder}
            onPay={handlePay}
            onDraftReceipt={() => {
              const slug = session?.orderSlug
              if (!slug) return
              getOrderProvisionalBill(slug, {
                onSuccess: (data: Blob) => {
                  showToast(tToast('toast.exportOrderProvisionalBillSuccess'))
                  loadDataToPrinter(data)
                },
              })
            }}
            onConfirmChanges={handleSubmittedChanges}
            onCancelOrder={handleCancelOrder}
            isSubmittingOrder={isSubmittingOrder}
            isExportingBill={isExportingBill}
            description={session.description ?? ''}
            onDescriptionChange={(value) => setOrderDescription(id, value)}
            customer={session.customer ?? null}
            voucher={session.voucher ?? null}
            onCustomerSelect={(c) => {
              void selectCustomer(c)
            }}
            onCustomerClear={() => {
              void selectCustomer(null)
            }}
            onApplyVoucher={handleApplyVoucher}
            onRemoveVoucher={handleRemoveVoucher}
            voucherDisabled={false}
          />
        </div>
      </main>
      <Dialog
        open={showDiscardPendingDialog}
        onOpenChange={setShowDiscardPendingDialog}
      >
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              Bỏ {session.pendingItems.length} món chưa đặt?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-pos-muted">
            Các món đang chọn chưa được gửi cho bếp. Quay lại sẽ xoá danh sách
            này.
          </p>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDiscardPendingDialog(false)}
            >
              Ở lại
            </Button>
            <Button
              onClick={handleDiscardPendingConfirm}
              className="bg-destructive text-white hover:bg-destructive/80"
            >
              Bỏ và quay lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
