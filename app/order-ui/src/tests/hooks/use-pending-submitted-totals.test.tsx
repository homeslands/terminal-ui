import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePendingSubmittedTotals } from '@/hooks/use-pending-submitted-totals'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import type { OrderItem, SubmittedOrder } from '@/types/session'

const item: OrderItem = {
  menuItemId: 'p1',
  productSlug: 'p1',
  name: 'BBQ',
  priceNum: 50000,
  originalPrice: 50000,
  price: '50,000đ',
  quantity: 1,
  variantSlug: 'v1',
  note: '',
  promotion: null,
} as OrderItem

const submitted: SubmittedOrder = {
  orderSlug: 'o1',
  items: [item],
  createdAt: new Date().toISOString(),
} as unknown as SubmittedOrder

describe('usePendingSubmittedTotals', () => {
  it('computes pendingTotals, submittedTotal, grandTotal', () => {
    const { result } = renderHook(() =>
      usePendingSubmittedTotals([item], [submitted], null),
    )
    expect(result.current.pendingTotals.finalTotal).toBeGreaterThan(0)
    expect(result.current.submittedTotal).toBeGreaterThan(0)
    expect(result.current.grandTotal).toBe(
      result.current.pendingTotals.finalTotal + result.current.submittedTotal,
    )
  })

  it('passes voucher to pending but not submitted', () => {
    const voucher = {
      slug: 'v',
      code: 'V',
      value: 20,
      type: VOUCHER_TYPE.PERCENT_ORDER,
      applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
      isActive: true,
      remainingUsage: 10,
      maxUsage: 10,
      minOrderValue: 0,
      isVerificationIdentity: false,
      title: 'Test Voucher',
      endDate: '2099-12-31',
      voucherProducts: [{ product: { slug: 'p1' } }],
    } as never
    const { result: withV } = renderHook(() =>
      usePendingSubmittedTotals([item], [submitted], voucher),
    )
    const { result: noV } = renderHook(() =>
      usePendingSubmittedTotals([item], [submitted], null),
    )
    expect(withV.current.pendingTotals.finalTotal).toBeLessThan(
      noV.current.pendingTotals.finalTotal,
    )
    expect(withV.current.submittedTotal).toBe(noV.current.submittedTotal)
  })
})
