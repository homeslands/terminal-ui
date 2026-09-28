import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuditLogConfigs } from '@/hooks'

interface IProps {
  value?: string
  onChange: (v: string | undefined) => void
}

const ALL = '__all__'

export function EntitySelect({ value, onChange }: IProps) {
  const { t } = useTranslation('auditLog')
  const { data } = useAuditLogConfigs()
  const items = data?.result ?? []

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : v)}
    >
      <SelectTrigger className="w-[12rem]">
        <SelectValue placeholder={t('auditLog.filter.entity')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t('auditLog.filter.entityAll')}</SelectItem>
        {items.map((cfg) => (
          <SelectItem key={cfg.slug} value={cfg.entity}>
            {cfg.entity}
            {!cfg.enabled && (
              <span className="ml-1 text-xs text-muted-foreground">
                {t('auditLog.filter.entityDisabled')}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
