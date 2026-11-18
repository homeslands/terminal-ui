import { http, httpAuth } from '@/utils'
import {
  IAnalyzePointTransaction,
  IApiResponse,
  IMyPointTransactionQuery,
  IPaginationResponse,
  IPointTransaction,
  IPointTransactionQuery,
} from '@/types'

export async function getPointTransactions(
  params: IPointTransactionQuery | null,
): Promise<IApiResponse<IPaginationResponse<IPointTransaction>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IPointTransaction>>
  >('/point-transaction', {
    params,
  })
  return response.data
}

// Step 7.8 (cutover): the coin transactions of the signed-in user, read from
// shared-user (GET /point-transaction, the user comes from the JWT).
// getPointTransactions stays on terminal for the staff screens.
export async function getMyPointTransactions(
  params: IMyPointTransactionQuery | null,
): Promise<IApiResponse<IPaginationResponse<IPointTransaction>>> {
  const response = await httpAuth.get<
    IApiResponse<IPaginationResponse<IPointTransaction>>
  >('/point-transaction', {
    params,
  })
  return response.data
}

export async function analyzePointTransactions(
  params: IPointTransactionQuery | null,
): Promise<IApiResponse<IAnalyzePointTransaction>> {
  const response = await http.get<
    IApiResponse<IAnalyzePointTransaction>
  >('/point-transaction/analysis', {
    params,
  })
  return response.data
}

// Export all point transactions for a user
export async function exportAllPointTransactions(
  userSlug: string,
  fromDate?: string,
  toDate?: string,
  type?: string,
): Promise<Blob> {
  const response = await http.get(`/point-transaction/export/${userSlug}`, {
    params: { fromDate, toDate, type },
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}

export async function exportAllSystemPointTransactions(params: IPointTransactionQuery): Promise<Blob> {
  const response = await http.get(`/point-transaction/system/export`, {
    params,
    responseType: 'blob',
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    doNotShowLoading: true,
  })
  return response.data
}

// Export single point transaction by slug
export async function exportPointTransactionBySlug(slug: string): Promise<Blob> {
  const response = await http.get(`/point-transaction/export/specific/${slug}`, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}
