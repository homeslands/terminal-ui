import { useTranslation } from 'react-i18next'

import {
  TableBookingDateFilterMode,
  TTableBookingDateFilterMode,
  TTableBookingStatus,
} from '@/types'
import { Button, ExcelIcon } from '@/components/ui'
import { CreateTableBookingDialog } from '@/components/app/dialog'
import { SimpleDatePicker } from '@/components/app/picker'
import {
  TableBookingDateFilterSelect,
  TableBookingStatusSelect,
} from '../../components'

interface TableBookingActionProps {
  fromDate: string
  toDate: string
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  dateFilterMode: TTableBookingDateFilterMode
  onDateFilterModeChange: (value: TTableBookingDateFilterMode) => void
  requestDate: string
  onRequestDateChange: (value: string) => void
  status: TTableBookingStatus | ''
  onStatusChange: (value: TTableBookingStatus | '') => void
  onExportExcel: () => void
  isExporting: boolean
}

// Date-range & status filter toolbar rendered on the right of the DataTable
// header (passed via the table's actionOptions slot).
export default function TableBookingAction({
  dateFilterMode,
  onDateFilterModeChange,
  requestDate,
  onRequestDateChange,
  status,
  onStatusChange,
  onExportExcel,
  isExporting,
}: TableBookingActionProps) {
  const { t } = useTranslation('tableBooking')
  return (
    <div className="flex gap-2 items-center">
      {/* Request-day mode filters by a single day, so the DataTable's range
          picker is hidden and this picker takes over. */}
      {dateFilterMode === TableBookingDateFilterMode.REQUEST_DATE && (
        <SimpleDatePicker
          value={requestDate}
          onChange={onRequestDateChange}
          // Requests can only have been made today or earlier.
          disableFutureDates
        />
      )}
      <TableBookingDateFilterSelect
        value={dateFilterMode}
        onChange={onDateFilterModeChange}
      />
      <TableBookingStatusSelect value={status} onChange={onStatusChange} />
      <Button
        variant="outline"
        className="gap-1"
        onClick={onExportExcel}
        disabled={isExporting}
      >
        <ExcelIcon className="icon" />
        {isExporting ? t('page.exporting') : t('page.exportExcel')}
      </Button>
      <CreateTableBookingDialog />
    </div>
  )
}
