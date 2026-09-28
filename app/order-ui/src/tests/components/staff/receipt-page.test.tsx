import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StaffReceiptPage from '@/app/staff/receipt'

vi.mock('@/hooks/useTableSessions', () => ({
  useTableSessions: () => ({ sessions: {}, closeSession: vi.fn() }),
}))

function renderPage(id = 'no-such-table') {
  render(
    <MemoryRouter initialEntries={[`/staff/table/${id}`]}>
      <Routes>
        <Route path="/staff/table/:id" element={<StaffReceiptPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StaffReceiptPage — token classes', () => {
  it('not-found wrapper uses bg-pos-bg and text-pos-text', () => {
    renderPage()
    const wrapper = screen.getByText(/không tìm thấy phiên/i).closest('div')!
    expect(wrapper).toHaveClass('bg-pos-bg')
    expect(wrapper).toHaveClass('text-pos-text')
  })
})
