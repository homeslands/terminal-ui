import { ColumnDef } from '@tanstack/react-table'
import moment from 'moment'
import { useTranslation } from 'react-i18next'

import { Badge, DataTableColumnHeader } from '@/components/ui'
import { formatCurrency } from '@/utils'
import { VatRequestStatus, type IVatRequestListItem } from '@/types'

const STATUS_COLORS: Record<VatRequestStatus, string> = {
  [VatRequestStatus.PENDING]: 'bg-gray-100 text-gray-700',
  [VatRequestStatus.PROCESSING]: 'bg-blue-100 text-blue-700',
  [VatRequestStatus.COMPLETED]: 'bg-green-100 text-green-700',
  [VatRequestStatus.REJECTED]: 'bg-red-100 text-red-700',
}

/**
 * 9 cột theo nghiệp vụ kế toán VAT:
 *  1. Ngày yêu cầu (VAT request createdAt)
 *  2. Số đơn (invoice.referenceNumber) — tra ngược hoá đơn gốc
 *  3. Khách / Công ty (companyName ưu tiên, fallback customerName)
 *  4. MST (taxCode) — chuẩn 10 hoặc 13 chữ số
 *  5. Email — đích gửi hoá đơn khi COMPLETED
 *  6. Tiền HĐ (invoice.amount) — tổng tiền đơn gốc
 *  7. VAT đã thu (invoice.totalVatValue) — số VAT đã tính trong đơn
 *  8. Trạng thái (status badge)
 *  9. Số HĐ (invoiceNumber) — số hoá đơn thật khi kế toán đã phát hành
 */
export const useVatRequestColumns = (): ColumnDef<IVatRequestListItem>[] => {
  const { t } = useTranslation('vatAdmin')
  return [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('column.createdAt', 'Ngày yêu cầu')}
        />
      ),
      cell: ({ row }) => (
        <div className="text-xs">
          {moment(row.original.createdAt).format('HH:mm DD/MM/YYYY')}
        </div>
      ),
    },
    {
      id: 'referenceNumber',
      header: t('column.referenceNumber', 'Số đơn'),
      cell: ({ row }) => {
        const ref = row.original.invoice?.referenceNumber
        return (
          <div className="text-sm font-mono">
            {ref != null ? `#${ref}` : '—'}
          </div>
        )
      },
    },
    {
      accessorKey: 'customerName',
      header: t('column.customerName', 'Khách / Công ty'),
      cell: ({ row }) => {
        const r = row.original
        const primary = r.companyName?.trim() || r.customerName
        const sub = r.companyName?.trim() ? r.customerName : undefined
        return (
          <div className="flex flex-col text-sm">
            <span>{primary || '—'}</span>
            {sub && (
              <span className="text-[11px] text-muted-foreground">{sub}</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'taxCode',
      header: t('column.taxCode', 'MST'),
      cell: ({ row }) => (
        <div className="text-sm font-mono">{row.original.taxCode}</div>
      ),
    },
    {
      accessorKey: 'email',
      header: t('column.email', 'Email'),
      cell: ({ row }) => <div className="text-sm">{row.original.email}</div>,
    },
    {
      id: 'amount',
      header: t('column.amount', 'Tiền HĐ'),
      cell: ({ row }) => {
        const amount = row.original.invoice?.amount
        return (
          <div className="text-sm font-medium">
            {amount != null ? formatCurrency(amount) : '—'}
          </div>
        )
      },
    },
    {
      id: 'totalVatValue',
      header: t('column.totalVatValue', 'VAT đã thu'),
      cell: ({ row }) => {
        const vat = row.original.invoice?.totalVatValue
        return (
          <div className="text-sm">
            {vat != null ? formatCurrency(vat) : '—'}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: t('column.status', 'Trạng thái'),
      cell: ({ row }) => {
        const s = row.original.status
        return (
          <Badge
            data-testid={`vat-status-badge-${s}`}
            className={`${STATUS_COLORS[s]}`}
          >
            {t(`status.${s}`, s)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'invoiceNumber',
      header: t('column.invoiceNumber', 'Số HĐ'),
      cell: ({ row }) => (
        <div className="text-sm font-mono">
          {row.original.invoiceNumber ?? '—'}
        </div>
      ),
    },
  ]
}
