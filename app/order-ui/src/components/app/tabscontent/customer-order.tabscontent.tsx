import { NavLink, useNavigate } from 'react-router-dom'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'

import { useOrders, usePagination } from '@/hooks'
import { useUpdateOrderStore, useUserStore } from '@/stores'
import { publicFileURL, ROUTE } from '@/constants'
import OrderStatusBadge from '@/components/app/badge/order-status-badge'
import { IOrder, OrderStatus } from '@/types'
import { OrderHistorySkeleton } from '@/components/app/skeleton'
import {
  calculateOrderItemDisplay,
  calculatePlacedOrderTotals,
  capitalizeFirstLetter,
  formatCurrency,
  showErrorToast,
} from '@/utils'
import { CancelOrderDialog } from '@/components/app/dialog'

export default function CustomerOrderTabsContent() {
  const { t } = useTranslation(['menu'])
  const { t: tProfile } = useTranslation(['profile'])

  const navigate = useNavigate()
  const { userInfo, getUserInfo } = useUserStore()
  const { pagination, handlePageChange } = usePagination()
  const { setOrderItems } = useUpdateOrderStore()
  const [status, setStatus] = useState<OrderStatus>(OrderStatus.ALL)
  const { data: order, isLoading } = useOrders({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    owner: userInfo?.slug,
    order: 'DESC',
    hasPaging: true,
    status: status === OrderStatus.ALL ? undefined : status,
  })

  const deliveryFee =
    order?.items?.reduce((acc, item) => acc + (item.deliveryFee || 0), 0) || 0
  const accumulatedPointsToUse =
    order?.items?.reduce(
      (acc, item) => acc + (item.accumulatedPointsToUse || 0),
      0,
    ) || 0

  const handleUpdateOrder = (order: IOrder) => {
    if (!getUserInfo()?.slug)
      return (showErrorToast(1042), navigate(ROUTE.LOGIN))
    setOrderItems(order)
    navigate(`${ROUTE.CLIENT_UPDATE_ORDER}/${order.slug}`)
  }

  if (isLoading) {
    return <OrderHistorySkeleton />
  }

  return (
    <div>
      {/* Status Filter */}
      <div className="mb-4 flex justify-end">
        <Select
          value={status}
          onValueChange={(value: OrderStatus) => setStatus(value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('order.selectStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OrderStatus.ALL}>
              {tProfile('profile.all')}
            </SelectItem>
            <SelectItem value={OrderStatus.SHIPPING}>
              {tProfile('profile.shipping')}
            </SelectItem>
            <SelectItem value={OrderStatus.COMPLETED}>
              {tProfile('profile.completed')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {order?.items.length ? (
        <div className="flex flex-col gap-4">
          {order.items.map((orderItem) => {
            const orderItems = orderItem.orderItems || []
            const voucher = orderItem.voucher || null
            const displayItems = calculateOrderItemDisplay(orderItems, voucher)
            const cartTotals = calculatePlacedOrderTotals(
              displayItems,
              voucher,
              deliveryFee,
              accumulatedPointsToUse,
            )
            return (
              <div
                key={orderItem.slug}
                className="mt-2 flex flex-col gap-4 rounded-lg border bg-white p-0 dark:bg-muted-foreground/10"
              >
                <div className="flex w-full items-center gap-4 border-b bg-primary/15 p-4 dark:bg-muted-foreground/10">
                  <span className="text-xs text-muted-foreground">
                    {moment(orderItem.createdAt).format('HH:mm:ss DD/MM/YYYY')}
                  </span>
                  <OrderStatusBadge order={orderItem} />
                </div>

                <div className="px-4 pb-4">
                  <div className="flex flex-col divide-y">
                    {orderItems.map((product) => (
                      <div
                        key={product.slug}
                        className="grid grid-cols-12 gap-2 py-4"
                      >
                        <div className="relative col-span-3 sm:col-span-2">
                          <img
                            src={`${publicFileURL}/${product.variant.product.image}`}
                            alt={product.variant.product.name}
                            className="h-16 rounded-md object-cover sm:h-28 sm:w-36"
                          />
                          <div className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white sm:-right-4 sm:h-10 sm:w-10 sm:text-sm lg:right-4 xl:-right-4">
                            x{product.quantity}
                          </div>
                        </div>
                        <div className="col-span-9 flex flex-col justify-between sm:col-span-10">
                          <div className="flex flex-col gap-1">
                            <span className="flex flex-col gap-1 truncate text-sm font-semibold sm:flex-row sm:text-base">
                              {product.variant.product.name}{' '}
                              <Badge
                                variant="outline"
                                className="w-fit border-primary bg-primary/10 text-xs text-primary"
                              >
                                {capitalizeFirstLetter(
                                  product.variant.size.name,
                                )}
                              </Badge>
                            </span>
                          </div>
                          <div className="flex w-full justify-end">
                            <span className="min-w-[80px] text-right text-sm font-medium tabular-nums text-foreground">
                              {formatCurrency(product.variant.price ?? 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex w-full justify-end">
                    <div className="flex w-full flex-col justify-end gap-2 sm:w-[28rem]">
                      <div className="flex w-full justify-between border-b pb-2">
                        <h3 className="text-sm font-semibold">
                          {t('order.total')}
                        </h3>
                        <p className="text-sm font-semibold">
                          {`${formatCurrency(orderItem?.originalSubtotal || 0)}`}
                        </p>
                      </div>
                      <div className="flex w-full justify-between border-b pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          {t('order.promotionDiscount')}
                        </h3>
                        <p className="text-sm font-semibold text-muted-foreground">
                          -{' '}
                          {`${formatCurrency(cartTotals?.promotionDiscount || 0)}`}
                        </p>
                      </div>
                      <div className="flex w-full justify-between border-b pb-2">
                        <h3 className="text-sm font-medium italic text-green-500">
                          {t('order.voucher')}
                        </h3>
                        <p className="text-sm font-semibold italic text-green-500">
                          -{' '}
                          {`${formatCurrency(cartTotals?.voucherDiscount || 0)}`}
                        </p>
                      </div>
                      <div className="flex w-full justify-between border-b pb-4">
                        <h3 className="text-sm font-medium italic text-primary">
                          {t('order.loyaltyPoint')}
                        </h3>
                        <p className="text-sm font-semibold italic text-primary">
                          -{' '}
                          {`${formatCurrency(orderItem?.accumulatedPointsToUse || 0)}`}
                        </p>
                      </div>
                      <div className="flex w-full justify-between border-b pb-4">
                        <h3 className="text-sm font-medium italic text-muted-foreground/60">
                          {t('order.deliveryFee')}
                        </h3>
                        <p className="text-sm font-semibold italic text-muted-foreground/60">
                          {`${formatCurrency(orderItem?.deliveryFee || 0)}`}
                        </p>
                      </div>
                      {orderItem && orderItem?.loss > 0 && (
                        <div className="flex w-full justify-between pb-4">
                          <h3 className="text-sm font-medium italic text-green-500">
                            {t('order.invoiceAutoDiscountUnderThreshold')}
                          </h3>
                          <p className="text-sm font-semibold italic text-green-500">
                            - {`${formatCurrency(orderItem?.loss)}`}
                          </p>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex w-full justify-between">
                          <h3 className="text-md font-semibold">
                            {t('order.totalPayment')}
                          </h3>
                          <p className="text-lg font-extrabold text-primary">
                            {`${formatCurrency(orderItem?.subtotal || 0)}`}
                          </p>
                        </div>

                        {/* <span className="text-xs text-muted-foreground">
                      ({t('order.vat')})
                    </span> */}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-4 sm:flex-row">
                    <NavLink
                      to={`${ROUTE.CLIENT_ORDER_HISTORY}?order=${orderItem.slug}`}
                    >
                      <Button>{t('order.viewDetail')}</Button>
                    </NavLink>
                    {orderItem.status === OrderStatus.PENDING && (
                      <div className="flex gap-2 sm:mt-0">
                        <CancelOrderDialog order={orderItem} />
                        <Button
                          disabled={moment(orderItem.createdAt).isBefore(
                            moment().subtract(15, 'minutes'),
                          )}
                          className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                          variant="outline"
                          onClick={() => handleUpdateOrder(orderItem)}
                        >
                          {t('order.updateOrder')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex h-[50vh] items-center justify-center text-center">
          {t('order.noOrders')}
        </div>
      )}

      {order && order?.totalPages > 0 && (
        <div className="flex items-center justify-center space-x-2 py-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(pagination.pageIndex - 1)}
                  className={
                    !order?.hasPrevious
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink isActive>{order?.page}</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(pagination.pageIndex + 1)}
                  className={
                    !order?.hasNext
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
