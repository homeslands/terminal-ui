import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Wallet,
  Landmark,
  Check,
  Loader2,
  TriangleAlert,
  CreditCard,
  Info,
} from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { generatePresets, formatVnd } from '@/data/staff-data'

function Row({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-pos-muted">{label}</span>
      <span
        className={`text-base font-bold ${accent ? 'text-pos-gold' : 'text-pos-text'}`}
      >
        {value}
      </span>
    </div>
  )
}

type Tab = 'cash' | 'transfer' | 'card'

interface Props {
  total: number
  tab: Tab
  onTabChange: (tab: Tab) => void
  onConfirm: () => void
  qrCode?: string
  isLoading?: boolean
  amount: number
  onAmountChange: (amount: number) => void
  /** Slot for customer/voucher UI rendered above the payment-method tabs. */
  customerSlot?: React.ReactNode
  /** Error message hiển thị trong tab transfer khi init payment fail */
  initError?: string | null
  /** Callback khi user click "Thử lại" trên init error card */
  onRetryInit?: () => void
  /** Callback khi user click "In hoá đơn tạm" (transfer tab sticky button) */
  onPrintProvisional?: () => void
  /** Loading khi đang gọi BE in HĐ tạm */
  isPrinting?: boolean
}

export function PaymentPanel({
  total,
  tab,
  onTabChange,
  onConfirm,
  qrCode,
  isLoading,
  amount,
  onAmountChange,
  customerSlot,
  initError,
  onRetryInit,
  onPrintProvisional,
  isPrinting,
}: Props) {
  const { t: tMenu } = useTranslation('menu')
  const presets = useMemo(() => generatePresets(total), [total])
  const [cashConfirmOpen, setCashConfirmOpen] = useState(false)
  const [cardConfirmOpen, setCardConfirmOpen] = useState(false)
  const change = amount - total
  const deficit = total - amount
  const showDeficit = amount > 0 && amount < total
  const canConfirmCash = amount >= total && total > 0
  const canConfirmCard = total > 0 && !isLoading
  const canPrintProvisional = !isPrinting && total > 0
  const canConfirm =
    tab === 'cash'
      ? canConfirmCash
      : tab === 'card'
        ? canConfirmCard
        : canPrintProvisional

  const confirmLabel = (() => {
    if (tab === 'cash') {
      return isLoading ? 'Đang xử lý...' : 'XÁC NHẬN THANH TOÁN'
    }
    if (tab === 'card') {
      return isLoading ? 'Đang xử lý...' : 'XÁC NHẬN ĐÃ QUẸT THẺ'
    }
    if (isPrinting) return 'Đang in...'
    return 'IN HOÁ ĐƠN TẠM'
  })()

  const handleCashConfirm = () => {
    setCashConfirmOpen(false)
    onConfirm()
  }

  const handleCardConfirm = () => {
    setCardConfirmOpen(false)
    onConfirm()
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-pos-border bg-pos-surface/60 p-4 text-pos-text">
      {customerSlot && (
        <div className="border-b border-pos-border pb-2">{customerSlot}</div>
      )}

      <div className="flex flex-col items-center gap-1 py-3">
        <span className="text-xs font-bold uppercase tracking-widest text-pos-muted">
          Cần thu
        </span>
        <span
          data-testid="payment-total"
          className="text-4xl font-bold text-pos-gold"
        >
          {formatVnd(total)}
        </span>
      </div>

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as Tab)}>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-pos-elevated p-1">
          <TabsTrigger
            value="cash"
            className="flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-pos-muted transition-colors before:hidden hover:text-pos-text data-[state=active]:bg-pos-card data-[state=active]:text-pos-gold data-[state=active]:shadow-sm"
          >
            <Wallet className="h-4 w-4" />
            Tiền mặt
          </TabsTrigger>
          <TabsTrigger
            value="transfer"
            className="flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-pos-muted transition-colors before:hidden hover:text-pos-text data-[state=active]:bg-pos-card data-[state=active]:text-pos-gold data-[state=active]:shadow-sm"
          >
            <Landmark className="h-4 w-4" />
            Chuyển khoản
          </TabsTrigger>
          <TabsTrigger
            value="card"
            className="flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-pos-muted transition-colors before:hidden hover:text-pos-text data-[state=active]:bg-pos-card data-[state=active]:text-pos-gold data-[state=active]:shadow-sm"
          >
            <CreditCard className="h-4 w-4" />
            Thẻ tín dụng
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cash" className="mt-4 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-pos-muted">
              Tiền khách đưa
            </p>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((p, i) => (
                <Button
                  key={`${p}-${i}`}
                  data-testid="preset-button"
                  type="button"
                  variant={amount === p ? 'default' : 'outline'}
                  onClick={() => onAmountChange(p)}
                  className={
                    amount === p
                      ? 'h-auto rounded-lg border border-pos-gold bg-pos-gold/10 py-2.5 text-sm font-semibold text-pos-gold shadow-none hover:bg-pos-gold/10 hover:border-pos-gold'
                      : 'h-auto rounded-lg border border-muted-foreground/20 bg-pos-elevated py-2.5 text-sm font-medium text-pos-text hover:bg-pos-elevated/70 hover:border-pos-gold hover:text-pos-text'
                  }
                >
                  {formatVnd(p)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center rounded-lg border border-transparent bg-pos-elevated focus-within:border-pos-gold/40 focus-within:ring-1 focus-within:ring-pos-gold/20">
            <Input
              data-testid="amount-input"
              type="number"
              value={amount || ''}
              min={0}
              placeholder="Nhập số tiền khác..."
              onChange={(e) => onAmountChange(Number(e.target.value) || 0)}
              className="h-auto flex-1 border-0 bg-transparent px-3 py-2.5 text-base shadow-none placeholder:text-pos-faint focus-visible:ring-0"
            />
            <span className="pr-3 text-sm text-pos-dim">đ</span>
          </div>
          {showDeficit ? (
            <div className="flex items-baseline justify-between rounded-lg bg-red-50 px-3 py-2 text-sm dark:bg-red-950/20">
              <span className="text-red-400">Còn thiếu</span>
              <span
                data-testid="deficit"
                className="text-lg font-bold text-red-400"
              >
                {formatVnd(deficit)}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between px-3 py-2 text-sm">
              <span className="text-pos-muted">Tiền thừa</span>
              <span
                data-testid="change"
                className="text-lg font-bold text-pos-text"
              >
                {formatVnd(Math.max(0, change))}
              </span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transfer" className="mt-4 flex flex-col gap-4">
          {initError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-semibold text-destructive">
                <TriangleAlert className="h-4 w-4" />
                Lỗi tạo mã thanh toán
              </div>
              <div>
                <p className="mb-3 text-pos-muted">{initError}</p>
                <Button variant="destructive" size="sm" onClick={onRetryInit}>
                  Thử lại
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {qrCode ? (
                <div className="relative flex h-[176px] w-[176px] items-center justify-center">
                  {/* top-left */}
                  <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-pos-gold" />
                  {/* top-right */}
                  <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-pos-gold" />
                  {/* bottom-left */}
                  <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-pos-gold" />
                  {/* bottom-right */}
                  <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-pos-gold" />
                  <img
                    src={qrCode}
                    alt="QR chuyển khoản"
                    className="h-[160px] w-[160px] rounded bg-white p-2"
                  />
                </div>
              ) : (
                <div
                  data-testid="qr-placeholder"
                  className="relative flex h-[160px] w-[160px] items-center justify-center"
                >
                  {/* top-left */}
                  <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-pos-gold/50" />
                  {/* top-right */}
                  <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-pos-gold/50" />
                  {/* bottom-left */}
                  <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-pos-gold/50" />
                  {/* bottom-right */}
                  <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-pos-gold/50" />
                  <p className="px-4 text-center text-xs text-pos-faint">
                    Mã QR sẽ hiển thị tại đây
                  </p>
                </div>
              )}
              {qrCode ? (
                 <p className="max-w-xs px-2 text-center text-xs text-pos-text/70 italic">
                  <Info className="mr-1 inline h-4 w-4 text-destructive" />
                  {tMenu('menu.paymentDescription')}
                </p>
              ) : (
                <p className="text-center text-xs text-pos-muted">
                  Tạo mã để khách chuyển khoản
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="card" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex min-h-[180px] w-full items-center justify-center px-6 py-6">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-pos-gold/50" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-pos-gold/50" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-pos-gold/50" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-pos-gold/50" />
              <div className="flex flex-col items-center gap-3">
                <CreditCard className="h-12 w-12 text-pos-gold" />
                <p className="text-center text-sm text-pos-muted">
                  Vui lòng quẹt thẻ khách trên máy POS.
                  <br />
                  Sau khi máy báo thành công, bấm xác nhận bên dưới.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex-1" />

      <Button
        type="button"
        disabled={!canConfirm || isLoading || isPrinting}
        onClick={() => {
          if (tab === 'cash') {
            setCashConfirmOpen(true)
          } else if (tab === 'card') {
            setCardConfirmOpen(true)
          } else {
            onPrintProvisional?.()
          }
        }}
        className="mt-4 h-14 w-full rounded bg-pos-gold text-base font-bold text-white shadow-none hover:bg-pos-gold/80 disabled:opacity-40"
      >
        {isLoading ||
          (isPrinting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />)}
        {confirmLabel}
      </Button>

      <Dialog open={cashConfirmOpen} onOpenChange={setCashConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-pos-gold" />
              Xác nhận thanh toán tiền mặt
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Row label="Tổng phải trả" value={formatVnd(total)} accent />
            <Row label="Khách đưa" value={formatVnd(amount)} />
            {amount > total && (
              <Row label="Trả lại" value={formatVnd(amount - total)} accent />
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setCashConfirmOpen(false)}
              disabled={isLoading}
            >
              Quay lại
            </Button>
            <Button
              onClick={handleCashConfirm}
              disabled={isLoading}
              className="bg-pos-gold text-white hover:bg-pos-gold/80"
            >
              {isLoading ? (
                'Đang xử lý...'
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Hoàn tất
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cardConfirmOpen} onOpenChange={setCardConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận thanh toán thẻ</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-pos-muted">Tổng thu</span>
              <span className="text-xl font-bold text-pos-gold">
                {formatVnd(total)}
              </span>
            </div>
            <p className="text-pos-muted">
              Khách đã thanh toán {formatVnd(total)} qua thẻ. Xác nhận để đánh
              dấu đơn đã thanh toán.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardConfirmOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={handleCardConfirm}
              className="bg-pos-gold text-white hover:bg-pos-gold/80"
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
