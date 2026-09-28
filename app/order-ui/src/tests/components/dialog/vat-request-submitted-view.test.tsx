import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VatRequestSubmittedView } from '@/components/app/dialog/vat-request/vat-request-submitted-view'

describe('VatRequestSubmittedView', () => {
  it('renders the already-submitted message and email hint', () => {
    render(<VatRequestSubmittedView />)
    expect(
      screen.getByText(/đã được ghi nhận|already/i),
    ).toBeTruthy()
    expect(screen.getByText(/email/i)).toBeTruthy()
  })
})
