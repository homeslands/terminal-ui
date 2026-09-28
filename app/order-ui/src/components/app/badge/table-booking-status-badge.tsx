import { useTranslation } from 'react-i18next'

import { TTableBookingStatus } from '@/types'
import { TABLE_BOOKING_STATUS_STYLE } from '@/constants'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'

interface ITableBookingStatusBadgeProps {
  status: TTableBookingStatus
}

export default function TableBookingStatusBadge({
  status,
}: ITableBookingStatusBadgeProps) {
  const { t } = useTranslation('tableBooking')

  return (
    <Badge
      className={cn(
        'rounded-full min-w-28 text-center px-2 py-1 text-xs justify-center',
        TABLE_BOOKING_STATUS_STYLE[status] ?? 'bg-gray-400 text-white',
      )}
    >
      {t(`status.${status}`)}
    </Badge>
  )
}
