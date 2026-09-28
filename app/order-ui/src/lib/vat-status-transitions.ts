import { VatRequestStatus } from '@/types'

/**
 * Transition rule:
 * - COMPLETED là hard terminal — không cho chuyển sang bất kỳ status nào
 *   (hoá đơn đã xuất, không được rollback).
 * - Các status khác: free transition (có thể chuyển sang bất kỳ status khác,
 *   ngoại trừ chính nó — block same-status để tránh no-op click).
 * REJECTED vẫn cho transition tự do.
 */
export function canTransition(
  current: VatRequestStatus,
  target: VatRequestStatus,
): boolean {
  if (current === VatRequestStatus.COMPLETED) return false
  return current !== target
}
