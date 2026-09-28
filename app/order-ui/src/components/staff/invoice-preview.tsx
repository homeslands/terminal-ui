import type { InvoiceData } from '@/types/invoice'

interface Props {
  invoice: InvoiceData
}

function fmt(n: number): string {
  return n.toLocaleString('vi-VN').replace(/,/g, '.')
}

export function InvoicePreview({ invoice }: Props) {
  const date = new Date(invoice.issuedAt)
  return (
    <div className="relative mx-auto max-w-[210mm] bg-white p-10 text-sm text-black print:p-6">
      <div
        data-testid="watermark"
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-7xl font-extrabold tracking-widest text-gray-200 print:hidden"
        style={{ transform: 'rotate(-30deg)' }}
      >
        BẢN MẪU
      </div>

      <header className="mb-6 grid grid-cols-2 gap-4 border-b border-black pb-4">
        <div>
          <div className="text-xs">Mẫu số: 1/001</div>
          <div className="text-xs">Ký hiệu: {invoice.symbol}</div>
          <div className="text-xs">Số: {invoice.number}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold uppercase">Hoá đơn giá trị gia tăng</div>
          <div className="text-xs">
            Ngày {date.getDate()} tháng {date.getMonth() + 1} năm {date.getFullYear()}
          </div>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-6 text-xs">
        <div>
          <div className="font-semibold">Đơn vị bán</div>
          <div>{invoice.seller.name}</div>
          <div>Địa chỉ: {invoice.seller.address}</div>
          <div>MST: {invoice.seller.taxCode}</div>
          <div>ĐT: {invoice.seller.phone}</div>
        </div>
        <div>
          <div className="font-semibold">Đơn vị mua</div>
          <div>{invoice.buyer.buyerName}</div>
          <div>Địa chỉ: {invoice.buyer.buyerAddress}</div>
          <div>MST: {invoice.buyer.buyerTaxCode}</div>
          <div>Email: {invoice.buyer.buyerEmail}</div>
          <div>
            Hình thức thanh toán: {invoice.buyer.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
          </div>
        </div>
      </section>

      <table className="mb-4 w-full border-collapse border border-black text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-1">STT</th>
            <th className="border border-black p-1 text-left">Tên hàng hoá, dịch vụ</th>
            <th className="border border-black p-1">ĐVT</th>
            <th className="border border-black p-1">SL</th>
            <th className="border border-black p-1 text-right">Đơn giá</th>
            <th className="border border-black p-1 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, idx) => (
            <tr key={`${it.name}-${idx}`}>
              <td className="border border-black p-1 text-center">{idx + 1}</td>
              <td className="border border-black p-1">{it.name}</td>
              <td className="border border-black p-1 text-center">{it.unit}</td>
              <td className="border border-black p-1 text-center">{it.quantity}</td>
              <td className="border border-black p-1 text-right">{fmt(it.unitPrice)}</td>
              <td className="border border-black p-1 text-right">{fmt(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mb-4 space-y-1 text-sm">
        <Row label="Cộng tiền hàng" value={invoice.subtotal} testId="invoice-subtotal" />
        <Row label={`Thuế suất GTGT (${Math.round(invoice.vatRate * 100)}%)`} value={invoice.vatAmount} testId="invoice-vat" />
        <Row label="Tổng cộng thanh toán" value={invoice.total} testId="invoice-total" bold />
      </section>

      <p className="mb-6 text-xs italic">
        Số tiền viết bằng chữ: <span>{invoice.totalInWords}</span>
      </p>

      <section className="grid grid-cols-2 gap-6 text-center text-xs">
        <div>
          <div className="font-semibold">Người mua hàng</div>
          <div className="mt-12 italic">(Ký, ghi rõ họ tên)</div>
        </div>
        <div>
          <div className="font-semibold">Người bán hàng</div>
          <div className="mt-12 italic">(Ký, đóng dấu, ghi rõ họ tên)</div>
        </div>
      </section>
    </div>
  )
}

function Row({
  label,
  value,
  testId,
  bold = false,
}: {
  label: string
  value: number
  testId: string
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-black pt-1 font-bold' : ''}`}>
      <span>{label}</span>
      <span data-testid={testId}>{fmt(value)}</span>
    </div>
  )
}
