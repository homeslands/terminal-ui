import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  Button,
} from '@/components/ui'
import type { OrderItem } from '@/types/session'
import { formatVnd } from '@/data/staff-data'

interface Props {
  pendingItems: OrderItem[]
  pendingTotal: number
  disabled: boolean
  onConfirm: () => void
  /**
   * When true, both trigger button (ĐẶT MÓN) and inner XÁC NHẬN button are
   * disabled to prevent duplicate submits during a pending network request.
   */
  submitting?: boolean
}

export function ConfirmOrderDialog({ pendingItems, pendingTotal, disabled, onConfirm, submitting }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          disabled={disabled || submitting}
          className="w-full bg-pos-gold text-white text-sm font-semibold hover:bg-pos-gold/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'ĐANG GỬI…' : 'ĐẶT MÓN'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Xác nhận đặt món</DialogTitle>
        </DialogHeader>
        <ul className="space-y-1 text-sm">
          {pendingItems.map((p) => (
            <li key={p.menuItemId} className="flex justify-between">
              <span>{p.name} × {p.quantity}</span>
              <span>{formatVnd(p.priceNum * p.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between text-sm font-semibold text-pos-gold">
          <span>Tổng</span>
          <span>{formatVnd(pendingTotal)}</span>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="outline">HỦY</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              onClick={onConfirm}
              disabled={submitting}
              className="bg-pos-gold text-white hover:bg-pos-gold/80"
            >
              {submitting ? 'ĐANG GỬI…' : 'XÁC NHẬN'}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
