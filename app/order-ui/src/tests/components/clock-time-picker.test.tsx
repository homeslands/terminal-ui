import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ClockTimeWheels } from '@/components/app/picker'
import ClockTimePicker from '@/components/app/picker/clock-time-picker'

const wheel = (name: string) => screen.getByRole('listbox', { name })
const option = (listbox: HTMLElement, label: string) =>
  within(listbox).getByRole('option', { name: label })

afterEach(() => {
  vi.useRealTimers()
})

describe('ClockTimeWheels', () => {
  it('renders one wheel per unit and hides AM/PM in 24h mode', () => {
    render(<ClockTimeWheels value="09:30" onChange={() => {}} />)

    expect(screen.getAllByRole('listbox')).toHaveLength(2)
    expect(within(wheel('Hour')).getAllByRole('option')).toHaveLength(24)
    expect(within(wheel('Minute')).getAllByRole('option')).toHaveLength(60)
  })

  it('marks the current value as the selected option', () => {
    render(<ClockTimeWheels value="09:30" onChange={() => {}} />)

    expect(option(wheel('Hour'), '09')).toHaveAttribute('aria-selected', 'true')
    expect(option(wheel('Minute'), '30')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('emits HH:mm when a row is picked', async () => {
    const onChange = vi.fn()
    render(<ClockTimeWheels value="09:30" onChange={onChange} />)

    fireEvent.click(option(wheel('Hour'), '14'))
    expect(onChange).toHaveBeenCalledWith('14:30')

    fireEvent.click(option(wheel('Minute'), '05'))
    expect(onChange).toHaveBeenLastCalledWith('09:05')
  })

  it('only offers minutes on the step grid', () => {
    render(<ClockTimeWheels value="09:30" onChange={() => {}} minuteStep={15} />)

    const labels = within(wheel('Minute'))
      .getAllByRole('option')
      .map((el) => el.textContent)
    expect(labels).toEqual(['00', '15', '30', '45'])
  })

  it('disables hours and minutes outside [minTime, maxTime]', () => {
    render(
      <ClockTimeWheels
        value="08:30"
        onChange={() => {}}
        minTime="08:30"
        maxTime="21:00"
      />,
    )

    expect(option(wheel('Hour'), '07')).toHaveAttribute('aria-disabled', 'true')
    expect(option(wheel('Hour'), '22')).toHaveAttribute('aria-disabled', 'true')
    expect(option(wheel('Hour'), '08')).not.toHaveAttribute('aria-disabled')
    // 08:00 is before the lower bound even though hour 08 is reachable.
    expect(option(wheel('Minute'), '00')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(option(wheel('Minute'), '30')).not.toHaveAttribute('aria-disabled')
  })

  it('ignores clicks on out-of-range rows', async () => {
    const onChange = vi.fn()
    render(
      <ClockTimeWheels
        value="08:30"
        onChange={onChange}
        minTime="08:30"
        maxTime="21:00"
      />,
    )

    fireEvent.click(option(wheel('Hour'), '07'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('pulls the minute back into range when the hour changes', async () => {
    const onChange = vi.fn()
    render(
      <ClockTimeWheels
        value="09:15"
        onChange={onChange}
        minTime="08:30"
        maxTime="21:00"
      />,
    )

    fireEvent.click(option(wheel('Hour'), '08'))
    expect(onChange).toHaveBeenCalledWith('08:30')
  })

  it('moves by one row with the arrow keys and skips disabled rows', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ClockTimeWheels value="10:00" onChange={onChange} />,
    )

    fireEvent.keyDown(wheel('Hour'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith('11:00')

    rerender(
      <ClockTimeWheels
        value="09:00"
        onChange={onChange}
        minTime="08:30"
        maxTime="21:00"
      />,
    )
    // 08:xx below 08:30 is unreachable but hour 08 itself is, so ArrowUp lands on it.
    fireEvent.keyDown(wheel('Hour'), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith('08:30')
  })

  it('adds a third wheel in 12-hour mode and converts on AM/PM change', async () => {
    const onChange = vi.fn()
    render(
      <ClockTimeWheels value="09:30" onChange={onChange} use12Hour />,
    )

    expect(screen.getAllByRole('listbox')).toHaveLength(3)
    expect(option(wheel('Hour'), '09')).toHaveAttribute('aria-selected', 'true')
    expect(option(wheel('AM/PM'), 'AM')).toHaveAttribute(
      'aria-selected',
      'true',
    )

    fireEvent.click(option(wheel('AM/PM'), 'PM'))
    expect(onChange).toHaveBeenCalledWith('21:30')
  })

  it('starts at defaultTime when there is no value', () => {
    render(
      <ClockTimeWheels value={null} onChange={() => {}} defaultTime="18:45" />,
    )

    expect(option(wheel('Hour'), '18')).toHaveAttribute('aria-selected', 'true')
    expect(option(wheel('Minute'), '45')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})

describe('ClockTimePicker', () => {
  it('shows the placeholder until a value is set', () => {
    render(
      <ClockTimePicker
        value={null}
        onChange={() => {}}
        placeholder="Pick a time"
      />,
    )

    expect(screen.getByRole('button')).toHaveTextContent('Pick a time')
  })

  it('formats the trigger for 24h and 12h display', () => {
    const { rerender } = render(
      <ClockTimePicker value="21:05" onChange={() => {}} />,
    )
    expect(screen.getByRole('button')).toHaveTextContent('21:05')

    rerender(<ClockTimePicker value="21:05" onChange={() => {}} use12Hour />)
    expect(screen.getByRole('button')).toHaveTextContent('09:05 PM')
  })

  it('opens the wheels in a popover and emits a pick', async () => {
    const onChange = vi.fn()
    render(<ClockTimePicker value="09:30" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button'))
    fireEvent.click(option(wheel('Hour'), '11'))

    expect(onChange).toHaveBeenCalledWith('11:30')
  })

  it('clamps "Now" into the allowed window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-21T06:12:00'))
    const onChange = vi.fn()

    render(
      <ClockTimePicker
        value="09:30"
        onChange={onChange}
        minTime="08:30"
        maxTime="21:00"
        labels={{ now: 'Now' }}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /09:30/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Now' }))

    expect(onChange).toHaveBeenCalledWith('08:30')
  })

  it('clears through the trigger affordance', async () => {
    const onClear = vi.fn()
    render(
      <ClockTimePicker
        value="09:30"
        onChange={() => {}}
        clearable
        onClear={onClear}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalled()
  })
})
