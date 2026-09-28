import * as React from 'react'
import { Clock, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollWheel,
  type ScrollWheelOption,
} from '@/components/ui'
import {
  buildMinuteValues,
  clampToRange,
  formatDisplayTime,
  formatTimeString,
  isHourSelectable,
  isWithinRange,
  nearestSelectableMinute,
  pad2,
  parseTimeString,
  to12Hour,
  to24Hour,
  type Meridiem,
  type TimeParts,
} from '@/lib/clock-time'

export interface ClockTimePickerLabels {
  hour: string
  minute: string
  meridiem: string
  now: string
  clear: string
  done: string
}

const DEFAULT_LABELS: ClockTimePickerLabels = {
  hour: 'Hour',
  minute: 'Minute',
  meridiem: 'AM/PM',
  now: 'Now',
  clear: 'Clear',
  done: 'Done',
}

export interface ClockTimeWheelsProps {
  /** Canonical 24h "HH:mm". */
  value?: string | null
  onChange: (value: string) => void
  /** Inclusive bounds as "HH:mm". Out-of-range rows are not selectable. */
  minTime?: string | null
  maxTime?: string | null
  /** Minute granularity, e.g. 5 -> 00, 05, 10 ... */
  minuteStep?: number
  /** Adds a third wheel and shows hours as 01–12. */
  use12Hour?: boolean
  /** Where the wheels start when `value` is empty. */
  defaultTime?: string
  disabled?: boolean
  itemHeight?: number
  visibleCount?: number
  showLabels?: boolean
  labels?: Partial<ClockTimePickerLabels>
  className?: string
  /** Styling hooks so the panel can follow a host theme. */
  labelClassName?: string
  wheelClassName?: string
  itemClassName?: string
  bandClassName?: string
}

/**
 * The bare wheel panel — hours, minutes and (optionally) AM/PM. Usable on its
 * own inside a sheet, dialog or inline form; `ClockTimePicker` wraps it in a
 * Radix popover.
 */
export function ClockTimeWheels({
  value,
  onChange,
  minTime,
  maxTime,
  minuteStep = 1,
  use12Hour = false,
  defaultTime = '08:00',
  disabled = false,
  itemHeight = 40,
  visibleCount = 5,
  showLabels = true,
  labels,
  className,
  labelClassName,
  wheelClassName,
  itemClassName,
  bandClassName,
}: ClockTimeWheelsProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const step = minuteStep > 0 ? Math.floor(minuteStep) : 1

  const min = React.useMemo(() => parseTimeString(minTime), [minTime])
  const max = React.useMemo(() => parseTimeString(maxTime), [maxTime])

  const parsed = React.useMemo(() => parseTimeString(value), [value])

  // Fallback position for when nothing is picked yet — `value` stays the
  // source of truth whenever it holds a parsable time, so the wheels are
  // fully controlled and snap back if the parent rejects a change.
  const [fallback, setFallback] = React.useState<TimeParts>(() =>
    clampToRange(
      parsed ?? parseTimeString(defaultTime) ?? { hour: 8, minute: 0 },
      step,
      min,
      max,
    ),
  )
  const current = parsed ?? fallback

  const commit = React.useCallback(
    (next: TimeParts) => {
      const minute =
        nearestSelectableMinute(next.hour, next.minute, step, min, max) ??
        next.minute
      const result = { hour: next.hour, minute }
      setFallback(result)
      onChange(formatTimeString(result))
    },
    [max, min, onChange, step],
  )

  const { hour12, meridiem } = to12Hour(current.hour)

  const hourOptions = React.useMemo<ScrollWheelOption<number>[]>(() => {
    if (!use12Hour) {
      return Array.from({ length: 24 }, (_, hour) => ({
        value: hour,
        label: pad2(hour),
        disabled: !isHourSelectable(hour, step, min, max),
      }))
    }
    return Array.from({ length: 12 }, (_, index) => {
      const displayed = index + 1
      return {
        value: displayed,
        label: pad2(displayed),
        disabled: !isHourSelectable(
          to24Hour(displayed, meridiem),
          step,
          min,
          max,
        ),
      }
    })
  }, [max, meridiem, min, step, use12Hour])

  const minuteOptions = React.useMemo<ScrollWheelOption<number>[]>(
    () =>
      buildMinuteValues(step).map((minute) => ({
        value: minute,
        label: pad2(minute),
        disabled: !isWithinRange({ hour: current.hour, minute }, min, max),
      })),
    [current.hour, max, min, step],
  )

  const meridiemOptions = React.useMemo<ScrollWheelOption<Meridiem>[]>(
    () =>
      (['AM', 'PM'] as Meridiem[]).map((period) => ({
        value: period,
        label: period,
        disabled: !Array.from({ length: 12 }, (_, i) => i + 1).some((h) =>
          isHourSelectable(to24Hour(h, period), step, min, max),
        ),
      })),
    [max, min, step],
  )

  /** Closest hour to `preferred` that has at least one selectable minute. */
  const nearestSelectableHour = React.useCallback(
    (preferred: number, period?: Meridiem) => {
      const candidates = use12Hour
        ? Array.from({ length: 12 }, (_, i) =>
            to24Hour(i + 1, period ?? meridiem),
          )
        : Array.from({ length: 24 }, (_, i) => i)
      const usable = candidates.filter((hour) =>
        isHourSelectable(hour, step, min, max),
      )
      if (usable.length === 0) return null
      return usable.reduce((best, hour) =>
        Math.abs(hour - preferred) < Math.abs(best - preferred) ? hour : best,
      )
    },
    [max, meridiem, min, step, use12Hour],
  )

  const handleHourChange = (nextHour: number) => {
    const hour24 = use12Hour ? to24Hour(nextHour, meridiem) : nextHour
    commit({ hour: hour24, minute: current.minute })
  }

  const handleMinuteChange = (minute: number) => {
    commit({ hour: current.hour, minute })
  }

  const handleMeridiemChange = (period: Meridiem) => {
    const wanted = to24Hour(hour12, period)
    const hour = isHourSelectable(wanted, step, min, max)
      ? wanted
      : (nearestSelectableHour(wanted, period) ?? wanted)
    commit({ hour, minute: current.minute })
  }

  const columnLabel = (label: string) => (
    <span
      className={cn(
        'flex-1 text-center text-xs font-medium text-muted-foreground',
        labelClassName,
      )}
    >
      {label}
    </span>
  )

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {showLabels && (
        <div className="flex items-center gap-1">
          {columnLabel(text.hour)}
          <span className="w-3" aria-hidden />
          {columnLabel(text.minute)}
          {use12Hour && columnLabel(text.meridiem)}
        </div>
      )}

      <div className="relative flex items-stretch gap-1">
        {/* Selection band: the row under it is the selected value. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 rounded-md border-y border-border bg-accent/50',
            bandClassName,
          )}
          style={{ height: itemHeight }}
        />
        <ScrollWheel
          className={cn('z-10', wheelClassName)}
          itemClassName={itemClassName}
          label={text.hour}
          options={hourOptions}
          value={use12Hour ? hour12 : current.hour}
          onChange={handleHourChange}
          itemHeight={itemHeight}
          visibleCount={visibleCount}
          disabled={disabled}
        />
        <span
          aria-hidden
          className="z-10 flex w-3 items-center justify-center text-base font-semibold text-muted-foreground"
        >
          :
        </span>
        <ScrollWheel
          className={cn('z-10', wheelClassName)}
          itemClassName={itemClassName}
          label={text.minute}
          options={minuteOptions}
          value={current.minute}
          onChange={handleMinuteChange}
          itemHeight={itemHeight}
          visibleCount={visibleCount}
          disabled={disabled}
        />
        {use12Hour && (
          <ScrollWheel
            className={cn('z-10', wheelClassName)}
            itemClassName={itemClassName}
            label={text.meridiem}
            options={meridiemOptions}
            value={meridiem}
            onChange={handleMeridiemChange}
            itemHeight={itemHeight}
            visibleCount={visibleCount}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  )
}

export interface ClockTimePickerProps extends ClockTimeWheelsProps {
  placeholder?: string
  clearable?: boolean
  onClear?: () => void
  showNow?: boolean
  /** Trigger button classes. */
  className?: string
  contentClassName?: string
  align?: 'start' | 'center' | 'end'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  id?: string
}

/**
 * Clock-style time picker: a Radix popover holding independent, snapping
 * scroll wheels. Values are emitted as 24h "HH:mm" regardless of display.
 */
export default function ClockTimePicker({
  value,
  onChange,
  placeholder,
  clearable = false,
  onClear,
  showNow = true,
  disabled = false,
  className,
  contentClassName,
  align = 'start',
  open: openProp,
  onOpenChange,
  labels,
  minTime,
  maxTime,
  minuteStep = 1,
  use12Hour = false,
  id,
  ...wheelProps
}: ClockTimePickerProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }

  const parsed = React.useMemo(() => parseTimeString(value), [value])
  const step = minuteStep > 0 ? Math.floor(minuteStep) : 1

  const handleNow = () => {
    const now = new Date()
    const next = clampToRange(
      { hour: now.getHours(), minute: now.getMinutes() },
      step,
      parseTimeString(minTime),
      parseTimeString(maxTime),
    )
    onChange(formatTimeString(next))
  }

  const handleClear = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onClear?.()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal dark:border-gray-300',
            !parsed && 'text-muted-foreground',
            className,
          )}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 tabular-nums">
            {parsed
              ? formatDisplayTime(parsed, use12Hour)
              : (placeholder ?? (use12Hour ? 'hh:mm AM' : 'HH:MM'))}
          </span>
          {clearable && parsed && !disabled && onClear && (
            <span
              role="button"
              aria-label={text.clear}
              className="ml-2 rounded p-0.5 hover:bg-muted"
              onPointerDown={handleClear}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn('w-auto min-w-[15rem] p-3', contentClassName)}
      >
        <ClockTimeWheels
          {...wheelProps}
          value={value}
          onChange={onChange}
          minTime={minTime}
          maxTime={maxTime}
          minuteStep={step}
          use12Hour={use12Hour}
          disabled={disabled}
          labels={labels}
        />
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          {showNow ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleNow}>
              {text.now}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            {text.done}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
