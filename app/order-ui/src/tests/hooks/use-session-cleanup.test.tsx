import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/**
 * `useSessionCleanup` — đường dọn phiên DÙNG CHUNG cho đăng xuất và xoá tài
 * khoản.
 *
 * Chép từ `trend-ui` (`hooks/use-session-cleanup.ts` + test cùng tên), cộng
 * một ca riêng của `terminal` ở cuối: **503**.
 *
 * ## Vì sao hai luồng phải dọn GIỐNG HỆT nhau
 *
 * Trước đợt này `terminal-ui` chỉ có phần dọn đầy đủ nằm **inline trong
 * `logout-dialog.tsx`**; `delete-account-dialog.tsx` chỉ gọi `setLogout()` +
 * `clearUserData()`. Tức xoá tài khoản xong, thiết bị **vẫn đăng ký nhận
 * push** cho một `sharedUserId` vừa bị xoá bên `shared-user`, và giỏ hàng /
 * chi nhánh / ca của người vừa xoá còn nguyên cho người dùng máy tiếp theo.
 *
 * ## Vì sao ca 503 là của riêng `terminal`
 *
 * `unregisterDeviceToken` là request **có auth** đi vào `terminal`, mà từ giai
 * đoạn 1 thì **mọi** request có auth đều có thể trả `503` (`JwtStrategy` hỏi
 * `shared-user` trên từng lượt). Bản cũ `await` không `try/catch` ⇒ lỗi ném
 * trước khi tới `setLogout()` ⇒ nhân viên bấm Đăng xuất mà **không đăng xuất
 * được**, đúng lúc hệ thống đang chập chờn.
 */

// vi.mock được hoist lên đầu file, nên các mock phải tạo bằng vi.hoisted
// thì factory mới đọc được chúng.
const {
  setLogout,
  removeBranch,
  clearCart,
  clearMenuFilter,
  clearMenuItems,
  clearAllData,
  clearSelectedChefOrder,
  removeUserInfo,
  clearUserData,
  setDeviceToken,
  getDeviceToken,
  unregisterDeviceToken,
  clearQueue,
  stopScheduler,
} = vi.hoisted(() => ({
  setLogout: vi.fn(),
  removeBranch: vi.fn(),
  clearCart: vi.fn(),
  clearMenuFilter: vi.fn(),
  clearMenuItems: vi.fn(),
  clearAllData: vi.fn(),
  clearSelectedChefOrder: vi.fn(),
  removeUserInfo: vi.fn(),
  clearUserData: vi.fn(),
  setDeviceToken: vi.fn(),
  getDeviceToken: vi.fn(),
  unregisterDeviceToken: vi.fn(),
  clearQueue: vi.fn(),
  stopScheduler: vi.fn(),
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => ({ setLogout }),
  useBranchStore: () => ({ removeBranch }),
  useCartItemStore: () => ({ clearCart }),
  useMenuFilterStore: () => ({ clearMenuFilter }),
  useMenuItemStore: () => ({ clearMenuItems }),
  useOrderFlowStore: () => ({ clearAllData }),
  useSelectedChefOrderStore: () => ({ clearSelectedChefOrder }),
  useUserStore: () => ({
    removeUserInfo,
    clearUserData,
    setDeviceToken,
    getDeviceToken,
  }),
}))

vi.mock('@/api/notification', () => ({
  unregisterDeviceToken: (token: string) => unregisterDeviceToken(token),
}))

vi.mock('@/services/token-registration-queue', () => ({
  tokenRegistrationQueue: { clearQueue },
}))

vi.mock('@/services/fcm-token-manager', () => ({
  fcmTokenManager: { stopScheduler },
}))

import { useSessionCleanup } from '@/hooks/use-session-cleanup'

describe('useSessionCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDeviceToken.mockReturnValue('device-token-1')
    unregisterDeviceToken.mockResolvedValue(undefined)
    localStorage.setItem('fcm_token_registered_at', '123')
  })

  it('huỷ đăng ký thiết bị TRƯỚC khi dọn bất kỳ store nào', async () => {
    // Arrange
    const { result } = renderHook(() => useSessionCleanup())

    // Act
    await act(async () => {
      await result.current()
    })

    // Assert — `clearUserData()` xoá deviceToken, nên gọi sau nó thì server
    // không bao giờ nhận được lệnh huỷ đăng ký.
    expect(unregisterDeviceToken).toHaveBeenCalledWith('device-token-1')
    expect(unregisterDeviceToken.mock.invocationCallOrder[0]).toBeLessThan(
      clearUserData.mock.invocationCallOrder[0],
    )
  })

  it('dừng bộ máy thông báo và xoá dấu thời gian của nó', async () => {
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(clearQueue).toHaveBeenCalled()
    expect(stopScheduler).toHaveBeenCalled()
    expect(localStorage.getItem('fcm_token_registered_at')).toBeNull()
  })

  it('dọn MỌI store còn giữ dữ liệu của người vừa rời đi', async () => {
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(setLogout).toHaveBeenCalled()
    expect(removeUserInfo).toHaveBeenCalled()
    expect(clearUserData).toHaveBeenCalled()
    expect(removeBranch).toHaveBeenCalled()
    expect(clearCart).toHaveBeenCalled()
    expect(clearAllData).toHaveBeenCalled()
    expect(clearMenuItems).toHaveBeenCalled()
    expect(clearSelectedChefOrder).toHaveBeenCalled()
    expect(clearMenuFilter).toHaveBeenCalled()
    expect(setDeviceToken).toHaveBeenCalledWith('')
  })

  it('huỷ đăng ký hỏng ⇒ VẪN dọn sạch phiên', async () => {
    unregisterDeviceToken.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(setLogout).toHaveBeenCalled()
    expect(clearCart).toHaveBeenCalled()
  })

  /**
   * Ca riêng của `terminal`, không có ở `trend-ui`. Từ giai đoạn 1, `503` là
   * nhánh lỗi **thường gặp nhất** của mọi request có auth — không phải một
   * trường hợp biên hiếm hoi. Nếu nó chặn được `setLogout()` thì mỗi đợt
   * `shared-user` chập chờn là một đợt nhân viên không thoát được máy.
   */
  it('`shared-user` chập chờn (503) ⇒ vẫn đăng xuất được', async () => {
    unregisterDeviceToken.mockRejectedValue({
      response: { status: 503 },
      message: 'Service Unavailable',
    })
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(setLogout).toHaveBeenCalled()
    expect(clearUserData).toHaveBeenCalled()
    expect(setDeviceToken).toHaveBeenCalledWith('')
  })

  it('không có deviceToken ⇒ bỏ qua lệnh huỷ đăng ký', async () => {
    getDeviceToken.mockReturnValue(null)
    const { result } = renderHook(() => useSessionCleanup())

    await act(async () => {
      await result.current()
    })

    expect(unregisterDeviceToken).not.toHaveBeenCalled()
    expect(setLogout).toHaveBeenCalled()
  })
})
