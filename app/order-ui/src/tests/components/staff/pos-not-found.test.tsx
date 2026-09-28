import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PosNotFoundState } from '@/components/staff/pos-not-found'

function renderIt(message: string) {
  return render(
    <MemoryRouter>
      <PosNotFoundState message={message} />
    </MemoryRouter>,
  )
}

describe('PosNotFoundState', () => {
  it('renders the message', () => {
    renderIt('Không tìm thấy bàn.')
    expect(screen.getByText('Không tìm thấy bàn.')).toBeInTheDocument()
  })

  it('renders a link to /staff', () => {
    renderIt('Lỗi.')
    expect(screen.getByRole('link', { name: /sơ đồ/i })).toHaveAttribute('href', '/staff')
  })

  it('wrapper uses bg-pos-bg and text-pos-text', () => {
    const { container } = renderIt('Lỗi.')
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('bg-pos-bg')
    expect(wrapper).toHaveClass('text-pos-text')
  })
})
