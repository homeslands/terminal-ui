import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  DialogFooter,
} from '@/components/ui'
import { useUserStore } from '@/stores'
import { showToast } from '@/utils'
import { ROUTE, Role } from '@/constants'
import { useCurrentWorkShift, useSessionCleanup } from '@/hooks'

export default function LogoutDialog() {
  const { t } = useTranslation(['auth'])
  const { t: tToast } = useTranslation('toast')
  const [isOpen, setIsOpen] = useState(false)
  // Phần dọn phiên nằm ở `useSessionCleanup` — DÙNG CHUNG với
  // `delete-account-dialog`. Hai luồng phải dọn giống hệt nhau, nếu không
  // thiết bị còn nhận push cho tài khoản đã rời đi và giỏ hàng của người
  // trước còn lại cho người sau trên cùng máy.
  const cleanupSession = useSessionCleanup()
  const { userInfo } = useUserStore()
  const navigate = useNavigate()

  const isCashier = userInfo?.role?.name === Role.CASHIER
  const { data: shift } = useCurrentWorkShift(isCashier)
  const hasActiveShift = isCashier && !!shift

  const handleLogout = async () => {
    await cleanupSession()
    navigate(ROUTE.HOME, { replace: true })
    showToast(tToast('toast.logoutSuccess'))
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className="flex justify-start w-full" asChild>
        <Button
          variant="ghost"
          className="gap-1 w-full text-sm"
          onClick={() => setIsOpen(true)}
        >
          <LogOut className="icon" />
          {t('logout.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[18rem] overflow-hidden rounded-lg transition-all duration-300 hover:overflow-y-auto sm:max-h-[32rem] sm:max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>
            {hasActiveShift ? 'Bạn đang có ca mở' : t('logout.title')}
          </DialogTitle>
          <DialogDescription>
            {hasActiveShift ? (
              <span>
                Đăng xuất sẽ <strong>không tự đóng ca</strong>. Ca vẫn ACTIVE trên server đến khi bạn đăng nhập lại và đóng ca thủ công.
              </span>
            ) : (
              t('logout.description')
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-between sm:justify-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setIsOpen(false)}
          >
            {t('logout.cancel')}
          </Button>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => handleLogout()}
          >
            {hasActiveShift ? 'Vẫn đăng xuất' : t('logout.logout')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
