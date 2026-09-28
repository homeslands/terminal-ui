import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SquareMenu } from 'lucide-react'
import moment from 'moment'

import { DataTable } from '@/components/ui'
import { UpdateTableBookingDialog } from '@/components/app/dialog'
import {
  useExportTableBookingsExcel,
  usePagination,
  useTableBookings,
} from '@/hooks'
import {
  IGetTableBookingQuery,
  ITableBooking,
  TableBookingDateFilterMode,
  TTableBookingDateFilterMode,
  TTableBookingStatus,
} from '@/types'
import { DEFAULT_PRESET, presetToRange } from '@/constants'
import { showToast } from '@/utils'
import { useTableBookingColumns } from './DataTable/columns'
import { TableBookingAction } from './DataTable/actions'

export default function TableBookingPage() {
  const { t } = useTranslation('tableBooking')
  const { t: tToast } = useTranslation('toast')
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  const [searchParams, setSearchParams] = useSearchParams()
  // Notifications link here with ?date=YYYY-MM-DD to filter bookings by day.
  const dateParam = searchParams.get('date')
  const isValidDateParam =
    !!dateParam && moment(dateParam, 'YYYY-MM-DD', true).isValid()
  const [search, setSearch] = useState('')
  // SimpleDatePicker emits "YYYY-MM-DD". Defaults to the current week.
  const [fromDate, setFromDate] = useState(() =>
    isValidDateParam ? dateParam : presetToRange(DEFAULT_PRESET).from,
  )
  const [toDate, setToDate] = useState(() =>
    isValidDateParam ? dateParam : presetToRange(DEFAULT_PRESET).to,
  )
  const [status, setStatus] = useState<TTableBookingStatus | ''>('')
  // Which date filter drives the list: the reserved booking date-time
  // (fromDate/toDate) or the day the booking request was made (createdDate).
  const [dateFilterMode, setDateFilterMode] =
    useState<TTableBookingDateFilterMode>(
      TableBookingDateFilterMode.BOOKING_DATE,
    )
  const [requestDate, setRequestDate] = useState(() =>
    moment().format('YYYY-MM-DD'),
  )
  // Booking whose details are shown in the dialog; set by clicking a row.
  const [selectedBooking, setSelectedBooking] = useState<ITableBooking | null>(
    null,
  )
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Apply the date param again if it changes while the page is already mounted
  // (e.g. clicking another notification from this page).
  useEffect(() => {
    if (isValidDateParam) {
      // The notification's date targets the booking day, so make sure the
      // range filter is the one in effect.
      setDateFilterMode(TableBookingDateFilterMode.BOOKING_DATE)
      setFromDate(dateParam)
      setToDate(dateParam)
    }
  }, [dateParam, isValidDateParam])

  const columns = useTableBookingColumns((booking) => {
    setSelectedBooking(booking)
    setIsDetailOpen(true)
  })

  // A numeric search is treated as a phone lookup, otherwise as a name lookup.
  const trimmedSearch = search.trim()
  const isPhoneSearch = /^\d+$/.test(trimmedSearch)

  // API expects the dates as "dd/MM/yyyy". Only the active mode's date
  // filter is sent — the other params stay undefined.
  const isBookingDateMode =
    dateFilterMode === TableBookingDateFilterMode.BOOKING_DATE
  const fromDateParam =
    isBookingDateMode && fromDate
      ? moment(fromDate, 'YYYY-MM-DD').format('DD/MM/YYYY')
      : undefined
  const toDateParam =
    isBookingDateMode && toDate
      ? moment(toDate, 'YYYY-MM-DD').format('DD/MM/YYYY')
      : undefined
  const requestDateParam =
    !isBookingDateMode && requestDate
      ? moment(requestDate, 'YYYY-MM-DD').format('DD/MM/YYYY')
      : undefined

  // Filters shared by the list and the Excel export.
  const filterParams: IGetTableBookingQuery = {
    name: !isPhoneSearch && trimmedSearch ? trimmedSearch : undefined,
    phone: isPhoneSearch && trimmedSearch ? trimmedSearch : undefined,
    fromDate: fromDateParam,
    toDate: toDateParam,
    createdDate: requestDateParam,
    status: status || undefined,
  }

  const { data, isLoading, refetch } = useTableBookings({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    hasPaging: true,
    ...filterParams,
  })

  const { mutate: exportExcel, isPending: isExporting } =
    useExportTableBookingsExcel()

  // The export ignores paging, so every booking matching the filters is included.
  const handleExportExcel = () => {
    exportExcel(filterParams, {
      onSuccess: () => showToast(t('toast.exportSuccess')),
    })
  }

  const bookings = data?.result?.items ?? []
  const totalPages = data?.result?.totalPages ?? 0

  // Prefer the fresh row from the current list so the open dialog reflects
  // updates (e.g. a status change) after the query refetches; fall back to
  // the clicked snapshot if the row left the filtered list.
  const detailBooking = selectedBooking
    ? (bookings.find((b) => b.slug === selectedBooking.slug) ?? selectedBooking)
    : null

  // Drop the notification's date param once the user picks their own dates,
  // so clicking the same notification again re-applies its date.
  const clearDateParam = () => {
    if (dateParam) {
      searchParams.delete('date')
      setSearchParams(searchParams, { replace: true })
    }
  }

  // "Reset all data" — restore the default range and clear other filters.
  const handleRefresh = () => {
    setSearch('')
    setDateFilterMode(TableBookingDateFilterMode.BOOKING_DATE)
    setFromDate(presetToRange(DEFAULT_PRESET).from)
    setToDate(presetToRange(DEFAULT_PRESET).to)
    setRequestDate(moment().format('YYYY-MM-DD'))
    setStatus('')
    clearDateParam()
    refetch()
    showToast(tToast('toast.refreshSuccess'))
  }

  return (
    <div className="grid grid-cols-1 w-full h-full">
      <Helmet>
        <title>{t('page.helmet')}</title>
      </Helmet>

      <div className="flex flex-col gap-1">
        <h1 className="flex gap-2 items-center text-lg font-semibold">
          <SquareMenu />
          {t('page.title')}
        </h1>
      </div>

      <div className="grid grid-cols-1 h-full">
        <DataTable
          isLoading={isLoading}
          columns={columns}
          data={bookings}
          pages={totalPages}
          hiddenInput={false}
          // The built-in range picker only applies to booking-date-time
          // mode; request-day mode uses the single-day picker in the
          // action toolbar instead.
          hiddenDatePicker={!isBookingDateMode}
          // Bookings are made for future dates, so the range filter must
          // allow picking days after today.
          disableFutureDates={false}
          hasTomorrow
          initialStartDate={isValidDateParam ? dateParam : undefined}
          initialEndDate={isValidDateParam ? dateParam : undefined}
          onDateChange={(start, end) => {
              setFromDate(start)
              setToDate(end)
          }}
          searchPlaceholder={t('page.searchPlaceholder')}
          onInputChange={setSearch}
          onRowClick={(booking) => {
            setSelectedBooking(booking)
            setIsDetailOpen(true)
          }}
          actionOptions={() => (
            <TableBookingAction
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              dateFilterMode={dateFilterMode}
              onDateFilterModeChange={setDateFilterMode}
              requestDate={requestDate}
              onRequestDateChange={setRequestDate}
              status={status}
              onStatusChange={setStatus}
              onExportExcel={handleExportExcel}
              isExporting={isExporting}
            />
          )}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRefresh={handleRefresh}
        />
      </div>

      <UpdateTableBookingDialog
        booking={detailBooking}
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  )
}
