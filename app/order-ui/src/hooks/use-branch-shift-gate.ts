import { Role } from '@/constants'
import { useUserStore } from '@/stores'

import { useActiveWorkShifts, useCurrentWorkShift } from './use-work-shift'

export type TShiftGateReason =
  | 'OK'
  | 'NO_ACTIVE_SHIFT'
  | 'STAFF_CANNOT_PAY'
  | 'UNKNOWN'

export interface IBranchShiftGate {
  canPay: boolean
  reason: TShiftGateReason
  isLoading: boolean
}

/**
 * Quyết định người dùng hiện tại có được phép khởi tạo thanh toán không.
 *
 * STAFF không có quyền đọc /work-shifts/current lẫn /work-shifts/active
 * (spec §3) nên không thể pre-check — chặn ngay từ role, không gọi API.
 * Lỗi 161006 từ BE vẫn là chốt chặn cuối.
 */
export function useBranchShiftGate(branchSlug?: string): IBranchShiftGate {
  const role = useUserStore((s) => s.getUserInfo())?.role?.name
  const isStaff = role === Role.STAFF
  const isCashier = role === Role.CASHIER
  const isManagerOrAbove =
    role === Role.MANAGER || role === Role.ADMIN || role === Role.SUPER_ADMIN

  const { data: currentShift, isLoading: isLoadingCurrent } =
    useCurrentWorkShift(isCashier)
  const { data: activeShifts, isLoading: isLoadingActive } = useActiveWorkShifts(
    branchSlug,
    isManagerOrAbove,
  )

  if (isStaff) {
    return { canPay: false, reason: 'STAFF_CANNOT_PAY', isLoading: false }
  }

  if (isCashier) {
    if (isLoadingCurrent) {
      return { canPay: false, reason: 'UNKNOWN', isLoading: true }
    }
    return currentShift
      ? { canPay: true, reason: 'OK', isLoading: false }
      : { canPay: false, reason: 'NO_ACTIVE_SHIFT', isLoading: false }
  }

  if (isManagerOrAbove) {
    if (isLoadingActive) {
      return { canPay: false, reason: 'UNKNOWN', isLoading: true }
    }
    return (activeShifts?.length ?? 0) > 0
      ? { canPay: true, reason: 'OK', isLoading: false }
      : { canPay: false, reason: 'NO_ACTIVE_SHIFT', isLoading: false }
  }

  // Role không xác định — không chặn ở FE, để BE quyết định.
  return { canPay: true, reason: 'OK', isLoading: false }
}
