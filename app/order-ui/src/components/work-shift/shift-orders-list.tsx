import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { OrderHistoryDetailSheet } from '@/components/app/sheet'
import { cn } from '@/lib'
import { isCrossShiftOrder } from '@/lib/work-shift-helpers'
import { OrderStatus, type IOrder } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

interface Props {
  orders: IOrder[]
  /** Slug của ca đang xem — dùng để phát hiện đơn xuyên ca. */
  currentShiftSlug: string
  isLoading?: boolean
}

function formatHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Badge trạng thái đơn suy trực tiếp từ order.status — payload orders của
 * work-shift KHÔNG có object payment, nên không dùng OrderStatusBadge
 * (badge đó cần payment.statusCode cho nhãn "paid").
 */
const STATUS_STYLE: Record<string, string> = {
  [OrderStatus.PENDING]: 'bg-yellow-500 text-white',
  [OrderStatus.SHIPPING]: 'bg-indigo-600 text-white',
  [OrderStatus.COMPLETED]: 'bg-blue-500 text-white',
  [OrderStatus.PAID]: 'bg-green-500 text-white',
  [OrderStatus.FAILED]: 'bg-destructive text-white',
}

function OrderStatusChip({ status }: { status: string }) {
  const { t } = useTranslation('menu')
  const label =
    status === OrderStatus.FAILED
      ? t('order.failed')
      : t(`order.${status}`, { defaultValue: status })
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-none',
        STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

/**
 * Danh sách đơn của một ca, đánh dấu đơn xuyên ca (spec §4 Luồng C).
 * Bấm một đơn → mở sheet chi tiết đơn (dùng chung với màn quản lý đơn hàng).
 */
export function ShiftOrdersList({ orders, currentShiftSlug, isLoading }: Props) {
  const { t } = useTranslation('workShift')
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null)

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div
        data-testid="shift-orders-empty"
        className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {t('emptyOrders')}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {orders.map((order) => {
        const isCross = isCrossShiftOrder(
          order.workShift?.slug,
          currentShiftSlug,
        )
        return (
          <button
            key={order.slug}
            type="button"
            onClick={() => setSelectedOrder(order)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left text-sm shadow-none transition-colors hover:bg-accent"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">#{order.referenceNumber}</span>
                {isCross && (
                  <span
                    data-testid={`cross-shift-badge-${order.slug}`}
                    className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                  >
                    {t('crossShiftBadge')}
                  </span>
                )}
                <OrderStatusChip status={order.status} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatHHMM(order.createdAt)}
              </div>
            </div>
            <span className="shrink-0 font-medium">
              {formatCurrencyWithSymbol(order.subtotal)}
            </span>
          </button>
        )
      })}

      {/* Conditionally mounted so the isolated unit test (no QueryClient) stays
          green — the sheet's useOrderBySlug only runs while an order is open. */}
      {selectedOrder && (
        <OrderHistoryDetailSheet
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}
