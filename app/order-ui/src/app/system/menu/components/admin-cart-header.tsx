import { useTranslation } from 'react-i18next'
import { TransferTableDialog } from '@/components/staff/transfer-table-dialog'
import type { Table } from '@/data/staff-data'
import type { TableSession } from '@/types/session'

interface AdminCartHeaderProps {
  tableName: string
  tableSlug: string
  tables: Table[]
  sessions: Record<string, TableSession>
  sessionStatus?: TableSession['status']
  orderSlug?: string | null
  requiresTransferConfirm?: boolean
  assistBannerVisible: boolean
  assistOrderSlug: string | null
  onTransfer: (newTable: { id: string; label: string }) => void
  onDismissAssistBanner: () => void
}

export function AdminCartHeader({
  tableName,
  tableSlug,
  tables,
  sessions,
  sessionStatus,
  orderSlug = null,
  requiresTransferConfirm = false,
  assistBannerVisible,
  assistOrderSlug,
  onTransfer,
  onDismissAssistBanner,
}: AdminCartHeaderProps) {
  const { t } = useTranslation('menu')

  return (
    <>
      <div className="border-b px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-pos-gold">
              {t('order.orderInformation')}
            </h2>
            <p className="mt-1 text-xs text-pos-muted">
              {t('order.tableNumber')}:{' '}
              <span className="font-semibold">{tableName}</span>
            </p>
          </div>
          {sessionStatus !== 'waiting_payment' && (
            <TransferTableDialog
              orderSlug={orderSlug}
              currentTableId={tableSlug}
              currentTableName={tableName}
              tables={tables}
              sessions={sessions}
              onTransferred={onTransfer}
              requiresConfirm={requiresTransferConfirm}
            />
          )}
        </div>
      </div>

      {assistBannerVisible && assistOrderSlug && (
        <div className="mx-3 mt-2 flex items-start gap-2 rounded-md border border-pos-gold/40 bg-pos-gold/10 px-3 py-2 text-xs">
          <span className="mt-0.5 shrink-0">🔧</span>
          <div className="flex-1 leading-snug">
            <div className="font-semibold text-pos-gold">
              Đang xử lý hộ{' '}
              {tableName ? `— Bàn ${tableName}` : ''}
            </div>
            <div className="text-pos-muted">
              Đơn #{assistOrderSlug.slice(0, 6).toUpperCase()}
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissAssistBanner}
            aria-label="Đóng thông báo"
            className="shrink-0 rounded p-1 text-pos-muted hover:bg-pos-hover hover:text-pos-text"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
