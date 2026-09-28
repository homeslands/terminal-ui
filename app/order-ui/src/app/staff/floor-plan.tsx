import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FloorPlan } from '@/components/staff/floor-plan'
import { useTableSessions } from '@/hooks/useTableSessions'
import { useActiveOrdersByBranch, useTables } from '@/hooks'
import { useUserStore } from '@/stores'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'

export default function StaffFloorPlanPage() {
  const navigate = useNavigate()
  const { sessions, openSession, closeSession } = useTableSessions()
  const { userInfo } = useUserStore()
  const branchSlug = userInfo?.branch?.slug ?? ''
  const { data: tablesData } = useTables(branchSlug, { refetchInterval: 3_000 })
  const { data: activeOrders, isLoading: isLoadingActiveOrders, isFetching: isFetchingActiveOrders } = useActiveOrdersByBranch(branchSlug, {
    refetchInterval: 3_000,
  })

  const tables: Table[] = useMemo(
    () =>
      (tablesData?.result ?? []).map((t) => ({
        id: t.slug,
        label: t.name,
        seats: 4,
        status: t.status as Table['status'],
      })),
    [tablesData],
  )

  const serverOrders = useMemo(() => {
    const map: Record<string, IOrder> = {}
    const items = activeOrders?.items ?? []
    for (const o of items) {
      const tableSlug = o.table?.slug
      if (tableSlug) map[tableSlug] = o
    }
    return map
  }, [activeOrders])

  // Refs so handleTableClick can read latest sessions/tables without listing
  // them as useCallback deps. Without this, the callback identity flips on
  // every order mutation or table refetch, defeating React.memo on TableCard.
  const sessionsRef = useRef(sessions)
  const tablesRef = useRef(tables)
  sessionsRef.current = sessions
  tablesRef.current = tables

  // Auto-clear stale local session when BE order disappears from active orders list.
  // Wait for fresh BE response before reconciling to avoid clearing on initial load.
  useEffect(() => {
    if (isLoadingActiveOrders || isFetchingActiveOrders) return
    if (!activeOrders) return
    for (const [tableId, session] of Object.entries(sessionsRef.current)) {
      if (!session.orderSlug) continue
      if (serverOrders[tableId]) continue
      closeSession(tableId)
    }
  }, [
    serverOrders,
    isLoadingActiveOrders,
    isFetchingActiveOrders,
    activeOrders,
    closeSession,
  ])

  const handleTableClick = useCallback(
    (tableId: string) => {
      const s = sessionsRef.current[tableId]
      if (!s || s.status === 'empty' || s.status === 'done') {
        const name = tablesRef.current.find((t) => t.id === tableId)?.label ?? tableId
        openSession(tableId, name)
        navigate(`/staff/table/${tableId}`)
      } else if (s.status === 'waiting_payment') {
        navigate(`/staff/table/${tableId}/payment`)
      } else {
        navigate(`/staff/table/${tableId}`)
      }
    },
    [openSession, navigate],
  )

  return (
    <div className="bg-pos-bg text-pos-text">
      <main className="mx-auto max-w-6xl px-2 py-4">
        <FloorPlan
          tables={tables}
          sessions={sessions}
          serverOrders={serverOrders}
          onTableClick={handleTableClick}
        />
      </main>
    </div>
  )
}
