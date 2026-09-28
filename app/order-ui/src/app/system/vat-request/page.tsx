import { useCallback, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import moment from 'moment'
import { Receipt, X } from 'lucide-react'

import { Button, DataTable } from '@/components/ui'
import { usePagination } from '@/hooks'
import { VatRequestDetailSheet } from '@/components/app/sheet/vat-request-detail-sheet'
import { useVatRequests } from '@/hooks/use-vat-admin'
import { VatRequestStatus, type IVatRequestListItem } from '@/types'

import VatFilter, {
  VatAdvancedFilterPopover,
  type VatAdvancedFilterValues,
} from './DataTable/actions/vat-filter'
import { useVatRequestColumns } from './DataTable/columns'

const STATUS_FILTER_ID = 'status'

export default function VatRequestListPage() {
  const { t } = useTranslation('vatAdmin')

  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  // Default = undefined (Tất cả) → đồng bộ với VatFilter Select hiển thị
  // "Tất cả" lúc mount. BE không nhận status → trả toàn bộ data.
  const [statusFilter, setStatusFilter] = useState<VatRequestStatus | undefined>(
    undefined,
  )
  // Search input của DataTable nay bind sang taxCode (theo Swagger BE).
  const [taxCode, setTaxCode] = useState('')
  // Today snapshot khi mount — dùng làm baseline so sánh "filter active" + dùng
  // làm default ban đầu (khớp default của DataTable's internal date picker để
  // tránh duplicate API call lúc mount).
  const initialToday = useMemo(() => moment().format('YYYY-MM-DD'), [])
  const [startDate, setStartDate] = useState(initialToday)
  const [endDate, setEndDate] = useState(initialToday)
  // Bump để force remount DataTable khi user "Xoá tất cả filter" — DataTable
  // có internal state (search input value, date picker, status select) page
  // không reset được từ ngoài. Remount = reset sạch sẽ.
  const [resetKey, setResetKey] = useState(0)
  // Advanced filter từ popover — 4 field text. Page sở hữu, popover apply về.
  const [advancedFilter, setAdvancedFilter] = useState<VatAdvancedFilterValues>(
    {
      customerName: '',
      email: '',
      invoiceNumber: '',
      referenceNumber: '',
    },
  )
  const [sheetRecord, setSheetRecord] = useState<IVatRequestListItem | null>(
    null,
  )

  const referenceNumberParam = advancedFilter.referenceNumber
    ? Number(advancedFilter.referenceNumber)
    : undefined

  const { data, isLoading, refetch } = useVatRequests({
    status: statusFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    taxCode: taxCode.trim() || undefined,
    customerName: advancedFilter.customerName || undefined,
    email: advancedFilter.email || undefined,
    invoiceNumber: advancedFilter.invoiceNumber || undefined,
    referenceNumber: Number.isFinite(referenceNumberParam)
      ? referenceNumberParam
      : undefined,
    page: pagination.pageIndex,
    size: pagination.pageSize,
  })

  const columns = useVatRequestColumns()
  const items = data?.items ?? []

  // Status filter options — single-select, 'all' = undefined (xoá filter).
  const filterConfig = useMemo(
    () => [
      {
        id: STATUS_FILTER_ID,
        label: t('column.status', 'Trạng thái'),
        options: [
          { label: t('filter.statusAll', 'Tất cả'), value: 'all' },
          ...Object.values(VatRequestStatus).map((s) => ({
            label: t(`status.${s}`, s),
            value: s,
          })),
        ],
      },
    ],
    [t],
  )

  const handleFilterChange = (filterId: string, value: string) => {
    if (filterId === STATUS_FILTER_ID) {
      setStatusFilter(value === 'all' ? undefined : (value as VatRequestStatus))
    }
  }

  const hasActiveFilter = useMemo(
    () =>
      statusFilter !== undefined ||
      taxCode.trim() !== '' ||
      startDate !== initialToday ||
      endDate !== initialToday ||
      Object.values(advancedFilter).some((v) => v !== ''),
    [statusFilter, taxCode, startDate, endDate, initialToday, advancedFilter],
  )

  const handleClearAll = useCallback(() => {
    const today = moment().format('YYYY-MM-DD')
    setStatusFilter(undefined)
    setTaxCode('')
    setStartDate(today)
    setEndDate(today)
    setAdvancedFilter({
      customerName: '',
      email: '',
      invoiceNumber: '',
      referenceNumber: '',
    })
    setResetKey((k) => k + 1)
  }, [])

  return (
    <div className="flex flex-col">
      <Helmet>
        <title>{t('title', 'Quản lý yêu cầu VAT')}</title>
      </Helmet>
      <span className="flex w-full items-center justify-start gap-1 text-lg">
        <Receipt />
        {t('title', 'Quản lý yêu cầu VAT')}
      </span>

      <div className="grid h-full grid-cols-1">
        <DataTable
          key={resetKey}
          columns={columns}
          data={items}
          isLoading={isLoading}
          pages={Math.max(1, Math.ceil((data?.total ?? 0) / pagination.pageSize))}
          hiddenInput={false}
          searchPlaceholder={t('filter.taxCodePlaceholder', 'Nhập mã số thuế')}
          onInputChange={setTaxCode}
          hiddenDatePicker={false}
          onDateChange={(start, end) => {
            setStartDate(start)
            setEndDate(end)
          }}
          filterOptions={VatFilter}
          filterConfig={filterConfig}
          onFilterChange={handleFilterChange}
          toolbarExtra={
            <div className="flex items-center gap-2">
              <VatAdvancedFilterPopover
                value={advancedFilter}
                onApply={setAdvancedFilter}
              />
              {hasActiveFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  data-testid="vat-clear-all-filters"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('filter.clearAll', 'Xoá tất cả filter')}
                </Button>
              )}
            </div>
          }
          onRefresh={() => refetch()}
          onRowClick={(row) => setSheetRecord(row)}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />

        <VatRequestDetailSheet
          vatRequest={sheetRecord}
          onClose={() => setSheetRecord(null)}
        />
      </div>
    </div>
  )
}
