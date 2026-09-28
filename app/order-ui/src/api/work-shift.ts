import { http } from '@/utils'
import type {
  IApiResponse,
  ICloseWorkShiftRequest,
  IForceCloseWorkShiftRequest,
  IOpenWorkShiftRequest,
  IOrder,
  IWorkShift,
  IWorkShiftInvoice,
  IWorkShiftListQuery,
  IWorkShiftPage,
  IWorkShiftStaffSummaryItem,
  IWorkShiftSummary,
} from '@/types'

// ---------- Cashier ----------

export async function openWorkShift(
  params: IOpenWorkShiftRequest,
): Promise<IApiResponse<IWorkShift>> {
  const response = await http.post<IApiResponse<IWorkShift>>(
    '/work-shifts/open',
    params,
  )
  return response.data
}

export async function closeWorkShift(
  params: ICloseWorkShiftRequest,
): Promise<IApiResponse<IWorkShiftSummary>> {
  const response = await http.patch<IApiResponse<IWorkShiftSummary>>(
    '/work-shifts/close',
    params,
  )
  return response.data
}

export async function getCurrentWorkShift(): Promise<IApiResponse<IWorkShift>> {
  const response = await http.get<IApiResponse<IWorkShift>>(
    '/work-shifts/current',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentWorkShiftOrders(): Promise<
  IApiResponse<IOrder[]>
> {
  const response = await http.get<IApiResponse<IOrder[]>>(
    '/work-shifts/current/orders',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentWorkShiftInvoices(): Promise<
  IApiResponse<IWorkShiftInvoice[]>
> {
  const response = await http.get<IApiResponse<IWorkShiftInvoice[]>>(
    '/work-shifts/current/invoices',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentWorkShiftStaff(): Promise<
  IApiResponse<IWorkShiftStaffSummaryItem[]>
> {
  const response = await http.get<IApiResponse<IWorkShiftStaffSummaryItem[]>>(
    '/work-shifts/current/staff',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentWorkShiftSummary(): Promise<
  IApiResponse<IWorkShiftSummary>
> {
  const response = await http.get<IApiResponse<IWorkShiftSummary>>(
    '/work-shifts/current/summary',
    { doNotShowLoading: true },
  )
  return response.data
}

// ---------- Manager / Admin ----------

export async function getActiveWorkShifts(
  branchSlug?: string,
): Promise<IApiResponse<IWorkShift[]>> {
  const response = await http.get<IApiResponse<IWorkShift[]>>(
    '/work-shifts/active',
    {
      params: branchSlug ? { branchSlug } : undefined,
      doNotShowLoading: true,
    },
  )
  return response.data
}

export async function forceCloseWorkShift(
  slug: string,
  params: IForceCloseWorkShiftRequest,
): Promise<IApiResponse<IWorkShiftSummary>> {
  const response = await http.patch<IApiResponse<IWorkShiftSummary>>(
    `/work-shifts/${slug}/force-close`,
    params,
  )
  return response.data
}

// ---------- Dùng chung ----------

export async function getWorkShifts(
  query: IWorkShiftListQuery,
): Promise<IApiResponse<IWorkShiftPage<IWorkShift>>> {
  const response = await http.get<IApiResponse<IWorkShiftPage<IWorkShift>>>(
    '/work-shifts',
    { params: query, doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftBySlug(
  slug: string,
): Promise<IApiResponse<IWorkShift>> {
  const response = await http.get<IApiResponse<IWorkShift>>(
    `/work-shifts/${slug}`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftOrders(
  slug: string,
): Promise<IApiResponse<IOrder[]>> {
  const response = await http.get<IApiResponse<IOrder[]>>(
    `/work-shifts/${slug}/orders`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftInvoices(
  slug: string,
): Promise<IApiResponse<IWorkShiftInvoice[]>> {
  const response = await http.get<IApiResponse<IWorkShiftInvoice[]>>(
    `/work-shifts/${slug}/invoices`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftStaff(
  slug: string,
): Promise<IApiResponse<IWorkShiftStaffSummaryItem[]>> {
  const response = await http.get<IApiResponse<IWorkShiftStaffSummaryItem[]>>(
    `/work-shifts/${slug}/staff`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftSummary(
  slug: string,
): Promise<IApiResponse<IWorkShiftSummary>> {
  const response = await http.get<IApiResponse<IWorkShiftSummary>>(
    `/work-shifts/${slug}/summary`,
    { doNotShowLoading: true },
  )
  return response.data
}
