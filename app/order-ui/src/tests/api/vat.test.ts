import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock http BEFORE importing the module under test (vi.mock is hoisted)
//
// `attachAuthInterceptors` phải có trong mock: từ giai đoạn 1, `utils/http-auth`
// import nó từ đây, và bất kỳ module nào kéo theo `@/utils` sẽ nạp `http-auth`
// ⇒ thiếu export này thì file test đổ ngay lúc import, không tới được assertion
// nào.
vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  attachAuthInterceptors: vi.fn(),
  scheduleProactiveRefresh: vi.fn(),
  clearProactiveRefresh: vi.fn(),
}))

import http from '@/utils/http'
import {
  getVatLink,
  getVatRequestPublic,
  submitVatRequestPublic,
} from '@/api/vat'

describe('vat API', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    vi.mocked(http.post).mockReset()
  })

  it('getVatLink calls POST /orders/:slug/vat-link', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: { statusCode: 200, result: { url: '/vat-request/INV-1' } },
    } as never)
    const res = await getVatLink('order-1')
    expect(http.post).toHaveBeenCalledWith('/orders/order-1/vat-link')
    expect(res.result.url).toBe('/vat-request/INV-1')
  })

  it('getVatRequestPublic calls GET /vat-request/public/:slug with doNotShowLoading', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        statusCode: 200,
        result: { invoiceSlug: 'INV-1', status: 'AVAILABLE' },
      },
    } as never)
    const res = await getVatRequestPublic('INV-1')
    expect(http.get).toHaveBeenCalledWith('/vat-request/public/INV-1', {
      doNotShowLoading: true,
    })
    expect(res.result.status).toBe('AVAILABLE')
  })

  it('submitVatRequestPublic POSTs body to /vat-request/public/:slug', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: {
        statusCode: 201,
        result: {
          slug: 'VAT-1',
          status: 'PENDING',
          customerName: 'ABC',
          taxCode: '0123456789',
          address: 'addr',
          email: 'a@b.com',
          createdAt: '2026-06-26T00:00:00.000Z',
        },
      },
    } as never)
    const body = {
      customerName: 'ABC',
      taxCode: '0123456789',
      address: 'addr',
      email: 'a@b.com',
    }
    const res = await submitVatRequestPublic('INV-1', body)
    expect(http.post).toHaveBeenCalledWith('/vat-request/public/INV-1', body)
    expect(res.result.slug).toBe('VAT-1')
  })
})
