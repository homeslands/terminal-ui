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
import { useAuthStore, useBranchStore, useCartItemStore, useMenuFilterStore, useMenuItemStore, useSelectedChefOrderStore, useUserStore } from '@/stores'
import { showToast } from '@/utils'
import { ROUTE, Role } from '@/constants'
import { useOrderFlowStore } from '@/stores'
import { unregisterDeviceToken } from '@/api/notification'
import { tokenRegistrationQueue } from '@/services/token-registration-queue'
import { fcmTokenManager } from '@/services/fcm-token-manager'
import { useCurrentWorkShift } from '@/hooks'

export default function LogoutDialog() {
  const { t } = useTranslation(['auth'])
  const { t: tToast } = useTranslation('toast')
  const [isOpen, setIsOpen] = useState(false)
  const { setLogout } = useAuthStore()
  const { clearSelectedChefOrder } = useSelectedChefOrderStore()
  const { removeBranch } = useBranchStore()

  const { clearAllData } = useOrderFlowStore()
  const { clearCart } = useCartItemStore()
  const { clearMenuItems } = useMenuItemStore()
  const { removeUserInfo, clearUserData, setDeviceToken, getDeviceToken, userInfo } = useUserStore()
  const { clearMenuFilter } = useMenuFilterStore()
  const navigate = useNavigate()

  const isCashier = userInfo?.role?.name === Role.CASHIER
  const { data: shift } = useCurrentWorkShift(isCashier)
  const hasActiveShift = isCashier && !!shift

  const handleLogout = async () => {
    const deviceToken = getDeviceToken()
    if (deviceToken) {
      await unregisterDeviceToken(deviceToken)
    }
    
    // Cleanup notification system
    tokenRegistrationQueue.clearQueue()
    fcmTokenManager.stopScheduler()
    
    // ✅ Clear timestamp (deviceToken được clear bởi clearUserData())
    localStorage.removeItem('fcm_token_registered_at')
    
    setLogout()
    removeUserInfo()
    clearUserData()
    removeBranch()
    clearCart()
    clearAllData()
    clearMenuItems()
    clearSelectedChefOrder()
    clearMenuFilter()
    setDeviceToken('')
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
