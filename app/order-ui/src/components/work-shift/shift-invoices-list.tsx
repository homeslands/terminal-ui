import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import type { IWorkShiftInvoice } from '@/types'
import { formatCurrencyWithSymbol, getPaymentMethodLabel } from '@/utils'

import { WorkShiftInvoiceDialog } from './work-shift-invoice-dialog'

interface Props {
  invoices: IWorkShiftInvoice[]
  isLoading?: boolean
}

function formatHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Hoá đơn đã thanh toán trong ca (theo invoice.workShift).
 * Bấm một hoá đơn → mở sheet chi tiết đầy đủ.
 */
export function ShiftInvoicesList({ invoices, isLoading }: Props) {
  const { t } = useTranslation('workShift')
  const [selected, setSelected] = useState<IWorkShiftInvoice | null>(null)

  if (isLoading && invoices.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div
        data-testid="shift-invoices-empty"
        className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {t('emptyInvoices')}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {invoices.map((invoice) => (
        <button
          key={invoice.slug}
          type="button"
          onClick={() => setSelected(invoice)}
          className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left text-sm shadow-none transition-colors hover:bg-accent"
        >
          <div className="min-w-0">
            <div className="font-semibold">#{invoice.referenceNumber}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatHHMM(invoice.createdAt)} ·{' '}
              {getPaymentMethodLabel(invoice.paymentMethod)} · {invoice.cashier}
            </div>
          </div>
          <span className="shrink-0 font-medium">
            {formatCurrencyWithSymbol(invoice.amount)}
          </span>
        </button>
      ))}

      {selected && (
        <WorkShiftInvoiceDialog
          invoice={selected}
          isOpen={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
