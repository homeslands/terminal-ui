import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'

import { useIsMobile, useOrderBySlug } from '@/hooks'
import { IOrder, OrderStatus, OrderTypeEnum } from '@/types'
import { SystemMenuInUpdateOrderTabs } from '@/components/app/tabs'
import { useOrderFlowStore } from '@/stores'
import { hasServerOrderDiverged } from '@/lib/update-order-helpers'
import { UpdateOrderContent } from './components'
import { ReinitConfirmDialog } from './components/reinit-confirm-dialog'

export default function UpdateOrderPage() {
    const { t: tHelmet } = useTranslation('helmet')
    const isMobile = useIsMobile()
    const { slug } = useParams()
    const { data: order, refetch: refetchOrder } = useOrderBySlug(slug)
    const [isPolling, setIsPolling] = useState<boolean>(false)
    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false) // Track if data is loaded to store
    const [isRefetching] = useState<boolean>(false)
    const [pendingReinitOrder, setPendingReinitOrder] = useState<typeof order | null>(null)
    // When user cancels the reinit dialog, snapshot the server data they dismissed.
    // Subsequent poll ticks only re-prompt if server data diverges PAST this snapshot.
    const dismissedServerOrderRef = useRef<IOrder | null>(null)
    const {
        updatingData,
        initializeUpdating,
        clearUpdatingData,
    } = useOrderFlowStore()

    // Initialize updating data (first-time only). Subsequent server changes are
    // handled via ReinitConfirmDialog (explicit user confirm) — see polling effect.
    useEffect(() => {
        if (order && !isDataLoaded && !isRefetching) {
            // Chỉ cần slug để init; orderItems có thể rỗng — user vẫn add món mới qua menu trái.
            if (!order.slug) return
            try {
                initializeUpdating(order)
                setIsDataLoaded(true)
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('❌ Update Order: Failed to initialize updating data:', error)
            }
        }
    }, [order, isDataLoaded, isRefetching, initializeUpdating])

    // Separate useEffect for polling control (currently disabled)
    useEffect(() => {
        if (order && isDataLoaded) {
            const orderData = order
            // Start/stop polling based on order status
            if (orderData.status === OrderStatus.PENDING) {
                setIsPolling(true)
            } else {
                setIsPolling(false)
            }
        }
    }, [order, isDataLoaded])

    // Reset store when slug changes (navigating to different order)
    useEffect(() => {
        if (slug) {
            // Check if current updating data matches the slug
            const isDataMismatch = updatingData?.originalOrder?.slug &&
                updatingData.originalOrder.slug !== slug

            if (isDataMismatch || !updatingData) {
                clearUpdatingData()
                setIsDataLoaded(false) // Reset data loaded flag for new order
            }
        }
    }, [slug, updatingData, clearUpdatingData])

    // Get current order data from Order Flow Store for updates
    const currentOrder = updatingData?.updateDraft
    const orderType = currentOrder?.type as OrderTypeEnum
    const table = currentOrder?.table || ""

    // Fallback initialization nếu data không được load vào store sau 2 giây
    useEffect(() => {
        if (order && isDataLoaded && !updatingData && slug) {
            const timeoutId = setTimeout(() => {
                try {
                    initializeUpdating(order)
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('❌ Update Order: Retry initialization failed:', error)
                }
            }, 2000)

            return () => clearTimeout(timeoutId)
        }
    }, [order, isDataLoaded, updatingData, slug, initializeUpdating])

    // Polling for order status changes every 5 seconds
    useEffect(() => {
        let pollingInterval: NodeJS.Timeout | null = null

        if (isPolling) {
            pollingInterval = setInterval(async () => {
                const updatedOrder = await refetchOrder()
                const orderData = updatedOrder.data

                if (orderData) {
                    if (orderData.status !== OrderStatus.PENDING) {
                        setIsPolling(false)
                    }
                    // Detect server-side divergence: prompt user to reload (instead of auto-reinit).
                    // Skip if user already dismissed THIS exact server state — only re-prompt when
                    // server data diverges further past the dismissed snapshot.
                    const dismissedSameAsServer =
                        dismissedServerOrderRef.current !== null &&
                        !hasServerOrderDiverged(dismissedServerOrderRef.current, orderData)
                    if (
                        updatingData?.originalOrder &&
                        hasServerOrderDiverged(updatingData.originalOrder, orderData) &&
                        pendingReinitOrder === null &&
                        !dismissedSameAsServer
                    ) {
                        setPendingReinitOrder(orderData)
                    }
                }
            }, 5000)
        }

        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval)
            }
        }
    }, [isPolling, refetchOrder, updatingData, pendingReinitOrder])

    const _handleRefetchAndReinitialize = useCallback(async () => {
        const result = await refetchOrder()
        if (!result.data) return
        const dismissedSameAsServer =
            dismissedServerOrderRef.current !== null &&
            !hasServerOrderDiverged(dismissedServerOrderRef.current, result.data)
        if (
            updatingData?.originalOrder &&
            hasServerOrderDiverged(updatingData.originalOrder, result.data) &&
            !dismissedSameAsServer
        ) {
            setPendingReinitOrder(result.data)
        }
    }, [refetchOrder, updatingData])

    const handleReinitConfirm = () => {
        if (pendingReinitOrder) {
            clearUpdatingData()
            initializeUpdating(pendingReinitOrder)
        }
        dismissedServerOrderRef.current = null  // reset — user just reloaded
        setPendingReinitOrder(null)
    }

    const handleReinitCancel = () => {
        // Snapshot the dismissed server state so we don't re-prompt for the same divergence
        dismissedServerOrderRef.current = pendingReinitOrder ?? null
        setPendingReinitOrder(null)
    }

    return (
        <div className='pb-4'>
            <Helmet>
                <meta charSet='utf-8' />
                <title>
                    {tHelmet('helmet.updateOrder.title')}
                </title>
                <meta name='description' content={tHelmet('helmet.updateOrder.title')} />
            </Helmet>

            {/* Order type selection */}
            {order &&
                <div className={`flex gap-4 ${isMobile ? 'flex-col' : 'flex-row'}`}>
                    {/* Mobile: Content first (top), Desktop: Menu first (left) */}
                    {isMobile ? (
                        <>
                            {/* Content trên mobile */}
                            <div className="w-full">
                                <UpdateOrderContent
                                    orderType={orderType}
                                    table={table}
                                />
                            </div>

                            {/* Menu dưới mobile */}
                            <div className="flex flex-col gap-2 py-3 w-full">
                                {/* Menu & Table select */}
                                <div className="min-h-[50vh]">
                                    <SystemMenuInUpdateOrderTabs type={orderType} order={order} onSubmit={_handleRefetchAndReinitialize} />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className='flex flex-col w-full h-screen'>
                            {/* Desktop layout - Menu left */}
                            <div className={`flex ${isMobile ? 'w-full' : 'w-[75%] xl:w-[70%] pr-6 xl:pr-0'} flex-col gap-2`}>
                                {/* Menu & Table select */}
                                <SystemMenuInUpdateOrderTabs type={orderType} order={order} onSubmit={_handleRefetchAndReinitialize} />
                            </div>

                            {/* Desktop layout - Content right */}
                            <UpdateOrderContent
                                orderType={orderType}
                                table={table}
                            />
                        </div>
                    )}
                </div>
            }
            <ReinitConfirmDialog
                open={pendingReinitOrder !== null}
                onConfirm={handleReinitConfirm}
                onCancel={handleReinitCancel}
            />
        </div>
    )
}
