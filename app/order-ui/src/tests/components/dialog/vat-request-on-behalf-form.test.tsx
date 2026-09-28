import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VatRequestOnBehalfForm } from '@/components/app/dialog/vat-request/vat-request-on-behalf-form'

describe('VatRequestOnBehalfForm', () => {
  it('renders 4 required fields + 2 optional', () => {
    render(
      <VatRequestOnBehalfForm
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/customername/i)).toBeTruthy()
    expect(screen.getByLabelText(/taxcode/i)).toBeTruthy()
    expect(screen.getByLabelText(/address/i)).toBeTruthy()
    expect(screen.getByLabelText(/^email/i)).toBeTruthy()
  })

  it('calls onSubmit with valid payload', async () => {
    const onSubmit = vi.fn()
    render(
      <VatRequestOnBehalfForm
        isSubmitting={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/customername/i), 'Công ty ABC')
    await user.type(screen.getByLabelText(/taxcode/i), '0123456789')
    await user.type(screen.getByLabelText(/address/i), '123 NH')
    await user.type(screen.getByLabelText(/^email/i), 'a@b.com')
    await user.click(screen.getByRole('button', { name: /gửi yêu cầu|submit/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      customerName: 'Công ty ABC',
      taxCode: '0123456789',
      address: '123 NH',
      email: 'a@b.com',
    })
  })

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = vi.fn()
    render(
      <VatRequestOnBehalfForm
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /đóng|cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
