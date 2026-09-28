import React, { useEffect, useMemo, useState } from 'react'
import { useForm, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { format, addDays, parse } from 'date-fns'
import { vi, enUS } from 'date-fns/locale'
import { CalendarClock, CheckCircle2, Clock, Minus, Plus, Users } from 'lucide-react'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
  Calendar,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { ClockTimePicker } from '@/components/app/picker'
import { cn } from '@/lib/utils'
import { serverNow } from '@/lib/server-time'
import { showToast } from '@/utils'
import { useCreateTableBooking } from '@/hooks'
import { createTableBookingSchema, TCreateTableBookingSchema } from '@/schemas'
import {
  BOOKING_TIME_SLOTS,
  BOOKING_PERIODS,
  BOOKING_DAYS,
  BOOKING_MIN_SEATS,
  BOOKING_MAX_SEATS,
  BOOKING_MAX_ADVANCE_DAYS,
  BOOKING_NOTE_MAX_LENGTH,
  BOOKING_MIN_TIME,
  BOOKING_MAX_TIME,
  BOOKING_CUSTOM_TIME_STEP_MINUTES,
  BookingPeriod,
  BookingDay,
} from '@/constants'

// Resolve the chosen day option into a "dd/MM/yyyy" string.
const resolveDate = (day: BookingDay, specificDate?: string): string => {
  const now = new Date(serverNow())
  if (day === 'today') return format(now, 'dd/MM/yyyy')
  if (day === 'tomorrow') return format(addDays(now, 1), 'dd/MM/yyyy')
  return specificDate ?? ''
}

// Clamp a guest count into the allowed [min, max] range.
const clampSeats = (value: number): number =>
  Math.min(BOOKING_MAX_SEATS, Math.max(BOOKING_MIN_SEATS, value))

// Shared luxury styling helpers.
const luxuryLabel =
  'text-[11px] font-medium uppercase tracking-[.25em] text-landing-brass-light'
const luxuryInput =
  'h-12 rounded-md border-landing-brass/30 bg-landing-iron-2/60 text-landing-quartz placeholder:italic placeholder:text-landing-quartz/40 focus-visible:ring-landing-brass focus-visible:ring-offset-0'

const stepperButton =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-landing-brass/35 bg-transparent text-landing-quartz/80 transition-colors hover:border-landing-brass hover:bg-landing-brass/10 hover:text-landing-brass-light disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-landing-brass/35 disabled:hover:bg-transparent disabled:hover:text-landing-quartz/80'

const chipClass = (active: boolean) =>
  cn(
    'h-12 w-full rounded-md border text-sm font-medium uppercase tracking-wider transition-colors',
    active
      ? 'border-landing-brass bg-landing-brass text-landing-iron hover:bg-landing-brass-light'
      : 'border-landing-brass/35 bg-transparent text-landing-quartz/80 hover:border-landing-brass hover:bg-landing-brass/10 hover:text-landing-brass-light',
  )

const slotClass = (active: boolean) =>
  cn(
    'h-11 rounded-md border text-sm font-medium tabular-nums transition-colors',
    active
      ? 'border-landing-brass bg-landing-brass text-landing-iron'
      : 'border-landing-brass/35 bg-transparent text-landing-quartz/80 hover:border-landing-brass hover:bg-landing-brass/10 hover:text-landing-brass-light',
  )

export const CreateTableBookingForm: React.FC = () => {
  const { t, i18n } = useTranslation('tableBooking')
  const dateLocale = i18n.language?.startsWith('vi') ? vi : enUS
  const { mutate: createBooking, isPending } = useCreateTableBooking()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  // True when the guest picked a free-form time instead of a preset slot.
  const [isCustomTime, setIsCustomTime] = useState(false)

  const bookingSchema = useMemo(() => createTableBookingSchema(t), [t])

  const form = useForm<TCreateTableBookingSchema>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      seats: 2,
      note: '',
      period: 'lunch',
      day: 'today',
      specificDate: '',
      time: '',
    },
  })

  const period = form.watch('period')
  const day = form.watch('day')
  const time = form.watch('time')
  const specificDate = form.watch('specificDate')

  // Human-readable date shown under the Today/Tomorrow buttons.
  const dayPreview = useMemo(() => {
    if (day === 'specific') return null
    const now = new Date(serverNow())
    const target = day === 'tomorrow' ? addDays(now, 1) : now
    return format(target, 'EEEE, dd/MM/yyyy', { locale: dateLocale })
  }, [day, dateLocale])

  // Slots for the chosen period; hide already-passed slots when booking for today.
  const availableSlots = useMemo(() => {
    const slots = BOOKING_TIME_SLOTS[period]
    if (day !== 'today') return slots
    const now = new Date(serverNow())
    return slots.filter((slot) => {
      const slotDate = parse(slot, 'HH:mm', now)
      return slotDate.getTime() > now.getTime()
    })
  }, [period, day])

  // Keep `time` pointing at a valid, still-available slot. Whenever the
  // available slots change (meal/day switch, time passing), if the current
  // selection is empty or no longer offered, snap to the first open slot.
  // This guarantees the required `time` field is filled, so clicking
  // "Confirm booking" can never be silently blocked by an empty time.
  // Skipped while a custom time is chosen — the schema validates that one.
  useEffect(() => {
    if (isCustomTime) return
    if (availableSlots.length === 0) {
      if (time) form.setValue('time', '', { shouldValidate: false })
      return
    }
    if (!time || !availableSlots.includes(time)) {
      form.setValue('time', availableSlots[0], { shouldValidate: true })
    }
  }, [availableSlots, time, form, isCustomTime])

  // Lower bound of the custom clock picker. For today it also has to clear
  // the current time, so already-passed rows are unselectable instead of
  // only failing on submit (schema: "form.timePassed").
  const customMinTime = useMemo(() => {
    if (day !== 'today') return BOOKING_MIN_TIME
    const now = new Date(serverNow())
    const current = format(now, 'HH:mm')
    return current > BOOKING_MIN_TIME ? current : BOOKING_MIN_TIME
  }, [day])

  const setPeriod = (value: BookingPeriod) => {
    form.setValue('period', value)
    setIsCustomTime(false)
  }

  const selectSlot = (slot: string) => {
    setIsCustomTime(false)
    form.setValue('time', slot, { shouldValidate: true })
  }

  const handleCustomTimeSelect = (value: string | null) => {
    form.setValue('time', value ?? '', { shouldValidate: true })
  }

  const setDay = (value: BookingDay) => {
    form.setValue('day', value)
    if (value !== 'specific') form.setValue('specificDate', '')
  }

  const handleContinue = async () => {
    const ok = await form.trigger(['name', 'phone'])
    if (ok) setIsModalOpen(true)
  }

  // POST /table-booking — fired when the user clicks "Confirm booking".
  const handleSubmit = (data: TCreateTableBookingSchema) => {
    const resolvedDate = resolveDate(data.day, data.specificDate)
    const email = data.email?.trim()
    const note = data.note?.trim()
    createBooking(
      {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: email ? email : undefined,
        date: `${resolvedDate} ${data.time}`, // "dd/MM/yyyy HH:mm"
        seats: data.seats,
        note: note ? note : undefined,
      },
      {
        onSuccess: () => {
          // Confirmation toast with a booking summary line.
          // Time uses "18h00" form: showToast re-parses ':' / '.' as i18n
          // separators, so we avoid them in the description.
          const datetime = `${resolvedDate} ${data.time}`.replace(':', 'h')
          const guestLabel = `${data.seats} ${t('form.guests')}`
          showToast(t('toast.createSuccess'), `${datetime} · ${guestLabel}`)
          setIsModalOpen(false)
          setIsSubmitted(true)
        },
      },
    )
  }

  // Surface a toast when the confirm click is blocked by missing fields,
  // so the action never appears to do nothing. The console line makes it easy
  // to see exactly which field (usually `time`) blocked the POST.
  const onInvalid = (errors: FieldErrors<TCreateTableBookingSchema>) => {
    // eslint-disable-next-line no-console
    console.warn('[BookingForm] submit blocked by validation:', errors)
    const firstError = Object.values(errors)[0]?.message
    showToast(t('form.fillRequired'), firstError ? String(firstError) : undefined)
  }

  // Success state — replaces the lead card.
  if (isSubmitted) {
    return (
      <div className="modal-frame mx-auto w-full max-w-xl p-8">
        <div className="flex flex-col gap-4 items-center text-center">
          <CheckCircle2 className="w-14 h-14 text-landing-brass-light" />
          <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-grad-primary">
            {t('form.successTitle')}
          </h3>
          <p className="text-landing-quartz/75">{t('form.successMessage')}</p>
          <button
            type="button"
            onClick={() => {
              form.reset()
              setIsCustomTime(false)
              setIsSubmitted(false)
            }}
            className="mt-2 h-12 rounded-md bg-landing-brass px-8 text-sm font-semibold uppercase tracking-[.2em] text-landing-iron transition-colors hover:bg-landing-brass-light"
          >
            {t('form.bookAnother')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      {/* Step 1 — lead card: just name + phone */}
      <div className="modal-frame mx-auto w-full max-w-xl p-6 sm:p-8">
        <div className="flex flex-col gap-1 mb-7 text-center">
          <div className="flex gap-2 justify-center items-center text-landing-brass-light">
            <CalendarClock className="w-5 h-5" />
            <h3 className="font-display text-2xl font-black uppercase tracking-wide text-grad-primary">
              {t('form.title')}
            </h3>
          </div>
          <p className="text-sm italic text-landing-quartz/65">
            {t('form.leadHint')}
          </p>
          <div className="brand-divider mx-auto mt-4 w-24" />
        </div>

        <div className="space-y-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={luxuryLabel}>{t('form.name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('form.namePlaceholder')}
                    className={luxuryInput}
                    {...field}
                  />
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
                <FormLabel className={luxuryLabel}>
                  {t('form.phone')} <span className="text-landing-brass">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder={t('form.phonePlaceholder')}
                    className={luxuryInput}
                    {...field}
                    onChange={(e) =>
                      field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <button
            type="button"
            onClick={handleContinue}
            className="h-12 w-full rounded-md bg-landing-brass text-sm font-semibold uppercase tracking-[.2em] text-landing-iron transition-colors hover:bg-landing-brass-light"
          >
            {t('form.continue')}
          </button>
        </div>
      </div>

      {/* Step 2 — full reservation details in a modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl border-landing-brass/40 bg-landing-iron text-landing-quartz">
          <DialogHeader>
            <DialogTitle className="text-grad-primary font-display text-xl font-black uppercase tracking-wide">
              {t('form.title')}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(handleSubmit, onInvalid)}
            className="space-y-5"
          >
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={luxuryLabel}>
                        {t('form.name')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('form.namePlaceholder')}
                          className={luxuryInput}
                          {...field}
                        />
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
                      <FormLabel className={luxuryLabel}>
                        {t('form.phone')}{' '}
                        <span className="text-landing-brass">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={10}
                          placeholder={t('form.phonePlaceholder')}
                          className={luxuryInput}
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
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={luxuryLabel}>{t('form.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t('form.emailPlaceholder')}
                        className={luxuryInput}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Number of guests — typed directly or stepped within [min, max] */}
              <FormField
                control={form.control}
                name="seats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className={cn(luxuryLabel, 'flex gap-1 items-center')}
                    >
                      <Users className="w-4 h-4" />
                      {t('form.persons')}
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={t('form.decreaseGuests')}
                          disabled={(field.value ?? BOOKING_MIN_SEATS) <= BOOKING_MIN_SEATS}
                          onClick={() =>
                            field.onChange(
                              clampSeats((field.value ?? BOOKING_MIN_SEATS) - 1),
                            )
                          }
                          className={stepperButton}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={BOOKING_MIN_SEATS}
                          max={BOOKING_MAX_SEATS}
                          placeholder={t('form.personsPlaceholder')}
                          className={cn(luxuryInput, 'text-center tabular-nums')}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '')
                            field.onChange(
                              digits === ''
                                ? ''
                                : clampSeats(Number(digits)),
                            )
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                        <button
                          type="button"
                          aria-label={t('form.increaseGuests')}
                          disabled={(field.value ?? BOOKING_MIN_SEATS) >= BOOKING_MAX_SEATS}
                          onClick={() =>
                            field.onChange(
                              clampSeats((field.value ?? BOOKING_MIN_SEATS) + 1),
                            )
                          }
                          className={stepperButton}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Day — Today/Tomorrow show the date below; "Other day" reveals a calendar */}
              <div className="flex flex-col gap-2">
                <FormLabel className={luxuryLabel}>{t('form.day')}</FormLabel>
                <div className="grid grid-cols-3 gap-3">
                  {BOOKING_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDay(d)}
                      className={chipClass(day === d)}
                    >
                      {t(`form.${d}`)}
                    </button>
                  ))}
                </div>
                {dayPreview && (
                  <div className="mt-1 rounded-md border border-landing-brass/20 bg-landing-iron-2/40 px-4 py-2 text-center text-sm capitalize text-landing-brass-light">
                    {dayPreview}
                  </div>
                )}
                {day === 'specific' && (
                  <div className="flex justify-center mt-1 rounded-md border border-landing-brass/30 bg-landing-iron-2/50">
                    <Calendar
                      mode="single"
                      selected={
                        specificDate
                          ? parse(specificDate, 'dd/MM/yyyy', new Date())
                          : undefined
                      }
                      onSelect={(selected) => {
                        if (!selected) return
                        form.setValue('specificDate', format(selected, 'dd/MM/yyyy'), {
                          shouldValidate: true,
                        })
                      }}
                      disabled={(date) => {
                        const todayStart = new Date(serverNow())
                        todayStart.setHours(0, 0, 0, 0)
                        // Block past days and anything beyond the advance-booking window.
                        const maxDate = addDays(todayStart, BOOKING_MAX_ADVANCE_DAYS)
                        maxDate.setHours(23, 59, 59, 999)
                        return (
                          date.getTime() < todayStart.getTime() ||
                          date.getTime() > maxDate.getTime()
                        )
                      }}
                    />
                  </div>
                )}
                {form.formState.errors.specificDate && (
                  <p className="text-sm font-medium text-destructive">
                    {t('form.specific')}
                  </p>
                )}
              </div>

              {/* Meal period — picking one immediately reveals the time slots */}
              <div className="flex flex-col gap-2">
                <FormLabel className={luxuryLabel}>{t('form.period')}</FormLabel>
                <div className="grid grid-cols-2 gap-3">
                  {BOOKING_PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={chipClass(period === p)}
                    >
                      {t(`form.${p}`)}
                    </button>
                  ))}
                </div>

                {/* Time slots sit right under Lunch/Evening */}
                <div className="flex flex-col gap-2 mt-2">
                  <span className={luxuryLabel}>{t('form.timeSlots')}</span>
                  {availableSlots.length === 0 && (
                    <p className="py-3 text-center italic text-landing-quartz/60">
                      {t('form.noSlots')}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => selectSlot(slot)}
                        className={slotClass(!isCustomTime && time === slot)}
                      >
                        {slot}
                      </button>
                    ))}
                    {/* Free-form time within the daily booking window */}
                    <button
                      type="button"
                      onClick={() => setIsCustomTime(true)}
                      className={cn(
                        slotClass(isCustomTime),
                        'flex gap-1 justify-center items-center',
                      )}
                    >
                      <Clock className="w-4 h-4" />
                      {t('form.otherTime')}
                    </button>
                  </div>
                  {!isCustomTime && form.formState.errors.time && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.time.message ||
                        t('form.selectTimeFirst')}
                    </p>
                  )}

                  {/* Custom time picker — shown after "Other time" is chosen */}
                  {isCustomTime && (
                    <div className="flex flex-col gap-1 mt-1">
                      <span className={luxuryLabel}>{t('form.chooseTime')}</span>
                      <ClockTimePicker
                        value={time}
                        onChange={handleCustomTimeSelect}
                        minTime={customMinTime}
                        maxTime={BOOKING_MAX_TIME}
                        minuteStep={BOOKING_CUSTOM_TIME_STEP_MINUTES}
                        defaultTime={customMinTime}
                        placeholder={t('form.chooseTime')}
                        labels={{
                          hour: t('form.hour'),
                          minute: t('form.minute'),
                          now: t('form.now'),
                          done: t('form.done'),
                        }}
                        className="h-11 border-landing-brass/30 bg-landing-iron-2/60 text-landing-quartz hover:bg-landing-brass/10 hover:text-landing-brass-light"
                        contentClassName="border-landing-brass/40 bg-landing-iron text-landing-quartz"
                        labelClassName="text-landing-brass-light"
                        bandClassName="border-landing-brass/40 bg-landing-brass/15"
                        itemClassName="text-landing-quartz/60 aria-selected:text-landing-brass-light aria-disabled:text-landing-quartz/25"
                      />
                      <p className="text-xs italic text-landing-quartz/60">
                        {t('form.customTimeHint', {
                          min: customMinTime,
                          max: BOOKING_MAX_TIME,
                        })}
                      </p>
                      {form.formState.errors.time && (
                        <p className="text-sm font-medium text-destructive">
                          {form.formState.errors.time.message ||
                            t('form.selectTimeFirst')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Optional note / special requests */}
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={luxuryLabel}>
                      {t('form.note')}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        maxLength={BOOKING_NOTE_MAX_LENGTH}
                        placeholder={t('form.notePlaceholder')}
                        className={cn(luxuryInput, 'h-auto min-h-20 resize-none')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <button
              type="submit"
              disabled={isPending || (!isCustomTime && availableSlots.length === 0)}
              className="h-12 w-full rounded-md bg-landing-brass text-sm font-semibold uppercase tracking-[.2em] text-landing-iron transition-colors hover:bg-landing-brass-light disabled:opacity-60"
            >
              {isPending ? t('form.submitting') : t('form.submit')}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
