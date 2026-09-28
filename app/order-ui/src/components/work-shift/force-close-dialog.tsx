import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { useForceCloseWorkShift } from '@/hooks'
import { getApiErrorCode } from '@/lib/api-error'
import type { IWorkShiftSummary } from '@/types'
import { showErrorToast, showErrorToastMessage, showToast } from '@/utils'

interface Props {
  shiftSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onForceClosed?: (summary: IWorkShiftSummary) => void
}

/** Đóng ép ca — dành cho MANAGER/ADMIN. `note` bắt buộc (spec §5.15). */
export function ForceCloseDialog({
  shiftSlug,
  open,
  onOpenChange,
  onForceClosed,
}: Props) {
  const { t } = useTranslation('workShift')
  const [note, setNote] = useState('')
  const { mutate: forceClose, isPending } = useForceCloseWorkShift()

  const trimmedNote = note.trim()
  const canSubmit = trimmedNote.length > 0 && !isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    forceClose(
      { slug: shiftSlug, data: { note: trimmedNote } },
      {
        onSuccess: (response) => {
          showToast(t('forceCloseSuccess'))
          setNote('')
          onOpenChange(false)
          onForceClosed?.(response.result)
        },
        onError: (error: unknown) => {
          const code = getApiErrorCode(error)
          if (typeof code === 'number') {
            showErrorToast(code)
            return
          }
          showErrorToastMessage('toast.requestFailed')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('forceCloseTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{t('forceCloseWarning')}</span>
        </div>

        <div>
          <label
            htmlFor="force-close-note"
            className="mb-2 block text-sm font-medium"
          >
            {t('forceCloseNote')}
          </label>
          <textarea
            id="force-close-note"
            data-testid="force-close-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('forceCloseNotePlaceholder')}
            maxLength={500}
            disabled={isPending}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('common.cancel', { ns: 'common' })}
          </Button>
          <Button
            data-testid="force-close-submit"
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('forceClose')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
