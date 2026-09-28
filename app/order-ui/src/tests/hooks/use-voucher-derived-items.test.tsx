import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVoucherDerivedItems } from '@/hooks/use-voucher-derived-items'
import type { OrderItem } from '@/types/session'

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
  discountNum: 0,
  itemSubtotal: 50000,
  itemSubtotalAfterDiscount: 50000,
} as OrderItem

describe('useVoucherDerivedItems', () => {
  it('returns merged voucher items + cart + display + subtotal', () => {
    const { result } = renderHook(() => useVoucherDerivedItems([item], [item]))
    expect(result.current.allVoucherItems).toHaveLength(2)
    expect(result.current.allVoucherItems[0]).toMatchObject({
      menuItemId: 'p1',
      productSlug: 'p1',
      quantity: 1,
    })
    expect(result.current.allVoucherItems[1]).toMatchObject({
      menuItemId: 'p1',
      productSlug: 'p1',
      quantity: 1,
    })
    expect(result.current.voucherCart).toBeDefined()
    expect(result.current.voucherDisplay).toBeDefined()
    expect(result.current.voucherSubtotal).toBeDefined()
  })

  it('keeps stable references across rerenders with same input', () => {
    const items = [item]
    const { result, rerender } = renderHook(
      ({ all, pen }) => useVoucherDerivedItems(all, pen),
      { initialProps: { all: items, pen: items } },
    )
    const first = result.current.allVoucherItems
    rerender({ all: items, pen: items })
    expect(result.current.allVoucherItems).toBe(first)
  })
})
