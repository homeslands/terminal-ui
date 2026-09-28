import moment from 'moment'
import ejs from 'ejs'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import i18next from 'i18next'

import { showToast } from './toast'
import { IExportOrderInvoiceParams, IOrder, OrderTypeEnum } from '@/types'
import { Be_Vietnam_Pro_base64 } from '@/assets/font/base64'
import { Logo } from '@/assets/images'
import { VOUCHER_TYPE } from '@/constants'

export const loadDataToPrinter = (blob: Blob) => {
  const blobURL = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe') //load content in an iframe to print later
  document.body.appendChild(iframe)

  iframe.style.display = 'none'
  iframe.src = blobURL
  iframe.onload = function () {
    setTimeout(function () {
      iframe.focus()
      iframe?.contentWindow?.print()
    }, 1)
  }
}

/**
 * Mở cửa sổ mới, ghi nội dung HTML và in (với auto-close cải tiến)
 * @param htmlContent - HTML string cần in
 */
export const openPrintWindow = (htmlContent: string) => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Không thể mở cửa sổ in')
  }

  // Inject enhanced auto-close script vào HTML content
  const autoCloseScript = `
    <script>
      let printExecuted = false;
      let closeAttempted = false;

      // Đợi mọi <img> (đặc biệt data: URL như QR base64) decode xong trước khi
      // gọi window.print(). Trên Windows Chrome/Edge, window.onload có thể fire
      // trước khi data-URL image decode xong → preview bị mất ảnh. Mac WebKit
      // thường catch kịp nhưng vẫn an toàn nếu đợi explicit.
      const waitForImages = () => {
        const imgs = Array.from(document.images);
        return Promise.all(imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) {
            return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
          }
          return new Promise((resolve) => {
            img.addEventListener('load', () => {
              if (img.decode) img.decode().then(resolve, resolve);
              else resolve();
            }, { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          });
        }));
      };

      window.onload = async () => {
        try { await waitForImages(); } catch (_) {}
        // micro-delay để layout settle sau khi image decoded (Windows render).
        await new Promise((r) => setTimeout(r, 60));
        window.print();
        printExecuted = true;
      };
      
      // Method 1: Standard onafterprint event
      window.onafterprint = () => {
        if (!closeAttempted) {
          closeAttempted = true;
          setTimeout(() => window.close(), 300);
        }
      };
      
      // Method 2: Media query detection (modern browsers)
      if (window.matchMedia) {
        const mediaQueryList = window.matchMedia('print');
        mediaQueryList.addListener((mql) => {
          if (!mql.matches && printExecuted && !closeAttempted) {
            closeAttempted = true;
            setTimeout(() => window.close(), 300);
          }
        });
      }
      
      // Method 3: Focus-based detection
      let focusLost = false;
      window.onblur = () => {
        if (printExecuted) focusLost = true;
      };
      
      window.onfocus = () => {
        if (focusLost && printExecuted && !closeAttempted) {
          closeAttempted = true;
          setTimeout(() => window.close(), 300);
        }
      };
      
      // Method 4: Fallback timeout
      setTimeout(() => {
        if (!closeAttempted) {
          closeAttempted = true;
          window.close();
        }
      }, 5000);
    </script>
  `

  // Thử inject vào </head>, nếu không có thì thêm vào cuối <body>
  let enhancedHtmlContent: string
  if (htmlContent.includes('</head>')) {
    enhancedHtmlContent = htmlContent.replace(
      '</head>',
      autoCloseScript + '</head>',
    )
  } else if (htmlContent.includes('</body>')) {
    enhancedHtmlContent = htmlContent.replace(
      '</body>',
      autoCloseScript + '</body>',
    )
  } else {
    // Fallback: thêm vào cuối HTML
    enhancedHtmlContent = htmlContent + autoCloseScript
  }

  printWindow.document.write(enhancedHtmlContent)
  printWindow.document.close()

  // Monitor từ parent window
  const startTime = Date.now()
  const monitorInterval = setInterval(() => {
    const elapsed = Date.now() - startTime

    if (printWindow.closed) {
      clearInterval(monitorInterval)
    } else if (elapsed > 8000) {
      // Timeout sau 8 giây - thử đóng manual
      clearInterval(monitorInterval)
      try {
        printWindow.close()
      } catch {
        // Ignore error nếu không thể đóng
      }
    }
  }, 500)
}

export const generateQRCodeBase64 = async (slug: string): Promise<string> => {
  try {
    const dataUrl = await QRCode.toDataURL(slug, { width: 128 })
    return dataUrl // base64 string
  } catch {
    return ''
  }
}

export const generateInvoiceHTML = async (
  data: IExportOrderInvoiceParams,
): Promise<string> => {
  const templateText = await fetch('/templates/invoice-template.html').then(
    (res) => res.text(),
  )
  return ejs.render(templateText, data)
}

/**
 * Print VAT QR ở format tối giản 80mm: brand The Terminal + địa chỉ chi nhánh
 * + thời gian + số tiền + QR.
 *
 * Pipeline copy chính xác pattern in đơn tạm tính (BE-PDF + loadDataToPrinter):
 * 1. Compose layout trên `<canvas>` (native Canvas API render font Việt qua
 *    system fonts — không cần @font-face, không có async resource).
 * 2. Snapshot canvas → image PNG → đóng gói vào jsPDF blob.
 * 3. `loadDataToPrinter(blob)` → iframe load PDF qua native PDF viewer → print.
 *
 * Lý do KHÔNG dùng HTML print: trên Windows Chrome iframe HTML có quirks với
 * data-URL image / @font-face → QR/text có thể không render kịp print snapshot.
 * PDF self-contained loại bỏ hẳn rủi ro đó (đã verify qua đường đơn tạm tính).
 */
export const exportVatQrCard = async (data: {
  url: string
  dateTime?: string
  amountLabel?: string
  brandAddress?: string
}) => {
  try {
    const W = 640 // px canvas width — 80mm @ 8x resolution
    const PAD = 32
    let y = 48

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = 1200 // sẽ crop về chiều cao thực
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const baseFont =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Be Vietnam Pro", system-ui, sans-serif'

    // Brand
    ctx.font = `700 36px ${baseFont}`
    ctx.fillText('The Terminal', W / 2, y)
    y += 48

    // Address (auto-wrap nếu dài)
    if (data.brandAddress) {
      ctx.font = `400 20px ${baseFont}`
      y = drawWrappedTextCentered(
        ctx,
        data.brandAddress,
        W / 2,
        y,
        W - 2 * PAD,
        26,
      )
    }

    // DateTime
    if (data.dateTime) {
      y += 16
      ctx.font = `400 22px ${baseFont}`
      ctx.fillText(data.dateTime, W / 2, y)
      y += 30
    }

    // Amount
    if (data.amountLabel) {
      y += 8
      ctx.font = `700 28px ${baseFont}`
      ctx.fillText(data.amountLabel, W / 2, y)
      y += 36
    }

    // QR — toCanvas vẽ trực tiếp vào canvas con (không qua image decoding)
    y += 24
    const qrSize = W - 2 * PAD - 8
    const qrCanvas = document.createElement('canvas')
    await QRCode.toCanvas(qrCanvas, data.url, {
      width: qrSize,
      margin: 4,
    })
    ctx.drawImage(qrCanvas, (W - qrSize) / 2, y, qrSize, qrSize)
    y += qrSize + 32

    // Crop canvas về chiều cao thực dùng
    const cropped = document.createElement('canvas')
    cropped.width = W
    cropped.height = y
    const croppedCtx = cropped.getContext('2d')
    if (!croppedCtx) throw new Error('crop canvas ctx unavailable')
    croppedCtx.drawImage(canvas, 0, 0)

    // PDF wrapper 80mm width — chiều cao tính theo ratio canvas
    const pdfWidthMm = 80
    const pdfHeightMm = (y / W) * pdfWidthMm
    const doc = new jsPDF({
      unit: 'mm',
      format: [pdfWidthMm, pdfHeightMm],
      orientation: 'portrait',
    })
    doc.addImage(
      cropped.toDataURL('image/png'),
      'PNG',
      0,
      0,
      pdfWidthMm,
      pdfHeightMm,
    )
    loadDataToPrinter(doc.output('blob'))
  } catch {
    showToast(i18next.t('toast.exportPDFVouchersError'))
  }
}

/**
 * Word-wrap text vẽ centered trên canvas. Trả về y sau dòng cuối + lineHeight
 * để caller stack tiếp content bên dưới.
 */
function drawWrappedTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/)
  let line = ''
  let curY = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY)
      curY += lineHeight
      line = word
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, curY)
  return curY + lineHeight
}

export const exportOrderInvoices = async (order: IOrder | undefined) => {
  if (!order) return

  let voucherValue = 0
  let orderPromotionValue = 0

  if (order?.voucher?.type === VOUCHER_TYPE.PERCENT_ORDER) {
    const voucherPercent = order.voucher.value
    const subtotalBeforeVoucher =
      (order.subtotal * 100) / (100 - voucherPercent)
    voucherValue += subtotalBeforeVoucher - order.subtotal
  }
  if (order?.voucher?.type === VOUCHER_TYPE.FIXED_VALUE) {
    voucherValue += order.voucher.value
  }

  const subtotalBeforeVoucher = order.orderItems?.reduce(
    (total, current) => total + current.subtotal,
    0,
  )

  // Calculate promotion value
  orderPromotionValue = order.orderItems.reduce(
    (acc, item) => acc + (item.promotion?.value || 0) * item.quantity,
    0,
  )

  try {
    const htmlContent = await generateInvoiceHTML({
      logoString: Be_Vietnam_Pro_base64,
      logo: Logo,
      branchAddress: order.invoice.branchAddress || '',
      referenceNumber: order.invoice.referenceNumber,
      createdAt: order.createdAt,
      type: order.type,
      tableName:
        order.type === OrderTypeEnum.AT_TABLE
          ? order.table?.name || ''
          : 'Mang đi',
      customer:
        order.owner?.firstName + ' ' + order.owner?.lastName || 'Khách lẻ',
      cashier:
        order.approvalBy?.firstName + ' ' + order.approvalBy?.lastName || '',
      invoiceItems: order.orderItems.map((item) => ({
        variant: {
          name: item.variant.product?.name || '',
          originalPrice: item.variant.price,
          price: item.subtotal,
          size: item.variant.size?.name || '',
        },
        quantity: item.quantity,
        promotionValue: item.promotion?.value || 0,
        subtotal: item.subtotal,
      })),
      promotionDiscount: orderPromotionValue,
      paymentMethod: order.payment?.paymentMethod || '',
      subtotalBeforeVoucher: subtotalBeforeVoucher,
      voucherType: order.voucher?.type || '',
      voucherValue: voucherValue,
      amount: order.invoice.amount,
      loss: order.loss,
      qrcode: await generateQRCodeBase64(order.slug),
      formatCurrency: (v: number) => new Intl.NumberFormat().format(v) + '₫',
      formatDate: (date: string, fmt: string) => moment(date).format(fmt),
      formatPaymentMethod: (method: string) =>
        method === 'CASH' ? 'Tiền mặt' : 'Khác',
    })

    // Sử dụng openPrintWindow cải tiến
    openPrintWindow(htmlContent)
  } catch {
    showToast(i18next.t('toast.exportPDFVouchersError'))
  }
}
