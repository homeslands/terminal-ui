import { useEffect, useMemo } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, DownloadIcon, Info, Loader2 } from 'lucide-react'

import {
  useBranchShiftGate,
  useExportOrderInvoice,
  useOrderBySlug,
} from '@/hooks'
import { useTableSessions } from '@/hooks/useTableSessions'
import { ShiftGateBanner } from '@/components/work-shift/shift-gate-banner'
import { IOrder, OrderStatus, OrderTypeEnum } from '@/types'
import {
  Button,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import {
  calculateOrderItemDisplay,
  calculatePlacedOrderTotals,
  capitalizeFirstLetter,
  formatCurrency,
  loadDataToPrinter,
  showErrorToast,
  showErrorToastMessage,
  showToast,
} from '@/utils'
import { OrderStatusBadge, PaymentStatusBadge } from '../badge'
import {
  APPLICABILITY_RULE,
  PaymentMethod,
  ROUTE,
  VOUCHER_TYPE,
} from '@/constants'

interface IOrderHistoryDetailSheetProps {
  order: IOrder | null
  isOpen: boolean
  onClose: () => void
}

export default function OrderHistoryDetailSheet({
  order,
  isOpen,
  onClose,
}: IOrderHistoryDetailSheetProps) {
  const { t: tCommon } = useTranslation(['common'])
  const { t } = useTranslation(['menu'])
  const { t: tToast } = useTranslation('toast')
  const navigate = useNavigate()
  const { openSession } = useTableSessions()
  const { mutate: exportOrderInvoice, isPending } = useExportOrderInvoice()

  const { data, refetch } = useOrderBySlug(order?.slug as string)
  const orderDetail = data

  // Cổng ca: cashier chưa mở ca (hoặc chi nhánh chưa có ca ACTIVE) thì không
  // được đi tiếp sang thanh toán — chặn ngay ở bước bấm, không đợi tới màn pay.
  const { canPay, reason: gateReason } = useBranchShiftGate(orderDetail?.branch)

  const orderItems = orderDetail?.orderItems || []
  const voucher = orderDetail?.voucher || null
  const deliveryFee = orderDetail?.deliveryFee || 0
  const accumulatedPointsToUse = orderDetail?.accumulatedPointsToUse || 0

  const hasCustomPriceItems = orderItems.some(
    (i) => i.variant?.product?.isCustomPrice,
  )
  const customPriceTotal = hasCustomPriceItems
    ? orderItems.reduce((sum, i) => sum + (i.customPrice ?? 0) * i.quantity, 0)
    : 0

  const displayItems = calculateOrderItemDisplay(orderItems, voucher)

  const cartTotals = calculatePlacedOrderTotals(
    displayItems,
    voucher,
    deliveryFee,
    accumulatedPointsToUse,
  )

  // Use BE-computed per-line VAT (already accounts for voucher/promotion side-effects).
  const totalVatAmount = useMemo(() => {
    if (!orderDetail?.orderItems?.length) return 0
    return orderDetail.orderItems.reduce(
      (sum, item) => sum + (item.vatValue ?? 0),
      0,
    )
  }, [orderDetail])

  // polling useOrderBySlug every 3 seconds — only for non-terminal statuses
  // (pending/shipping still need refresh; paid/completed/failed are terminal —
  // once paid there is nothing left to poll for a settled order).
  useEffect(() => {
    if (!orderDetail) return
    // Skip polling for terminal statuses — no further updates expected
    const terminalStatuses: OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.COMPLETED,
      OrderStatus.FAILED,
    ]
    if (terminalStatuses.includes(orderDetail.status)) return

    const interval = setInterval(async () => {
      try {
        await refetch()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        /* empty */
      }
    }, 3000)

    return () => clearInterval(interval) // Cleanup
  }, [orderDetail, refetch])

  // Invoice chỉ xuất được khi đơn đã ở trạng thái "đã thanh toán" trở lên.
  // BE trả lỗi 1010024 ("Order is not paid") nếu vẫn pending — disable + tooltip
  // để chặn UX, vẫn giữ onError xử lý fallback khi BE đổi rule.
  const exportableStatuses: OrderStatus[] = [
    OrderStatus.PAID,
    OrderStatus.SHIPPING,
    OrderStatus.COMPLETED,
  ]
  const canExportInvoice = !!orderDetail && exportableStatuses.includes(orderDetail.status)

  // Đơn chưa thanh toán (PENDING) + có bàn → cho tiếp tục thêm món / thanh toán
  // qua luồng đặt hộ ở /system/menu.
  const canContinueOrder =
    !!orderDetail &&
    orderDetail.status === OrderStatus.PENDING &&
    !!orderDetail.table?.slug
  const handleContinueOrder = () => {
    if (!orderDetail?.table?.slug || !orderDetail.slug) return
    // Chặn cứng: chưa mở ca thì không cho sang luồng thêm món/thanh toán.
    if (!canPay) return
    const tableSlug = orderDetail.table.slug
    // Phải mở session TRƯỚC khi điều hướng — admin cart chỉ hydrate đơn từ
    // server vào session đã tồn tại (reconciliation bỏ qua nếu chưa có session).
    // Không có bước này thì cart rỗng dù đơn vẫn active trên server.
    openSession(tableSlug, orderDetail.table.name ?? tableSlug)
    onClose()
    navigate(
      `${ROUTE.STAFF_MENU}?tab=menu&table=${tableSlug}&assistOrder=${orderDetail.slug}`,
    )
  }
  const exportDisabledReason = !orderDetail
    ? tCommon('common.noData')
    : !canExportInvoice
      ? t('order.cannotExportUnpaid')
      : ''

  const handleExportOrderInvoice = async (order: IOrder | undefined) => {
    if (!order) return
    if (!canExportInvoice) {
      showErrorToastMessage(tToast('toast.cannotExportUnpaid'))
      return
    }
    exportOrderInvoice(order.slug || '', {
      onSuccess: (data: Blob) => {
        showToast(tToast('toast.exportInvoiceSuccess'))
        loadDataToPrinter(data)
      },
      onError: (err: unknown) => {
        const e = err as {
          response?: { data?: { statusCode?: number; message?: string } }
          message?: string
        }
        const code = e?.response?.data?.statusCode
        if (typeof code === 'number') {
          showErrorToast(code)
          return
        }
        showErrorToastMessage(
          e?.response?.data?.message ||
            e?.message ||
            tToast('toast.exportInvoiceFailed'),
        )
      },
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="flex w-full flex-col p-2">
        <SheetHeader className="shrink-0">
          <SheetTitle className="mt-8 flex items-center gap-2">
            {t('order.orderDetail')}
            <span className="text-muted-foreground">#{order?.slug}</span>
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4 pr-3">
          {orderDetail ? (
            <div className="flex flex-col gap-4">
              {/* Info */}
              <div className="flex w-full flex-col gap-4">
                {/* Order info */}
                <div className="flex items-center justify-between rounded-sm border p-3">
                  <div className="flex w-full flex-col gap-2">
                    <p className="flex items-center gap-2 pb-2">
                      <span className="font-bold">{t('order.order')} </span>{' '}
                      <span className="text-primary">#{orderDetail?.slug}</span>
                      <OrderStatusBadge order={orderDetail || undefined} />
                    </p>
                    <div className="flex items-center gap-1 text-sm font-thin">
                      <p>
                        {moment(orderDetail?.createdAt).format(
                          'hh:mm:ss DD/MM/YYYY',
                        )}
                      </p>{' '}
                      |
                      <p className="flex items-center gap-1">
                        <span>{t('order.cashier')} </span>
                        <span className="text-muted-foreground">
                          {`${orderDetail?.approvalBy?.firstName} ${orderDetail?.approvalBy?.lastName} - ${orderDetail?.approvalBy?.phonenumber}`}
                        </span>
                      </p>
                    </div>
                    {orderDetail?.type === OrderTypeEnum.DELIVERY && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold">
                          {t('order.deliveryAddress')}:{' '}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {orderDetail?.deliveryTo?.formattedAddress}
                        </span>
                      </div>
                    )}
                    {orderDetail?.type === OrderTypeEnum.DELIVERY && (
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold">
                          {t('order.deliveryPhone')}:{' '}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {orderDetail?.deliveryPhone}
                        </span>
                      </div>
                    )}
                    {orderDetail?.description ? (
                      <div className="flex w-full items-center text-sm">
                        <h3 className="w-20 text-sm font-semibold">
                          {t('order.note')}
                        </h3>
                        <p className="w-full rounded-md border border-muted-foreground/20 p-2">
                          {orderDetail?.description}
                        </p>
                      </div>
                    ) : (
                      <div className="flex w-full items-center text-sm">
                        <h3 className="w-20 text-sm font-semibold">
                          {t('order.note')}
                        </h3>
                        <p className="w-full rounded-md border border-muted-foreground/20 p-2 sm:col-span-8">
                          {t('order.noNote')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Order owner info */}
                <div className="flex gap-2">
                  <div className="w-1/2 rounded-sm border">
                    <div className="px-3 py-2 font-bold uppercase">
                      {t('order.customer')}
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-sm font-bold">
                        {`${orderDetail?.owner?.firstName} ${orderDetail?.owner?.lastName}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {orderDetail?.owner?.phonenumber}
                      </p>
                    </div>
                  </div>
                  <div className="w-1/2 rounded-sm border">
                    <div className="px-3 py-2 font-bold uppercase">
                      {t('order.orderType')}
                    </div>
                    <div className="px-3 py-2 text-sm">
                      <p className="col-span-1 text-sm font-bold">
                        <p className="col-span-1 text-sm">
                          {orderDetail?.type === OrderTypeEnum.AT_TABLE
                            ? t('order.dineIn')
                            : orderDetail?.type === OrderTypeEnum.TAKE_OUT
                              ? `${t('order.takeAway')} - ${
                                  orderDetail?.timeLeftTakeOut === 0
                                    ? t('menu.immediately')
                                    : `${orderDetail?.timeLeftTakeOut} ${t('menu.minutes')}`
                                }`
                              : orderDetail?.type === OrderTypeEnum.DELIVERY
                                ? `${t('order.delivery')}`
                                : t('order.takeAway')}
                        </p>
                      </p>
                      {orderDetail?.type === OrderTypeEnum.AT_TABLE && (
                        <p className="flex gap-1 text-muted-foreground">
                          <span className="col-span-2">
                            {t('order.tableNumber')}
                          </span>
                          <span className="col-span-1">
                            {orderDetail?.table?.name}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {/* payment */}
                <div className="flex w-full flex-col gap-2">
                  {/* Payment method, status */}
                  <div
                    className={`rounded-sm border ${orderDetail?.payment && orderDetail?.payment?.statusMessage === OrderStatus.COMPLETED ? 'border-green-500 bg-green-500/10' : 'border-destructive bg-destructive/10'}`}
                  >
                    <div className="px-3 py-2">
                      <p className="flex flex-col items-start gap-1 pb-2">
                        <span className="col-span-1 text-sm font-bold">
                          {t('paymentMethod.title')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {orderDetail?.payment?.paymentMethod ? (
                            <>
                              {orderDetail?.payment.paymentMethod ===
                                PaymentMethod.BANK_TRANSFER && (
                                <span>{t('paymentMethod.bankTransfer')}</span>
                              )}
                              {orderDetail?.payment.paymentMethod ===
                                PaymentMethod.CASH && (
                                <span>{t('paymentMethod.cash')}</span>
                              )}
                              {orderDetail?.payment.paymentMethod ===
                                PaymentMethod.CREDIT_CARD && (
                                <div className="flex flex-col gap-1">
                                  <span>{t('paymentMethod.creditCard')}</span>
                                  <span>
                                    {t('paymentMethod.transactionId')}:{' '}
                                    {orderDetail?.payment?.transactionId}
                                  </span>
                                </div>
                              )}
                              {orderDetail?.payment.paymentMethod ===
                                PaymentMethod.POINT && (
                                <span>{t('paymentMethod.point')}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {t('order.pending')}
                            </span>
                          )}
                        </span>
                      </p>
                      <p className="flex items-center gap-1">
                        <span className="col-span-1 text-sm font-semibold">
                          {t('paymentMethod.status')}
                        </span>
                        <span className="col-span-1 text-sm">
                          {orderDetail?.payment ? (
                            <PaymentStatusBadge
                              status={orderDetail?.payment?.statusCode}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t('order.pending')}
                            </span>
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                  {/* Total */}
                </div>
                {/* Order table */}
                <div className="overflow-x-auto">
                  {/* Desktop Table */}
                  <Table className="hidden min-w-full table-fixed border-collapse border sm:table">
                    <TableCaption>{t('order.orderListCaption')}</TableCaption>

                    <TableHeader className="bg-muted-foreground/10 dark:bg-transparent">
                      <TableRow>
                        <TableHead className="w-1/4">
                          {t('order.product')}
                        </TableHead>
                        <TableHead className="w-[120px] text-center">
                          {t('order.size')}
                        </TableHead>
                        <TableHead className="w-[120px] text-center">
                          {t('order.quantity')}
                        </TableHead>
                        <TableHead className="w-1/4">
                          {t('order.note')}
                        </TableHead>
                        <TableHead className="w-[120px] text-right">
                          {t('order.unitPrice')}
                        </TableHead>
                        <TableHead className="w-[80px] text-center">
                          VAT
                        </TableHead>
                        <TableHead className="w-[120px] text-right">
                          {t('order.grandTotal')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {orderDetail?.orderItems?.map((item) => {
                        return (
                          <TableRow
                            key={item.slug}
                            className="border-b border-gray-200 dark:border-gray-700"
                          >
                            <TableCell className="truncate font-semibold">
                              <span className="max-w-[150px] truncate">
                                {item.variant?.product.name}
                              </span>
                            </TableCell>

                            <TableCell className="text-center">
                              {capitalizeFirstLetter(
                                item.variant?.size?.name || '',
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {item.quantity}
                            </TableCell>

                            <TableCell className="max-w-[180px] break-words text-sm text-muted-foreground">
                              {item.note || t('order.noNote')}
                            </TableCell>

                            <TableCell className="text-right">
                              <span className="inline-block w-28 font-medium tabular-nums text-foreground">
                                {formatCurrency(item.variant?.price ?? 0)}
                              </span>
                            </TableCell>

                            <TableCell className="text-center">
                              <span className="text-sm font-medium">
                                {(() => {
                                  const vatRate =
                                    item.vatRate ??
                                    item.variant?.product?.vatRate ??
                                    0
                                  return vatRate > 0 ? `${vatRate}%` : '—'
                                })()}
                              </span>
                            </TableCell>

                            <TableCell className="whitespace-nowrap text-right font-extrabold text-primary">
                              {formatCurrency(
                                item.isCustomPrice
                                  ? (item.customPrice ?? 0)
                                  : item.subtotal,
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>

                  {/* Mobile Card Layout */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    <h3 className="text-center text-sm font-medium text-muted-foreground">
                      {t('order.orderListCaption')}
                    </h3>
                    {orderDetail?.orderItems?.map((item) => {
                      return (
                        <div
                          key={item.slug}
                          className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                        >
                          {/* Product Name */}
                          <div className="mb-2 flex items-start justify-between">
                            <h4 className="flex-1 pr-2 text-sm font-semibold">
                              {item.variant?.product.name}
                            </h4>
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                              {capitalizeFirstLetter(
                                item.variant?.size?.name || '',
                              )}
                            </span>
                          </div>

                          {/* Quantity and Price Row */}
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">
                                {t('order.quantity')}:
                              </span>
                              <span className="text-sm font-medium">
                                {item.quantity}
                              </span>
                            </div>
                            <span className="min-w-[80px] text-right text-sm font-medium tabular-nums text-foreground">
                              {formatCurrency(item.variant?.price ?? 0)}
                            </span>
                          </div>

                          {/* VAT Row */}
                          {(() => {
                            const vatRate =
                              item.vatRate ??
                              item.variant?.product?.vatRate ??
                              0
                            return vatRate > 0 ? (
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  VAT:
                                </span>
                                <span className="text-xs font-medium">
                                  {vatRate}%
                                </span>
                              </div>
                            ) : null
                          })()}

                          {/* Note */}
                          {item.note && (
                            <div className="mb-2">
                              <span className="text-xs text-muted-foreground">
                                {t('order.note')}:{' '}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.note}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2 rounded-sm border p-2">
                  {!hasCustomPriceItems &&
                    (() => {
                      const subTotal = cartTotals?.subTotalBeforeDiscount || 0
                      const promo = cartTotals?.promotionDiscount || 0
                      const voucherDisc = cartTotals?.voucherDiscount || 0
                      const preVatTotal = Math.max(
                        0,
                        subTotal - promo - voucherDisc,
                      )

                      const vatRates = orderItems
                        .map(
                          (it) =>
                            it.vatRate ?? it.variant?.product?.vatRate ?? 0,
                        )
                        .filter((r) => r > 0)
                      const uniqueRates = [...new Set(vatRates)]
                      const vatRateLabel =
                        uniqueRates.length === 1
                          ? `VAT (${uniqueRates[0]}%)`
                          : 'VAT'

                      const hasItemsWithPromotion = orderItems.some(
                        (it) => (it.promotion?.value ?? 0) > 0,
                      )
                      const voucherDropsPromotion =
                        !!voucher &&
                        (voucher.applicabilityRule ===
                          APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED ||
                          voucher.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT)
                      const isPromoDroppedByVoucher =
                        hasItemsWithPromotion &&
                        voucherDropsPromotion &&
                        promo === 0
                      const showPromotionRow =
                        promo > 0 || isPromoDroppedByVoucher

                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                              {t('order.subtotal')}
                            </p>
                            <p className="tabular-nums text-muted-foreground">{`${formatCurrency(subTotal)}`}</p>
                          </div>
                          {showPromotionRow && (
                            <div className="flex items-center justify-between">
                              <p
                                className={`inline-flex items-center gap-1 text-sm italic ${
                                  isPromoDroppedByVoucher
                                    ? 'text-muted-foreground'
                                    : 'text-green-500'
                                }`}
                              >
                                {t('order.promotionDiscount')}
                                {isPromoDroppedByVoucher && (
                                  <TooltipProvider delayDuration={150}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs"
                                      >
                                        Khuyến mãi không áp dụng khi món đang dùng
                                        voucher
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </p>
                              <p
                                className={`text-sm italic tabular-nums ${
                                  isPromoDroppedByVoucher
                                    ? 'text-muted-foreground'
                                    : 'text-green-500'
                                }`}
                              >{`- ${formatCurrency(promo)}`}</p>
                            </div>
                          )}
                          {orderDetail?.voucher && (
                            <div className="flex w-full justify-between">
                              <h3 className="text-sm font-medium italic text-green-500">
                                {t('order.voucher')} ({voucher?.title})
                              </h3>
                              <p className="text-sm font-semibold italic tabular-nums text-green-500">
                                - {`${formatCurrency(voucherDisc)}`}
                              </p>
                            </div>
                          )}
                          {orderDetail &&
                            orderDetail?.accumulatedPointsToUse > 0 && (
                              <div className="flex w-full justify-between">
                                <h3 className="text-sm font-medium italic text-primary">
                                  {t('order.loyaltyPoint')}
                                </h3>
                                <p className="text-sm font-semibold italic tabular-nums text-primary">
                                  -{' '}
                                  {`${formatCurrency(orderDetail?.accumulatedPointsToUse || 0)}`}
                                </p>
                              </div>
                            )}
                          {orderDetail?.type === OrderTypeEnum.DELIVERY && (
                            <div className="flex w-full justify-between">
                              <h3 className="text-sm font-medium italic text-muted-foreground/60">
                                {t('order.deliveryFee')}
                              </h3>
                              <p className="text-sm font-semibold italic tabular-nums text-muted-foreground/60">
                                {`${formatCurrency(orderDetail?.deliveryFee || 0)}`}
                              </p>
                            </div>
                          )}
                          {orderDetail?.loss > 0 && (
                            <div className="flex w-full justify-between">
                              <h3 className="text-sm font-medium italic text-green-500">
                                {t('order.invoiceAutoDiscountUnderThreshold')}
                              </h3>
                              <p className="text-sm font-semibold italic tabular-nums text-green-500">
                                - {`${formatCurrency(orderDetail?.loss || 0)}`}
                              </p>
                            </div>
                          )}
                          {/* P1: Tạm tính sau giảm */}
                          <div className="flex w-full items-center justify-between border-t pt-2">
                            <p className="text-sm font-semibold">
                              Tạm tính sau giảm
                            </p>
                            <p className="text-sm font-semibold tabular-nums">
                              {formatCurrency(preVatTotal)}
                            </p>
                          </div>
                          {/* P1: VAT */}
                          {totalVatAmount > 0 && (
                            <div className="flex w-full items-center justify-between">
                              <p className="text-sm italic text-muted-foreground">
                                {vatRateLabel}
                              </p>
                              <p className="text-sm italic tabular-nums text-muted-foreground">
                                +{formatCurrency(totalVatAmount)}
                              </p>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  <div className="mt-1 flex flex-col items-end gap-0.5 border-t pt-2">
                    <div className="flex w-full items-center justify-between">
                      <p className="text-md font-bold">
                        {t('order.totalPayment')}
                      </p>
                      <p className="text-xl font-bold tabular-nums text-primary">
                        {formatCurrency(
                          hasCustomPriceItems
                            ? customPriceTotal
                            : orderDetail?.subtotal || 0,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="flex min-h-[12rem] items-center justify-center text-muted-foreground">
              {tCommon('common.noData')}
            </p>
          )}
        </div>
        <SheetFooter className="shrink-0">
          <div className="flex w-full flex-col gap-2">
            {/* Note chặn thanh toán khi chưa mở ca — chỉ hiện cho đơn còn tiếp
                tục được và người dùng đang bị cổng ca chặn. */}
            {canContinueOrder && !canPay && (
              <ShiftGateBanner reason={gateReason} />
            )}
            <div
              className={`grid w-full gap-2 ${canContinueOrder ? 'grid-cols-2' : 'grid-cols-1'}`}
            >
              {canContinueOrder && (
                <Button
                  variant="outline"
                  onClick={handleContinueOrder}
                  disabled={!canPay}
                  className="w-full gap-2 disabled:opacity-50"
                >
                  {t('order.continueOrder')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <Button
                      className="w-full gap-2"
                      onClick={() => handleExportOrderInvoice(orderDetail)}
                      disabled={isPending || !canExportInvoice}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('order.exporting')}
                        </>
                      ) : (
                        <>
                          <DownloadIcon className="h-4 w-4" />
                          {t('order.exportInvoice')}
                        </>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {exportDisabledReason && !isPending && (
                  <TooltipContent side="top">
                    {exportDisabledReason}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            {/* {showAssistButton && (
              <Button
                onClick={() => {
                  onClose()
                  navigate(
                    `/system/menu?tab=menu&table=${order!.table.slug}&assistOrder=${order!.slug}`,
                  )
                }}
                className="w-full bg-pos-gold text-white hover:bg-pos-gold/80"
              >
                Sửa đơn
              </Button>
            )} */}
            {/* <ShowInvoiceDialog order={order} /> */}
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
