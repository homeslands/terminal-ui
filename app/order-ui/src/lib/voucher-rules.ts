import type { IVoucher } from '@/types'
import moment from 'moment'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import { isVoucherApplicableToCartItems } from '@/utils'
import {
  isVoucherExpired,
  isVoucherInActiveTimeWindow,
} from '@/utils/voucher-time'
import { serverNow } from '@/lib/server-time'

// Consolidated voucher rules. Replaces:
//   - src/lib/voucher-validation.ts (isVoucherValid, getVoucherErrorMessage)
//   - src/lib/voucher-display.ts (firstInvalidReason, getVoucherDisplayState,
//     mergeVoucherSources, voucherReasonI18nKey)
// Single source of truth for: validation rules, display state machine,
// applied-snapshot injection, i18n key mapping.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoucherContext {
  /** Subtotal after item-level promotion, excluding gift items. */
  subtotalAfterPromotion: number
  /** Sum of quantity across non-gift items. */
  totalQuantity: number
  /** Product slugs in cart (non-gift). */
  productSlugs: string[]
  /** True when owner is a customer with login. */
  hasCustomerOwner: boolean
  /** Current payment method on the order/cart. Omit if not yet chosen. */
  paymentMethod?: string
}

// Backward-compat alias — prefer VoucherContext going forward.
export type VoucherValidationContext = VoucherContext

export type VoucherInvalidReason =
  | 'OUT_OF_USAGE'
  | 'EXPIRED'
  | 'NOT_IN_TIME_WINDOW'
  | 'MIN_ORDER_NOT_MET'
  | 'IDENTITY_REQUIRED'
  | 'PRODUCTS_ALL_REQUIRED'
  | 'PRODUCTS_AT_LEAST_ONE_REQUIRED'
  | 'MAX_ITEMS_EXCEEDED'
  | 'INACTIVE'
  | 'NOT_ELIGIBLE'
  | 'PAYMENT_METHOD_NOT_SUPPORTED'
  | 'CONFIG_CHANGED'

export type VoucherSource = 'eligible' | 'applied_only'

export interface IVoucherDisplay extends IVoucher {
  _source: VoucherSource
  _isApplied: boolean
}

export type VoucherDisplayState =
  | { kind: 'AVAILABLE'; canApply: true; canRemove: false }
  | { kind: 'APPLIED_OK'; canApply: false; canRemove: true }
  | {
      kind: 'APPLIED_INVALID'
      canApply: false
      canRemove: true
      reason: VoucherInvalidReason
    }
  | {
      kind: 'APPLIED_STALE'
      canApply: false
      canRemove: true
      reason: VoucherInvalidReason
    }
  | {
      kind: 'INELIGIBLE'
      canApply: false
      canRemove: false
      reason: VoucherInvalidReason
    }

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Single source of truth for voucher validation. Replaces:
 *   - voucher-validation.ts::isVoucherValid (returned bool only)
 *   - voucher-display.ts::firstInvalidReason (returned reason only)
 *
 * Check order matters — first violated rule wins as the reason. Order is
 * preserved from voucher-display.ts (inactive → time → usage → identity →
 * payment method → minOrder → products → maxItems) to avoid behavior change.
 */
export function evaluateVoucher(
  v: IVoucher,
  ctx: VoucherContext,
): { valid: boolean; reason: VoucherInvalidReason | null } {
  const reason = firstInvalidReason(v, ctx)
  return { valid: reason === null, reason }
}

function firstInvalidReason(
  v: IVoucher,
  ctx: VoucherContext,
): VoucherInvalidReason | null {
  if (!v.isActive) return 'INACTIVE'
  if (isVoucherExpired(v)) return 'EXPIRED'
  if (!isVoucherInActiveTimeWindow(v)) return 'NOT_IN_TIME_WINDOW'
  if ((v.remainingUsage ?? 0) <= 0) return 'OUT_OF_USAGE'

  // 7AM-today bound — mirrors voucher-validation.ts behavior.
  const sevenAm = moment(serverNow()).set({
    hour: 7,
    minute: 0,
    second: 0,
    millisecond: 0,
  })
  if (!sevenAm.isSameOrBefore(moment(v.endDate))) return 'EXPIRED'

  if (v.isVerificationIdentity && !ctx.hasCustomerOwner) {
    return 'IDENTITY_REQUIRED'
  }

  const methodRestriction: string[] =
    v.voucherPaymentMethods?.map((m) => m.paymentMethod as string) ?? []
  if (
    methodRestriction.length > 0 &&
    ctx.paymentMethod !== undefined &&
    !methodRestriction.includes(ctx.paymentMethod)
  ) {
    return 'PAYMENT_METHOD_NOT_SUPPORTED'
  }

  if (
    v.type !== VOUCHER_TYPE.SAME_PRICE_PRODUCT &&
    (v.minOrderValue ?? 0) > ctx.subtotalAfterPromotion
  ) {
    return 'MIN_ORDER_NOT_MET'
  }

  const productSlugs =
    v.voucherProducts
      ?.map((vp) => vp.product?.slug)
      .filter((s): s is string => !!s) ?? []
  if (productSlugs.length > 0) {
    const ok = isVoucherApplicableToCartItems(
      ctx.productSlugs,
      productSlugs,
      v.applicabilityRule,
    )
    if (!ok) {
      return v.applicabilityRule === APPLICABILITY_RULE.ALL_REQUIRED
        ? 'PRODUCTS_ALL_REQUIRED'
        : 'PRODUCTS_AT_LEAST_ONE_REQUIRED'
    }
  }

  if (v.maxItems && v.maxItems > 0 && ctx.totalQuantity > v.maxItems) {
    return 'MAX_ITEMS_EXCEEDED'
  }

  return null
}

/**
 * Backward-compat: returns a localized error message for the first invalid
 * reason. Used by code paths still calling the old `getVoucherErrorMessage`.
 * Prefer `evaluateVoucher().reason` + `voucherReasonI18nKey()` going forward.
 */
export function getVoucherErrorMessage(
  v: IVoucher,
  ctx: VoucherContext,
  t: (k: string, p?: Record<string, unknown>) => string,
): string {
  const { reason } = evaluateVoucher(v, ctx)
  if (!reason) return ''
  // Preserve old behavior where some reasons had richer messages with params
  // (e.g. notInActiveTimeWindow with start/end). For now fall back to plain
  // i18n key. Callers needing parameterized strings should query reason and
  // build the message themselves.
  if (reason === 'NOT_IN_TIME_WINDOW' && v.activeStartTime && v.activeEndTime) {
    return t('voucher.notInActiveTimeWindow', {
      start: v.activeStartTime,
      end: v.activeEndTime,
    })
  }
  return t(voucherReasonI18nKey(reason))
}

const REASON_KEYS: Record<VoucherInvalidReason, string> = {
  OUT_OF_USAGE: 'voucher.reason.outOfUsage',
  EXPIRED: 'voucher.reason.expired',
  NOT_IN_TIME_WINDOW: 'voucher.reason.notInTimeWindow',
  MIN_ORDER_NOT_MET: 'voucher.reason.minOrderNotMet',
  IDENTITY_REQUIRED: 'voucher.reason.identityRequired',
  PRODUCTS_ALL_REQUIRED: 'voucher.reason.productsAllRequired',
  PRODUCTS_AT_LEAST_ONE_REQUIRED: 'voucher.reason.productsAtLeastOneRequired',
  MAX_ITEMS_EXCEEDED: 'voucher.reason.maxItemsExceeded',
  INACTIVE: 'voucher.reason.inactive',
  NOT_ELIGIBLE: 'voucher.reason.notEligible',
  PAYMENT_METHOD_NOT_SUPPORTED: 'voucher.reason.paymentMethodNotSupported',
  CONFIG_CHANGED: 'voucher.reason.configChanged',
}

export function voucherReasonI18nKey(reason: VoucherInvalidReason): string {
  return REASON_KEYS[reason]
}

// ---------------------------------------------------------------------------
// Display state machine
// ---------------------------------------------------------------------------

export function getVoucherDisplayState(
  v: IVoucherDisplay,
  ctx: VoucherContext,
): VoucherDisplayState {
  if (v._source === 'applied_only') {
    const reason: VoucherInvalidReason =
      (v.remainingUsage ?? 0) === 0 ? 'OUT_OF_USAGE' : 'NOT_ELIGIBLE'
    return { kind: 'APPLIED_STALE', canApply: false, canRemove: true, reason }
  }

  const { reason } = evaluateVoucher(v, ctx)
  if (reason === null) {
    return v._isApplied
      ? { kind: 'APPLIED_OK', canApply: false, canRemove: true }
      : { kind: 'AVAILABLE', canApply: true, canRemove: false }
  }
  return v._isApplied
    ? {
        kind: 'APPLIED_INVALID',
        canApply: false,
        canRemove: true,
        reason,
      }
    : {
        kind: 'INELIGIBLE',
        canApply: false,
        canRemove: false,
        reason,
      }
}

// ---------------------------------------------------------------------------
// Source merging
// ---------------------------------------------------------------------------

/**
 * Union eligible API response with applied snapshot from the order.
 *
 * Critical invariant: an applied voucher MUST remain in the display list even
 * when the eligible API no longer returns it (e.g. user just consumed the
 * last remaining usage). Otherwise the user loses the ability to deselect it
 * from the sheet UI.
 */
export function mergeVoucherSources(
  eligible: IVoucher[],
  applied: IVoucher | null,
): IVoucherDisplay[] {
  const map = new Map<string, IVoucherDisplay>()

  for (const v of eligible) {
    map.set(v.slug, { ...v, _source: 'eligible', _isApplied: false })
  }

  if (applied) {
    const existed = map.get(applied.slug)
    map.set(applied.slug, {
      ...(existed ?? {}),
      ...applied,
      _source: existed ? 'eligible' : 'applied_only',
      _isApplied: true,
    } as IVoucherDisplay)
  }

  return Array.from(map.values())
}
