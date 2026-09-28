import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableStatusBadge } from '@/components/staff/table-status-badge'

describe('TableStatusBadge', () => {
  it('renders table name', () => {
    render(<TableStatusBadge tableName="Bàn 01" status="serving" />)
    expect(screen.getByText('Bàn 01')).toBeInTheDocument()
  })

  it('shows ĐANG PHỤC VỤ with gold colour for serving status', () => {
    render(<TableStatusBadge tableName="Bàn 01" status="serving" />)
    const label = screen.getByText('ĐANG PHỤC VỤ')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass('text-pos-gold')
  })

  it('shows CHỜ THANH TOÁN with orange colour for waiting_payment status', () => {
    render(<TableStatusBadge tableName="Bàn 02" status="waiting_payment" />)
    const label = screen.getByText('CHỜ THANH TOÁN')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass('text-orange-400')
  })
})
