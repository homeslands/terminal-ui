import { useNavigate, useParams } from 'react-router-dom'
import { TablePaymentScreen } from '@/components/staff/table-payment-screen'

export default function SystemTablePaymentPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  return (
    <div className="flex h-[calc(100dvh-7.5rem)] w-full flex-col">
      <TablePaymentScreen
        hideHeader={true}
        onBack={() => navigate(`/system/menu?tab=menu&table=${id}`)}
        tableOrderPath={(tableId) => `/system/menu?tab=menu&table=${tableId}`}
        onPaymentSuccess={() => navigate('/system/menu')}
      />
    </div>
  )
}
