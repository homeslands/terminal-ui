import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addNewOrderItem,
  createOrder,
  createOrderTracking,
  deleteOrder,
  deleteOrderItem,
  exportOrderInvoice,
  exportPaymentQRCode,
  getAllOrders,
  getOrderBySlug,
  getOrderInvoice,
  initiatePayment,
  updateOrderType,
  createOrderWithoutLogin,
  deleteOrderWithoutLogin,
  exportPublicOrderInvoice,
  getAllOrdersPublic,
  getAllOrderWithoutLogin,
  getPublicOrderInvoice,
  initiatePublicPayment,
  updateNoteOrderItem,
  updateOrderItem,
  updateVoucherInOrder,
  getOrderProvisionalBill,
  updatePublicVoucherInOrder,
  getAddressDirection,
  getDistanceAndDuration,
  getAddressByPlaceId,
  getAddressSuggestions,
  callCustomerToGetOrder,
  getPrinterEvents,
  reprintFailedInvoicePrinterJobs,
  autoPrintQRPayment,
  autoPrintTemporaryPayment,
  getActiveOrderByTable,
  changeOrderTable,
  changeOrderOwner,
  addNewMultipleOrderItems,
} from '@/api'
import {
  ICreateOrderRequest,
  IInitiatePaymentRequest,
  ICreateOrderTrackingRequest,
  IGetOrderInvoiceRequest,
  IOrdersQuery,
  IAddNewOrderItemRequest,
  IUpdateOrderTypeRequest,
  IUpdateOrderItemRequest,
  IUpdateNoteRequest,
  IOrderItemsParam,
  IGetPrinterEventsRequest,
} from '@/types'
import { QUERYKEY } from '@/constants'

export const useOrders = (
  q: IOrdersQuery,
  options?: { refetchInterval?: number; enabled?: boolean },
) => {
  return useQuery({
    queryKey: [...QUERYKEY.orders, q],
    queryFn: () => getAllOrders(q),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  })
}

/**
 * Fetch active (status=pending) orders for a branch. Used by the floor plan
 * to derive cross-device order info on TableCard. Disabled when `branch` is
 * empty (no-op render before user info loads).
 */
export const useActiveOrdersByBranch = (
  branch: string | undefined,
  options?: { refetchInterval?: number },
) => {
  const safeBranch = branch ?? ''
  return useOrders(
    {
      branch: safeBranch,
      status: 'pending',
      hasPaging: false,
      page: 1,
      size: 200,
      order: 'DESC',
    },
    {
      refetchInterval: options?.refetchInterval,
      enabled: !!safeBranch,
    },
  )
}

export const useOrdersPublic = () => {
  return useQuery({
    queryKey: QUERYKEY.ordersPublic,
    queryFn: () => getAllOrdersPublic(),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
  })
}

// Hook
export const useOrderBySlug = (slug: string | null | undefined) => {
  const isValidSlug = !!slug?.trim()

  return useQuery({
    queryKey: [...QUERYKEY.order, slug],
    queryFn: () => getOrderBySlug(slug!), // dùng ! vì đã kiểm tra ở trên
    enabled: isValidSlug, // ✅ Chặn không fetch nếu slug không hợp lệ
    placeholderData: keepPreviousData,
    select: (data) => data.result,
  })
}

export const useCallCustomerToGetOrder = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return callCustomerToGetOrder(slug)
    },
  })
}

export const useCreateOrder = () => {
  return useMutation({
    mutationFn: async (data: ICreateOrderRequest) => {
      return createOrder(data)
    },
  })
}

export const useInitiatePayment = () => {
  return useMutation({
    mutationFn: async (data: IInitiatePaymentRequest) => {
      return initiatePayment(data)
    },
    meta: { ignoreGlobalError: true },
  })
}

export const useInitiatePublicPayment = () => {
  return useMutation({
    mutationFn: async (data: IInitiatePaymentRequest) => {
      return initiatePublicPayment(data)
    },
    meta: { ignoreGlobalError: true },
  })
}

export const useAutoPrintQRPayment = () => {
  return useMutation({
    mutationFn: async (slug : string) => {
      return autoPrintQRPayment(slug)
    },
  })
}

export const useAutoPrintTemporaryPayment = () => {
  return useMutation({
    mutationFn: async (slug : string) => {
      return autoPrintTemporaryPayment(slug)
    },
  })
}

export const useCreateOrderTracking = () => {
  return useMutation({
    mutationFn: async (data: ICreateOrderTrackingRequest) => {
      return createOrderTracking(data)
    },
  })
}

export const useGetOrderInvoice = (params: IGetOrderInvoiceRequest) => {
  return useQuery({
    queryKey: [...QUERYKEY.orderInvoice, params],
    queryFn: () => getOrderInvoice(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
  })
}

export const useGetPublicOrderInvoice = (order: string) => {
  return useQuery({
    queryKey: [...QUERYKEY.publicOrderInvoice, order],
    queryFn: () => getPublicOrderInvoice(order),
  })
}

export const useExportOrderInvoice = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return exportOrderInvoice(slug)
    },
  })
}

export const useExportPublicOrderInvoice = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return exportPublicOrderInvoice(slug)
    },
  })
}

export const useExportPayment = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return exportPaymentQRCode(slug)
    },
  })
}

export const useGetOrderProvisionalBill = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return getOrderProvisionalBill(slug)
    },
  })
}

//Update order
export const useAddNewOrderItem = () => {
  return useMutation({
    mutationFn: async (data: IAddNewOrderItemRequest) => {
      return addNewOrderItem(data)
    },
  })
}

export const useAddNewMultipleOrderItems = () => {
  return useMutation({
    mutationFn: async (items: IAddNewOrderItemRequest[]) => {
      return addNewMultipleOrderItems(items)
    },
  })
}

export const useUpdateOrderItem = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      data,
    }: {
      slug: string
      data: IUpdateOrderItemRequest
    }) => {
      return updateOrderItem(slug, data)
    },
  })
}

export const useUpdateNoteOrderItem = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      data,
    }: {
      slug: string
      data: IUpdateNoteRequest
    }) => {
      return updateNoteOrderItem(slug, data)
    },
  })
}

export const useDeleteOrderItem = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteOrderItem(slug)
    },
  })
}

// update voucher
//
// Optimistic update strategy:
// - onMutate: snapshot the cached order, mark voucher = null/{slug} locally so
//   the sheet UI reflects the change immediately.
// - onError: restore the snapshot (rollback) — the global MutationCache error
//   handler will still surface the toast.
// - onSettled: invalidate order + eligible-voucher caches so a refetch realigns
//   the UI with the server's source of truth.
export const useUpdateVoucherInOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      slug,
      voucher,
      orderItems,
    }: {
      slug: string
      voucher: string | null
      orderItems: IOrderItemsParam[]
    }) => {
      return updateVoucherInOrder(slug, voucher, orderItems)
    },
    onMutate: async ({ slug, voucher }) => {
      const key = [...QUERYKEY.order, slug]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(
        key,
        (old: { result?: { voucher?: unknown } } | undefined) => {
          if (!old?.result) return old
          return {
            ...old,
            result: { ...old.result, voucher: voucher === null ? null : old.result.voucher },
          }
        },
      )
      return { prev, key }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: (_data, _err, { slug }) => {
      qc.invalidateQueries({ queryKey: [...QUERYKEY.order, slug] })
      qc.invalidateQueries({ queryKey: QUERYKEY.vouchersForOrder })
    },
  })
}

export const useUpdatePublicVoucherInOrder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      slug,
      voucher,
      orderItems,
    }: {
      slug: string
      voucher: string | null
      orderItems: IOrderItemsParam[]
    }) => {
      return updatePublicVoucherInOrder(slug, voucher, orderItems)
    },
    onMutate: async ({ slug, voucher }) => {
      const key = [...QUERYKEY.order, slug]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(
        key,
        (old: { result?: { voucher?: unknown } } | undefined) => {
          if (!old?.result) return old
          return {
            ...old,
            result: { ...old.result, voucher: voucher === null ? null : old.result.voucher },
          }
        },
      )
      return { prev, key }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: (_data, _err, { slug }) => {
      qc.invalidateQueries({ queryKey: [...QUERYKEY.order, slug] })
      qc.invalidateQueries({ queryKey: QUERYKEY.vouchers })
    },
  })
}

//Update order type
export const useUpdateOrderType = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      params,
    }: {
      slug: string
      params: IUpdateOrderTypeRequest
    }) => {
      return updateOrderType(slug, params)
    },
  })
}

//Delete order
export const useDeleteOrder = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteOrder(slug)
    },
  })
}

export const useDeletePublicOrder = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteOrderWithoutLogin(slug)
    },
  })
}

// order without login
export const useCreateOrderWithoutLogin = () => {
  return useMutation({
    mutationFn: async (data: ICreateOrderRequest) => {
      return createOrderWithoutLogin(data)
    },
  })
}

export const useGetAllOrderWithoutLogin = () => {
  return useQuery({
    queryKey: QUERYKEY.ordersWithoutLogin,
    queryFn: () => getAllOrderWithoutLogin(),
  })
}

export const useReprintFailedInvoicePrinterJobs = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return reprintFailedInvoicePrinterJobs(slug)
    },
  })
}

export const useGetAddressSuggestions = (address: string) => {
  return useQuery({
    queryKey: [QUERYKEY.addressSuggestions, address],
    queryFn: () => getAddressSuggestions(address),
    enabled: !!address,
  })
}

export const useGetAddressByPlaceId = (placeId: string) => {
  return useQuery({
    queryKey: [QUERYKEY.addressByPlaceId, placeId],
    queryFn: () => getAddressByPlaceId(placeId),
    enabled: !!placeId,
  })
}

export const useGetAddressDirection = (
  branch: string,
  lat: number,
  lng: number,
) => {
  return useQuery({
    queryKey: [QUERYKEY.addressDirection, branch, lat, lng],
    queryFn: () => getAddressDirection(branch, lat, lng),
    enabled: !!branch && !!lat && !!lng,
  })
}

export const useGetDistanceAndDuration = (
  branch: string,
  lat: number,
  lng: number,
) => {
  return useQuery({
    queryKey: [QUERYKEY.distanceAndDuration, branch, lat, lng],
    queryFn: () => getDistanceAndDuration(branch, lat, lng),
    enabled: !!branch && !!lat && !!lng,
  })
}

export const useGetPrinterEvents = (params?: IGetPrinterEventsRequest) => {
  // Tách page và size ra khỏi params để dùng cho pagination
  const { page: _, size: __, ...baseParams } = params || {}
  const pageSize = params?.size || 10

  return useInfiniteQuery({
    queryKey: [QUERYKEY.printerEvents, baseParams],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await getPrinterEvents({
        params: {
          ...baseParams,
          page: pageParam as number,
          size: pageSize,
        },
      })

      // Response có cấu trúc: { result: { items: IPrinterEvent[], hasNext, page, ... } }
      return response
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage?.result && typeof lastPage.result === 'object' && 'hasNext' in lastPage.result) {
        const paginationResult = lastPage.result as { hasNext: boolean; page: number }
        return paginationResult.hasNext ? paginationResult.page + 1 : undefined
      }
      return undefined
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  })
}

export const useGetActiveOrderByTable = (tableSlug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.activeOrderByTable, tableSlug],
    queryFn: () => getActiveOrderByTable(tableSlug),
    enabled: !!tableSlug,
    placeholderData: keepPreviousData,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    select: (data) => data.result,
  })
}

export const useChangeOrderTable = () => {
  return useMutation({
    mutationFn: async ({
      orderSlug,
      newTable,
    }: {
      orderSlug: string
      newTable: string
    }) => {
      return changeOrderTable(orderSlug, newTable)
    },
  })
}

export const useChangeOrderOwner = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      owner,
    }: {
      slug: string
      owner: string
    }) => {
      return changeOrderOwner(slug, owner)
    },
  })
}
