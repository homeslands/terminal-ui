import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface IProps {
  open: boolean
  entity?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DisableConfirmDialog({
  open,
  entity,
  onOpenChange,
  onConfirm,
}: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auditLog.config.disableTitle')}</DialogTitle>
          <DialogDescription>
            {t('auditLog.config.disableBody', { entity: entity ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('auditLog.config.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {t('auditLog.config.disableConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
