import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertTriangle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui'
import { useUpdateVatStatus } from '@/hooks/use-vat-admin'
import {
  vatStatusTransitionSchema,
  type TVatStatusTransition,
} from '@/schemas/vat-admin.schema'
import { showErrorToastMessage, showToast } from '@/utils'
import { VatRequestStatus, type IVatRequestListItem } from '@/types'

interface StatusTransitionConfirmDialogProps {
  open: boolean
  vatRequest: IVatRequestListItem
  targetStatus: VatRequestStatus
  onClose: () => void
  onConfirmed: (updated: IVatRequestListItem) => void
}

export function StatusTransitionConfirmDialog({
  open,
  vatRequest,
  targetStatus,
  onClose,
  onConfirmed,
}: StatusTransitionConfirmDialogProps) {
  const { t } = useTranslation('vatAdmin')
  const { t: tToast } = useTranslation('toast')
  const { mutate, isPending } = useUpdateVatStatus()

  const requiresInvoice = targetStatus === VatRequestStatus.COMPLETED
  const requiresNote = targetStatus === VatRequestStatus.REJECTED
  const showEmailNotice =
    targetStatus === VatRequestStatus.COMPLETED ||
    targetStatus === VatRequestStatus.REJECTED

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TVatStatusTransition>({
    resolver: zodResolver(vatStatusTransitionSchema),
    defaultValues: {
      status: targetStatus,
      invoiceNumber: vatRequest.invoiceNumber ?? '',
      note: '',
    } as TVatStatusTransition,
  })

  const onSubmit = (values: TVatStatusTransition) => {
    // Empty string → null. BE từ chối "" cho invoiceNumber/note; null là cách
    // chuẩn báo "chưa có". Trim trước để loại trắng vô nghĩa.
    const trimmedInvoice = values.invoiceNumber?.trim()
    const trimmedNote = values.note?.trim()
    const body = {
      status: values.status,
      invoiceNumber: trimmedInvoice ? trimmedInvoice : null,
      note: trimmedNote ? trimmedNote : null,
    }
    mutate(
      { slug: vatRequest.slug, body },
      {
        onSuccess: (resp) => {
          showToast(tToast('toast.vatStatusUpdated', 'Chuyển trạng thái thành công'))
          onConfirmed(resp.result)
          onClose()
        },
        onError: (err: unknown) => {
          // Log BE message cho dev console nhưng toast luôn Vietnamese
          // fallback — tránh hiển message Anh trên UI Việt.
          const e = err as {
            response?: { data?: { message?: string } }
            message?: string
          }
          // eslint-disable-next-line no-console
          console.error('[vat-status update]', e?.response?.data?.message || e?.message)
          showErrorToastMessage(
            tToast('toast.vatStatusUpdateFailed', 'Chuyển trạng thái thất bại'),
          )
        },
      },
    )
  }

  const titleKey = `transition.title.${targetStatus}`
  const fallbackTitle = `Chuyển sang ${targetStatus}?`
  const descriptionKey = `transition.description.${targetStatus}`
  const fallbackDescription: Record<VatRequestStatus, string> = {
    [VatRequestStatus.PROCESSING]:
      'Đánh dấu đơn này đang được xử lý. Khách không nhận thông báo ở bước này.',
    [VatRequestStatus.COMPLETED]:
      'Hoàn tất xuất hoá đơn. Nhập số hoá đơn thực tế đã phát hành để khách đối chiếu.',
    [VatRequestStatus.REJECTED]:
      'Từ chối yêu cầu. Vui lòng nhập lý do — kế toán dùng để giải thích với khách.',
    [VatRequestStatus.PENDING]: '',
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(titleKey, fallbackTitle)}</DialogTitle>
          <DialogDescription>
            {t(descriptionKey, fallbackDescription[targetStatus])}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('status')} value={targetStatus} />
          {requiresInvoice && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                {t('transition.invoiceNumber', 'Số hoá đơn (*)')}
              </label>
              <input
                type="text"
                data-testid="vat-transition-invoice"
                placeholder="VD: HD-2026-001"
                className="rounded border px-2 py-1 text-sm"
                {...register('invoiceNumber')}
              />
              <span className="text-[11px] text-muted-foreground">
                {t(
                  'transition.invoiceHint',
                  'Nếu đã lưu sẵn ở tab "Phát hành HĐ" thì hệ thống tự điền — chỉ cần kiểm tra rồi xác nhận.',
                )}
              </span>
              {errors.invoiceNumber && (
                <span
                  data-testid="vat-transition-invoice-error"
                  className="text-xs text-destructive"
                >
                  {t('transition.invoiceRequired', 'Vui lòng nhập số hoá đơn')}
                </span>
              )}
            </div>
          )}
          {requiresNote && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                {t('transition.rejectReason', 'Lý do từ chối (*)')}
              </label>
              <textarea
                data-testid="vat-transition-note"
                rows={3}
                className="rounded border px-2 py-1 text-sm"
                {...register('note')}
              />
              {errors.note && (
                <span
                  data-testid="vat-transition-note-error"
                  className="text-xs text-destructive"
                >
                  {t('transition.noteRequired', 'Lý do từ chối tối thiểu 3 ký tự')}
                </span>
              )}
            </div>
          )}
          {showEmailNotice && (
            <div
              data-testid="vat-transition-email-notice"
              className="flex items-start gap-2 rounded border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {t(
                  'transition.emailNotice',
                  'Hệ thống tạm thời chưa tự gửi email cho khách. Vui lòng liên hệ trực tiếp nếu cần.',
                )}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('cancel', 'Huỷ')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              data-testid="vat-transition-confirm"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('confirm', 'Xác nhận')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
