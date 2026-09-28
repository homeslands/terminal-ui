import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { IVoucher } from '@/types'
import { useVoucherDisplayItems } from '@/hooks/use-voucher-display-items'

const v = (slug: string, extra: Partial<IVoucher> = {}): IVoucher =>
  ({ slug, code: slug.toUpperCase(), ...extra }) as IVoucher

describe('useVoucherDisplayItems', () => {
  it('marks eligible items + applied + extras with correct flags', () => {
    const { result } = renderHook(() =>
      useVoucherDisplayItems({
        items: [v('a'), v('b')],
        applied: v('c'),
        extras: [v('d')],
      }),
    )
    const byslug = new Map(result.current.map((x) => [x.slug, x]))
    expect(byslug.get('a')?._source).toBe('eligible')
    expect(byslug.get('a')?._isApplied).toBe(false)
    expect(byslug.get('c')?._source).toBe('applied_only')
    expect(byslug.get('c')?._isApplied).toBe(true)
    expect(byslug.get('d')?._source).toBe('eligible')
    expect(byslug.get('d')?._isApplied).toBe(false)
  })

  it('returns referentially stable output when inputs do not change', () => {
    const items = [v('a')]
    const { result, rerender } = renderHook(
      ({ items }: { items: IVoucher[] }) =>
        useVoucherDisplayItems({ items, applied: null }),
      { initialProps: { items } },
    )
    const first = result.current
    rerender({ items })
    expect(result.current).toBe(first)
  })

  it('does not duplicate when extras overlap eligible items', () => {
    const { result } = renderHook(() =>
      useVoucherDisplayItems({
        items: [v('a'), v('b')],
        applied: null,
        extras: [v('a')],
      }),
    )
    expect(result.current.map((r) => r.slug).sort()).toEqual(['a', 'b'])
  })

  it('marks applied as eligible when same slug present in items', () => {
    const { result } = renderHook(() =>
      useVoucherDisplayItems({
        items: [v('a'), v('b')],
        applied: v('b'),
      }),
    )
    const b = result.current.find((r) => r.slug === 'b')!
    expect(b._source).toBe('eligible')
    expect(b._isApplied).toBe(true)
  })
})
