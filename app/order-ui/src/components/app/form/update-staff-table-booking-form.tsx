import React, { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import moment from 'moment'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { SimpleDatePicker, TimeOnlyPicker } from '@/components/app/picker'
import { useUpdateTableBooking } from '@/hooks'
import {
  updateStaffTableBookingSchema,
  TUpdateStaffTableBookingSchema,
} from '@/schemas'
import { ITableBooking } from '@/types'
import {
  BOOKING_MIN_SEATS,
  BOOKING_MAX_SEATS,
  BOOKING_NOTE_MAX_LENGTH,
  BOOKING_MIN_TIME,
  BOOKING_MAX_TIME,
  TABLE_BOOKING_STATUSES,
} from '@/constants'
import { showToast } from '@/utils'
import { serverNow } from '@/lib/server-time'

interface IUpdateStaffTableBookingFormProps {
  booking: ITableBooking
  /** View mode: all fields disabled, footer shows an "Edit" button. */
  readOnly?: boolean
  /** Called when the user clicks "Edit" in view mode. */
  onEdit?: () => void
  /** Called when the user cancels editing (form is reset to the booking). */
  onCancel?: () => void
  onSubmit: (isOpen: boolean) => void
}

// Admin-side booking detail/edit form. Opens read-only (view detail); once
// unlocked via "Edit", every field is editable, including the admin-only
// ones (table, deposit, status). Submits the full body to
// PATCH /table-booking/{slug}.
export const UpdateStaffTableBookingForm: React.FC<
  IUpdateStaffTableBookingFormProps
> = ({ booking, readOnly = false, onEdit, onCancel, onSubmit }) => {
  const { t } = useTranslation('tableBooking')
  const { mutate: updateBooking, isPending } = useUpdateTableBooking()

  // Backend date is "DD/MM/YYYY HH:mm" — split into the picker formats.
  const bookingMoment = moment(booking.date, 'DD/MM/YYYY HH:mm')
  const bookingTime = bookingMoment.isValid()
    ? bookingMoment.format('HH:mm')
    : ''
  const bookingDate = bookingMoment.isValid()
    ? bookingMoment.format('YYYY-MM-DD')
    : moment().format('YYYY-MM-DD')

  // The stored date/time lets the schema tell "moved this booking" from
  // "edited something else on a past booking", which must stay allowed.
  const bookingSchema = useMemo(
    () =>
      updateStaffTableBookingSchema(t, {
        date: bookingDate,
        time: bookingTime,
      }),
    [t, bookingDate, bookingTime],
  )

  // A booking can only be moved into the future, so on today the picker's
  // lower bound is the next minute rather than the start of the daily window.
  // A past-dated booking keeps the plain window: it is the date field that is
  // wrong there, and the schema flags it only once the booking is moved.
  const now = moment(serverNow())
  const today = now.format('YYYY-MM-DD')
  const earliestToday = now.clone().add(1, 'minute').format('HH:mm')
  const minTimeFor = (date: string) =>
    date === today && earliestToday > BOOKING_MIN_TIME
      ? earliestToday
      : BOOKING_MIN_TIME

  const form = useForm<TUpdateStaffTableBookingSchema>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: booking.name,
      phone: booking.phone,
      email: booking.email ?? '',
      seats: booking.seats,
      status: booking.status,
      note: booking.note ?? '',
      date: bookingDate,
      time: bookingTime,
    },
  })

  const selectedDate = form.watch('date')

  // PATCH /table-booking/{slug} with the backend "dd/MM/yyyy HH:mm" format.
  const handleSubmit = (data: TUpdateStaffTableBookingSchema) => {
    const email = data.email?.trim()
    const note = data.note?.trim()
    updateBooking(
      {
        slug: booking.slug,
        data: {
          name: data.name.trim(),
          phone: data.phone.trim(),
          email: email ? email : undefined,
          date: `${moment(data.date, 'YYYY-MM-DD').format('DD/MM/YYYY')} ${data.time}`,
          seats: data.seats,
          status: data.status,
          note: note ? note : undefined,
        },
      },
      {
        onSuccess: () => {
          onSubmit(false)
          showToast(t('toast.updateBookingSuccess'))
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="mt-3 space-y-6"
      >
        {/* A disabled fieldset disables every native input and the trigger
            buttons of the pickers/selects inside it — one switch for the
            whole view mode. */}
        <fieldset
          disabled={readOnly}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.name')} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t('form.namePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.phone')} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder={t('form.phonePlaceholder')}
                    {...field}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value.replace(/\D/g, '').slice(0, 10),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.email')}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={t('form.emailPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="seats"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.persons')}{' '}
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={BOOKING_MIN_SEATS}
                    max={BOOKING_MAX_SEATS}
                    placeholder={t('form.personsPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.date')} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <SimpleDatePicker
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.time')} <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <TimeOnlyPicker
                    value={field.value}
                    onSelect={(time) => field.onChange(time ?? '')}
                    minTime={minTimeFor(selectedDate)}
                    maxTime={BOOKING_MAX_TIME}
                    placeholder={t('form.chooseTime')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('form.status')} <span className="text-destructive">*</span>
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('page.filterStatus')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TABLE_BOOKING_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`status.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t('form.note')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    maxLength={BOOKING_NOTE_MAX_LENGTH}
                    placeholder={t('form.notePlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <div className="flex justify-end gap-2">
          {readOnly ? (
            <Button type="button" onClick={onEdit}>
              {t('form.edit')}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  // Discard unsaved edits before returning to view mode.
                  form.reset()
                  onCancel?.()
                }}
              >
                {t('form.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t('form.submitting') : t('form.update')}
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  )
}
