/**
 * Pure helpers for the clock time picker. No React, no i18n — safe to reuse
 * in schemas, tests and any other time-handling code.
 *
 * The canonical string form everywhere is 24h "HH:mm".
 */

export interface TimeParts {
  hour: number
  minute: number
}

export type Meridiem = 'AM' | 'PM'

export const pad2 = (value: number): string =>
  String(value).padStart(2, '0')

/** Parses "HH:mm" (also tolerates "H:m"). Returns null when out of range. */
export function parseTimeString(
  value: string | null | undefined,
): TimeParts | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export function formatTimeString({ hour, minute }: TimeParts): string {
  return `${pad2(hour)}:${pad2(minute)}`
}

export const toMinutes = ({ hour, minute }: TimeParts): number =>
  hour * 60 + minute

export const fromMinutes = (total: number): TimeParts => ({
  hour: Math.floor(total / 60),
  minute: total % 60,
})

/** Inclusive on both ends; an absent bound is unbounded. */
export function isWithinRange(
  parts: TimeParts,
  min?: TimeParts | null,
  max?: TimeParts | null,
): boolean {
  const value = toMinutes(parts)
  if (min && value < toMinutes(min)) return false
  if (max && value > toMinutes(max)) return false
  return true
}

export function to12Hour(hour: number): { hour12: number; meridiem: Meridiem } {
  const meridiem: Meridiem = hour < 12 ? 'AM' : 'PM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return { hour12, meridiem }
}

export function to24Hour(hour12: number, meridiem: Meridiem): number {
  const base = hour12 % 12
  return meridiem === 'AM' ? base : base + 12
}

/** Display string for the trigger button. */
export function formatDisplayTime(
  parts: TimeParts,
  use12Hour = false,
): string {
  if (!use12Hour) return formatTimeString(parts)
  const { hour12, meridiem } = to12Hour(parts.hour)
  return `${pad2(hour12)}:${pad2(parts.minute)} ${meridiem}`
}

/** The minutes offered by a wheel with the given step (0, 5, 10, ...). */
export function buildMinuteValues(step: number): number[] {
  const safeStep = Number.isFinite(step) && step > 0 ? Math.floor(step) : 1
  const values: number[] = []
  for (let minute = 0; minute < 60; minute += safeStep) values.push(minute)
  return values
}

/**
 * True when at least one minute on the step grid of `hour` falls inside
 * the range — i.e. whether that hour is reachable at all.
 */
export function isHourSelectable(
  hour: number,
  step: number,
  min?: TimeParts | null,
  max?: TimeParts | null,
): boolean {
  return buildMinuteValues(step).some((minute) =>
    isWithinRange({ hour, minute }, min, max),
  )
}

/**
 * Nearest selectable minute of `hour` to `preferred`, or null when the
 * whole hour is out of range. Used when changing the hour wheel would
 * otherwise leave an invalid minute behind.
 */
export function nearestSelectableMinute(
  hour: number,
  preferred: number,
  step: number,
  min?: TimeParts | null,
  max?: TimeParts | null,
): number | null {
  const candidates = buildMinuteValues(step).filter((minute) =>
    isWithinRange({ hour, minute }, min, max),
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, minute) =>
    Math.abs(minute - preferred) < Math.abs(best - preferred) ? minute : best,
  )
}

/** Snaps a time into [min, max] and onto the minute step grid. */
export function clampToRange(
  parts: TimeParts,
  step: number,
  min?: TimeParts | null,
  max?: TimeParts | null,
): TimeParts {
  const values = buildMinuteValues(step)
  const snappedMinute = values.reduce((best, minute) =>
    Math.abs(minute - parts.minute) < Math.abs(best - parts.minute)
      ? minute
      : best,
  )
  let total = toMinutes({ hour: parts.hour, minute: snappedMinute })
  if (min) total = Math.max(total, toMinutes(min))
  if (max) total = Math.min(total, toMinutes(max))
  const bounded = fromMinutes(Math.min(Math.max(total, 0), 23 * 60 + 59))
  const minute = nearestSelectableMinute(
    bounded.hour,
    bounded.minute,
    step,
    min,
    max,
  )
  return { hour: bounded.hour, minute: minute ?? bounded.minute }
}
