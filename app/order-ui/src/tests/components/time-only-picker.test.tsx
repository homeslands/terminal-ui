import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// Radix Select needs pointer-capture APIs jsdom lacks; swap it for a native
// <select> so each option's disabled state can be read directly.
vi.mock('@/components/ui/select', () => {
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    children?: React.ReactNode
  }) => (
    <select
      role="combobox"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
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

import TimeOnlyPicker from '@/components/app/picker/time-only-picker'

const open = async (ui: React.ReactElement) => {
  const user = userEvent.setup()
  render(ui)
  await user.click(screen.getByRole('button'))
  const [hours, minutes] = screen.getAllByRole('combobox')
  const option = (el: HTMLElement, v: string) =>
    el.querySelector<HTMLOptionElement>(`option[value="${v}"]`)
  return { user, hours, minutes, option }
}

describe('TimeOnlyPicker', () => {
  it('offers every hour and minute when no bounds are given', async () => {
    const { hours, minutes, option } = await open(
      <TimeOnlyPicker value="09:30" onSelect={() => {}} />,
    )

    expect(hours.querySelectorAll('option')).toHaveLength(24)
    expect(minutes.querySelectorAll('option')).toHaveLength(60)
    expect(option(hours, '0')?.disabled).toBe(false)
    expect(option(minutes, '59')?.disabled).toBe(false)
  })

  it('locks hours with no selectable minute', async () => {
    const { hours, option } = await open(
      <TimeOnlyPicker
        value="12:00"
        onSelect={() => {}}
        minTime="10:30"
        maxTime="22:30"
      />,
    )

    expect(option(hours, '9')?.disabled).toBe(true)
    expect(option(hours, '10')?.disabled).toBe(false) // 10:30 is reachable
    expect(option(hours, '22')?.disabled).toBe(false) // 22:00 is reachable
    expect(option(hours, '23')?.disabled).toBe(true)
  })

  it('locks minutes that fall outside the range for the chosen hour', async () => {
    const { minutes, option } = await open(
      <TimeOnlyPicker
        value="10:45"
        onSelect={() => {}}
        minTime="10:30"
        maxTime="22:30"
      />,
    )

    expect(option(minutes, '29')?.disabled).toBe(true)
    expect(option(minutes, '30')?.disabled).toBe(false)
  })

  it('pulls the minute into range when the hour changes', async () => {
    const onSelect = vi.fn()
    const { user, hours } = await open(
      <TimeOnlyPicker
        value="12:00"
        onSelect={onSelect}
        minTime="10:30"
        maxTime="22:30"
      />,
    )

    // 10:00 is before the lower bound, so picking hour 10 lands on 10:30.
    await user.selectOptions(hours, '10')
    expect(onSelect).toHaveBeenCalledWith('10:30')
  })

  it('honours a minute step', async () => {
    const { minutes } = await open(
      <TimeOnlyPicker value="12:00" onSelect={() => {}} minuteStep={15} />,
    )

    expect(
      Array.from(minutes.querySelectorAll('option')).map((o) => o.value),
    ).toEqual(['0', '15', '30', '45'])
  })

  it('opens on a selectable time when nothing is picked yet', async () => {
    const { hours, minutes } = await open(
      <TimeOnlyPicker
        value=""
        onSelect={() => {}}
        minTime="18:15"
        maxTime="22:30"
      />,
    )

    // Not the bare 08:00 default, which the bounds would have disabled.
    expect((hours as HTMLSelectElement).value).toBe('18')
    expect((minutes as HTMLSelectElement).value).toBe('15')
  })
})
