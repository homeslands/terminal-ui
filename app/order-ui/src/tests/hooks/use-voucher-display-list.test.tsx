import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { IVoucher, IGetAllVoucherRequest } from '@/types'

interface MockResp {
  result: { items: IVoucher[]; hasNext: boolean; page: number }
}

const refetchStaff = vi.fn()
const refetchPublic = vi.fn()
const staffData = vi.fn(() => undefined as MockResp | undefined)
const publicData = vi.fn(() => undefined as MockResp | undefined)

vi.mock('@/hooks/use-voucher', () => ({
  useVouchersForOrder: () => ({
    data: staffData(),
    refetch: refetchStaff,
    isLoading: false,
  }),
  usePublicVouchersForOrder: () => ({
    data: publicData(),
    refetch: refetchPublic,
    isLoading: false,
  }),
}))

import { useVoucherDisplayList } from '@/hooks/use-voucher-display-list'

const baseParams: IGetAllVoucherRequest = {
  hasPaging: true,
  page: 1,
  size: 10,
} as IGetAllVoucherRequest

describe('useVoucherDisplayList', () => {
  beforeEach(() => {
    refetchStaff.mockClear()
    refetchPublic.mockClear()
    staffData.mockReturnValue({
      result: { items: [{ slug: 'a' } as IVoucher], hasNext: false, page: 1 },
    })
    publicData.mockReturnValue({
      result: { items: [{ slug: 'a' } as IVoucher], hasNext: false, page: 1 },
    })
  })

  it('exposes eligible vouchers as not applied', () => {
    const { result } = renderHook(() =>
      useVoucherDisplayList({
        enabled: true,
        params: baseParams,
        appliedVoucher: null,
      }),
    )
    expect(result.current.list).toHaveLength(1)
    expect(result.current.list[0]._source).toBe('eligible')
    expect(result.current.list[0]._isApplied).toBe(false)
  })

  it('includes applied voucher even when absent from eligible response', () => {
    const applied = { slug: 'z', code: 'Z' } as IVoucher
    const { result } = renderHook(() =>
      useVoucherDisplayList({
        enabled: true,
        params: baseParams,
        appliedVoucher: applied,
      }),
    )

    expect(result.current.list.map((v) => v.slug).sort()).toEqual(['a', 'z'])
    const z = result.current.list.find((v) => v.slug === 'z')!
    expect(z._source).toBe('applied_only')
    expect(z._isApplied).toBe(true)
  })

  it('marks applied voucher as applied when present in eligible', () => {
    staffData.mockReturnValueOnce({
      result: {
        items: [{ slug: 'a' } as IVoucher, { slug: 'b' } as IVoucher],
        hasNext: true,
        page: 1,
      },
    })
    const { result } = renderHook(() =>
      useVoucherDisplayList({
        enabled: true,
        params: baseParams,
        appliedVoucher: { slug: 'b' } as IVoucher,
      }),
    )
    const b = result.current.list.find((v) => v.slug === 'b')!
    expect(b._source).toBe('eligible')
    expect(b._isApplied).toBe(true)
    expect(result.current.hasMore).toBe(true)
  })

  it('injects extraVouchers without duplicating eligible entries', () => {
    const { result } = renderHook(() =>
      useVoucherDisplayList({
        enabled: true,
        params: baseParams,
        appliedVoucher: null,
        extraVouchers: [
          { slug: 'a' } as IVoucher, // already in eligible
          { slug: 'x' } as IVoucher, // new
        ],
      }),
    )
    expect(result.current.list.map((v) => v.slug).sort()).toEqual(['a', 'x'])
  })

  it('uses the public endpoint when variant=public', () => {
    publicData.mockReturnValueOnce({
      result: { items: [{ slug: 'pub' } as IVoucher], hasNext: false, page: 1 },
    })
    const { result } = renderHook(() =>
      useVoucherDisplayList({
        enabled: true,
        params: baseParams,
        appliedVoucher: null,
        variant: 'public',
      }),
    )
    expect(result.current.list.map((v) => v.slug)).toEqual(['pub'])
    result.current.refetch()
    expect(refetchPublic).toHaveBeenCalledTimes(1)
    expect(refetchStaff).not.toHaveBeenCalled()
  })
})
