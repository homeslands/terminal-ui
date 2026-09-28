import moment from 'moment'
import { useTranslation } from 'react-i18next'

import { formatCurrency } from '@/utils'
import type { IVatRequestListItem } from '@/types'

interface OverviewTabProps {
  vatRequest: IVatRequestListItem
}

/**
 * Tab "Tổng quan" — read-only summary. 90% case kế toán chỉ xem rồi action;
 * không cần edit. Group theo nghiệp vụ: Hoá đơn gốc · Thông tin khách · Kế toán.
 */
export function OverviewTab({ vatRequest }: OverviewTabProps) {
  const { t } = useTranslation('vatAdmin')
  const v = vatRequest
  const inv = v.invoice

  return (
    <div className="space-y-5" data-testid="vat-overview-tab">
      {inv && (
        <Group title={t('overview.invoice', 'HOÁ ĐƠN GỐC')}>
          {inv.referenceNumber != null && (
            <Row label={t('column.referenceNumber', 'Số đơn')}>
              <span className="font-mono font-semibold">#{inv.referenceNumber}</span>
            </Row>
          )}
          {inv.tableName && (
            <Row label={t('overview.tableName', 'Bàn')}>{inv.tableName}</Row>
          )}
          {inv.cashier && (
            <Row label={t('overview.cashier', 'Thu ngân')}>{inv.cashier}</Row>
          )}
          {inv.date && (
            <Row label={t('overview.invoiceDate', 'Thời gian đặt')}>
              {moment(inv.date).format('HH:mm DD/MM/YYYY')}
            </Row>
          )}
          <Row label={t('column.amount', 'Tiền HĐ')}>
            <span className="font-semibold">{formatCurrency(inv.amount)}</span>
          </Row>
          <Row label={t('column.totalVatValue', 'VAT đã thu')}>
            {formatCurrency(inv.totalVatValue)}
          </Row>
        </Group>
      )}

      <Group title={t('overview.customer', 'THÔNG TIN KHÁCH')}>
        <Row label={t('customerInfo.customerName', 'Tên khách hàng')}>
          {v.customerName || '—'}
        </Row>
        {v.companyName && (
          <Row label={t('overview.companyName', 'Công ty')}>{v.companyName}</Row>
        )}
        <Row label={t('customerInfo.taxCode', 'Mã số thuế')}>
          <span className="font-mono">{v.taxCode}</span>
        </Row>
        <Row label={t('customerInfo.email', 'Email')}>{v.email}</Row>
        {v.address && (
          <Row label={t('customerInfo.address', 'Địa chỉ')}>{v.address}</Row>
        )}
        {v.note && (
          <Row label={t('customerInfo.note', 'Ghi chú')}>{v.note}</Row>
        )}
      </Group>

      <Group title={t('overview.accountant', 'PHÁT HÀNH HOÁ ĐƠN')}>
        <Row label={t('accountantInfo.invoiceNumber', 'Số hoá đơn')}>
          <span className="font-mono">{v.invoiceNumber || '—'}</span>
        </Row>
        <Row label={t('overview.requestedAt', 'Ngày yêu cầu')}>
          {moment(v.createdAt).format('HH:mm DD/MM/YYYY')}
        </Row>
      </Group>
    </div>
  )
}

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
        {children}
      </div>
    </section>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}
