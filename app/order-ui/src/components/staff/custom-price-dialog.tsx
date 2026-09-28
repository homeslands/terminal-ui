import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label } from '@/components/ui'
import { formatVnd } from '@/data/staff-data'
import type { OrderItem } from '@/types/session'

interface AddProps {
  mode?: 'add'
  menuItemId: string
  name: string
  /** Variant slug of the underlying product. Required for the BE order endpoint. */
  variantSlug?: string
  /** Product slug; used downstream for de-duplication / voucher applicability. */
  productSlug?: string
  /** Per-item VAT rate; default 0 when unknown. */
  vatRate?: number
  onAdd: (item: Omit<OrderItem, 'note'>) => void
  trigger: React.ReactNode
}

interface EditProps {
  mode: 'edit'
  menuItemId: string
  name: string
  initialPrice: number
  /** Always 1 for custom-price items; kept for back-compat with existing callers. */
  initialQuantity?: number
  onEdit: (priceNum: number, price: string, quantity: number) => void
  trigger: React.ReactNode
}

type Props = AddProps | EditProps

/**
 * Custom-price items are always quantity = 1 — staff add them per-unit so the
 * BE customPrice maps to one row. The dialog therefore no longer exposes a
 * quantity selector; the value passed to onAdd / onEdit is fixed at 1.
 */
const FIXED_QUANTITY = 1

export function CustomPriceDialog(props: Props) {
  const { menuItemId, name, trigger } = props
  const isEdit = props.mode === 'edit'

  const [open, setOpen] = useState(false)
  const [priceRaw, setPriceRaw] = useState('')

  useEffect(() => {
    if (open && isEdit) {
      setPriceRaw(String((props as EditProps).initialPrice))
    }
    if (!open) {
      setPriceRaw('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const price = priceRaw ? Number(priceRaw) : 0
  const canConfirm = price > 0

  const displayPrice = priceRaw
    ? Number(priceRaw).toLocaleString('vi-VN').replace(/,/g, '.')
    : ''

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPriceRaw(e.target.value.replace(/\D/g, ''))
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    if (isEdit) {
      ;(props as EditProps).onEdit(price, formatVnd(price), FIXED_QUANTITY)
    } else {
      ;(props as AddProps).onAdd({
        menuItemId,
        customPriceId: crypto.randomUUID(),
        name,
        priceNum: price,
        price: formatVnd(price),
        quantity: FIXED_QUANTITY,
        isCustomPrice: true,
        variantSlug: (props as AddProps).variantSlug,
        productSlug: (props as AddProps).productSlug,
        originalPrice: price,
        promotion: null,
        vatRate: (props as AddProps).vatRate ?? 0,
      })
      setPriceRaw('')
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base">{name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="custom-price-input" className="text-xs font-medium text-muted-foreground">
              Giá (đ)
            </Label>
            <Input
              id="custom-price-input"
              type="text"
              inputMode="numeric"
              value={displayPrice}
              onChange={handlePriceChange}
              placeholder="Nhập giá..."
              aria-label="Giá món"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-xs text-muted-foreground">Thành tiền</span>
            <span className="text-sm font-bold text-primary">
              {canConfirm ? formatVnd(price) : '—'}
            </span>
          </div>
        </div>

        <Button
          disabled={!canConfirm}
          onClick={handleConfirm}
          className="w-full bg-pos-gold text-white hover:bg-pos-gold/80 disabled:opacity-40"
        >
          {isEdit ? 'Lưu thay đổi' : 'Thêm vào đơn'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
