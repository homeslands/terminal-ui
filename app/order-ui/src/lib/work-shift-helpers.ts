const LONG_SHIFT_THRESHOLD_MINUTES = 600 // 10 giờ

/**
 * Số phút ca đã mở. BE work-shift không trả durationMinutes nên FE tự tính.
 * Clamp về 0 khi lệch đồng hồ hoặc start không parse được.
 */
export function computeShiftDurationMinutes(
  startIso: string,
  nowMs: number = Date.now(),
): number {
  const startMs = new Date(startIso).getTime()
  if (Number.isNaN(startMs)) return 0
  return Math.max(0, Math.floor((nowMs - startMs) / 60_000))
}

/** Format số phút thành "Xh Ym" / "Xh" / "Ym". Trả "—" khi không có giá trị. */
export function formatShiftDuration(
  minutes: number | null | undefined,
): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes === 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** True khi ca đã mở từ 10 giờ trở lên — dùng để gợi ý force-close. */
export function isLongShift(
  durationMinutes: number | null | undefined,
): boolean {
  if (durationMinutes === null || durationMinutes === undefined) return false
  return durationMinutes >= LONG_SHIFT_THRESHOLD_MINUTES
}

/**
 * cashDifference = closingCash - openingCash - cashRevenue.
 * > 0 thừa tiền mặt, < 0 thiếu, = 0 khớp. null khi ca chưa đóng.
 *
 * BE cũng trả sẵn `cashDifference`; hàm này dùng để đối chiếu phía client
 * và để hiển thị preview trong dialog đóng ca trước khi submit.
 */
export function computeCashDifference(args: {
  openingCash: number
  closingCash: number | null
  cashRevenue: number
}): number | null {
  if (args.closingCash === null) return null
  return args.closingCash - args.openingCash - args.cashRevenue
}

/**
 * True khi order thuộc ca khác với ca đang xem (đơn xuyên ca — spec §4 Luồng C).
 * Order chưa có ca (null) không tính là xuyên ca.
 */
export function isCrossShiftOrder(
  orderWorkShiftSlug: string | null | undefined,
  currentShiftSlug: string,
): boolean {
  if (!orderWorkShiftSlug) return false
  return orderWorkShiftSlug !== currentShiftSlug
}
