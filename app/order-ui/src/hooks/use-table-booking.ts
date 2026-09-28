import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { QUERYKEY } from '@/constants'
import {
  createTableBooking,
  getTableBookings,
  exportTableBookingsExcel,
  updateTableBooking,
  deleteTableBooking,
} from '@/api'
import {
  ICreateTableBookingRequest,
  IGetTableBookingQuery,
  IUpdateTableBookingRequest,
} from '@/types'

// Client-side booking submission (public POST /table-booking).
export const useCreateTableBooking = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ICreateTableBookingRequest) => {
      return createTableBooking(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERYKEY.tableBookings })
    },
  })
}

// Staff-side list (GET /table-booking).
export const useTableBookings = (params: IGetTableBookingQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.tableBookings, params],
    queryFn: () => getTableBookings(params),
  })
}

// Staff-side Excel export of the filtered list (GET /table-booking/export).
export const useExportTableBookingsExcel = () => {
  return useMutation({
    mutationFn: async (params: IGetTableBookingQuery) => {
      return exportTableBookingsExcel(params)
    },
    onSuccess: (blob) => {
      const currentDate = new Date().toISOString().split('T')[0]
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `table-booking-${currentDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}

// Staff-side update incl. status change (PATCH /table-booking/{slug}).
export const useUpdateTableBooking = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      slug,
      data,
    }: {
      slug: string
      data: IUpdateTableBookingRequest
    }) => {
      return updateTableBooking(slug, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERYKEY.tableBookings })
    },
  })
}

// Staff-side delete (DELETE /table-booking/{slug}).
export const useDeleteTableBooking = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteTableBooking(slug)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERYKEY.tableBookings })
    },
  })
}
