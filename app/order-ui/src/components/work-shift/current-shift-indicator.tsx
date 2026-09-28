import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, Clock, PlayCircle } from 'lucide-react'

import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import { Role, ROUTE } from '@/constants'
import { useCurrentWorkShift } from '@/hooks'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
  isLongShift,
} from '@/lib/work-shift-helpers'
import { useUserStore } from '@/stores'
import type { IWorkShiftSummary } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

import { CloseShiftDialog } from './close-shift-dialog'
import { ShiftClosedSummaryDialog } from './shift-closed-summary-dialog'

interface Props {
  onShiftClosed?: () => void
}

/**
 * Chỉ báo ca trong AppHeader của SystemLayout (và header POS). Chỉ cho CASHIER:
 * badge xanh "Đang mở" + thời lượng/doanh thu + nút Đóng ca khi có ca; badge xám
 * "Chưa mở ca" + nút Mở ca khi chưa có. Tự tick mỗi 60s vì BE không trả durationMinutes.
 */
export function CurrentShiftIndicator({ onShiftClosed }: Props) {
  const { t } = useTranslation('workShift')
  const navigate = useNavigate()
  const [closeOpen, setCloseOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  // Tổng kết chính thức BE trả về sau khi đóng ca — giữ lại để hiện cho thu
  // ngân xem chênh lệch tiền mặt thật, rồi mới chạy onShiftClosed (điều hướng).
  const [closedSummary, setClosedSummary] = useState<IWorkShiftSummary | null>(
    null,
  )
  const [nowMs, setNowMs] = useState(() => Date.now())

  const role = useUserStore((s) => s.getUserInfo())?.role?.name
  const isCashier = role === Role.CASHIER
  const { data: shift, isFetched } = useCurrentWorkShift(isCashier)

  useEffect(() => {
    if (!shift) return
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
    // Depend on shift?.slug, not the whole `shift` object: the 30s
    // useCurrentWorkShift refetch returns a new object every time
    // totalRevenue/totalOrders change (i.e. constantly during service),
    // which was tearing down and recreating this interval before it ever
    // fired — freezing the elapsed-time display and isLongShift warning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift?.slug])

  if (!isCashier) return null

  // Chưa settle lần fetch đầu → chưa hiện gì (tránh chớp "Chưa mở ca" rồi đổi
  // sang "Đang mở"). isFetched true vĩnh viễn sau lần đầu nên không nháy.
  if (!isFetched) return null

  // Đã settle mà không có ca → badge "Chưa mở ca" + lối tắt mở ca.
  if (!shift) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 border-pos-border px-2.5 text-xs font-medium text-muted-foreground"
        onClick={() => navigate(ROUTE.SYSTEM_WORK_SHIFTS)}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        {t('notOpenedBadge')}
        <PlayCircle className="h-3.5 w-3.5 text-pos-gold" />
      </Button>
    )
  }

  const minutes = computeShiftDurationMinutes(shift.actualStartTime, nowMs)
  const isLong = isLongShift(minutes)

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge className="gap-1 border-transparent bg-green-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-green-500">
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
          {t('statusActive')}
        </Badge>

        {/* Hộp thời lượng·doanh thu là trigger popover — gộp nút Đóng ca vào
            trong để header gọn, không còn nút rời. */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-md border border-pos-border bg-pos-surface px-2.5 py-1 text-xs transition-colors hover:bg-accent"
            >
              {isLong ? (
                <AlertTriangle
                  className="h-3.5 w-3.5 text-amber-500"
                  aria-label={t('longShiftWarning')}
                />
              ) : (
                <Clock className="h-3.5 w-3.5 text-pos-gold" />
              )}
              <span className="font-medium">{formatShiftDuration(minutes)}</span>
              <span className="text-pos-muted">·</span>
              <span className="font-semibold text-pos-gold">
                {formatCurrencyWithSymbol(shift.totalRevenue)}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-sm font-semibold">
                    {shift.cashier.firstName} {shift.cashier.lastName}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {shift.branch.name}
                </div>
              </div>

              <div className="space-y-1.5 rounded-md border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('duration')}</span>
                  <span className="font-medium tabular-nums">
                    {formatShiftDuration(minutes)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t('totalOrders')}
                  </span>
                  <span className="font-medium tabular-nums">
                    {shift.totalOrders}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-1.5">
                  <span className="text-muted-foreground">
                    {t('totalRevenue')}
                  </span>
                  <span className="font-bold tabular-nums text-pos-gold">
                    {formatCurrencyWithSymbol(shift.totalRevenue)}
                  </span>
                </div>
              </div>

              {isLong && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {t('longShiftWarning')}
                </div>
              )}

              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  setPopoverOpen(false)
                  setCloseOpen(true)
                }}
              >
                {t('closeShift')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <CloseShiftDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        onClosed={(summary) => setClosedSummary(summary)}
      />

      {/* Hiện tổng kết trước, chạy onShiftClosed (điều hướng) sau khi thu ngân
          đóng dialog — nếu điều hướng ngay thì indicator unmount và tổng kết
          không bao giờ kịp hiện. */}
      <ShiftClosedSummaryDialog
        summary={closedSummary}
        isOpen={!!closedSummary}
        onClose={() => {
          setClosedSummary(null)
          onShiftClosed?.()
        }}
      />
    </>
  )
}
