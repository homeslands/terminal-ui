import { describe, it, expect } from 'vitest'
import { computeFieldDiff } from '@/app/system/audit-log/viewer/helpers/compute-field-diff'

describe('computeFieldDiff', () => {
  it('marks key only present in to as added', () => {
    expect(computeFieldDiff({}, { a: 1 })).toEqual([
      { key: 'a', from: undefined, to: 1, kind: 'added' },
    ])
  })

  it('marks key only present in from as removed', () => {
    expect(computeFieldDiff({ a: 1 }, {})).toEqual([
      { key: 'a', from: 1, to: undefined, kind: 'removed' },
    ])
  })

  it('marks key with different value as changed', () => {
    expect(computeFieldDiff({ a: 1 }, { a: 2 })).toEqual([
      { key: 'a', from: 1, to: 2, kind: 'changed' },
    ])
  })

  it('omits unchanged keys', () => {
    expect(computeFieldDiff({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual([
      { key: 'b', from: 2, to: 3, kind: 'changed' },
    ])
  })

  it('handles nested objects via JSON equality', () => {
    expect(
      computeFieldDiff({ a: { x: 1 } }, { a: { x: 1 } }),
    ).toEqual([])
    expect(
      computeFieldDiff({ a: { x: 1 } }, { a: { x: 2 } })[0].kind,
    ).toBe('changed')
  })

  it('treats null inputs as empty record', () => {
    expect(computeFieldDiff(null, { a: 1 })).toEqual([
      { key: 'a', from: undefined, to: 1, kind: 'added' },
    ])
    expect(computeFieldDiff({ a: 1 }, null)).toEqual([
      { key: 'a', from: 1, to: undefined, kind: 'removed' },
    ])
  })
})
