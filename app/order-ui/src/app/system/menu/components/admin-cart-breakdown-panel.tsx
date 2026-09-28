import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { formatCurrency } from '@/utils'
import type { OrderBreakdown } from '@/lib/order-breakdown'

interface AdminCartBreakdownPanelProps {
  breakdown: OrderBreakdown
}

export function AdminCartBreakdownPanel({
  breakdown,
}: AdminCartBreakdownPanelProps) {
  return (
    <div className="space-y-1 border-t pt-2">
      {/* 1. Tổng tiền hàng (catalog × qty) */}
      <div className="flex items-baseline justify-between text-xs text-pos-muted">
        <span>Tổng tiền hàng</span>
        <span className="tabular-nums">
          {formatCurrency(breakdown.tongTienHang)}
        </span>
      </div>

      {/* 2. Giảm khuyến mãi (with tooltip when dropped by voucher) */}
      {(breakdown.promotionDiscount > 0 ||
        breakdown.isPromoDroppedByVoucher) && (
        <div className="flex items-baseline justify-between text-xs">
          <span
            className={`inline-flex items-center gap-1 ${
              breakdown.isPromoDroppedByVoucher
                ? 'text-muted-foreground'
                : 'text-emerald-600'
            }`}
          >
            Giảm khuyến mãi
            {breakdown.isPromoDroppedByVoucher && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Khuyến mãi không áp dụng khi món đang dùng voucher
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </span>
          <span
            className={`tabular-nums ${
              breakdown.isPromoDroppedByVoucher
                ? 'text-muted-foreground'
                : 'text-emerald-600'
            }`}
          >
            -{formatCurrency(breakdown.promotionDiscount)}
          </span>
        </div>
      )}

      {/* 3. Voucher discount */}
      {breakdown.voucherDiscount > 0 && (
        <div className="flex items-baseline justify-between gap-2 text-xs text-emerald-600">
          <span className="min-w-0 flex-1 truncate">
            Mã giảm giá
            {breakdown.voucherCode ? ` (${breakdown.voucherCode})` : ''}
          </span>
          <span className="tabular-nums whitespace-nowrap">
            -{formatCurrency(breakdown.voucherDiscount)}
          </span>
        </div>
      )}

      {/* 4. Tạm tính sau giảm (pre-VAT) */}
      <div className="flex items-baseline justify-between border-t pt-1 text-xs text-foreground">
        <span>Tạm tính sau giảm</span>
        <span className="tabular-nums">
          {formatCurrency(breakdown.preVatTotal)}
        </span>
      </div>

      {/* 5. VAT */}
      {breakdown.vatAmount > 0 && (
        <div className="flex items-baseline justify-between text-xs italic text-muted-foreground">
          <span>{breakdown.vatRateLabel}</span>
          <span className="tabular-nums">
            +{formatCurrency(breakdown.vatAmount)}
          </span>
        </div>
      )}

      {/* 6. Tổng thanh toán */}
      <div className="flex items-baseline justify-between border-t pt-1">
        <span className="text-sm font-semibold text-foreground">
          Tổng thanh toán
        </span>
        <span className="text-xl font-bold tabular-nums text-pos-gold">
          {formatCurrency(breakdown.total)}
        </span>
      </div>
    </div>
  )
}
