import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import moment from 'moment'

import { Button, DataTableColumnHeader } from '@/components/ui'
import { ITableBooking } from '@/types'
import TableBookingStatusBadge from '@/components/app/badge/table-booking-status-badge'
import { BookingStatusAction } from '../actions'

export const useTableBookingColumns = (
  onViewDetail?: (booking: ITableBooking) => void,
): ColumnDef<ITableBooking>[] => {
  const { t } = useTranslation('tableBooking')

  return [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.createdAt')} />
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          {moment(row.original.createdAt).format('DD/MM/YYYY HH:mm')}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.name')} />
      ),
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.phone')} />
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">{row.original.phone}</div>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.email')} />
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">{row.original.email || '-'}</div>
      ),
    },
    {
      accessorKey: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.date')} />
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          {moment(row.original.date, 'DD/MM/YYYY HH:mm').format('DD/MM/YYYY HH:mm')}
        </div>
      ),
    },
    {
      accessorKey: 'seats',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.seats')} />
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">{row.original.seats ?? '-'}</div>
      ),
    },
    {
      accessorKey: 'table',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.table')} />
      ),
      cell: ({ row }) => (
        <div className="whitespace-nowrap">{row.original.table || '-'}</div>
      ),
    },
    {
      accessorKey: 'note',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.note')} />
      ),
      cell: ({ row }) => (
        <div
          className="max-w-[16rem] truncate"
          title={row.original.note ?? undefined}
        >
          {row.original.note || '-'}
        </div>
      ),
    },
    {
      id: 'statusBadge',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.status')} />
      ),
      cell: ({ row }) => <TableBookingStatusBadge status={row.original.status} />,
    },
    {
      id: 'statusAction',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.action')} />
      ),
      cell: ({ row }) => (
        <div className="flex gap-1 items-center">
          <BookingStatusAction booking={row.original} />
          {onViewDetail && (
            <Button
              variant="ghost"
              className="p-0 w-8 h-8"
              title={t('columns.viewDetail')}
              onClick={(e) => {
                // Keep the click from also firing the row's own
                // open-dialog handler (same dialog, avoids double-toggle).
                e.stopPropagation()
                onViewDetail(row.original)
              }}
            >
              <span className="sr-only">{t('columns.viewDetail')}</span>
              <Eye className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]
}
