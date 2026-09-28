import { useMemo } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  getVatRequests,
  updateVatRequest,
  updateVatStatus,
} from '@/api/vat-admin'
import { QUERYKEY, VAT_PERMISSIONS } from '@/constants'
import { useUserStore } from '@/stores'
import type {
  IUpdateVatRequestBody,
  IUpdateVatStatusBody,
  IVatRequestListParams,
} from '@/types'

/**
 * List query. staleTime 30s + refetchOnMount: 'always' để khi user quay lại
 * tab vẫn fresh. Không polling — refresh button + auto invalidate sau mutation
 * là đủ.
 */
export const useVatRequests = (params: IVatRequestListParams) => {
  return useQuery({
    queryKey: [
      ...QUERYKEY.vatRequestsList,
      params.status ?? '',
      params.startDate ?? '',
      params.endDate ?? '',
      params.customerName ?? '',
      params.taxCode ?? '',
      params.email ?? '',
      params.invoiceNumber ?? '',
      params.referenceNumber ?? '',
      (params.sort ?? []).join(','),
      params.page,
      params.size,
    ],
    queryFn: () => getVatRequests(params),
    staleTime: 30_000,
    refetchOnMount: 'always',
    select: (data) => data.result,
  })
}

/** Bước 4 mutation — sửa info khách. Invalidate list để row refresh.
 *  `ignoreGlobalError`: local handler tự extract BE message thông qua
 *  onError prop để hiển thị toast cụ thể (vd "Email không hợp lệ") — tránh
 *  global toast generic fire trùng. */
export const useUpdateVatRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, body }: { slug: string; body: IUpdateVatRequestBody }) =>
      updateVatRequest(slug, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...QUERYKEY.vatRequestsList] })
    },
    meta: { ignoreGlobalError: true },
  })
}

/** Bước 7 mutation — chuyển trạng thái. */
export const useUpdateVatStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      slug,
      body,
    }: {
      slug: string
      body: IUpdateVatStatusBody
    }) => updateVatStatus(slug, body),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...QUERYKEY.vatRequestsList] })
    },
    meta: { ignoreGlobalError: true },
  })
}

/**
 * Permission gate fine-grained cho VAT admin sections.
 *
 * Pattern hybrid (chuẩn ngành):
 * - JWT scope.permissions → module-level (vd 'VAT_REQUEST') → dùng cho
 *   sidebar + route guard (rẻ, stateless).
 * - REST userInfo.role.permissions → action-level (vd 'VIEW_VAT_REQUEST',
 *   'EDIT_VAT_REQUEST') → dùng cho từng button trong section. Cùng pattern
 *   với check `DELETE_ORDER` trong order-history-columns.tsx:64.
 *
 * Khi userInfo chưa load (đang fetch profile) → tất cả false → button
 * disabled, an toàn.
 */
export const useHasVatPermission = () => {
  const { userInfo } = useUserStore()
  return useMemo(() => {
    const codes =
      userInfo?.role?.permissions
        ?.map((p) => p.authority?.code)
        .filter((c): c is string => !!c) ?? []
    return {
      canView: codes.includes(VAT_PERMISSIONS.VIEW),
      canEdit: codes.includes(VAT_PERMISSIONS.EDIT),
      canUpdateStatus: codes.includes(VAT_PERMISSIONS.UPDATE_STATUS),
    }
  }, [userInfo])
}
