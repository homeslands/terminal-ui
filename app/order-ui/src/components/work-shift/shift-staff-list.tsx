import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import type { IWorkShiftStaffSummaryItem } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

interface Props {
  staff: IWorkShiftStaffSummaryItem[]
  isLoading?: boolean
}

/** Nhân viên đã tạo order trong ca, kèm số đơn và doanh thu. */
export function ShiftStaffList({ staff, isLoading }: Props) {
  const { t } = useTranslation('workShift')

  if (isLoading && staff.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (staff.length === 0) {
    return (
      <div
        data-testid="shift-staff-empty"
        className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {t('emptyStaff')}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {staff.map((row) => (
        <div
          key={row.staff.slug}
          className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="font-semibold">
              {row.staff.firstName} {row.staff.lastName}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {row.staff.phonenumber} · {row.totalOrdersCreated}{' '}
              {t('ordersCreated').toLowerCase()}
            </div>
          </div>
          <span className="font-medium">
            {formatCurrencyWithSymbol(row.totalOrdersRevenue)}
          </span>
        </div>
      ))}
    </div>
  )
}
