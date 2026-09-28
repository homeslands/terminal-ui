import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'

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

// Radix Select needs pointer-capture APIs jsdom lacks; swap it for a native
// <select> so the disabled state of each slot can be read directly.
vi.mock('@/components/ui/select', () => {
  const Select = ({
    value,
    children,
  }: {
    value?: string
    children?: React.ReactNode
  }) => (
    <select role="combobox" value={value} onChange={() => {}}>
      {children}
    </select>
  )
  const SelectTrigger = forwardRef(
    ({ children }: { children?: React.ReactNode }, _ref: unknown) => (
      <>{children}</>
    ),
  )
  SelectTrigger.displayName = 'SelectTrigger'
  const SelectValue = () => null
  const SelectContent = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  )
  const SelectItem = ({
    value,
    disabled,
    children,
  }: {
    value: string
    disabled?: boolean
    children?: React.ReactNode
  }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  )
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

import { CreateStaffTableBookingForm } from '@/components/app/form/create-staff-table-booking-form'
import { _resetServerTimeOffsetForTests } from '@/lib/server-time'

/** Opens the hour/minute picker and returns a lookup for its options. */
const openTimePicker = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /form.chooseTime/ }))
  const [hours, minutes] = screen.getAllByRole('combobox')
  const option = (el: HTMLElement, value: string) =>
    el.querySelector<HTMLOptionElement>(`option[value="${value}"]`)
  return { hours, minutes, option }
}

beforeEach(() => {
  _resetServerTimeOffsetForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-21T14:00:00'))
  render(<CreateStaffTableBookingForm onSubmit={() => {}} />)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CreateStaffTableBookingForm — time validation', () => {
  it('locks hours that already passed today', async () => {
    const { hours, option } = await openTimePicker()

    expect(option(hours, '10')?.disabled).toBe(true)
    expect(option(hours, '13')?.disabled).toBe(true)
    expect(option(hours, '14')?.disabled).toBe(false) // 14:01 onwards
  })

  it('locks hours outside the daily booking window', async () => {
    const { hours, option } = await openTimePicker()

    expect(option(hours, '23')?.disabled).toBe(true)
    expect(option(hours, '22')?.disabled).toBe(false)
  })

  it('locks the minutes of the current hour that have passed', async () => {
    const { minutes, option } = await openTimePicker()

    // Now is 14:00, so the booking can only start at 14:01 at the earliest.
    expect(option(minutes, '0')?.disabled).toBe(true)
    expect(option(minutes, '1')?.disabled).toBe(false)
  })
})
