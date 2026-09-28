import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StaffInvoicePage from '@/app/staff/invoice'

vi.mock('@/hooks/useTableSessions', () => ({
  useTableSessions: () => ({ sessions: {}, closeSession: vi.fn() }),
}))

function renderPage(id = 'no-such-table') {
  render(
    <MemoryRouter initialEntries={[`/staff/table/${id}/invoice`]}>
      <Routes>
        <Route path="/staff/table/:id/invoice" element={<StaffInvoicePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StaffInvoicePage — token classes', () => {
  it('not-found wrapper uses bg-pos-bg and text-pos-text', () => {
    renderPage()
    const wrapper = screen.getByText(/thiếu dữ liệu hoá đơn/i).closest('div')!
    expect(wrapper).toHaveClass('bg-pos-bg')
    expect(wrapper).toHaveClass('text-pos-text')
  })
})
