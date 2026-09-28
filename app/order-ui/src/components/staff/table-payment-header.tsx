import { PosPageHeader } from '@/components/staff/pos-page-header'
import type { IOrder } from '@/types'
import type { TableSession } from '@/types/session'

export interface TablePaymentHeaderProps {
  hideHeader: boolean
  id: string
  session: TableSession
  orderData: IOrder | undefined
  onBack?: () => void
  tableOrderPath: (tableId: string) => string
}

export function TablePaymentHeader({
  hideHeader,
  id,
  session,
  orderData,
  onBack,
  tableOrderPath,
}: TablePaymentHeaderProps) {
  if (hideHeader) return null

  return (
    <PosPageHeader
      backTo={onBack ? '' : tableOrderPath(id)}
      onBack={onBack}
      center={
        <div className="flex flex-col items-center gap-0.5 text-center">
          <div className="flex items-center gap-2">
            <span className="rounded bg-pos-gold px-2 py-0.5 text-sm font-bold text-white">
              Bàn {session.tableName}
            </span>
            {orderData?.referenceNumber != null && (
              <span className="rounded bg-pos-elevated px-2 py-0.5 text-xs font-semibold text-pos-gold">
                #{orderData.referenceNumber}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-pos-muted">
            {orderData?.owner ? (
              <span className="truncate">
                {orderData.owner.lastName} {orderData.owner.firstName}
              </span>
            ) : (
              <span className="italic">Chưa có khách</span>
            )}
            {orderData?.createdAt && (
              <>
                <span>·</span>
                <span>
                  {new Date(orderData.createdAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      }
    />
  )
}
