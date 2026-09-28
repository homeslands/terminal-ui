import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Helmet } from 'react-helmet'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
} from 'lucide-react'

import { TerminalLogo } from '@/assets/images'
import { phone } from '@/constants'
import { ConfirmUpdateVatRequestDialog } from '@/components/app/dialog'
import {
  useSubmitVatRequest,
  useVatRequestStatus,
} from '@/hooks/use-vat'
import { vatSubmitSchema, type VatSubmitFormValues } from '@/schemas/vat.schema'
import { showErrorToastMessage, showToast } from '@/utils'

/**
 * Public form page khách quét QR điền VAT — không cần đăng nhập.
 *
 * Flow:
 *   1. Mount → GET /vat-request/public/:invoiceSlug check status
 *   2. SUBMITTED → locked view "đã gửi rồi"
 *   3. AVAILABLE → form 6 field (reuse `vatSubmitSchema` Phase 1)
 *   4. Submit → confirm dialog → POST /vat-request/public/:invoiceSlug
 *   5. Success → success view + dặn check email
 */
export default function PublicVatRequestPage() {
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const { invoiceSlug = '' } = useParams<{ invoiceSlug: string }>()
  const status = useVatRequestStatus(invoiceSlug)
  const submitMutation = useSubmitVatRequest()
  const [pendingPayload, setPendingPayload] = useState<VatSubmitFormValues | null>(
    null,
  )
  const [submitted, setSubmitted] = useState(false)

  const isLoading = status.isLoading
  const isError = status.isError
  const remoteSubmitted = status.data?.status === 'SUBMITTED'

  return (
    <div className="brick-wall relative min-h-screen overflow-hidden px-4 py-8 md:py-12">
      <Helmet>
        <title>The Terminal — {t('vat.publicTitle', 'Yêu cầu xuất hoá đơn VAT')}</title>
      </Helmet>

      {/* Dark overlay — same gradient as landing hero */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,12,4,.78) 0%, rgba(15,10,4,.82) 60%, rgba(8,5,2,.92) 100%)',
        }}
      />

      {/* Rising steam */}
      <div className="steam" style={{ left: '12%' }} />
      <div className="steam" style={{ left: '52%', animationDelay: '-2s' }} />
      <div className="steam" style={{ left: '85%', animationDelay: '-4s' }} />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col gap-5">
        {/* ── SIGNBOARD HEADER ── */}
        <div className="signboard relative w-full px-6 py-7">
          <span className="rivet" style={{ top: '8px', left: '8px' }} />
          <span className="rivet" style={{ top: '8px', right: '8px' }} />
          <span className="rivet" style={{ bottom: '8px', left: '8px' }} />
          <span className="rivet" style={{ bottom: '8px', right: '8px' }} />

          <div className="signboard-inner text-center">
            <img
              src={TerminalLogo}
              alt="The Terminal"
              className="mx-auto mb-4 h-16 w-16 rounded-full object-cover ring-1 ring-landing-brass/30 md:h-20 md:w-20"
            />

            {/* Eyebrow divider */}
            <div className="mb-3 flex items-center justify-center gap-3">
              <span
                className="h-px w-8 md:w-12"
                style={{ background: 'linear-gradient(90deg, transparent, #c88d2b 70%, #ffe9a3)' }}
              />
              <span className="text-grad-accent text-[10px] font-medium tracking-[.4em] md:text-[11px]">
                {t('vat.publicEyebrow', 'HOÁ ĐƠN VAT')}
              </span>
              <span
                className="h-px w-8 md:w-12"
                style={{ background: 'linear-gradient(90deg, #ffe9a3, #c88d2b 30%, transparent)' }}
              />
            </div>

            <h1
              className="text-grad-primary whitespace-nowrap font-black uppercase leading-[.9] tracking-[.04em]"
              style={{ fontSize: 'clamp(1.5rem, 7vw, 2.75rem)' }}
            >
              The Terminal
            </h1>

            <div className="brand-divider mx-auto mt-4" style={{ maxWidth: '180px' }} />

            <p className="mt-4 text-[11px] font-medium uppercase tracking-[.3em] text-landing-brass-light/85 md:text-xs">
              {t('vat.publicTagline', 'Yêu cầu xuất hoá đơn VAT')}
            </p>
          </div>
        </div>

        {isLoading && <LoadingCard />}

        {!isLoading && isError && (
          <ErrorCard
            message={t(
              'vat.publicInvalidSlug',
              'Mã hoá đơn không hợp lệ hoặc đã hết hạn. Vui lòng liên hệ nhà hàng.',
            )}
          />
        )}

        {!isLoading && !isError && (submitted || remoteSubmitted) && (
          <SuccessCard
            title={t('vat.publicSubmittedTitle', 'Đã ghi nhận yêu cầu VAT')}
            body={t(
              'vat.publicSubmittedBody',
              'Cảm ơn bạn. Hoá đơn sẽ được gửi qua email trong vòng 24 giờ.',
            )}
          />
        )}

        {!isLoading && !isError && !submitted && !remoteSubmitted && (
          <PublicForm
            invoiceSlug={invoiceSlug}
            isPending={submitMutation.isPending}
            onRequestSubmit={(values) => setPendingPayload(values)}
          />
        )}

        <footer className="mt-4 flex flex-col items-center gap-2 px-2 pb-2 text-center text-[11px] leading-relaxed text-landing-brass-light/70">
          <p className="font-medium tracking-wide">
            {t(
              'vat.publicFooterSupport',
              'Cần hỗ trợ? Vui lòng liên hệ thu ngân tại quầy.',
            )}
          </p>
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-4">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              {t(
                'vat.publicFooterAddress',
                'Số 03 Nguyễn Công Trứ, Bình Thọ, Thủ Đức, TP.HCM',
              )}
            </span>
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 hover:text-landing-brass-light"
              >
                <Phone className="h-3 w-3 shrink-0" />
                {phone}
              </a>
            )}
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[.2em] text-landing-brass-light/45">
            © The Terminal
          </p>
        </footer>
      </div>

      <ConfirmUpdateVatRequestDialog
        open={pendingPayload !== null}
        onOpenChange={(o) =>
          !o && !submitMutation.isPending && setPendingPayload(null)
        }
        title={t('vat.publicConfirmTitle', 'Gửi yêu cầu xuất hoá đơn VAT')}
        description={t(
          'vat.publicConfirmDescription',
          'Xác nhận gửi yêu cầu với thông tin đã điền? Mỗi đơn chỉ gửi được 1 lần.',
        )}
        isPending={submitMutation.isPending}
        onConfirm={() => {
          if (!pendingPayload || !invoiceSlug) return
          submitMutation.mutate(
            { invoiceSlug, body: pendingPayload },
            {
              onSuccess: () => {
                showToast(tToast('toast.vatSubmitSuccess', 'Đã gửi yêu cầu xuất hoá đơn VAT'))
                setPendingPayload(null)
                setSubmitted(true)
              },
              onError: (err: unknown) => {
                const e = err as {
                  response?: { data?: { message?: string } }
                  message?: string
                }
                // eslint-disable-next-line no-console
                console.error('[public-vat-submit]', e?.response?.data?.message || e?.message)
                showErrorToastMessage(
                  tToast('toast.vatSubmitFailed', 'Gửi yêu cầu VAT thất bại'),
                )
                setPendingPayload(null)
              },
            },
          )
        }}
      />
    </div>
  )
}

function LoadingCard() {
  return (
    <div className="flex items-center justify-center rounded-md paper-card py-10">
      <Loader2 className="h-6 w-6 animate-spin text-landing-brass" />
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="paper-card flex flex-col items-center gap-3 rounded-md p-6 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="text-sm font-medium text-landing-rust-deep">{message}</p>
    </div>
  )
}

function SuccessCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="paper-card flex flex-col items-center gap-3 rounded-md p-6 text-center">
      <div className="rounded-full bg-emerald-100 p-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="text-base font-semibold text-landing-ink">{title}</h3>
      <p className="text-sm text-landing-ink/75">{body}</p>
    </div>
  )
}

function PublicForm({
  isPending,
  onRequestSubmit,
}: {
  invoiceSlug: string
  isPending: boolean
  onRequestSubmit: (values: VatSubmitFormValues) => void
}) {
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
      onSubmit={handleSubmit(onRequestSubmit)}
      className="paper-card rounded-md p-5 space-y-4 md:p-6"
      noValidate
    >
      <Field
        label={t('vat.customerName', 'Tên khách hàng')}
        required
        error={errors.customerName?.message}
      >
        <input
          {...register('customerName')}
          placeholder={t('vat.customerNamePlaceholder', 'VD: Nguyễn Văn A')}
          className={inputClass}
        />
      </Field>

      <Field
        label={t('vat.taxCode', 'Mã số thuế')}
        required
        hint={t('vat.taxCodeHint', '10 hoặc 13 chữ số')}
        error={errors.taxCode?.message}
      >
        <input
          {...register('taxCode')}
          inputMode="numeric"
          maxLength={13}
          onChange={(e) =>
            setValue('taxCode', e.target.value.replace(/\D/g, ''), {
              shouldValidate: true,
            })
          }
          placeholder="0123456789"
          className={inputClass}
        />
      </Field>

      <Field
        label={t('vat.address', 'Địa chỉ')}
        required
        error={errors.address?.message}
      >
        <input
          {...register('address')}
          placeholder={t('vat.addressPlaceholder', '123 Nguyễn Huệ, Q.1, TP.HCM')}
          className={inputClass}
        />
      </Field>

      <Field
        label={t('vat.email', 'Email nhận hoá đơn')}
        required
        error={errors.email?.message}
      >
        <input
          {...register('email')}
          type="email"
          placeholder="ketoan@abc.com"
          className={inputClass}
        />
      </Field>

      <Field
        label={t('vat.companyName', 'Tên công ty (nếu có)')}
        error={errors.companyName?.message}
      >
        <input
          {...register('companyName')}
          placeholder={t('vat.companyNamePlaceholder', 'Công ty TNHH ABC')}
          className={inputClass}
        />
      </Field>

      <Field label={t('vat.note', 'Ghi chú')} error={errors.note?.message}>
        <textarea
          {...register('note')}
          rows={2}
          placeholder={t('vat.notePlaceholder', 'Yêu cầu thêm nếu có...')}
          className={`${inputClass} resize-none`}
        />
      </Field>

      <div className="flex items-start gap-2 rounded-md border border-amber-700/30 bg-amber-50/80 p-3 text-xs text-amber-900">
        <span className="text-base">⚠</span>
        <span>
          {t(
            'vat.submitOnceWarning',
            'Yêu cầu xuất VAT chỉ có thể gửi một lần cho mỗi hoá đơn.',
          )}
        </span>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn-brass w-full px-6 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-brass focus-visible:ring-offset-2"
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t('vat.submit', 'Gửi yêu cầu')}
      </button>
    </form>
  )
}

const inputClass =
  'w-full rounded-md border border-amber-900/30 bg-white/70 px-3 py-2 text-sm text-landing-ink placeholder:text-landing-ink/40 focus:border-landing-brass focus:outline-none focus:ring-1 focus:ring-landing-brass'

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
      <label className="mb-1 flex items-center gap-1 text-sm font-semibold text-landing-ink/85">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {hint && (
        <p className="mb-1 -mt-0.5 text-xs font-normal leading-snug text-landing-ink/55">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500">
          {t(`vat.error.${error}`, error)}
        </p>
      )}
    </div>
  )
}
