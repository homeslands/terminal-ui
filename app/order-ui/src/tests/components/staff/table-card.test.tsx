import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableCard } from '@/components/staff/table-card'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'

const table: Table = { id: 't1', label: 'Bàn 01', seats: 4 }

const servingSession = (): TableSession => ({
  tableId: 't1',
  tableName: 'Bàn 01',
  status: 'serving',
  openedAt: '',
  pendingItems: [
    { menuItemId: 'm1', name: 'A', priceNum: 10_000, price: '10.000đ', quantity: 2, note: '' },
  ],
  submittedOrders: [
    {
      id: 'order-1',
      submittedAt: '',
      items: [
        { menuItemId: 'm2', name: 'B', priceNum: 20_000, price: '20.000đ', quantity: 1, note: '' },
      ],
    },
  ],
})

describe('TableCard', () => {
  it('renders label and seats for an empty table', () => {
    render(<TableCard table={table} session={undefined} onClick={() => {}} />)
    expect(screen.getByText('Bàn 01')).toBeInTheDocument()
    expect(screen.getByText(/4/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<TableCard table={table} session={undefined} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith('t1')
  })

  it('shows serving status with item count and combined total', () => {
    render(<TableCard table={table} session={servingSession()} onClick={() => {}} />)
    // 2 pending + 1 submitted = 3 items, 2*10000 + 1*20000 = 40000
    expect(screen.getByText(/3/)).toBeInTheDocument()
    expect(screen.getByText(/40\.000đ/)).toBeInTheDocument()
    expect(screen.getByTestId('table-card')).toHaveClass('border-pos-gold')
  })

  it('shows waiting_payment status as serving (merged UI)', () => {
    const session: TableSession = { ...servingSession(), status: 'waiting_payment' }
    render(<TableCard table={table} session={session} onClick={() => {}} />)
    // waiting_payment merged into serving UI — same gold border and label
    expect(screen.getByTestId('table-card')).toHaveClass('border-pos-gold')
    expect(screen.getByText('Đang phục vụ')).toBeInTheDocument()
  })

  it('treats status "done" the same as empty', () => {
    const session: TableSession = { ...servingSession(), status: 'done' }
    render(<TableCard table={table} session={session} onClick={() => {}} />)
    expect(screen.getByTestId('table-card')).toHaveClass('border-pos-border')
  })
})
