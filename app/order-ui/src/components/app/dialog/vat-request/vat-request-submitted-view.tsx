import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Locked view khi `status === SUBMITTED`. Cashier không submit lại được
 * (BE từ chối 409). Dialog hiển message confirm; nút Đóng nằm ở DialogFooter.
 */
export function VatRequestSubmittedView() {
  const { t } = useTranslation('menu')
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="rounded-full bg-emerald-100 p-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      </div>
      <div>
        <h3 className="text-base font-semibold">
          {t('vat.alreadySubmittedTitle', 'Yêu cầu VAT đã được ghi nhận')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('vat.alreadySubmittedBody', 'Khách sẽ nhận hoá đơn qua email trong vòng 24h.')}
        </p>
      </div>
    </div>
  )
}
