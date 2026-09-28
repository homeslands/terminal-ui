import { useState } from 'react'
import type { InvoiceRequest } from '@/types/invoice'

interface Props {
  onSubmit: (req: InvoiceRequest) => void
  onCancel: () => void
}

export function InvoiceForm({ onSubmit, onCancel }: Props) {
  const [buyerName, setBuyerName] = useState('')
  const [buyerTaxCode, setBuyerTaxCode] = useState('')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')

  const canSubmit =
    buyerName.trim().length > 0 &&
    buyerTaxCode.trim().length > 0 &&
    buyerAddress.trim().length > 0 &&
    buyerEmail.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-lg border border-pos-border bg-pos-surface p-6 text-pos-text">
        <h2 className="text-lg font-semibold">Thông tin xuất hoá đơn</h2>
        <div className="mt-4 space-y-3">
          <Field label="Tên người mua" value={buyerName} onChange={setBuyerName} />
          <Field label="Mã số thuế" value={buyerTaxCode} onChange={setBuyerTaxCode} />
          <Field label="Địa chỉ" value={buyerAddress} onChange={setBuyerAddress} />
          <Field label="Email" type="email" value={buyerEmail} onChange={setBuyerEmail} />

          <div>
            <span className="mb-1 block text-xs text-pos-muted">Phương thức thanh toán</span>
            <div className="grid grid-cols-2 overflow-hidden rounded border border-pos-border">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 text-sm font-semibold ${paymentMethod === 'cash' ? 'bg-pos-gold text-white' : 'bg-pos-card'}`}
              >
                TIỀN MẶT
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`py-2 text-sm font-semibold ${paymentMethod === 'transfer' ? 'bg-pos-gold text-white' : 'bg-pos-card'}`}
              >
                CHUYỂN KHOẢN
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-pos-border py-2 text-sm font-semibold"
          >
            HỦY
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                buyerName: buyerName.trim(),
                buyerTaxCode: buyerTaxCode.trim(),
                buyerAddress: buyerAddress.trim(),
                buyerEmail: buyerEmail.trim(),
                paymentMethod,
              })
            }
            className="rounded bg-pos-gold py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            XUẤT HOÁ ĐƠN
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-pos-muted">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-pos-border bg-pos-card px-3 py-2 text-sm text-pos-text"
      />
    </label>
  )
}
