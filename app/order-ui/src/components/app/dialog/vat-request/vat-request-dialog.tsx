import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import {
  useGetVatLink,
  useSubmitVatRequest,
  useVatRequestStatus,
} from '@/hooks/use-vat'
import { useUserStore } from '@/stores'
import { exportVatQrCard, showToast, showErrorToastMessage } from '@/utils'
import type { VatSubmitFormValues } from '@/schemas/vat.schema'
import { ConfirmUpdateVatRequestDialog } from '../confirm-update-vat-request-dialog'
import { VatQrPrintCard } from './vat-qr-print-card'
import { VatRequestOnBehalfForm } from './vat-request-on-behalf-form'
import { VatRequestSubmittedView } from './vat-request-submitted-view'

type ActiveMode = 'qr' | 'form'

interface VatRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderSlug: string
  /** Hiển thị + in trên QR card. Undefined → bỏ qua dòng tương ứng. */
  amountLabel?: string
  dateTime?: string
}

/** Main orchestrator: open → fetch link → extract invoiceSlug → render by status. */
export function VatRequestDialog({
  open,
  onOpenChange,
  orderSlug,
  amountLabel,
  dateTime,
}: VatRequestDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const [mode, setMode] = useState<ActiveMode>('qr')
  const { userInfo } = useUserStore()
  const brandAddress = userInfo?.branch?.address

  const getLink = useGetVatLink()
  const submitMutation = useSubmitVatRequest()

  // Idempotency: chỉ fire 1 mutate per (open transition × orderSlug).
  // Chặn StrictMode dev double-mount và mọi re-render khác — bug "1 click =
  // chục call vat-link" đến từ chỗ này.
  const firedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (open && orderSlug && firedForRef.current !== orderSlug) {
      firedForRef.current = orderSlug
      getLink.mutate(orderSlug)
    }
    if (!open) {
      firedForRef.current = null
      getLink.reset()
      submitMutation.reset()
      setMode('qr')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderSlug])

  // Extract invoiceSlug từ URL trả về: '/vat-request/{invoiceSlug}'
  const url = getLink.data?.result?.url ?? null
  const invoiceSlug = useMemo(() => {
    if (!url) return null
    const match = url.match(/\/vat-request\/([^/?#]+)/)
    return match?.[1] ?? null
  }, [url])

  const status = useVatRequestStatus(invoiceSlug)

  // Khi BE confirm status SUBMITTED → toast 1 lần per open (cashier UX).
  // Admin muốn quản lý đơn đã submit → vào /system/vat-request từ sidebar,
  // KHÔNG auto-promote sang Sheet ở đây để giữ flow cashier nhất quán.
  const submittedToastedRef = useRef(false)
  useEffect(() => {
    if (open) submittedToastedRef.current = false
  }, [open])
  useEffect(() => {
    if (status.data?.status !== 'SUBMITTED' || !open) return
    if (!submittedToastedRef.current) {
      submittedToastedRef.current = true
      showToast(
        tToast('toast.vatAlreadySubmitted', 'Yêu cầu VAT cho đơn này đã được gửi'),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data?.status, open])

  // Pending payload — set khi cashier bấm "Gửi yêu cầu VAT", hold đến confirm.
  const [pendingSubmit, setPendingSubmit] = useState<VatSubmitFormValues | null>(
    null,
  )

  // Form submit → open confirm dialog với payload.
  const handleSubmit = (values: VatSubmitFormValues) => {
    if (!invoiceSlug) return
    setPendingSubmit(values)
  }

  // Confirm dialog xác nhận → fire mutation. onSuccess: toast + đóng cả 2 dialog.
  const handleConfirmSubmit = () => {
    if (!invoiceSlug || !pendingSubmit) return
    submitMutation.mutate(
      { invoiceSlug, body: pendingSubmit },
      {
        onSuccess: () => {
          showToast(tToast('toast.vatSubmitSuccess', 'Gửi yêu cầu VAT thành công'))
          setPendingSubmit(null)
          onOpenChange(false) // đóng dialog cha → reset toàn bộ UI
        },
        onError: (err: unknown) => {
          // BE message vào console, toast Vietnamese fallback.
          const e = err as {
            response?: { data?: { message?: string } }
            message?: string
          }
          // eslint-disable-next-line no-console
          console.error('[vat-submit]', e?.response?.data?.message || e?.message)
          showErrorToastMessage(
            tToast('toast.vatSubmitFailed', 'Gửi yêu cầu VAT thất bại'),
          )
          setPendingSubmit(null)
        },
      },
    )
  }

  const handleClose = () => onOpenChange(false)

  const isLoadingLink = getLink.isPending
  const isLoadingStatus = status.isLoading
  const hasError = getLink.isError || status.isError

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h-[90vh] để không tràn viewport. Không set min-h cứng — dialog
          tự co theo content; min-h-[460px] ở content area giữ form không
          nhảy khi đổi giữa loading → tabs. */}
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>{t('vat.dialogTitle', 'Yêu cầu xuất hoá đơn VAT')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {isLoadingLink || isLoadingStatus ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-pos-gold" />
            </div>
          ) : hasError || !url || !invoiceSlug ? (
            <div className="flex flex-1 items-center justify-center text-sm text-destructive">
              {t('vat.fetchLinkFailed', 'Không thể tải thông tin hoá đơn. Vui lòng thử lại.')}
            </div>
          ) : status.data?.status === 'SUBMITTED' ? (
            <VatRequestSubmittedView />
          ) : (
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex gap-2 border-b">
                <ModeTab
                  active={mode === 'qr'}
                  onClick={() => setMode('qr')}
                  label={t('vat.modeQrLabel', 'QR Code')}
                />
                <ModeTab
                  active={mode === 'form'}
                  onClick={() => setMode('form')}
                  label={t('vat.modeFormLabel', 'Điền hộ khách')}
                />
              </div>
              {/* min-h-[460px] đủ cho form (~480px scroll nếu cần) hoặc QR
                  card (~400px). 2 mode cùng cao, không nhảy. */}
              <div className="flex min-h-[460px] flex-1 flex-col">
                {mode === 'qr' ? (
                  <VatQrPrintCard
                    url={fullUrl(url)}
                    dateTime={dateTime}
                    amountLabel={amountLabel}
                    brandAddress={brandAddress}
                  />
                ) : (
                  <VatRequestOnBehalfForm
                    isSubmitting={submitMutation.isPending}
                    submitError={getSubmitErrorMessage(submitMutation.error)}
                    onSubmit={handleSubmit}
                    onCancel={handleClose}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer: SUBMITTED → nút Đóng (đặt tại đây để đúng chuẩn dialog).
            Tab QR → nút In. Tab Form → không cần (form có Cancel/Submit). */}
        {status.data?.status === 'SUBMITTED' ? (
          <DialogFooter>
            <Button onClick={handleClose}>{t('vat.close', 'Đóng')}</Button>
          </DialogFooter>
        ) : url && invoiceSlug && mode === 'qr' ? (
          <DialogFooter>
            <Button
              onClick={() =>
                exportVatQrCard({
                  url: fullUrl(url),
                  dateTime,
                  amountLabel,
                  brandAddress,
                })
              }
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              {t('vat.print', 'In')}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>

      <ConfirmUpdateVatRequestDialog
        open={pendingSubmit !== null}
        onOpenChange={(o) =>
          !o && !submitMutation.isPending && setPendingSubmit(null)
        }
        title={t('vat.confirmSubmitTitle', 'Gửi yêu cầu xuất hoá đơn VAT')}
        description={t(
          'vat.confirmSubmitDescription',
          'Xác nhận gửi yêu cầu xuất hoá đơn VAT với thông tin khách đã điền? Sau khi gửi sẽ không thể chỉnh sửa.',
        )}
        isPending={submitMutation.isPending}
        onConfirm={handleConfirmSubmit}
      />
    </Dialog>
  )
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-pos-gold text-pos-gold'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}

/** Converts relative BE URL → absolute so QR scan gives a full link. */
function fullUrl(maybeRelative: string): string {
  if (/^https?:\/\//.test(maybeRelative)) return maybeRelative
  if (typeof window === 'undefined') return maybeRelative
  return `${window.location.origin}${maybeRelative}`
}

function getSubmitErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined
  const e = error as {
    response?: { data?: { message?: string } }
    message?: string
  }
  return e?.response?.data?.message ?? e?.message
}
