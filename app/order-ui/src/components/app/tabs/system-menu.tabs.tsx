import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { SystemHorizontalCatalogSelect } from '../select'
import { SystemMenuTabscontent } from '../tabscontent'
import { FloorPlan } from '@/components/staff/floor-plan'
import { useCatalogStore, useOrderFlowStore, useUserStore } from '@/stores'
import { FilterState } from '@/types'
import { useActiveOrdersByBranch, useSpecificMenu, useTables } from '@/hooks'
import { useTableSessions } from '@/hooks/useTableSessions'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'

export function SystemMenuTabs() {
  const { t } = useTranslation(['menu'])
  const [searchParams, setSearchParams] = useSearchParams()
  const { userInfo } = useUserStore()
  const { getCartItems, initializeOrdering } = useOrderFlowStore()
  const cartItems = getCartItems()
  const { catalog } = useCatalogStore()
  const { sessions, openSession, closeSession } = useTableSessions()
  const { data: tablesData } = useTables(userInfo?.branch?.slug ?? '', {
    refetchInterval: 3_000,
  })

  const { data: activeOrders, isLoading: isLoadingActiveOrders, isFetching: isFetchingActiveOrders } = useActiveOrdersByBranch(
    userInfo?.branch?.slug ?? '',
    { refetchInterval: 3_000 },
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

  const activeTab = searchParams.get('tab') || 'table'
  const activeTableSlug = searchParams.get('table') ?? null

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

  // Refs so handleAdminTableClick can read latest sessions/tables without
  // listing them as useCallback deps (preserves React.memo on TableCard).
  const sessionsRef = useRef(sessions)
  const tablesRef = useRef(tables)
  sessionsRef.current = sessions
  tablesRef.current = tables

  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [filters, setFilters] = useState<FilterState>({
    date: moment().format('YYYY-MM-DD'),
    branch: userInfo?.branch?.slug,
    catalog: catalog?.slug,
    productName: '',
  })
  const { data: specificMenu, isLoading } = useSpecificMenu(filters, !!userInfo?.slug)
  const specificMenuResult = specificMenu?.result;

  useEffect(() => {
    if (isFirstLoad) {
      setIsFirstLoad(false)
      if (!cartItems?.type) {
        initializeOrdering()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mirror staff's handleBack cleanup: when admin leaves a table without doing
  // anything (no pending items, no submitted order), drop the session so the
  // floor doesn't show the table as "Đang phục vụ" on return.
  const prevTableSlugRef = useRef<string | null>(activeTableSlug)
  useEffect(() => {
    const prev = prevTableSlugRef.current
    prevTableSlugRef.current = activeTableSlug
    if (!prev || prev === activeTableSlug) return
    const s = sessionsRef.current[prev]
    if (!s) return
    const hasPending = s.pendingItems.length > 0
    const hasSubmitted = s.submittedOrders.length > 0 || !!s.orderSlug
    if (!hasPending && !hasSubmitted) {
      closeSession(prev)
    }
  }, [activeTableSlug, closeSession])

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

  useEffect(() => {
    setFilters((prev: FilterState) => ({
      ...prev,
      branch: userInfo?.branch?.slug,
      catalog: catalog?.slug,
      productName: '',
    }))
  }, [userInfo?.branch?.slug, catalog?.slug])

  const handleSelectCatalog = (catalog: string) => {
    setFilters((prev: FilterState) => ({
      ...prev,
      catalog: catalog,
    }))
  }

  // Handle tab change by updating URL
  const handleTabChange = useCallback((tab: string) => {
    setSearchParams({ tab }, { replace: true })
  }, [setSearchParams])

  const handleAdminTableClick = useCallback(
    (tableId: string) => {
      const name = tablesRef.current.find((t) => t.id === tableId)?.label ?? tableId
      openSession(tableId, name)
      setSearchParams({ tab: 'menu', table: tableId }, { replace: false })
    },
    [openSession, setSearchParams],
  )

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* TabsList luôn sticky */}
      <div className="flex sticky top-0 z-20 flex-wrap gap-4 items-center py-3 bg-white shadow-sm dark:bg-background">
        <TabsList
          variant="line"
          className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-6"
        >
          <TabsTrigger value="table" className="flex justify-center">
            {t('menu.table')}
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex justify-center">
            {t('menu.menu')}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Tab Content: Table — staff-style floor plan with stats + session info */}
      <TabsContent value="table" className="p-0 pt-2 w-full">
        <FloorPlan
          tables={tables}
          sessions={sessions}
          serverOrders={serverOrders}
          onTableClick={handleAdminTableClick}
        />
      </TabsContent>

      {/* Tab Content: Menu */}
      <TabsContent value="menu" className="p-0 mt-0 w-full">
        {/* Sticky CatalogSelect chỉ trong tab này */}
        <div className="overflow-x-auto sticky top-14 z-20 py-2 w-full bg-white dark:bg-background scrollbar-hide">
          <SystemHorizontalCatalogSelect onChange={handleSelectCatalog} />
        </div>

        <SystemMenuTabscontent
          menu={specificMenuResult}
          isLoading={isLoading}
          activeTableSlug={activeTableSlug}
        />
      </TabsContent>
    </Tabs>
  )
}
