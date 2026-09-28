import { Loader2, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

interface ConfirmUpdateVatRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tiêu đề hiển thị (vd "Cập nhật thông tin khách hàng"). */
  title: string
  /** Mô tả ngắn — body của confirm. */
  description: string
  /** Loading state đang submit (Confirm button hiển spinner). */
  isPending?: boolean
  onConfirm: () => void
}

/**
 * Confirm dialog tái sử dụng cho cả update info khách + update kế toán info.
 * Pattern mirror `confirm-update-promotion-dialog`: header có icon + title,
 * body description, footer Cancel + Confirm. Controlled (open/onOpenChange).
 */
export function ConfirmUpdateVatRequestDialog({
  open,
  onOpenChange,
  title,
  description,
  isPending,
  onConfirm,
}: ConfirmUpdateVatRequestDialogProps) {
  const { t: tCommon } = useTranslation('common')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[22rem] rounded-md px-6 sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle className="border-b pb-4">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-6 w-6" />
              {title}
            </div>
          </DialogTitle>
          <p className="py-4 text-sm text-gray-500">{description}</p>
        </DialogHeader>
        <DialogFooter className="flex flex-row justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="border border-gray-300 min-w-24"
          >
            {tCommon('common.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            data-testid="vat-confirm-update"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tCommon('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
