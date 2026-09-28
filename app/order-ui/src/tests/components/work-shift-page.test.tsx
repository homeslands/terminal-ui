import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { Role } from '@/constants'

const mockRole = vi.fn()

// The page remembers the last tab in sessionStorage — clear it between tests
// so one test's tab selection doesn't leak into another's initial tab.
beforeEach(() => {
  sessionStorage.clear()
})

// The page persists the active tab in ?tab= via useSearchParams, so it needs
// a Router context.
function renderPage() {
  return render(
    <MemoryRouter>
      <SystemWorkShiftsPage />
    </MemoryRouter>,
  )
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/stores', () => ({
  useUserStore: (selector: (s: unknown) => unknown) =>
    selector({ getUserInfo: () => ({ role: { name: mockRole() } }) }),
}))

// The page only needs to decide *which* tree to render — stub the heavy
// children so this stays a focused test of the role branch, not an
// integration test of each tab's data fetching.
vi.mock('@/app/system/work-shifts/components/active-tab', () => ({
  ActiveTab: () => <div data-testid="active-tab-marker" />,
}))
vi.mock('@/app/system/work-shifts/components/history-tab', () => ({
  HistoryTab: () => <div data-testid="history-tab-marker" />,
}))
vi.mock('@/app/system/work-shifts/components/my-shift-tab', () => ({
  MyShiftTab: () => <div data-testid="my-shift-tab-marker" />,
}))

import SystemWorkShiftsPage from '@/app/system/work-shifts/page'

describe('SystemWorkShiftsPage role branch', () => {
  it('renders a current-shift + history tab set for CASHIER, not the active-shifts manager tab (D2)', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    renderPage()

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'currentShift' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'tabHistory' }),
    ).toBeInTheDocument()
    // Current-shift tab is the default panel, so it mounts immediately;
    // the history panel does not mount until selected.
    expect(screen.getByTestId('my-shift-tab-marker')).toBeInTheDocument()
    expect(
      screen.queryByTestId('history-tab-marker'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('active-tab-marker'),
    ).not.toBeInTheDocument()
    // CASHIER never sees the MANAGER-only "active shifts" tab.
    expect(
      screen.queryByRole('tab', { name: 'tabActive' }),
    ).not.toBeInTheDocument()
  })

  it('mounts HistoryTab for CASHIER after selecting the history tab', async () => {
    mockRole.mockReturnValue(Role.CASHIER)
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'tabHistory' }))
    expect(screen.getByTestId('history-tab-marker')).toBeInTheDocument()
  })

  it.each([Role.MANAGER, Role.ADMIN])(
    'renders the active/history manager tabs for %s and not MyShiftTab',
    (role) => {
      mockRole.mockReturnValue(role)
      renderPage()

      expect(screen.getByRole('tablist')).toBeInTheDocument()
      expect(
        screen.getByRole('tab', { name: 'tabActive' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('tab', { name: 'tabHistory' }),
      ).toBeInTheDocument()
      // Active tab is the default panel, so it mounts immediately.
      expect(screen.getByTestId('active-tab-marker')).toBeInTheDocument()
      expect(
        screen.queryByTestId('my-shift-tab-marker'),
      ).not.toBeInTheDocument()
    },
  )
})
