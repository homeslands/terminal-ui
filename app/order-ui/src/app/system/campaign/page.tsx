import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '@/components/ui'
import { useCampaigns, usePagination } from '@/hooks'
import { CAMPAIGN_STATUS, CAMPAIGN_TYPE } from '@/constants'
import { ICampaign } from '@/types'
import { CampaignInfoSheet } from '@/components/app/sheet'
import { useCampaignColumns } from './DataTable/columns'
import { CampaignTableActions } from './DataTable/actions'
import CampaignFilterOptions from './DataTable/actions/campaign-filter'

export function CampaignPage() {
  const { t } = useTranslation('campaign')
  const { t: tCommon } = useTranslation('common')
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()

  const [statusFilter, setStatusFilter] = useState<CAMPAIGN_STATUS | undefined>()
  const [typeFilter, setTypeFilter] = useState<CAMPAIGN_TYPE | undefined>()
  const [startDate, setStartDate] = useState<string | undefined>()
  const [endDate, setEndDate] = useState<string | undefined>()

  const [selectedCampaign, setSelectedCampaign] = useState<ICampaign | null>(null)
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false)

  const { data, isLoading } = useCampaigns({
    hasPaging: true,
    page: pagination.pageIndex,
    limit: pagination.pageSize,
    status: statusFilter,
    type: typeFilter,
    startDate,
    endDate,
  })

  const filterConfig = [
    {
      id: 'status',
      label: t('campaign.status'),
      options: [
        { label: tCommon('dataTable.all'), value: 'all' },
        { label: t('campaign.statuses.opening'), value: CAMPAIGN_STATUS.OPENING },
        { label: t('campaign.statuses.scheduled'), value: CAMPAIGN_STATUS.SCHEDULED },
        { label: t('campaign.statuses.closed'), value: CAMPAIGN_STATUS.CLOSED },
      ],
    },
    {
      id: 'type',
      label: t('campaign.type'),
      options: [
        { label: tCommon('dataTable.all'), value: 'all' },
        { label: t('campaign.types.new-user'), value: CAMPAIGN_TYPE.NEW_USER },
        { label: t('campaign.types.user-birthday'), value: CAMPAIGN_TYPE.BIRTHDAY },
      ],
    },
  ]

  const handleFilterChange = (filterId: string, value: string) => {
    if (filterId === 'status') {
      setStatusFilter(value === 'all' ? undefined : (value as CAMPAIGN_STATUS))
    }
    if (filterId === 'type') {
      setTypeFilter(value === 'all' ? undefined : (value as CAMPAIGN_TYPE))
    }
  }

  const handleRowClick = (campaign: ICampaign) => {
    setSelectedCampaign(campaign)
    setIsInfoSheetOpen(true)
  }

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <DataTable
        columns={useCampaignColumns()}
        data={data?.result?.items ?? []}
        isLoading={isLoading}
        pages={data?.result?.totalPages ?? 1}
        actionOptions={CampaignTableActions}
        filterOptions={CampaignFilterOptions}
        filterConfig={filterConfig}
        onFilterChange={handleFilterChange}
        hiddenDatePicker={false}
        onDateChange={(start, end) => {
          setStartDate(start || undefined)
          setEndDate(end || undefined)
        }}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onRowClick={handleRowClick}
      />
      <CampaignInfoSheet
        campaign={selectedCampaign}
        isOpen={isInfoSheetOpen}
        onOpenChange={setIsInfoSheetOpen}
      />
    </div>
  )
}

export default CampaignPage
