import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckedState } from '@radix-ui/react-checkbox'

import { ChefOrderItemStatus, IOrderDetail, OrderItemStatus } from '@/types'
import { Badge, Checkbox } from '@/components/ui'
import { useOrderTrackingStore } from '@/stores'
import OrderItemStatusBadge from '@/components/app/badge/order-item-status-badge'
import { formatCurrency } from '@/utils'

interface OrderItemDetailProps {
  order: IOrderDetail
}

export default function OrderItemDetail({ order }: OrderItemDetailProps) {
  const { t } = useTranslation(['menu'])
  const { addSelectedItem, removeSelectedItem, getSelectedItems } =
    useOrderTrackingStore()
  const [selectedIndexes, setSelectedIndexes] = useState<{
    [key: string]: boolean
  }>({})

  // Initialize selectedIndexes only on component mount
  useEffect(() => {
    const selectedItems = getSelectedItems()
    const newSelectedIndexes: { [key: string]: boolean } = {}

    selectedItems.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        const key = `${item.slug}-${i}`
        newSelectedIndexes[key] = true
      }
    })
    setSelectedIndexes(newSelectedIndexes)
  }, [getSelectedItems]) // Empty dependency array means this only runs on mount

  // Handle failed items separately
  useEffect(() => {
    order.trackingOrderItems.forEach((trackingItem, index) => {
      if (trackingItem.tracking.status === 'FAILED') {
        setSelectedIndexes((prev) => {
          const updated = { ...prev }
          delete updated[`${order.slug}-${index}`]
          return updated
        })
      }
    })
  }, [order])

  const handleSelectOrderItem = (
    checked: CheckedState,
    orderItem: IOrderDetail,
    itemIndex: number,
  ) => {
    const key = `${orderItem.slug}-${itemIndex}`

    if (checked === true) {
      setSelectedIndexes((prev) => ({ ...prev, [key]: true }))
      const singleItem: IOrderDetail = {
        ...orderItem,
        quantity: 1,
        subtotal:
          orderItem.promotion && orderItem.promotion.value
            ? orderItem.variant.price * (1 - orderItem.promotion.value / 100)
            : orderItem.variant.price,
        slug: orderItem.slug,
        index: itemIndex,
        id: orderItem.id!,
      }
      addSelectedItem(singleItem)
    } else {
      setSelectedIndexes((prev) => {
        const updated = { ...prev }
        delete updated[key]
        return updated
      })
      removeSelectedItem(`${orderItem.slug}-${itemIndex}`)
    }
  }

  const isChecked = (orderItem: IOrderDetail, index: number) => {
    const key = `${orderItem.slug}-${index}`
    return !!selectedIndexes[key]
  }

  // const renderDeliveryTimeline = (orderItem: IOrderDetail) => {
  //   const noCompletedItems = orderItem.chefOrderItems?.filter(item => item.status === ChefOrderItemStatus.PENDING).length || 0
  //   const cookingItems = orderItem.chefOrderItems?.filter(item => item.status === ChefOrderItemStatus.IN_PROGRESS).length || 0
  //   const cookedItems = orderItem.chefOrderItems?.filter(item => item.status === ChefOrderItemStatus.COMPLETED).length || 0
  //   const deliveredItems = orderItem.trackingOrderItems.filter(item => item.tracking.status === 'COMPLETED').length

  //   return (
  //     <div className="flex flex-col gap-3 p-4 bg-white rounded-lg border shadow-sm">
  //       <div className="flex justify-between items-center">
  //         <h3 className="text-sm font-semibold text-gray-700">{t('order.deliveryStatus')}</h3>
  //       </div>

  //       <div className="relative">
  //         <div className="absolute top-[34px] left-0 w-full h-0.5 bg-gray-200 "></div>
  //         <div className="flex relative justify-between">
  //           <div className="flex flex-col items-center text-center">
  //             <div className={`w-8 h-8 rounded-full flex items-center justify-center ${noCompletedItems > 0 ? 'bg-yellow-100' : 'bg-gray-100'}`}>
  //               <Clock className={`w-4 h-4 ${noCompletedItems > 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
  //             </div>
  //             <span className="mt-2 text-xs font-medium text-gray-600">{t('order.pending')}</span>
  //             <span className="text-xs text-gray-500">{noCompletedItems} {t('order.items')}</span>
  //           </div>
  //           <div className="flex flex-col items-center text-center">
  //             <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cookingItems > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
  //               <AlertCircle className={`w-4 h-4 ${cookingItems > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
  //             </div>
  //             <span className="mt-2 text-xs font-medium text-gray-600">{t('order.cooking')}</span>
  //             <span className="text-xs text-gray-500">{cookingItems} {t('order.items')}</span>
  //           </div>
  //           <div className="flex flex-col items-center text-center">
  //             <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cookedItems > 0 ? 'bg-green-100' : 'bg-gray-100'}`}>
  //               <CheckCircle2 className={`w-4 h-4 ${cookedItems > 0 ? 'text-green-500' : 'text-gray-400'}`} />
  //             </div>
  //             <span className="mt-2 text-xs font-medium text-gray-600">{t('order.ready')}</span>
  //             <span className="text-xs text-gray-500">{cookedItems} {t('order.items')}</span>
  //           </div>
  //           <div className="flex flex-col items-center text-center">
  //             <div className={`w-8 h-8 rounded-full flex items-center justify-center ${deliveredItems > 0 ? 'bg-purple-100' : 'bg-gray-100'}`}>
  //               <Truck className={`w-4 h-4 ${deliveredItems > 0 ? 'text-purple-500' : 'text-gray-400'}`} />
  //             </div>
  //             <span className="mt-2 text-xs font-medium text-gray-600">{t('order.delivered')}</span>
  //             <span className="text-xs text-gray-500">{deliveredItems} {t('order.items')}</span>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   )
  // }

  const renderOrderItem = (orderItem: IOrderDetail) => {
    const items = Array(orderItem.quantity)
      .fill(null)
      .map((_, index) => {
        // Get current status
        let currentStatus = OrderItemStatus.PENDING
        if (index < orderItem.status.COMPLETED) {
          currentStatus = OrderItemStatus.COMPLETED
        } else if (
          index <
          orderItem.status.COMPLETED + orderItem.status.RUNNING
        ) {
          currentStatus = OrderItemStatus.RUNNING
        } else if (
          index <
          orderItem.status.COMPLETED +
            orderItem.status.RUNNING +
            orderItem.status.FAILED
        ) {
          currentStatus = OrderItemStatus.FAILED
        }

        // Get chefOrderItems status
        const chefOrderItem = orderItem.chefOrderItems?.[index]
        let chefStatus = OrderItemStatus.PENDING
        if (chefOrderItem) {
          chefStatus =
            chefOrderItem.status === ChefOrderItemStatus.COMPLETED
              ? OrderItemStatus.COMPLETED
              : chefOrderItem.status === ChefOrderItemStatus.IN_PROGRESS
                ? OrderItemStatus.RUNNING
                : OrderItemStatus.PENDING
        }

        return {
          status: currentStatus,
          chefStatus,
          index,
        }
      })

    return (
      <div key={orderItem.id} className="space-y-4 px-2 sm:px-0">
        {/* Delivery Timeline */}
        {/* {renderDeliveryTimeline(orderItem)} */}

        {/* Product Information */}
        <div className="flex flex-col gap-3 bg-transparent py-4">
          {/* Order Note */}
          {orderItem.note && (
            <div className="flex items-center gap-2 rounded-md border p-2">
              <span className="text-sm font-semibold text-muted-foreground">
                {t('order.note')}:
              </span>
              <span className="text-sm text-muted-foreground">
                {orderItem.note}
              </span>
            </div>
          )}

          {/* Order Items List */}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.index}
                className="flex flex-wrap items-center py-3"
              >
                <div className="flex w-full justify-between sm:w-1/2">
                  <div className="flex items-center gap-3">
                    {item.chefStatus === OrderItemStatus.COMPLETED ? (
                      item.status === OrderItemStatus.PENDING ||
                      item.status === OrderItemStatus.FAILED ? (
                        <Checkbox
                          className="h-5 w-5 shadow-none"
                          checked={isChecked(orderItem, item.index)}
                          onCheckedChange={(checked) =>
                            handleSelectOrderItem(
                              checked,
                              orderItem,
                              item.index,
                            )
                          }
                        />
                      ) : (
                        <div
                          className={`h-3 w-3 rounded-full ${
                            item.status === OrderItemStatus.COMPLETED
                              ? 'bg-green-500'
                              : item.status === OrderItemStatus.RUNNING
                                ? 'bg-blue-500'
                                : 'bg-gray-300'
                          }`}
                        />
                      )
                    ) : (
                      <div
                        className={`h-3 w-3 rounded-full ${
                          item.status === OrderItemStatus.COMPLETED
                            ? 'bg-green-500'
                            : item.status === OrderItemStatus.RUNNING
                              ? 'bg-blue-500'
                              : 'bg-gray-300'
                        }`}
                      />
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-secondary-foreground">
                        {orderItem.variant.product.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Size {orderItem.variant.size?.name.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="inline-block w-28 text-right font-medium tabular-nums text-foreground">
                      {formatCurrency(orderItem.variant?.price ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex w-full items-center justify-end gap-2 sm:mt-0 sm:w-1/2">
                  {item.chefStatus === OrderItemStatus.PENDING &&
                  item.status === OrderItemStatus.PENDING ? (
                    <Badge className="h-7 border border-muted-foreground/60 bg-muted-foreground/10 text-xs text-muted-foreground">
                      {t('order.waitingForKitchen')}
                    </Badge>
                  ) : item.chefStatus === OrderItemStatus.COMPLETED &&
                    item.status === OrderItemStatus.PENDING ? (
                    <OrderItemStatusBadge status={item.status} rounded="md" />
                  ) : (
                    <OrderItemStatusBadge
                      status={item.chefStatus}
                      rounded="md"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {renderOrderItem(order)}
    </div>
  )
}
