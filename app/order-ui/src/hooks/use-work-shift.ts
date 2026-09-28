import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  closeWorkShift,
  forceCloseWorkShift,
  getActiveWorkShifts,
  getCurrentWorkShift,
  getCurrentWorkShiftInvoices,
  getCurrentWorkShiftOrders,
  getCurrentWorkShiftStaff,
  getCurrentWorkShiftSummary,
  getWorkShiftBySlug,
  getWorkShiftInvoices,
  getWorkShiftOrders,
  getWorkShifts,
  getWorkShiftStaff,
  getWorkShiftSummary,
  openWorkShift,
} from '@/api/work-shift'
import { QUERYKEY, WORK_SHIFT_ERROR_CODE } from '@/constants'
import { getApiErrorCode } from '@/lib/api-error'
import type {
  IApiResponse,
  ICloseWorkShiftRequest,
  IForceCloseWorkShiftRequest,
  IOpenWorkShiftRequest,
  IWorkShift,
  IWorkShiftListQuery,
} from '@/types'

/**
 * "Chưa mở ca" là một câu trả lời xác định, không phải lỗi hạ tầng — BE có thể
 * biểu đạt nó bằng 404 (spec §5.3) HOẶC 400 mã 161002 (spec §6). Mọi 4xx đều
 * xác định: retry không đổi được kết quả, chỉ kéo dài trạng thái loading và làm
 * màn hình nhấp nháy skeleton↔modal trong lúc backoff. Chỉ retry lỗi tạm
 * thời/5xx, tối đa 2 lần. Dùng chung cho mọi query /work-shifts/current*.
 */
const retryExceptClientError = (failureCount: number, error: unknown) => {
  const status =
    (error as { status?: number })?.status ??
    (error as { response?: { status?: number } })?.response?.status
  if (typeof status === 'number' && status >= 400 && status < 500) return false
  return failureCount < 2
}

// ---------- Cashier: ca hiện tại ----------

/**
 * "Không có ca ACTIVE" là một GIÁ TRỊ (thu ngân chưa mở, hoặc vừa đóng ca), không
 * phải lỗi — BE biểu đạt nó bằng 400/161002 hoặc 404/161000. Nếu để nguyên là
 * lỗi query, React Query GIỮ LẠI `data` của lần fetch thành công trước đó (ca vừa
 * đóng), nên badge header kẹt ở "Đang mở" sau khi đóng ca. Nuốt đúng hai mã này
 * và trả result null để mọi consumer lật về "Chưa mở ca"; lỗi khác (403, 5xx,
 * mạng) vẫn ném ra bình thường.
 */
async function fetchCurrentWorkShiftOrNull(): Promise<IApiResponse<IWorkShift | null>> {
  try {
    return await getCurrentWorkShift()
  } catch (error) {
    const code = getApiErrorCode(error)
    if (
      code === WORK_SHIFT_ERROR_CODE.NO_ACTIVE ||
      code === WORK_SHIFT_ERROR_CODE.NOT_FOUND
    ) {
      return { result: null } as IApiResponse<IWorkShift | null>
    }
    throw error
  }
}

export const useCurrentWorkShift = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrent],
    queryFn: () => fetchCurrentWorkShiftOrNull(),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
  })
}

export const useCurrentWorkShiftOrders = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrentOrders],
    queryFn: () => getCurrentWorkShiftOrders(),
    enabled,
    refetchInterval: 20_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
    placeholderData: keepPreviousData,
  })
}

export const useCurrentWorkShiftInvoices = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrentInvoices],
    queryFn: () => getCurrentWorkShiftInvoices(),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
    placeholderData: keepPreviousData,
  })
}

export const useCurrentWorkShiftStaff = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrentStaff],
    queryFn: () => getCurrentWorkShiftStaff(),
    enabled,
    refetchInterval: 60_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
  })
}

export const useCurrentWorkShiftSummary = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrentSummary],
    queryFn: () => getCurrentWorkShiftSummary(),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
  })
}

// ---------- Cashier: mutation ----------

/** Danh sách query cần invalidate sau khi mở/đóng ca. */
const CURRENT_SHIFT_KEYS = [
  QUERYKEY.workShiftCurrent,
  QUERYKEY.workShiftCurrentOrders,
  QUERYKEY.workShiftCurrentInvoices,
  QUERYKEY.workShiftCurrentStaff,
  QUERYKEY.workShiftCurrentSummary,
  QUERYKEY.workShiftsActive,
  QUERYKEY.workShifts,
]

export const useOpenWorkShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: IOpenWorkShiftRequest) => openWorkShift(data),
    meta: { ignoreGlobalError: true },
    onSuccess: () => {
      CURRENT_SHIFT_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [...key] }),
      )
    },
  })
}

export const useCloseWorkShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ICloseWorkShiftRequest) => closeWorkShift(data),
    meta: { ignoreGlobalError: true },
    onSuccess: () => {
      CURRENT_SHIFT_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [...key] }),
      )
    },
  })
}

export const useForceCloseWorkShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      slug,
      data,
    }: {
      slug: string
      data: IForceCloseWorkShiftRequest
    }) => forceCloseWorkShift(slug, data),
    meta: { ignoreGlobalError: true },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.workShiftsActive] })
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.workShifts] })
      queryClient.invalidateQueries({
        queryKey: [...QUERYKEY.workShiftBySlug, variables.slug],
      })
      queryClient.invalidateQueries({
        queryKey: [...QUERYKEY.workShiftSummary, variables.slug],
      })
    },
  })
}

// ---------- Manager / Admin ----------

export const useActiveWorkShifts = (
  branchSlug?: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftsActive, branchSlug ?? null],
    queryFn: () => getActiveWorkShifts(branchSlug),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

// ---------- Dùng chung ----------

export const useWorkShifts = (
  query: IWorkShiftListQuery,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShifts, query],
    queryFn: () => getWorkShifts(query),
    enabled,
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

// Slug-scoped queries: a 4xx here (403 FORBIDDEN / 404 NOT_FOUND) is NOT an
// expected steady state, so — unlike the /current* queries — we DO surface it.
// BE returns a real HTTP 4xx (e.g. 400 { statusCode: 161002 }, 403 161004),
// so retryExceptClientError settles on the first attempt: no ~7s spinner from
// react-query's default 3 retries before the error state/toast appears.
//
// Only useWorkShiftBySlug lets the global QueryCache toast the mapped 161xxx
// message (one toast). The four sub-list queries fire the same slug and would
// each toast the identical error — so they set ignoreGlobalError to stay
// silent; the detail page's visible error state (driven by bySlug) is the UX.
export const useWorkShiftBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftBySlug, slug],
    queryFn: () => getWorkShiftBySlug(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    retry: retryExceptClientError,
  })
}

export const useWorkShiftOrders = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftOrders, slug],
    queryFn: () => getWorkShiftOrders(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
    placeholderData: keepPreviousData,
  })
}

export const useWorkShiftInvoices = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftInvoices, slug],
    queryFn: () => getWorkShiftInvoices(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
    placeholderData: keepPreviousData,
  })
}

export const useWorkShiftStaff = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftStaff, slug],
    queryFn: () => getWorkShiftStaff(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
  })
}

export const useWorkShiftSummary = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftSummary, slug],
    queryFn: () => getWorkShiftSummary(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptClientError,
  })
}
