import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { ITableBooking } from '@/types'
import { UpdateStaffTableBookingForm } from '@/components/app/form'
import TableBookingStatusBadge from '@/components/app/badge/table-booking-status-badge'

interface IUpdateTableBookingDialogProps {
  booking: ITableBooking | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

// Booking detail dialog, opened by clicking a row (or the eye button) on the
// staff table-booking page. Opens read-only; clicking "Edit" unlocks the form
// so the booking can be revised and saved (full-body PATCH).
export default function UpdateTableBookingDialog({
  booking,
  isOpen,
  onOpenChange,
}: IUpdateTableBookingDialogProps) {
  const { t } = useTranslation('tableBooking')
  const [isEditing, setIsEditing] = useState(false)

  // Always reopen in view mode, whatever mode the dialog was closed in.
  const handleOpenChange = (open: boolean) => {
    if (!open) setIsEditing(false)
    onOpenChange(open)
  }

  if (!booking) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[22rem] overflow-y-auto rounded-md px-6 sm:max-w-[44rem]">
        <DialogHeader>
          <DialogTitle className="flex gap-2 justify-between items-center pr-6">
            {t('detail.title')}
            <TableBookingStatusBadge status={booking.status} />
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('detail.updateDescription')
              : t('detail.viewDescription')}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed by slug so switching rows resets the form to the newly
            clicked booking, while refetches of the same booking don't
            clobber in-progress edits. */}
        <UpdateStaffTableBookingForm
          key={booking.slug}
          booking={booking}
          readOnly={!isEditing}
          onEdit={() => setIsEditing(true)}
          onCancel={() => setIsEditing(false)}
          onSubmit={handleOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}
