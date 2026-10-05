import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { ROUTE } from '@/constants'
import { Role } from '@/constants/role'
import { calculateSmartNavigationUrl } from '@/utils/current-url-manager'
import type { IUserInfo } from '@/types'

/**
 * GIAI ĐOẠN 1 — chỗ thứ SÁU của lỗi "chưa biết quyền bị hiểu là không có
 * quyền", và nó **chưa được sửa**.
 *
 * ## Bối cảnh
 *
 * Mục *"Sửa lỗi bị đá sang trang 403 mỗi lần tải lại trang"* của giai đoạn 1
 * liệt kê **năm** chỗ đọc quyền bằng `jwtDecode(token).scope` và sửa hết:
 * `use-permissions.ts`, `protected-element.tsx`, `app-sidebar.tsx`,
 * `login-form.tsx`, `Login.tsx`. Hai chỗ đầu còn được nâng lên
 * `usePermissionsStatus()` để **phân biệt "đang tải" với "không có quyền"`.
 *
 * Nhưng `Login.tsx` còn một đường thứ hai mà danh sách đó không chạm tới:
 * **nhánh tự điều hướng cho phiên ĐÃ CÓ SẴN**. Nó không decode token — nên
 * mọi phép quét `jwtDecode` đều bỏ qua — mà đọc quyền quá sớm:
 *
 * ```ts
 * const permissions = usePermissions()            // Login.tsx:63 — không có isLoading
 * const navigationUrl = useMemo(() => calculateSmartNavigationUrl({ … }), [...])
 * useEffect(() => { if (isReadyToNavigate) safeNavigate(navigate, navigationUrl) }, …)
 * ```
 *
 * `isReadyToNavigate` chỉ chờ `token + userInfo`, mà **cả hai đều persist
 * `localStorage`** ⇒ có mặt ngay ở lần render đầu. `/auth/scope` thì chưa về
 * ⇒ `permissions = []` ⇒ `findFirstAllowedRoute` trả **`ROUTE.FORBIDDEN`**.
 *
 * ⇒ Nhân viên có phiên còn hạn mở thẳng `/login` bị đá sang `/403`.
 *
 * Đăng nhập MỚI không dính: `useHandleAuthSuccess` mồi cache `authScope`
 * **trước** `setUserInfo` (xem `tests/hooks/use-post-auth-actions.test.tsx`).
 *
 * ## ⚠️ Nhóm này XANH nghĩa là NỢ VẪN CÒN
 *
 * Hai ca dưới đây khẳng định **hiện trạng đang sai**, đúng khuôn
 * `known-gaps` của bộ test backend. Khi `Login.tsx` được chuyển sang
 * `usePermissionsStatus()` và `isReadyToNavigate` chờ thêm `!isScopeLoading`,
 * ca quét tĩnh sẽ ĐỎ — lúc đó **đảo chiều khẳng định**, đừng xoá.
 *
 * `trend-ui` có y hệt đường này, nên đây không phải lỗi chép sai — nhưng
 * `terminal-ui` đã có sẵn `usePermissionsStatus()`, nên chi phí sửa là một
 * dòng.
 */

const SRC = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')

const NHAN_VIEN = {
  slug: 'nv-1',
  role: { name: Role.MANAGER },
} as unknown as IUserInfo

describe('Cơ chế: quyền rỗng ⇒ điều hướng ra trang cấm', () => {
  it('nhân viên + `permissions: []` ⇒ `calculateSmartNavigationUrl` trả `/403`', () => {
    // Arrange — đúng trạng thái của lần render đầu sau khi tải lại trang:
    // userInfo đã hydrate từ localStorage, cache `/auth/scope` còn rỗng.
    const context = { userInfo: NHAN_VIEN, permissions: [], currentUrl: null }

    // Act
    const url = calculateSmartNavigationUrl(context)

    // Assert — đây là cơ chế, không phải mong muốn.
    expect(url).toBe(ROUTE.FORBIDDEN)
  })

  it('cùng nhân viên đó, khi đã có quyền ⇒ KHÔNG còn ra `/403`', () => {
    // Đối chứng: chứng minh `/403` ở ca trên đến từ việc quyền rỗng, chứ
    // không phải từ một nguyên nhân khác (thiếu role, URL không hợp lệ…).
    const url = calculateSmartNavigationUrl({
      userInfo: NHAN_VIEN,
      permissions: ['REPORT', 'EMPLOYEE', 'ORDER'],
      currentUrl: null,
    })

    expect(url).not.toBe(ROUTE.FORBIDDEN)
  })

  it('khách hàng KHÔNG dính — nhánh của họ trả lời trước khi đọc quyền', () => {
    const url = calculateSmartNavigationUrl({
      userInfo: { slug: 'kh-1', role: { name: Role.CUSTOMER } } as unknown as IUserInfo,
      permissions: [],
      currentUrl: null,
    })

    expect(url).toBe(ROUTE.HOME)
  })
})

describe('🐞 NỢ ĐÃ GHI SỔ — `Login.tsx` chưa chờ `/auth/scope`', () => {
  it('`Login.tsx` vẫn dùng `usePermissions()` (bản KHÔNG có trạng thái tải)', () => {
    const src = read('app/auth/Login.tsx')

    // Hiện trạng. Khi ai đó đổi sang `usePermissionsStatus()`, ca này ĐỎ —
    // đó là tín hiệu nợ đã được trả, hãy đảo chiều hai khẳng định dưới đây.
    expect(src).toMatch(/\bconst\s+permissions\s*=\s*usePermissions\(\)/)
    expect(src).not.toMatch(/usePermissionsStatus/)
  })

  it('`isReadyToNavigate` chưa tính tới trạng thái tải của scope', () => {
    const src = read('app/auth/Login.tsx')
    const khoi = src.slice(
      src.indexOf('const isReadyToNavigate'),
      src.indexOf('const navigationUrl'),
    )

    expect(khoi.length).toBeGreaterThan(0)
    // Điều kiện điều hướng chỉ gồm token + userInfo + isNavigating.
    expect(khoi).not.toMatch(/isScopeLoading|isLoading/)
  })

  /**
   * Đối chứng cho hai ca trên: hai bề mặt KIA đã được sửa đúng trong cùng
   * giai đoạn 1. Không có ca này thì "Login.tsx dùng usePermissions()" trông
   * như một lựa chọn thiết kế nhất quán, chứ không phải một chỗ bị bỏ sót.
   */
  it('đối chứng — `protected-element` và `app-sidebar` ĐÃ dùng bản có `isLoading`', () => {
    expect(read('components/app/elements/protected-element.tsx')).toMatch(
      /usePermissionsStatus\(\)/,
    )
    expect(read('app/layouts/system/components/app-sidebar.tsx')).toMatch(
      /usePermissionsStatus\(\)/,
    )
  })
})
