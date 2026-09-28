import { formatVnd } from '@/data/staff-data'

interface Props {
  /** Giá gốc × qty (variant.price * quantity hoặc originalPrice * qty) */
  originalPrice: number
  /** Giá thực tế customer phải trả × qty */
  finalPrice: number
  /** Có hiển thị strikethrough lên originalPrice không */
  showStrikethrough: boolean
  /** Optional badge promotion (vd "-20%") */
  promoLabel?: string
  /** Optional badge voucher (vd "Voucher") */
  voucherLabel?: string
  /** Tailwind className cho width container — default w-28 */
  className?: string
  /** Optional money formatter — default formatVnd (POS staff style).
   *  Admin surfaces có thể truyền formatCurrency để đồng bộ với theme. */
  formatter?: (n: number) => string
}

export function OrderItemPrice({
  originalPrice,
  finalPrice,
  showStrikethrough,
  promoLabel,
  voucherLabel,
  className = 'w-28',
  formatter = formatVnd,
}: Props) {
  if (!showStrikethrough) {
    return (
      <div className={`flex shrink-0 flex-col items-end ${className}`}>
        <span className="text-lg font-bold tabular-nums text-pos-gold">
          {formatter(finalPrice)}
        </span>
        {(promoLabel || voucherLabel) && (
          <div className="flex gap-1">
            {promoLabel && (
              <span
                title="Đang áp khuyến mãi"
                className="rounded bg-pos-gold/10 px-1.5 text-[10px] font-semibold text-pos-gold"
              >
                {promoLabel}
              </span>
            )}
            {voucherLabel && (
              <span
                title="Voucher đang áp dụng"
                className="rounded bg-purple-100 px-1.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              >
                {voucherLabel}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className={`flex shrink-0 flex-col items-end ${className}`}>
      <span className="text-xs tabular-nums text-pos-muted line-through">
        {formatter(originalPrice)}
      </span>
      <span className="text-lg font-bold tabular-nums text-pos-gold">
        {formatter(finalPrice)}
      </span>
      {(promoLabel || voucherLabel) && (
        <div className="flex gap-1">
          {promoLabel && (
            <span
              title="Đang áp khuyến mãi"
              className="rounded bg-pos-gold/10 px-1.5 text-[10px] font-semibold text-pos-gold"
            >
              {promoLabel}
            </span>
          )}
          {voucherLabel && (
            <span
              title="Voucher đang áp dụng"
              className="rounded bg-purple-100 px-1.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            >
              {voucherLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
