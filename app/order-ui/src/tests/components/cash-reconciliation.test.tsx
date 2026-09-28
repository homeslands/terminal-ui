import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { CashReconciliation } from '@/components/work-shift/cash-reconciliation'

describe('CashReconciliation', () => {
  it('shows the read-only counted cash when no input slot is given', () => {
    render(
      <CashReconciliation
        openingCash={500_000}
        cashRevenue={650_000}
        countedCash={1_200_000}
        difference={50_000}
      />,
    )
    // No textbox in read-only mode.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'surplus',
    )
  })

  it('renders the input slot in place of the counted-cash value when editing', () => {
    render(
      <CashReconciliation
        openingCash={0}
        cashRevenue={118_000}
        countedCash={118_000}
        difference={0}
        input={<input aria-label="counted" />}
      />,
    )
    expect(screen.getByLabelText('counted')).toBeInTheDocument()
    // 118000 counted − (0 + 118000) expected = 0 → exact/reconciled.
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'exact',
    )
  })

  it('marks a shortage when the difference is negative', () => {
    render(
      <CashReconciliation
        openingCash={0}
        cashRevenue={118_000}
        countedCash={100_000}
        difference={-18_000}
      />,
    )
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'shortage',
    )
  })

  it('is pending while the shift is still open (null difference)', () => {
    render(
      <CashReconciliation
        openingCash={0}
        cashRevenue={118_000}
        countedCash={null}
        difference={null}
      />,
    )
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'pending',
    )
  })
})
