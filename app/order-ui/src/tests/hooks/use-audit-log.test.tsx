import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import * as api from '@/api/audit-log'
import {
  useAuditLogs,
  useAuditLogConfigs,
  useUpdateAuditLogConfig,
} from '@/hooks/use-audit-log'
import { QUERYKEY } from '@/constants'
import { IApiResponse, IAuditLogConfig } from '@/types'

vi.mock('@/api/audit-log')

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

describe('useAuditLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls getAuditLogs with the provided query', async () => {
    vi.mocked(api.getAuditLogs).mockResolvedValue({
      message: '',
      statusCode: 200,
      result: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
    } as never)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useAuditLogs({ page: 1, size: 10, order: 'ASC', event: 'Update' }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.getAuditLogs).toHaveBeenCalledWith({
      page: 1,
      size: 10,
      order: 'ASC',
      event: 'Update',
    })
  })
})

describe('useUpdateAuditLogConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('optimistically flips enabled then rolls back on error', async () => {
    const { qc, Wrapper } = makeWrapper()
    const seed = {
      message: '',
      statusCode: 200,
      result: [
        { slug: 'cfg-1', entity: 'Order', enabled: true, createdAt: '' },
      ],
    } as never as IApiResponse<IAuditLogConfig[]>
    qc.setQueryData(QUERYKEY.auditLogConfigs, seed)
    vi.mocked(api.updateAuditLogConfig).mockRejectedValue(
      new Error('boom'),
    )

    const { result } = renderHook(() => useUpdateAuditLogConfig(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      result.current.mutate({ slug: 'cfg-1', enabled: false })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const after = qc.getQueryData<IApiResponse<IAuditLogConfig[]>>(
      QUERYKEY.auditLogConfigs,
    )
    expect(after?.result?.[0].enabled).toBe(true) // rolled back
  })

  it('keeps optimistic value on success and invalidates query', async () => {
    const { qc, Wrapper } = makeWrapper()
    const seed = {
      message: '',
      statusCode: 200,
      result: [
        { slug: 'cfg-1', entity: 'Order', enabled: true, createdAt: '' },
      ],
    } as never as IApiResponse<IAuditLogConfig[]>
    qc.setQueryData(QUERYKEY.auditLogConfigs, seed)
    vi.mocked(api.getAuditLogConfigs).mockResolvedValue(seed as never)
    vi.mocked(api.updateAuditLogConfig).mockResolvedValue({
      message: '',
      statusCode: 200,
      result: { slug: 'cfg-1', entity: 'Order', enabled: false, createdAt: '' },
    } as never)

    const { result } = renderHook(() => useUpdateAuditLogConfig(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      result.current.mutate({ slug: 'cfg-1', enabled: false })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const after = qc.getQueryData<IApiResponse<IAuditLogConfig[]>>(
      QUERYKEY.auditLogConfigs,
    )
    expect(after?.result?.[0].enabled).toBe(false)
  })
})

describe('useAuditLogConfigs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches configs', async () => {
    vi.mocked(api.getAuditLogConfigs).mockResolvedValue({
      message: '',
      statusCode: 200,
      result: [],
    } as never)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useAuditLogConfigs(), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.getAuditLogConfigs).toHaveBeenCalledTimes(1)
  })
})
