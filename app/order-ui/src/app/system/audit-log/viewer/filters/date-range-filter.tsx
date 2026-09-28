import { useTranslation } from 'react-i18next'
import { MoveRightIcon } from 'lucide-react'

import { SimpleDatePicker } from '@/components/app/picker'

interface IProps {
  /** Date range values in `YYYY-MM-DD` (local timezone). */
  value: { startDate?: string; endDate?: string }
  onChange: (v: { startDate?: string; endDate?: string }) => void
}

export function DateRangeFilter({ value, onChange }: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <div
      className="flex items-center gap-2"
      aria-label={t('auditLog.filter.date')}
    >
      <SimpleDatePicker
        value={value.startDate ?? ''}
        onChange={(d) => onChange({ ...value, startDate: d || undefined })}
        disableFutureDates
        allowEmpty
      />
      <MoveRightIcon className="h-4 w-4 text-muted-foreground" />
      <SimpleDatePicker
        value={value.endDate ?? ''}
        onChange={(d) => onChange({ ...value, endDate: d || undefined })}
        disableFutureDates
        allowEmpty
      />
    </div>
  )
}
