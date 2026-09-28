import type { TableSessionStatus } from '@/types/session'

interface Props {
  tableName: string
  status: TableSessionStatus
}

export function TableStatusBadge({ tableName, status }: Props) {
  const isWaiting = status === 'waiting_payment'

  return (
    <div className="flex overflow-hidden rounded text-xs font-semibold">
      <span className="bg-pos-border px-2.5 py-1 text-pos-text">{tableName}</span>
      <span
        className={`px-2.5 py-1 ${
          isWaiting
            ? 'bg-orange-500/20 text-orange-400'
            : 'bg-pos-gold/20 text-pos-gold'
        }`}
      >
        {isWaiting ? 'CHỜ THANH TOÁN' : 'ĐANG PHỤC VỤ'}
      </span>
    </div>
  )
}
