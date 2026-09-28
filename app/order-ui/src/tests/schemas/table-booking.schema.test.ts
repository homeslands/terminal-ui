import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  createStaffTableBookingSchema,
  updateStaffTableBookingSchema,
} from '@/schemas'
import { TableBookingStatus } from '@/types'
import { _resetServerTimeOffsetForTests } from '@/lib/server-time'

// Messages come back as the i18n key so assertions stay readable.
const t = ((key: string) => key) as never

const base = {
  name: 'Minh',
  phone: '0901234567',
  email: '',
  seats: 2,
  note: '',
}

const staffBooking = (date: string, time: string) => ({ ...base, date, time })
const adminBooking = (date: string, time: string) => ({
  ...staffBooking(date, time),
  status: TableBookingStatus.PENDING,
})

/** The first issue's message, or undefined when the input was accepted. */
const firstError = (result: {
  success: boolean
  error?: { issues: { message: string; path: (string | number)[] }[] }
}) => (result.success ? undefined : result.error?.issues[0])

beforeEach(() => {
  _resetServerTimeOffsetForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-21T14:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createStaffTableBookingSchema', () => {
  const schema = () => createStaffTableBookingSchema(t)

  it('accepts a slot later today', () => {
    expect(
      schema().safeParse(staffBooking('2026-09-21', '18:30')).success,
    ).toBe(true)
  })

  it('accepts any slot on a later day', () => {
    expect(
      schema().safeParse(staffBooking('2026-09-22', '10:30')).success,
    ).toBe(true)
  })

  it('rejects a slot that already passed today', () => {
    const issue = firstError(
      schema().safeParse(staffBooking('2026-09-21', '11:00')),
    )
    expect(issue?.message).toBe('form.timePassed')
    expect(issue?.path).toEqual(['time'])
  })

  it('rejects the current minute — a booking must be ahead', () => {
    const issue = firstError(
      schema().safeParse(staffBooking('2026-09-21', '14:00')),
    )
    expect(issue?.message).toBe('form.timePassed')
  })

  it('flags the date, not the time, when the whole day has passed', () => {
    const issue = firstError(
      schema().safeParse(staffBooking('2026-09-20', '18:00')),
    )
    expect(issue?.message).toBe('form.datePassed')
    expect(issue?.path).toEqual(['date'])
  })

  it('still rejects times outside the daily window', () => {
    const issue = firstError(
      schema().safeParse(staffBooking('2026-09-22', '23:00')),
    )
    expect(issue?.message).toBe('form.timeOutOfRange')
  })
})

describe('updateStaffTableBookingSchema', () => {
  const original = { date: '2026-09-15', time: '19:00' }
  const schema = () => updateStaffTableBookingSchema(t, original)

  it('saves a past booking untouched, so other fields stay editable', () => {
    expect(
      schema().safeParse(adminBooking(original.date, original.time)).success,
    ).toBe(true)
  })

  it('rejects moving a booking into the past', () => {
    const issue = firstError(
      schema().safeParse(adminBooking('2026-09-15', '20:00')),
    )
    expect(issue?.message).toBe('form.datePassed')
  })

  it('rejects moving a booking to a slot that passed today', () => {
    const issue = firstError(
      schema().safeParse(adminBooking('2026-09-21', '11:00')),
    )
    expect(issue?.message).toBe('form.timePassed')
  })

  it('accepts moving a booking forward', () => {
    expect(
      schema().safeParse(adminBooking('2026-09-23', '19:00')).success,
    ).toBe(true)
  })

  it('applies the future rule when no original is supplied', () => {
    const issue = firstError(
      updateStaffTableBookingSchema(t).safeParse(
        adminBooking('2026-09-20', '19:00'),
      ),
    )
    expect(issue?.message).toBe('form.datePassed')
  })
})
