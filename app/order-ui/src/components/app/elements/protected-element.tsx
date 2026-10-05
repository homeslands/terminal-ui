import { useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { ROUTE } from '@/constants'
import { sidebarRoutes } from '@/router/routes'
import { useAuthStore, useCartItemStore, useCurrentUrlStore, useUserStore } from '@/stores'
import { Role } from '@/constants/role'
import { showToast, safeNavigate, isValidRedirectUrl } from '@/utils'
import { usePermissionsStatus } from '@/hooks'

interface ProtectedElementProps {
  element: ReactNode
  /**
   * Optional explicit role allowlist. When provided, AND the user's role is
   * not in this list, the user is redirected to FORBIDDEN — regardless of
   * JWT permissions. Use for routes where role boundary is stricter than
   * the JWT permission scope (e.g. STAFF should not reach the cashier-only
   * payment screen even if their JWT has the permission).
   */
  allowedRoles?: Role[]
}

type PermissionCheckResult = boolean | 'loading'

export default function ProtectedElement({
  element,
  allowedRoles,
}: ProtectedElementProps) {
  const { isAuthenticated, setLogout, token } = useAuthStore()
  const { t } = useTranslation('auth')
  const { setCurrentUrl, shouldUpdateUrl } = useCurrentUrlStore()
  const { clearCart } = useCartItemStore()
  const { removeUserInfo } = useUserStore()
  const userInfo = useUserStore((state) => state.getUserInfo())
  const navigate = useNavigate()
  const location = useLocation()

  // Reactive check: component re-renders when userInfo changes
  const isAuthDataLoading = userInfo === null

  // Tách "chưa lấy xong quyền" khỏi "không có quyền": gộp hai cái này lại là
  // nguyên nhân lỗi 403 mỗi lần F5 (xem chú thích trong use-permissions.ts).
  //
  // Bản cũ decode `jwtDecode(token).scope` — token do shared-user ký không còn
  // field đó, nên nó luôn trả mảng rỗng mà không ném lỗi.
  const { permissions: tokenPermissions, isLoading: isScopeLoading } =
    usePermissionsStatus()

  // Helper: Các route không cần kiểm tra permission đặc biệt
  const publicStaffRoutes = useMemo(() => [
    ROUTE.STAFF_PROFILE,
    ROUTE.STAFF_ORDER_PAYMENT,
    ROUTE.ORDER_SUCCESS,
    // Booking management is gated by role (allowedRoles) rather than a scope
    // permission, so skip the permission lookup for it.
    //
    // Load-bearing, despite the role-gated early return in step 7: `/system/table`
    // (STAFF_TABLE_MANAGEMENT) is a substring of `/system/table-booking` and comes
    // first in sidebarRoutes, so the substring match in step 6 resolves this path to
    // the table-management route, which DOES have a permission. The early return
    // never fires here. Removing this entry breaks booking for STAFF/TELESALE.
    ROUTE.STAFF_TABLE_BOOKING,
  ], [])

  // Helper: Kiểm tra route có phải public staff route không
  const isPublicStaffRoute = useCallback((pathname: string) => {
    return publicStaffRoutes.some(route => pathname.includes(route))
  }, [publicStaffRoutes])

  // Safe navigate với loop detection
  const safeNavigateToRoute = useCallback((to: string) => {
    return safeNavigate(navigate, to, location.pathname)
  }, [navigate, location.pathname]);

  const handleLogout = useCallback(() => {
    setLogout()
    removeUserInfo()
    clearCart()
    safeNavigateToRoute(ROUTE.LOGIN)
  }, [setLogout, removeUserInfo, safeNavigateToRoute, clearCart])

  const hasPermissionForRoute = useCallback((pathname: string): PermissionCheckResult => {
    // 1. Kiểm tra loading state trước
    if (isAuthDataLoading) {
      return 'loading';
    }

    // 2. Kiểm tra dữ liệu cơ bản
    if (!token || !userInfo?.role?.name) {
      return false;
    }

    // Role allowlist gate — applied first. If a route declares allowedRoles,
    // the user's role must be in the list, regardless of their JWT permissions.
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(userInfo.role.name as Role)) {
        return false
      }
    }

    // 2.1. Safety check: Nếu pathname empty hoặc invalid
    if (!pathname || pathname === '/') {
      return true; // Allow root access
    }

    // 3. Xử lý Customer routes
    if (userInfo.role.name === Role.CUSTOMER) {
      // Customer không được phép truy cập route /system
      return !pathname.includes('/system');
    }

    // 4. Xử lý Staff routes - Public routes (không cần permission)
    if (isPublicStaffRoute(pathname)) {
      return true;
    }

    // 5. Chưa lấy xong scope thì CHƯA kết luận được.
    // Sau mỗi lần F5, cache của react-query rỗng nên `tokenPermissions` là []
    // trong khoảnh khắc đầu tiên. Nếu coi đó là "không có quyền" thì mọi vai trò
    // khác Customer đều bị đá sang trang 403 ngay khi tải lại trang — đúng lỗi
    // tester ghi ngày 03/09/2026 ở `trend-ui`. Customer không dính vì nhánh 3 ở
    // trên đã trả về trước, không đọc tới permissions.
    if (isScopeLoading) {
      return 'loading';
    }

    // 6. Kiểm tra permission cho các route khác
    if (tokenPermissions.length === 0) {
      // Đã lấy xong scope mà vẫn rỗng ⇒ thật sự không có quyền nào
      return false;
    }

    // 7. Tìm route config tương ứng
    const route = sidebarRoutes.find(route => pathname.includes(route.path));

    if (!route) {
      // Nếu không tìm thấy route config, có thể là route mới hoặc không được quản lý
      // Default: allow access (có thể thay đổi thành false tùy policy)
      return true;
    }

    // 8. Kiểm tra permission cụ thể
    // Role-gated routes (allowedRoles, no scope permission) have already been
    // validated by the allowlist gate above — no permission lookup applies.
    if (!route.permission) {
      return true
    }
    const hasRequiredPermission = tokenPermissions.includes(route.permission);

    return hasRequiredPermission;
  }, [
    isAuthDataLoading,
    token,
    userInfo,
    isPublicStaffRoute,
    isScopeLoading,
    tokenPermissions,
    allowedRoles
  ])

  useEffect(() => {
    // Nếu đang loading auth data, chờ không làm gì
    if (isAuthDataLoading) {
      return;
    }

    if (!isAuthenticated()) {
      // Chỉ set currentUrl nếu nó là valid redirect URL và cần update
      if (isValidRedirectUrl(location.pathname) && shouldUpdateUrl(location.pathname)) {
        setCurrentUrl(location.pathname)
      }
      handleLogout()
      showToast(t('toast.sessionExpired'))
      return;
    }

    // Kiểm tra quyền truy cập route hiện tại
    const hasPermission = hasPermissionForRoute(location.pathname);

    // Chỉ redirect khi chắc chắn không có quyền (không phải loading)
    if (hasPermission === false) {
      safeNavigateToRoute(ROUTE.FORBIDDEN);
    }
    // Nếu hasPermission === 'loading', không làm gì cả, đợi load xong
  }, [
    isAuthenticated,
    isAuthDataLoading,
    location.pathname,
    hasPermissionForRoute,
    safeNavigateToRoute,
    handleLogout,
    setCurrentUrl,
    shouldUpdateUrl,
    t
  ])

  // Hiển thị loading khi chưa lấy xong quyền: chưa biết được người này có được
  // vào hay không, render nội dung ra rồi mới đá đi sẽ loé trang cấm.
  if (isScopeLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-b-2 animate-spin border-primary"></div>
      </div>
    )
  }

  // Hiển thị loading khi đang load userInfo sau khi có token
  if (isAuthDataLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col gap-4 items-center">
          <div className="w-8 h-8 rounded-full border-b-2 animate-spin border-primary"></div>
          <p className="text-sm text-muted-foreground">Đang tải thông tin người dùng...</p>
        </div>
      </div>
    )
  }

  return <>{element}</>
}
