import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { Role } from '@/constants'
import { WorkShiftStatus, type IWorkShift, type IWorkShiftPage } from '@/types'

const mockRole = vi.fn()
const mockUseWorkShifts = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/stores', () => ({
  useUserStore: (selector: (s: unknown) => unknown) =>
    selector({ getUserInfo: () => ({ role: { name: mockRole() } }) }),
}))

vi.mock('@/hooks', () => ({
  useWorkShifts: (query: unknown) => mockUseWorkShifts(query),
}))

// The date filter is a Radix Popover full of calendars that read i18n.language
// off the real i18next instance (mocked away above) — stub it so the filter row
// renders headlessly. This suite covers paging and cashier scope, not calendars.
vi.mock('@/components/app/popover', () => ({
  DateRangeComparePopover: ({
    onApply,
  }: {
    onApply: (value: unknown) => void
  }) => (
    <button
      type="button"
      onClick={() =>
        onApply({
          startDate: '2026-07-01T00:00:00',
          endDate: '2026-07-15T23:59:59',
          activePreset: null,
        })
      }
    >
      applyDateFilter
    </button>
  ),
}))

import { HistoryTab } from '@/app/system/work-shifts/components/history-tab'

const PREV = 'paginationPrev'
const NEXT = 'paginationNext'

const shiftFixture: IWorkShift = {
  slug: 'ws-1',
  cashier: {
    slug: 'cashier-1',
    firstName: 'Van',
    lastName: 'Nguyen',
    phonenumber: '0900000000',
  },
  branch: { slug: 'branch-1', name: 'Chi nhanh 1' },
  actualStartTime: '2026-07-20T01:00:00.000Z',
  actualEndTime: '2026-07-20T05:00:00.000Z',
  status: WorkShiftStatus.CLOSED,
  openingCash: 100000,
  closingCash: 200000,
  note: null,
  createdAt: '2026-07-20T01:00:00.000Z',
  totalOrders: 5,
  totalInvoicesPaid: 5,
  totalRevenue: 500000,
  preShiftOrdersLinked: 0,
}

function page(
  overrides: Partial<IWorkShiftPage<IWorkShift>>,
): IWorkShiftPage<IWorkShift> {
  return { data: [], total: 0, page: 1, size: 10, ...overrides }
}

function renderHistoryTab() {
  return render(
    <MemoryRouter>
      <HistoryTab />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockRole.mockReturnValue(Role.MANAGER)
  mockUseWorkShifts.mockReset()
  mockUseWorkShifts.mockReturnValue({
    data: page({ total: 0 }),
    isLoading: false,
  })
})

describe('HistoryTab pagination arithmetic', () => {
  it('shows 1/1 with both prev and next disabled when total is 0', () => {
    mockUseWorkShifts.mockReturnValue({
      data: page({ data: [], total: 0 }),
      isLoading: false,
    })
    renderHistoryTab()

    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()
    expect(screen.getByRole('button', { name: NEXT })).toBeDisabled()
  })

  it('computes 3 pages for total 25 and disables prev/next only at the boundaries', async () => {
    const user = userEvent.setup()
    mockUseWorkShifts.mockReturnValue({
      data: page({ data: [shiftFixture], total: 25 }),
      isLoading: false,
    })
    renderHistoryTab()

    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()
    expect(screen.getByRole('button', { name: NEXT })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: NEXT }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeEnabled()
    expect(screen.getByRole('button', { name: NEXT })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: NEXT }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeEnabled()
    expect(screen.getByRole('button', { name: NEXT })).toBeDisabled()
  })
})

describe('HistoryTab reads the IWorkShiftPage shape', () => {
  it('renders rows from data.data (a component reading `items` would show the empty state)', () => {
    mockUseWorkShifts.mockReturnValue({
      data: page({ data: [shiftFixture], total: 1 }),
      isLoading: false,
    })
    renderHistoryTab()

    expect(screen.getByText('Van Nguyen')).toBeInTheDocument()
    expect(screen.queryByText('emptyHistory')).not.toBeInTheDocument()
  })

  it('shows the empty state when data.data is empty', () => {
    mockUseWorkShifts.mockReturnValue({
      data: page({ data: [], total: 0 }),
      isLoading: false,
    })
    renderHistoryTab()

    expect(screen.getByText('emptyHistory')).toBeInTheDocument()
  })
})

describe('HistoryTab filter reset', () => {
  it('resets to page 1 when the cashier text filter changes on a later page', async () => {
    const user = userEvent.setup()
    mockUseWorkShifts.mockReturnValue({
      data: page({ data: [shiftFixture], total: 25 }),
      isLoading: false,
    })
    renderHistoryTab()

    await user.click(screen.getByRole('button', { name: NEXT }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    // Cashier search and the status Select share the same applyFilter()
    // page-reset wrapper, so proving it here proves it for both controls.
    await user.type(screen.getByLabelText('filterCashier'), 'a')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })
})

describe('HistoryTab cashier-search visibility and query scope', () => {
  it('shows the cashier search for a MANAGER and passes the typed value to the query', async () => {
    const user = userEvent.setup()
    mockRole.mockReturnValue(Role.MANAGER)
    renderHistoryTab()

    const search = screen.getByLabelText('filterCashier')
    await user.type(search, 'cashier-x')

    const lastCall = mockUseWorkShifts.mock.calls.at(-1)?.[0]
    expect(lastCall.cashierSlug).toBe('cashier-x')
  })

  it('hides the cashier search for a CASHIER and never sends cashierSlug (D2: own shifts only)', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    renderHistoryTab()

    expect(screen.queryByLabelText('filterCashier')).not.toBeInTheDocument()

    const lastCall = mockUseWorkShifts.mock.calls.at(-1)?.[0]
    expect(lastCall.cashierSlug).toBeUndefined()
  })

  it('drops a stale cashierSlug from the query when the role changes to CASHIER after typing as MANAGER', async () => {
    const user = userEvent.setup()
    mockRole.mockReturnValue(Role.MANAGER)
    const { rerender } = renderHistoryTab()

    await user.type(screen.getByLabelText('filterCashier'), 'cashier-x')
    expect(mockUseWorkShifts.mock.calls.at(-1)?.[0].cashierSlug).toBe('cashier-x')

    // Re-render the SAME instance as CASHIER so the cashierSlug state (still
    // 'cashier-x') survives — proves the query builder re-checks the role
    // guard every render instead of leaking a stale value.
    mockRole.mockReturnValue(Role.CASHIER)
    rerender(
      <MemoryRouter>
        <HistoryTab />
      </MemoryRouter>,
    )

    expect(screen.queryByLabelText('filterCashier')).not.toBeInTheDocument()
    expect(mockUseWorkShifts.mock.calls.at(-1)?.[0].cashierSlug).toBeUndefined()
  })
})

describe('HistoryTab date-range translation', () => {
  it("sends no dates while the filter is 'allTime' (the default = no date filter)", () => {
    renderHistoryTab()

    const lastCall = mockUseWorkShifts.mock.calls.at(-1)?.[0]
    expect(lastCall.startDate).toBeUndefined()
    expect(lastCall.endDate).toBeUndefined()
  })

  it('converts the popover ISO datetimes to the YYYY-MM-DD the API expects', async () => {
    const user = userEvent.setup()
    renderHistoryTab()

    await user.click(screen.getByRole('button', { name: 'applyDateFilter' }))

    const lastCall = mockUseWorkShifts.mock.calls.at(-1)?.[0]
    expect(lastCall.startDate).toBe('2026-07-01')
    expect(lastCall.endDate).toBe('2026-07-15')
  })
})
