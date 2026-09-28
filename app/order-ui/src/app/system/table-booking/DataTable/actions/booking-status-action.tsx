import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, MoreHorizontal } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui'
import { ITableBooking, TTableBookingStatus } from '@/types'
import {
  QUERYKEY,
  TABLE_BOOKING_STATUSES,
  TABLE_BOOKING_STATUS_STYLE,
} from '@/constants'
import { useUpdateTableBooking } from '@/hooks'
import { showToast } from '@/utils'
import { cn } from '@/lib/utils'

// Status-change control for a table booking. The ⋯ dropdown mirrors the
// order-management actions cell visually; selecting a status immediately
// PATCHes the booking (behavior unchanged from the previous inline select).
export default function BookingStatusAction({
  booking,
}: {
  booking: ITableBooking
}) {
  const { t } = useTranslation('tableBooking')
  const queryClient = useQueryClient()
  const { mutate: updateBooking, isPending } = useUpdateTableBooking()

  const handleChange = (status: TTableBookingStatus) => {
    if (status === booking.status) return
    updateBooking(
      { slug: booking.slug, data: { status } },
      {
        onSuccess: () => {
          showToast(t('toast.updateSuccess'))
          queryClient.invalidateQueries({ queryKey: QUERYKEY.tableBookings })
        },
      },
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Keep the click on the ⋯ button from also triggering the row's
            open-detail-dialog handler. */}
        <Button
          variant="ghost"
          className="p-0 w-8 h-8"
          disabled={isPending}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="sr-only">{t('columns.action')}</span>
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MoreHorizontal className="w-4 h-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('columns.action')}</DropdownMenuLabel>
        {TABLE_BOOKING_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            disabled={isPending}
            className="flex gap-2 items-center text-sm cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            onSelect={() => handleChange(status)}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                TABLE_BOOKING_STATUS_STYLE[status],
              )}
            />
            <span className="flex-1">{t(`status.${status}`)}</span>
            {status === booking.status && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
