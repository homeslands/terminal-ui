import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import fs from 'node:fs'
import path from 'node:path'

import { QUERYKEY } from '@/constants'

/**
 * GIAI ĐOẠN 1 — `useProfile()` phải đọc ĐÚNG khoá mà mọi nơi khác ghi.
 *
 * `QUERYKEY.profile` là một **mảng** (`['profile']`). Nên `[QUERYKEY.profile]`
 * (= `[['profile']]`) và `[...QUERYKEY.profile]` (= `['profile']`) là **hai
 * khoá khác nhau** với react-query: khoá được băm chính xác, còn
 * `invalidateQueries` khớp theo tiền tố và so sánh sâu từng phần tử — chuỗi
 * `'profile'` không khớp mảng `['profile']`.
 *
 * Bản cũ của hook này dùng spread, nên hai thứ cùng hỏng **âm thầm**:
 *
 *   1. `use-post-auth-actions` mồi cache vào `[QUERYKEY.profile]` ⇒ ghi vào
 *      một khoá KHÔNG AI ĐỌC ⇒ đăng nhập xong mở màn hồ sơ vẫn bắn thêm một
 *      `GET /auth/profile`, kéo theo một lượt lookup sang `shared-user`.
 *   2. `invalidateQueries({ queryKey: [QUERYKEY.profile] })` ở các dialog xác
 *      minh email/SĐT và form đổi mật khẩu đều không khớp ⇒ không làm mới gì.
 *
 * `use-post-auth-actions.test.tsx` đã khoá phía GHI. Tệp này khoá phía ĐỌC —
 * nửa còn lại, và chính là nửa đã sai.
 */

const getProfile = vi.fn()

vi.mock('@/api', () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
  updateProfile: vi.fn(),
  updatePassword: vi.fn(),
  uploadProfilePicture: vi.fn(),
  deleteAccount: vi.fn(),
}))

import { useProfile } from '@/hooks/use-profile'

const HO_SO = { result: { slug: 'nv-01', phonenumber: '0900000001' } }

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
  getProfile.mockResolvedValue(HO_SO)
})

describe('useProfile — đọc đúng khoá cache (GĐ1)', () => {
  it('cache đã được mồi vào `[QUERYKEY.profile]` ⇒ có dữ liệu NGAY lần render đầu', () => {
    // Arrange — đúng trạng thái sau khi `useHandleAuthSuccess` mồi cache.
    const { queryClient, wrapper } = createWrapper()
    queryClient.setQueryData([QUERYKEY.profile], HO_SO)

    // Act
    const { result } = renderHook(() => useProfile(), { wrapper })

    // Assert — không `await`: điều cần đo là màn hồ sơ mở ra đã có dữ liệu,
    // không phải chờ một vòng mạng nữa.
    expect(result.current.data).toEqual(HO_SO)
  })

  /**
   * Đối chứng — dựng lại đúng cái bug. Nếu hook quay về `[...QUERYKEY.profile]`
   * thì ca trên đỏ và ca này xanh; giữ cả hai để không ai "sửa cho nhất quán"
   * theo chiều ngược lại mà không thấy gì báo.
   */
  it('cùng dữ liệu nhưng mồi vào khoá CŨ `[...QUERYKEY.profile]` ⇒ KHÔNG đọc được', () => {
    const { queryClient, wrapper } = createWrapper()
    queryClient.setQueryData([...QUERYKEY.profile], HO_SO)

    const { result } = renderHook(() => useProfile(), { wrapper })

    expect(result.current.data).toBeUndefined()
    // Và hai khoá đó thật sự nằm ở hai chỗ khác nhau trong cache.
    expect(queryClient.getQueryData([QUERYKEY.profile])).toBeUndefined()
    expect(queryClient.getQueryData([...QUERYKEY.profile])).toEqual(HO_SO)
  })

  it('`invalidateQueries([QUERYKEY.profile])` làm hook gọi lại `getProfile`', async () => {
    const { queryClient, wrapper } = createWrapper()
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const truoc = getProfile.mock.calls.length

    // Act — đúng lệnh mà dialog xác minh email/SĐT và form đổi mật khẩu gọi.
    await queryClient.invalidateQueries({ queryKey: [QUERYKEY.profile] })

    await waitFor(() =>
      expect(getProfile.mock.calls.length).toBeGreaterThan(truoc),
    )
  })

  it('`invalidateQueries([\'profile\'])` — khoá cũ — KHÔNG làm mới gì', async () => {
    const { queryClient, wrapper } = createWrapper()
    const { result } = renderHook(() => useProfile(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const truoc = getProfile.mock.calls.length

    await queryClient.invalidateQueries({ queryKey: ['profile'] })
    // Cho react-query một nhịp để làm việc nếu nó định làm.
    await new Promise((r) => setTimeout(r, 20))

    expect(getProfile.mock.calls.length).toBe(truoc)
  })
})

describe('Quét tĩnh — không còn khoá profile viết tay (GĐ1)', () => {
  const SRC = path.resolve(__dirname, '../..')

  it('không tệp nào dùng `queryKey: [\'profile\']` hoặc `[...QUERYKEY.profile]`', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name === 'tests' || e.name === 'node_modules') continue
          walk(p)
        } else if (/\.tsx?$/.test(e.name)) files.push(p)
      }
    }
    walk(SRC)

    const offenders = files.filter((f) => {
      const src = fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n')
      return (
        /queryKey:\s*\[\s*'profile'\s*\]/.test(src) ||
        /\[\s*\.\.\.QUERYKEY\.profile\s*\]/.test(src)
      )
    })

    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([])
  })
})
