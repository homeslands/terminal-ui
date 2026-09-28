import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/api/vat', () => ({
  getVatLink: vi.fn(),
  getVatRequestPublic: vi.fn(),
  submitVatRequestPublic: vi.fn(),
}))

import * as api from '@/api/vat'
import {
  useGetVatLink,
  useSubmitVatRequest,
  useVatRequestStatus,
} from '@/hooks/use-vat'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useGetVatLink', () => {
  beforeEach(() => vi.mocked(api.getVatLink).mockReset())
  it('triggers getVatLink with order slug on mutate', async () => {
    vi.mocked(api.getVatLink).mockResolvedValue({
      result: { url: '/vat-request/INV-1' },
    } as never)
    const { result } = renderHook(() => useGetVatLink(), { wrapper })
    result.current.mutate('order-1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.getVatLink).toHaveBeenCalledWith('order-1')
  })
})

describe('useVatRequestStatus', () => {
  beforeEach(() => vi.mocked(api.getVatRequestPublic).mockReset())
  it('does not fetch when invoiceSlug is null', () => {
    renderHook(() => useVatRequestStatus(null), { wrapper })
    expect(api.getVatRequestPublic).not.toHaveBeenCalled()
  })

  it('fetches and unwraps result when invoiceSlug provided', async () => {
    vi.mocked(api.getVatRequestPublic).mockResolvedValue({
      result: { invoiceSlug: 'INV-1', status: 'AVAILABLE' },
    } as never)
    const { result } = renderHook(() => useVatRequestStatus('INV-1'), {
      wrapper,
    })
    await waitFor(() => expect(result.current.data?.status).toBe('AVAILABLE'))
  })
})

describe('useSubmitVatRequest', () => {
  beforeEach(() => vi.mocked(api.submitVatRequestPublic).mockReset())
  it('passes invoiceSlug + body to API on mutate', async () => {
    vi.mocked(api.submitVatRequestPublic).mockResolvedValue({
      result: { slug: 'VAT-1', status: 'PENDING' },
    } as never)
    const { result } = renderHook(() => useSubmitVatRequest(), { wrapper })
    const body = {
      customerName: 'ABC',
      taxCode: '0123456789',
      address: 'x',
      email: 'a@b.com',
    }
    result.current.mutate({ invoiceSlug: 'INV-1', body })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.submitVatRequestPublic).toHaveBeenCalledWith('INV-1', body)
  })
})
