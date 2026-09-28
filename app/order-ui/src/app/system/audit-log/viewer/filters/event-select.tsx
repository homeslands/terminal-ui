import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TAuditEvent } from '@/types'

interface IProps {
  value?: TAuditEvent
  onChange: (v: TAuditEvent | undefined) => void
}

const ALL = '__all__'
const EVENTS: TAuditEvent[] = ['Create', 'Update', 'Delete']

export function EventSelect({ value, onChange }: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : (v as TAuditEvent))}
    >
      <SelectTrigger className="w-[10rem]">
        <SelectValue placeholder={t('auditLog.filter.event')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t('auditLog.filter.entityAll')}</SelectItem>
        {EVENTS.map((e) => (
          <SelectItem key={e} value={e}>
            {t(`auditLog.event.${e}`, e)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
