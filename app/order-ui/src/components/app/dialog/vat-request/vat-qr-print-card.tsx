import { QRCodeSVG } from 'qrcode.react'

interface VatQrPrintCardProps {
  url: string
  dateTime?: string
  amountLabel?: string
  brandAddress?: string
}

/**
 * Preview QR tối giản — mirror layout của hàm `exportVatQrCard` (canvas →
 * PDF blob → loadDataToPrinter, cùng pipeline với đơn tạm tính): brand
 * "The Terminal" + địa chỉ chi nhánh + thời gian đặt đơn + tổng tiền + QR.
 * Bấm "In" (DialogFooter) → `exportVatQrCard` print PDF qua iframe.
 */
export function VatQrPrintCard({
  url,
  dateTime,
  amountLabel,
  brandAddress,
}: VatQrPrintCardProps) {
  return (
    // items-center: vertical-center content trong content area thay vì top-align
    // → giảm khoảng trống dư giữa QR card và footer.
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-2.5">
        {/* QR card cố định 260px — đảm bảo QR scan ổn định, không nhảy size */}
        <div className="flex w-[260px] flex-col items-center gap-1 rounded-lg border border-gray-300 bg-white p-4 text-center">
          <p className="text-base font-bold leading-tight text-gray-900">
            The Terminal
          </p>
          {brandAddress && (
            <p className="text-[11px] leading-tight text-gray-700">
              {brandAddress}
            </p>
          )}

          {(dateTime || amountLabel) && (
            <div className="mt-2 flex flex-col leading-tight">
              {dateTime && (
                <p className="text-xs text-gray-700">{dateTime}</p>
              )}
              {amountLabel && (
                <p className="text-sm font-bold text-gray-900">{amountLabel}</p>
              )}
            </div>
          )}

          <QRCodeSVG value={url} size={188} level="M" marginSize={4} className="mt-3" />
        </div>

        {/* URL: tách khỏi container w-[260px] để có nhiều chiều ngang hơn,
            truncate 1 dòng + ellipsis. Hover hiện full URL qua title attribute. */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={url}
          className="block w-full truncate text-center text-[11px] text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline"
        >
          {url}
        </a>
      </div>
    </div>
  )
}
