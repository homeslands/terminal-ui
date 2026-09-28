import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui'
import { Minus, Plus, Trash2, TriangleAlert } from 'lucide-react'
import type { SubmittedOrder } from '@/types/session'
import type { IOrder, IVoucher } from '@/types'
import { formatVnd } from '@/data/staff-data'
import { getItemPriceDisplay } from '@/lib/order-item-display'
import { showErrorToastMessage } from '@/utils'

interface ChangeItem {
  orderItemSlug: string
  newQty: number
  newNote?: string // present only when note was changed
}

interface Props {
  submittedOrders: SubmittedOrder[]
  submittedTotal: number
  voucher?: IVoucher | null
  /**
   * Server-authoritative active order for this table. Kept on the interface
   * for backward-compat with callers, but no longer used after the dialog
   * moved to Option A (KiotViet-style) per-row display via getItemPriceDisplay.
   */
  orderData?: IOrder | null
  onConfirmChanges: (changes: ChangeItem[]) => Promise<void>
  onCancelOrder: () => Promise<void>
  /** When true, hide all edit controls (qty +/-, trash, note input, Xác nhận) — view-only. */
  readonly?: boolean
}

export function SubmittedOrdersDialog({
  submittedOrders,
  submittedTotal: _submittedTotal,
  voucher,
  orderData: _orderData,
  onConfirmChanges,
  onCancelOrder,
  readonly = false,
}: Props) {
  const merged = useMemo(
    () => submittedOrders.flatMap((o) => o.items),
    [submittedOrders],
  )
  // Defensive: skip items without orderItemSlug (BE may not have assigned yet)
  const visibleItems = useMemo(
    () => merged.filter((i) => !!i.orderItemSlug),
    [merged],
  )
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCancelWarning, setShowCancelWarning] = useState(false)

  const openSnapshotKeyRef = useRef<string | null>(null)

  // Build a stable identifier for the current submittedOrders structure
  // (sorted orderItemSlugs joined). When this changes while open, the dialog
  // is showing outdated data — auto-close to force a fresh open.
  const currentKey = submittedOrders
    .flatMap((o) =>
      o.items.map((it) => it.orderItemSlug ?? `${it.menuItemId}:${it.note}`),
    )
    .sort()
    .join('|')

  useEffect(() => {
    if (open) {
      if (openSnapshotKeyRef.current === null) {
        openSnapshotKeyRef.current = currentKey
      } else if (openSnapshotKeyRef.current !== currentKey) {
        // Submitted order list changed under the user — close to force re-open.
        setOpen(false)
        openSnapshotKeyRef.current = null
        showErrorToastMessage('Dữ liệu đơn đã thay đổi, vui lòng mở lại để xem')
      }
    } else {
      openSnapshotKeyRef.current = null
    }
  }, [open, currentKey])

  useEffect(() => {
    if (!open) {
      setDraft({})
      setDraftNotes({})
    }
  }, [open])

  const handleOpen = () => {
    setDraft(
      Object.fromEntries(
        visibleItems.map((i) => [i.orderItemSlug!, i.quantity]),
      ),
    )
    setDraftNotes(
      Object.fromEntries(visibleItems.map((i) => [i.orderItemSlug!, i.note])),
    )
    setShowCancelWarning(false)
    setOpen(true)
  }

  const setQty = (orderItemSlug: string, qty: number) =>
    setDraft((prev) => ({ ...prev, [orderItemSlug]: Math.max(0, qty) }))

  const handleTrash = (orderItemSlug: string) => {
    if (readonly) return
    if (visibleItems.length === 1) {
      setShowCancelWarning(true)
      return
    }
    setQty(orderItemSlug, 0)
  }

  const handleConfirm = async () => {
    if (readonly) return
    const allRemoved = visibleItems.every(
      (item) => (draft[item.orderItemSlug!] ?? item.quantity) === 0,
    )
    if (allRemoved) {
      await handleCancelOrder()
      return
    }

    const changes: ChangeItem[] = visibleItems
      .filter((item) => {
        const slug = item.orderItemSlug!
        const draftQty = draft[slug] ?? item.quantity
        const draftNote = draftNotes[slug] ?? item.note
        return draftQty !== item.quantity || draftNote !== item.note
      })
      .map((item) => {
        const slug = item.orderItemSlug!
        const draftNote = draftNotes[slug] ?? item.note
        return {
          orderItemSlug: slug,
          newQty: draft[slug] ?? item.quantity,
          ...(draftNote !== item.note ? { newNote: draftNote } : {}),
        }
      })

    if (changes.length === 0) return

    setIsSubmitting(true)
    try {
      await onConfirmChanges(changes)
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelOrder = async () => {
    if (readonly) return
    setIsSubmitting(true)
    try {
      await onCancelOrder()
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasChanges = visibleItems.some((item) => {
    const slug = item.orderItemSlug!
    return (
      (draft[slug] ?? item.quantity) !== item.quantity ||
      (draftNotes[slug] ?? item.note) !== item.note
    )
  })

  // Option A (KiotViet style): per-row = unit-level finalPrice × qty.
  // finalPrice from getItemPriceDisplay = giá đang bán 1 đơn vị sau promo +
  // voucher (SAME_PRICE/AT_LEAST_ONE), chưa VAT. Footer = sum của (per row).
  const getLinePrice = (item: (typeof visibleItems)[number], qty: number) => {
    if (qty === 0) return 0
    const unitFinal = getItemPriceDisplay(
      {
        unitPrice: item.originalPrice ?? item.priceNum,
        quantity: 1,
        productSlug: item.productSlug ?? item.menuItemId,
        promotionValue: item.promotion?.value,
        isCustomPrice: item.isCustomPrice,
        customPrice: item.priceNum,
      },
      voucher ?? null,
    ).finalPrice
    return unitFinal * qty
  }

  const draftTotal = visibleItems.reduce((sum, item) => {
    const qty = draft[item.orderItemSlug!] ?? item.quantity
    return sum + getLinePrice(item, qty)
  }, 0)

  // "Tổng món hàng" footer — sum of per-row (unit finalPrice × submitted qty).
  const submittedDisplayTotal = visibleItems.reduce(
    (sum, item) => sum + getLinePrice(item, item.quantity),
    0,
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
      <Button
        variant="link"
        className="h-auto p-0 text-xs text-pos-gold"
        onClick={handleOpen}
      >
        Xem chi tiết
      </Button>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Món đã đặt</DialogTitle>
        </DialogHeader>

        {showCancelWarning ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">
                  Hủy toàn bộ đơn
                </p>
                <p className="mt-1 text-muted-foreground">
                  Đây là món cuối cùng. Xóa món này sẽ xóa đơn hàng và đóng
                  phiên bàn này.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelWarning(false)}
                disabled={isSubmitting}
              >
                Quay lại
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                onClick={handleCancelOrder}
              >
                {isSubmitting ? 'Đang hủy...' : 'Hủy đơn'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="-mx-6 max-h-[55vh] overflow-y-auto px-6">
              {visibleItems.map((item) => {
                const slug = item.orderItemSlug!
                const draftQty = draft[slug] ?? item.quantity
                const removed = draftQty === 0
                return (
                  <div
                    key={slug}
                    className={`flex flex-col gap-2 border-b border-border py-3 transition-opacity last:border-0 ${removed ? 'opacity-40' : ''}`}
                  >
                    {/* Top row: name + qty controls + price + trash */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex-1 text-sm ${removed ? 'line-through' : ''}`}
                      >
                        {item.name}
                        {item.note && (
                          <span className="ml-1 text-xs italic text-muted-foreground">
                            ({item.note})
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        {readonly ? (
                          <span
                            data-testid={`qty-${item.orderItemSlug}`}
                            className="w-7 text-center text-sm tabular-nums"
                          >
                            {item.isCustomPrice
                              ? `× ${item.quantity}`
                              : item.quantity}
                          </span>
                        ) : item.isCustomPrice ? (
                          // Custom-price items are fixed at quantity=1 — staff
                          // add a new entry per unit. Don't allow editing qty
                          // here either (matches add/edit dialog rule).
                          <span
                            data-testid={`qty-${item.orderItemSlug}`}
                            className="w-7 text-center text-sm tabular-nums text-muted-foreground"
                          >
                            × {draftQty}
                          </span>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              aria-label={`Giảm ${item.name}`}
                              disabled={draftQty <= 1}
                              onClick={() => setQty(slug, draftQty - 1)}
                              className="h-fit w-fit rounded-full border border-muted-foreground/30 p-1 disabled:opacity-30"
                            >
                              <Minus size={12} />
                            </Button>
                            <span
                              data-testid={`qty-${item.orderItemSlug}`}
                              className="w-7 text-center text-sm tabular-nums"
                            >
                              {draftQty}
                            </span>
                            <Button
                              variant="ghost"
                              aria-label={`Tăng ${item.name}`}
                              onClick={() => setQty(slug, draftQty + 1)}
                              className="h-fit w-fit rounded-full border border-muted-foreground/30 p-1"
                            >
                              <Plus size={12} />
                            </Button>
                          </>
                        )}
                      </div>
                      <span className="w-24 text-right text-xs tabular-nums text-pos-gold">
                        {removed
                          ? '—'
                          : formatVnd(getLinePrice(item, draftQty))}
                      </span>
                      {!readonly && (
                        <Button
                          variant="ghost"
                          aria-label={`Xóa ${item.name}`}
                          onClick={() => handleTrash(slug)}
                          className="h-fit w-fit rounded-full p-1 text-destructive hover:bg-destructive/30"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                    {/* Note input row */}
                    {!removed &&
                      (readonly ? (
                        item.note && (
                          <p className="text-xs italic text-pos-faint">
                            Ghi chú: {item.note}
                          </p>
                        )
                      ) : (
                        <input
                          type="text"
                          value={draftNotes[slug] ?? item.note}
                          placeholder="Ghi chú..."
                          onChange={(e) =>
                            setDraftNotes((prev) => ({
                              ...prev,
                              [slug]: e.target.value,
                            }))
                          }
                          className="h-7 rounded border border-border bg-muted/30 px-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-pos-gold"
                        />
                      ))}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  Tổng món hàng
                </span>
                <span className="text-sm font-bold text-pos-gold">
                  {formatVnd(hasChanges ? draftTotal : submittedDisplayTotal)}
                </span>
              </div>
              <div className="flex gap-2">
                {readonly ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Đóng
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpen(false)}
                      disabled={isSubmitting}
                    >
                      Huỷ
                    </Button>
                    <Button
                      size="sm"
                      disabled={!hasChanges || isSubmitting}
                      onClick={handleConfirm}
                      className="bg-pos-gold text-white hover:bg-pos-gold/80 disabled:opacity-40"
                    >
                      {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
