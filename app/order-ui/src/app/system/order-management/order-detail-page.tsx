import { useNavigate, useParams } from 'react-router-dom'
import moment from 'moment'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Info, SquareMenu } from 'lucide-react'

import {
  Button,
  Separator,
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
import { useOrderBySlug } from '@/hooks'
import { APPLICABILITY_RULE, publicFileURL, VOUCHER_TYPE } from '@/constants'
import OrderStatusBadge from '@/components/app/badge/order-status-badge'
import { OrderTypeEnum } from '@/types'
import PaymentStatusBadge from '@/components/app/badge/payment-status-badge'
import { formatCurrency } from '@/utils'
import { ShowInvoiceDialog } from '@/components/app/dialog'

export default function OrderDetailPage() {
  const { t } = useTranslation(['menu'])
  const { t: tHelmet } = useTranslation('helmet')
  const { t: tCommon } = useTranslation('common')
  const { slug } = useParams()
  const { data: orderDetail } = useOrderBySlug(slug as string)
  const navigate = useNavigate()

  const orderInfo = orderDetail

  const originalTotal = orderInfo
    ? orderInfo?.orderItems.reduce(
        (sum, item) => sum + item.variant.price * item.quantity,
        0,
      )
    : 0
  // const totalBeforeDiscount = orderInfo
  //   ? orderInfo.orderItems.reduce((sum, item) => sum + item.subtotal, 0)
  //   : 0;

  const discount = orderInfo
    ? orderInfo.orderItems.reduce(
        (sum, item) =>
          sum +
          (item.promotion
            ? item.variant.price * item.quantity * (item.promotion.value / 100)
            : 0),
        0,
      )
    : 0

  return (
    <div className="mb-10">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.orderDetail.title')}</title>
        <meta
          name="description"
          content={tHelmet('helmet.orderDetail.title')}
        />
      </Helmet>
      <div className="flex flex-col gap-2">
        {/* Title */}
        <div className="top-0 z-10 flex flex-col items-center gap-2 pb-4">
          <span className="flex w-full items-center justify-start gap-1 text-lg">
            <SquareMenu />
            {t('order.orderDetail')}{' '}
            <span className="text-muted-foreground">#{orderInfo?.slug}</span>
          </span>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Left, info */}
          <div className="flex w-full flex-col gap-4 lg:w-3/5">
            {/* Order info */}
            <div className="flex items-center justify-between rounded-sm border p-3">
              <div className="">
                <p className="flex items-center gap-2 pb-2">
                  <span className="font-bold">{t('order.order')} </span>{' '}
                  <span className="text-primary">#{orderInfo?.slug}</span>
                  <OrderStatusBadge order={orderInfo || undefined} />
                </p>
                <div className="flex items-center gap-1 text-sm font-thin">
                  <p>
                    {moment(orderInfo?.createdAt).format('hh:mm:ss DD/MM/YYYY')}
                  </p>{' '}
                  |
                  <p className="flex items-center gap-1">
                    <span>{t('order.cashier')} </span>
                    <span className="text-muted-foreground">
                      {`${orderInfo?.approvalBy?.firstName} ${orderInfo?.approvalBy?.lastName} - ${orderInfo?.approvalBy?.phonenumber}`}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            {/* Order owner info */}
            <div className="flex min-h-[8.3rem] gap-2">
              <div className="w-1/2 rounded-sm border">
                <div className="px-3 py-2 font-bold uppercase">
                  {t('order.customer')}
                </div>
                <div className="px-3 py-2 text-xs sm:text-sm">
                  <p className="font-bold">
                    {`${orderInfo?.owner?.firstName} ${orderInfo?.owner?.lastName}`}
                  </p>
                  <p className="text-muted-foreground">
                    {orderInfo?.owner?.phonenumber}
                  </p>
                </div>
              </div>
              <div className="w-1/2 rounded-sm border">
                <div className="px-3 py-2 font-bold uppercase">
                  {t('order.orderType')}
                </div>
                <div className="px-3 py-2 text-sm">
                  <p>
                    {orderInfo?.type === OrderTypeEnum.AT_TABLE
                      ? t('order.dineIn')
                      : t('order.takeAway')}
                  </p>
                  {orderInfo?.type === OrderTypeEnum.AT_TABLE && (
                    <p className="flex gap-1">
                      <span className="col-span-2">
                        {t('order.tableNumber')}
                      </span>
                      <span className="col-span-1">
                        {orderInfo?.table?.name}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
            {orderInfo?.description && (
              <div className="flex w-full items-center text-sm">
                <h3 className="w-20 text-sm font-semibold">
                  {t('order.note')}
                </h3>
                <p className="w-full rounded-md border border-muted-foreground/20 p-2 sm:col-span-8">
                  {orderInfo?.description}
                </p>
              </div>
            )}
          </div>

          {/* Right, payment*/}
          <div className="flex w-full flex-col gap-3 lg:w-2/5">
            {/* Payment method, status */}
            <div className="rounded-sm border">
              <div className="px-3 py-2">
                <p className="flex flex-col items-start gap-1 pb-2">
                  <span className="col-span-1 text-sm font-bold sm:text-lg">
                    {t('paymentMethod.title')}
                  </span>
                  <span className="text-xs text-muted-foreground sm:text-sm">
                    {orderInfo?.payment?.paymentMethod ? (
                      <>
                        {orderInfo?.payment.paymentMethod ===
                          'bank-transfer' && (
                          <span className="flex items-center gap-1">
                            {t('paymentMethod.bankTransfer')}
                            {orderInfo?.payment ? (
                              <PaymentStatusBadge
                                status={orderInfo?.payment?.statusCode}
                              />
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                {t('order.pending')}
                                <PaymentStatusBadge
                                  status={orderInfo?.payment?.statusCode}
                                />
                              </span>
                            )}
                          </span>
                        )}
                        {orderInfo?.payment.paymentMethod === 'cash' && (
                          <span className="flex items-center gap-1">
                            {t('paymentMethod.cash')}
                            <PaymentStatusBadge
                              status={orderInfo?.payment?.statusCode}
                            />
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground sm:text-sm">
                        {t('order.pending')}
                      </span>
                    )}
                  </span>
                </p>
              </div>
            </div>
            {/* Total */}
            <div className="flex flex-col gap-2 rounded-sm border p-2">
              {(() => {
                const items = orderInfo?.orderItems ?? []
                const voucher = orderDetail?.voucher
                const voucherDisc = voucher
                  ? (originalTotal - discount) * (voucher.value / 100)
                  : 0
                const preVatTotal = Math.max(
                  0,
                  originalTotal - discount - voucherDisc,
                )

                const totalVatAmount = items.reduce(
                  (sum, it) => sum + (it.vatValue ?? 0),
                  0,
                )

                const vatRates = items
                  .map((it) => it.vatRate ?? it.variant?.product?.vatRate ?? 0)
                  .filter((r) => r > 0)
                const uniqueRates = [...new Set(vatRates)]
                const vatRateLabel =
                  uniqueRates.length === 1 ? `VAT (${uniqueRates[0]}%)` : 'VAT'

                const hasItemsWithPromotion = items.some(
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
                  discount === 0
                const showPromotionRow = discount > 0 || isPromoDroppedByVoucher

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {t('order.subtotal')}
                      </p>
                      <p className="tabular-nums text-muted-foreground">{`${formatCurrency(originalTotal || 0)}`}</p>
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
                          {t('order.discount')}
                          {isPromoDroppedByVoucher && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  Khuyến mãi không áp dụng khi món đang dùng voucher
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
                        >{`- ${formatCurrency(discount || 0)}`}</p>
                      </div>
                    )}
                    {orderDetail?.voucher && (
                      <div className="flex w-full justify-between">
                        <h3 className="text-sm font-medium italic text-green-500">
                          {t('order.voucher')}
                        </h3>
                        <p className="text-sm font-semibold italic tabular-nums text-green-500">
                          - {`${formatCurrency(voucherDisc)}`}
                        </p>
                      </div>
                    )}
                    {/* P1: Tạm tính sau giảm */}
                    <div className="flex items-center justify-between border-t pt-2">
                      <p className="text-sm font-semibold">Tạm tính sau giảm</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(preVatTotal)}
                      </p>
                    </div>
                    {/* P1: VAT */}
                    {totalVatAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm italic text-muted-foreground">
                          {vatRateLabel}
                        </p>
                        <p className="text-sm italic tabular-nums text-muted-foreground">
                          +{formatCurrency(totalVatAmount)}
                        </p>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between">
                      <p className="text-md font-bold">
                        {t('order.totalPayment')}
                      </p>
                      <p className="text-xl font-bold tabular-nums text-primary">{`${formatCurrency(orderInfo?.subtotal || 0)}`}</p>
                    </div>
                  </>
                )
              })()}
            </div>
            {/* Return order button */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="text-muted-foreground"
                onClick={() => {
                  navigate(-1)
                }}
              >
                {tCommon('common.goBack')}
              </Button>
              <ShowInvoiceDialog order={orderInfo || null} />
            </div>
          </div>
        </div>
        {/* Order table */}
        <div className="mt-2 overflow-x-auto">
          <Table className="min-w-full table-auto border-collapse border">
            <TableCaption>A list of orders.</TableCaption>
            <TableHeader
              className={`rounded bg-muted-foreground/10 dark:bg-transparent`}
            >
              <TableRow>
                <TableHead className="">{t('order.product')}</TableHead>
                <TableHead>{t('order.note')}</TableHead>
                <TableHead>{t('order.size')}</TableHead>
                <TableHead>{t('order.quantity')}</TableHead>
                <TableHead className="text-start">
                  {t('order.unitPrice')}
                </TableHead>
                <TableHead className="text-center">VAT</TableHead>
                <TableHead className="text-right">
                  {t('order.grandTotal')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderInfo?.orderItems?.map((item) => (
                <TableRow key={item.slug}>
                  <TableCell className="flex items-center gap-1 font-bold">
                    <img
                      src={`${publicFileURL}/${item.variant.product.image}`}
                      alt={item.variant.product.image}
                      className="h-12 w-20 rounded-lg object-cover sm:h-16 sm:w-24"
                    />
                    {item.variant &&
                      item.variant.product &&
                      item.variant.product.name}
                  </TableCell>
                  <TableCell>{item.note}</TableCell>
                  <TableCell>
                    {item.variant &&
                      item.variant.size &&
                      item.variant.size.name.toUpperCase()}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-block w-28 font-medium tabular-nums text-foreground">
                      {formatCurrency(item?.variant?.price || 0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium">
                      {(() => {
                        const vatRate =
                          item.vatRate ?? item.variant?.product?.vatRate ?? 0
                        return vatRate > 0 ? `${vatRate}%` : '—'
                      })()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-lg font-extrabold text-primary">
                    {`${formatCurrency(item.isCustomPrice ? (item.customPrice ?? 0) : item?.subtotal)}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
