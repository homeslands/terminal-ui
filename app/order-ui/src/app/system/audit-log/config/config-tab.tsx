import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAuditLogConfigs,
  useUpdateAuditLogConfig,
} from '@/hooks'
import { IAuditLogConfig } from '@/types'

import { DisableConfirmDialog } from './disable-confirm-dialog'

export default function ConfigTab() {
  const { t } = useTranslation('auditLog')
  const { data, isLoading } = useAuditLogConfigs()
  const mutation = useUpdateAuditLogConfig()
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<IAuditLogConfig | null>(null)

  const items = useMemo(() => data?.result ?? [], [data])

  // Sort: enabled first, then alphabetical (so user sees active configs first)
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
        return a.entity.localeCompare(b.entity)
      }),
    [items],
  )

  const runMutation = (row: IAuditLogConfig, enabled: boolean) => {
    setPending((p) => new Set(p).add(row.slug))
    mutation.mutate(
      { slug: row.slug, enabled },
      {
        onSettled: () =>
          setPending((p) => {
            const next = new Set(p)
            next.delete(row.slug)
            return next
          }),
      },
    )
  }

  const onToggle = (row: IAuditLogConfig, next: boolean) => {
    if (!next) setConfirm(row)
    else runMutation(row, true)
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] rounded-sm" />
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="border rounded-sm p-6 text-center text-sm text-muted-foreground">
          {t('auditLog.empty.config')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedItems.map((cfg) => {
            const isPending = pending.has(cfg.slug)
            const entityLabel = t(`auditLog.entityLabels.${cfg.entity}`, {
              defaultValue: cfg.entity,
            })
            return (
              <div
                key={cfg.slug}
                className="border rounded-sm dark:border-gray-500 p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="font-semibold text-sm truncate"
                    title={cfg.entity}
                  >
                    {entityLabel}
                  </div>
                  <div className={`text-xs italic ${cfg.enabled ? 'text-green-500' : 'text-muted-foreground'} mt-0.5`}>
                    {cfg.enabled
                      ? t('auditLog.config.statusActive')
                      : t('auditLog.config.statusPaused')}
                  </div>
                </div>
                <Switch
                  checked={cfg.enabled}
                  disabled={isPending}
                  onCheckedChange={(next) => onToggle(cfg, next)}
                  aria-label={cfg.entity}
                />
              </div>
            )
          })}
        </div>
      )}
      <DisableConfirmDialog
        open={!!confirm}
        entity={confirm?.entity}
        onOpenChange={(o) => {
          if (!o) setConfirm(null)
        }}
        onConfirm={() => {
          if (confirm) runMutation(confirm, false)
          setConfirm(null)
        }}
      />
    </div>
  )
}
