import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
  isLongShift,
  computeCashDifference,
  isCrossShiftOrder,
} from '../work-shift-helpers'

describe('computeShiftDurationMinutes', () => {
  it('computes whole minutes elapsed since start', () => {
    const start = '2026-06-29T08:00:00.000Z'
    const now = new Date('2026-06-29T10:30:00.000Z').getTime()
    expect(computeShiftDurationMinutes(start, now)).toBe(150)
  })

  it('floors partial minutes', () => {
    const start = '2026-06-29T08:00:00.000Z'
    const now = new Date('2026-06-29T08:00:59.000Z').getTime()
    expect(computeShiftDurationMinutes(start, now)).toBe(0)
  })

  it('clamps to 0 when start is in the future (clock skew)', () => {
    const start = '2026-06-29T12:00:00.000Z'
    const now = new Date('2026-06-29T08:00:00.000Z').getTime()
    expect(computeShiftDurationMinutes(start, now)).toBe(0)
  })

  it('returns 0 for an unparseable start time', () => {
    expect(computeShiftDurationMinutes('not-a-date', Date.now())).toBe(0)
  })

  it('falls back to the current time when nowMs is omitted', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T10:30:00.000Z'))
    expect(computeShiftDurationMinutes('2026-06-29T08:00:00.000Z')).toBe(150)
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})

describe('formatShiftDuration', () => {
  it('formats minutes only when under 1 hour', () => {
    expect(formatShiftDuration(45)).toBe('45m')
  })

  it('formats hours only when an exact multiple of 60', () => {
    expect(formatShiftDuration(120)).toBe('2h')
  })

  it('formats hours + minutes for mixed values', () => {
    expect(formatShiftDuration(150)).toBe('2h 30m')
  })

  it('returns "0m" for zero', () => {
    expect(formatShiftDuration(0)).toBe('0m')
  })

  it('returns em dash for null/undefined', () => {
    expect(formatShiftDuration(null)).toBe('—')
    expect(formatShiftDuration(undefined)).toBe('—')
  })
})

describe('isLongShift', () => {
  it('flags shifts at or beyond 10 hours', () => {
    expect(isLongShift(600)).toBe(true)
    expect(isLongShift(601)).toBe(true)
  })

  it('does not flag shorter shifts', () => {
    expect(isLongShift(599)).toBe(false)
  })

  it('does not flag null/undefined', () => {
    expect(isLongShift(null)).toBe(false)
    expect(isLongShift(undefined)).toBe(false)
  })
})

describe('computeCashDifference', () => {
  it('returns a positive value when the drawer holds extra cash', () => {
    expect(
      computeCashDifference({
        openingCash: 500_000,
        closingCash: 1_200_000,
        cashRevenue: 650_000,
      }),
    ).toBe(50_000)
  })

  it('returns a negative value when the drawer is short', () => {
    expect(
      computeCashDifference({
        openingCash: 500_000,
        closingCash: 1_000_000,
        cashRevenue: 650_000,
      }),
    ).toBe(-150_000)
  })

  it('returns 0 on an exact match', () => {
    expect(
      computeCashDifference({
        openingCash: 500_000,
        closingCash: 1_150_000,
        cashRevenue: 650_000,
      }),
    ).toBe(0)
  })

  it('returns null while the shift is still ACTIVE (no closingCash)', () => {
    expect(
      computeCashDifference({
        openingCash: 500_000,
        closingCash: null,
        cashRevenue: 650_000,
      }),
    ).toBeNull()
  })
})

describe('isCrossShiftOrder', () => {
  it('flags an order whose shift differs from the current shift', () => {
    expect(isCrossShiftOrder('ws-a', 'ws-b')).toBe(true)
  })

  it('does not flag an order belonging to the current shift', () => {
    expect(isCrossShiftOrder('ws-b', 'ws-b')).toBe(false)
  })

  it('does not flag an order with no shift (pre-shift, just linked)', () => {
    expect(isCrossShiftOrder(null, 'ws-b')).toBe(false)
    expect(isCrossShiftOrder(undefined, 'ws-b')).toBe(false)
  })
})
