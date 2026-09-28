import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { AuditEventBadge } from '@/components/app/badge'
import { DataTableColumnHeader } from '@/components/ui'
import { IAuditLog, IAuditLogConfig } from '@/types'

import { summarizeDiff, DiffSummary } from '../helpers/summarize-diff'

const summaryToText = (
  s: DiffSummary,
  t: (k: string, opts?: Record<string, unknown>) => string,
) => {
  switch (s.kind) {
    case 'create':
      return t('auditLog.summary.created')
    case 'delete':
      return t('auditLog.summary.deleted')
    case 'noChange':
      return t('auditLog.sheet.noChange')
    case 'update': {
      const head = s.changes
        .map((c) => `${c.key}: ${String(c.from)} → ${String(c.to)}`)
        .join(', ')
      return s.extra > 0
        ? t('auditLog.summary.updateWithExtra', { head, count: s.extra })
        : head
    }
  }
}

interface UseColumnsArgs {
  configs: IAuditLogConfig[]
  configMap?: Map<string, string>
}

export const useViewerColumns = ({
  configs,
  configMap,
}: UseColumnsArgs): ColumnDef<IAuditLog>[] => {
  const { t } = useTranslation('auditLog')
  // disabledEntitySet uses config.entity (class name) for matching
  const disabledEntitySet = new Set(
    configs.filter((c) => !c.enabled).map((c) => c.entity),
  )

  return [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('auditLog.col.createdAt')}
        />
      ),
      cell: ({ row }) =>
        moment(row.original.createdAt).format('HH:mm DD/MM/YYYY'),
    },
    {
      accessorKey: 'user',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('auditLog.col.user')}
        />
      ),
      cell: ({ row }) => {
        const userDisplay =
          row.original.user === 'unknown'
            ? t('auditLog.systemActor')
            : row.original.user
        return <span title={row.original.userSlug}>{userDisplay}</span>
      },
    },
    {
      accessorKey: 'event',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('auditLog.col.event')}
        />
      ),
      cell: ({ row }) => <AuditEventBadge event={row.original.event} />,
    },
    {
      accessorKey: 'entity',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('auditLog.col.entity')}
        />
      ),
      cell: ({ row }) => {
        const rawSlug = row.original.entity
        const className = configMap?.get(rawSlug) ?? rawSlug
        const label = t(`auditLog.entityLabels.${className}`, { defaultValue: className })
        // disabled check: match class name (config.entity = class name)
        const isDisabled = disabledEntitySet.has(className)
        return (
          <div className="flex items-center gap-1">
            <span>{label}</span>
            {isDisabled && (
              <span className="text-xs text-muted-foreground">
                {t('auditLog.filter.entityDisabled')}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'summary',
      header: () => <span>{t('auditLog.col.summary')}</span>,
      cell: ({ row }) => {
        const summary = summarizeDiff(row.original.from, row.original.to)
        return (
          <div className="max-w-[20rem] truncate text-sm">
            {summaryToText(summary, t)}
          </div>
        )
      },
    },
  ]
}
