import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'

import {
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { AdminCartHeader } from '@/app/system/menu/components/admin-cart-header'
import { AdminCartInfoTab } from '@/app/system/menu/components/admin-cart-info-tab'
import ConfirmClearCustomerDialog from '@/components/app/dialog/confirm-clear-customer-dialog'
import { AdminCartConfirmSubmitDialog } from '@/app/system/menu/components/admin-cart-confirm-submit-dialog'
import { AdminCartBreakdownPanel } from '@/app/system/menu/components/admin-cart-breakdown-panel'
import { useTableSessions } from '@/hooks/useTableSessions'
import { useOwnerSync } from '@/hooks/use-owner-sync'
import {
  useAddNewMultipleOrderItems,
  useBranchShiftGate,
  useCreateOrder,
  useDeleteOrder,
  useDeleteOrderItem,
  useGetActiveOrderByTable,
  // useGetOrderProvisionalBill,
  useOrderBySlug,
  useTables,
  useUpdateNoteOrderItem,
  useUpdateOrderItem,
} from '@/hooks'
import { ShiftGateBanner } from '@/components/work-shift/shift-gate-banner'
import type { Table } from '@/data/staff-data'
import { useTableSessionsStore, useUserStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import type { IVoucher } from '@/types'
import { QUERYKEY, ROUTE } from '@/constants'
import {
  formatCurrency,
  // loadDataToPrinter,
  showErrorToastMessage,
  showToast,
} from '@/utils'
import { useSessionReconciliation } from '@/hooks/use-session-reconciliation'
import {
  buildAddOrderItemPayload,
  buildCreateOrderItems,
} from '@/lib/staff-order-payload'
import { AdminCartPendingItemsList } from '@/app/system/menu/components/admin-cart-pending-items-list'
import { deriveSessionCustomer } from '@/lib/cart-customer'
import { computeOrderBreakdown } from '@/lib/order-breakdown'
import { useVoucherState } from '@/hooks/use-voucher-state'
import { useVoucherDerivedItems } from '@/hooks/use-voucher-derived-items'
import { usePendingSubmittedTotals } from '@/hooks/use-pending-submitted-totals'

export function AdminCartContent() {
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tableSlug = searchParams.get('table') ?? ''
  const assistOrderSlug = searchParams.get('assistOrder')
  const [assistBannerVisible, setAssistBannerVisible] =
    useState(!!assistOrderSlug)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearCustomerOpen, setClearCustomerOpen] = useState(false)

  useEffect(() => {
    // Show banner whenever the param is in the URL (handles direct link refresh).
    setAssistBannerVisible(!!assistOrderSlug)
  }, [assistOrderSlug])

  const dismissAssistBanner = () => {
    setAssistBannerVisible(false)
    // Also strip from URL so a refresh doesn't re-show.
    const next = new URLSearchParams(searchParams)
    next.delete('assistOrder')
    setSearchParams(next, { replace: true })
  }

  const {
    sessions,
    removeItem,
    updateItem,
    setOrderDescription,
    submitOrder,
    setOrderSlug,
    setPendingItemOrderItemSlug,
    replaceSubmittedOrders,
    cancelSession,
    clearPendingItems,
    transferSession,
    requestPayment,
    cancelPaymentIntent,
  } = useTableSessions()
  const session = tableSlug ? sessions[tableSlug] : null

  const { selectCustomer } = useOwnerSync({
    tableId: tableSlug,
    orderSlug: session?.orderSlug,
  })

  // Edge case: user clicked THANH TOÁN by mistake → navigated to payment →
  // pressed back. Session is stuck on 'waiting_payment' which hides Transfer.
  // Revert to 'serving' so transfer + edit work again.
  useEffect(() => {
    if (session?.status === 'waiting_payment') {
      cancelPaymentIntent(tableSlug)
    }
    // Only run on mount / when navigating to different table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableSlug])

  const {
    data: serverActiveOrder,
    isLoading: isLoadingActiveOrder,
    isFetching: isFetchingActiveOrder,
  } = useGetActiveOrderByTable(tableSlug)
  // Full order detail (includes full owner: firstName, lastName, role, branch).
  // `useGetActiveOrderByTable` only returns a slim DTO — owner is incomplete.
  // Fetch from `GET /orders/{slug}` once orderSlug is known via session reconcile.
  const { data: fullOrderData } = useOrderBySlug(session?.orderSlug)

  // Reconcile in-memory session with server-side active order.
  // Mirrors src/components/staff/table-order-screen.tsx, but admin lives inside
  // the menu page (no session creation here — admin opens session from /tables),
  // and there is no waiting_payment redirect — admin just keeps the cart in sync.
  useSessionReconciliation({
    tableSlug,
    session: tableSlug ? (sessions[tableSlug] ?? null) : null,
    serverActiveOrder,
    isLoadingActiveOrder,
    isFetchingActiveOrder,
    setOrderSlug,
    replaceSubmittedOrders,
    cancelSession,
    clearPendingItems,
  })

  const { userInfo } = useUserStore()

  // Cổng ca cho bước sang thanh toán:
  //  - CASHIER: phải mở ca của chính mình (kiểm /work-shifts/current).
  //  - MANAGER/ADMIN+: thanh toán hộ chỉ khi chi nhánh có ca ACTIVE
  //    (tức đã có cashier mở ca) — kiểm /work-shifts/active theo branch.
  const { canPay, reason: gateReason } = useBranchShiftGate(
    userInfo?.branch?.slug,
  )
  const { data: tablesData } = useTables(userInfo?.branch?.slug ?? '')
  const tables: Table[] = useMemo(
    () =>
      (tablesData?.result ?? []).map((t) => ({
        id: t.slug,
        label: t.name,
        seats: 4,
        status: t.status as Table['status'],
      })),
    [tablesData],
  )
  const { mutateAsync: createOrderAsync, isPending: isCreatingOrder } =
    useCreateOrder()
  const { mutateAsync: addMultipleAsync, isPending: isAddingMultiple } =
    useAddNewMultipleOrderItems()
  const { mutateAsync: updateOrderItemAsync } = useUpdateOrderItem()
  const { mutateAsync: updateNoteOrderItemAsync } = useUpdateNoteOrderItem()
  const { mutateAsync: deleteOrderItemAsync } = useDeleteOrderItem()
  const { mutateAsync: deleteOrderAsync } = useDeleteOrder()
  // const { mutate: getOrderProvisionalBill, isPending: isExportingBill } =
  //   useGetOrderProvisionalBill()
  const isSubmitting = isCreatingOrder || isAddingMultiple

  const pending = useMemo(
    () => session?.pendingItems ?? [],
    [session?.pendingItems],
  )
  const submitted = useMemo(
    () => session?.submittedOrders?.flatMap((o) => o.items) ?? [],
    [session?.submittedOrders],
  )

  const allItems = useMemo(
    () => [...submitted, ...pending],
    [submitted, pending],
  )

  // Fallback to BE order data when the local session hasn't captured customer
  // /voucher yet — the reconcile effect only syncs orderSlug + submittedOrders,
  // not owner/voucher. Without this, entering admin-cart-content via
  // "Sửa đơn" shows an empty customer/voucher even though BE has them.
  const sessionCustomer = useMemo(
    () => deriveSessionCustomer(session?.customer, fullOrderData?.owner),
    [session?.customer, fullOrderData?.owner],
  )

  // Build items list for voucher validation: all submitted + pending items.
  const { allVoucherItems, voucherSubtotal } = useVoucherDerivedItems(allItems, pending)

  const {
    appliedVoucher: sessionVoucher,
    applyVoucher: applyVoucherHook,
    removeVoucher: removeVoucherHook,
    onAutoRemoved,
  } = useVoucherState({
    tableSlug,
    orderSlug: session?.orderSlug,
    items: allVoucherItems,
    hasCustomerOwner: !!sessionCustomer,
    subtotalAfterPromotion:
      voucherSubtotal.subTotalBeforeDiscount - voucherSubtotal.promotionDiscount,
    beVoucher: fullOrderData?.voucher ?? null,
  })

  useEffect(() => {
    onAutoRemoved((_reason) => {
      if (sessionVoucher) {
        showErrorToastMessage(
          tToast('toast.voucherAutoRemovedInvalid', {
            code: sessionVoucher.code,
          }),
        )
      }
    })
  }, [onAutoRemoved, sessionVoucher, tToast])

  const handleApplyVoucher = async (voucher: IVoucher) => {
    await applyVoucherHook(voucher)
    const current =
      useTableSessionsStore.getState().sessions[tableSlug]?.voucher ?? null
    if (current?.slug === voucher.slug) {
      showToast(tToast('toast.applyVoucherSuccess'))
    } else {
      showErrorToastMessage(tToast('toast.applyVoucherFailed'))
    }
  }

  const handleRemoveVoucher = async () => {
    const before = useTableSessionsStore.getState().sessions[tableSlug]?.voucher ?? null
    if (!before) return
    await removeVoucherHook()
    const current =
      useTableSessionsStore.getState().sessions[tableSlug]?.voucher ?? null
    if (current === null) {
      showToast(tToast('toast.removeVoucherSuccess'))
    } else {
      showErrorToastMessage(tToast('toast.removeVoucherFailed'))
    }
  }

  // Promotion-aware totals + submitted orders total.
  // pendingTotals includes sessionVoucher; submittedTotal does NOT
  // (voucher applied at BE payment step).
  const { pendingTotals, submittedTotal, grandTotal } =
    usePendingSubmittedTotals(
      pending,
      session?.submittedOrders ?? [],
      sessionVoucher,
    )

  const breakdown = useMemo(
    () =>
      computeOrderBreakdown(serverActiveOrder, sessionVoucher, {
        subTotalBeforeDiscount: pendingTotals.subTotalBeforeDiscount,
        promotionDiscount: pendingTotals.promotionDiscount,
        finalTotal: pendingTotals.finalTotal,
      }),
    [serverActiveOrder, sessionVoucher, pendingTotals],
  )

  if (!tableSlug || !session) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-sm text-pos-muted">
        <ShoppingCart className="h-12 w-12 text-pos-muted/40" />
        <p>{t('order.noTableSelected')}</p>
      </div>
    )
  }

  const handleSubmitBatch = async () => {
    if (pending.length === 0) return

    const apiItemsPayload = buildCreateOrderItems(pending)
    if (apiItemsPayload.length === 0) return

    try {
      if (!session.orderSlug) {
        const data = await createOrderAsync({
          type: OrderTypeEnum.AT_TABLE,
          table: tableSlug,
          branch: userInfo?.branch?.slug ?? '',
          owner: session.customer?.slug ?? userInfo?.slug ?? '',
          approvalBy: userInfo?.slug ?? '',
          description: session.description ?? '',
          orderItems: apiItemsPayload,
          voucher: session.voucher?.slug ?? null,
        })

        // Backfill orderItemSlug from response before submitOrder moves items to submitted.
        for (const apiItem of data.result.orderItems) {
          setPendingItemOrderItemSlug(
            tableSlug,
            apiItem.variant.slug,
            apiItem.slug,
          )
        }
        setOrderSlug(tableSlug, data.result.slug)
      } else {
        const apiItems = pending.filter((i) => i.variantSlug)
        if (apiItems.length > 0) {
          const payload = apiItems.map((item) =>
            buildAddOrderItemPayload(item, session.orderSlug!),
          )
          const data = await addMultipleAsync(payload)
          const newVariantSlugs = new Set(apiItems.map((i) => i.variantSlug))
          for (const apiItem of data.result) {
            if (newVariantSlugs.has(apiItem.variant.slug)) {
              setPendingItemOrderItemSlug(
                tableSlug,
                apiItem.variant.slug,
                apiItem.slug,
              )
            }
          }
        }
      }
      submitOrder(tableSlug)
      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.activeOrderByTable, tableSlug],
      })
      setConfirmOpen(false)
      showToast(tToast('toast.createOrderSuccess'))
    } catch {
      showErrorToastMessage(tToast('toast.createOrderReject'))
    }
  }

  const handleGoToPayment = () => {
    // Chặn cứng: chưa mở ca (cashier) / chi nhánh chưa có ca (manager+) thì
    // không cho sang màn thanh toán.
    if (!canPay) return
    requestPayment(tableSlug)
    navigate(`/system/table/${tableSlug}/payment`)
  }

  const handleTransferred = (newTable: { id: string; label: string }) => {
    const currentSession = sessions[tableSlug]
    if (!currentSession) return
    transferSession(tableSlug, newTable.id, newTable.label)
    if (currentSession.orderSlug) {
      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.activeOrderByTable, tableSlug],
      })
      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.activeOrderByTable, newTable.id],
      })
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.tables] })
    }
    showToast(tToast('toast.transferTableSuccess'))
    // Update URL to point to new table — keeps cart panel in sync
    setSearchParams({ tab: 'menu', table: newTable.id }, { replace: true })
  }

  const requiresTransferConfirm = !!(
    session.orderSlug || session.submittedOrders.length > 0
  )

  // Per-row submitted item changes. Each change targets exactly one
  // orderItemSlug — SubmittedOrdersDialog now keeps rows independent.
  const handleSubmittedChanges = async (
    changes: Array<{
      orderItemSlug: string
      newQty: number
      newNote?: string
    }>,
  ) => {
    if (!session?.orderSlug) return

    try {
      for (const { orderItemSlug, newQty, newNote } of changes) {
        const item = session.submittedOrders
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

      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.activeOrderByTable, tableSlug],
      })
      showToast(tToast('toast.updateOrderSuccess'))
    } catch {
      showErrorToastMessage(tToast('toast.updateOrderFailed'))
    }
  }

  const handleCancelOrder = async () => {
    if (!session?.orderSlug) return
    try {
      await deleteOrderAsync(session.orderSlug)
      cancelSession(tableSlug)
      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.activeOrderByTable, tableSlug],
      })
      showToast(tToast('toast.cancelOrderSuccess'))
      // Navigate back to table picker (cart panel shows empty state after)
      navigate(ROUTE.STAFF_MENU)
    } catch {
      showErrorToastMessage(tToast('toast.cancelOrderFailed'))
    }
  }

  return (
    <div className="flex h-full w-full flex-col pb-2">
      <AdminCartHeader
        tableName={session.tableName}
        tableSlug={tableSlug}
        tables={tables}
        sessions={sessions}
        sessionStatus={session.status}
        orderSlug={session.orderSlug ?? null}
        requiresTransferConfirm={requiresTransferConfirm}
        assistBannerVisible={assistBannerVisible}
        assistOrderSlug={assistOrderSlug}
        onTransfer={handleTransferred}
        onDismissAssistBanner={dismissAssistBanner}
      />

      <Tabs defaultValue="items" className="flex min-h-0 flex-1 flex-col">
        <TabsList
          variant="line"
          className="mx-3 mt-2 grid shrink-0 grid-cols-2"
        >
          <TabsTrigger value="items">Món</TabsTrigger>
          <TabsTrigger value="info">Khách</TabsTrigger>
        </TabsList>

        <AdminCartPendingItemsList
          pending={pending}
          submitted={submitted}
          submittedOrders={session.submittedOrders}
          submittedTotal={submittedTotal}
          sessionVoucher={sessionVoucher}
          serverActiveOrder={serverActiveOrder}
          onUpdateItem={(id, patch) => updateItem(tableSlug, id, patch)}
          onUpdateNote={(id, note) => updateItem(tableSlug, id, { note })}
          onRemoveItem={(id) => removeItem(tableSlug, id)}
          onClearPending={() => clearPendingItems(tableSlug)}
          onSubmittedChanges={handleSubmittedChanges}
          onCancelOrder={handleCancelOrder}
        />

        <AdminCartInfoTab
          sessionCustomer={sessionCustomer}
          sessionVoucher={sessionVoucher}
          pendingItems={session.pendingItems}
          submittedItems={session.submittedOrders.flatMap((o) => o.items)}
          onSelectCustomer={(c) => { void selectCustomer(c) }}
          onClearCustomer={() => setClearCustomerOpen(true)}
          onApplyVoucher={handleApplyVoucher}
          onRemoveVoucher={handleRemoveVoucher}
        />
      </Tabs>

      <div className="space-y-3 border-t px-2 pt-3">
        <div>
          <label className="text-xs text-pos-muted" htmlFor="admin-cart-note">
            {t('order.note')}
          </label>
          <textarea
            id="admin-cart-note"
            value={session.description ?? ''}
            onChange={(e) => setOrderDescription(tableSlug, e.target.value)}
            placeholder={t('order.notePlaceholder')}
            className="mt-1 min-h-[60px] w-full resize-none rounded-md border border-pos-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pos-gold"
          />
        </div>

        <AdminCartBreakdownPanel breakdown={breakdown} />

        <span data-testid="admin-grand-total" className="hidden">
          {formatCurrency(grandTotal)}
        </span>

        {/* {(session.submittedOrders ?? []).length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!session?.orderSlug || isExportingBill}
            onClick={() => {
              const slug = session?.orderSlug
              if (!slug) return
              getOrderProvisionalBill(slug, {
                onSuccess: (data: Blob) => {
                  showToast(tToast('toast.exportOrderProvisionalBillSuccess'))
                  loadDataToPrinter(data)
                },
              })
            }}
          >
            {isExportingBill && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('order.draftReceipt')}
          </Button>
        )} */}
        {/* Note chặn thanh toán khi chưa mở ca — hiện khi đã có đơn để thanh
            toán nhưng cổng ca đang chặn. */}
        {submitted.length > 0 && !canPay && (
          <ShiftGateBanner reason={gateReason} className="mb-2" />
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={pending.length === 0 || isSubmitting}
            onClick={() => setConfirmOpen(true)}
          >
            {isSubmitting ? t('order.submitting') : t('order.submit')}
          </Button>
          <Button
            disabled={submitted.length === 0 || !canPay}
            onClick={handleGoToPayment}
            className="bg-pos-gold text-white hover:bg-pos-gold/90"
          >
            {t('order.continueToPayment')}
          </Button>
        </div>
      </div>

      <AdminCartConfirmSubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        pendingItems={pending}
        pendingTotalFinal={pendingTotals.finalTotal}
        isSubmitting={isSubmitting}
        onConfirm={handleSubmitBatch}
      />

      <ConfirmClearCustomerDialog
        open={clearCustomerOpen}
        onOpenChange={setClearCustomerOpen}
        staffName={
          `${userInfo?.firstName ?? ''} ${userInfo?.lastName ?? ''}`.trim() ||
          'nhân viên'
        }
        onConfirm={() => { void selectCustomer(null) }}
      />
    </div>
  )
}
