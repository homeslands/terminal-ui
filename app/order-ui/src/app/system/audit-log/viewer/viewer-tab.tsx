import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/ui'
import { useAuditLogConfigs, useAuditLogs, usePagination } from '@/hooks'
import { IAuditLog, TAuditEvent } from '@/types'

import { DetailSheet } from './detail-sheet'
import { UserCombobox, UserOption } from './filters/user-combobox'
import { useViewerColumns } from './DataTable/columns'
import AuditLogAction from './DataTable/actions/audit-log-action'

interface Filters {
  user?: UserOption
  entity?: string
  event?: TAuditEvent
  startDate?: string
  endDate?: string
}

export default function ViewerTab() {
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<Filters>({
    entity: searchParams.get('entity') ?? undefined,
    event: (searchParams.get('event') as TAuditEvent) ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    user: undefined,
  })
  const [selected, setSelected] = useState<IAuditLog | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const writeUrl = (next: Filters) => {
    const np = new URLSearchParams(searchParams)
    const setOrDel = (k: string, v?: string) => {
      if (v) np.set(k, v)
      else np.delete(k)
    }
    setOrDel('entity', next.entity)
    setOrDel('event', next.event)
    setOrDel('startDate', next.startDate)
    setOrDel('endDate', next.endDate)
    np.set('page', '1')
    setSearchParams(np, { replace: true })
  }
  const update = (patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      writeUrl(next)
      return next
    })
  }

  const { data, isLoading } = useAuditLogs({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    order: 'DESC',
    hasPaging: true,
    user: filters.user?.slug,
    entity: filters.entity,
    event: filters.event,
    startDate: filters.startDate,
    endDate: filters.endDate,
  })

  const { data: configsResp } = useAuditLogConfigs()
  const configs = useMemo(() => configsResp?.result ?? [], [configsResp])

  const configMap = useMemo(
    () => new Map(configs.map((c) => [c.slug, c.entity])),
    [configs],
  )

  const columns = useViewerColumns({
    configs,
    configMap,
  })

  const items = useMemo(() => data?.result?.items ?? [], [data])

  const reset = () => update({
    user: undefined,
    entity: undefined,
    event: undefined,
    startDate: undefined,
    endDate: undefined,
  })

  const hasActiveFilter = !!(
    filters.user || filters.entity || filters.event || filters.startDate || filters.endDate
  )

  const AuditLogActions = useMemo(() => {
    return function ActionOptions() {
      return (
        <AuditLogAction
          entity={filters.entity}
          event={filters.event}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onEntityChange={(v) => update({ entity: v })}
          onEventChange={(v) => update({ event: v })}
          onDateRangeChange={(v) => update(v)}
          onReset={reset}
          hasActiveFilter={hasActiveFilter}
        />
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, hasActiveFilter])

  const searchInputOverride = (
    <UserCombobox
      value={filters.user}
      onChange={(v) => update({ user: v })}
    />
  )

  return (
    <div className="flex flex-col flex-1 w-full">
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        pages={data?.result?.totalPages || 0}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        hiddenInput={false}
        searchInputOverride={searchInputOverride}
        actionOptions={AuditLogActions}
        onRowClick={(row) => {
          // eslint-disable-next-line no-console
          console.log('[audit-log] detail row:', row)
          setSelected(row)
          setSheetOpen(true)
        }}
        rowClassName={() => 'cursor-pointer'}
      />

      <DetailSheet
        log={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        configMap={configMap}
      />
    </div>
  )
}
