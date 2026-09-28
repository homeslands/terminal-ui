import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui'
import { ICampaign } from '@/types'
import { CAMPAIGN_STATUS, CAMPAIGN_TYPE } from '@/constants'
import { CampaignActions } from './campaign-actions'

const statusConfig: Record<CAMPAIGN_STATUS, { variant: 'default' | 'secondary' | 'outline'; className?: string }> = {
  [CAMPAIGN_STATUS.OPENING]: { variant: 'outline', className: 'bg-green-500 text-white' },
  [CAMPAIGN_STATUS.SCHEDULED]: { variant: 'secondary' },
  [CAMPAIGN_STATUS.CLOSED]: { variant: 'outline', className: 'bg-destructive text-white' },
}

export function useCampaignColumns(): ColumnDef<ICampaign>[] {
  const { t } = useTranslation('campaign')

  return [
    {
      accessorKey: 'name',
      header: t('campaign.name'),
    },
    {
      accessorKey: 'type',
      header: t('campaign.type'),
      cell: ({ row }) => {
        const type = row.getValue<CAMPAIGN_TYPE>('type')
        const labelKey = type === CAMPAIGN_TYPE.NEW_USER ? 'new-user' : 'user-birthday'
        return <span>{t(`campaign.types.${labelKey}`)}</span>
      },
    },
    {
      accessorKey: 'status',
      header: t('campaign.status'),
      cell: ({ row }) => {
        const status = row.getValue<CAMPAIGN_STATUS>('status')
        const { variant, className } = statusConfig[status]
        return (
          <Badge variant={variant} className={className}>
            {t(`campaign.statuses.${status}`)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'startDate',
      header: t('campaign.startDate'),
      cell: ({ row }) => new Date(row.getValue<string>('startDate')).toLocaleDateString('vi-VN'),
    },
    {
      accessorKey: 'endDate',
      header: t('campaign.endDate'),
      cell: ({ row }) => new Date(row.getValue<string>('endDate')).toLocaleDateString('vi-VN'),
    },
    {
      accessorKey: 'recipientLimit',
      header: t('campaign.recipientLimit'),
    },
    {
      id: 'actions',
      cell: ({ row }) => <CampaignActions campaign={row.original} />,
    },
  ]
}
