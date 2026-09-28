import { useMemo } from 'react'
import type { SubmittedOrder } from '@/types/session'
import { mergeOrderItems } from '@/lib/staff-orders'
import { STAFF_ADMIN_SETTINGS, formatVnd } from '@/data/staff-data'

interface Props {
  tableLabel: string
  orders: SubmittedOrder[]
  isDraft: boolean
  issuedAt: string
}

export function ReceiptPreview({ tableLabel, orders, isDraft, issuedAt }: Props) {
  const merged = useMemo(() => mergeOrderItems(orders), [orders])
  const total = merged.reduce((s, m) => s + m.priceNum * m.quantity, 0)
  const date = new Date(issuedAt)

  return (
    <div className="relative mx-auto max-w-sm bg-white p-4 text-xs text-black">
      {isDraft && (
        <div
          data-testid="watermark"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-5xl font-extrabold tracking-widest text-gray-300 print:hidden"
          style={{ transform: 'rotate(-25deg)' }}
        >
          BẢN TẠM
        </div>
      )}

      <header className="text-center">
        <h1 className="text-base font-bold">{STAFF_ADMIN_SETTINGS.restaurantName}</h1>
        <p className="text-[10px]">{STAFF_ADMIN_SETTINGS.address}</p>
        <p className="text-[10px]">ĐT: {STAFF_ADMIN_SETTINGS.phone}</p>
      </header>

      <h2 className="my-2 text-center text-sm font-bold uppercase">
        {isDraft ? 'Hoá đơn tạm' : 'Hoá đơn'}
      </h2>

      <div className="flex justify-between">
        <span>{tableLabel}</span>
        <span>{date.toLocaleString('vi-VN')}</span>
      </div>

      <hr className="my-2 border-dashed border-black" />

      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th className="py-0.5">Món</th>
            <th className="py-0.5 text-center">SL</th>
            <th className="py-0.5 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {merged.map((m) => (
            <tr key={m.menuItemId}>
              <td className="py-0.5">{m.name}</td>
              <td data-testid={`row-qty-${m.menuItemId}`} className="py-0.5 text-center">
                {m.quantity}
              </td>
              <td className="py-0.5 text-right">{formatVnd(m.priceNum * m.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="my-2 border-dashed border-black" />

      <div className="flex justify-between text-sm font-bold">
        <span>Tổng cộng</span>
        <span data-testid="receipt-total">{formatVnd(total)}</span>
      </div>

      <p className="mt-1 text-[10px] italic">Giá đã bao gồm VAT</p>
      <p className="mt-3 text-center text-[10px]">Cảm ơn quý khách. Hẹn gặp lại!</p>
    </div>
  )
}
