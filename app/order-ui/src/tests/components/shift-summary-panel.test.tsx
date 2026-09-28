import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Convention của repo: t() trả về chính key, không cần khởi tạo i18next.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { ShiftSummaryPanel } from '@/components/work-shift/shift-summary-panel'
import { WorkShiftStatus, type IWorkShiftSummary } from '@/types'

const baseSummary: IWorkShiftSummary = {
  workShift: {
    slug: 'ws-1',
    cashier: {
      slug: 'u-1',
      firstName: 'Nguyen',
      lastName: 'Van A',
      phonenumber: '0901234567',
    },
    branch: { slug: 'b-1', name: 'Chi nhánh Q1' },
    actualStartTime: '2026-06-29T08:00:00.000Z',
    actualEndTime: '2026-06-29T16:00:00.000Z',
    status: WorkShiftStatus.CLOSED,
    openingCash: 500_000,
    closingCash: 1_200_000,
    note: 'Ca sáng',
    createdAt: '2026-06-29T08:00:00.000Z',
  },
  openingCash: 500_000,
  closingCash: 1_200_000,
  cashRevenue: 650_000,
  cashDifference: 50_000,
  paymentSummary: [
    {
      paymentMethod: 'cash',
      displayName: 'Tiền mặt',
      totalAmount: 650_000,
      invoiceCount: 8,
    },
  ],
  totalRevenue: 970_000,
  totalOrders: 14,
  totalInvoicesPaid: 11,
  crossShiftOrdersCount: 2,
  staffSummary: [
    {
      staff: {
        slug: 'u-2',
        firstName: 'Tran',
        lastName: 'Thi B',
        phonenumber: '0912345678',
      },
      totalOrdersCreated: 9,
      totalOrdersRevenue: 580_000,
    },
  ],
  totalStaffWorked: 2,
}

describe('ShiftSummaryPanel', () => {
  it('renders headline counters', () => {
    render(<ShiftSummaryPanel summary={baseSummary} />)
    expect(screen.getByTestId('shift-total-orders')).toHaveTextContent('14')
    expect(screen.getByTestId('shift-total-invoices')).toHaveTextContent('11')
    expect(screen.getByTestId('shift-cross-shift-count')).toHaveTextContent('2')
  })

  it('renders one row per payment method', () => {
    render(<ShiftSummaryPanel summary={baseSummary} />)
    expect(screen.getAllByTestId('payment-summary-row')).toHaveLength(1)
    // Tên phương thức nằm trong span riêng để assert không bị vỡ bởi span lồng.
    expect(screen.getByTestId('payment-method-name')).toHaveTextContent(
      'Tiền mặt',
    )
  })

  it('renders one row per staff member', () => {
    render(<ShiftSummaryPanel summary={baseSummary} />)
    expect(screen.getAllByTestId('staff-summary-row')).toHaveLength(1)
    expect(screen.getByTestId('staff-name')).toHaveTextContent('Tran Thi B')
  })

  it('marks a positive cash difference as a surplus', () => {
    render(<ShiftSummaryPanel summary={baseSummary} />)
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'surplus',
    )
  })

  it('marks a negative cash difference as a shortage', () => {
    render(
      <ShiftSummaryPanel
        summary={{ ...baseSummary, cashDifference: -50_000 }}
      />,
    )
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'shortage',
    )
  })

  it('marks a zero cash difference as exact (till reconciled)', () => {
    render(
      <ShiftSummaryPanel summary={{ ...baseSummary, cashDifference: 0 }} />,
    )
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'exact',
    )
  })

  it('marks a null cash difference as pending (shift still active)', () => {
    render(
      <ShiftSummaryPanel
        summary={{ ...baseSummary, cashDifference: null, closingCash: null }}
      />,
    )
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'pending',
    )
  })
})
