import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { WORK_SHIFT_ERROR_CODE } from '@/constants'

const mockGetCurrent = vi.fn()

vi.mock('@/api/work-shift', () => ({
  getCurrentWorkShift: () => mockGetCurrent(),
}))

import { useCurrentWorkShift } from '../use-work-shift'

/** Dựng lỗi axios giống BE trả về (statusCode mang mã 161xxx, không phải HTTP). */
function apiError(code: number) {
  return { response: { data: { statusCode: code }, status: 400 } }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockGetCurrent.mockReset()
})

describe('useCurrentWorkShift — "no active shift" is a value, not an error', () => {
  it('resolves NO_ACTIVE (161002) to null instead of erroring', async () => {
    // Đây là chính xác thứ /current trả về ngay sau khi đóng ca.
    mockGetCurrent.mockRejectedValue(apiError(WORK_SHIFT_ERROR_CODE.NO_ACTIVE))
    const { result } = renderHook(() => useCurrentWorkShift(true), { wrapper })

    await waitFor(() => expect(result.current.isFetched).toBe(true))
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('resolves NOT_FOUND (161000) to null as well', async () => {
    mockGetCurrent.mockRejectedValue(apiError(WORK_SHIFT_ERROR_CODE.NOT_FOUND))
    const { result } = renderHook(() => useCurrentWorkShift(true), { wrapper })

    await waitFor(() => expect(result.current.isFetched).toBe(true))
    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('still surfaces a genuine error (403 FORBIDDEN) as an error', async () => {
    mockGetCurrent.mockRejectedValue(apiError(WORK_SHIFT_ERROR_CODE.FORBIDDEN))
    const { result } = renderHook(() => useCurrentWorkShift(true), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it('returns the shift when one is active', async () => {
    mockGetCurrent.mockResolvedValue({ result: { slug: 'ws-1' } })
    const { result } = renderHook(() => useCurrentWorkShift(true), { wrapper })

    await waitFor(() => expect(result.current.isFetched).toBe(true))
    expect(result.current.data).toEqual({ slug: 'ws-1' })
  })
})
