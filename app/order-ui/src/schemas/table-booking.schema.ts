import { z } from 'zod'
import { TFunction } from 'i18next'

import {
  BOOKING_MIN_SEATS,
  BOOKING_MAX_SEATS,
  BOOKING_MIN_TIME,
  BOOKING_MAX_TIME,
  BOOKING_NOTE_MAX_LENGTH,
} from '@/constants'
import { TableBookingStatus } from '@/types'
import { serverNow } from '@/lib/server-time'

// Business rule: reservations are only accepted between 10:30 and 22:30.
const isTimeWithinBookingWindow = (time: string): boolean =>
  time >= BOOKING_MIN_TIME && time <= BOOKING_MAX_TIME

const pad2 = (value: number): string => String(value).padStart(2, '0')

/** Server-side "today" as the "YYYY-MM-DD" the date pickers emit. */
const serverToday = (): string => {
  const now = new Date(serverNow())
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** Epoch ms for a "YYYY-MM-DD" + "HH:mm" pair, or null if either is malformed. */
const toTimestamp = (date: string, time: string): number | null => {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const clock = /^(\d{2}):(\d{2})$/.exec(time)
  if (!day || !clock) return null
  return new Date(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    Number(clock[1]),
    Number(clock[2]),
    0,
    0,
  ).getTime()
}

/**
 * A reservation must be in the future. Flags the field the staff member can
 * act on: the date when the whole day has passed, otherwise the time.
 */
const refineBookingIsInFuture = (
  t: TFunction,
  data: { date: string; time: string },
  ctx: z.RefinementCtx,
): void => {
  const when = toTimestamp(data.date, data.time)
  if (when === null || when > serverNow()) return
  const isPastDay = data.date < serverToday()
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [isPastDay ? 'date' : 'time'],
    message: isPastDay ? t('form.datePassed') : t('form.timePassed'),
  })
}

// Client booking form. `period`/`day`/`specificDate`/`time` are UI-only fields;
// they are resolved into the backend `date` ("dd/MM/yyyy HH:mm") on submit.
// Built as a factory so validation messages are translated via i18n.
export const createTableBookingSchema = (t: TFunction) =>
  z
    .object({
      name: z.string().min(1, t('form.nameRequired')),
      // Vietnamese phone: 10 digits starting with 0 (matches backend /^0\d{9}$/).
      phone: z
        .string()
        .min(1, t('form.phoneRequired'))
        .regex(/^0[0-9]{9}$/, t('form.phoneInvalid')),
      email: z.union([z.string().email(), z.literal('')]).optional(),
      seats: z.coerce
        .number()
        .int()
        .min(BOOKING_MIN_SEATS, t('form.seatsMin', { min: BOOKING_MIN_SEATS }))
        .max(BOOKING_MAX_SEATS, t('form.seatsMax', { max: BOOKING_MAX_SEATS }))
        .default(BOOKING_MIN_SEATS),
      note: z
        .string()
        .max(
          BOOKING_NOTE_MAX_LENGTH,
          t('form.noteMaxLength', { max: BOOKING_NOTE_MAX_LENGTH }),
        )
        .optional(),
      period: z.enum(['lunch', 'evening']),
      day: z.enum(['today', 'tomorrow', 'specific']),
      // "dd/MM/yyyy" — required only when day === 'specific'.
      specificDate: z.string().optional(),
      // "HH:mm" — chosen from the time-slot sheet.
      time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .refine(isTimeWithinBookingWindow, {
          message: t('form.timeOutOfRange', {
            min: BOOKING_MIN_TIME,
            max: BOOKING_MAX_TIME,
          }),
        }),
    })
    .superRefine((data, ctx) => {
      if (data.day === 'specific' && !data.specificDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['specificDate'],
          message: 'required',
        })
      }
      // A custom time picked for today must still be in the future.
      if (data.day === 'today' && data.time) {
        const [h, m] = data.time.split(':').map(Number)
        const slot = new Date(serverNow())
        slot.setHours(h, m, 0, 0)
        if (slot.getTime() <= serverNow()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['time'],
            message: t('form.timePassed'),
          })
        }
      }
    })

export type TCreateTableBookingSchema = z.infer<
  ReturnType<typeof createTableBookingSchema>
>

// Staff booking form (system table-booking page). Staff pick an exact
// date ("YYYY-MM-DD" from SimpleDatePicker) and time ("HH:mm" from
// TimeOnlyPicker); both are combined into the backend "dd/MM/yyyy HH:mm"
// on submit.
export const createStaffTableBookingSchema = (t: TFunction) =>
  z
    .object({
      name: z.string().min(1, t('form.nameRequired')),
      // Vietnamese phone: 10 digits starting with 0 (matches backend /^0\d{9}$/).
      phone: z
        .string()
        .min(1, t('form.phoneRequired'))
        .regex(/^0[0-9]{9}$/, t('form.phoneInvalid')),
      email: z.union([z.string().email(), z.literal('')]).optional(),
      seats: z.coerce
        .number()
        .int()
        .min(BOOKING_MIN_SEATS, t('form.seatsMin', { min: BOOKING_MIN_SEATS }))
        .max(BOOKING_MAX_SEATS, t('form.seatsMax', { max: BOOKING_MAX_SEATS })),
      note: z
        .string()
        .max(
          BOOKING_NOTE_MAX_LENGTH,
          t('form.noteMaxLength', { max: BOOKING_NOTE_MAX_LENGTH }),
        )
        .optional(),
      date: z.string().min(1, t('form.dateRequired')),
      time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, t('form.timeRequired'))
        .refine(isTimeWithinBookingWindow, {
          message: t('form.timeOutOfRange', {
            min: BOOKING_MIN_TIME,
            max: BOOKING_MAX_TIME,
          }),
        }),
    })
    .superRefine((data, ctx) => refineBookingIsInFuture(t, data, ctx))

export type TCreateStaffTableBookingSchema = z.infer<
  ReturnType<typeof createStaffTableBookingSchema>
>

// Staff booking update form (edit dialog on the system table-booking page).
// Same date/time split as the staff create form, plus the admin-only
// status field.
//
// `original` is the booking's stored date/time. Moving a booking must land in
// the future, but editing anything else on a past booking (a name typo, the
// status) must stay possible — so the future rule only applies once the
// date/time actually changes.
export const updateStaffTableBookingSchema = (
  t: TFunction,
  original?: { date: string; time: string },
) =>
  z
    .object({
      name: z.string().min(1, t('form.nameRequired')),
      // Vietnamese phone: 10 digits starting with 0 (matches backend /^0\d{9}$/).
      phone: z
        .string()
        .min(1, t('form.phoneRequired'))
        .regex(/^0[0-9]{9}$/, t('form.phoneInvalid')),
      email: z.union([z.string().email(), z.literal('')]).optional(),
      seats: z.coerce
        .number()
        .int()
        .min(BOOKING_MIN_SEATS, t('form.seatsMin', { min: BOOKING_MIN_SEATS }))
        .max(BOOKING_MAX_SEATS, t('form.seatsMax', { max: BOOKING_MAX_SEATS })),
      status: z.nativeEnum(TableBookingStatus),
      note: z
        .string()
        .max(
          BOOKING_NOTE_MAX_LENGTH,
          t('form.noteMaxLength', { max: BOOKING_NOTE_MAX_LENGTH }),
        )
        .optional(),
      date: z.string().min(1, t('form.dateRequired')),
      time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, t('form.timeRequired'))
        .refine(isTimeWithinBookingWindow, {
          message: t('form.timeOutOfRange', {
            min: BOOKING_MIN_TIME,
            max: BOOKING_MAX_TIME,
          }),
        }),
    })
    .superRefine((data, ctx) => {
      const unchanged =
        !!original && data.date === original.date && data.time === original.time
      if (unchanged) return
      refineBookingIsInFuture(t, data, ctx)
    })

export type TUpdateStaffTableBookingSchema = z.infer<
  ReturnType<typeof updateStaffTableBookingSchema>
>
