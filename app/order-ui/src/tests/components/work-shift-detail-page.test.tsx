import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    )
  return { ...actual, useParams: () => ({ slug: 'ws-161004' }) }
})

const mockBySlug = vi.fn()
const mockOrders = vi.fn()
const mockInvoices = vi.fn()
const mockStaff = vi.fn()
const mockSummary = vi.fn()

vi.mock('@/hooks', () => ({
  useWorkShiftBySlug: () => mockBySlug(),
  useWorkShiftOrders: () => mockOrders(),
  useWorkShiftInvoices: () => mockInvoices(),
  useWorkShiftStaff: () => mockStaff(),
  useWorkShiftSummary: () => mockSummary(),
}))

import SystemWorkShiftDetailPage from '@/app/system/work-shifts/[slug]/page'

const idleList = { data: undefined, isLoading: false }

beforeEach(() => {
  mockOrders.mockReturnValue(idleList)
  mockInvoices.mockReturnValue(idleList)
  mockStaff.mockReturnValue(idleList)
  mockSummary.mockReturnValue({ data: undefined })
})

describe('SystemWorkShiftDetailPage — I5 visible error state', () => {
  it('shows a spinner while the initial fetch is in flight', () => {
    mockBySlug.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<SystemWorkShiftDetailPage />)
    expect(
      screen.queryByTestId('work-shift-detail-error'),
    ).not.toBeInTheDocument()
  })

  it('renders a visible error box (not a blank page) on 403/404', () => {
    mockBySlug.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<SystemWorkShiftDetailPage />)
    expect(screen.getByTestId('work-shift-detail-error')).toBeInTheDocument()
    expect(screen.getByText('shiftDetailError')).toBeInTheDocument()
  })

  it('renders the not-found message when data is simply absent (no error)', () => {
    mockBySlug.mockReturnValue({ data: undefined, isLoading: false, isError: false })
    render(<SystemWorkShiftDetailPage />)
    expect(screen.getByTestId('work-shift-detail-error')).toBeInTheDocument()
    expect(screen.getByText('shiftDetailNotFound')).toBeInTheDocument()
  })

  it('renders the shift content when data is present', () => {
    mockBySlug.mockReturnValue({
      data: {
        slug: 'ws-161004',
        cashier: { firstName: 'A', lastName: 'B' },
        branch: { name: 'Branch 1' },
      },
      isLoading: false,
      isError: false,
    })
    render(<SystemWorkShiftDetailPage />)
    expect(
      screen.queryByTestId('work-shift-detail-error'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('shiftDetail')).toBeInTheDocument()
  })
})
