import { describe, it, expect } from 'vitest'
import { summarizeDiff } from '@/app/system/audit-log/viewer/helpers/summarize-diff'

describe('summarizeDiff', () => {
  it('returns create when from is null', () => {
    expect(summarizeDiff(null, { id: 1 })).toEqual({ kind: 'create' })
  })

  it('returns delete when to is null', () => {
    expect(summarizeDiff({ id: 1 }, null)).toEqual({ kind: 'delete' })
  })

  it('returns noChange when from and to are equal', () => {
    expect(summarizeDiff({ a: 1 }, { a: 1 })).toEqual({ kind: 'noChange' })
  })

  it('returns update with 1 change and no extras', () => {
    const r = summarizeDiff({ status: 'pending' }, { status: 'paid' })
    expect(r).toEqual({
      kind: 'update',
      changes: [{ key: 'status', from: 'pending', to: 'paid' }],
      extra: 0,
    })
  })

  it('returns first 2 changes with extra count for more', () => {
    const r = summarizeDiff(
      { a: 1, b: 1, c: 1, d: 1 },
      { a: 2, b: 2, c: 2, d: 2 },
    )
    expect(r.kind).toBe('update')
    if (r.kind !== 'update') return
    expect(r.changes).toHaveLength(2)
    expect(r.extra).toBe(2)
  })

  it('treats both null as noChange', () => {
    expect(summarizeDiff(null, null)).toEqual({ kind: 'noChange' })
  })
})
