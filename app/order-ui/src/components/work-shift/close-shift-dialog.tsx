import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@/components/ui'
import { useCloseWorkShift, useCurrentWorkShiftSummary } from '@/hooks'
import { getApiErrorCode } from '@/lib/api-error'
import type { IWorkShiftSummary } from '@/types'
import {
  formatCurrencyWithSymbol,
  showErrorToast,
  showErrorToastMessage,
  showToast,
} from '@/utils'

import { ShiftSummaryPanel } from './shift-summary-panel'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed?: (summary: IWorkShiftSummary) => void
}

/**
 * Dialog đóng ca. Hiển thị tổng kết ca đang mở (từ /current/summary) và
 * preview chênh lệch tiền mặt tính tại client trước khi submit.
 */
export function CloseShiftDialog({ open, onOpenChange, onClosed }: Props) {
  const { t } = useTranslation('workShift')
  const [cash, setCash] = useState<string>('')
  const [note, setNote] = useState<string>('')

  const { data: summary, isLoading } = useCurrentWorkShiftSummary(open)
  const { mutate: closeShift, isPending } = useCloseWorkShift()

  const closingCash = cash.trim() === '' ? null : Number(cash)

  const handleSubmit = () => {
    if (closingCash !== null && (!Number.isInteger(closingCash) || closingCash < 0)) {
      showErrorToastMessage(t('validation.closingCashInvalid'))
      return
    }

    closeShift(
      {
        closingCash: closingCash ?? undefined,
        note: note.trim() === '' ? undefined : note.trim(),
      },
      {
        onSuccess: (response) => {
          showToast(t('closeSuccess'))
          setCash('')
          setNote('')
          onOpenChange(false)
          onClosed?.(response.result)
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('closeShiftTitle')}</DialogTitle>
          <DialogDescription>{t('tabSummary')}</DialogDescription>
        </DialogHeader>

        {isLoading && !summary ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : summary ? (
          <ShiftSummaryPanel
            summary={summary}
            closingCashEditor={{
              value: closingCash,
              input: (
                <div className="relative">
                  <Input
                    id="closing-cash"
                    type="text"
                    inputMode="numeric"
                    className="h-8 pr-7 text-right"
                    value={
                      cash ? formatCurrencyWithSymbol(Number(cash), false) : ''
                    }
                    onChange={(e) => setCash(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    disabled={isPending}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₫
                  </span>
                </div>
              ),
            }}
          />
        ) : null}

        <div>
          <label htmlFor="close-note" className="mb-2 block text-sm font-medium">
            {t('note')}
          </label>
          <Textarea
            id="close-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('notePlaceholder')}
            maxLength={500}
            disabled={isPending}
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
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? t('closing') : t('closeShift')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
