import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PosPageHeader } from '@/components/staff/pos-page-header'

function renderHeader(props: Partial<React.ComponentProps<typeof PosPageHeader>> = {}) {
  return render(
    <MemoryRouter>
      <PosPageHeader backTo="/staff" backLabel="← Sơ đồ bàn" {...props} />
    </MemoryRouter>,
  )
}

describe('PosPageHeader', () => {
  it('renders back link with correct href', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: '← Sơ đồ bàn' })).toHaveAttribute('href', '/staff')
  })

  it('back link has muted and hover-gold classes', () => {
    renderHeader()
    expect(screen.getByRole('link')).toHaveClass('text-pos-muted', 'hover:text-pos-gold')
  })

  it('renders center slot content', () => {
    renderHeader({ center: <span>Center content</span> })
    expect(screen.getByText('Center content')).toBeInTheDocument()
  })

  it('renders right slot content', () => {
    renderHeader({ right: <button>Action</button> })
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('adds print:hidden class when printHidden is true', () => {
    const { container } = renderHeader({ printHidden: true })
    expect(container.querySelector('header')).toHaveClass('print:hidden')
  })

  it('does not add print:hidden class by default', () => {
    const { container } = renderHeader()
    expect(container.querySelector('header')).not.toHaveClass('print:hidden')
  })
})
