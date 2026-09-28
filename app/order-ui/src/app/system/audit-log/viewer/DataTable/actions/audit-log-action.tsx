import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { TAuditEvent } from '@/types'

import { DateRangeFilter } from '../../filters/date-range-filter'
import { EntitySelect } from '../../filters/entity-select'
import { EventSelect } from '../../filters/event-select'

interface IProps {
  entity?: string
  event?: TAuditEvent
  startDate?: string
  endDate?: string
  onEntityChange: (v: string | undefined) => void
  onEventChange: (v: TAuditEvent | undefined) => void
  onDateRangeChange: (v: { startDate?: string; endDate?: string }) => void
  onReset: () => void
  hasActiveFilter: boolean
}

export default function AuditLogAction({
  entity,
  event,
  startDate,
  endDate,
  onEntityChange,
  onEventChange,
  onDateRangeChange,
  onReset,
  hasActiveFilter,
}: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EntitySelect value={entity} onChange={onEntityChange} />
      <EventSelect value={event} onChange={onEventChange} />
      <DateRangeFilter value={{ startDate, endDate }} onChange={onDateRangeChange} />
      {hasActiveFilter && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          {t('auditLog.filter.reset')}
        </Button>
      )}
    </div>
  )
}
