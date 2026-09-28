import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  getVatLink,
  getVatRequestPublic,
  submitVatRequestPublic,
} from '@/api/vat'
import { QUERYKEY } from '@/constants'
import type { IVatSubmitRequest } from '@/types/vat.type'

/**
 * Mutation: đổi order.slug → VAT public URL (chứa invoiceSlug). Cashier
 * gọi mỗi khi mở dialog VAT cho 1 đơn cụ thể.
 */
export const useGetVatLink = () => {
  return useMutation({
    mutationFn: (orderSlug: string) => getVatLink(orderSlug),
  })
}

/**
 * Query: status public của invoice — AVAILABLE (chưa có VAT request) hoặc
 * SUBMITTED (đã có). Dialog dùng để gate UI: render form hay locked view.
 *
 * Enabled = !!invoiceSlug để không fetch sớm khi chưa có link.
 * staleTime: 0 + refetchOnMount: 'always' — luôn lấy fresh status khi mở
 * lại dialog (tránh race nếu cashier mở dialog trước, khách submit qua QR).
 */
export const useVatRequestStatus = (invoiceSlug: string | null | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.vatRequestPublic, invoiceSlug],
    queryFn: () => getVatRequestPublic(invoiceSlug!),
    enabled: !!invoiceSlug,
    staleTime: 0,
    refetchOnMount: 'always',
    select: (data) => data.result,
  })
}

/**
 * Mutation: cashier (hoặc khách qua public form) submit VAT request.
 * onSuccess invalidate status query → dialog refresh sang SubmittedView.
 */
export const useSubmitVatRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      invoiceSlug,
      body,
    }: {
      invoiceSlug: string
      body: IVatSubmitRequest
    }) => submitVatRequestPublic(invoiceSlug, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: [...QUERYKEY.vatRequestPublic, vars.invoiceSlug],
      })
    },
  })
}
