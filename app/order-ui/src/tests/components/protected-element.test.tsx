import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { usePermissionsStatus } from '@/hooks'
import { Role } from '@/constants/role'
import { ROUTE } from '@/constants/route'
import {
  useAuthStore,
  useCartItemStore,
  useCurrentUrlStore,
  useUserStore,
} from '@/stores'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    )
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/system/work-shifts' }),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

// Quyền không còn decode từ JWT (token do shared-user ký không mang `scope`) —
// nay lấy qua `usePermissionsStatus()` (`GET {terminal}/auth/scope`). Mock hook
// thay vì `jwt-decode`, và mock luôn để khỏi phải dựng QueryClientProvider.
vi.mock('@/hooks', () => ({
  usePermissionsStatus: vi.fn(),
}))

vi.mock('@/stores', () => ({
  useAuthStore: vi.fn(),
  useCartItemStore: vi.fn(),
  useCurrentUrlStore: vi.fn(),
  useUserStore: vi.fn(),
}))

// Real sidebarRoutes config is imported (not mocked) — this test regresses
// against the actual /system/work-shifts entry, which is role-gated
// (allowedRoles) with no scope `permission`.
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

  // Non-empty permissions that do NOT include anything for the work-shift
  // route (which has no `permission` at all) — this ensures we're testing
  // the role-gated branch, not accidentally passing via an empty-permissions
  // shortcut earlier in the function.
  //
  // `isLoading: false` cũng load-bearing: khi đang tải scope thì
  // `hasPermissionForRoute` trả 'loading' và component hiện spinner, nên
  // assertion về nội dung sẽ không bao giờ đúng.
  vi.mocked(usePermissionsStatus).mockReturnValue({
    permissions: ['SOME_OTHER_PERMISSION'],
    isLoading: false,
  })
})

describe('ProtectedElement — /system/work-shifts routing (C1 regression)', () => {
  it('admits a CASHIER (role-gated, no scope permission on the route)', async () => {
    setUserRole(Role.CASHIER)

    render(
      <ProtectedElement
        allowedRoles={[
          Role.CASHIER,
          Role.MANAGER,
          Role.ADMIN,
          Role.SUPER_ADMIN,
        ]}
        element={<div data-testid="work-shift-page">work shift page</div>}
      />,
    )

    // Give the permission-check effect a tick to run.
    await waitFor(() => {
      expect(screen.getByTestId('work-shift-page')).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalledWith(
      ROUTE.FORBIDDEN,
      expect.anything(),
    )
  })

  it('still denies a role not present in allowedRoles', async () => {
    setUserRole(Role.STAFF)

    render(
      <ProtectedElement
        allowedRoles={[
          Role.CASHIER,
          Role.MANAGER,
          Role.ADMIN,
          Role.SUPER_ADMIN,
        ]}
        element={<div data-testid="work-shift-page">work shift page</div>}
      />,
    )

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        ROUTE.FORBIDDEN,
        expect.objectContaining({ replace: true }),
      )
    })
  })
})
