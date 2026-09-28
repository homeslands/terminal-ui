import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) =>
      opts ? `${key}:${Object.values(opts).join(',')}` : key,
    i18n: { language: 'en' },
  }),
}))

vi.mock('@/hooks', () => ({
  useCreateTableBooking: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { CreateTableBookingForm } from '@/components/app/form/create-table-booking-form'

/**
 * Walks the lead card -> dialog -> "other time" path and opens the clock
 * picker. `now` is frozen so the available slots (and the today/now lower
 * bound) don't depend on when the suite runs.
 */
const openCustomTimePicker = async (now: string) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
  const user = userEvent.setup()
  render(<CreateTableBookingForm />)

  await user.type(screen.getByPlaceholderText('form.namePlaceholder'), 'Minh')
  await user.type(
    screen.getByPlaceholderText('form.phonePlaceholder'),
    '0901234567',
  )
  await user.click(screen.getByRole('button', { name: 'form.continue' }))

  const dialog = await screen.findByRole('dialog')
  await user.click(
    within(dialog).getByRole('button', { name: 'form.otherTime' }),
  )

  // The picker trigger is the only button next to the "choose a time" label.
  const label = within(dialog).getAllByText('form.chooseTime')[0]
  const trigger = label.parentElement?.querySelector('button')
  await user.click(trigger as HTMLButtonElement)
  return user
}

const wheel = (name: string) => screen.getByRole('listbox', { name })
const labelsOf = (name: string) =>
  within(wheel(name))
    .getAllByRole('option')
    .map((el) => el.textContent)

afterEach(() => {
  vi.useRealTimers()
})

describe('CreateTableBookingForm — custom time', () => {
  it('opens the hour and minute wheels for "other time"', async () => {
    await openCustomTimePicker('2026-09-21T09:00:00')

    expect(wheel('form.hour')).toBeInTheDocument()
    expect(wheel('form.minute')).toBeInTheDocument()
    // 24-hour form: no AM/PM wheel.
    expect(screen.getAllByRole('listbox')).toHaveLength(2)
  })

  it('offers every minute from 00 to 59', async () => {
    await openCustomTimePicker('2026-09-21T09:00:00')

    expect(labelsOf('form.minute')).toEqual(
      Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')),
    )
  })

  it('locks hours outside the daily booking window (10:30–22:30)', async () => {
    await openCustomTimePicker('2026-09-21T09:00:00')

    const hours = within(wheel('form.hour'))
    expect(hours.getByRole('option', { name: '09' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(hours.getByRole('option', { name: '23' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(hours.getByRole('option', { name: '10' })).not.toHaveAttribute(
      'aria-disabled',
    )
    expect(hours.getByRole('option', { name: '22' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it('locks times that already passed when booking for today', async () => {
    await openCustomTimePicker('2026-09-21T12:07:00')

    const hours = within(wheel('form.hour'))
    expect(hours.getByRole('option', { name: '11' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(hours.getByRole('option', { name: '12' })).not.toHaveAttribute(
      'aria-disabled',
    )

    // Hour 12 is reachable, but only from 12:07 onwards (bound inclusive).
    const minutes = within(wheel('form.minute'))
    expect(minutes.getByRole('option', { name: '06' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(minutes.getByRole('option', { name: '07' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })
})
