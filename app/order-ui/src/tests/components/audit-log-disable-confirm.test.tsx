import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, string>) =>
      opts ? `${k}:${Object.values(opts).join(',')}` : k,
  }),
}))

import { DisableConfirmDialog } from '@/app/system/audit-log/config/disable-confirm-dialog'

describe('DisableConfirmDialog', () => {
  it('renders the entity name in the description', () => {
    render(
      <DisableConfirmDialog
        open
        entity="Order"
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(
      screen.getByText('auditLog.config.disableBody:Order'),
    ).toBeInTheDocument()
  })

  it('calls onConfirm when destructive action clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <DisableConfirmDialog
        open
        entity="Order"
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />,
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'auditLog.config.disableConfirm' }),
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
