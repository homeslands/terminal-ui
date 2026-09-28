import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import moment from 'moment'
import { Loader2, Search } from 'lucide-react'

import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { DateRangeComparePopover } from '@/components/app/popover'
import {
  Role,
  ROUTE,
  formatRangeLabel,
  presetToValue,
  type DateFilterValue,
} from '@/constants'
import { useWorkShifts } from '@/hooks'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
} from '@/lib/work-shift-helpers'
import { cn } from '@/lib'
import { useUserStore } from '@/stores'
import { WorkShiftStatus } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

const PAGE_SIZE = 10
const STATUS_ALL = 'ALL'

/** Lịch sử ca mặc định không giới hạn thời gian — 'allTime' là preset duy nhất
 * diễn đạt được điều đó, và được dịch ngược thành "không gửi ngày" ở query. */
const allTimeFilter = (): DateFilterValue => ({
  ...presetToValue('allTime'),
  compareEnabled: false,
  compareStart: '',
  compareEnd: '',
})

/** Giờ mở/đóng ca dạng hh:mm dd/mm/yyyy. Trả "—" khi chưa đóng (end null). */
function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

function ShiftStatusBadge({ status }: { status: WorkShiftStatus }) {
  const { t } = useTranslation('workShift')
  const isActive = status === WorkShiftStatus.ACTIVE
  return (
    <Badge
      className={cn(
        'gap-1 shadow-none border-transparent px-2 py-0.5 text-[11px] font-semibold',
        isActive
          ? 'bg-green-500 text-white hover:bg-green-500'
          : 'bg-muted text-muted-foreground hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isActive ? 'bg-white/90' : 'bg-muted-foreground/60',
        )}
      />
      {isActive ? t('statusActive') : t('statusClosed')}
    </Badge>
  )
}

export function HistoryTab() {
  const { t } = useTranslation('workShift')
  const { t: tCustomer } = useTranslation('customer')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<WorkShiftStatus | undefined>(undefined)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(allTimeFilter)
  const [cashierSlug, setCashierSlug] = useState('')

  // Popover nói chuyện bằng 'YYYY-MM-DDTHH:mm:ss'; API ca làm việc nhận
  // 'YYYY-MM-DD'. 'allTime' chỉ là cách nói "bỏ lọc" nên không gửi ngày nào cả.
  const isAllTime = dateFilter.activePreset === 'allTime'
  const startDate = isAllTime
    ? undefined
    : moment(dateFilter.startDate).format('YYYY-MM-DD')
  const endDate = isAllTime
    ? undefined
    : moment(dateFilter.endDate).format('YYYY-MM-DD')

  const role = useUserStore((s) => s.getUserInfo())?.role?.name
  const isCashier = role === Role.CASHIER
  // Cashier chỉ xem ca của chính mình (BE tự lọc) → không có ô tìm theo thu ngân.
  const canSearchCashier = !isCashier

  const { data, isLoading } = useWorkShifts({
    page,
    size: PAGE_SIZE,
    status,
    startDate,
    endDate,
    cashierSlug: canSearchCashier ? cashierSlug.trim() || undefined : undefined,
  })

  const shifts = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  /** Mọi thay đổi filter phải reset về trang 1, nếu không sẽ hiện trang rỗng. */
  const applyFilter = (fn: () => void) => {
    fn()
    setPage(1)
  }

  // Nút popover chỉ nói nó mở ra cái gì, không tóm tắt khoảng ngày — nên khoảng
  // đang áp dụng phải được đọc lại ở đâu đó, nếu không người dùng lọc xong
  // không biết mình đang xem phạm vi nào.
  const rangeLabel = formatRangeLabel(
    dateFilter.activePreset,
    dateFilter.startDate,
    dateFilter.endDate,
    tCustomer('customer.registrationDashboard.presetAllTime'),
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canSearchCashier ? (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label={t('filterCashier')}
              placeholder={t('filterCashier')}
              value={cashierSlug}
              onChange={(e) => applyFilter(() => setCashierSlug(e.target.value))}
              className="pl-8"
            />
          </div>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
          <DateRangeComparePopover
            value={dateFilter}
            onApply={(next) => applyFilter(() => setDateFilter(next))}
            showCompare={false}
          />
          <Select
            value={status ?? STATUS_ALL}
            onValueChange={(v) =>
              applyFilter(() =>
                setStatus(v === STATUS_ALL ? undefined : (v as WorkShiftStatus)),
              )
            }
          >
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STATUS_ALL}>{t('filterStatus')}</SelectItem>
              <SelectItem value={WorkShiftStatus.ACTIVE}>
                {t('statusActive')}
              </SelectItem>
              <SelectItem value={WorkShiftStatus.CLOSED}>
                {t('statusClosed')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && shifts.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t('emptyHistory')}
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => {
            const endMs = shift.actualEndTime
              ? new Date(shift.actualEndTime).getTime()
              : undefined
            const minutes = computeShiftDurationMinutes(
              shift.actualStartTime,
              endMs,
            )
            return (
              <Link
                key={shift.slug}
                to={ROUTE.SYSTEM_WORK_SHIFT_DETAIL.replace(':slug', shift.slug)}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3.5 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {shift.cashier.firstName} {shift.cashier.lastName}
                    </span>
                    <ShiftStatusBadge status={shift.status} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(shift.actualStartTime)} →{' '}
                    {formatDateTime(shift.actualEndTime)} ·{' '}
                    {formatShiftDuration(minutes)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-pos-gold">
                    {formatCurrencyWithSymbol(shift.totalRevenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {shift.totalOrders} {t('totalOrders').toLowerCase()}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            aria-label={t('paginationPrev')}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            aria-label={t('paginationNext')}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </Button>
        </div>
      </div>
    </div>
  )
}
