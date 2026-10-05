import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { usePermissionsStatus } from '@/hooks'
import { Role } from '@/constants/role'
import { ROUTE } from '@/constants/route'
import { Permission } from '@/constants/sidebar-permission'
import {
  useAuthStore,
  useCartItemStore,
  useCurrentUrlStore,
  useUserStore,
} from '@/stores'

/**
 * GIAI ĐOẠN 1 — phép đo "F5 ở một trang được bảo vệ KHÔNG bị đá sang /403".
 *
 * Đây là lỗi tester ghi ngày 03/09/2026 ở `trend-ui`: sau mỗi lần tải lại trang,
 * cache react-query rỗng nên `permissions` là `[]` trong khoảnh khắc đầu tiên.
 * Bản cũ coi đó là "không có quyền" và điều hướng sang `/403` — người dùng đăng
 * nhập được nhưng không vào được đâu cả.
 *
 * Phép đo gốc nằm ở `progress/terminal-ui.md` mục nghiệm thu và được viết cho
 * người bấm F5 trong trình duyệt. Chuyển thành test tự động vì: (a) nó là hồi
 * quy, phải chạy lại mãi mãi chứ không phải bấm một lần; (b) điều kiện "cache
 * rỗng" dựng bằng mock thì CHẮC CHẮN, còn bấm F5 thật thì tuỳ lúc — cache có
 * thể vẫn còn ấm và ca đo lướt qua mà không ai biết.
 *
 * Ba trạng thái phải phân biệt được, và test này khoá cả ba:
 *   đang tải  ⇒ chờ, KHÔNG điều hướng
 *   tải xong, rỗng ⇒ thật sự không có quyền ⇒ /403
 *   tải xong, đủ quyền ⇒ render nội dung
 */

const mockNavigate = vi.fn()
let currentPathname = ROUTE.OVERVIEW

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    )
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: currentPathname }),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks', () => ({
  usePermissionsStatus: vi.fn(),
}))

vi.mock('@/stores', () => ({
  useAuthStore: vi.fn(),
  useCartItemStore: vi.fn(),
  useCurrentUrlStore: vi.fn(),
  useUserStore: vi.fn(),
}))

import ProtectedElement from '@/components/app/elements/protected-element'

function setUserRole(role: Role) {
  vi.mocked(useUserStore).mockImplementation(
    ((selector?: (state: { getUserInfo: () => unknown }) => unknown) => {
      const state = {
        getUserInfo: () => ({ role: { name: role } }),
        removeUserInfo: vi.fn(),
      }
      return selector ? selector(state) : state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
}

beforeEach(() => {
  mockNavigate.mockClear()
  currentPathname = ROUTE.OVERVIEW

  vi.mocked(useAuthStore).mockReturnValue({
    isAuthenticated: () => true,
    setLogout: vi.fn(),
    token: 'fake-token',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  vi.mocked(useCartItemStore).mockReturnValue({
    clearCart: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  vi.mocked(useCurrentUrlStore).mockReturnValue({
    setCurrentUrl: vi.fn(),
    shouldUpdateUrl: () => false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  setUserRole(Role.MANAGER)
})

describe('ProtectedElement — "đang tải quyền" khác "không có quyền" (GĐ1)', () => {
  it('đang tải scope: KHÔNG đá sang /403, và chưa render nội dung', async () => {
    // Đúng trạng thái ngay sau F5: có token, cache react-query rỗng nên
    // permissions là [], nhưng truy vấn CHƯA xong.
    vi.mocked(usePermissionsStatus).mockReturnValue({
      permissions: [],
      isLoading: true,
    })

    render(<ProtectedElement element={<div>noi-dung-duoc-bao-ve</div>} />)

    // Chờ hẳn một nhịp effect rồi mới khẳng định "không điều hướng" — khẳng
    // định ngay lập tức sẽ xanh cả khi component điều hướng ở effect kế tiếp.
    await waitFor(() => {
      expect(
        screen.queryByText('noi-dung-duoc-bao-ve'),
      ).not.toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('tải xong mà rỗng: MỚI coi là không có quyền ⇒ /403', async () => {
    vi.mocked(usePermissionsStatus).mockReturnValue({
      permissions: [],
      isLoading: false,
    })

    render(<ProtectedElement element={<div>noi-dung-duoc-bao-ve</div>} />)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTE.FORBIDDEN, {
        replace: true,
      })
    })
  })

  it('tải xong và đủ quyền: render nội dung, không điều hướng', async () => {
    vi.mocked(usePermissionsStatus).mockReturnValue({
      permissions: [Permission.OVERVIEW],
      isLoading: false,
    })

    render(<ProtectedElement element={<div>noi-dung-duoc-bao-ve</div>} />)

    await waitFor(() => {
      expect(screen.getByText('noi-dung-duoc-bao-ve')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('khách hàng không dính nhánh này: nhánh Customer trả lời trước khi đọc tới permissions', async () => {
    // Ghi lại vì nó giải thích vì sao lỗi 03/09/2026 chỉ nhân viên gặp: nhánh
    // kiểm tra của Customer nằm TRƯỚC bước đọc permissions, nên dù scope đang
    // tải thì đường của họ vẫn kết luận được ngay.
    setUserRole(Role.CUSTOMER)
    currentPathname = ROUTE.OVERVIEW // '/system/...' ⇒ Customer bị chặn
    vi.mocked(usePermissionsStatus).mockReturnValue({
      permissions: [],
      isLoading: true,
    })

    render(<ProtectedElement element={<div>noi-dung-duoc-bao-ve</div>} />)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTE.FORBIDDEN, {
        replace: true,
      })
    })
  })
})
