import { FileText, Receipt, User, Utensils, Wallet, CheckCircle2 } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
} from '@/components/ui'

import type { DemoOrder } from './mock'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ'

interface VariantProps {
  order: DemoOrder
  isOpen: boolean
  onClose: () => void
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* V1 — Refined Classic                                                        */
/* Giữ cấu trúc card-bordered hiện tại nhưng:                                  */
/*  - Status badge gom về 1 chỗ (header hero)                                  */
/*  - Spacing đều theo scale 4/8/12/16/24                                      */
/*  - Borders nhẹ (border-pos-border/40 thay border đặc)                       */
/*  - Sticky footer CTA                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export function OrderDetailSheetV1({ order, isOpen, onClose }: VariantProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            Chi tiết đơn
            <span className="text-muted-foreground text-sm font-mono">
              #{order.slug}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Hero block — total + status */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Tổng đơn
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold text-primary">
                {fmt(order.total)}
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-500 text-white rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Đã thanh toán
              </span>
            </div>
          </div>

          {/* Meta strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
            <span>· Thu ngân: {order.cashierName}</span>
          </div>

          {/* Customer + Type */}
          <div className="grid grid-cols-2 gap-3">
            <Card title="KHÁCH HÀNG" icon={<User className="w-3.5 h-3.5" />}>
              <div className="text-sm font-semibold">{order.customer.name}</div>
              <div className="text-xs text-muted-foreground">{order.customer.phone}</div>
            </Card>
            <Card title="LOẠI ĐƠN" icon={<Utensils className="w-3.5 h-3.5" />}>
              <div className="text-sm font-semibold">Tại quán</div>
              <div className="text-xs text-muted-foreground">{order.table}</div>
            </Card>
          </div>

          {/* Payment */}
          <Card title="THANH TOÁN" icon={<Wallet className="w-3.5 h-3.5" />}>
            <div className="text-sm">Tiền mặt</div>
          </Card>

          {/* Items */}
          <Card title={`MÓN (${order.items.length})`} icon={<Receipt className="w-3.5 h-3.5" />}>
            <div className="divide-y divide-border/40 -mx-3">
              {order.items.map((it) => (
                <div key={it.slug} className="px-3 py-2 flex justify-between gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.size} · ×{it.quantity}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {it.originalPrice !== it.finalPrice && (
                      <div className="text-xs line-through text-muted-foreground">
                        {fmt(it.originalPrice)}
                      </div>
                    )}
                    <div className="font-semibold text-primary">{fmt(it.subtotal)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Totals */}
          <Card title="TỔNG KẾT">
            <Row label="Tạm tính" value={fmt(order.subtotal)} />
            {order.voucherDiscount > 0 && (
              <Row
                label={`Giảm giá (${order.voucherCode})`}
                value={`−${fmt(order.voucherDiscount)}`}
                muted
              />
            )}
            <div className="border-t border-border/40 mt-2 pt-2 flex justify-between">
              <span className="text-sm font-semibold">Thành tiền</span>
              <span className="text-lg font-bold text-primary">{fmt(order.total)}</span>
            </div>
          </Card>
        </div>

        <div className="px-5 py-3 border-t bg-background">
          <Button className="w-full" size="lg">
            <FileText className="w-4 h-4 mr-2" />
            Xuất hóa đơn
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Card({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/40 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={muted ? 'text-muted-foreground' : 'font-semibold'}>{value}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* V2 — Minimal Receipt                                                        */
/* Như bill nhà hàng cao cấp: KHÔNG card border, chỉ separator ngang.          */
/* All-caps mini headers, hero amount lớn, sticky footer.                      */
/* ─────────────────────────────────────────────────────────────────────────── */

export function OrderDetailSheetV2({ order, isOpen, onClose }: VariantProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-pos-card">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Chi tiết đơn
            </div>
            <div className="font-mono text-sm mt-0.5">#{order.slug}</div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-500 text-white rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Đã thanh toán
          </span>
        </div>

        {/* Hero amount */}
        <div className="px-6 pb-5">
          <div className="text-5xl font-bold text-primary tabular-nums">
            {fmt(order.total)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {new Date(order.createdAt).toLocaleString('vi-VN')} · Thu ngân:{' '}
            {order.cashierName}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Section title="Khách hàng">
            <KV k="Họ tên" v={order.customer.name} />
            <KV k="SĐT" v={order.customer.phone} />
          </Section>

          <Section title="Loại đơn">
            <KV k="Hình thức" v="Tại quán" />
            <KV k="Bàn" v={order.table} />
          </Section>

          <Section title="Thanh toán">
            <KV k="Phương thức" v="Tiền mặt" />
          </Section>

          <Section title={`Món (${order.items.length})`}>
            {order.items.map((it) => (
              <div key={it.slug} className="py-2 flex justify-between gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.size} · ×{it.quantity}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {it.originalPrice !== it.finalPrice && (
                    <div className="text-xs line-through text-muted-foreground">
                      {fmt(it.originalPrice)}
                    </div>
                  )}
                  <div className="font-semibold tabular-nums">{fmt(it.subtotal)}</div>
                </div>
              </div>
            ))}
          </Section>

          <Section title="Tổng kết">
            <KV k="Tạm tính" v={fmt(order.subtotal)} />
            {order.voucherDiscount > 0 && (
              <KV
                k="Khuyến mãi voucher"
                v={`−${fmt(order.voucherDiscount)}`}
                muted
              />
            )}
            <div className="border-t border-dashed mt-2 pt-3 flex justify-between">
              <span className="font-semibold">Thành tiền</span>
              <span className="text-xl font-bold text-primary tabular-nums">
                {fmt(order.total)}
              </span>
            </div>
          </Section>
        </div>

        <div className="px-6 py-4 border-t bg-pos-card">
          <Button className="w-full" size="lg">
            <FileText className="w-4 h-4 mr-2" />
            Xuất hóa đơn
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-dashed first:border-t-0">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        ─── {title} ───
      </div>
      {children}
    </div>
  )
}

function KV({ k, v, muted = false }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className={muted ? 'text-muted-foreground tabular-nums' : 'font-medium tabular-nums'}>
        {v}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* V3 — Modern Card                                                            */
/* Soft shadows, no hard borders, status pills, subtle bg tints.               */
/* Items hiển thị dạng "list card" rộng rãi, customer/type 1 col stacked.      */
/* ─────────────────────────────────────────────────────────────────────────── */

export function OrderDetailSheetV3({ order, isOpen, onClose }: VariantProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-pos-bg">
        <div className="sticky top-0 z-10 px-5 pt-6 pb-4 bg-pos-bg/95 backdrop-blur border-b border-pos-border/30">
          <div className="text-xs text-muted-foreground">Chi tiết đơn</div>
          <div className="flex items-center justify-between mt-1">
            <div className="font-mono text-base font-semibold">#{order.slug}</div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 className="w-3 h-3" />
              Đã thanh toán
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Hero amount card */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm px-5 py-5">
            <div className="text-xs text-muted-foreground">Tổng đơn</div>
            <div className="text-3xl font-bold text-primary mt-1 tabular-nums">
              {fmt(order.total)}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {new Date(order.createdAt).toLocaleString('vi-VN')}
            </div>
            <div className="text-xs text-muted-foreground">
              Thu ngân: {order.cashierName}
            </div>
          </div>

          {/* Quick info cards */}
          <div className="grid grid-cols-2 gap-3">
            <PillCard icon={<User className="w-4 h-4" />} label="Khách hàng">
              <div className="text-sm font-semibold">{order.customer.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {order.customer.phone}
              </div>
            </PillCard>
            <PillCard icon={<Utensils className="w-4 h-4" />} label="Loại đơn">
              <div className="text-sm font-semibold">Tại quán</div>
              <div className="text-xs text-muted-foreground mt-0.5">{order.table}</div>
            </PillCard>
          </div>

          <PillCard icon={<Wallet className="w-4 h-4" />} label="Phương thức thanh toán">
            <div className="text-sm font-semibold">Tiền mặt</div>
          </PillCard>

          {/* Items */}
          <div className="rounded-2xl bg-pos-card shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Receipt className="w-3.5 h-3.5" />
              Món ({order.items.length})
            </div>
            <div>
              {order.items.map((it) => (
                <div
                  key={it.slug}
                  className="px-4 py-3 flex justify-between gap-3 text-sm hover:bg-pos-hover/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {it.size} · ×{it.quantity}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {it.originalPrice !== it.finalPrice && (
                      <div className="text-xs line-through text-muted-foreground">
                        {fmt(it.originalPrice)}
                      </div>
                    )}
                    <div className="font-bold text-primary tabular-nums">
                      {fmt(it.subtotal)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals card */}
          <div className="rounded-2xl bg-pos-card shadow-sm px-4 py-3 space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Tổng kết
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tạm tính</span>
              <span className="tabular-nums">{fmt(order.subtotal)}</span>
            </div>
            {order.voucherDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Khuyến mãi</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                  −{fmt(order.voucherDiscount)}
                </span>
              </div>
            )}
            <div className="border-t border-pos-border/40 pt-2 mt-2 flex justify-between items-baseline">
              <span className="font-semibold">Thành tiền</span>
              <span className="text-2xl font-bold text-primary tabular-nums">
                {fmt(order.total)}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-pos-border/30 bg-pos-bg/95 backdrop-blur">
          <Button className="w-full rounded-xl" size="lg">
            <FileText className="w-4 h-4 mr-2" />
            Xuất hóa đơn
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PillCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-pos-card shadow-sm px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        {icon}
        {label}
      </div>
      {children}
    </div>
  )
}
