import { useTranslation } from 'react-i18next'
import { Minus, NotepadText, Plus, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Button, TabsContent } from '@/components/ui'
import { SubmittedOrdersDialog } from '@/components/staff/submitted-orders-dialog'
import { OrderItemPrice } from '@/components/app/order-item-price'
import { CustomPriceCard } from './admin-cart-custom-price-card'
import { getItemPriceDisplay } from '@/lib/order-item-display'
import { formatCurrency } from '@/utils'
import type { IOrder, IVoucher } from '@/types'
import type { OrderItem, SubmittedOrder } from '@/types/session'

interface AdminCartPendingItemsListProps {
  pending: OrderItem[]
  submitted: OrderItem[]
  submittedOrders?: SubmittedOrder[]
  submittedTotal: number
  sessionVoucher: IVoucher | null
  serverActiveOrder: IOrder | null | undefined
  onUpdateItem: (id: string, patch: Partial<OrderItem>) => void
  onUpdateNote: (id: string, note: string) => void
  onRemoveItem: (id: string) => void
  onClearPending?: () => void
  onSubmittedChanges: (
    changes: { orderItemSlug: string; newQty: number; newNote?: string }[],
  ) => Promise<void>
  onCancelOrder: () => Promise<void>
}

export function AdminCartPendingItemsList({
  pending,
  submitted,
  submittedOrders = [],
  submittedTotal,
  sessionVoucher,
  serverActiveOrder,
  onUpdateItem,
  onUpdateNote,
  onRemoveItem,
  onClearPending,
  onSubmittedChanges,
  onCancelOrder,
}: AdminCartPendingItemsListProps) {
  const { t } = useTranslation('menu')

  const allItems = [...submitted, ...pending]

  return (
    <TabsContent
      value="items"
      className="scrollbar-hide mt-0 min-h-0 flex-1 overflow-y-auto px-2 pt-3 data-[state=inactive]:hidden"
    >
      {allItems.length === 0 ? (
        <p className="py-8 text-center text-sm text-pos-muted">
          {t('order.emptyCart')}
        </p>
      ) : (
        <>
          {(submittedOrders?.length ?? 0) > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-pos-border/50 bg-pos-card/60 px-3 py-2">
              <span className="text-xs text-pos-muted">
                {t('order.submittedSummary', {
                  total: formatCurrency(submittedTotal),
                })}
              </span>
              <SubmittedOrdersDialog
                submittedOrders={submittedOrders}
                submittedTotal={submittedTotal}
                voucher={sessionVoucher}
                orderData={serverActiveOrder ?? null}
                onConfirmChanges={onSubmittedChanges}
                onCancelOrder={onCancelOrder}
              />
            </div>
          )}

          {pending.length > 0 && (
            <>
              <div
                className={`mb-1 flex items-center justify-between ${submitted.length > 0 ? 'mt-3' : ''}`}
              >
                <span className="text-[10px] uppercase tracking-wider text-pos-muted">
                  {t('order.pendingSection')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-destructive hover:bg-transparent hover:text-destructive/80"
                  onClick={onClearPending}
                >
                  {t('order.clearAll')}
                </Button>
              </div>
              <ul className="space-y-2">
                <AnimatePresence>
                  {pending.map((p) => {
                    const itemId =
                      p.rowId ?? p.customPriceId ?? p.menuItemId
                    if (p.isCustomPrice) {
                      return (
                        <CustomPriceCard
                          key={`p-${itemId}`}
                          item={p}
                          onUpdate={(patch) => onUpdateItem(itemId, patch)}
                          onUpdateNote={(note) => onUpdateNote(itemId, note)}
                          onRemove={() => onRemoveItem(itemId)}
                        />
                      )
                    }
                    return (
                      <motion.li
                        key={`p-${itemId}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -60 }}
                        transition={{ duration: 0.18 }}
                        className="flex flex-col gap-2 rounded-xl border border-pos-gold/40 bg-pos-gold/5 p-3 transition-colors"
                      >
                        {/* Row 1: name + line total */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-foreground xl:text-base">
                              {p.name}
                            </span>
                            {p.promotion && p.promotion.value > 0 && (
                              <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                                -{p.promotion.value}%
                              </span>
                            )}
                          </div>
                          {(() => {
                            const display = getItemPriceDisplay(
                              {
                                unitPrice:
                                  p.originalPrice ?? p.priceNum ?? 0,
                                quantity: p.quantity,
                                productSlug: p.productSlug ?? p.menuItemId,
                                promotionValue: p.promotion?.value,
                                isCustomPrice: p.isCustomPrice,
                                customPrice: p.isCustomPrice
                                  ? p.priceNum
                                  : null,
                              },
                              sessionVoucher,
                            )
                            return (
                              <OrderItemPrice
                                originalPrice={display.originalPrice}
                                finalPrice={display.finalPrice}
                                showStrikethrough={
                                  display.showStrikethrough
                                }
                                promoLabel={display.promoLabel}
                                voucherLabel={display.voucherLabel}
                                formatter={formatCurrency}
                                className="w-28"
                              />
                            )
                          })()}
                        </div>
                        {/* Row 2: size LEFT | qty CENTER | trash RIGHT */}
                        <div className="flex items-center justify-between">
                          {/* <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {p.size ? `(${p.size})` : ''}
                          </span> */}
                          <div className="flex items-center gap-2.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Giảm ${p.name}`}
                              onClick={() => {
                                if (p.quantity <= 1)
                                  onRemoveItem(itemId)
                                else
                                  onUpdateItem(itemId, {
                                    quantity: p.quantity - 1,
                                  })
                              }}
                              className="h-6 w-6 rounded-full border border-muted-foreground/40 text-muted-foreground hover:bg-muted/40"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-4 text-center text-sm font-medium">
                              {p.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Tăng ${p.name}`}
                              onClick={() =>
                                onUpdateItem(itemId, {
                                  quantity: p.quantity + 1,
                                })
                              }
                              className="h-6 w-6 rounded-full border border-muted-foreground/40 text-muted-foreground hover:bg-muted/40"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveItem(itemId)}
                            aria-label={`Xoá ${p.name}`}
                            className="h-6 w-6 text-destructive hover:bg-transparent hover:text-destructive/80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {/* Row 3: per-item note */}
                        <div className="flex items-center gap-2">
                          <NotepadText className="h-4 w-4 shrink-0 text-pos-gold" />
                          <input
                            type="text"
                            value={p.note ?? ''}
                            placeholder={t('order.itemNotePlaceholder')}
                            onChange={(e) =>
                              onUpdateItem(itemId, {
                                note: e.target.value,
                              })
                            }
                            className="h-7 flex-1 rounded-md border border-pos-gold/20 bg-background/80 px-2.5 text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-pos-gold"
                          />
                        </div>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            </>
          )}
        </>
      )}
    </TabsContent>
  )
}
