import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockMutate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks', () => ({
  useForceCloseWorkShift: () => ({ mutate: mockMutate, isPending: false }),
}))

import { ForceCloseDialog } from '@/components/work-shift/force-close-dialog'

beforeEach(() => {
  mockMutate.mockClear()
})

describe('ForceCloseDialog', () => {
  it('disables submit while the reason is empty', () => {
    render(
      <ForceCloseDialog shiftSlug="ws-1" open onOpenChange={() => {}} />,
    )
    expect(screen.getByTestId('force-close-submit')).toBeDisabled()
  })

  it('disables submit when the reason is only whitespace', async () => {
    const user = userEvent.setup()
    render(
      <ForceCloseDialog shiftSlug="ws-1" open onOpenChange={() => {}} />,
    )
    await user.type(screen.getByTestId('force-close-note'), '   ')
    expect(screen.getByTestId('force-close-submit')).toBeDisabled()
  })

  it('submits the trimmed reason with the shift slug', async () => {
    const user = userEvent.setup()
    render(
      <ForceCloseDialog shiftSlug="ws-1" open onOpenChange={() => {}} />,
    )
    await user.type(screen.getByTestId('force-close-note'), '  quen dong ca  ')
    await user.click(screen.getByTestId('force-close-submit'))
    expect(mockMutate).toHaveBeenCalledWith(
      { slug: 'ws-1', data: { note: 'quen dong ca' } },
      expect.anything(),
    )
  })
})
