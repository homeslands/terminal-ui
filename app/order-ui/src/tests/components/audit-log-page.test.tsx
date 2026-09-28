import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AuditLogPage } from '@/app/system/audit-log/audit-log-page'

vi.mock('@/hooks/use-permissions', () => ({
  useHasPermission: vi.fn(),
}))
vi.mock('@/hooks/use-audit-log', () => ({
  useAuditLogs: () => ({ data: undefined, isLoading: false }),
  useAuditLogConfigs: () => ({ data: { result: [] }, isLoading: false }),
  useUpdateAuditLogConfig: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/use-user', () => ({
  useUsers: () => ({ data: undefined }),
}))
vi.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: <T,>(v: T) => v,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'vi' } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}))

import { useHasPermission } from '@/hooks/use-permissions'
import { Permission } from '@/constants/sidebar-permission'

function renderWithUrl(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/system/audit-log" element={<AuditLogPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AuditLogPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('User with AUDIT_LOG_MANAGEMENT permission sees both tabs', async () => {
    vi.mocked(useHasPermission).mockImplementation(
      (p: string) => p === Permission.AUDIT_LOG_MANAGEMENT,
    )
    renderWithUrl('/system/audit-log')
    expect(await screen.findByText('auditLog.tab.viewer')).toBeInTheDocument()
    expect(screen.getByText('auditLog.tab.config')).toBeInTheDocument()
  })

  it('User without AUDIT_LOG_MANAGEMENT sees the no-permission message', async () => {
    vi.mocked(useHasPermission).mockImplementation(() => false)
    renderWithUrl('/system/audit-log')
    await waitFor(() =>
      expect(screen.getByText('auditLog.noPermission')).toBeInTheDocument(),
    )
    expect(screen.queryByText('auditLog.tab.viewer')).toBeNull()
    expect(screen.queryByText('auditLog.tab.config')).toBeNull()
  })
})
