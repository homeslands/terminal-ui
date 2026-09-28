import { TableCard } from './table-card'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'

interface Props {
  tables: Table[]
  sessions: Record<string, TableSession>
  /** Map of tableSlug → active server order. Used by TableCard to derive
   *  cross-device order info (số món + tổng tiền) khi local session trống. */
  serverOrders?: Record<string, IOrder>
  onTableClick: (tableId: string) => void
}

export function FloorPlan({ tables, sessions, serverOrders, onTableClick }: Props) {
  const total = tables.length
  // Occupancy precedence: local active session > server `t.status === 'reserved'`
  // > existence of server order for this table.
  let occupied = 0
  for (const t of tables) {
    const isServerOccupied = t.status === 'reserved'
    const hasServerOrder = !!serverOrders?.[t.id]
    const localStatus = sessions[t.id]?.status
    const isLocalOccupied =
      localStatus === 'serving' || localStatus === 'waiting_payment'
    if (
      isServerOccupied ||
      hasServerOrder ||
      (t.status === undefined && isLocalOccupied)
    ) {
      occupied++
    }
  }
  const empty = total - occupied

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Tổng số" value={total} testId="stat-total" />
        <Stat label="Có khách" value={occupied} testId="stat-occupied" accent="text-yellow-400" />
        <Stat label="Trống" value={empty} testId="stat-empty" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => (
          <TableCard
            key={t.id}
            table={t}
            session={sessions[t.id]}
            serverOrder={serverOrders?.[t.id] ?? null}
            onClick={onTableClick}
          />
        ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  testId,
  accent,
}: {
  label: string
  value: number
  testId: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-pos-border bg-pos-surface p-4">
      <div className="text-xs uppercase tracking-wide text-pos-muted">{label}</div>
      <div
        data-testid={testId}
        className={`mt-1 text-2xl font-bold ${accent ?? 'text-pos-text'}`}
      >
        {value}
      </div>
    </div>
  )
}
