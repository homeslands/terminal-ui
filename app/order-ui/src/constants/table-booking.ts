import moment from 'moment'

import { TableBookingStatus, TTableBookingStatus } from '@/types'
import {
  PeriodTimeEnum,
  timeChange,
} from '@/components/ui/utils/data-table.utils'

export type BookingPeriod = 'lunch' | 'evening'
export type BookingDay = 'today' | 'tomorrow' | 'specific'

// Build "HH:mm" slots between two hours at a fixed minute step (inclusive of endHour).
const buildSlots = (
  startHour: number,
  endHour: number,
  stepMinutes = 30,
): string[] => {
  const slots: string[] = []
  for (let minutes = startHour * 60; minutes <= endHour * 60; minutes += stepMinutes) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return slots
}

// Editable meal-period time slots. Adjust ranges/step here to change the booking UI.
export const BOOKING_TIME_SLOTS: Record<BookingPeriod, string[]> = {
  lunch: buildSlots(11, 14),
  evening: buildSlots(17, 21),
}

export const BOOKING_PERIODS: BookingPeriod[] = ['lunch', 'evening']
export const BOOKING_DAYS: BookingDay[] = ['today', 'tomorrow', 'specific']

// Allowed range for the "number of guests" field (inclusive).
export const BOOKING_MIN_SEATS = 1
export const BOOKING_MAX_SEATS = 20

// Maximum length of the optional customer note on a booking.
export const BOOKING_NOTE_MAX_LENGTH = 255

// Daily reservation window (inclusive, "HH:mm"): no bookings before 10:30 AM
// or after 10:30 PM. Zero-padded "HH:mm" strings compare correctly as text.
export const BOOKING_MIN_TIME = '10:30'
export const BOOKING_MAX_TIME = '22:30'

// Selectable reservation times: every 15 minutes across the daily window.
export const BOOKING_TIME_STEP_MINUTES = 15

// Granularity of the "other time" clock picker: every minute, 00–59. The
// preset slots stay on their coarser grid; picking any minute at all is the
// whole point of a custom time.
export const BOOKING_CUSTOM_TIME_STEP_MINUTES = 1

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export const BOOKING_TIME_OPTIONS: string[] = (() => {
  const slots: string[] = []
  for (
    let minutes = timeToMinutes(BOOKING_MIN_TIME);
    minutes <= timeToMinutes(BOOKING_MAX_TIME);
    minutes += BOOKING_TIME_STEP_MINUTES
  ) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return slots
})()

// Display form for booking times: "19h", "19h15", "19h30".
export const formatBookingTime = (time: string): string => {
  const [h, m] = time.split(':')
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}

// How many days ahead a guest may reserve a table (inclusive of today).
export const BOOKING_MAX_ADVANCE_DAYS = 30

// All booking statuses in workflow order (used for staff summary cards + status select).
export const TABLE_BOOKING_STATUSES: TTableBookingStatus[] = [
  TableBookingStatus.PENDING,
  TableBookingStatus.CONFIRMED,
  TableBookingStatus.CHECKED_IN,
  TableBookingStatus.COMPLETED,
  TableBookingStatus.CANCELLED,
]

// Tailwind classes for the colored status badge / summary accents.
export const TABLE_BOOKING_STATUS_STYLE: Record<TTableBookingStatus, string> = {
  [TableBookingStatus.PENDING]: 'bg-yellow-500 text-white',
  [TableBookingStatus.CONFIRMED]: 'bg-blue-500 text-white',
  [TableBookingStatus.CHECKED_IN]: 'bg-indigo-600 text-white',
  [TableBookingStatus.COMPLETED]: 'bg-green-600 text-white',
  [TableBookingStatus.CANCELLED]: 'bg-red-500 text-white',
}

// ----- Staff booking-list filters -----

// Sentinel for the "all statuses" option (Radix Select cannot use an empty value).
export const ALL_STATUS = 'all'

// Preset selected on first load / refresh of the staff booking list.
export const DEFAULT_PRESET = 'inWeek' as const

// Quick range presets for the date filter combobox. `custom` is only ever shown
// when the current range doesn't match any preset (e.g. a one-off range picked
// from the date pickers).
export const RANGE_PRESETS = [
  'all',
  'today',
  'yesterday',
  'tomorrow',
  'inWeek',
  'inMonth',
] as const
export type RangePreset = (typeof RANGE_PRESETS)[number] | 'custom'

// Map a preset to a { from, to } pair of "YYYY-MM-DD" values ('' = no bound).
export const presetToRange = (
  preset: RangePreset,
): { from: string; to: string } => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  switch (preset) {
    case 'today':
    case 'yesterday':
    case 'all': {
      // These map 1:1 onto the shared period-of-time helper.
      const map = {
        today: PeriodTimeEnum.TODAY,
        yesterday: PeriodTimeEnum.YESTERDAY,
        all: PeriodTimeEnum.ALL,
      } as const
      const { startDate, endDate } = timeChange(map[preset], today)
      return { from: startDate, to: endDate }
    }
    case 'tomorrow': {
      const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD')
      return { from: tomorrow, to: tomorrow }
    }
    case 'inMonth': {
      const { startDate, endDate } = timeChange(PeriodTimeEnum.MONTH, today)
      return { from: startDate, to: endDate }
    }
    case 'inWeek':
    default: {
      const { startDate, endDate } = timeChange(PeriodTimeEnum.WEEK, today)
      return { from: startDate, to: endDate }
    }
  }
}
