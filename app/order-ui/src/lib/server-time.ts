let offsetMs = 0
const SMOOTHING_THRESHOLD_MS = 1_000

/** Returns Date.now() corrected by the most recent server offset. */
export function serverNow(): number {
  return Date.now() + offsetMs
}

export function getServerTimeOffsetMs(): number {
  return offsetMs
}

/**
 * Update offset from an HTTP Date header. Ignores invalid input. Applies
 * a small dead-band so 200-ms jitter on every request doesn't churn the
 * value (which would invalidate React-Query caches keyed off serverNow()).
 */
export function setServerTimeOffsetFromHeader(header: string | undefined): void {
  if (!header) return
  const parsed = Date.parse(header)
  if (Number.isNaN(parsed)) return
  const next = parsed - Date.now()
  if (Math.abs(next - offsetMs) <= SMOOTHING_THRESHOLD_MS) return
  offsetMs = next
}

/** Test-only seam. Do not call from production code. */
export function _resetServerTimeOffsetForTests(): void {
  offsetMs = 0
}
