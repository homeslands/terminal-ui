import { Button } from '@/components/ui'
import { formatVnd } from '@/data/staff-data'
import OrderSuccessImage from '@/assets/images/order-success.png'

interface Props {
  tableName: string
  total: number
  paymentMethod: 'cash' | 'transfer' | 'card'
  /** Khoản tiền khách đưa (chỉ relevant với cash) */
  amount?: number
  /** Tiền thừa trả khách (chỉ relevant với cash) */
  change?: number
  /** Cashier click để về floor plan */
  onBackToFloor: () => void
}

export function PaymentSuccessScreen({
  tableName,
  total,
  paymentMethod,
  amount,
  change,
  onBackToFloor,
}: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-pos-card px-8 py-10 text-pos-text">
      <img
        src={OrderSuccessImage}
        alt=""
        className="h-40 w-40 object-contain"
      />

      <div className="text-center">
        <h1 className="text-3xl font-bold text-pos-gold">
          Thanh toán thành công
        </h1>
        <p className="mt-2 text-sm text-pos-muted">
          Bàn {tableName} ·{' '}
          {paymentMethod === 'cash'
            ? 'Tiền mặt'
            : paymentMethod === 'transfer'
              ? 'Chuyển khoản'
              : 'Thẻ tín dụng'}
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3 rounded-xl border border-pos-border bg-pos-surface p-5 shadow-sm">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-pos-muted">
            Tổng thu
          </span>
          <span className="text-3xl font-bold text-pos-gold">
            {formatVnd(total)}
          </span>
        </div>
        {paymentMethod === 'cash' && amount != null && (
          <div className="space-y-2 border-t border-pos-border pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-pos-muted">Khách đưa</span>
              <span className="text-sm font-semibold">{formatVnd(amount)}</span>
            </div>
            {change != null && change > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-pos-muted">Tiền thừa</span>
                <span className="text-sm font-bold text-pos-gold">
                  {formatVnd(change)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        onClick={onBackToFloor}
        className="h-12 w-full max-w-sm bg-pos-gold text-base font-bold text-white hover:bg-pos-gold/80"
      >
        VỀ MÀN BÀN
      </Button>
    </div>
  )
}
