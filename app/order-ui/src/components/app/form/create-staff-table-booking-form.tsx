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
} from '@/components/ui'
import { SimpleDatePicker, TimeOnlyPicker } from '@/components/app/picker'
import { useCreateTableBooking } from '@/hooks'
import {
  createStaffTableBookingSchema,
  TCreateStaffTableBookingSchema,
} from '@/schemas'
import {
  BOOKING_MIN_SEATS,
  BOOKING_MAX_SEATS,
  BOOKING_NOTE_MAX_LENGTH,
  BOOKING_MIN_TIME,
  BOOKING_MAX_TIME,
} from '@/constants'
import { showToast } from '@/utils'
import { serverNow } from '@/lib/server-time'

interface ICreateStaffTableBookingFormProps {
  onSubmit: (isOpen: boolean) => void
}

// Staff-side booking form: staff type the customer's contact info and pick an
// exact date + time (no meal-period/slot flow like the client landing form).
export const CreateStaffTableBookingForm: React.FC<
  ICreateStaffTableBookingFormProps
> = ({ onSubmit }) => {
  const { t } = useTranslation('tableBooking')
  const { mutate: createBooking, isPending } = useCreateTableBooking()

  const bookingSchema = useMemo(() => createStaffTableBookingSchema(t), [t])

  // A booking has to be ahead of now, so on today the picker's lower bound
  // is the next minute rather than the start of the daily window. All of
  // these are "HH:mm"/"YYYY-MM-DD" strings, which compare correctly as text.
  const now = moment(serverNow())
  const today = now.format('YYYY-MM-DD')
  const earliestToday = now.clone().add(1, 'minute').format('HH:mm')
  const minTimeFor = (date: string) =>
    date === today && earliestToday > BOOKING_MIN_TIME
      ? earliestToday
      : BOOKING_MIN_TIME
  const isTimeInvalidFor = (time: string, date: string) =>
    time < minTimeFor(date) || time > BOOKING_MAX_TIME

  const form = useForm<TCreateStaffTableBookingSchema>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      seats: 2,
      note: '',
      date: moment().format('YYYY-MM-DD'),
      time: '',
    },
  })

  const selectedDate = form.watch('date')

  // POST /table-booking with the backend "dd/MM/yyyy HH:mm" date format.
  const handleSubmit = (data: TCreateStaffTableBookingSchema) => {
    const email = data.email?.trim()
    const note = data.note?.trim()
    createBooking(
      {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: email ? email : undefined,
        date: `${moment(data.date, 'YYYY-MM-DD').format('DD/MM/YYYY')} ${data.time}`,
        seats: data.seats,
        note: note ? note : undefined,
      },
      {
        onSuccess: () => {
          onSubmit(false)
          form.reset()
          showToast(t('toast.createSuccess'))
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    onChange={(date) => {
                      field.onChange(date)
                      // Moving to today can strand a time that has already
                      // passed — drop it rather than submit an invalid slot.
                      const time = form.getValues('time')
                      if (time && isTimeInvalidFor(time, date)) {
                        form.setValue('time', '', { shouldValidate: false })
                      }
                    }}
                    minDate={today}
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
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t('form.submitting') : t('page.create')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
