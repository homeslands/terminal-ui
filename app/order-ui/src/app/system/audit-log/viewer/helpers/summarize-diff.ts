export type DiffSummary =
  | { kind: 'create' }
  | { kind: 'delete' }
  | { kind: 'noChange' }
  | {
      kind: 'update'
      changes: Array<{ key: string; from: unknown; to: unknown }>
      extra: number
    }

type Obj = Record<string, unknown> | null

const SUMMARY_LIMIT = 2

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

export function summarizeDiff(from: Obj, to: Obj): DiffSummary {
  if (from == null && to == null) return { kind: 'noChange' }
  if (from == null) return { kind: 'create' }
  if (to == null) return { kind: 'delete' }

  const keys = new Set([...Object.keys(from), ...Object.keys(to)])
  const all: Array<{ key: string; from: unknown; to: unknown }> = []
  for (const key of keys) {
    if (!isEqual(from[key], to[key])) {
      all.push({ key, from: from[key], to: to[key] })
    }
  }
  if (all.length === 0) return { kind: 'noChange' }
  return {
    kind: 'update',
    changes: all.slice(0, SUMMARY_LIMIT),
    extra: Math.max(0, all.length - SUMMARY_LIMIT),
  }
}
