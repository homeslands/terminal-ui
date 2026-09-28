import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import type { IWorkShiftInvoice } from '@/types'
import { formatCurrencyWithSymbol, getPaymentMethodLabel } from '@/utils'

interface Props {
  invoice: IWorkShiftInvoice | null
  isOpen: boolean
  onClose: () => void
}

function formatDateTime(input: string): string {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return input
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Một dòng label — value kiểu biên lai (label trái, value phải, canh đáy). */
function Line({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  )
}

const Dashed = () => (
  <div className="my-2 border-t border-dashed border-border" />
)

/**
 * Hoá đơn của một ca — hiển thị dạng biên lai F&B trong Dialog.
 * Payload hoá đơn ở mức tổng (không có line-item món); chi tiết món xem ở đơn.
 */
export function WorkShiftInvoiceDialog({ invoice, isOpen, onClose }: Props) {
  const { t } = useTranslation('workShift')
  const { t: tMenu } = useTranslation('menu')

  if (!invoice) return null

  const hasVoucher = !!invoice.voucherCode || (invoice.voucherValue ?? 0) > 0
  const isDelivery = !!invoice.deliveryTo || !!invoice.deliveryPhone

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-sm">
        {/* Đầu biên lai — canh giữa, kiểu hoá đơn quán */}
        <DialogHeader className="space-y-1 px-6 pb-3 pt-6 text-center">
          <DialogTitle className="text-center text-lg font-bold uppercase tracking-wide">
            {t('invoiceDetailTitle')}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            #{invoice.referenceNumber} · {formatDateTime(invoice.createdAt)}
          </p>
          {invoice.branchAddress && (
            <p className="text-xs text-muted-foreground">
              {invoice.branchAddress}
            </p>
          )}
        </DialogHeader>

        <div className="px-6 pb-6 text-sm">
          <Dashed />

          {/* Thông tin đơn */}
          <div>
            {invoice.type && (
              <Line
                label={t('invoiceType')}
                value={tMenu(`order.${invoice.type}`, {
                  defaultValue: invoice.type,
                })}
              />
            )}
            {invoice.tableName && (
              <Line label={t('invoiceTable')} value={invoice.tableName} />
            )}
            {invoice.customer && (
              <Line label={t('invoiceCustomer')} value={invoice.customer} />
            )}
            <Line label={t('invoiceCashier')} value={invoice.cashier} />
          </div>

          <Dashed />

          {/* Tiền */}
          <div>
            <Line
              label={t('invoicePaymentMethod')}
              value={getPaymentMethodLabel(invoice.paymentMethod)}
            />
            {(invoice.totalVatValue ?? 0) > 0 && (
              <Line
                label={t('invoiceVat')}
                value={formatCurrencyWithSymbol(invoice.totalVatValue ?? 0)}
              />
            )}
            {hasVoucher && (
              <Line
                label={
                  invoice.voucherCode
                    ? `${t('invoiceVoucher')} · ${invoice.voucherCode}`
                    : t('invoiceVoucher')
                }
                value={`- ${formatCurrencyWithSymbol(invoice.voucherValue ?? 0)}`}
              />
            )}
            {isDelivery && (invoice.deliveryFee ?? 0) > 0 && (
              <Line
                label={t('invoiceDeliveryFee')}
                value={formatCurrencyWithSymbol(invoice.deliveryFee ?? 0)}
              />
            )}
          </div>

          <Dashed />

          {/* Tổng cộng — nổi bật */}
          <div className="flex items-baseline justify-between gap-4 py-1">
            <span className="text-base font-bold">{t('invoiceAmount')}</span>
            <span className="text-lg font-bold tabular-nums text-pos-gold">
              {formatCurrencyWithSymbol(invoice.amount)}
            </span>
          </div>

          <p className="mt-4 text-center text-xs italic text-muted-foreground">
            {t('invoiceThankYou')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
