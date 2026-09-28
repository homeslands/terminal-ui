import { useMemo, memo } from 'react'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'
import { formatVnd } from '@/data/staff-data'
import { Button } from '../ui'

interface Props {
  table: Table
  session: TableSession | undefined
  /** Active order from BE (cross-device source). Fallback when local session
   *  is empty — gives nhân viên khác thấy số món + tổng tiền dù máy này không
   *  phải máy đặt đơn. */
  serverOrder?: IOrder | null
  onClick: (tableId: string) => void
}

function TableCardComponent({ table, session, serverOrder, onClick }: Props) {
  const localStatus = session?.status
  const isLocalActive = !!session && localStatus !== 'empty' && localStatus !== 'done'
  const isServerActive = table.status === 'reserved' || !!serverOrder
  const isActive = isServerActive || isLocalActive
  const status: TableSession['status'] | 'occupied' = isLocalActive
    ? (localStatus as TableSession['status'])
    : isServerActive
      ? 'occupied'
      : 'empty'

  const { itemCount, total } = useMemo(() => {
    if (isLocalActive && session) {
      const pendingCount = session.pendingItems.reduce((s, i) => s + i.quantity, 0)
      const submittedCount = session.submittedOrders.reduce(
        (s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0),
        0,
      )
      const pendingTotal = session.pendingItems.reduce(
        (s, i) => s + i.priceNum * i.quantity,
        0,
      )
      const submittedTotal = session.submittedOrders.reduce(
        (s, o) =>
          s + o.items.reduce((ss, i) => ss + i.priceNum * i.quantity, 0),
        0,
      )
      return {
        itemCount: pendingCount + submittedCount,
        total: pendingTotal + submittedTotal,
      }
    }
    if (serverOrder) {
      const itemCount =
        serverOrder.orderItems?.reduce(
          (s, i) => s + (i.quantity ?? 0),
          0,
        ) ?? 0
      const total = serverOrder.subtotal ?? 0
      return { itemCount, total }
    }
    return { itemCount: 0, total: 0 }
  }, [isLocalActive, session, serverOrder])

  // Treat waiting_payment as serving for display purposes — the orange badge
  // was rarely visible (auto-revert + per-device local state) and confused
  // the 1-cashier flow. Logic gating still uses raw session.status elsewhere.
  const isServingLike = status === 'serving' || status === 'waiting_payment'
  const isOccupied = status === 'occupied'

  const borderClass = isServingLike
    ? 'border-pos-gold'
    : isOccupied
      ? 'border-pos-gold/40'
      : 'border-pos-border'

  const badgeClass = isServingLike
    ? 'bg-pos-gold text-white'                                  // SOLID gold — máy này đặt
    : isOccupied
      ? 'border border-pos-gold bg-pos-gold/10 text-pos-gold'   // OUTLINE gold — máy khác đặt
      : 'bg-pos-border text-pos-dim'

  const badgeLabel = isServingLike
    ? 'Đang phục vụ'
    : isOccupied
      ? 'Có khách'
      : 'Trống'

  return (
    <Button
      onClick={() => onClick(table.id)}
      data-testid="table-card"
      className={`flex flex-col items-start gap-2 rounded-lg border shadow-none ${borderClass} bg-pos-card p-4 min-h-24 text-left transition hover:bg-pos-elevated focus:outline-none focus:ring-2 focus:ring-pos-gold`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-base font-semibold text-pos-text">{table.label}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
        >
          {badgeLabel}
        </span>
      </div>
      {isActive ? (
        <div className="text-xs text-pos-muted">
          <div>{itemCount} món</div>
          <div className="text-pos-gold">{formatVnd(total)}</div>
        </div>
      ) : (
        <span className="text-xs text-pos-dim">{table.seats} chỗ</span>
      )}
    </Button>
  )
}

export const TableCard = memo(TableCardComponent)
