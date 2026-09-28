import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { TAuditEvent } from '@/types'
import { cn } from '@/lib/utils'

interface IProps {
  event: TAuditEvent
}

const bgClassFor = (event: TAuditEvent) => {
  switch (event) {
    case 'Create':
      return 'bg-green-600 hover:bg-green-600'
    case 'Update':
      return 'bg-blue-600 hover:bg-blue-600'
    case 'Delete':
      return 'bg-red-600 hover:bg-red-600'
    default:
      return 'bg-gray-500 hover:bg-gray-500'
  }
}

export default function AuditEventBadge({ event }: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <Badge
      className={cn(
        'rounded-full text-white shadow-none min-w-[4.5rem] justify-center',
        bgClassFor(event),
      )}
    >
      {t(`auditLog.event.${event}`, event)}
    </Badge>
  )
}
