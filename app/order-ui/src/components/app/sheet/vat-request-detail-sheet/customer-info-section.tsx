import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { ConfirmUpdateVatRequestDialog } from '@/components/app/dialog'
import { useUpdateVatRequest } from '@/hooks/use-vat-admin'
import {
  vatUpdateCustomerSchema,
  type TVatUpdateCustomer,
} from '@/schemas/vat-admin.schema'
import { showErrorToastMessage, showToast } from '@/utils'
import type { IVatRequestListItem } from '@/types'

interface CustomerInfoSectionProps {
  vatRequest: IVatRequestListItem
  isLocked: boolean
  onUpdated: (updated: IVatRequestListItem) => void
}

export function CustomerInfoSection({
  vatRequest,
  isLocked,
  onUpdated,
}: CustomerInfoSectionProps) {
  const { t } = useTranslation('vatAdmin')
  const { mutate, isPending } = useUpdateVatRequest()
  // Pending payload (full 6 fields đã validate) — snapshot khi user bấm "Lưu",
  // hold cho đến khi confirm. null = confirm dialog đóng.
  const [pendingPayload, setPendingPayload] = useState<TVatUpdateCustomer | null>(
    null,
  )

  // Zod messages stored as i18n keys (vd 'customerInfo.errors.email.invalid')
  // → translate qua t() trước khi pass xuống Field. Fallback giữ key thô nếu
  // i18n thiếu để dev còn thấy mà fix.
  const tErr = (key?: string) => (key ? t(key, key) : undefined)
  const {
    register,
    handleSubmit,
    formState: { errors, dirtyFields },
  } = useForm<TVatUpdateCustomer>({
    resolver: zodResolver(vatUpdateCustomerSchema),
    defaultValues: {
      customerName: vatRequest.customerName ?? '',
      taxCode: vatRequest.taxCode ?? '',
      address: vatRequest.address ?? '',
      email: vatRequest.email ?? '',
      companyName: vatRequest.companyName ?? '',
      note: vatRequest.note ?? '',
    },
  })

  // Submit form (đã pass validation) → mở confirm dialog. BE PATCH /vat-request/:slug
  // nhận FULL payload 6 field (per spec screenshot), không phải partial — gửi
  // hết để tránh BE clear field undefined. Chặn submit khi không có gì dirty
  // để khỏi gọi API thừa.
  const onSubmit = (values: TVatUpdateCustomer) => {
    if (Object.keys(dirtyFields).length === 0) return
    setPendingPayload({
      customerName: values.customerName ?? '',
      taxCode: values.taxCode ?? '',
      address: values.address ?? '',
      email: values.email ?? '',
      companyName: values.companyName ?? '',
      note: values.note ?? '',
    })
  }

  // User confirm trong dialog → fire mutation. `meta.ignoreGlobalError` (đã
  // set ở hook) tránh global toast trùng — chỉ local toast nội dung BE message.
  const handleConfirm = () => {
    if (!pendingPayload) return
    mutate(
      { slug: vatRequest.slug, body: pendingPayload },
      {
        onSuccess: (resp) => {
          showToast(t('customerInfo.saveSuccess', 'Cập nhật thành công'))
          onUpdated(resp.result)
          setPendingPayload(null)
        },
        onError: (err: unknown) => {
          // Toast luôn dùng Vietnamese fallback — tránh hiển BE message Anh
          // trên UI Việt. BE message log console cho dev debug.
          const e = err as {
            response?: { data?: { message?: string } }
            message?: string
          }
          // eslint-disable-next-line no-console
          console.error('[vat-customer update]', e?.response?.data?.message || e?.message)
          showErrorToastMessage(
            t('customerInfo.saveFailed', 'Cập nhật thông tin khách hàng thất bại'),
          )
          setPendingPayload(null)
        },
      },
    )
  }

  return (
    <section className="space-y-3" data-testid="vat-customer-info-section">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t('customerInfo.title', 'THÔNG TIN KHÁCH')}
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field
          label={t('customerInfo.customerName', 'Tên khách hàng')}
          testId="vat-customer-name"
          error={tErr(errors.customerName?.message)}
          disabled={isLocked}
          register={register('customerName')}
        />
        <Field
          label={t('customerInfo.taxCode', 'Mã số thuế')}
          testId="vat-customer-taxcode"
          error={tErr(errors.taxCode?.message)}
          disabled={isLocked}
          register={register('taxCode')}
        />
        <Field
          label={t('customerInfo.address', 'Địa chỉ')}
          testId="vat-customer-address"
          error={tErr(errors.address?.message)}
          disabled={isLocked}
          register={register('address')}
        />
        <Field
          label={t('customerInfo.email', 'Email')}
          testId="vat-customer-email"
          error={tErr(errors.email?.message)}
          disabled={isLocked}
          register={register('email')}
          type="email"
        />
        <Field
          label={t('customerInfo.companyName', 'Tên công ty (nếu có)')}
          testId="vat-customer-company"
          error={tErr(errors.companyName?.message)}
          disabled={isLocked}
          register={register('companyName')}
        />
        <Field
          label={t('customerInfo.note', 'Ghi chú')}
          testId="vat-customer-note"
          error={tErr(errors.note?.message)}
          disabled={isLocked}
          register={register('note')}
        />
        {!isLocked && (
          <Button
            type="submit"
            data-testid="vat-customer-save"
            disabled={isPending}
            size="sm"
          >
            {t('customerInfo.save', 'Lưu thay đổi')}
          </Button>
        )}
      </form>

      <ConfirmUpdateVatRequestDialog
        open={pendingPayload !== null}
        onOpenChange={(o) => !o && !isPending && setPendingPayload(null)}
        title={t('customerInfo.confirmTitle', 'Cập nhật thông tin khách hàng')}
        description={t(
          'customerInfo.confirmDescription',
          'Xác nhận cập nhật thông tin khách hàng cho yêu cầu xuất hoá đơn VAT này?',
        )}
        isPending={isPending}
        onConfirm={handleConfirm}
      />
    </section>
  )
}

interface FieldProps {
  label: string
  testId: string
  error?: string
  disabled: boolean
  register: ReturnType<ReturnType<typeof useForm>['register']>
  type?: string
}

function Field({ label, testId, error, disabled, register, type = 'text' }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        data-testid={testId}
        disabled={disabled}
        className="rounded border px-2 py-1 text-sm disabled:bg-muted disabled:opacity-70"
        {...register}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
