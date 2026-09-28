import { Link } from 'react-router-dom'
import { ROUTE } from '@/constants'

interface Props {
  message: string
}

export function PosNotFoundState({ message }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-pos-bg text-pos-text">
      <p>
        {message}{' '}
        <Link to={ROUTE.STAFF_POS_FLOOR_PLAN} className="text-pos-gold underline">
          ← Sơ đồ
        </Link>
      </p>
    </div>
  )
}
