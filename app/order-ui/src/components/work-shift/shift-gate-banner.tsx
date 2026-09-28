import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'

import type { TShiftGateReason } from '@/hooks'

interface Props {
  reason: TShiftGateReason
  className?: string
}

/** Banner giải thích vì sao nút thanh toán bị khoá. Không render khi reason = OK. */
export function ShiftGateBanner({ reason, className }: Props) {
  const { t } = useTranslation('workShift')

  if (reason === 'OK' || reason === 'UNKNOWN') return null

  const message =
    reason === 'STAFF_CANNOT_PAY'
      ? t('staffCannotPay')
      : t('noActiveShiftForPayment')

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive ${className ?? ''}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
