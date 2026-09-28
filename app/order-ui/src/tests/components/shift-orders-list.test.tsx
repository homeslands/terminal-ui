import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { ShiftOrdersList } from '@/components/work-shift/shift-orders-list'
import { WorkShiftStatus, type IOrder } from '@/types'

function makeOrder(slug: string, shiftSlug: string | null): IOrder {
  return {
    slug,
    createdAt: '2026-06-29T09:30:00.000Z',
    referenceNumber: 1001,
    status: 'pending',
    subtotal: 150_000,
    workShift: shiftSlug
      ? { slug: shiftSlug, status: WorkShiftStatus.ACTIVE }
      : null,
  } as unknown as IOrder
}

describe('ShiftOrdersList', () => {
  it('marks orders belonging to another shift as cross-shift', () => {
    render(
      <ShiftOrdersList
        orders={[makeOrder('o-1', 'ws-a')]}
        currentShiftSlug="ws-b"
      />,
    )
    expect(screen.getByTestId('cross-shift-badge-o-1')).toBeInTheDocument()
  })

  it('does not mark orders belonging to the current shift', () => {
    render(
      <ShiftOrdersList
        orders={[makeOrder('o-2', 'ws-b')]}
        currentShiftSlug="ws-b"
      />,
    )
    expect(screen.queryByTestId('cross-shift-badge-o-2')).not.toBeInTheDocument()
  })

  it('does not mark orders with no shift assigned', () => {
    render(
      <ShiftOrdersList
        orders={[makeOrder('o-3', null)]}
        currentShiftSlug="ws-b"
      />,
    )
    expect(screen.queryByTestId('cross-shift-badge-o-3')).not.toBeInTheDocument()
  })

  it('renders an empty state when there are no orders', () => {
    render(<ShiftOrdersList orders={[]} currentShiftSlug="ws-b" />)
    expect(screen.getByTestId('shift-orders-empty')).toBeInTheDocument()
  })
})
