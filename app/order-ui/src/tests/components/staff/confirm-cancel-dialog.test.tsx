import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmCancelDialog } from '@/components/staff/confirm-cancel-dialog'

describe('ConfirmCancelDialog', () => {
  it('renders nothing when open is false', () => {
    render(
      <ConfirmCancelDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.queryByText('Huỷ đơn?')).not.toBeInTheDocument()
  })

  it('renders dialog content when open is true', () => {
    render(
      <ConfirmCancelDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('Huỷ đơn?')).toBeInTheDocument()
    expect(screen.getByText(/toàn bộ đơn đã đặt sẽ bị xoá/i)).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmCancelDialog open={true} onConfirm={onConfirm} onCancel={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /xác nhận huỷ/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when back button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmCancelDialog open={true} onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /quay lại/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
