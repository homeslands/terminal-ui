import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TransferTableDialog } from '@/components/staff/transfer-table-dialog'
import type { TableSession } from '@/types/session'

const tables = [
  { id: 't1', label: 'Bàn 01', seats: 4 },
  { id: 't2', label: 'Bàn 02', seats: 4 },
  { id: 't3', label: 'Bàn 03', seats: 6 },
]

const occupiedSession = (): TableSession => ({
  tableId: 't2',
  tableName: 'Bàn 02',
  status: 'serving',
  pendingItems: [],
  submittedOrders: [],
  openedAt: '',
})

function renderDialog(props: Partial<React.ComponentProps<typeof TransferTableDialog>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <TransferTableDialog
        currentTableId="t1"
        currentTableName="Bàn 01"
        tables={tables}
        sessions={{ t2: occupiedSession() }}
        onTransferred={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
}

function open(onTransferred = vi.fn()) {
  renderDialog({ onTransferred })
  fireEvent.click(screen.getByRole('button', { name: /đổi bàn/i }))
}

describe('TransferTableDialog', () => {
  it('shows all tables except the current one when opened', () => {
    open()
    expect(screen.queryByText('Bàn 01')).not.toBeInTheDocument()
    expect(screen.getByText('Bàn 02')).toBeInTheDocument()
    expect(screen.getByText('Bàn 03')).toBeInTheDocument()
  })

  it('occupied table button is disabled', () => {
    open()
    expect(screen.getByRole('button', { name: /bàn 02/i })).toBeDisabled()
  })

  it('empty table button is enabled', () => {
    open()
    expect(screen.getByRole('button', { name: /bàn 03/i })).not.toBeDisabled()
  })

  it('Xác nhận is disabled until a table is selected', () => {
    open()
    expect(screen.getByRole('button', { name: /xác nhận/i })).toBeDisabled()
  })

  it('selecting a table enables Xác nhận and shows route hint', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /bàn 03/i }))
    expect(screen.getByRole('button', { name: /xác nhận/i })).not.toBeDisabled()
    expect(screen.getByText('→')).toBeInTheDocument()
  })

  it('Xác nhận calls onTransferred with the selected table (pending-only, no orderSlug)', () => {
    const onTransferred = vi.fn()
    open(onTransferred)
    fireEvent.click(screen.getByRole('button', { name: /bàn 03/i }))
    fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
    expect(onTransferred).toHaveBeenCalledWith({ id: 't3', label: 'Bàn 03' })
  })

  it('Hủy closes dialog without calling onTransferred', () => {
    const onTransferred = vi.fn()
    open(onTransferred)
    fireEvent.click(screen.getByRole('button', { name: /hủy/i }))
    expect(onTransferred).not.toHaveBeenCalled()
  })

  it('opens warning step before selector when requiresConfirm is set', () => {
    const onTransferred = vi.fn()
    renderDialog({ sessions: {}, onTransferred, requiresConfirm: true })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi bàn' }))
    // Warning step appears, not the selector
    expect(screen.getByText(/Cảnh báo đổi bàn có đơn/)).toBeInTheDocument()
    expect(screen.queryByText('Bàn 02')).not.toBeInTheDocument()
    // Confirm the warning
    fireEvent.click(screen.getByRole('button', { name: /tôi hiểu/i }))
    // Selector now appears
    expect(screen.getByText('Bàn 02')).toBeInTheDocument()
  })

  it('opens selector directly when requiresConfirm is not set', () => {
    renderDialog({ sessions: {} })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi bàn' }))
    expect(screen.queryByText(/Cảnh báo/)).not.toBeInTheDocument()
    expect(screen.getByText('Bàn 02')).toBeInTheDocument()
  })

  it('does not call onTransferred when warning is canceled', () => {
    const onTransferred = vi.fn()
    renderDialog({ sessions: {}, onTransferred, requiresConfirm: true })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi bàn' }))
    fireEvent.click(screen.getByRole('button', { name: /quay lại/i }))
    expect(screen.queryByText(/Cảnh báo/)).not.toBeInTheDocument()
    expect(onTransferred).not.toHaveBeenCalled()
  })

  it('shows empty message when all other tables are occupied', () => {
    renderDialog({
      tables: [
        { id: 't1', label: 'Bàn 01', seats: 4 },
        { id: 't2', label: 'Bàn 02', seats: 4 },
      ],
      sessions: { t2: occupiedSession() },
    })
    fireEvent.click(screen.getByRole('button', { name: /đổi bàn/i }))
    expect(screen.getByText(/không có bàn trống/i)).toBeInTheDocument()
  })
})
