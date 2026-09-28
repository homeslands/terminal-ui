import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InvoicePreview } from '@/components/staff/invoice-preview'
import { buildInvoice } from '@/lib/staff-invoice'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_ADMIN_SETTINGS } from '@/data/staff-data'

export default function StaffInvoicePage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessions, closeSession } = useTableSessions()
  const session = sessions[id]

  const invoice = useMemo(() => {
    if (!session || !session.invoiceRequest) return null
    return buildInvoice(
      session,
      session.invoiceRequest,
      {
        name: STAFF_ADMIN_SETTINGS.restaurantName,
        address: STAFF_ADMIN_SETTINGS.address,
        taxCode: STAFF_ADMIN_SETTINGS.taxCode,
        phone: STAFF_ADMIN_SETTINGS.phone,
      },
      STAFF_ADMIN_SETTINGS.vatRate,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!session || !invoice) {
    return <PosNotFoundState message="Thiếu dữ liệu hoá đơn." />
  }

  const handleDone = () => {
    closeSession(id)
    navigate('/staff')
  }

  return (
    <div className="min-h-screen bg-pos-bg text-pos-text">
      <PosPageHeader
        backTo={`/staff/table/${id}/payment`}
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
            <button
              type="button"
              onClick={handleDone}
              className="rounded bg-emerald-800 px-3 py-1 text-xs font-bold text-emerald-200"
            >
              HOÀN TẤT
            </button>
          </div>
        }
      />
      <main className="bg-white print:bg-white">
        <InvoicePreview invoice={invoice} />
      </main>
    </div>
  )
}
