import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import type { IWorkShiftSummary } from '@/types'

import { ShiftSummaryPanel } from './shift-summary-panel'

interface Props {
  summary: IWorkShiftSummary | null
  isOpen: boolean
  onClose: () => void
}

/**
 * Tổng kết CHÍNH THỨC do BE trả về sau khi đóng ca / đóng ép ca
 * (WorkShiftSummaryResponseDto — spec §5.2 và §5.15).
 *
 * Quan trọng: cashDifference ở đây là con số BE tính với closingCash thực nhập,
 * khác với preview phía client trong dialog đóng ca. Trước đây payload này bị
 * bỏ đi nên thu ngân không bao giờ thấy kết quả đối soát chính thức.
 */
export function ShiftClosedSummaryDialog({ summary, isOpen, onClose }: Props) {
  const { t } = useTranslation('workShift')
  const { t: tCommon } = useTranslation('common')

  if (!summary) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('shiftClosedTitle')}</DialogTitle>
        </DialogHeader>

        <ShiftSummaryPanel summary={summary} />

        <DialogFooter>
          <Button onClick={onClose}>{tCommon('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
