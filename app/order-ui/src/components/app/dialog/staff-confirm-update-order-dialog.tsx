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

import { ICartItem, OrderTypeEnum } from '@/types'
import {
  useUpdateOrderType,
  useUpdateOrderItem,
  useUpdateNoteOrderItem,
  useAddNewOrderItem,
  useUpdateVoucherInOrder,
  useDeleteOrderItem,
} from '@/hooks'
import {
  calculateOrderItemDisplay,
  calculatePlacedOrderTotals,
  formatCurrency,
  showErrorToast,
  showToast,
  transformOrderItemToOrderDetail,
} from '@/utils'
import { compareOrders } from '@/utils/order-comparison'
import { Role, ROUTE } from '@/constants'
import { useUserStore, useOrderFlowStore } from '@/stores'
import { OrderItemPrice } from '@/components/app/order-item-price'
import { getItemPriceDisplay } from '@/lib/order-item-display'

interface IStaffConfirmUpdateOrderDialogProps {
  disabled?: boolean | undefined
  disabledText?: string
  onSuccessfulOrder?: () => void
}

export default function StaffConfirmUpdateOrderDialog({
  disabled,
  disabledText,
  onSuccessfulOrder,
}: IStaffConfirmUpdateOrderDialogProps) {
  const navigate = useNavigate()
  const { t } = useTranslation(['menu'])
  const { t: tCommon } = useTranslation('common')
  const { t: tToast } = useTranslation('toast')
  const { updatingData, clearAllData } = useOrderFlowStore()

  // Các hooks để update order
  const { mutate: addNewOrderItem, isPending: isPendingAddNewOrderItem } =
    useAddNewOrderItem()
  const {
    mutate: updateVoucherInOrder,
    isPending: isPendingUpdateVoucherInOrder,
  } = useUpdateVoucherInOrder()
  const { mutate: updateOrderType, isPending: isPendingUpdateOrderType } =
    useUpdateOrderType()
  const { mutate: updateOrderItem, isPending: isPendingUpdateOrderItem } =
    useUpdateOrderItem()
  const {
    mutate: updateOrderItemNote,
    isPending: isPendingUpdateOrderItemNote,
  } = useUpdateNoteOrderItem()
  const { mutate: deleteOrderItem, isPending: isPendingDeleteOrderItem } =
    useDeleteOrderItem()

  const [isOpen, setIsOpen] = useState(false)
  const { userInfo } = useUserStore()

  // Get data from Order Flow Store
  const orderDraft = updatingData?.updateDraft
  const originalOrder = updatingData?.originalOrder
  const voucher = updatingData?.updateDraft?.voucher || null
  const deliveryFee = updatingData?.updateDraft?.deliveryFee || 0
  const accumulatedPointsToUse =
    updatingData?.originalOrder?.accumulatedPointsToUse || 0
  // Convert orderDraft to ICartItem format for comparison
  const order: ICartItem | null = orderDraft
    ? {
        id: orderDraft.id,
        slug: orderDraft.slug,
        owner: orderDraft.owner,
        ownerFullName: orderDraft.ownerFullName,
        ownerPhoneNumber: orderDraft.ownerPhoneNumber,
        ownerRole: orderDraft.ownerRole,
        type: orderDraft.type as string,
        timeLeftTakeOut: orderDraft.timeLeftTakeOut,
        deliveryTo: orderDraft.deliveryTo,
        deliveryPhone: orderDraft.deliveryPhone,
        orderItems: orderDraft.orderItems.map((item) => ({
          ...item,
          slug: item.slug || item.id,
          productSlug: item.productSlug || item.slug,
        })),
        table: orderDraft.table,
        tableName: orderDraft.tableName,
        voucher: orderDraft.voucher,
        description: orderDraft.description,
        approvalBy: orderDraft.approvalBy,
        paymentMethod: orderDraft.paymentMethod,
      }
    : null

  // Convert originalOrder to ICartItem format for comparison
  const originalOrderForComparison: ICartItem | null = originalOrder
    ? {
        id: originalOrder.slug,
        slug: originalOrder.slug,
        owner: originalOrder.owner?.slug || '',
        ownerFullName: originalOrder.owner?.firstName || '',
        ownerPhoneNumber: originalOrder.owner?.phonenumber || '',
        ownerRole: originalOrder.owner?.role?.name || '',
        type: originalOrder.type,
        timeLeftTakeOut: originalOrder.timeLeftTakeOut,
        deliveryTo: originalOrder.deliveryTo,
        deliveryPhone: originalOrder.deliveryPhone,
        orderItems: originalOrder.orderItems.map((detail) => ({
          id: detail.id || detail.slug,
          slug: detail.slug,
          productSlug: detail.variant.product.slug,
          image: detail.variant.product.image,
          name: detail.variant.product.name,
          quantity: detail.quantity,
          size: detail.variant.size.name,
          allVariants: detail.variant.product.variants,
          variant: detail.variant,
          originalPrice: detail.variant.price,
          promotion: detail.promotion ? detail.promotion : null,
          promotionValue: detail.promotion?.value || 0,
          description: detail.variant.product.description,
          isLimit: detail.variant.product.isLimit,
          isGift: detail.variant.product.isGift,
          note: detail.note || '',
        })),
        table: originalOrder.table?.slug || '',
        tableName: originalOrder.table?.name || '',
        voucher: originalOrder.voucher,
        description: originalOrder.description,
        approvalBy: originalOrder.approvalBy?.slug || '',
        paymentMethod: originalOrder.payment?.paymentMethod || '',
      }
    : null

  // So sánh orders để tìm thay đổi
  const orderComparison = compareOrders(originalOrderForComparison, order)

  // Calculate display items and totals
  const transformedOrderItems = orderDraft
    ? transformOrderItemToOrderDetail(orderDraft.orderItems)
    : []
  const displayItems = calculateOrderItemDisplay(
    transformedOrderItems,
    orderDraft?.voucher || null,
  )
  const orderTotals = calculatePlacedOrderTotals(
    displayItems,
    orderDraft?.voucher || null,
    deliveryFee,
    accumulatedPointsToUse,
  )
  const hasCustomPriceItems =
    orderDraft?.orderItems.some((i) => i.isCustomPrice) ?? false
  const customPriceTotal = hasCustomPriceItems
    ? (orderDraft?.orderItems ?? []).reduce(
        (sum, i) => sum + (i.customPrice ?? 0) * i.quantity,
        0,
      )
    : 0

  // Check if any operation is pending
  const isAnyPending =
    isPendingAddNewOrderItem ||
    isPendingUpdateOrderType ||
    isPendingUpdateOrderItem ||
    isPendingUpdateOrderItemNote ||
    isPendingUpdateVoucherInOrder ||
    isPendingDeleteOrderItem

  const handleSubmit = async () => {
    if (!orderDraft || !originalOrder) return

    try {
      // 1. Update order type/table/description/pickup time/deliveryAddress/deliveryPhone if changed
      if (
        orderComparison.typeChanged ||
        orderComparison.tableChanged ||
        orderComparison.noteChanged ||
        orderComparison.pickupTimeChanged ||
        orderComparison.deliveryAddressChanged ||
        orderComparison.deliveryPhoneChanged
      ) {
        await new Promise((resolve, reject) => {
          updateOrderType(
            {
              slug: originalOrder.slug,
              params: {
                type: orderDraft.type,
                table: orderDraft.table || null,
                description: orderDraft.description || '',
                timeLeftTakeOut: orderDraft.timeLeftTakeOut || 0,
                deliveryTo:
                  orderDraft.type === OrderTypeEnum.DELIVERY
                    ? orderDraft.deliveryTo?.placeId || ''
                    : '',
                deliveryPhone:
                  orderDraft.type === OrderTypeEnum.DELIVERY
                    ? orderDraft.deliveryPhone || ''
                    : '',
              },
            },
            {
              onSuccess: () => resolve(true),
              onError: (error) => reject(error),
            },
          )
        })
      }

      // 2. Handle item changes - Xử lý TẤT CẢ thay đổi về món trước khi update voucher
      // 2.1. Xóa món trước (removed) - ưu tiên để tránh conflict
      const removedItems = orderComparison.itemChanges.filter(
        (c) => c.type === 'removed',
      )
      for (const change of removedItems) {
        if (!change.slug) continue

        await new Promise((resolve, reject) => {
          deleteOrderItem(change.slug!, {
            onSuccess: () => resolve(true),
            onError: (error) => reject(error),
          })
        })
      }

      // Shared map for newly-added items so subsequent steps (note update,
      // chef-order linking) can resolve the BE-assigned slug from the original
      // draft id. Populated by BOTH customPrice_changed and added handlers.
      const newItemSlugMap = new Map<string, string>()

      // 2.1.b. Custom-price changed: BE không hỗ trợ PATCH customPrice trên
      // /order-items/{slug}, nên ta delete món cũ + add lại với customPrice mới.
      // Phải làm trước "added" để giữ trật tự logic (delete trước, add sau).
      const customPriceChangedItems = orderComparison.itemChanges.filter(
        (c) => c.type === 'customPrice_changed',
      )
      for (const change of customPriceChangedItems) {
        if (!change.slug || !change.item) continue
        // Delete old item
        await new Promise((resolve, reject) => {
          deleteOrderItem(change.slug!, {
            onSuccess: () => resolve(true),
            onError: (error) => reject(error),
          })
        })
        // Add new item with the updated customPrice + current quantity/promotion.
        await new Promise((resolve, reject) => {
          addNewOrderItem(
            {
              quantity: change.item.quantity,
              variant: change.item.variant.slug,
              promotion: change.item.isCustomPrice
                ? ''
                : change.item.promotion
                  ? change.item.promotion.slug
                  : '',
              order: originalOrder.slug,
              ...(change.item.isCustomPrice && change.item.customPrice
                ? { customPrice: change.item.customPrice }
                : {}),
            },
            {
              onSuccess: (response) => {
                if (response?.result?.slug && change.item?.id) {
                  newItemSlugMap.set(change.item.id, response.result.slug)
                }
                resolve(true)
              },
              onError: (error) => reject(error),
            },
          )
        })
      }

      // 2.2. Thêm món mới (added)
      const addedItems = orderComparison.itemChanges.filter(
        (c) => c.type === 'added',
      )

      for (const change of addedItems) {
        if (!change.item) continue

        await new Promise((resolve, reject) => {
          addNewOrderItem(
            {
              quantity: change.item.quantity,
              variant: change.item.variant.slug,
              promotion: change.item.isCustomPrice
                ? ''
                : change.item.promotion
                  ? change.item.promotion.slug
                  : '',
              order: originalOrder.slug,
              ...(change.item.isCustomPrice && change.item.customPrice
                ? { customPrice: change.item.customPrice }
                : {}),
            },
            {
              onSuccess: (response) => {
                // Lưu slug mới từ API response để dùng cho update note sau
                if (response?.result?.slug && change.item?.id) {
                  newItemSlugMap.set(change.item.id, response.result.slug)
                }
                resolve(true)
              },
              onError: (error) => reject(error),
            },
          )
        })
      }

      // 2.3. Thay đổi số lượng (quantity_changed)
      const quantityChangedItems = orderComparison.itemChanges.filter(
        (c) => c.type === 'quantity_changed',
      )
      for (const change of quantityChangedItems) {
        if (!change.slug) continue
        const originalQuantity = change.originalQuantity || 0
        const newQuantity = change.newQuantity || 0
        const action =
          newQuantity > originalQuantity ? 'increment' : 'decrement'

        await new Promise((resolve, reject) => {
          updateOrderItem(
            {
              slug: change.slug!,
              data: {
                quantity: change.item.quantity,
                note: change.item.note || '',
                variant: change.item.variant.slug,
                promotion: change.item.promotion
                  ? change.item.promotion.slug
                  : '',
                action: action,
              },
            },
            {
              onSuccess: () => resolve(true),
              onError: (error) => reject(error),
            },
          )
        })
      }

      // 2.4. Update note (orderItemNoteChanged) - bao gồm cả món mới có note
      const orderItemNoteChangedItems = orderComparison.itemChanges.filter(
        (c) => c.type === 'orderItemNoteChanged',
      )

      // Xử lý món mới có note: từ type 'added' chuyển thành update note
      // (Sau khi đã add món mới, nếu có note thì update note)
      const addedItemsWithNote = orderComparison.itemChanges
        .filter((c) => c.type === 'added' && c.note && c.note.trim() !== '')
        .map((change) => {
          // Lấy slug mới từ map (đã được lưu khi add thành công)
          const newSlug = change.item?.id
            ? newItemSlugMap.get(change.item.id)
            : null
          return {
            ...change,
            type: 'orderItemNoteChanged' as const,
            slug: newSlug || change.item?.slug || change.item?.id || '',
          }
        })
        .filter((change) => change.slug) // Chỉ lấy những item có slug hợp lệ

      // Gộp với orderItemNoteChangedItems
      const allNoteChangedItems = [
        ...orderItemNoteChangedItems,
        ...addedItemsWithNote,
      ]

      // Update note của tất cả items (bao gồm cả món mới có note)
      for (const change of allNoteChangedItems) {
        if (!change.slug) continue

        await new Promise((resolve, reject) => {
          updateOrderItemNote(
            {
              slug: change.slug!,
              data: {
                note: change.item.note || '',
              },
            },
            {
              onSuccess: () => resolve(true),
              onError: (error) => reject(error),
            },
          )
        })
      }

      // 3. CUỐI CÙNG: Update voucher sau khi tất cả thay đổi về món đã được xử lý xong
      if (orderComparison.voucherChanged) {
        const orderItemsParam = orderDraft.orderItems.map((item) => ({
          quantity: item.quantity,
          variant: item.variant.slug,
          note: item.note || '',
          promotion: item.promotion ? item.promotion.slug : null,
        }))

        await new Promise((resolve, reject) => {
          updateVoucherInOrder(
            {
              slug: originalOrder.slug,
              voucher: orderDraft.voucher?.slug || null,
              orderItems: orderItemsParam,
            },
            {
              onSuccess: () => resolve(true),
              onError: (error) => reject(error),
            },
          )
        })
      }

      // Success - navigate to payment
      const orderPath =
        userInfo?.role.name === Role.CUSTOMER
          ? `${ROUTE.CLIENT_PAYMENT}?order=${originalOrder.slug}`
          : `${ROUTE.STAFF_ORDER_PAYMENT}?order=${originalOrder.slug}`

      navigate(orderPath)
      setIsOpen(false)
      onSuccessfulOrder?.()

      if (userInfo?.role.name === Role.CUSTOMER) {
        clearAllData()
      }

      showToast(tToast('toast.updateOrderSuccess'))
    } catch {
      showErrorToast(11000)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled || isAnyPending}
          className="flex w-full items-center rounded-full text-sm"
          onClick={() => setIsOpen(true)}
        >
          {isAnyPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {(() => {
            if (disabled && disabledText) return disabledText
            if (order?.type === OrderTypeEnum.TAKE_OUT) {
              return t('order.updateOrder')
            }
            if (order?.type === OrderTypeEnum.AT_TABLE) {
              return order?.table
                ? t('order.updateOrder')
                : t('menu.noSelectedTable')
            }
            if (order?.type === OrderTypeEnum.DELIVERY) {
              return order?.deliveryTo?.formattedAddress
                ? t('order.updateOrder')
                : t('order.noSelectedAddress')
            }
            return t('order.noSelectedAddress')
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
              {t('order.updateOrder')}
            </div>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('order.confirmOrder')}
          </DialogDescription>
        </DialogHeader>

        {/* Order Items List */}
        <ScrollArea className="flex h-[calc(100vh-30rem)] flex-col gap-4 px-4 sm:max-h-[calc(100vh-16rem)]">
          {/* Hiển thị thay đổi */}
          {/* {renderOrderChanges()} */}

          {/* Order Info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
              <span className="flex items-center gap-2 text-gray-600">
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
            {order?.type === OrderTypeEnum.TAKE_OUT &&
              order?.timeLeftTakeOut !== undefined && (
                <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                  <span className="flex items-center gap-2 text-gray-600">
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
            {order?.type === OrderTypeEnum.DELIVERY &&
              order?.deliveryTo?.formattedAddress && (
                <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                  <span className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    {t('menu.deliveryAddress')}
                  </span>
                  <span className="font-medium">
                    {order.deliveryTo.formattedAddress}
                  </span>
                </div>
              )}
            {order?.type === OrderTypeEnum.DELIVERY && order?.deliveryPhone && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  {t('menu.deliveryPhone')}
                </span>
                <span className="font-medium">{order.deliveryPhone}</span>
              </div>
            )}
            {order?.tableName && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-4 w-4" />
                  {t('menu.tableName')}
                </span>
                <span className="font-medium">{order.tableName}</span>
              </div>
            )}
            {order?.ownerFullName && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <User className="h-4 w-4" />
                  {t('order.customer')}
                </span>
                <span className="font-medium">{order.ownerFullName}</span>
              </div>
            )}
            {order?.ownerPhoneNumber && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  {t('order.phoneNumber')}
                </span>
                <span className="font-medium">{order.ownerPhoneNumber}</span>
              </div>
            )}
            {order?.description && (
              <div className="flex justify-between rounded-md border bg-muted-foreground/5 px-2 py-3 text-sm">
                <span className="flex items-center gap-2 text-gray-600">
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
                  productSlug: item.productSlug,
                  promotionValue: item.promotion?.value,
                  isCustomPrice: item.isCustomPrice,
                  customPrice: item.customPrice,
                },
                voucher,
              )

              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="font-bold">{item.name}</p>
                    <div className="flex gap-2">
                      {item.isCustomPrice ? (
                        <Badge
                          className="w-fit border-orange-400 text-xs text-orange-500"
                          variant="outline"
                        >
                          💰 {t('menu.customPrice')}
                        </Badge>
                      ) : (
                        <Badge
                          className="w-fit text-xs text-muted-foreground"
                          variant="outline"
                        >
                          Size {item.size.toUpperCase()}
                        </Badge>
                      )}
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
            {hasCustomPriceItems ? (
              <div className="text-md mt-4 flex w-full items-center justify-between gap-2 border-t pt-2 font-semibold">
                <span>{t('order.totalPayment')}:&nbsp;</span>
                <span className="text-2xl font-extrabold text-orange-600">
                  {formatCurrency(customPriceTotal)}
                </span>
              </div>
            ) : (
              <>
                <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
                  {t('order.subtotal')}:&nbsp;
                  <span>{`${formatCurrency(orderTotals?.subTotalBeforeDiscount || 0)}`}</span>
                </div>
                {(orderTotals?.promotionDiscount || 0) > 0 && (
                  <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="italic text-yellow-600">
                      {t('order.promotionDiscount')}:&nbsp;
                    </span>
                    <span className="italic text-yellow-600">
                      -
                      {`${formatCurrency(orderTotals?.promotionDiscount || 0)}`}
                    </span>
                  </div>
                )}
                <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span className="italic text-green-500">
                    {t('order.voucher')}:&nbsp;
                  </span>
                  <span className="italic text-green-500">
                    -{`${formatCurrency(orderTotals?.voucherDiscount || 0)}`}
                  </span>
                </div>
                {deliveryFee && (
                  <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="italic text-muted-foreground">
                      {t('order.deliveryFee')}:&nbsp;
                    </span>
                    <span className="italic text-muted-foreground">
                      {`${formatCurrency(deliveryFee || 0)}`}
                    </span>
                  </div>
                )}
                <div className="text-md mt-4 flex w-full items-center justify-between gap-2 border-t pt-2 font-semibold">
                  <span>{t('order.totalPayment')}:&nbsp;</span>
                  <span className="text-2xl font-extrabold text-primary">
                    {`${formatCurrency(orderTotals?.finalTotal || 0)}`}
                  </span>
                </div>
              </>
            )}
            <div className="mt-4 flex w-full flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="min-w-24 border border-gray-300"
                disabled={isAnyPending}
              >
                {tCommon('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (orderDraft) {
                    handleSubmit()
                  }
                }}
                disabled={isAnyPending}
              >
                {isAnyPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('order.updateOrder')}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
