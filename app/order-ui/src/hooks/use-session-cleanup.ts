import { useCallback } from 'react'

import {
  useAuthStore,
  useBranchStore,
  useCartItemStore,
  useMenuFilterStore,
  useMenuItemStore,
  useOrderFlowStore,
  useSelectedChefOrderStore,
  useUserStore,
} from '@/stores'
import { unregisterDeviceToken } from '@/api/notification'
import { tokenRegistrationQueue } from '@/services/token-registration-queue'
import { fcmTokenManager } from '@/services/fcm-token-manager'

/**
 * Xoá sạch phiên hiện tại: huỷ đăng ký nhận thông báo và dọn mọi store còn giữ
 * dữ liệu của người dùng vừa rời đi.
 *
 * Dùng chung cho đăng xuất và xoá tài khoản — hai luồng phải dọn giống hệt nhau,
 * nếu không thiết bị sẽ tiếp tục nhận push cho một tài khoản không còn tồn tại,
 * và giỏ hàng của người trước còn lại cho người dùng sau trên cùng máy.
 *
 * Hook chỉ dọn, không điều hướng và không hiện toast — hai việc đó khác nhau
 * giữa đăng xuất (về trang chủ) và xoá tài khoản (về trang đăng nhập).
 *
 * ### Vì sao `try/catch` quanh `unregisterDeviceToken` là BẮT BUỘC ở terminal
 *
 * Đây là một request **có auth** đi vào `terminal`, mà từ giai đoạn 1 thì
 * **mọi** request có auth đều có thể trả `503`: `JwtStrategy` hỏi
 * `shared-user` trên từng lượt (xem `progress/terminal-api.md` mục "Fail-open
 * của lớp 1 + 1b"). Để lỗi nổi lên thì `await` ném trước khi tới `setLogout()`
 * ⇒ nhân viên bấm Đăng xuất mà **không đăng xuất được**, đúng lúc hệ thống
 * đang chập chờn. Token phía client vẫn bị xoá ngay bên dưới nên thiết bị
 * không còn dùng nó nữa; huỷ đăng ký hụt là mất mát chấp nhận được, kẹt phiên
 * thì không.
 */
export const useSessionCleanup = () => {
  const { setLogout } = useAuthStore()
  const { removeBranch } = useBranchStore()
  const { clearCart } = useCartItemStore()
  const { clearMenuFilter } = useMenuFilterStore()
  const { clearMenuItems } = useMenuItemStore()
  const { clearAllData } = useOrderFlowStore()
  const { clearSelectedChefOrder } = useSelectedChefOrderStore()
  const { removeUserInfo, clearUserData, setDeviceToken, getDeviceToken } =
    useUserStore()

  return useCallback(async () => {
    // Đọc deviceToken TRƯỚC khi dọn store — clearUserData() xoá nó, và lúc đó
    // server sẽ không bao giờ nhận được lệnh huỷ đăng ký.
    const deviceToken = getDeviceToken()
    if (deviceToken) {
      try {
        await unregisterDeviceToken(deviceToken)
      } catch {
        // Huỷ đăng ký thất bại không được chặn việc dọn phiên: token phía client
        // vẫn bị xoá ngay bên dưới nên thiết bị không còn dùng nó nữa.
      }
    }

    tokenRegistrationQueue.clearQueue()
    fcmTokenManager.stopScheduler()
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
  }, [
    clearAllData,
    clearCart,
    clearMenuFilter,
    clearMenuItems,
    clearSelectedChefOrder,
    clearUserData,
    getDeviceToken,
    removeBranch,
    removeUserInfo,
    setDeviceToken,
    setLogout,
  ])
}
