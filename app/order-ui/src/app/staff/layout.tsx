import { useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import {
  SettingsDropdown,
  SystemProfileDropdown,
} from '@/components/app/dropdown'
import { Role, ROUTE } from '@/constants'
import { CurrentShiftIndicator } from '@/components/work-shift/current-shift-indicator'
import { useUserStore } from '@/stores'
import { TerminalLogo } from '@/assets/images'

export function StaffPosLayout() {
  const navigate = useNavigate()
  const userInfo = useUserStore((s) => s.getUserInfo())
  const isStaff = userInfo?.role?.name === Role.STAFF
  const role = userInfo?.role?.name

  // Block ADMIN/SUPER_ADMIN from accessing /staff routes — they should use /system.
  // MANAGER allowed (for oversight).
  useEffect(() => {
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      navigate(ROUTE.OVERVIEW, { replace: true })
    }
  }, [role, navigate])

  // Don't render anything while redirecting
  if (role === Role.ADMIN || role === Role.SUPER_ADMIN) return null

  const handleShiftClosed = () => {
    // Đóng ca xong thì rời POS về trang ca ở SystemLayout — nơi cashier
    // xem tổng kết hoặc mở ca mới.
    navigate(ROUTE.SYSTEM_WORK_SHIFTS)
  }

  return (
    <div className="flex h-screen flex-col bg-pos-bg text-pos-text">
      <header className="flex shrink-0 items-center justify-between border-b border-pos-border bg-pos-surface px-4 py-2">
        <div className="flex items-center gap-3">
          {!isStaff && (
            <Link
              to={ROUTE.OVERVIEW}
              className="flex items-center gap-1 text-xs text-pos-muted transition-colors hover:text-pos-gold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Quản lý
            </Link>
          )}
          <img
            src={TerminalLogo}
            alt="THE TERMINAL"
            className="h-7 w-7 rounded-full object-cover"
          />
          <span className="text-sm font-bold tracking-widest text-pos-gold">THE TERMINAL</span>
        </div>
        <div className="flex items-center gap-2">
          <CurrentShiftIndicator onShiftClosed={handleShiftClosed} />
          <SettingsDropdown />
          <SystemProfileDropdown />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
