import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { Role, ROUTE } from '@/constants'

const mockRole = vi.fn()
const mockShift = vi.fn()
const mockFetched = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/stores', () => ({
  useUserStore: (selector: (s: unknown) => unknown) =>
    selector({ getUserInfo: () => ({ role: { name: mockRole() } }) }),
}))

vi.mock('@/hooks', () => ({
  useCurrentWorkShift: () => ({ data: mockShift(), isFetched: mockFetched() }),
}))

vi.mock('@/components/work-shift/close-shift-dialog', () => ({
  CloseShiftDialog: () => <div data-testid="close-shift-dialog-marker" />,
}))

import { CurrentShiftIndicator } from '@/components/work-shift/current-shift-indicator'

const START = '2026-07-23T10:00:00.000Z'
const ACTIVE_SHIFT = {
  slug: 'ws-1',
  actualStartTime: START,
  totalRevenue: 100,
  totalOrders: 1,
  cashier: { firstName: 'Thu', lastName: 'Ngan' },
  branch: { name: 'Chi nhanh 1' },
}

describe('CurrentShiftIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(START))
    mockFetched.mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders null for a non-CASHIER role', () => {
    mockRole.mockReturnValue(Role.MANAGER)
    mockShift.mockReturnValue(ACTIVE_SHIFT)
    const { container } = render(<CurrentShiftIndicator />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders null for a CASHIER before the first fetch settles (no flash)', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockShift.mockReturnValue(undefined)
    mockFetched.mockReturnValue(false)
    const { container } = render(<CurrentShiftIndicator />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a "no shift open" badge that navigates to the work-shift page', async () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockShift.mockReturnValue(undefined)
    mockFetched.mockReturnValue(true)

    render(<CurrentShiftIndicator />)
    const badge = screen.getByText('notOpenedBadge')
    expect(badge).toBeInTheDocument()

    // The badge is a button; clicking it routes to /system/work-shifts.
    await act(async () => {
      badge.closest('button')?.click()
    })
    expect(mockNavigate).toHaveBeenCalledWith(ROUTE.SYSTEM_WORK_SHIFTS)
  })

  it('keeps advancing the elapsed-time label across a data refetch (I9 regression)', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockShift.mockReturnValue(ACTIVE_SHIFT)

    const { rerender } = render(<CurrentShiftIndicator />)
    expect(screen.getByText('0m')).toBeInTheDocument()

    // Half the tick interval elapses, then a refetch lands — a *new*
    // object with the SAME shift slug but different revenue (exactly
    // what the 30s useCurrentWorkShift refetch produces during service).
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    mockShift.mockReturnValue({ ...ACTIVE_SHIFT, totalRevenue: 200 })
    act(() => {
      rerender(<CurrentShiftIndicator />)
    })

    // The remaining 30s of the original 60s tick elapses. If the tick
    // interval were keyed on the whole `shift` object it would have been
    // torn down and recreated at the refetch above, so it would NOT have
    // fired yet here — the label would still read "0m".
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText('1m')).toBeInTheDocument()
  })
})
