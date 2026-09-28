/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslation } from 'react-i18next'

import { useAnalyzePointTransactions, useExportSystemPointTransactions, useIsMobile, usePagination, useSystemPointTransactions } from '@/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PointTransactionType } from '@/constants'
import { useCallback, useMemo, useState } from 'react'
import { SortContext } from '@/contexts'
import { Button, Collapsible, CollapsibleContent, DataTable, DateRangePicker, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { usePointTransactionColumns } from '@/app/system/card-order-history/DataTable/columns/point-transaction-columns'
import { ArrowUpIcon, CoinsIcon, DownloadIcon, FilterIcon, TagIcon, TrendingDownIcon, TrendingUpIcon, XIcon } from 'lucide-react'
import _ from 'lodash'
import moment from 'moment'
import { ArrowDownIcon } from '@radix-ui/react-icons'
import { formatCurrency } from '@/utils'
import { saveAs } from 'file-saver'
import { useDebounce } from 'use-debounce'

const defaultFilter = {
  type: PointTransactionType.ALL,
  fromDate: moment().format('YYYY-MM-DD'),
  toDate: moment().format('YYYY-MM-DD'),
  k: '',
}

export function SystemTransactionPointHistoryTabContent() {

  const { t } = useTranslation(['profile'])
  const isMobile = useIsMobile()
  const [isFilterOpen, setIsFilterOpen] = useState(true)
  const [filter, setFilter] = useState<any>(defaultFilter);
  const [debounceKeyword] = useDebounce(filter.k, 500);
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()

  // const payload = {
  //   page: pagination.pageIndex,
  //   size: pagination.pageSize,
  //   type: filter?.type === PointTransactionType.ALL ? null : filter.type,
  //   fromDate: filter.fromDate,
  //   toDate: filter.toDate,
  //   k: debounceKeyword,
  // }

   
  const buildPayload = () => {
    let payload: any = {
      page: pagination.pageIndex,
      size: pagination.pageSize,
      type: filter?.type === PointTransactionType.ALL ? null : filter.type,
      // k: debounceKeyword,
    }

    if (filter.fromDate) {
      payload = {
        ...payload,
        fromDate: filter?.fromDate,
      }
    }

    if (filter.toDate) {
      payload = {
        ...payload,
        toDate: filter?.toDate,
      }
    }

    if (debounceKeyword) {
      payload = {
        ...payload,
        k: debounceKeyword,
      }
    }
    return payload;
  }

  const { isLoading, data, refetch } = useSystemPointTransactions(buildPayload());

  const { data: analyzeData, isLoading: isLoadingAnalysis } = useAnalyzePointTransactions(buildPayload());

  const { mutate: exportMutation, isPending } = useExportSystemPointTransactions();
  const pointTransactions = useMemo(() => {
    return data?.result?.items || []
  }, [data])

  const totalCount = data?.result?.total || 0;

  const summary = useMemo(() => {
    const totalEarned = pointTransactions.filter(item => item.type === PointTransactionType.IN)
      .reduce((prev, curr) => prev + curr?.points, 0);
    const totalSpent = pointTransactions.filter(item => item.type === PointTransactionType.OUT)
      .reduce((prev, curr) => prev + curr?.points, 0);;
    const netDifference = Math.abs(totalEarned - totalSpent);
    return {
      totalEarned,
      totalSpent,
      netDifference
    }
  }, [pointTransactions])

  const handleClearFilter = () => {
    setFilter(defaultFilter)
  }

  const hasActiveFilters = () => {
    if (_.isEmpty(filter)) return false;
    const filtered = _.pickBy(filter, v => v !== null && v !== undefined && v !== '');
    return !_.isEmpty(filtered);
  }

  const handleDateRangeChange = useCallback((dateRange: { startDate: string; endDate: string }) => {
    setFilter((prev: any) => {
      return {
        ...prev,
        fromDate: dateRange.startDate,
        toDate: dateRange.endDate
      }
    })
  }, [filter.fromDate, filter.toDate])

  const handleSortChange = () => { }

  const handleRefresh = () => {
    handlePageChange(1)
    refetch()
  }

  const handleExport = () => {
    const ITEM_MAX = 1000000;
    const params = {
      ...filter,
      page: pagination.pageIndex,
      size: ITEM_MAX,
      type: filter?.type === PointTransactionType.ALL ? null : filter.type,
      ignoreSize: true
    }
    exportMutation(params, {
      onSuccess: (data) => {
        saveAs(data.blob, data.filename);
      },
    })
  }

  // Coin Summary Cards Component
  const PointTransactionSummary = () => {
    if (isLoadingAnalysis) {
      return (
        <div className="mb-6">
          <div
            className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4 lg:grid-cols-3'}`}
          >
            {Array(3)
              .fill(0)
              .map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="mb-2 h-4 bg-gray-200 rounded"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )
    }

    const summaryItems = [
      {
        title: t('profile.totalEarned'),
        value: analyzeData?.result?.totalEarned || 0,
        icon: TrendingUpIcon,
        color: 'text-green-600',
        bg: 'bg-green-50 dark:bg-green-900/10',
        border: 'border-green-200 dark:border-green-800',
        iconBg:
          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      },
      {
        title: t('profile.totalSpent'),
        value: analyzeData?.result?.totalSpent || 0,
        icon: TrendingDownIcon,
        color: 'text-red-600',
        bg: 'bg-red-50 dark:bg-red-900/10',
        border: 'border-red-200 dark:border-red-800',
        iconBg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      },
      {
        title: t('profile.netDifference'),
        value: analyzeData?.result?.netDifference || 0,
        icon: summary.netDifference >= 0 ? ArrowUpIcon : ArrowDownIcon,
        color: summary.netDifference >= 0 ? 'text-green-600' : 'text-red-600',
        bg:
          summary.netDifference >= 0
            ? 'bg-green-50 dark:bg-green-900/10'
            : 'bg-red-50 dark:bg-red-900/10',
        border:
          summary.netDifference >= 0
            ? 'border-green-200 dark:border-green-800'
            : 'border-red-200 dark:border-red-800',
        iconBg:
          summary.netDifference >= 0
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      },
    ]

    return (
      <div className="mb-6">
        <div
          className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4 lg:grid-cols-3'}`}
        >
          {summaryItems.map((item, index) => (
            <Card
              key={index}
              className={`border ${item.border} ${item.bg} shadow-sm transition-shadow hover:shadow-md`}
            >
              <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <p
                      className={`mb-1 text-xs font-medium text-gray-600 dark:text-gray-400 ${isMobile ? 'text-[10px]' : ''}`}
                    >
                      {item.title}
                    </p>
                    <div
                      className={`flex items-center gap-1 ${item.color} font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}
                    >
                      <span>{formatCurrency(Math.abs(item.value), '')}</span>
                      <CoinsIcon
                        className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`}
                      />
                    </div>
                  </div>
                  <div className={`rounded-full p-2 ${item.iconBg}`}>
                    <item.icon size={isMobile ? 16 : 20} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Card className="overflow-hidden border-none shadow-md">
        <CardHeader
          className={`${isMobile ? 'px-3 py-2' : 'px-6 py-4'} bg-gray-50 dark:bg-gray-800/50`}
        >
          <div className="flex gap-2 justify-between items-center">
            <CardTitle
              className={`${isMobile ? 'text-sm' : 'text-lg'} flex items-center gap-2`}
            >
              <span className="p-1 text-orange-600 bg-orange-100 rounded-full dark:bg-orange-900/30 dark:text-orange-300">
                <TagIcon size={isMobile ? 16 : 18} />
              </span>
              {t('profile.coinTransactions')}
              <span className="m1-2 text-xs text-gray-500 dark:text-white">
                ({totalCount})
              </span>
            </CardTitle>

            {/* Action Buttons */}
            <div
              className={`flex items-center gap-2 ${isMobile && 'flex-col'}`}
            >
              {/* Export Transaction Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isPending || totalCount === 0}
                className="flex min-w-[120px] items-center gap-2"
              >
                <DownloadIcon size={16} />
                {t('profile.exportAll')}
              </Button>

              {/* Filter Toggle Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`${hasActiveFilters() ? 'border-primary text-primary' : ''} min-w-[120px]`}
              >
                <FilterIcon size={16} className="mr-2" />
                {t('profile.filter')}
                {hasActiveFilters() && (
                  <span className="ml-1 text-xl text-primary">•</span>
                )}
              </Button>
            </div>
          </div>

          {/* Filter Panel */}
          <Collapsible open={isFilterOpen}>
            <CollapsibleContent className="my-3">
              <div className="p-4 bg-white rounded-lg border shadow-sm dark:bg-gray-800">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Date time range picker */}
                  <DateRangePicker startDate={filter.fromDate} endDate={filter.toDate} onDateRangeChange={handleDateRangeChange} />
                  {/* Transaction Type */}
                  <div className="space-y-2">
                    <Select
                      value={filter.type}
                      onValueChange={(value: PointTransactionType) =>
                        setFilter({ ...filter, type: value })
                      }
                    >
                      <SelectTrigger className='dark:border-gray-700 bg-background w-40'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PointTransactionType.ALL}>
                          {t('profile.allTransactions')}
                        </SelectItem>
                        <SelectItem value={PointTransactionType.IN}>
                          {t('profile.coinEarned')}
                        </SelectItem>
                        <SelectItem value={PointTransactionType.OUT}>
                          {t('profile.coinSpent')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Fullname */}
                  <div className="space-y-2">
                    <Input className='text-sm dark:border-gray-700 bg-background w-64' placeholder={t('profile.searchPlaceholer')} value={filter.k} onChange={
                      e => setFilter({
                        ...filter, k: e.target.value
                      })
                    } />
                  </div>
                </div>

                {/* Filter Actions */}
                <Button
                  onClick={handleClearFilter}
                  variant="outline"
                  size="sm"
                  disabled={!hasActiveFilters()}
                  className='mt-4'
                >
                  <XIcon className="mr-2 w-4 h-4" />
                  {t('profile.clearFilter')}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {/* Point transaction summary */}
          <PointTransactionSummary />
        </CardHeader>

        <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
          {
            <div className="space-y-1">
              <SortContext.Provider value={{ onSort: handleSortChange }}>
                <DataTable
                  columns={usePointTransactionColumns({ page: data?.result.page || 0, size: data?.result?.pageSize || 0 })}
                  data={pointTransactions}
                  isLoading={isLoading}
                  pages={data?.result.totalPages || 0}
                  hiddenDatePicker={true}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  onRefresh={handleRefresh}
                // onRowClick={(row) => {
                //   setSelectedRow(row)
                // }}
                />
              </SortContext.Provider>
            </div>
          }
        </CardContent>
      </Card>
    </div>
  )
}
