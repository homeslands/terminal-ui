import { describe, it, expect } from 'vitest'

import {
  buildMinuteValues,
  clampToRange,
  formatDisplayTime,
  formatTimeString,
  isHourSelectable,
  isWithinRange,
  nearestSelectableMinute,
  parseTimeString,
  to12Hour,
  to24Hour,
} from '@/lib/clock-time'

describe('parseTimeString', () => {
  it('parses HH:mm and H:m', () => {
    expect(parseTimeString('08:30')).toEqual({ hour: 8, minute: 30 })
    expect(parseTimeString('8:5')).toEqual({ hour: 8, minute: 5 })
  })

  it('rejects empty, malformed and out-of-range values', () => {
    expect(parseTimeString(null)).toBeNull()
    expect(parseTimeString('')).toBeNull()
    expect(parseTimeString('08-30')).toBeNull()
    expect(parseTimeString('24:00')).toBeNull()
    expect(parseTimeString('12:60')).toBeNull()
  })
})

describe('formatting', () => {
  it('pads both parts', () => {
    expect(formatTimeString({ hour: 9, minute: 5 })).toBe('09:05')
  })

  it('formats 12-hour display', () => {
    expect(formatDisplayTime({ hour: 0, minute: 0 }, true)).toBe('12:00 AM')
    expect(formatDisplayTime({ hour: 12, minute: 30 }, true)).toBe('12:30 PM')
    expect(formatDisplayTime({ hour: 13, minute: 5 }, true)).toBe('01:05 PM')
    expect(formatDisplayTime({ hour: 13, minute: 5 })).toBe('13:05')
  })

  it('round-trips 12h conversion', () => {
    for (let hour = 0; hour < 24; hour++) {
      const { hour12, meridiem } = to12Hour(hour)
      expect(to24Hour(hour12, meridiem)).toBe(hour)
    }
  })
})

describe('range helpers', () => {
  const min = { hour: 8, minute: 30 }
  const max = { hour: 21, minute: 0 }

  it('treats bounds as inclusive', () => {
    expect(isWithinRange(min, min, max)).toBe(true)
    expect(isWithinRange(max, min, max)).toBe(true)
    expect(isWithinRange({ hour: 8, minute: 29 }, min, max)).toBe(false)
    expect(isWithinRange({ hour: 21, minute: 1 }, min, max)).toBe(false)
  })

  it('is unbounded when a bound is missing', () => {
    expect(isWithinRange({ hour: 3, minute: 0 })).toBe(true)
    expect(isWithinRange({ hour: 3, minute: 0 }, null, max)).toBe(true)
  })

  it('marks partially reachable hours as selectable', () => {
    expect(isHourSelectable(7, 1, min, max)).toBe(false)
    expect(isHourSelectable(8, 1, min, max)).toBe(true)
    expect(isHourSelectable(21, 1, min, max)).toBe(true)
    expect(isHourSelectable(22, 1, min, max)).toBe(false)
  })

  it('accounts for the minute step when testing an hour', () => {
    // With step 30 the only minutes on the grid are :00 and :30.
    expect(isHourSelectable(21, 30, min, { hour: 21, minute: 15 })).toBe(true)
    expect(isHourSelectable(21, 30, { hour: 21, minute: 15 }, max)).toBe(false)
  })
})

describe('buildMinuteValues', () => {
  it('walks the grid by step', () => {
    expect(buildMinuteValues(15)).toEqual([0, 15, 30, 45])
    expect(buildMinuteValues(1)).toHaveLength(60)
  })

  it('falls back to 1 for invalid steps', () => {
    expect(buildMinuteValues(0)).toHaveLength(60)
    expect(buildMinuteValues(-5)).toHaveLength(60)
  })
})

describe('nearestSelectableMinute', () => {
  const min = { hour: 8, minute: 30 }
  const max = { hour: 21, minute: 0 }

  it('keeps a valid minute', () => {
    expect(nearestSelectableMinute(9, 45, 1, min, max)).toBe(45)
  })

  it('pulls an invalid minute to the closest valid one', () => {
    expect(nearestSelectableMinute(8, 0, 1, min, max)).toBe(30)
    expect(nearestSelectableMinute(21, 59, 1, min, max)).toBe(0)
  })

  it('returns null when the hour is fully out of range', () => {
    expect(nearestSelectableMinute(7, 0, 1, min, max)).toBeNull()
  })
})

describe('clampToRange', () => {
  const min = { hour: 8, minute: 30 }
  const max = { hour: 21, minute: 0 }

  it('snaps onto the step grid', () => {
    expect(clampToRange({ hour: 10, minute: 7 }, 15)).toEqual({
      hour: 10,
      minute: 0,
    })
    expect(clampToRange({ hour: 10, minute: 8 }, 15)).toEqual({
      hour: 10,
      minute: 15,
    })
  })

  it('pulls values inside the bounds', () => {
    expect(clampToRange({ hour: 6, minute: 0 }, 1, min, max)).toEqual(min)
    expect(clampToRange({ hour: 23, minute: 45 }, 1, min, max)).toEqual(max)
  })

  it('leaves in-range values alone', () => {
    expect(clampToRange({ hour: 12, minute: 30 }, 5, min, max)).toEqual({
      hour: 12,
      minute: 30,
    })
  })
})
