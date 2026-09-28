import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import moment from 'moment'
import { TicketPercent, ChevronRight, Info } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  Button,
  ScrollArea,
  Badge,
  Progress,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import { APPLICABILITY_RULE, VOUCHER_CUSTOMER_TYPE } from '@/constants/voucher'
import {
  useVouchersForOrder,
  useValidateVoucher,
  useAutoRevalidateAppliedVoucher,
} from '@/hooks'
import { useUserStore, useTableSessionsStore } from '@/stores'
import { staffItemsToCartItem } from '@/lib/staff-cart-adapter'
import { calculateCartItemDisplay, calculateCartTotals } from '@/utils/cart'
import {
  evaluateVoucher,
  getVoucherErrorMessage,
  voucherReasonI18nKey,
  type VoucherValidationContext,
} from '@/lib/voucher-rules'
import { getVoucherSummary } from '@/lib/voucher-summary'
import { formatCurrency, showErrorToast, showToast } from '@/utils'
import type { OrderItem, TableCustomer } from '@/types/session'
import type { IVoucher, IGetAllVoucherRequest } from '@/types'

/**
 * Props-driven voucher sheet for staff table session.
 *
 * Intentionally NOT coupled to `useOrderFlowStore` (parent — OrderSummary in B4 —
 * owns the applied voucher in TableSession via `setOrderVoucher`). This keeps the
 * sheet reusable and easy to test, and avoids the singleton trap the original
 * `staff-voucher-list-sheet.tsx` fell into.
 *
 * UI scope is intentionally minimal vs the 970-line source reference:
 *  - no copy-code / tooltip popovers
 *  - no code-search input
 *  - no pagination (TODO: add load-more if real-world voucher count > 20)
 * B6 will wire auto-revalidation; this component is the user-facing entry only.
 */
interface Props {
  pendingItems: OrderItem[]
  /** Items already submitted to the API — used together with pendingItems for
   *  the validation context so vouchers reflect the FULL order, not just the
   *  unsent slice. Default `[]` for fresh sessions. */
  submittedItems?: OrderItem[]
  /** Customer linked to the order; used for `hasCustomerOwner` (identity check)
   *  and as the `user` slug on validate / list requests. */
  customer: TableCustomer | null
  appliedVoucher: IVoucher | null
  onApply: (voucher: IVoucher) => void
  onRemove: () => void
  /** CC-6: When true, the trigger and all apply/remove actions are locked
   *  (e.g. order is already PAID/cancelled). Sheet won't open if disabled. */
  disabled?: boolean
  /** Current payment method on the table session (optional). */
  paymentMethod?: string
}

function usageFrequencyLabel(
  unit: string | undefined | null,
  value: number | undefined | null,
  t: (k: string) => string,
): string | null {
  if (!unit || !value || unit === 'unlimited') return null
  const unitMap: Record<string, string> = {
    hour: t('voucher.hour'),
    day: t('voucher.day'),
    week: t('voucher.week'),
    month: t('voucher.month'),
    year: t('voucher.year'),
  }
  return `${value} ${t('voucher.times')} / ${unitMap[unit] ?? unit}`
}

function applicabilityRuleLabel(
  rule: string | undefined,
  t: (k: string) => string,
): string {
  if (rule === APPLICABILITY_RULE.ALL_REQUIRED) return t('voucher.allRequired')
  if (rule === APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED)
    return t('voucher.atLeastOne')
  return ''
}

function customerTypeLabel(
  type: string | undefined,
  t: (k: string) => string,
): string | null {
  if (!type || type === VOUCHER_CUSTOMER_TYPE.ALL) return null
  if (type === VOUCHER_CUSTOMER_TYPE.GROUP)
    return t('voucher.customerTypeGroup')
  if (type === VOUCHER_CUSTOMER_TYPE.PERSON)
    return t('voucher.customerTypePerson')
  return type
}

export function StaffTableVoucherSheet({
  pendingItems,
  submittedItems = [],
  customer,
  appliedVoucher,
  onApply,
  onRemove,
  disabled = false,
  paymentMethod,
}: Props) {
  const [open, setOpen] = useState(false)
  const [stickyVoucher, setStickyVoucher] = useState<IVoucher | null>(null)
  const { t } = useTranslation('voucher')
  const { userInfo } = useUserStore()
  const { mutate: validateVoucher, isPending: isValidating } =
    useValidateVoucher()

  // Snapshot getter — uses getState() so it does NOT subscribe to store changes
  // and avoids re-rendering the sheet every time the promise reference changes.
  const getPendingOwnerSync = () =>
    useTableSessionsStore.getState().pendingOwnerSync

  // pending + submitted = the full order for validation/totals.
  const allItems = useMemo(
    () => [...pendingItems, ...submittedItems],
    [pendingItems, submittedItems],
  )

  // Reuse calculateCartTotals via the staff-cart-adapter so subtotal logic
  // matches the system cart (promotion exclusions, etc.).
  const totals = useMemo(() => {
    const cart = staffItemsToCartItem(allItems)
    const display = calculateCartItemDisplay(cart, null)
    return calculateCartTotals(display, null)
  }, [allItems])

  const ctx: VoucherValidationContext = useMemo(
    () => ({
      subtotalAfterPromotion:
        totals.subTotalBeforeDiscount - totals.promotionDiscount,
      totalQuantity: allItems.reduce((s, i) => s + i.quantity, 0),
      // Only use real productSlug — menuItemId is an internal menu identifier
      // that never matches voucher.voucherProducts[].product.slug. Items missing
      // productSlug (no promotion etc.) are excluded from the check so the
      // voucher's product gate doesn't false-positive against menuItemId.
      productSlugs: allItems
        .map((i) => i.productSlug)
        .filter((s): s is string => !!s),
      hasCustomerOwner: !!customer,
      paymentMethod,
    }),
    [totals, allItems, customer, paymentMethod],
  )

  // Fetch vouchers only when sheet opens — avoids burning the query cache for
  // every table on the floor plan.
  const request: IGetAllVoucherRequest = useMemo(
    () => ({
      hasPaging: true,
      page: 1,
      size: 20,
      ...(customer ? { user: customer.slug } : {}),
      minOrderValue: ctx.subtotalAfterPromotion,
      orderItems: allItems.map((i) => ({
        quantity: i.quantity,
        variant: i.variantSlug ?? '',
        promotion: i.promotion?.slug ?? '',
        order: '',
        vatRate: i.vatRate ?? 0,
      })),
    }),
    [customer, ctx.subtotalAfterPromotion, allItems],
  )

  const {
    data: voucherList,
    isLoading,
    refetch,
  } = useVouchersForOrder(request, open)
  const vouchers: IVoucher[] = useMemo(() => {
    const eligible = voucherList?.result?.items ?? []
    // Inject applied voucher snapshot when eligible API filtered it out
    // (e.g. user consumed the last remainingUsage — voucher disappears from
    // eligible response but still lives on the order). Without this the staff
    // can't see / deselect a just-applied voucher when only 1 was available.
    if (
      appliedVoucher &&
      !eligible.some((v) => v.slug === appliedVoucher.slug)
    ) {
      return [appliedVoucher, ...eligible]
    }
    // Sticky injection — voucher vừa remove, giữ trong list cho re-apply
    // cho tới khi user pick voucher khác, sheet đóng, hoặc eligible list refresh có chứa nó.
    if (stickyVoucher && !eligible.some((v) => v.slug === stickyVoucher.slug)) {
      return [stickyVoucher, ...eligible]
    }
    return eligible
  }, [voucherList, appliedVoucher, stickyVoucher])

  const { validVouchers, invalidVouchers } = useMemo(() => {
    const valid: IVoucher[] = []
    const invalid: IVoucher[] = []
    for (const v of vouchers) {
      if (evaluateVoucher(v, ctx).valid) valid.push(v)
      else invalid.push(v)
    }
    return { validVouchers: valid, invalidVouchers: invalid }
  }, [vouchers, ctx])

  // Auto-revalidate the APPLIED voucher: when ctx changes (cart, customer) or
  // the time-window expires, drop the voucher and surface the reason.
  useAutoRevalidateAppliedVoucher({
    appliedVoucher,
    context: ctx,
    onAutoRemove: (reason) => {
      if (!appliedVoucher) return
      onRemove()
      const title = t('voucher.autoRemove.title', { code: appliedVoucher.code })
      const reasonMsg = t(voucherReasonI18nKey(reason))
      showToast(`${title} — ${reasonMsg}`)
    },
  })

  // Khi applied voucher đổi sang non-null (user pick voucher khác) → clear sticky
  useEffect(() => {
    if (appliedVoucher) setStickyVoucher(null)
  }, [appliedVoucher])

  // Khi sheet đóng → clear sticky
  useEffect(() => {
    if (!open) setStickyVoucher(null)
  }, [open])

  const isApplied = (slug: string) => appliedVoucher?.slug === slug

  const handleToggle = async (v: IVoucher) => {
    if (isApplied(v.slug)) {
      setStickyVoucher(v)
      onRemove()
      void refetch() // force refetch fresh eligible list
      return
    }
    if (v.isVerificationIdentity && !customer) {
      // 1004 = "voucher requires verified identity" error code (matches original sheet).
      showErrorToast(1004)
      return
    }
    // Guard race: wait for any in-flight owner-sync so BE owner == FE customer
    // before validating the voucher (otherwise apply hits stale order.owner).
    const pending = getPendingOwnerSync()
    if (pending) {
      try {
        await pending
      } catch {
        // Owner sync failed; owner-sync effect already toasted + rolled back.
        // Abort the apply.
        return
      }
    }
    validateVoucher(
      {
        voucher: v.slug,
        user: customer?.slug ?? userInfo?.slug ?? '',
        orderItems: allItems.map((i) => ({
          quantity: i.quantity,
          variant: i.variantSlug ?? '',
          note: i.note,
          promotion: i.promotion?.slug ?? null,
          order: null,
          vatRate: i.vatRate ?? 0,
        })),
      },
      {
        onSuccess: () => {
          onApply(v)
          setOpen(false)
        },
      },
    )
  }

  const renderCard = (v: IVoucher, isValid: boolean) => {
    const errorMsg = !isValid ? getVoucherErrorMessage(v, ctx, t) : ''
    const usagePct = v.maxUsage > 0 ? (v.remainingUsage / v.maxUsage) * 100 : 0
    return (
      <div
        key={v.slug}
        className={`relative grid grid-cols-8 gap-2 rounded-md border p-3 ${
          isApplied(v.slug)
            ? 'border-pos-gold bg-pos-gold/5'
            : 'border-muted-foreground/30'
        } ${!isValid ? 'opacity-60' : ''}`}
      >
        <div className="col-span-2 flex items-center justify-center rounded-md bg-pos-gold">
          <TicketPercent size={40} className="text-white" />
        </div>
        <div className="col-span-6 flex flex-col justify-between gap-1">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 truncate text-sm font-bold text-foreground">
                {v.title}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={t('voucher.viewConditions')}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="end">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    {t('voucher.conditions')}
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-foreground">
                    {(() => {
                      const summary = getVoucherSummary(v)
                      if (!summary) return null
                      return (
                        <>
                          <li>
                            <span className="text-muted-foreground">Loại:</span>{' '}
                            <span className="font-semibold">
                              {summary.typeLabel}
                            </span>
                          </li>
                          <li>
                            <span className="text-muted-foreground">
                              Giá trị:
                            </span>{' '}
                            <span className="font-semibold text-pos-gold">
                              {summary.valueLabel}
                            </span>
                          </li>
                        </>
                      )
                    })()}
                    {v.minOrderValue > 0 && (
                      <li>
                        <span className="text-muted-foreground">
                          {t('voucher.minOrderValue')}:
                        </span>{' '}
                        {formatCurrency(v.minOrderValue)}
                      </li>
                    )}
                    {v.maxItems > 0 && (
                      <li>
                        <span className="text-muted-foreground">
                          {t('voucher.maxItems')}:
                        </span>{' '}
                        {v.maxItems} {t('voucher.itemsUnit')}
                      </li>
                    )}
                    {v.activeStartTime && v.activeEndTime && (
                      <li>
                        <span className="text-muted-foreground">
                          {t('voucher.activeTimeWindow')}:
                        </span>{' '}
                        {v.activeStartTime} - {v.activeEndTime}
                      </li>
                    )}
                    {usageFrequencyLabel(
                      v.usageFrequencyUnit,
                      v.usageFrequencyValue,
                      t,
                    ) && (
                      <li>
                        <span className="text-muted-foreground">
                          {t('voucher.usageFrequency')}:
                        </span>{' '}
                        {usageFrequencyLabel(
                          v.usageFrequencyUnit,
                          v.usageFrequencyValue,
                          t,
                        )}
                      </li>
                    )}
                    {(v.voucherProducts?.length ?? 0) > 0 && (
                      <li>
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-muted-foreground">
                            {t('voucher.applicableProducts')}:
                          </span>
                          <span className="text-[10px] text-muted-foreground/80">
                            {v.voucherProducts.length} {t('voucher.itemsUnit')}
                            {v.applicabilityRule && (
                              <span className="ml-1 italic">
                                (
                                {applicabilityRuleLabel(v.applicabilityRule, t)}
                                )
                              </span>
                            )}
                          </span>
                        </div>
                        <ul className="thin-scrollbar mt-1 max-h-24 space-y-0.5 overflow-y-auto border-l-2 border-muted-foreground/20 pl-2">
                          {v.voucherProducts.map((vp) => (
                            <li
                              key={vp.slug}
                              className="truncate text-[10.5px] text-foreground"
                            >
                              • {vp.product?.name ?? vp.product?.slug ?? '—'}
                            </li>
                          ))}
                        </ul>
                      </li>
                    )}
                    {v.isVerificationIdentity && (
                      <li className="text-amber-600">
                        ⚠ {t('voucher.requireCustomerIdentity')}
                      </li>
                    )}
                    {customerTypeLabel(v.customerType, t) && (
                      <li>
                        <span className="text-muted-foreground">
                          {t('voucher.customerType')}:
                        </span>{' '}
                        {customerTypeLabel(v.customerType, t)}
                      </li>
                    )}
                    <li>
                      <span className="text-muted-foreground">
                        {t('voucher.endDate')}:
                      </span>{' '}
                      {moment(v.endDate).format('DD/MM/YYYY HH:mm')}
                    </li>
                    <li>
                      <span className="text-muted-foreground">
                        {t('voucher.remaining')}:
                      </span>{' '}
                      {v.remainingUsage}/{v.maxUsage} {t('voucher.usagesUnit')}
                    </li>
                  </ul>
                </PopoverContent>
              </Popover>
            </div>
            <div className="text-xs text-muted-foreground">
              {t('voucher.minOrderValue')}: {formatCurrency(v.minOrderValue)}
            </div>
            {errorMsg && (
              <div className="text-xs italic text-destructive">{errorMsg}</div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">
              {t('voucher.remainingUsage')}: {Math.round(usagePct)}%
            </span>
            <Progress value={usagePct} className="h-1" />
            <div className="mt-1 flex items-center justify-between">
              <Badge variant="outline" className="text-[10px]">
                {moment(v.endDate).format('DD/MM HH:mm')}
              </Badge>
              {isValid && (
                <Button
                  size="sm"
                  variant={isApplied(v.slug) ? 'destructive' : 'default'}
                  onClick={() => handleToggle(v)}
                  disabled={isValidating || disabled}
                >
                  {isApplied(v.slug) ? t('voucher.remove') : t('voucher.use')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (disabled) return
        setOpen(next)
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className="h-full min-h-10 w-full rounded-md border-0 bg-pos-card px-0 hover:bg-pos-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='none' stroke='%23C9A84C' stroke-width='2' stroke-dasharray='10 6' rx='6' ry='6'/%3E%3C/svg%3E")`,
          }}
          data-testid="staff-table-voucher-trigger"
        >
          <div className="flex h-full w-full cursor-pointer items-center gap-2 rounded-md px-3">
            <div className="flex flex-1 items-center gap-1.5">
              <TicketPercent className="h-3.5 w-3.5 shrink-0 text-pos-gold" />
              {appliedVoucher ? (
                <span className="text-[11px] text-pos-text">
                  Đang áp dụng:{' '}
                  <strong className="text-pos-gold">
                    {appliedVoucher.code}
                  </strong>
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  {t('voucher.useVoucher')}
                </span>
              )}
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader className="p-4">
          <SheetTitle className="text-pos-gold">{t('voucher.list')}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-4">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('voucher.loading')}
            </div>
          ) : vouchers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('voucher.noVoucher')}
            </div>
          ) : (
            <div className="space-y-4">
              {validVouchers.length > 0 && (
                <div className="space-y-2">
                  {validVouchers.map((v) => renderCard(v, true))}
                </div>
              )}
              {invalidVouchers.length > 0 && (
                <div className="space-y-2 border-t pt-2">
                  <Label className="text-xs text-muted-foreground/70">
                    {t('voucher.invalidVoucher')}
                  </Label>
                  {invalidVouchers.map((v) => renderCard(v, false))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        <SheetFooter className="p-4">
          <Button className="w-full" onClick={() => setOpen(false)}>
            {t('voucher.complete')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
