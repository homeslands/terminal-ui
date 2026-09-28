import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InvoiceForm } from '@/components/staff/invoice-form'

const noop = vi.fn()

describe('InvoiceForm — token classes', () => {
  it('modal container uses bg-pos-surface, border-pos-border, text-pos-text', () => {
    const { container } = render(<InvoiceForm onSubmit={noop} onCancel={noop} />)
    const modal = container.querySelector('.max-w-md') as HTMLElement
    expect(modal).toHaveClass('bg-pos-surface')
    expect(modal).toHaveClass('border-pos-border')
    expect(modal).toHaveClass('text-pos-text')
  })

  it('submit button uses bg-pos-gold', () => {
    render(<InvoiceForm onSubmit={noop} onCancel={noop} />)
    expect(screen.getByRole('button', { name: /xuất hoá đơn/i })).toHaveClass('bg-pos-gold')
  })

  it('cancel button uses border-pos-border', () => {
    render(<InvoiceForm onSubmit={noop} onCancel={noop} />)
    expect(screen.getByRole('button', { name: /hủy/i })).toHaveClass('border-pos-border')
  })
})
