import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'
import { ForceCloseDialog } from '@/components/work-shift/force-close-dialog'
import { ShiftClosedSummaryDialog } from '@/components/work-shift/shift-closed-summary-dialog'
import { useActiveWorkShifts } from '@/hooks'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
  isLongShift,
} from '@/lib/work-shift-helpers'
import type { IWorkShiftSummary } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

export function ActiveTab() {
  const { t } = useTranslation('workShift')
  const [forceCloseSlug, setForceCloseSlug] = useState<string | null>(null)
  const [forceClosedSummary, setForceClosedSummary] =
    useState<IWorkShiftSummary | null>(null)

  // BE tự xác định phạm vi ca ACTIVE theo quyền của người gọi — FE không truyền
  // branchSlug (các endpoint work-shift hiện không dùng tới nó).
  const { data: shifts, isLoading } = useActiveWorkShifts()

  if (isLoading && !shifts) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!shifts || shifts.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {t('noActiveShift')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {shifts.map((shift) => {
          const minutes = computeShiftDurationMinutes(shift.actualStartTime)
          return (
            <div
              key={shift.slug}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {shift.cashier.firstName} {shift.cashier.lastName}
                  {isLongShift(minutes) && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                      {t('longShiftWarning')}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {shift.branch.name} · {formatShiftDuration(minutes)} ·{' '}
                  {shift.totalOrders} {t('totalOrders').toLowerCase()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-pos-gold">
                  {formatCurrencyWithSymbol(shift.totalRevenue)}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={ROUTE.SYSTEM_WORK_SHIFT_DETAIL.replace(
                      ':slug',
                      shift.slug,
                    )}
                  >
                    {t('shiftDetail')}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setForceCloseSlug(shift.slug)}
                >
                  {t('forceClose')}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {forceCloseSlug && (
        <ForceCloseDialog
          shiftSlug={forceCloseSlug}
          open={!!forceCloseSlug}
          onOpenChange={(open) => !open && setForceCloseSlug(null)}
          onForceClosed={(summary) => setForceClosedSummary(summary)}
        />
      )}

      {/* Tổng kết chính thức BE trả về sau khi đóng ép — gồm cả lý do
          (note) mà manager bắt buộc nhập. */}
      <ShiftClosedSummaryDialog
        summary={forceClosedSummary}
        isOpen={!!forceClosedSummary}
        onClose={() => setForceClosedSummary(null)}
      />
    </div>
  )
}
