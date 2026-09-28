import _ from 'lodash'
import { Info, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge, Button, Input, ScrollArea } from '@/components/ui'
import {
  OrderTypeInUpdateOrderSelect,
  PickupTimeSelectInUpdateOrder,
} from '@/components/app/select'
import {
  calculateOrderItemDisplay,
  calculatePlacedOrderTotals,
  capitalizeFirstLetter,
  formatCurrency,
  showErrorToastMessage,
  showToast,
  transformOrderItemToOrderDetail,
} from '@/utils'
import { IOrderItem, OrderStatus, OrderTypeEnum } from '@/types'
import { StaffVoucherListSheetInUpdateOrderWithLocalStorage } from '@/components/app/sheet'
import { VOUCHER_TYPE } from '@/constants'
import { OrderItemPrice } from '@/components/app/order-item-price'
import { getItemPriceDisplay } from '@/lib/order-item-display'
import UpdateOrderQuantity from './update-quantity'
import { useOrderFlowStore } from '@/stores'
import {
  OrderItemNoteInUpdateOrderInput,
  OrderNoteInUpdateOrderInput,
} from '@/components/app/input'
import {
  StaffConfirmUpdateOrderDialog,
  DeleteLastOrderItemDialog,
} from '@/components/app/dialog'
import { useIsMobile } from '@/hooks'

function CustomPriceDraftInput({
  customPrice,
  onPriceChange,
}: {
  customPrice?: number
  onPriceChange: (v: number) => void
}) {
  const { t } = useTranslation(['menu'])
  const [raw, setRaw] = useState(
    (customPrice ?? 0) > 0 ? String(customPrice) : '',
  )

  return (
    <Input
      type="number"
      min={0}
      placeholder={t('menu.enterCustomPrice')}
      className="h-7 flex-1 border-orange-300 text-xs focus-visible:ring-orange-400"
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value)
        const parsed = parseFloat(e.target.value)
        if (!isNaN(parsed) && parsed >= 0) onPriceChange(parsed)
        else if (e.target.value === '') onPriceChange(0)
      }}
    />
  )
}

interface UpdateOrderContentProps {
  orderType: OrderTypeEnum
  table: string
}

export default function UpdateOrderContent({
  orderType,
  table,
}: UpdateOrderContentProps) {
  const { t } = useTranslation(['menu'])
  const { t: tVoucher } = useTranslation(['voucher'])
  const { t: tToast } = useTranslation(['toast'])
  const { updatingData, removeDraftItem, removeDraftVoucher, updateDraftItem } =
    useOrderFlowStore()
  const isMobile = useIsMobile()

  // console.log('updatingData', updatingData?.updateDraft?.orderItems)

  const voucher = updatingData?.updateDraft?.voucher || null
  const voucherSlug = voucher?.slug
  const voucherMaxItems = voucher?.maxItems || 0
  const deliveryFee = updatingData?.updateDraft?.deliveryFee || 0
  const accumulatedPointsToUse =
    updatingData?.originalOrder?.accumulatedPointsToUse || 0

  // Memoize orderItems để tránh dependency thay đổi
  const orderItems = useMemo(
    () => updatingData?.updateDraft?.orderItems || [],
    [updatingData?.updateDraft?.orderItems],
  )

  const isGiftItem = useCallback((item: IOrderItem) => {
    const itemWithGift = item as {
      isGift?: boolean
      product?: { isGift?: boolean }
      variant?: { product?: { isGift?: boolean } }
    }
    return (
      itemWithGift.isGift === true ||
      itemWithGift.product?.isGift === true ||
      itemWithGift.variant?.product?.isGift === true
    )
  }, [])

  // console.log('orderItems isGift', orderItems.map(item => isGiftItem(item)))

  const nonGiftOrderItems = useMemo(
    () => orderItems.filter((item) => !isGiftItem(item)),
    [orderItems, isGiftItem],
  )

  // console.log('nonGiftOrderItems', nonGiftOrderItems)
  // Memoize cartItemQuantity để tránh trigger useEffect không cần thiết khi chỉ thêm gift items
  const cartItemQuantity = useMemo(
    () =>
      nonGiftOrderItems.reduce(
        (total, item) => total + (item.quantity || 0),
        0,
      ),
    [nonGiftOrderItems],
  )
  // console.log('cartItemQuantity', cartItemQuantity)

  // Memoize calculations để tránh re-render không cần thiết
  const { cartTotals } = useMemo(() => {
    const transformed = transformOrderItemToOrderDetail(orderItems)
    const display = calculateOrderItemDisplay(transformed, voucher)
    const totals = calculatePlacedOrderTotals(
      display,
      voucher,
      deliveryFee,
      accumulatedPointsToUse,
    )
    return {
      cartTotals: totals,
    }
  }, [orderItems, voucher, deliveryFee, accumulatedPointsToUse])
  // const deliveryFee = useCalculateDeliveryFee(parseKm(updatingData?.updateDraft?.deliveryDistance) || 0, branch?.slug || '')

  const hasCustomPriceItems = useMemo(
    () => orderItems.some((i) => i.isCustomPrice) ?? false,
    [orderItems],
  )

  const hasUnpricedCustomItems = useMemo(
    () =>
      orderItems.some(
        (i) =>
          i.isCustomPrice === true &&
          !(i.customPrice != null && i.customPrice > 0),
      ),
    [orderItems],
  )

  const handleRemoveOrderItem = (item: IOrderItem) => {
    // 💡 Xóa khỏi store (local) - không gọi API
    removeDraftItem(item.id)
    showToast(tToast('toast.deleteOrderItemSuccess'))
  }

  // Check if the total quantity of products in the cart exceeds the voucher's maxItems
  useEffect(() => {
    if (!voucherSlug || !voucherMaxItems) return
    if (cartItemQuantity > voucherMaxItems) {
      removeDraftVoucher()
      showErrorToastMessage('toast.voucherMaxItemsExceeded')
    }
  }, [
    voucherSlug,
    voucherMaxItems,
    cartItemQuantity,
    removeDraftVoucher,
    nonGiftOrderItems.length,
  ])

  return (
    <div
      className={`flex flex-col ${
        isMobile
          ? '-mx-2 min-h-[50vh] w-screen max-w-none border-b border-t bg-background sm:-mx-6 sm:px-6'
          : 'fixed right-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background shadow-lg transition-all duration-300 md:w-[26%] xl:w-[25%]'
      }`}
    >
      {/* Header */}
      <div
        className={`flex flex-col gap-2 p-2 ${isMobile ? 'border-b bg-background' : 'shrink-0 bg-background/95 backdrop-blur-sm'}`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-full">
            <OrderTypeInUpdateOrderSelect typeOrder={orderType} />
          </div>
          {orderType === OrderTypeEnum.TAKE_OUT && (
            <div className="w-full">
              <PickupTimeSelectInUpdateOrder
                orderType={orderType}
                pickupTime={updatingData?.originalOrder?.timeLeftTakeOut}
              />
            </div>
          )}
        </div>
      </div>

      {/* Order Items */}
      <ScrollArea
        className={`${isMobile ? 'max-h-[35vh] min-h-[200px] overflow-y-auto p-0' : 'scrollbar-hidden flex-1 p-0'}`}
      >
        <div className={`flex flex-col gap-2 p-2 ${isMobile ? 'pb-4' : ''}`}>
          <AnimatePresence>
            {orderItems && orderItems.length > 0 ? (
              orderItems.map((item: IOrderItem, index: number) => {
                // Tạo key thống nhất - dựa trên ID để đảm bảo mỗi item có key duy nhất
                // Điều này quan trọng khi có nhiều items giống nhau (cùng product, variant)
                const stableKey =
                  item.id ||
                  `${item.productSlug}-${item.variant?.slug || 'default'}-${index}`

                const priceDisplay = getItemPriceDisplay(
                  {
                    unitPrice: item.variant?.price ?? 0,
                    quantity: 1,
                    productSlug: item.productSlug,
                    promotionValue: item.promotion?.value,
                    isCustomPrice: item.isCustomPrice,
                    customPrice: item.customPrice,
                  },
                  voucher,
                )

                return (
                  <motion.div
                    key={stableKey}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className={`flex flex-col gap-1 rounded-lg border p-2 transition-colors ${item.isCustomPrice ? 'border-orange-400/70 bg-orange-500/10' : 'border-primary/80 bg-primary/10'} group`}
                  >
                    {item.isCustomPrice ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="max-w-[9rem] truncate text-[13px] font-semibold xl:max-w-[12rem] xl:text-sm">
                              {item.name}
                            </span>
                          </div>
                          <span className="shrink-0 text-[14px] font-semibold text-orange-600">
                            {(item.customPrice ?? 0) > 0
                              ? formatCurrency(item.customPrice ?? 0)
                              : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CustomPriceDraftInput
                            customPrice={item.customPrice}
                            onPriceChange={(v) =>
                              updateDraftItem(item.id, {
                                customPrice: v,
                                originalPrice: v,
                              })
                            }
                          />
                          {orderItems.length === 1 ? (
                            <DeleteLastOrderItemDialog
                              orderItem={item}
                              onSuccess={() => removeDraftItem(item.id)}
                            />
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveOrderItem(item)}
                              className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </Button>
                          )}
                        </div>
                        <OrderItemNoteInUpdateOrderInput orderItem={item} />
                      </div>
                    ) : (
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between">
                          <div className="flex items-end gap-1">
                            <span className="max-w-[9rem] truncate text-[13px] font-semibold xl:max-w-[15rem] xl:text-sm">
                              {item.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground">
                              (
                              {capitalizeFirstLetter(
                                item.variant?.size?.name || '',
                              )}
                              )
                            </span>
                            <div className="mt-1">
                              <OrderItemPrice
                                originalPrice={priceDisplay.originalPrice}
                                finalPrice={priceDisplay.finalPrice}
                                showStrikethrough={
                                  priceDisplay.showStrikethrough
                                }
                                promoLabel={priceDisplay.promoLabel}
                                voucherLabel={priceDisplay.voucherLabel}
                                formatter={formatCurrency}
                                className="w-20"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <UpdateOrderQuantity orderItem={item} />
                            {orderItems.length === 1 ? (
                              <DeleteLastOrderItemDialog
                                orderItem={item}
                                onSuccess={() => removeDraftItem(item.id)}
                              />
                            ) : (
                              <Button
                                title={t('common.remove')}
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveOrderItem(item)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2
                                  size={18}
                                  className="icon text-destructive"
                                />
                              </Button>
                            )}
                          </div>
                        </div>
                        <OrderItemNoteInUpdateOrderInput orderItem={item} />
                      </div>
                    )}
                  </motion.div>
                )
              })
            ) : (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
                <Info className="h-8 w-8 text-orange-400" />
                <div>
                  <div className="font-semibold text-foreground">
                    Đơn này chưa có món
                  </div>
                  <div className="mt-1 text-xs">
                    Bạn có thể thêm món mới từ menu bên trái.
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Footer - Payment */}
      {orderItems && orderItems.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`border-t p-2 ${isMobile ? 'bg-background' : 'z-10 shrink-0 bg-background/95 backdrop-blur-sm'}`}
        >
          <div className="space-y-1">
            <div className="flex flex-col">
              <OrderNoteInUpdateOrderInput order={updatingData?.updateDraft} />
              {!hasCustomPriceItems && (
                <StaffVoucherListSheetInUpdateOrderWithLocalStorage />
              )}
            </div>

            <div>
              {voucher && (
                <div className="flex w-full justify-start">
                  <div className="flex flex-col items-start">
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-primary px-1 text-[10px] text-primary"
                      >
                        {(() => {
                          if (!voucher) return null

                          switch (voucher.type) {
                            case VOUCHER_TYPE.PERCENT_ORDER:
                              return `${tVoucher('voucher.discountValue')}${voucher.value}% ${tVoucher('voucher.orderValue')}`

                            case VOUCHER_TYPE.FIXED_VALUE:
                              return `${tVoucher('voucher.discountValue')}${formatCurrency(voucher.value)} ${tVoucher('voucher.orderValue')}`

                            case VOUCHER_TYPE.SAME_PRICE_PRODUCT:
                              return `${tVoucher('voucher.samePrice')} ${formatCurrency(voucher.value)} ${tVoucher('voucher.forSelectedProducts')}`

                            default:
                              return ''
                          }
                        })()}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex w-full flex-col text-sm text-muted-foreground">
                {hasCustomPriceItems ? (
                  <div className="text-md mt-2 flex items-center justify-between border-t pt-2 font-semibold">
                    <span>{t('order.totalPayment')}</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(
                        orderItems.reduce(
                          (sum, i) => sum + (i.customPrice ?? 0) * i.quantity,
                          0,
                        ),
                      )}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>{t('order.subtotalBeforeDiscount')}</span>
                      <span>
                        {formatCurrency(
                          cartTotals?.subTotalBeforeDiscount || 0,
                        )}
                      </span>
                    </div>

                    {(cartTotals?.promotionDiscount || 0) > 0 && (
                      <div className="flex justify-between text-[10px] italic text-yellow-600">
                        <span>{t('order.promotionDiscount')}</span>
                        <span>
                          -{formatCurrency(cartTotals?.promotionDiscount || 0)}
                        </span>
                      </div>
                    )}

                    {(cartTotals?.voucherDiscount || 0) > 0 && (
                      <div className="flex justify-between text-[10px] italic text-green-600">
                        <span>{t('order.voucherDiscount')}</span>
                        <span>
                          -{formatCurrency(cartTotals?.voucherDiscount || 0)}
                        </span>
                      </div>
                    )}

                    {(accumulatedPointsToUse || 0) > 0 && (
                      <div className="flex justify-between text-[10px] italic text-primary">
                        <span>{t('order.accumulatedPointsToUse')}</span>
                        <span>
                          -{formatCurrency(accumulatedPointsToUse || 0)}
                        </span>
                      </div>
                    )}

                    {orderType === OrderTypeEnum.DELIVERY && (
                      <div className="flex justify-between text-xs italic text-muted-foreground/60">
                        <span>{t('order.deliveryFee')}</span>
                        <span>{formatCurrency(deliveryFee)}</span>
                      </div>
                    )}

                    <div className="text-md mt-2 flex items-center justify-between border-t pt-2 font-semibold">
                      <span>{t('order.totalPayment')}</span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(cartTotals?.finalTotal || 0)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {updatingData?.originalOrder?.status === OrderStatus.PENDING && (
                <div className="flex items-center justify-end">
                  <StaffConfirmUpdateOrderDialog
                    disabled={
                      hasUnpricedCustomItems ||
                      (orderType === OrderTypeEnum.AT_TABLE && !table) ||
                      (orderType === OrderTypeEnum.DELIVERY &&
                        !updatingData?.updateDraft?.deliveryAddress)
                    }
                    disabledText={
                      hasUnpricedCustomItems
                        ? t('menu.enterCustomPriceFirst')
                        : undefined
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
