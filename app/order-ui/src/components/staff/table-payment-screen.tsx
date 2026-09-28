import { useMemo, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PaymentPanel } from '@/components/staff/payment-panel'
import { PaymentSuccessScreen } from '@/components/staff/payment-success-screen'
import { ConfirmCancelDialog } from '@/components/staff/confirm-cancel-dialog'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { StaffCustomerSearchInput } from '@/components/staff/staff-customer-search-input'
import { StaffTableVoucherSheet } from '@/components/staff/staff-table-voucher-sheet'
import ConfirmClearCustomerDialog from '@/components/app/dialog/confirm-clear-customer-dialog'
import { TablePaymentHeader } from '@/components/staff/table-payment-header'
import { TablePaymentSummary } from '@/components/staff/table-payment-summary'
import { useTablePaymentSession } from '@/components/staff/hooks/use-table-payment-session'
import { useTableSessions } from '@/hooks/useTableSessions'
import { useOwnerSync } from '@/hooks/use-owner-sync'
import {
  useDeleteOrder,
  useOrderBySlug,
} from '@/hooks'
import { useVoucherState } from '@/hooks/use-voucher-state'
import { useTableSessionsStore, useUserStore } from '@/stores'
import { mergeOrderItems } from '@/lib/staff-orders'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import { formatVnd } from '@/data/staff-data'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { OrderStatus, type IVoucher } from '@/types'
import {
  showErrorToast,
  showErrorToastMessage,
  showToast,
} from '@/utils'
import type { OrderItem, TableCustomer } from '@/types/session'
import { useState } from 'react'
import { Role } from '@/constants'

export interface TablePaymentScreenProps {
  /**
   * Custom back handler. Default: navigate to /staff/table/:id (order screen).
   * Admin: navigate to /system/table/:id.
   */
  onBack?: () => void
  /**
   * Hide PosPageHeader. Admin uses SystemLayout breadcrumb instead.
   */
  hideHeader?: boolean
  /**
   * Override the back-to-order-screen path. Default: /staff/table/:id.
   * Admin: /system/table/:id.
   */
  tableOrderPath?: (tableId: string) => string
  /**
   * Called after payment success. Default: navigate to /staff.
   * Admin: navigate to /system/tables.
   */
  onPaymentSuccess?: () => void
}

export function TablePaymentScreen({
  onBack,
  hideHeader = false,
  tableOrderPath = (tableId) => `/staff/table/${tableId}`,
  onPaymentSuccess,
}: TablePaymentScreenProps) {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t: tToast } = useTranslation('toast')
  const { t: tMenu } = useTranslation('menu')
  const { sessions, closeSession, cancelSession } = useTableSessions()
  // Override session.orderSlug khi URL có `?order=` — tránh race với session
  // stale từ luồng trước (vd: vừa thanh toán đơn cũ, mở payment cho đơn mới ở
  // cùng bàn → session vẫn cache slug đơn cũ → page load nhầm).
  const [searchParams] = useSearchParams()
  const orderSlugFromUrl = searchParams.get('order')

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [clearCustomerOpen, setClearCustomerOpen] = useState(false)

  const session = sessions[id]
  const orderSlug = orderSlugFromUrl ?? session?.orderSlug

  const { selectCustomer } = useOwnerSync({ tableId: id, orderSlug })

  const { data: orderData, refetch: refetchOrder } = useOrderBySlug(orderSlug)
  const { mutate: deleteOrderMutate, isPending: isCancelling } =
    useDeleteOrder()

  // Customer is set in the Info tab on the cart/order screen — payment screen is
  // read-only for customer. Voucher is still editable here (cashier flow), but
  // session is the source of truth.
  const selectedCustomer = session?.customer ?? null

  // Voucher validation prefers BE-persisted owner (truth) when it is a real
  // customer account. Fallback to session.customer for the UI input flow so
  // newly-picked customers work immediately before owner-sync PATCH lands.
  const isBECustomerOwner =
    !!orderData?.owner &&
    orderData.owner.role?.name === Role.CUSTOMER &&
    orderData.owner.phonenumber !== 'default-customer'

  const effectiveCustomer: TableCustomer | null = useMemo(() => {
    if (isBECustomerOwner && orderData?.owner) {
      return {
        slug: orderData.owner.slug,
        firstName: orderData.owner.firstName ?? '',
        lastName: orderData.owner.lastName ?? '',
        phonenumber: orderData.owner.phonenumber ?? '',
      }
    }
    return selectedCustomer
  }, [isBECustomerOwner, orderData?.owner, selectedCustomer])

  const merged = useMemo(
    () => mergeOrderItems(session?.submittedOrders ?? []),
    [session?.submittedOrders],
  )

  // Source of truth for voucher eligibility queries: use BE order items
  // (full fields: variantSlug, promotion, vatRate, productSlug). Local merged
  // items strip these fields, leading to incomplete eligible filter.
  const orderItemsForVoucher = useMemo<OrderItem[]>(() => {
    return (orderData?.orderItems ?? []).map((it) => ({
      menuItemId: it.variant.product.slug,
      productSlug: it.variant.product.slug,
      variantSlug: it.variant.slug,
      name: it.variant.product.name,
      priceNum: it.variant.price,
      price: formatVnd(it.variant.price),
      originalPrice: it.variant.price,
      quantity: it.quantity,
      note: it.note ?? '',
      promotion: it.promotion
        ? { slug: it.promotion.slug, value: it.promotion.value }
        : null,
      vatRate: it.variant.product.vatRate ?? 0,
    }))
  }, [orderData?.orderItems])

  // FE-side fallback when orderData not loaded yet (session-only state).
  const feTotal = useMemo(
    () => merged.reduce((s, m) => s + m.priceNum * m.quantity, 0),
    [merged],
  )
  const feSubTotalBeforeDiscount = useMemo(
    () =>
      merged.reduce(
        (s, m) =>
          s +
          (m.isCustomPrice ? m.priceNum : (m.originalPrice ?? m.priceNum)) *
            m.quantity,
        0,
      ),
    [merged],
  )

  // Sum VAT from BE-computed vatValue per item (BE-authoritative).
  const totalVatAmount = useMemo(() => {
    if (!orderData?.orderItems?.length) return 0
    return orderData.orderItems.reduce(
      (sum, item) => sum + ((item as { vatValue?: number }).vatValue ?? 0),
      0,
    )
  }, [orderData?.orderItems])

  // BE-authoritative subtotal (pre-promotion, pre-VAT) when available.
  const subTotalBeforeDiscount =
    orderData?.originalSubtotal ?? feSubTotalBeforeDiscount

  // Promotion discount computed from BE items when available.
  // Skip items where voucher overrides promotion per cart math policy:
  //  - SAME_PRICE_PRODUCT voucher: voucher sets price, promotion dropped on eligible items
  //  - PERCENT_ORDER + AT_LEAST_ONE_REQUIRED: voucher % on original, promotion dropped on eligible
  // (FIXED_VALUE + AT_LEAST stacks correctly after VPV-1 fix, so promotion is kept there.)
  const promotionDiscount = useMemo(() => {
    if (!orderData?.orderItems?.length) {
      return Math.max(0, feSubTotalBeforeDiscount - feTotal)
    }
    const voucher = orderData.voucher
    const voucherAllowedSlugs =
      voucher?.voucherProducts?.map((vp) => vp.product?.slug) ?? []
    // BE policy: AT_LEAST_ONE_REQUIRED voucher drops promotion on eligible items
    // (verified empirically — both PERCENT_ORDER and FIXED_VALUE).
    // SAME_PRICE_PRODUCT also overrides promotion via direct price replacement.
    const voucherDropsPromotion =
      voucher?.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT ||
      voucher?.applicabilityRule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED

    return orderData.orderItems.reduce((sum, it) => {
      const applied =
        (it as { isAppliedPromotion?: boolean }).isAppliedPromotion ??
        !!it.promotion
      if (!applied || !it.promotion) return sum
      // Skip promotion for items where voucher overrides
      if (voucherDropsPromotion) {
        const productSlug = it.variant?.product?.slug
        if (productSlug && voucherAllowedSlugs.includes(productSlug)) return sum
      }
      const unitDiscount =
        ((it.variant?.price ?? 0) * (it.promotion.value ?? 0)) / 100
      return sum + Math.round(unitDiscount * it.quantity)
    }, 0)
  }, [
    orderData?.orderItems,
    orderData?.voucher,
    feSubTotalBeforeDiscount,
    feTotal,
  ])

  // Items for voucher validation: prefer BE order items (source of truth for
  // what's on the order); fall back to local session items if BE not loaded yet.
  const voucherItems = orderItemsForVoucher.length > 0 ? orderItemsForVoucher : merged

  const {
    appliedVoucher: selectedVoucher,
    applyVoucher: applyVoucherHook,
    removeVoucher: removeVoucherHook,
    onAutoRemoved,
  } = useVoucherState({
    tableSlug: id,
    orderSlug,
    items: voucherItems,
    hasCustomerOwner: !!effectiveCustomer,
    subtotalAfterPromotion: subTotalBeforeDiscount - promotionDiscount,
    beVoucher: orderData?.voucher ?? null,
  })

  // Final total — BE-authoritative `subtotal` (post-promotion + VAT + post-voucher).
  // Fallback to FE cart math when BE order hasn't loaded yet.
  const totalWithDiscount = useMemo(() => {
    // BE quirk: custom-price orders trả về subtotal=0, originalSubtotal=customPrice*qty.
    // Ưu tiên subtotal khi >0 (post-voucher final), fallback originalSubtotal khi BE
    // báo subtotal=0 (custom-price case) trước khi rơi xuống FE math.
    if (typeof orderData?.subtotal === 'number' && orderData.subtotal > 0) {
      return orderData.subtotal
    }
    if (
      typeof orderData?.originalSubtotal === 'number' &&
      orderData.originalSubtotal > 0
    ) {
      return orderData.originalSubtotal
    }
    if (selectedVoucher) {
      const cart = staffItemsToCartItem(merged)
      const display = calculateCartItemDisplay(cart, selectedVoucher)
      return calculateCartTotals(display, selectedVoucher).finalTotal
    }
    return feTotal
  }, [
    orderData?.subtotal,
    orderData?.originalSubtotal,
    selectedVoucher,
    merged,
    feTotal,
  ])

  // Voucher discount = remaining gap after subtotal - promotion + VAT - subtotal(final).
  // Only meaningful when a voucher is applied on BE.
  const voucherDiscount = useMemo(() => {
    if (!orderData?.voucher) return 0
    const beforeVoucher =
      subTotalBeforeDiscount - promotionDiscount + (totalVatAmount ?? 0)
    return Math.max(0, beforeVoucher - totalWithDiscount)
  }, [
    orderData?.voucher,
    subTotalBeforeDiscount,
    promotionDiscount,
    totalVatAmount,
    totalWithDiscount,
  ])

  // CC-6: Order is no longer editable once it reaches a terminal state.
  // `OrderStatus` exposes PAID + FAILED (FAILED maps to "cancelled" semantics
  // since this codebase deletes cancelled orders instead of using a dedicated
  // CANCELLED status). When the order isn't editable, the customer search and
  // voucher sheet are locked to prevent doomed mutations + a banner explains why.
  const isOrderEditable = useMemo(() => {
    const status = orderData?.status
    return status !== OrderStatus.PAID && status !== OrderStatus.FAILED
  }, [orderData?.status])

  useEffect(() => {
    onAutoRemoved((_reason) => {
      if (selectedVoucher) {
        showErrorToastMessage(
          tToast('toast.voucherAutoRemovedInvalid', {
            code: selectedVoucher.code,
          }),
        )
      }
    })
  }, [onAutoRemoved, selectedVoucher, tToast])

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
    const before = useTableSessionsStore.getState().sessions[id]?.voucher ?? null
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

  // Payment session hook — pure logic, no rendering
  const {
    tab,
    amount,
    qrCode,
    isLoading,
    initError,
    isPrinting,
    isPaid,
    setAmount,
    handleTabChange,
    handleConfirm,
    triggerInitiateTransfer,
    onPrintProvisional,
  } = useTablePaymentSession({
    orderSlug,
    isOrderEditable,
    refetchOrder,
    orderData,
    selectedVoucher,
    effectiveCustomer,
  })

  // P1: Pre-VAT (post-discount) subtotal for cashier math verification.
  const preVatTotal = Math.max(
    0,
    subTotalBeforeDiscount - promotionDiscount - voucherDiscount,
  )

  if (isPaid && session) {
    const cashChange =
      tab === 'cash' && amount > totalWithDiscount
        ? amount - totalWithDiscount
        : undefined
    return (
      <PaymentSuccessScreen
        tableName={session.tableName}
        total={totalWithDiscount}
        paymentMethod={tab}
        amount={tab === 'cash' ? amount : undefined}
        change={cashChange}
        onBackToFloor={() => {
          closeSession(id)
          if (onPaymentSuccess) {
            onPaymentSuccess()
          } else {
            navigate('/staff')
          }
        }}
      />
    )
  }

  if (!session) {
    return <PosNotFoundState message="Không tìm thấy phiên thanh toán." />
  }

  if (!orderSlug) {
    return (
      <PosNotFoundState message="Chưa có đơn hàng. Vui lòng gửi đơn trước khi thanh toán." />
    )
  }

  return (
    <div className="flex h-full flex-col bg-pos-card text-pos-text">
      <TablePaymentHeader
        hideHeader={hideHeader}
        id={id}
        session={session}
        orderData={orderData}
        onBack={onBack}
        tableOrderPath={tableOrderPath}
      />

      <main className="grid min-h-0 flex-1 grid-cols-2">
        {/* Left: order detail */}
        <TablePaymentSummary
          hideHeader={hideHeader}
          onBack={onBack}
          session={session}
          orderData={orderData}
          merged={merged}
          selectedVoucher={selectedVoucher}
          subTotalBeforeDiscount={subTotalBeforeDiscount}
          promotionDiscount={promotionDiscount}
          voucherDiscount={voucherDiscount}
          preVatTotal={preVatTotal}
          totalVatAmount={totalVatAmount}
          totalWithDiscount={totalWithDiscount}
          onCancel={() => setConfirmCancel(true)}
        />

        {/* Right: payment panel — hero action area */}
        <div className="min-h-0 overflow-y-auto border-l-2 border-pos-gold/20 bg-pos-card p-2">
          <PaymentPanel
            total={totalWithDiscount}
            tab={tab}
            onTabChange={handleTabChange}
            onConfirm={handleConfirm}
            qrCode={qrCode}
            isLoading={isLoading}
            amount={amount}
            onAmountChange={setAmount}
            initError={initError}
            onRetryInit={() => { void triggerInitiateTransfer() }}
            onPrintProvisional={onPrintProvisional}
            isPrinting={isPrinting}
            customerSlot={
              <>
                {!isOrderEditable && (
                  <div className="mb-2 rounded border-l-4 border-amber-500 bg-amber-100/60 px-3 py-2 text-xs text-amber-800">
                    {tMenu('order.paidOrderReadonly')}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <StaffCustomerSearchInput
                    customer={effectiveCustomer}
                    onSelect={(c) => { void selectCustomer(c) }}
                    onClear={() => setClearCustomerOpen(true)}
                    disabled={!isOrderEditable}
                  />
                  <StaffTableVoucherSheet
                    pendingItems={[]}
                    submittedItems={orderItemsForVoucher}
                    customer={effectiveCustomer}
                    appliedVoucher={selectedVoucher}
                    onApply={handleApplyVoucher}
                    onRemove={handleRemoveVoucher}
                    disabled={!isOrderEditable}
                  />
                </div>
              </>
            }
          />
        </div>
      </main>

      <ConfirmCancelDialog
        open={confirmCancel}
        isPending={isCancelling}
        onConfirm={() => {
          deleteOrderMutate(orderSlug, {
            onSuccess: () => {
              cancelSession(id)
              setConfirmCancel(false)
              showToast(tToast('toast.cancelOrderSuccess'))
              if (onPaymentSuccess) {
                onPaymentSuccess()
              } else {
                navigate('/staff')
              }
            },
            onError: (err) => {
              const data = (
                err as {
                  response?: {
                    data?: { statusCode?: number; errorCodeValue?: number }
                  }
                }
              )?.response?.data
              const code = data?.statusCode ?? data?.errorCodeValue
              if (typeof code === 'number') showErrorToast(code)
              else showErrorToastMessage(tToast('toast.cancelOrderFailedRetry'))
            },
          })
        }}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmClearCustomerDialog
        open={clearCustomerOpen}
        onOpenChange={setClearCustomerOpen}
        staffName={
          `${useUserStore.getState().userInfo?.firstName ?? ''} ${
            useUserStore.getState().userInfo?.lastName ?? ''
          }`.trim() || 'nhân viên'
        }
        onConfirm={() => {
          void selectCustomer(null)
        }}
      />
    </div>
  )
}
