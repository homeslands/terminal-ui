import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { vatSubmitSchema, type VatSubmitFormValues } from '@/schemas/vat.schema'

interface VatRequestOnBehalfFormProps {
  isSubmitting: boolean
  submitError?: string
  onSubmit: (values: VatSubmitFormValues) => void
  onCancel: () => void
}

/**
 * Form cashier điền hộ khách tại quầy. Validation realtime qua Zod
 * (mã số thuế 10/13 chữ số, email format). Strip non-digit khỏi taxCode
 * input để giảm typo.
 */
export function VatRequestOnBehalfForm({
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
}: VatRequestOnBehalfFormProps) {
  const { t } = useTranslation('menu')
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<VatSubmitFormValues>({
    resolver: zodResolver(vatSubmitSchema),
    mode: 'onBlur',
  })

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      aria-label="vat-on-behalf-form"
    >
      <Field label="customerName" required error={errors.customerName?.message}>
        <input
          {...register('customerName')}
          id="customerName"
          placeholder={t('vat.customerNamePlaceholder', 'Tên khách hàng / tên công ty')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </Field>

      <Field
        label="taxCode"
        required
        hint={t('vat.taxCodeHint', '10 hoặc 13 chữ số')}
        error={errors.taxCode?.message}
      >
        <input
          {...register('taxCode')}
          id="taxCode"
          inputMode="numeric"
          maxLength={13}
          onChange={(e) =>
            setValue('taxCode', e.target.value.replace(/\D/g, ''), {
              shouldValidate: true,
            })
          }
          placeholder="0123456789"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="companyName" hint={t('vat.optional', 'Tùy chọn')}>
          <input
            {...register('companyName')}
            id="companyName"
            placeholder={t('vat.companyNamePlaceholder', 'Tên công ty (nếu có)')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
          />
        </Field>
        <Field label="email" required error={errors.email?.message}>
          <input
            {...register('email')}
            id="email"
            type="email"
            placeholder="ketoan@abc.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
          />
        </Field>
      </div>

      <Field label="address" required error={errors.address?.message}>
        <input
          {...register('address')}
          id="address"
          placeholder={t('vat.addressPlaceholder', 'Địa chỉ xuất hoá đơn')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </Field>

      <Field label="note" hint={t('vat.optional', 'Tùy chọn')}>
        <textarea
          {...register('note')}
          id="note"
          rows={2}
          placeholder={t('vat.notePlaceholder', 'Ghi chú thêm (nếu có)')}
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </Field>

      <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        <span className="text-base">⚠</span>
        <span>{t('vat.submitOnceWarning', 'Yêu cầu xuất VAT chỉ có thể gửi một lần cho mỗi hoá đơn.')}</span>
      </div>

      {submitError && (
        <div className="rounded-md border-l-4 border-destructive bg-destructive/10 p-3 text-xs text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="outline" type="button" onClick={onCancel}>
          {t('vat.cancel', 'cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? t('vat.submitting', 'Đang gửi...')
            : t('vat.submit', 'submit')}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  const { t } = useTranslation('menu')
  return (
    <div>
      <label
        htmlFor={label}
        className="mb-1 flex items-center gap-1 text-sm font-medium"
      >
        {t(`vat.${label}`, label)}
        {required && <span className="text-red-500">*</span>}
        {hint && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({hint})
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500">{t(`vat.error.${error}`, error)}</p>
      )}
    </div>
  )
}
