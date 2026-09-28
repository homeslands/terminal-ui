import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { TableBookingStatus, TTableBookingStatus } from '@/types'
import { ALL_STATUS } from '@/constants'

interface TableBookingStatusSelectProps {
  value: TTableBookingStatus | ''
  onChange: (value: TTableBookingStatus | '') => void
  className?: string
}

// Status filter select for the table-booking DataTable toolbar. Emits '' for
// the "all statuses" option so callers can drop it from the query params.
export default function TableBookingStatusSelect({
  value,
  onChange,
  className,
}: TableBookingStatusSelectProps) {
  const { t } = useTranslation('tableBooking')

  return (
    <Select
      value={value || ALL_STATUS}
      onValueChange={(v) =>
        onChange(v === ALL_STATUS ? '' : (v as TTableBookingStatus))
      }
    >
      <SelectTrigger className={className ?? 'w-40'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_STATUS}>{t('page.allStatus')}</SelectItem>
        {Object.values(TableBookingStatus).map((s) => (
          <SelectItem key={s} value={s}>
            {t(`status.${s}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
