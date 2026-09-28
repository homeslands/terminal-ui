/**
 * Sheet-level auto-revalidate for an applied voucher.
 *
 * Used by voucher-list sheets whose host component does NOT use
 * `useVoucherState` to own the voucher lifecycle — primarily client-side
 * flows (`client-voucher-list-sheet-in-*`) plus a handful of staff sheets
 * whose host still manages voucher state inline.
 *
 * When a host adopts `useVoucherState`, auto-revalidate is performed at the
 * host level and the sheet no longer needs this hook. After all hosts
 * migrate, this hook can be deleted. See
 * `docs/superpowers/decisions/2026-06-23-auto-revalidate-hook-fate.md` for
 * the full rationale.
 *
 * Trust-BE phase: this hook also tolerates the brief FE/BE rounding
 * disagreement window right after apply — the host-level `useVoucherState`
 * relies on its own "wait for items / wait for orderSlug" guards instead
 * and does not replicate this exact phase.
 */

import { useEffect, useRef } from 'react'
import moment from 'moment'
import type { IVoucher } from '@/types'
import {
  getVoucherDisplayState,
  type IVoucherDisplay,
  type VoucherInvalidReason,
  type VoucherValidationContext,
} from '@/lib/voucher-rules'
import { serverNow } from '@/lib/server-time'

const BOUNDARY_GRACE_MS = 30 * 60_000 // 30-min grace matches voucher-time helpers.
const BOUNDARY_BUFFER_MS = 1_000 // Fire 1s past boundary so server-side rounding agrees.
const MAX_BOUNDARY_HORIZON_MS = 24 * 60 * 60_000 // Don't schedule farther than a day.

/**
 * Time of the next moment the voucher could transition valid → invalid:
 * - `endDate` + grace
 * - today's `activeEndTime` + grace (if voucher has an active window)
 *
 * Returns null if there's no boundary within the next 24h.
 */
function nextBoundaryDelayMs(v: IVoucher): number | null {
  const now = serverNow()
  const candidates: number[] = []

  if (v.endDate) {
    const endWithGrace = moment.utc(v.endDate).valueOf() + BOUNDARY_GRACE_MS
    if (endWithGrace > now) candidates.push(endWithGrace)
  }

  if (v.activeEndTime) {
    const [h, m] = v.activeEndTime.split(':').map(Number)
    const todayBoundary = moment(now)
      .set({ hour: h, minute: m, second: 0, millisecond: 0 })
      .valueOf() + BOUNDARY_GRACE_MS
    if (todayBoundary > now) candidates.push(todayBoundary)
  }

  if (candidates.length === 0) return null
  const next = Math.min(...candidates)
  const delay = next - now + BOUNDARY_BUFFER_MS
  if (delay > MAX_BOUNDARY_HORIZON_MS) return null
  return delay
}

interface Args {
  appliedVoucher: IVoucher | null
  context: VoucherValidationContext
  onAutoRemove: (reason: VoucherInvalidReason) => void
  /** Polling interval (ms) for time-window/expiry watchdog. 0 disables. */
  pollMs?: number
}

/**
 * Reasons we DO NOT auto-remove an already-applied voucher for. BE accepted
 * the apply (so these conditions held at apply time); a later "snapshot says
 * 0" or "voucher gone from eligible" is a server-side discrepancy, not a
 * user-driven change.
 */
const NON_REMOVABLE_REASONS = new Set<VoucherInvalidReason>([
  'OUT_OF_USAGE',
  'NOT_ELIGIBLE',
  'INACTIVE',
  'CONFIG_CHANGED',
])

/**
 * Time-based reasons can fire even during the "trust BE" phase because they
 * indicate a genuine moment passing (not an FE-vs-BE discrepancy).
 */
const TIME_BASED_REASONS = new Set<VoucherInvalidReason>([
  'EXPIRED',
  'NOT_IN_TIME_WINDOW',
])

function evaluate(
  applied: IVoucher,
  ctx: VoucherValidationContext,
): VoucherInvalidReason | null {
  const display: IVoucherDisplay = {
    ...applied,
    _source: 'eligible',
    _isApplied: true,
  }
  const state = getVoucherDisplayState(display, ctx)
  if (state.kind === 'APPLIED_INVALID' || state.kind === 'APPLIED_STALE') {
    if (NON_REMOVABLE_REASONS.has(state.reason)) return null
    return state.reason
  }
  return null
}

/**
 * Watches the applied voucher and calls `onAutoRemove` with a reason when the
 * voucher becomes invalid relative to the current order context.
 *
 * **Trust-BE phase** (Option B): when a voucher is first applied or just
 * mounted, we trust BE for one cycle — we do NOT auto-remove on the initial
 * effect run. This avoids false positives when FE's locally-computed context
 * differs slightly from BE's view at apply time (rounding, gift exclusion,
 * etc). Trust ends as soon as the user changes anything (cart, customer,
 * payment) — from then on, every subsequent invalidation auto-removes as
 * normal. Time-based reasons (EXPIRED / NOT_IN_TIME_WINDOW) still fire even
 * during the trust phase, because time genuinely changes.
 */
export function useAutoRevalidateAppliedVoucher({
  appliedVoucher,
  context,
  onAutoRemove,
  pollMs = 30_000,
}: Args) {
  const onAutoRemoveRef = useRef(onAutoRemove)
  onAutoRemoveRef.current = onAutoRemove
  const warnedSlugsRef = useRef<Set<string>>(new Set())

  const appliedUpdatedAt = appliedVoucher?.updatedAt ?? null

  // Dev warning: if BE never returns updatedAt for vouchers, cascade detection
  // (case 15 — admin reconfig) is a silent no-op. Surface this once per voucher
  // slug in dev so it's obvious during development / QA.
  if (
    import.meta.env.DEV &&
    appliedVoucher &&
    !appliedVoucher.updatedAt &&
    !warnedSlugsRef.current.has(appliedVoucher.slug)
  ) {
    warnedSlugsRef.current.add(appliedVoucher.slug)
    // eslint-disable-next-line no-console
    console.warn(
      `[useAutoRevalidateAppliedVoucher] applied voucher "${appliedVoucher.slug}" ` +
        `has no updatedAt — admin-cascade detection will not fire for this voucher.`,
    )
  }

  // Tracks the slug we already asked to remove so we don't keep firing while
  // the mutation is in flight (before the cache reflects the removal).
  const lastFiredSlugRef = useRef<string | null>(null)
  const lastFiredUpdatedAtRef = useRef<string | null>(null)
  // Trust-BE: when a voucher first becomes applied (or page reloads with a
  // voucher already on the order), we trust BE. The hook only auto-removes
  // when the REASON CHANGES from what FE computed at mount.
  //
  // Why "reason change" instead of "first run" gate:
  //   - Page load races: order data, cart items, customer all stream in
  //     async. Each can flip a context primitive even though the user did
  //     nothing. A simple "first run" gate would drop trust on the 2nd
  //     stream of data and false-fire.
  //   - If FE's locally-computed reason at mount = X (e.g. a known FE/BE
  //     calc difference), we accept it as the baseline. The voucher stays
  //     until the reason actually CHANGES — which only happens when the user
  //     does something meaningful (or time passes).
  //   - Time-based reasons (EXPIRED, NOT_IN_TIME_WINDOW) bypass via fire().
  const trustBERef = useRef(false)
  const initialReasonRef = useRef<VoucherInvalidReason | null | undefined>(
    undefined,
  )
  const lastSeenSlugRef = useRef<string | null>(null)

  // New voucher slug → re-arm trust + reset baseline + fire guard.
  const currentSlug = appliedVoucher?.slug ?? null
  if (currentSlug !== lastSeenSlugRef.current) {
    trustBERef.current = currentSlug !== null
    initialReasonRef.current = undefined
    lastSeenSlugRef.current = currentSlug
    lastFiredSlugRef.current = null
  }

  if (
    appliedVoucher &&
    lastFiredUpdatedAtRef.current !== appliedUpdatedAt
  ) {
    lastFiredUpdatedAtRef.current = appliedUpdatedAt
  }
  if (!appliedVoucher) {
    lastFiredSlugRef.current = null
    lastFiredUpdatedAtRef.current = null
  }

  const productSlugsKey = context.productSlugs.join('|')

  const fire = (reason: VoucherInvalidReason, slug: string) => {
    if (lastFiredSlugRef.current === slug) return
    // Trust-BE phase: only allow time-based reasons through.
    if (trustBERef.current && !TIME_BASED_REASONS.has(reason)) {
      // eslint-disable-next-line no-console
      console.log(
        `[AutoRevalidate] trusting BE — SKIPPING reason=${reason} for voucher ${appliedVoucher?.code} (slug=${slug})`,
      )
      return
    }
    lastFiredSlugRef.current = slug
    // eslint-disable-next-line no-console
    console.log(
      `[AutoRevalidate] AUTO-REMOVING voucher ${appliedVoucher?.code} (slug=${slug}) — reason=${reason}`,
      {
        ctx: {
          subtotalAfterPromotion: context.subtotalAfterPromotion,
          totalQuantity: context.totalQuantity,
          productSlugs: context.productSlugs,
          hasCustomerOwner: context.hasCustomerOwner,
          paymentMethod: context.paymentMethod,
        },
        voucher: appliedVoucher
          ? {
              minOrderValue: appliedVoucher.minOrderValue,
              maxItems: appliedVoucher.maxItems,
              remainingUsage: appliedVoucher.remainingUsage,
              isActive: appliedVoucher.isActive,
              endDate: appliedVoucher.endDate,
              activeStartTime: appliedVoucher.activeStartTime,
              activeEndTime: appliedVoucher.activeEndTime,
              isVerificationIdentity: appliedVoucher.isVerificationIdentity,
              voucherProducts: appliedVoucher.voucherProducts?.map(
                (vp) => vp.product?.slug,
              ),
              voucherPaymentMethods: appliedVoucher.voucherPaymentMethods?.map(
                (m) => m.paymentMethod,
              ),
            }
          : null,
      },
    )
    onAutoRemoveRef.current(reason)
  }

  // Context-change effect. Captures the initial reason on first run with a
  // voucher applied. Subsequent runs only auto-remove if the reason CHANGED
  // from the baseline (i.e. user/time actually flipped voucher validity, not
  // just async data load streaming in different primitives).
  useEffect(() => {
    if (!appliedVoucher) return
    const reason = evaluate(appliedVoucher, context)

    if (initialReasonRef.current === undefined) {
      initialReasonRef.current = reason
      // eslint-disable-next-line no-console
      console.log(
        `[AutoRevalidate] initial mount for ${appliedVoucher.code} (slug=${appliedVoucher.slug}) — trusting BE; baseline reason=${reason ?? 'valid'}`,
      )
      if (reason) fire(reason, appliedVoucher.slug) // fire() gates non-time
      return
    }

    // Same reason as baseline → static FE/BE discrepancy → keep trusting BE.
    if (reason === initialReasonRef.current) {
      return
    }

    // Reason CHANGED → user-driven or time-driven flip → drop trust + fire.
    // eslint-disable-next-line no-console
    console.log(
      `[AutoRevalidate] reason changed for ${appliedVoucher.code}: ${initialReasonRef.current ?? 'valid'} → ${reason ?? 'valid'}`,
    )
    trustBERef.current = false
    initialReasonRef.current = reason
    if (reason) fire(reason, appliedVoucher.slug)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedVoucher,
    appliedUpdatedAt,
    context.subtotalAfterPromotion,
    context.totalQuantity,
    context.hasCustomerOwner,
    context.paymentMethod,
    productSlugsKey,
  ])

  // Backstop polling. fire() gates with trustBE+TIME_BASED so polling won't
  // remove for non-time reasons during the trust phase.
  useEffect(() => {
    if (!appliedVoucher || pollMs <= 0) return
    const id = setInterval(() => {
      const reason = evaluate(appliedVoucher, context)
      if (reason) fire(reason, appliedVoucher.slug)
    }, pollMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedVoucher,
    appliedUpdatedAt,
    pollMs,
    context.subtotalAfterPromotion,
    context.totalQuantity,
    context.hasCustomerOwner,
    context.paymentMethod,
    productSlugsKey,
  ])

  // Precise boundary fire for endDate / activeEndTime.
  useEffect(() => {
    if (!appliedVoucher) return
    const delay = nextBoundaryDelayMs(appliedVoucher)
    if (delay == null) return
    const id = setTimeout(() => {
      const reason = evaluate(appliedVoucher, context)
      if (reason) fire(reason, appliedVoucher.slug)
    }, delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedVoucher,
    appliedUpdatedAt,
    context.subtotalAfterPromotion,
    context.totalQuantity,
    context.hasCustomerOwner,
    context.paymentMethod,
    productSlugsKey,
  ])
}
