import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

import type { IWorkShiftSummary } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'
import {
  computeCashDifference,
  computeShiftDurationMinutes,
  formatShiftDuration,
} from '@/lib/work-shift-helpers'

import { CashReconciliation } from './cash-reconciliation'

interface Props {
  summary: IWorkShiftSummary
  /**
   * Chế độ đóng ca: hiện ô nhập tiền đếm thực tế ngay trong khối đối soát và
   * tính chênh lệch live từ giá trị đang nhập (ca vẫn ACTIVE nên BE chưa có
   * closingCash/cashDifference). Bỏ trống → panel read-only.
   */
  closingCashEditor?: {
    value: number | null
    input: ReactNode
  }
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string
  value: string
  testId: string
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 shadow-none">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        data-testid={testId}
        className="mt-1 text-lg font-bold leading-tight tabular-nums"
      >
        {value}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card p-3.5 shadow-none">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="mt-2.5 space-y-1.5">{children}</div>
    </div>
  )
}

/**
 * Hiển thị WorkShiftSummaryResponseDto theo chuẩn ngành F&B: doanh thu là số
 * chủ đạo trên cùng, hàng KPI gọn, rồi tới đối soát két tiền. Dùng chung cho
 * dialog đóng ca (kèm ô nhập tiền cuối ca), kết quả force-close và tab tổng kết
 * ở trang chi tiết ca.
 */
export function ShiftSummaryPanel({ summary, closingCashEditor }: Props) {
  const { t } = useTranslation('workShift')

  const { workShift } = summary
  const endMs = workShift.actualEndTime
    ? new Date(workShift.actualEndTime).getTime()
    : undefined
  const durationMinutes = computeShiftDurationMinutes(
    workShift.actualStartTime,
    endMs,
  )

  // Chế độ đóng ca: đếm live từ ô nhập. Read-only: dùng số BE.
  const editing = !!closingCashEditor
  const countedCash = editing ? closingCashEditor.value : summary.closingCash
  const difference = editing
    ? computeCashDifference({
        openingCash: summary.openingCash,
        closingCash: closingCashEditor.value,
        cashRevenue: summary.cashRevenue,
      })
    : summary.cashDifference

  return (
    <div className="space-y-3">
      {/* Doanh thu là số chủ đạo — đưa lên đầu, kèm thời lượng ca. */}
      <div className="rounded-lg border bg-card p-4 shadow-none">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t('totalRevenue')}
            </div>
            <div
              data-testid="shift-total-revenue"
              className="mt-0.5 text-2xl font-bold leading-tight tabular-nums text-pos-gold"
            >
              {formatCurrencyWithSymbol(summary.totalRevenue)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium tabular-nums">
              {formatShiftDuration(durationMinutes)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label={t('totalOrders')}
          value={String(summary.totalOrders)}
          testId="shift-total-orders"
        />
        <Stat
          label={t('totalInvoicesPaid')}
          value={String(summary.totalInvoicesPaid)}
          testId="shift-total-invoices"
        />
        <Stat
          label={t('crossShiftOrders')}
          value={String(summary.crossShiftOrdersCount)}
          testId="shift-cross-shift-count"
        />
        <Stat
          label={t('totalStaffWorked')}
          value={String(summary.totalStaffWorked)}
          testId="shift-total-staff"
        />
      </div>

      <CashReconciliation
        openingCash={summary.openingCash}
        cashRevenue={summary.cashRevenue}
        countedCash={countedCash}
        difference={difference}
        input={closingCashEditor?.input}
      />

      <Section title={t('paymentSummary')}>
        {summary.paymentSummary.map((row) => (
          <div
            key={row.paymentMethod}
            data-testid="payment-summary-row"
            className="flex items-center justify-between text-sm"
          >
            <span>
              <span data-testid="payment-method-name">{row.displayName}</span>
              <span className="ml-1 text-xs text-muted-foreground">
                ({row.invoiceCount})
              </span>
            </span>
            <span className="font-medium tabular-nums">
              {formatCurrencyWithSymbol(row.totalAmount)}
            </span>
          </div>
        ))}
      </Section>

      <Section title={t('staffSummary')}>
        {summary.staffSummary.map((row) => (
          <div
            key={row.staff.slug}
            data-testid="staff-summary-row"
            className="flex items-center justify-between text-sm"
          >
            <span>
              <span data-testid="staff-name">
                {row.staff.firstName} {row.staff.lastName}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">
                ({row.totalOrdersCreated} {t('ordersCreated').toLowerCase()})
              </span>
            </span>
            <span className="font-medium tabular-nums">
              {formatCurrencyWithSymbol(row.totalOrdersRevenue)}
            </span>
          </div>
        ))}
      </Section>

      {/* Ghi chú của ca: cashier nhập khi đóng ca, hoặc lý do force-close mà
          manager bắt buộc nhập — trước đây không màn nào hiện lại. */}
      {workShift.note && (
        <Section title={t('note')}>
          <p
            data-testid="shift-note"
            className="whitespace-pre-wrap text-sm"
          >
            {workShift.note}
          </p>
        </Section>
      )}
    </div>
  )
}
