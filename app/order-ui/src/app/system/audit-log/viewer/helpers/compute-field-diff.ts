export type FieldDiffKind = 'added' | 'removed' | 'changed'

export interface FieldDiff {
  key: string
  from: unknown
  to: unknown
  kind: FieldDiffKind
}

type Obj = Record<string, unknown> | null

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export function computeFieldDiff(from: Obj, to: Obj): FieldDiff[] {
  const f = from ?? {}
  const t = to ?? {}
  const keys = new Set([...Object.keys(f), ...Object.keys(t)])
  const result: FieldDiff[] = []
  for (const key of keys) {
    const inFrom = key in f
    const inTo = key in t
    if (inFrom && !inTo) {
      result.push({ key, from: f[key], to: undefined, kind: 'removed' })
    } else if (!inFrom && inTo) {
      result.push({ key, from: undefined, to: t[key], kind: 'added' })
    } else if (!isEqual(f[key], t[key])) {
      result.push({ key, from: f[key], to: t[key], kind: 'changed' })
    }
  }
  return result
}
