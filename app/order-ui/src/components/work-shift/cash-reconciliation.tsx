import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib'
import { formatCurrencyWithSymbol } from '@/utils'

type TCashVariant = 'surplus' | 'shortage' | 'exact' | 'pending'

function cashVariant(diff: number | null): TCashVariant {
  if (diff === null) return 'pending'
  if (diff > 0) return 'surplus'
  if (diff < 0) return 'shortage'
  return 'exact'
}

const CASH_VARIANT_CLASS: Record<TCashVariant, string> = {
  surplus: 'text-emerald-600 dark:text-emerald-400',
  shortage: 'text-destructive',
  exact: 'text-emerald-600 dark:text-emerald-400',
  pending: 'text-muted-foreground',
}

interface Props {
  openingCash: number
  cashRevenue: number
  /** Tiền đếm thực tế: số BE trả (read-only) hoặc số cashier đang nhập. */
  countedCash: number | null
  /**
   * Chênh lệch = đếm thực tế − dự kiến trong két. Read-only truyền số BE;
   * chế độ đóng ca truyền số tính live từ ô nhập. null → ca chưa đóng.
   */
  difference: number | null
  /**
   * Ô nhập tiền đếm thực tế cho luồng đóng ca. Có → render input thay cho số;
   * không → hiển thị số read-only (tab chi tiết, kết quả force-close).
   */
  input?: ReactNode
}

/**
 * Đối soát két tiền theo chuẩn ngành F&B: đầu ca + tiền mặt bán ra = dự kiến
 * trong két, so với tiền đếm thực tế ra chênh lệch. Dùng chung cho dialog đóng
 * ca (có ô nhập, chênh lệch preview) và các màn read-only (tab chi tiết,
 * force-close).
 */
export function CashReconciliation({
  openingCash,
  cashRevenue,
  countedCash,
  difference,
  input,
}: Props) {
  const { t } = useTranslation('workShift')

  const expected = openingCash + cashRevenue
  const variant = cashVariant(difference)
  const cashLabel: Record<TCashVariant, string> = {
    surplus: t('cashDifferenceSurplus'),
    shortage: t('cashDifferenceShortage'),
    exact: t('cashDifferenceExact'),
    pending: t('cashDifferencePending'),
  }

  return (
    <div className="rounded-lg border bg-card p-3.5 shadow-none">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('cashDifference')}
      </div>
      <div className="mt-2.5 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('openingCash')}</span>
          <span className="tabular-nums">
            {formatCurrencyWithSymbol(openingCash)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('cashRevenue')}</span>
          <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
            + {formatCurrencyWithSymbol(cashRevenue)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5 font-semibold">
          <span>{t('expectedCash')}</span>
          <span className="tabular-nums">
            {formatCurrencyWithSymbol(expected)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <span className="text-muted-foreground">{t('countedCash')}</span>
          {input ? (
            <div className="w-40">{input}</div>
          ) : (
            <span className="tabular-nums">
              {countedCash === null
                ? '—'
                : formatCurrencyWithSymbol(countedCash)}
            </span>
          )}
        </div>
        <div
          data-testid="cash-difference"
          data-variant={variant}
          className={cn(
            'flex items-center justify-between border-t pt-1.5 font-semibold',
            CASH_VARIANT_CLASS[variant],
          )}
        >
          <span>{cashLabel[variant]}</span>
          <span className="tabular-nums">
            {difference === null ? '—' : formatCurrencyWithSymbol(difference)}
          </span>
        </div>
      </div>
    </div>
  )
}
