import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { getAuthScope } from '@/api'
import { useAuthStore } from '@/stores'

/**
 * GIAI ĐOẠN 1 — hai phép đo của `usePermissionsStatus`, chuyển từ "mở tab
 * Network trong trình duyệt" sang test tự động.
 *
 * 1. `enabled: !!token` — màn nhập OTP (khách CHƯA có token) không được bắn
 *    `GET /auth/scope`. Thiếu cờ này thì ra một chuỗi 401 kèm retry, và nó chỉ
 *    lộ ra khi có người thật đứng ở màn OTP.
 * 2. Có token ⇒ gọi đúng một lần và trả `result.permissions`.
 *
 * Đo bằng "hàm API có được gọi hay không" thay vì nhìn tab Network: cùng một
 * khẳng định, nhưng chạy lại được mãi mãi.
 */

// Hook nhap `getAuthScope` tu BARREL `@/api` chu khong tu '@/api/auth' -
// mock nham duong dan thi mock khong an, va test se xanh/do vi ly do khac.
vi.mock('@/api', () => ({ getAuthScope: vi.fn() }))
vi.mock('@/stores', async () => {
  const actual = await vi.importActual<typeof import('@/stores')>('@/stores')
  return { ...actual, useAuthStore: vi.fn() }
})

import { usePermissionsStatus, usePermissions } from '@/hooks/use-permissions'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePermissionsStatus — cổng `enabled: !!token` (GĐ1)', () => {
  it('CHƯA có token: không gọi /auth/scope lần nào', async () => {
    vi.mocked(useAuthStore).mockReturnValue({ token: null } as never)

    const { result } = renderHook(() => usePermissionsStatus(), { wrapper })

    // Cho react-query đủ thời gian để bắn nếu nó định bắn.
    await waitFor(() => {
      expect(result.current.permissions).toEqual([])
    })
    expect(getAuthScope).not.toHaveBeenCalled()

    // Và "không có token" KHÔNG được báo là "đang tải" — nếu báo đang tải thì
    // `ProtectedElement` sẽ treo spinner vĩnh viễn ở màn không cần đăng nhập.
    expect(result.current.isLoading).toBe(false)
  })

  it('CÓ token: gọi đúng một lần và trả permissions từ result', async () => {
    vi.mocked(useAuthStore).mockReturnValue({ token: 'abc' } as never)
    vi.mocked(getAuthScope).mockResolvedValue({
      statusCode: 200,
      message: '',
      result: {
        role: 'MANAGER',
        permissions: ['REPORT', 'EMPLOYEE'],
        branch: null,
      },
    } as never)

    const { result } = renderHook(() => usePermissionsStatus(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(getAuthScope).toHaveBeenCalledTimes(1)
    expect(result.current.permissions).toEqual(['REPORT', 'EMPLOYEE'])
  })

  it('`usePermissions()` giữ nguyên chữ ký cũ: trả thẳng string[]', async () => {
    // Giữ chữ ký cũ là CÓ CHỦ ĐÍCH — mọi nơi gọi cũ không phải sửa, chỉ chỗ nào
    // cần phân biệt "đang tải" mới đổi sang `usePermissionsStatus()`. Khoá lại
    // để đợt dọn sau không lặng lẽ đổi kiểu trả về.
    vi.mocked(useAuthStore).mockReturnValue({ token: 'abc' } as never)
    vi.mocked(getAuthScope).mockResolvedValue({
      statusCode: 200,
      message: '',
      result: { role: 'STAFF', permissions: ['MENU'], branch: null },
    } as never)

    const { result } = renderHook(() => usePermissions(), { wrapper })

    await waitFor(() => {
      expect(result.current).toEqual(['MENU'])
    })
    expect(Array.isArray(result.current)).toBe(true)
  })
})
