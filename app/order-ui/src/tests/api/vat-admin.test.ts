import { describe, it, expect, vi, beforeEach } from 'vitest'
import http from '@/utils/http'
import {
  getVatRequests,
  updateVatRequest,
  updateVatStatus,
} from '@/api/vat-admin'
import { VatRequestStatus } from '@/types'

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

describe('vat-admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getVatRequests GETs with query params', async () => {
    ;(http.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { result: { items: [], total: 0, page: 1, size: 20 } },
    })
    await getVatRequests({
      status: VatRequestStatus.PENDING,
      startDate: '2026-06-01',
      endDate: '2026-06-26',
      taxCode: '0123456789',
      customerName: 'Nguyen',
      email: 'a@b.com',
      invoiceNumber: 'HD-001',
      referenceNumber: 42,
      page: 1,
      size: 20,
    })
    expect(http.get).toHaveBeenCalledWith(
      '/vat-request',
      expect.objectContaining({
        params: expect.objectContaining({
          status: VatRequestStatus.PENDING,
          startDate: '2026-06-01',
          endDate: '2026-06-26',
          taxCode: '0123456789',
          customerName: 'Nguyen',
          email: 'a@b.com',
          invoiceNumber: 'HD-001',
          referenceNumber: 42,
          page: 1,
          size: 20,
        }),
      }),
    )
  })

  it('updateVatRequest PATCHes /:slug with body', async () => {
    ;(http.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { result: {} },
    })
    await updateVatRequest('VAT-1', { email: 'new@x.com' })
    expect(http.patch).toHaveBeenCalledWith('/vat-request/VAT-1', {
      email: 'new@x.com',
    })
  })

  it('updateVatStatus PATCHes /:slug/status with body', async () => {
    ;(http.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { result: {} },
    })
    await updateVatStatus('VAT-1', {
      status: VatRequestStatus.COMPLETED,
      invoiceNumber: 'HD-001',
    })
    expect(http.patch).toHaveBeenCalledWith('/vat-request/VAT-1/status', {
      status: 'COMPLETED',
      invoiceNumber: 'HD-001',
    })
  })
})
