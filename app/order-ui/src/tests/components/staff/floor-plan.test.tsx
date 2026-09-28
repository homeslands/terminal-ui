import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloorPlan } from '@/components/staff/floor-plan'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'

const tables: Table[] = [
  { id: 't1', label: 'Bàn 01', seats: 4 },
  { id: 't2', label: 'Bàn 02', seats: 4 },
  { id: 't3', label: 'Bàn 03', seats: 4 },
]

const baseSession = (id: string, status: TableSession['status']): TableSession => ({
  tableId: id,
  tableName: `Bàn ${id}`,
  status,
  pendingItems: [],
  submittedOrders: [],
  openedAt: '',
})

describe('FloorPlan', () => {
  it('renders one card per table', () => {
    render(<FloorPlan tables={tables} sessions={{}} onTableClick={() => {}} />)
    expect(screen.getAllByTestId('table-card')).toHaveLength(3)
  })

  it('shows 3 stat counters: total, occupied, empty (server-status as source of truth)', () => {
    const occupiedTables: Table[] = [
      { id: 't1', label: 'Bàn 01', seats: 4, status: 'reserved' },
      { id: 't2', label: 'Bàn 02', seats: 4, status: 'reserved' },
      { id: 't3', label: 'Bàn 03', seats: 4, status: 'available' },
    ]
    render(<FloorPlan tables={occupiedTables} sessions={{}} onTableClick={() => {}} />)
    expect(screen.getByTestId('stat-total')).toHaveTextContent('3')
    expect(screen.getByTestId('stat-occupied')).toHaveTextContent('2')
    expect(screen.getByTestId('stat-empty')).toHaveTextContent('1')
  })

  it('falls back to local session status when table.status is undefined (legacy/mock)', () => {
    const sessions = {
      t1: baseSession('t1', 'serving'),
      t2: baseSession('t2', 'waiting_payment'),
    }
    render(<FloorPlan tables={tables} sessions={sessions} onTableClick={() => {}} />)
    expect(screen.getByTestId('stat-occupied')).toHaveTextContent('2')
    expect(screen.getByTestId('stat-empty')).toHaveTextContent('1')
  })

  it('invokes onTableClick with the table id', () => {
    const onClick = vi.fn()
    render(<FloorPlan tables={tables} sessions={{}} onTableClick={onClick} />)
    fireEvent.click(screen.getAllByTestId('table-card')[1])
    expect(onClick).toHaveBeenCalledWith('t2')
  })
})
