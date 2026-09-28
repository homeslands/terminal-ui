import http from '@/utils/http'
import type {
  IApiResponse,
  IUpdateVatRequestBody,
  IUpdateVatStatusBody,
  IVatRequestListItem,
  IVatRequestListParams,
  IVatRequestListResponse,
} from '@/types'

/**
 * GET /vat-request — paginated list. BE chỉ accept 1 status per request.
 * UI single-select (PENDING / PROCESSING / COMPLETED / REJECTED / undefined=all).
 */
export async function getVatRequests(
  params: IVatRequestListParams,
): Promise<IApiResponse<IVatRequestListResponse>> {
  const queryParams: Record<string, unknown> = {
    page: params.page,
    size: params.size,
  }
  if (params.status) queryParams.status = params.status
  if (params.startDate) queryParams.startDate = params.startDate
  if (params.endDate) queryParams.endDate = params.endDate
  if (params.customerName) queryParams.customerName = params.customerName
  if (params.taxCode) queryParams.taxCode = params.taxCode
  if (params.email) queryParams.email = params.email
  if (params.invoiceNumber) queryParams.invoiceNumber = params.invoiceNumber
  if (params.referenceNumber !== undefined)
    queryParams.referenceNumber = params.referenceNumber
  if (params.sort && params.sort.length > 0) queryParams.sort = params.sort

  const response = await http.get<IApiResponse<IVatRequestListResponse>>(
    '/vat-request',
    { params: queryParams },
  )
  return response.data
}

/** Bước 4 — Manager+ sửa info khách. */
export async function updateVatRequest(
  slug: string,
  body: IUpdateVatRequestBody,
): Promise<IApiResponse<IVatRequestListItem>> {
  const response = await http.patch<IApiResponse<IVatRequestListItem>>(
    `/vat-request/${slug}`,
    body,
  )
  return response.data
}

/** Bước 7 — Chuyển trạng thái workflow. */
export async function updateVatStatus(
  slug: string,
  body: IUpdateVatStatusBody,
): Promise<IApiResponse<IVatRequestListItem>> {
  const response = await http.patch<IApiResponse<IVatRequestListItem>>(
    `/vat-request/${slug}/status`,
    body,
  )
  return response.data
}
