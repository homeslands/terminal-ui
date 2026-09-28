import { useMemo } from 'react'
import { Button } from '../ui'
import type { SubmittedOrder } from '@/types/session'
import { mergeOrderItems } from '@/lib/staff-orders'
import { formatVnd } from '@/data/staff-data'

interface Props {
  tableId: string
  tableLabel: string
  orders: SubmittedOrder[]
  isDraft: boolean
  onClose: () => void
  onDone?: () => void
}

export function ReceiptDialog({ tableId, tableLabel, orders, isDraft, onClose, onDone }: Props) {
  const merged = useMemo(() => mergeOrderItems(orders), [orders])
  const total = merged.reduce((s, m) => s + m.priceNum * m.quantity, 0)
  const now = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

  const handlePrint = () => {
    window.open(`/staff/table/${tableId}/receipt?draft=${isDraft}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div
        data-testid="receipt-backdrop"
        onClick={onClose}
        className="absolute inset-0"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-lg bg-pos-surface sm:rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pos-border px-4 py-3">
          <div>
            <p className="text-sm font-bold text-pos-text">{tableLabel}</p>
            <p className="text-xs text-pos-dim">{now}</p>
          </div>
          {isDraft && (
            <span className="rounded bg-pos-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-pos-muted">
              Hoá đơn tạm
            </span>
          )}
        </div>

        {/* Items */}
        <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
          <div className="mb-2 flex text-[10px] font-bold uppercase tracking-widest text-pos-faint">
            <span className="flex-1">Món</span>
            <span className="w-8 text-center">SL</span>
            <span className="w-20 text-right">Thành tiền</span>
          </div>
          <ul className="space-y-2">
            {merged.map((m) => (
              <li key={`${m.menuItemId}::${m.note}`} className="py-1.5 text-sm">
                <div className="flex items-baseline gap-3">
                  <span className="w-7 shrink-0 text-center text-xs font-semibold text-pos-dim">
                    {m.quantity}×
                  </span>
                  <span className="flex-1 text-pos-text">{m.name}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-pos-gold">
                    {formatVnd(m.priceNum * m.quantity)}
                  </span>
                </div>
                {m.note && (
                  <p className="ml-10 mt-0.5 text-xs text-pos-dim italic">{m.note}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Total */}
        <div className="flex items-baseline justify-between border-t border-pos-border px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-widest text-pos-muted">Tổng cộng</span>
          <span data-testid="receipt-total" className="text-lg font-bold text-pos-gold">
            {formatVnd(total)}
          </span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 border-t border-pos-border p-3">
          <Button variant="outline" onClick={onClose}>ĐÓNG</Button>
          <Button variant="outline" onClick={handlePrint}>IN</Button>
          {onDone && (
            <Button onClick={onDone} className="col-span-2">HOÀN TẤT</Button>
          )}
        </div>
      </div>
    </div>
  )
}
