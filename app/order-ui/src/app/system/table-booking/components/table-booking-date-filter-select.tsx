import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  TableBookingDateFilterMode,
  TTableBookingDateFilterMode,
} from '@/types'

interface TableBookingDateFilterSelectProps {
  value: TTableBookingDateFilterMode
  onChange: (value: TTableBookingDateFilterMode) => void
  className?: string
}

// Chooses which date filter drives the booking list: the reserved booking
// date-time (fromDate/toDate range) or the day the request was made (date).
export default function TableBookingDateFilterSelect({
  value,
  onChange,
  className,
}: TableBookingDateFilterSelectProps) {
  const { t } = useTranslation('tableBooking')

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as TTableBookingDateFilterMode)}
    >
      <SelectTrigger className={className ?? 'w-48'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TableBookingDateFilterMode.BOOKING_DATE}>
          {t('page.filterByBookingDate')}
        </SelectItem>
        <SelectItem value={TableBookingDateFilterMode.REQUEST_DATE}>
          {t('page.filterByRequestDate')}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
