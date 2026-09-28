import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { formatCurrency } from '@/utils'
import type { OrderItem } from '@/types/session'

interface AdminCartConfirmSubmitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingItems: OrderItem[]
  pendingTotalFinal: number
  isSubmitting: boolean
  onConfirm: () => void | Promise<void>
}

export function AdminCartConfirmSubmitDialog({
  open,
  onOpenChange,
  pendingItems,
  pendingTotalFinal,
  isSubmitting,
  onConfirm,
}: AdminCartConfirmSubmitDialogProps) {
  const { t } = useTranslation('menu')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('order.confirmOrderTitle')}</DialogTitle>
        </DialogHeader>
        <ul className="thin-scrollbar max-h-[40vh] space-y-1 overflow-y-auto pr-1 text-sm">
          {pendingItems.map((p) => {
            const itemId = p.customPriceId ?? p.menuItemId
            return (
              <li
                key={`confirm-${itemId}-${p.note}`}
                className="flex justify-between gap-2"
              >
                <span className="truncate">
                  {p.name} × {p.quantity}
                </span>
                <span className="shrink-0">
                  {formatCurrency((p.priceNum ?? 0) * p.quantity)}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-between border-t pt-2 text-sm font-semibold text-pos-gold">
          <span>{t('order.total')}</span>
          <span>{formatCurrency(pendingTotalFinal)}</span>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              {t('order.cancel')}
            </Button>
          </DialogClose>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-pos-gold text-white hover:bg-pos-gold/90"
          >
            {isSubmitting ? t('order.submitting') : t('order.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
