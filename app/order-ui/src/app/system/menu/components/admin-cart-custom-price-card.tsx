import { useTranslation } from 'react-i18next'
import { NotepadText, Pencil, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

import { Button } from '@/components/ui'
import { CustomPriceDialog } from '@/components/staff/custom-price-dialog'
import { formatCurrency } from '@/utils'
import type { OrderItem } from '@/types/session'

export function CustomPriceCard({
  item,
  onUpdate,
  onUpdateNote,
  onRemove,
}: {
  item: OrderItem
  onUpdate: (patch: {
    priceNum: number
    price: string
    quantity: number
  }) => void
  onUpdateNote: (note: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation('menu')

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-1.5 rounded-lg border border-orange-400/60 bg-orange-300/10 p-2"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold xl:text-sm">
            {item.name}
          </span>
          <span className="shrink-0 rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
            {t('order.customPriceBadge')}
          </span>
        </div>
        <span className="shrink-0 text-[14px] font-semibold text-orange-600">
          {(item.priceNum ?? 0) > 0 ? formatCurrency(item.priceNum ?? 0) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {item.quantity} ×{' '}
          {(item.priceNum ?? 0) > 0 ? formatCurrency(item.priceNum ?? 0) : '—'}
        </span>
        <div className="flex items-center gap-1">
          <CustomPriceDialog
            mode="edit"
            menuItemId={item.menuItemId}
            name={item.name}
            initialPrice={item.priceNum ?? 0}
            initialQuantity={item.quantity}
            onEdit={(priceNum, price, quantity) => {
              onUpdate({ priceNum, price, quantity })
            }}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Sửa giá ${item.name}`}
                className="h-6 w-6 hover:bg-muted/40"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Xoá ${item.name}`}
            className="h-6 w-6 text-destructive hover:bg-transparent hover:text-destructive/80"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <NotepadText className="h-3 w-3 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={item.note ?? ''}
          placeholder={t('order.itemNotePlaceholder')}
          onChange={(e) => onUpdateNote(e.target.value)}
          className="h-6 flex-1 rounded border border-muted-foreground/20 bg-background px-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </div>
    </motion.li>
  )
}
