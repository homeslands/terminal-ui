import { http } from '@/utils'
import {
  IApiResponse,
} from '@/types'
import { CardOrderRevenue, ICardOrderRevenueQuery } from '@/types/card-order-revenue.type'

export async function getAllCardOrderRevenueApi(
  params: ICardOrderRevenueQuery,
): Promise<IApiResponse<CardOrderRevenue[]>> {
  const response = await http.get<IApiResponse<CardOrderRevenue[]>>('/card-order-revenue', {
    params,
  })
  return response.data
}

export async function exportAllCardOrderRevenueApi(params: ICardOrderRevenueQuery): Promise<Blob> {
  const response = await http.post(`/card-order-revenue/export/excel`, { ...params }, {
    responseType: 'blob',
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    doNotShowLoading: true,
  })
  return response.data
}

export async function exportPdfCardOrderRevenueApi(params: ICardOrderRevenueQuery): Promise<Blob> {
  const response = await http.post(`/card-order-revenue/export/pdf`, { ...params }, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}