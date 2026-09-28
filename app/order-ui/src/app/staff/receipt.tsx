import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ReceiptPreview } from '@/components/staff/receipt-preview'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_TABLES } from '@/data/staff-data'

export default function StaffReceiptPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { sessions, closeSession } = useTableSessions()
  const isDraft = params.get('draft') !== 'false'

  const [issuedAt] = useState(() => new Date().toISOString())

  const table = useMemo(() => STAFF_TABLES.find((t) => t.id === id), [id])
  const session = sessions[id]

  if (!table || !session) {
    return <PosNotFoundState message="Không tìm thấy phiên." />
  }

  const handleDone = () => {
    closeSession(id)
    navigate('/staff')
  }

  return (
    <div className="min-h-screen bg-pos-bg text-pos-text">
      <PosPageHeader
        backTo={`/staff/table/${id}`}
        backLabel="← Quay lại"
        printHidden
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-pos-gold px-3 py-1 text-xs font-bold text-pos-gold"
            >
              IN
            </button>
            {!isDraft && (
              <button
                type="button"
                onClick={handleDone}
                className="rounded bg-emerald-800 px-3 py-1 text-xs font-bold text-emerald-200"
              >
                HOÀN TẤT
              </button>
            )}
          </div>
        }
      />
      <main className="bg-white py-4 print:bg-white print:py-0">
        <ReceiptPreview
          tableLabel={table.label}
          orders={session.submittedOrders}
          isDraft={isDraft}
          issuedAt={issuedAt}
        />
      </main>
    </div>
  )
}
