import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useVoucherState } from '@/hooks/use-voucher-state'
import { useTableSessionsStore } from '@/stores/table-sessions.store'
import type { IVoucher } from '@/types'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useVoucherState', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
  })

  it('returns null appliedVoucher when session has no voucher', () => {
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: null,
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    expect(result.current.appliedVoucher).toBe(null)
  })
})

const patchVoucherMock = vi.fn()
vi.mock('@/hooks/use-order', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/use-order')>(
    '@/hooks/use-order',
  )
  return {
    ...actual,
    useUpdateVoucherInOrder: () => ({ mutateAsync: patchVoucherMock }),
  }
})

const sampleVoucher = {
  slug: 'v1',
  code: 'V1',
  voucherProducts: [],
  remainingUsage: 5,
  isActive: true,
  // endDate xa tương lai để evaluateVoucher không trả 'EXPIRED' do
  // 7AM-bound check khi test chạy trước 7AM giờ local.
  endDate: '2099-12-31T23:59:59.000Z',
} as unknown as IVoucher

describe('useVoucherState actions', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
    patchVoucherMock.mockReset()
    patchVoucherMock.mockResolvedValue(undefined)
  })

  it('applyVoucher with no orderSlug → only updates store (no PATCH)', async () => {
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: null,
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    await act(async () => {
      await result.current.applyVoucher(sampleVoucher)
    })
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toEqual(
      sampleVoucher,
    )
    expect(patchVoucherMock).not.toHaveBeenCalled()
  })

  it('applyVoucher with orderSlug → optimistic update + PATCH', async () => {
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    await act(async () => {
      await result.current.applyVoucher(sampleVoucher)
    })
    expect(patchVoucherMock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'o1', voucher: 'v1' }),
    )
    expect(useTableSessionsStore.getState().sessions['t1'].voucher?.slug).toBe(
      'v1',
    )
  })

  it('applyVoucher PATCH failure → rollback to previous', async () => {
    useTableSessionsStore.getState().setOrderVoucher('t1', null)
    patchVoucherMock.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    await act(async () => {
      await result.current.applyVoucher(sampleVoucher)
    })
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toBeUndefined()
  })

  it('removeVoucher with orderSlug → PATCH null + clear store', async () => {
    useTableSessionsStore.getState().setOrderVoucher('t1', sampleVoucher)
    const { result } = renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        }),
      { wrapper },
    )
    await act(async () => {
      await result.current.removeVoucher()
    })
    expect(patchVoucherMock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'o1', voucher: null }),
    )
    expect(useTableSessionsStore.getState().sessions['t1'].voucher).toBeUndefined()
  })
})

describe('useVoucherState auto-revalidate', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
    patchVoucherMock.mockReset()
    patchVoucherMock.mockResolvedValue(undefined)
  })

  it('fires onAutoRemoved callback when applied voucher becomes invalid', async () => {
    const voucher = {
      ...sampleVoucher,
      minOrderValue: 999_999_999,
    } as unknown as IVoucher
    useTableSessionsStore.getState().setOrderVoucher('t1', voucher)
    const cb = vi.fn()
    renderHook(
      () => {
        const state = useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [{ menuItemId: 'p1', quantity: 1 }],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
        })
        state.onAutoRemoved(cb)
        return state
      },
      { wrapper },
    )
    await waitFor(() => {
      expect(cb).toHaveBeenCalledWith('MIN_ORDER_NOT_MET')
    })
    expect(patchVoucherMock).toHaveBeenCalledWith(
      expect.objectContaining({ voucher: null }),
    )
  })
})

describe('useVoucherState BE seed', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ sessions: {} })
    useTableSessionsStore.getState().openSession('t1', 'Bàn 1')
    patchVoucherMock.mockReset()
    patchVoucherMock.mockResolvedValue(undefined)
  })

  it('one-time seeds session.voucher from beVoucher when session empty', () => {
    const beVoucher = { ...sampleVoucher, slug: 'beV' } as unknown as IVoucher
    renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
          beVoucher,
        }),
      { wrapper },
    )
    expect(useTableSessionsStore.getState().sessions['t1'].voucher?.slug).toBe(
      'beV',
    )
  })

  it('does not re-seed when session already has voucher', () => {
    const existing = { ...sampleVoucher, slug: 'existing' } as unknown as IVoucher
    useTableSessionsStore.getState().setOrderVoucher('t1', existing)
    const newBe = { ...sampleVoucher, slug: 'newBe' } as unknown as IVoucher
    renderHook(
      () =>
        useVoucherState({
          tableSlug: 't1',
          orderSlug: 'o1',
          items: [],
          hasCustomerOwner: false,
          subtotalAfterPromotion: 0,
          beVoucher: newBe,
        }),
      { wrapper },
    )
    expect(useTableSessionsStore.getState().sessions['t1'].voucher?.slug).toBe(
      'existing',
    )
  })
})
