import { ICardOrderGetRequest, ICardOrderResponse } from '@/types'
import { IPaginationResponse, IApiResponse } from '@/types'
import { http } from '@/utils'

export const getCardOrders = async (
  params?: ICardOrderGetRequest,
): Promise<IApiResponse<IPaginationResponse<ICardOrderResponse>>> => {
  const response = await http.get<
    IApiResponse<IPaginationResponse<ICardOrderResponse>>
  >('/card-order', {
    doNotShowLoading: true,
    params,
  })
  return response.data as IApiResponse<IPaginationResponse<ICardOrderResponse>>
}

export async function exportExcel(params: ICardOrderGetRequest): Promise<Blob> {
  const response = await http.get(`/card-order/export/excel`, {
    params,
    responseType: 'blob',
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    doNotShowLoading: true,
  })
  return response.data
}
