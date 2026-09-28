import { http } from '@/utils'
import {
  IApiResponse,
  IOrder,
  ICreateOrderRequest,
  IInitiatePaymentRequest,
  ICreateOrderResponse,
  IPayment,
  ICreateOrderTrackingRequest,
  IOrderTracking,
  IOrderInvoice,
  IGetOrderInvoiceRequest,
  IPaginationResponse,
  IOrdersQuery,
  IAddNewOrderItemRequest,
  IUpdateOrderTypeRequest,
  IUpdateOrderItemRequest,
  IUpdateNoteRequest,
  IOrderItemsParam,
  IOrderItem,
  IDistanceAndDuration,
  IAddressDirection,
  IAddressByPlaceId,
  IAddressSuggestion,
  IGetPrinterEventsRequest,
  IPrinterEvent,
} from '@/types'
export async function getAllOrders(
  params: IOrdersQuery,
): Promise<IApiResponse<IPaginationResponse<IOrder>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<IOrder>>>(
    '/orders',
    {
      doNotShowLoading: true,
      params,
    },
  )
  return response.data
}

// public order
export async function getAllOrdersPublic(): Promise<IApiResponse<IOrder[]>> {
  const response = await http.get<IApiResponse<IOrder[]>>('/orders/public', {
    doNotShowLoading: true,
  })
  return response.data
}

export async function getOrderBySlug(
  slug: string,
): Promise<IApiResponse<IOrder>> {
  const response = await http.get<IApiResponse<IOrder>>(`/orders/${slug}`, {
    doNotShowLoading: true,
  })
  return response.data
}

export async function callCustomerToGetOrder(
  slug: string,
): Promise<IApiResponse<IOrder>> {
  const response = await http.post<IApiResponse<IOrder>>(
    `/orders/${slug}/call-customer-to-get-order`,
  )
  return response.data
}

export async function createOrder(
  params: ICreateOrderRequest,
): Promise<IApiResponse<ICreateOrderResponse>> {
  const response = await http.post<IApiResponse<ICreateOrderResponse>>(
    '/orders',
    params,
  )
  return response.data
}

export async function initiatePayment(
  params: IInitiatePaymentRequest,
): Promise<IApiResponse<IPayment>> {
  const response = await http.post<IApiResponse<IPayment>>(
    `/payment/initiate`,
    params,
  )
  return response.data
}

// public payment
export async function initiatePublicPayment(
  params: IInitiatePaymentRequest,
): Promise<IApiResponse<IPayment>> {
  const response = await http.post<IApiResponse<IPayment>>(
    `/payment/initiate/public`,
    params,
  )
  return response.data
}

export async function exportPaymentQRCode(slug: string): Promise<Blob> {
  const response = await http.post(`payment/${slug}/export`, null, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}

export async function autoPrintQRPayment(
  slug: string,
): Promise<IApiResponse<IPayment>> {
  const response = await http.post<IApiResponse<IPayment>>(
    `/payment/${slug}/export/auto`,
    {
      doNotShowLoading: true,
    },
  )
  return response.data
}

export async function autoPrintTemporaryPayment(
  slug: string,
): Promise<IApiResponse<IPayment>> {
  const response = await http.post<IApiResponse<IPayment>>(
    `/invoice/export/temporary/auto`,
    { order: slug },
  )
  return response.data
}

export async function createOrderTracking(
  params: ICreateOrderTrackingRequest,
): Promise<IApiResponse<IOrderTracking>> {
  const response = await http.post<IApiResponse<IOrderTracking>>(
    `/trackings`,
    params,
  )
  return response.data
}

export async function getOrderInvoice(
  params: IGetOrderInvoiceRequest,
): Promise<IApiResponse<IPaginationResponse<IOrderInvoice>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IOrderInvoice>>
  >('/invoice/specific', {
    params,
  })
  return response.data
}

export async function getOrderProvisionalBill(slug: string): Promise<Blob> {
  const response = await http.post(
    `/invoice/export/temporary`,
    { order: slug },
    {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      doNotShowLoading: true,
    },
  )
  return response.data
}

// public order invoice
export async function getPublicOrderInvoice(order: string): Promise<Blob> {
  const response = await http.get(`/invoice/specific/public`, {
    params: { order },
    responseType: 'blob',
  })
  return response.data
}

export async function exportOrderInvoice(order: string): Promise<Blob> {
  const response = await http.post(
    `/invoice/export`,
    { order },
    {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      doNotShowLoading: true,
    },
  )
  return response.data
}

// public order invoice
export async function exportPublicOrderInvoice(order: string): Promise<Blob> {
  const response = await http.post(
    `/invoice/export/public`,
    { order },
    {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      doNotShowLoading: true,
    },
  )
  return response.data
}

//Update order
export async function addNewOrderItem(
  params: IAddNewOrderItemRequest,
): Promise<IApiResponse<IOrderItem>> {
  const response = await http.post<IApiResponse<IOrderItem>>(
    `/order-items`,
    params,
  )
  return response.data
}

export async function addNewMultipleOrderItems(
  items: IAddNewOrderItemRequest[],
): Promise<IApiResponse<IOrderItem[]>> {
  const response = await http.post<IApiResponse<IOrderItem[]>>(
    `/order-items/batch`,
    {
      orderItems: items,
    },
  )
  return response.data
}

export async function deleteOrderItem(
  slug: string,
): Promise<IApiResponse<IOrderItem>> {
  const response = await http.delete<IApiResponse<IOrderItem>>(
    `/order-items/${slug}`,
  )
  return response.data
}

// update voucher
export async function updateVoucherInOrder(
  slug: string,
  voucher: string | null, // voucher: null for remove voucher
  orderItems: IOrderItemsParam[],
): Promise<IApiResponse<IOrder>> {
  const response = await http.patch<IApiResponse<IOrder>>(
    `/orders/${slug}/voucher`,
    { voucher, orderItems },
  )
  return response.data
}

export async function updatePublicVoucherInOrder(
  slug: string,
  voucher: string | null,
  orderItems: IOrderItemsParam[],
): Promise<IApiResponse<IOrder>> {
  const response = await http.patch<IApiResponse<IOrder>>(
    `/orders/${slug}/voucher/public`,
    { voucher, orderItems },
  )
  return response.data
}

export async function updateOrderType(
  slug: string,
  params: IUpdateOrderTypeRequest,
): Promise<IApiResponse<IOrder>> {
  const response = await http.patch<IApiResponse<IOrder>>(
    `/orders/${slug}`,
    params,
  )
  return response.data
}
export async function updateOrderItem(
  slug: string,
  data: IUpdateOrderItemRequest,
): Promise<IApiResponse<IOrder>> {
  const response = await http.patch<IApiResponse<IOrder>>(
    `/order-items/${slug}`,
    data,
  )
  return response.data
}
export async function updateNoteOrderItem(
  slug: string,
  data: IUpdateNoteRequest,
): Promise<IApiResponse<IOrder>> {
  const response = await http.patch<IApiResponse<IOrder>>(
    `/order-items/${slug}/note`,
    data,
  )
  return response.data
}

export async function deleteOrder(slug: string): Promise<IApiResponse<IOrder>> {
  const response = await http.delete<IApiResponse<IOrder>>(`/orders/${slug}`)
  return response.data
}

// order without login
export async function createOrderWithoutLogin(
  params: ICreateOrderRequest,
): Promise<IApiResponse<ICreateOrderResponse>> {
  const response = await http.post<IApiResponse<ICreateOrderResponse>>(
    '/orders/public',
    params,
  )
  return response.data
}

// get all order without login
export async function getAllOrderWithoutLogin(): Promise<
  IApiResponse<IOrder[]>
> {
  const response = await http.get<IApiResponse<IOrder[]>>(`/orders/public`)
  return response.data
}

// delete order without login
export async function deleteOrderWithoutLogin(
  slug: string,
): Promise<IApiResponse<IOrder>> {
  const response = await http.delete<IApiResponse<IOrder>>(
    `/orders/${slug}/public`,
  )
  return response.data
}

// Printer job
export async function getPrinterEvents({
  params,
}: {
  params?: IGetPrinterEventsRequest
}): Promise<IApiResponse<IPaginationResponse<IPrinterEvent>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IPrinterEvent>>
  >(`/printer/events`, { params })
  return response.data
}
// google map
export async function getAddressSuggestions(
  address: string,
): Promise<IApiResponse<IAddressSuggestion[]>> {
  const safeAddress = encodeURIComponent(address) // <--- encode trước khi đưa vào URL

  const response = await http.get<IApiResponse<IAddressSuggestion[]>>(
    `/orders/delivery/address/suggestion/${safeAddress}`,
    {
      doNotShowLoading: true,
    },
  )

  return response.data
}

export async function getAddressByPlaceId(
  placeId: string,
): Promise<IApiResponse<IAddressByPlaceId>> {
  const response = await http.get<IApiResponse<IAddressByPlaceId>>(
    `/orders/delivery/location/${placeId}`,
    {
      doNotShowLoading: true,
    },
  )

  return response.data
}

export async function getAddressDirection(
  branch: string,
  lat: number,
  lng: number,
): Promise<IApiResponse<IAddressDirection>> {
  const response = await http.get<IApiResponse<IAddressDirection>>(
    `/orders/delivery/direction`,
    {
      params: {
        branch,
        lat,
        lng,
      },
      doNotShowLoading: true,
    },
  )

  return response.data
}

export async function getDistanceAndDuration(
  branch: string,
  lat: number,
  lng: number,
): Promise<IApiResponse<IDistanceAndDuration>> {
  const response = await http.get<IApiResponse<IDistanceAndDuration>>(
    `/orders/delivery/distance-and-duration`,
    {
      params: {
        branch,
        lat,
        lng,
      },
    },
  )

  return response.data
}

export async function getActiveOrderByTable(
  tableSlug: string,
): Promise<IApiResponse<IOrder | null>> {
  const response = await http.get<IApiResponse<IOrder | null>>(
    `/orders/table/${tableSlug}/active`,
    {
      doNotShowLoading: true,
    },
  )

  return response.data
}

export async function changeOrderTable(
  orderSlug: string,
  newTable: string,
): Promise<IApiResponse<IOrder>> {
  const response = await http.patch<IApiResponse<IOrder>>(
    `/orders/${orderSlug}/change-table`,
    { newTable },
  )

  return response.data
}

export async function changeOrderOwner(
  slug: string,
  owner: string,
): Promise<IApiResponse<IOrder>> {
  const response = await http.patch<IApiResponse<IOrder>>(
    `/orders/${slug}/owner`,
    { owner },
  )

  return response.data
}
