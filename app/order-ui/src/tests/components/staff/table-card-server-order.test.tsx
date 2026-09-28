import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TableCard } from '@/components/staff/table-card'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'

const baseTable: Table = {
  id: 't1',
  label: 'Bàn 1',
  seats: 4,
  status: 'reserved',
}

const baseOrder = {
  slug: 'order-1',
  status: 'pending',
  subtotal: 150_000,
  orderItems: [
    { quantity: 2 },
    { quantity: 1 },
  ],
  table: { slug: 't1' },
} as unknown as IOrder

describe('TableCard — serverOrder fallback', () => {
  it('derives itemCount and total from serverOrder when no local session', () => {
    render(
      <TableCard
        table={baseTable}
        session={undefined}
        serverOrder={baseOrder}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('3 món')).toBeInTheDocument()
    expect(screen.getByText(/150\.000/)).toBeInTheDocument()
    expect(screen.getByText('Có khách')).toBeInTheDocument()
  })

  it('prefers local session over serverOrder when both present', () => {
    render(
      <TableCard
        table={baseTable}
        session={
          {
            status: 'serving',
            tableName: 'Bàn 1',
            pendingItems: [
              { quantity: 5, priceNum: 10_000 } as never,
            ],
            submittedOrders: [],
          } as never
        }
        serverOrder={baseOrder}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('5 món')).toBeInTheDocument()
    expect(screen.getByText(/50\.000/)).toBeInTheDocument()
  })

  it('shows empty seats when neither session nor serverOrder is present', () => {
    render(
      <TableCard
        table={{ ...baseTable, status: 'available' }}
        session={undefined}
        serverOrder={null}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('4 chỗ')).toBeInTheDocument()
    expect(screen.getByText('Trống')).toBeInTheDocument()
  })
})
