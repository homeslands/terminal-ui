import _ from 'lodash'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Clock,
  Loader2,
  MapPin,
  Notebook,
  Phone,
  Receipt,
  ShoppingCart,
  User,
} from 'lucide-react'

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ScrollArea,
} from '@/components/ui'

import { ICreateOrderRequest, OrderTypeEnum } from '@/types'
import { useCreateOrder, useCreateOrderWithoutLogin } from '@/hooks'
import {
  calculateCartItemDisplay,
  calculateCartTotals,
  formatCurrency,
  parseKm,
  showErrorToast,
  showToast,
  useCalculateDeliveryFee,
} from '@/utils'
import { Role, ROUTE, PHONE_NUMBER_REGEX } from '@/constants'
import {
  useUserStore,
  useBranchStore,
  useUpdateOrderStore,
  useOrderFlowStore,
  IOrderingData,
} from '@/stores'
import { OrderItemPrice } from '@/components/app/order-item-price'
import { getItemPriceDisplay } from '@/lib/order-item-display'

interface IPlaceOrderDialogProps {
  onSuccess?: () => void
  disabled?: boolean | undefined
  disabledText?: string
  onSuccessfulOrder?: () => void
}

export default function PlaceOrderDialog({
  disabled,
  disabledText,
  onSuccessfulOrder,
  onSuccess,
}: IPlaceOrderDialogProps) {
  const navigate = useNavigate()
  const { t } = useTranslation(['menu'])
  const { t: tCommon } = useTranslation('common')
  const { t: tToast } = useTranslation('toast')
  const { orderingData, transitionToPayment } = useOrderFlowStore()
  const { clearStore: clearUpdateOrderStore } = useUpdateOrderStore()
  const { mutate: createOrder, isPending } = useCreateOrder()
  const { mutate: createOrderWithoutLogin, isPending: isPendingWithoutLogin } =
    useCreateOrderWithoutLogin()
  const [isOpen, setIsOpen] = useState(false)
  const { getUserInfo, userInfo } = useUserStore()
  const { branch } = useBranchStore()

  const order = orderingData

  const displayItems = calculateCartItemDisplay(order, order?.voucher || null)

  // check if userInfo is not exist or userInfo.role.name === Role.CUSTOMER, then use branch?.slug, otherwise use userInfo?.branch?.slug
  const branchSlug =
    !userInfo || userInfo.role.name === Role.CUSTOMER
      ? branch?.slug
      : userInfo.branch?.slug

  const cartTotals = calculateCartTotals(displayItems, order?.voucher || null)
  const deliveryFee = useCalculateDeliveryFee(
    parseKm(order?.deliveryDistance) || 0,
    branchSlug || '',
  )

  const handleSubmit = (order: IOrderingData) => {
    if (!order) return

    if (!branchSlug) {
      showErrorToast(11000)
      return
    }

    // Validate delivery case
    if (order.type === OrderTypeEnum.DELIVERY) {
      const phoneOk =
        !!order.deliveryPhone && PHONE_NUMBER_REGEX.test(order.deliveryPhone)
      if (!order.deliveryAddress || !phoneOk) {
        showErrorToast(119000)
        return
      }
    }

    const createOrderRequest: ICreateOrderRequest = {
      type: order.type,
      timeLeftTakeOut: order.timeLeftTakeOut || 0,
      deliveryTo: order.deliveryPlaceId || '',
      deliveryPhone: order.deliveryPhone || '',
      table: order.table || '',
      branch: branchSlug,
      owner: order.owner || getUserInfo()?.slug || '',
      approvalBy: getUserInfo()?.slug || '',
      orderItems: order.orderItems.map((orderItem) => ({
        quantity: orderItem.quantity,
        variant: orderItem.variant.slug,
        promotion: orderItem.isCustomPrice
          ? null
          : orderItem.promotion
            ? orderItem.promotion.slug
            : null,
        note: orderItem.note || '',
        ...(orderItem.isCustomPrice && orderItem.customPrice !== undefined
          ? { customPrice: orderItem.customPrice }
          : {}),
      })),
      voucher: order.voucher?.slug || null,
      description: order.description || '',
    }

    // Call API to create order
    if (userInfo) {
      createOrder(createOrderRequest, {
        onSuccess: (data) => {
          const orderPath =
            userInfo?.role.name === Role.CUSTOMER
              ? `${ROUTE.CLIENT_PAYMENT}?order=${data.result.slug}`
              : `${ROUTE.STAFF_ORDER_PAYMENT}?order=${data.result.slug}`

          onSuccess?.()

          // ✅ Chuyển sang payment phase với order slug
          transitionToPayment(data.result.slug)

          navigate(orderPath)
          setIsOpen(false)
          onSuccessfulOrder?.()
          clearUpdateOrderStore()
          showToast(tToast('toast.createOrderSuccess'))
        },
      })
    } else {
      createOrderWithoutLogin(createOrderRequest, {
        onSuccess: (data) => {
          onSuccess?.()

          // ✅ Chuyển sang payment phase với order slug
          transitionToPayment(data.result.slug)

          navigate(`${ROUTE.CLIENT_PAYMENT}?order=${data.result.slug}`)
          setIsOpen(false)
          onSuccessfulOrder?.()
          clearUpdateOrderStore()
          showToast(tToast('toast.createOrderSuccess'))
        },
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled || isPending || isPendingWithoutLogin}
          className="flex w-full items-center rounded-full text-sm"
          onClick={() => setIsOpen(true)}
        >
          {isPending ||
            (isPendingWithoutLogin && (
              <Loader2 className="h-4 w-4 animate-spin" />
            ))}
          {(() => {
            if (disabled && disabledText) return disabledText
            if (order?.type === OrderTypeEnum.AT_TABLE) {
              return order?.table
                ? t('order.create')
                : t('menu.noSelectedTable')
            }
            if (order?.type === OrderTypeEnum.DELIVERY) {
              const phoneOk =
                !!order.deliveryPhone &&
                PHONE_NUMBER_REGEX.test(order.deliveryPhone)
              return order?.deliveryAddress && phoneOk
                ? t('order.create')
                : t('menu.deliveryInfoMissing')
            }
            return t('order.create')
          })()}
        </Button>
      </DialogTrigger>

      <DialogContent className="h-[calc(100vh-8rem)] max-w-[22rem] gap-0 rounded-md p-0 sm:h-[calc(100vh-10rem)] sm:max-w-[48rem]">
        <DialogHeader className="h-fit p-4">
          <DialogTitle className="border-b pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 p-1 text-primary">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              {t('order.create')}
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('order.confirmOrder')}
          </DialogDescription>
        </DialogHeader>

        {/* Order Items List */}
        <ScrollArea className="flex h-[calc(100vh-30rem)] flex-col gap-4 px-4 sm:max-h-[calc(100vh-16rem)]">
          {/* Order Info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4" />
                {t('order.orderType')}
              </span>
              <Badge
                className={`shadow-none ${order?.type === OrderTypeEnum.AT_TABLE ? '' : 'bg-blue-500/20 text-blue-500'}`}
              >
                {order?.type === OrderTypeEnum.AT_TABLE
                  ? t('menu.dineIn')
                  : order?.type === OrderTypeEnum.DELIVERY
                    ? t('menu.delivery')
                    : t('menu.takeAway')}
              </Badge>
            </div>
            {order?.timeLeftTakeOut !== undefined && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {t('menu.pickupTime')}
                </span>
                <Badge className="font-medium">
                  {order.timeLeftTakeOut === 0
                    ? t('menu.immediately')
                    : `${order.timeLeftTakeOut} ${t('menu.minutes')}`}
                </Badge>
              </div>
            )}
            {order?.tableName && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {t('menu.tableName')}
                </span>
                <span className="font-medium">{order.tableName}</span>
              </div>
            )}
            {order?.type === OrderTypeEnum.DELIVERY &&
              order?.deliveryAddress && (
                <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {t('menu.deliveryAddress')}
                  </span>
                  <span
                    className="max-w-[70%] whitespace-normal break-words text-right font-medium"
                    title={order.deliveryAddress}
                  >
                    {order.deliveryAddress}
                  </span>
                </div>
              )}
            {order?.type === OrderTypeEnum.DELIVERY && order?.deliveryPhone && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {t('menu.deliveryPhone')}
                </span>
                <span className="font-medium">{order.deliveryPhone}</span>
              </div>
            )}
            {order?.ownerFullName && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  {t('order.customer')}
                </span>
                <span className="font-medium">{order.ownerFullName}</span>
              </div>
            )}
            {order?.ownerPhoneNumber && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {t('order.phoneNumber')}
                </span>
                <span className="font-medium">{order.ownerPhoneNumber}</span>
              </div>
            )}
            {order?.description && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Notebook className="h-4 w-4" />
                  {t('order.note')}
                </span>
                <span className="font-medium">{order.description}</span>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-dashed border-muted-foreground/60 px-2 py-4">
            {order?.orderItems.map((item, index) => {
              const priceDisplay = getItemPriceDisplay(
                {
                  unitPrice: item.originalPrice ?? 0,
                  quantity: item.quantity,
                  productSlug: item.productSlug ?? item.slug,
                  promotionValue: item.promotion?.value,
                  isCustomPrice: item.isCustomPrice,
                  customPrice: item.customPrice,
                },
                order?.voucher || null,
              )
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="font-bold">{item.name}</p>
                    <div className="flex gap-2">
                      <Badge
                        className="w-fit text-xs text-muted-foreground"
                        variant="outline"
                      >
                        Size {item.size.toUpperCase()}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        x{item.quantity}
                      </p>
                    </div>
                  </div>
                  <OrderItemPrice
                    originalPrice={priceDisplay.originalPrice}
                    finalPrice={priceDisplay.finalPrice}
                    showStrikethrough={priceDisplay.showStrikethrough}
                    promoLabel={priceDisplay.promoLabel}
                    voucherLabel={priceDisplay.voucherLabel}
                    formatter={formatCurrency}
                    className="w-28"
                  />
                </div>
              )
            })}
          </div>
        </ScrollArea>
        <DialogFooter className="h-fit p-4">
          {/* Total Amount */}
          <div className="flex w-full flex-col items-start justify-start gap-1">
            <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
              {t('order.subtotal')}:&nbsp;
              <span>{`${formatCurrency(cartTotals.subTotalBeforeDiscount)}`}</span>
            </div>
            {cartTotals.promotionDiscount > 0 && (
              <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="italic text-yellow-600">
                  {t('order.promotionDiscount')}:&nbsp;
                </span>
                <span className="italic text-yellow-600">
                  -{`${formatCurrency(cartTotals.promotionDiscount)}`}
                </span>
              </div>
            )}
            <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="italic text-green-500">
                {t('order.voucher')}:&nbsp;
              </span>
              <span className="italic text-green-500">
                -{`${formatCurrency(cartTotals.voucherDiscount)}`}
              </span>
            </div>
            {order?.type === OrderTypeEnum.DELIVERY && (
              <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="italic text-muted-foreground">
                  {t('order.deliveryFee')}:&nbsp;
                </span>
                <span className="italic text-muted-foreground">
                  {`${formatCurrency(deliveryFee?.deliveryFee)}`}
                </span>
              </div>
            )}
            <div className="text-md mt-4 flex w-full items-center justify-between gap-2 border-t pt-2 font-semibold">
              <span>{t('order.totalPayment')}:&nbsp;</span>
              <span className="text-2xl font-extrabold text-primary">
                {`${formatCurrency(cartTotals.finalTotal + deliveryFee?.deliveryFee)}`}
              </span>
            </div>
            <div className="mt-4 flex w-full flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="min-w-24 border border-gray-300"
                disabled={isPending || isPendingWithoutLogin}
              >
                {tCommon('common.cancel')}
              </Button>
              {(() => {
                const isDelivery = order?.type === OrderTypeEnum.DELIVERY
                const phoneOk =
                  !!order?.deliveryPhone &&
                  PHONE_NUMBER_REGEX.test(order.deliveryPhone || '')
                const createDisabled =
                  isPending ||
                  isPendingWithoutLogin ||
                  (isDelivery && (!order?.deliveryAddress || !phoneOk))
                return (
                  <Button
                    onClick={() => {
                      if (order) {
                        handleSubmit(order)
                      }
                    }}
                    disabled={createDisabled}
                  >
                    {isPending ||
                      (isPendingWithoutLogin && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ))}
                    {t('order.create')}
                  </Button>
                )
              })()}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
