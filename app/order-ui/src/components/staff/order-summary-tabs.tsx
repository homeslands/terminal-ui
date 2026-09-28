import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, NotepadText, Pencil, Plus, Trash2 } from 'lucide-react'

import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import type { OrderItem, SubmittedOrder, TableCustomer } from '@/types/session'
import type { IOrder, IVoucher } from '@/types'
import { formatVnd } from '@/data/staff-data'
import { OrderItemPrice } from '@/components/app/order-item-price'
import { getItemPriceDisplay } from '@/lib/order-item-display'
import { useUserStore } from '@/stores'
import ConfirmClearCustomerDialog from '@/components/app/dialog/confirm-clear-customer-dialog'
import { CustomPriceDialog } from './custom-price-dialog'
import { StaffOrderNoteInput } from './staff-order-note-input'
import { StaffCustomerSearchInput } from './staff-customer-search-input'
import { StaffTableVoucherSheet } from './staff-table-voucher-sheet'
import { SubmittedOrdersDialog } from './submitted-orders-dialog'

interface Props {
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  submittedTotal: number
  /** Server-authoritative active order; passed through to SubmittedOrdersDialog. */
  orderData?: IOrder | null
  onUpdateItem: (
    itemId: string,
    patch: {
      quantity?: number
      note?: string
      priceNum?: number
      price?: string
    },
  ) => void
  onRemoveItem: (menuItemId: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  onConfirmChanges: (
    changes: {
      orderItemSlug: string
      newQty: number
      newNote?: string
    }[],
  ) => Promise<void>
  onCancelOrder: () => Promise<void>
  customer: TableCustomer | null
  voucher: IVoucher | null
  onCustomerSelect: (customer: TableCustomer) => void
  onCustomerClear: () => void
  onApplyVoucher: (voucher: IVoucher) => void | Promise<void>
  onRemoveVoucher: () => void | Promise<void>
  voucherDisabled?: boolean
  /** When true, SubmittedOrdersDialog renders in read-only mode (STAFF). */
  submittedReadonly?: boolean
}

export function OrderSummaryTabs({
  pendingItems,
  submittedOrders,
  submittedTotal,
  orderData,
  onUpdateItem,
  onRemoveItem,
  description,
  onDescriptionChange,
  onConfirmChanges,
  onCancelOrder,
  customer,
  voucher,
  onCustomerSelect,
  onCustomerClear,
  onApplyVoucher,
  onRemoveVoucher,
  voucherDisabled,
  submittedReadonly = false,
}: Props) {
  const hasSubmitted = submittedOrders.length > 0
  const { userInfo } = useUserStore()
  const [clearCustomerOpen, setClearCustomerOpen] = useState(false)

  const submittedItems = useMemo(
    () => submittedOrders.flatMap((o) => o.items),
    [submittedOrders],
  )

  const staffName =
    `${userInfo?.firstName ?? ''} ${userInfo?.lastName ?? ''}`.trim() ||
    'nhân viên'

  return (
    <Tabs defaultValue="items" className="flex min-h-0 flex-1 flex-col">
      <TabsList variant="line" className="mx-3 mt-2 grid shrink-0 grid-cols-2">
        <TabsTrigger value="items">Món</TabsTrigger>
        <TabsTrigger value="info">Khách</TabsTrigger>
      </TabsList>

      <TabsContent
        value="items"
        className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
      >
        {/* Cart items list */}
        <ul className="min-h-0 flex-1 overflow-y-auto bg-pos-surface py-2">
          {pendingItems.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-pos-faint">
              Chưa có món nào
            </li>
          ) : (
            <AnimatePresence>
              {pendingItems.map((p) => (
                <motion.li
                  key={p.rowId ?? p.customPriceId ?? p.menuItemId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="mx-3 mb-1.5 rounded-md border border-pos-border/80 bg-pos-card/90 p-2.5 transition-colors hover:bg-pos-card"
                >
                  {/* Row 1: name + custom badge + price */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 truncate text-sm font-semibold leading-tight">
                      {p.name}
                    </span>
                    {p.isCustomPrice && (
                      <span className="shrink-0 rounded bg-orange-500/20 px-1 py-0.5 text-[10px] font-semibold text-orange-400">
                        Tuỳ chỉnh
                      </span>
                    )}
                    {(() => {
                      const display = getItemPriceDisplay(
                        {
                          unitPrice: p.originalPrice ?? p.priceNum,
                          quantity: p.quantity,
                          productSlug: p.productSlug ?? p.menuItemId,
                          promotionValue: p.promotion?.value,
                          isCustomPrice: p.isCustomPrice,
                          customPrice: p.isCustomPrice ? p.priceNum : null,
                        },
                        voucher,
                      )
                      return (
                        <OrderItemPrice
                          originalPrice={display.originalPrice}
                          finalPrice={display.finalPrice}
                          showStrikethrough={display.showStrikethrough}
                          promoLabel={display.promoLabel}
                          voucherLabel={display.voucherLabel}
                          className="w-20"
                        />
                      )
                    })()}
                  </div>

                  {/* Row 2: quantity controls + edit icon (custom-price) + trash */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {p.isCustomPrice ? (
                        <span className="text-xs text-pos-muted">
                          × {p.quantity}
                        </span>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            aria-label={`Giảm ${p.name}`}
                            onClick={() => {
                              const id =
                                p.rowId ?? p.customPriceId ?? p.menuItemId
                              if (p.quantity <= 1) onRemoveItem(id)
                              else
                                onUpdateItem(id, { quantity: p.quantity - 1 })
                            }}
                            className="h-fit w-fit rounded-full border border-muted-foreground/30 p-1 hover:bg-gray-100"
                          >
                            <Minus size={12} />
                          </Button>
                          <span className="w-5 text-center text-sm">
                            {p.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            aria-label={`Tăng ${p.name}`}
                            onClick={() =>
                              onUpdateItem(
                                p.rowId ?? p.customPriceId ?? p.menuItemId,
                                {
                                  quantity: p.quantity + 1,
                                },
                              )
                            }
                            className="h-fit w-fit rounded-full border border-muted-foreground/30 p-1 hover:bg-gray-100"
                          >
                            <Plus size={12} />
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {p.isCustomPrice && (
                        <CustomPriceDialog
                          mode="edit"
                          menuItemId={p.menuItemId}
                          name={p.name}
                          initialPrice={p.priceNum}
                          initialQuantity={p.quantity}
                          onEdit={(priceNum, price, quantity) =>
                            onUpdateItem(
                              p.rowId ?? p.customPriceId ?? p.menuItemId,
                              {
                                priceNum,
                                price,
                                quantity,
                              },
                            )
                          }
                          trigger={
                            <Button
                              variant="ghost"
                              aria-label={`Sửa giá ${p.name}`}
                              className="flex h-6 w-6 items-center justify-center rounded text-pos-muted hover:bg-pos-hover hover:text-pos-text"
                            >
                              <Pencil size={12} />
                            </Button>
                          }
                        />
                      )}
                      <Button
                        variant="ghost"
                        aria-label={`Xóa ${p.name}`}
                        onClick={() =>
                          onRemoveItem(
                            p.rowId ?? p.customPriceId ?? p.menuItemId,
                          )
                        }
                        className="flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-red-900/30 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  {/* Row 3: note input */}
                  <div className="mt-2 flex items-center gap-2">
                    <NotepadText
                      size={14}
                      className="shrink-0 text-pos-faint"
                    />
                    <input
                      type="text"
                      value={p.note}
                      placeholder="Thêm ghi chú..."
                      onChange={(e) =>
                        onUpdateItem(
                          p.rowId ?? p.customPriceId ?? p.menuItemId,
                          { note: e.target.value },
                        )
                      }
                      className="h-7 flex-1 rounded border border-pos-border bg-pos-input px-2.5 text-xs placeholder:text-pos-faint"
                    />
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          )}
        </ul>

        {/* Order-level note (always editable; customer handled at payment screen) */}
        <div className="border-t border-pos-border px-3 py-2">
          <StaffOrderNoteInput
            value={description}
            onChange={onDescriptionChange}
          />
        </div>

        {/* Submitted orders */}
        {hasSubmitted && (
          <div className="flex items-center justify-between border-t border-pos-border px-4 py-2">
            <span className="text-xs text-pos-dim">
              Đã đặt · {formatVnd(submittedTotal)}
            </span>
            <SubmittedOrdersDialog
              submittedOrders={submittedOrders}
              submittedTotal={submittedTotal}
              voucher={voucher}
              orderData={orderData}
              onConfirmChanges={onConfirmChanges}
              onCancelOrder={onCancelOrder}
              readonly={submittedReadonly}
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="info" className="mt-0 min-h-0 flex-1">
        <div
          data-testid="info-tab-content"
          className="flex h-full flex-col justify-between gap-3 px-3 pb-6 pt-3"
        >
          <div>
            <label className="mb-1 block text-xs text-pos-faint">
              Khách hàng
            </label>
            <StaffCustomerSearchInput
              customer={customer}
              onSelect={onCustomerSelect}
              onClear={() => setClearCustomerOpen(true)}
            />
          </div>
          <div>
            <label className="block text-xs text-pos-faint">Voucher</label>
            <StaffTableVoucherSheet
              pendingItems={pendingItems}
              submittedItems={submittedItems}
              customer={customer}
              appliedVoucher={voucher}
              onApply={onApplyVoucher}
              onRemove={onRemoveVoucher}
              disabled={voucherDisabled}
            />
          </div>
        </div>
      </TabsContent>

      <ConfirmClearCustomerDialog
        open={clearCustomerOpen}
        onOpenChange={setClearCustomerOpen}
        staffName={staffName}
        onConfirm={onCustomerClear}
      />
    </Tabs>
  )
}
