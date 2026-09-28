import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  applyVoucher,
  createMultipleVoucher,
  createVoucher,
  createVoucherForUserGroup,
  createVoucherGroup,
  deleteVoucher,
  deleteVoucherForUserGroup,
  deleteVoucherPaymentMethod,
  getPublicVouchersForOrder,
  getSpecificPublicVoucher,
  getSpecificVoucher,
  getVoucherGroups,
  getVouchers,
  getVouchersForOrder,
  removeAppliedVoucher,
  updateVoucher,
  updateVoucherGroup,
  updateVoucherGroupApplyTime,
  updateVoucherPaymentMethod,
  validatePublicVoucher,
  validatePublicVoucherPaymentMethod,
  validateVoucher,
  validateVoucherPaymentMethod,
} from '@/api'
import { QUERYKEY } from '@/constants'
import {
  IApplyVoucherRequest,
  ICreateMultipleVoucherRequest,
  ICreateVoucherForUserGroupRequest,
  ICreateVoucherGroupRequest,
  ICreateVoucherRequest,
  IDeleteVoucherForUserGroupRequest,
  IGetAllVoucherGroupRequest,
  IGetAllVoucherRequest,
  IGetSpecificVoucherRequest,
  IRemoveAppliedVoucherRequest,
  IUpdateVoucherGroupApplyTimeRequest,
  IUpdateVoucherGroupRequest,
  IUpdateVoucherPaymentMethodParamToRequest,
  IUpdateVoucherRequest,
  IValidateVoucherPaymentMethodRequest,
  IValidateVoucherRequest,
} from '@/types'

export const useVoucherGroups = (params?: IGetAllVoucherGroupRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.voucherGroups, params],
    queryFn: () => getVoucherGroups(params),
    placeholderData: keepPreviousData,
    // enabled: !!params,
  })
}

export const useCreateVoucherGroup = () => {
  return useMutation({
    mutationFn: async (data: ICreateVoucherGroupRequest) => {
      return createVoucherGroup(data)
    },
  })
}

export const useUpdateVoucherGroup = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherGroupRequest) => {
      return updateVoucherGroup(data)
    },
  })
}

// vouchers for management
export const useVouchers = (params?: IGetAllVoucherRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchers, params],
    queryFn: () => getVouchers(params),
    placeholderData: keepPreviousData,
    enabled: !!params,
  })
}

// Vouchers for order
//
// staleTime: 0 + refetchOnMount: 'always' ensure that opening the sheet after
// any pause refetches the eligible list. Voucher status (remainingUsage,
// isActive, voucherProducts) changes frequently in production and cached data
// after even 1 minute can mislead the user. Combined with the 30s auto-revalidate
// poll these settings keep the sheet honest (case 11).
export const useVouchersForOrder = (
  params?: IGetAllVoucherRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchersForOrder, params],
    queryFn: () => getVouchersForOrder(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
export const usePublicVouchersForOrder = (
  params?: IGetAllVoucherRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchers, params],
    queryFn: () => getPublicVouchersForOrder(params),
    placeholderData: keepPreviousData,
    enabled: !!params && !!enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
export const useSpecificVoucher = (
  data: IGetSpecificVoucherRequest,
  enabled?: boolean,
) => {
  const isEnabled = enabled !== undefined 
    ? enabled && Boolean(data?.code || data?.slug)
    : Boolean(data?.code || data?.slug)
  return useQuery({
    queryKey: [QUERYKEY.specificVoucher, data],
    queryFn: () => getSpecificVoucher(data),
    enabled: isEnabled, // chỉ gọi khi có code hoặc slug và enabled = true (nếu được truyền)
  })
}

export const useSpecificPublicVoucher = (data: IGetSpecificVoucherRequest) => {
  return useQuery({
    queryKey: [QUERYKEY.vouchers, data],
    queryFn: () => getSpecificPublicVoucher(data),
    enabled: !!data.code,
  })
}

export const useCreateVoucher = () => {
  return useMutation({
    mutationFn: async (data: ICreateVoucherRequest) => {
      return createVoucher(data)
    },
  })
}

export const useCreateMultipleVoucher = () => {
  return useMutation({
    mutationFn: async (data: ICreateMultipleVoucherRequest) => {
      return createMultipleVoucher(data)
    },
  })
}

// Admin updates voucher config (voucherProducts, voucherPaymentMethods, isActive,
// dates, etc.). Customer-facing sheets cache eligible vouchers — without this
// invalidation, sheets opened after an admin change would render stale data
// until staleTime: 0 kicks in on next mount. We invalidate to be explicit.
export const useUpdateVoucher = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: IUpdateVoucherRequest) => {
      return updateVoucher(data)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERYKEY.vouchers })
      qc.invalidateQueries({ queryKey: QUERYKEY.vouchersForOrder })
      qc.invalidateQueries({ queryKey: QUERYKEY.specificVoucher })
    },
  })
}

export const useDeleteVoucher = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteVoucher(slug)
    },
  })
}

export const useValidateVoucher = () => {
  return useMutation({
    mutationFn: async (data: IValidateVoucherRequest) => {
      return validateVoucher(data)
    },
  })
}

export const useValidatePublicVoucher = () => {
  return useMutation({
    mutationFn: async (data: IValidateVoucherRequest) => {
      return validatePublicVoucher(data)
    },
  })
}

export const useValidateVoucherPaymentMethod = () => {
  return useMutation({
    mutationFn: async (data: IValidateVoucherPaymentMethodRequest) => {
      return validateVoucherPaymentMethod(data)
    },
  })
}

export const useValidatePublicVoucherPaymentMethod = () => {
  return useMutation({
    mutationFn: async (data: IValidateVoucherPaymentMethodRequest) => {
      return validatePublicVoucherPaymentMethod(data)
    },
  })
}

// Admin: apply / remove voucher → product mappings.
// onSettled invalidates the specific voucher (so its voucherProducts list
// refetches) and the parent voucher list (so list-wide counts realign).
export const useApplyVoucher = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: IApplyVoucherRequest) => {
      return applyVoucher(data)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERYKEY.specificVoucher })
      qc.invalidateQueries({ queryKey: QUERYKEY.vouchers })
    },
  })
}

export const useRemoveAppliedVoucher = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: IRemoveAppliedVoucherRequest) => {
      return removeAppliedVoucher(data)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERYKEY.specificVoucher })
      qc.invalidateQueries({ queryKey: QUERYKEY.vouchers })
    },
  })
}

export const useUpdateVoucherPaymentMethod = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherPaymentMethodParamToRequest) => {
      return updateVoucherPaymentMethod(data)
    },
  })
}

export const useDeleteVoucherPaymentMethod = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherPaymentMethodParamToRequest) => {
      return deleteVoucherPaymentMethod(data)
    },
  })
}

export const useCreateVoucherForUserGroup = () => {
  return useMutation({
    mutationFn: async (data: ICreateVoucherForUserGroupRequest) => {
      return createVoucherForUserGroup(data)
    },
  })
}

export const useDeleteVoucherForUserGroup = () => {
  return useMutation({
    mutationFn: async (data: IDeleteVoucherForUserGroupRequest) => {
      return deleteVoucherForUserGroup(data)
    },
  })
}

export const useUpdateVoucherGroupApplyTime = () => {
  return useMutation({
    mutationFn: async (data: IUpdateVoucherGroupApplyTimeRequest) => {
      return updateVoucherGroupApplyTime(data)
    },
  })
}
