import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'route.home': 'Trang chủ',
        'route.details': 'Chi tiết',
        'route.work-shifts': 'Quản lý ca làm việc',
      }
      return map[key] ?? opts?.defaultValue ?? key
    },
  }),
}))

vi.mock('@/stores', () => ({
  useUserStore: () => ({ userInfo: { role: { name: 'CASHIER' } } }),
}))

import SystemBreadcrumb from '@/components/app/breadcrumb/system-breadcrumb'

describe('SystemBreadcrumb — work-shift detail (I4 regression)', () => {
  it('renders a distinct label for the work-shifts segment, not "Chi tiết" twice', () => {
    render(
      <MemoryRouter
        initialEntries={['/system/work-shifts/ws-161004']}
      >
        <SystemBreadcrumb />
      </MemoryRouter>,
    )

    expect(screen.getByText('Quản lý ca làm việc')).toBeInTheDocument()
    // Exactly one "Chi tiết" — the dynamic slug segment — not two.
    expect(screen.getAllByText('Chi tiết')).toHaveLength(1)
  })
})
