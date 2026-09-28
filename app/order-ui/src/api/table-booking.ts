import { http } from '@/utils'
import {
  IApiResponse,
  IPaginationResponse,
  ICreateTableBookingRequest,
  IUpdateTableBookingRequest,
  IGetTableBookingQuery,
  ITableBooking,
} from '@/types'

export async function createTableBooking(
  data: ICreateTableBookingRequest,
): Promise<IApiResponse<ITableBooking>> {
  const response = await http.post<IApiResponse<ITableBooking>>(
    '/table-booking',
    data,
  )
  return response.data
}

export async function getTableBookings(
  params: IGetTableBookingQuery,
): Promise<IApiResponse<IPaginationResponse<ITableBooking>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<ITableBooking>>>(
    '/table-booking',
    {
      params,
      doNotShowLoading: true,
    },
  )
  return response.data
}

export async function exportTableBookingsExcel(
  params: IGetTableBookingQuery,
): Promise<Blob> {
  const response = await http.get('/table-booking/export', {
    params,
    responseType: 'blob',
    headers: {
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    doNotShowLoading: true,
  })
  return response.data
}

export async function updateTableBooking(
  slug: string,
  data: IUpdateTableBookingRequest,
): Promise<IApiResponse<ITableBooking>> {
  const response = await http.patch<IApiResponse<ITableBooking>>(
    `/table-booking/${slug}`,
    data,
  )
  return response.data
}

export async function deleteTableBooking(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(
    `/table-booking/${slug}`,
  )
  return response.data
}
