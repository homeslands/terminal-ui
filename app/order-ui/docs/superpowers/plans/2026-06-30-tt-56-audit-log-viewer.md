# TT-56 — Audit Log Viewer + Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Audit Log Viewer + Config screens at `/system/audit-log` (one route, two tabs) per spec `docs/superpowers/specs/2026-06-30-tt-56-audit-log-viewer-design.md`.

**Architecture:** Single page with URL-controlled tabs (`?tab=viewer|config`). Viewer = DataTable + filter bar + side sheet for diff. Config = DataTable + Switch + destructive confirm on disable. Data via TanStack Query with optimistic update for the config mutation.

**Tech Stack:** React 18, TanStack Query, react-router-dom v6, react-table, shadcn UI (Sheet, AlertDialog, Switch, Popover, Command), Tailwind, react-hook-form (not needed here), i18next, vitest + @testing-library/react, moment, axios via `src/utils/http.ts`.

## Global Constraints

- Branch: `feature/TT-56-FE-Implement-Audit-Log-Viewer-Screen`.
- Spec authority: `docs/superpowers/specs/2026-06-30-tt-56-audit-log-viewer-design.md` — every behavioral decision (roles, tab visibility, destructive confirm only on disable, entity dropdown shows all + disabled badge, etc.) is defined there.
- All API calls go through `src/utils/http.ts` (`http` instance). Never use `axios` directly.
- Roles enum values: `Role.SUPER_ADMIN`, `Role.ADMIN`, `Role.MANAGER` (from `src/constants/role.ts`).
- Event values are case-sensitive: `'Create' | 'Update' | 'Delete'`.
- BE param name for date range is unconfirmed; this plan uses `fromDate`/`toDate` and the final task includes a manual BE verification step.
- i18n namespace: `auditLog`. Helmet additions go in the existing `helmet` namespace.
- Sidebar permission backend key for audit is unknown; plan uses placeholder `'AUDIT_LOG'`, with a manual BE confirmation note in the final task.
- Pattern reference: `src/app/system/logger/` (DataTable + filters folder layout).
- Tests live in `src/tests/{hooks,utils,components}/` (pattern already used by `use-vat-admin.test.tsx`). Pure helpers live next to their consumer; their tests sit under `src/tests/utils/audit-log/`.
- Commit convention: `TaskId: TT-56 (<step>) <short message>` per recent commits on this repo.

---

## File Structure

**Create:**
- `src/types/audit-log.type.ts`
- `src/api/audit-log.ts`
- `src/hooks/use-audit-log.ts`
- `src/app/system/audit-log/index.ts`
- `src/app/system/audit-log/audit-log-page.tsx`
- `src/app/system/audit-log/viewer/viewer-tab.tsx`
- `src/app/system/audit-log/viewer/DataTable/columns.tsx`
- `src/app/system/audit-log/viewer/filters/user-combobox.tsx`
- `src/app/system/audit-log/viewer/filters/entity-select.tsx`
- `src/app/system/audit-log/viewer/filters/event-select.tsx`
- `src/app/system/audit-log/viewer/filters/date-range-filter.tsx`
- `src/app/system/audit-log/viewer/detail-sheet.tsx`
- `src/app/system/audit-log/viewer/helpers/summarize-diff.ts`
- `src/app/system/audit-log/viewer/helpers/compute-field-diff.ts`
- `src/app/system/audit-log/config/config-tab.tsx`
- `src/app/system/audit-log/config/disable-confirm-dialog.tsx`
- `src/components/app/badge/audit-event-badge.tsx`
- `src/locales/en/auditLog.json`
- `src/locales/vi/auditLog.json`
- `src/tests/utils/audit-log/summarize-diff.test.ts`
- `src/tests/utils/audit-log/compute-field-diff.test.ts`
- `src/tests/hooks/use-audit-log.test.tsx`
- `src/tests/components/audit-log-page.test.tsx`
- `src/tests/components/audit-log-entity-select.test.tsx`
- `src/tests/components/audit-log-disable-confirm.test.tsx`

**Modify:**
- `src/types/index.ts` (re-export)
- `src/api/index.ts` (re-export)
- `src/hooks/index.ts` (re-export)
- `src/constants/query.ts` (add `auditLogs`, `auditLogConfigs`)
- `src/constants/route.ts` (add `STAFF_AUDIT_LOG`)
- `src/constants/sidebar-permission.ts` (add `AUDIT_LOG`)
- `src/constants/role.ts` (`RoutePermissions` entry)
- `src/components/app/badge/index.tsx` (export `AuditEventBadge`)
- `src/router/loadable.tsx` (lazy `AuditLogPage`)
- `src/router/index.tsx` (add route block + import)
- `src/app/layouts/system/components/app-sidebar.tsx` (sidebar entry)
- `src/locales/{en,vi}/helmet.json` (`auditLog` key)
- `src/locales/{en,vi}/sidebar.json` (`auditLog` key)
- `src/locales/{en,vi}/route.json` (route label, if file follows pattern)
- `src/i18n.ts` (register `auditLog` namespace in 3 places)

---

### Task 1: Types, query keys, route constant, sidebar permission

**Files:**
- Create: `src/types/audit-log.type.ts`
- Modify: `src/types/index.ts`
- Modify: `src/constants/query.ts`
- Modify: `src/constants/route.ts`
- Modify: `src/constants/sidebar-permission.ts`

**Interfaces:**
- Consumes: `IQuery`, `IApiResponse`, `IPaginationResponse` from `@/types/base.type.ts`.
- Produces:
  - Types `IAuditLog`, `TAuditEvent`, `IAuditLogQuery`, `IAuditLogConfig`, `IUpdateAuditLogConfigRequest`.
  - `QUERYKEY.auditLogs: ['audit-logs']`, `QUERYKEY.auditLogConfigs: ['audit-log-configs']`.
  - `ROUTE.STAFF_AUDIT_LOG: '/system/audit-log'`.
  - `Permission.AUDIT_LOG = 'AUDIT_LOG'`.

- [ ] **Step 1: Create `src/types/audit-log.type.ts`**

```ts
import { IQuery } from './base.type'

export type TAuditEvent = 'Create' | 'Update' | 'Delete'

export interface IAuditLog {
  slug: string
  createdAt: string
  userSlug: string
  user: string
  event: TAuditEvent
  entity: string
  from: Record<string, unknown> | null
  to: Record<string, unknown> | null
}

export interface IAuditLogQuery extends IQuery {
  user?: string
  entity?: string
  event?: TAuditEvent
  fromDate?: string
  toDate?: string
}

export interface IAuditLogConfig {
  slug: string
  entity: string
  enabled: boolean
  createdAt: string
  updatedAt?: string
}

export interface IUpdateAuditLogConfigRequest {
  slug: string
  enabled: boolean
}
```

- [ ] **Step 2: Re-export from `src/types/index.ts`**

Add line near the other exports:

```ts
export * from './audit-log.type'
```

- [ ] **Step 3: Add query keys to `src/constants/query.ts`**

Inside the `QUERYKEY` object (just after `logs: ['logs']`):

```ts
  auditLogs: ['audit-logs'],
  auditLogConfigs: ['audit-log-configs'],
```

- [ ] **Step 4: Add route to `src/constants/route.ts`**

Add the constant alongside other `STAFF_*` routes (near `STAFF_LOG_MANAGEMENT`):

```ts
  STAFF_AUDIT_LOG: '/system/audit-log',
```

- [ ] **Step 5: Add sidebar permission key to `src/constants/sidebar-permission.ts`**

Append inside the `Permission` enum:

```ts
  AUDIT_LOG = 'AUDIT_LOG',
```

- [ ] **Step 6: TypeScript sanity check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/audit-log.type.ts src/types/index.ts \
  src/constants/query.ts src/constants/route.ts src/constants/sidebar-permission.ts
git commit -m "TaskId: TT-56 (1) Add audit-log types, query keys, route + sidebar permission"
```

---

### Task 2: API layer + hooks (with optimistic update tests)

**Files:**
- Create: `src/api/audit-log.ts`
- Create: `src/hooks/use-audit-log.ts`
- Create: `src/tests/hooks/use-audit-log.test.tsx`
- Modify: `src/api/index.ts`
- Modify: `src/hooks/index.ts`

**Interfaces:**
- Consumes: types and query keys from Task 1, `http` from `@/utils`.
- Produces:
  - `getAuditLogs(params)`, `getAuditLogConfigs()`, `updateAuditLogConfig(body)`.
  - Hooks `useAuditLogs(q)`, `useAuditLogConfigs()`, `useUpdateAuditLogConfig()` — the mutation flips the `enabled` field optimistically and rolls back on error.

- [ ] **Step 1: Create `src/api/audit-log.ts`**

```ts
import {
  IApiResponse,
  IAuditLog,
  IAuditLogConfig,
  IAuditLogQuery,
  IPaginationResponse,
  IUpdateAuditLogConfigRequest,
} from '@/types'
import { http } from '@/utils'

export async function getAuditLogs(
  params: IAuditLogQuery,
): Promise<IApiResponse<IPaginationResponse<IAuditLog>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<IAuditLog>>>(
    '/audit-logs',
    { doNotShowLoading: true, params },
  )
  return response.data
}

export async function getAuditLogConfigs(): Promise<
  IApiResponse<IAuditLogConfig[]>
> {
  const response = await http.get<IApiResponse<IAuditLogConfig[]>>(
    '/audit-logs-config',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function updateAuditLogConfig(
  body: IUpdateAuditLogConfigRequest,
): Promise<IApiResponse<IAuditLogConfig>> {
  const response = await http.patch<IApiResponse<IAuditLogConfig>>(
    '/audit-logs-config',
    body,
  )
  return response.data
}
```

- [ ] **Step 2: Re-export from `src/api/index.ts`**

```ts
export * from './audit-log'
```

- [ ] **Step 3: Create `src/hooks/use-audit-log.ts`**

```ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  getAuditLogConfigs,
  getAuditLogs,
  updateAuditLogConfig,
} from '@/api'
import { QUERYKEY } from '@/constants'
import {
  IApiResponse,
  IAuditLogConfig,
  IAuditLogQuery,
} from '@/types'

export const useAuditLogs = (q: IAuditLogQuery) =>
  useQuery({
    queryKey: [...QUERYKEY.auditLogs, q],
    queryFn: () => getAuditLogs(q),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 10,
  })

export const useAuditLogConfigs = () =>
  useQuery({
    queryKey: QUERYKEY.auditLogConfigs,
    queryFn: getAuditLogConfigs,
  })

export const useUpdateAuditLogConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAuditLogConfig,
    onMutate: async ({ slug, enabled }) => {
      await qc.cancelQueries({ queryKey: QUERYKEY.auditLogConfigs })
      const prev = qc.getQueryData<IApiResponse<IAuditLogConfig[]>>(
        QUERYKEY.auditLogConfigs,
      )
      if (prev?.result) {
        qc.setQueryData<IApiResponse<IAuditLogConfig[]>>(
          QUERYKEY.auditLogConfigs,
          {
            ...prev,
            result: prev.result.map((c) =>
              c.slug === slug ? { ...c, enabled } : c,
            ),
          },
        )
      }
      return { prev }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(QUERYKEY.auditLogConfigs, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERYKEY.auditLogConfigs })
    },
  })
}
```

- [ ] **Step 4: Re-export from `src/hooks/index.ts`**

```ts
export * from './use-audit-log'
```

- [ ] **Step 5: Write hook tests `src/tests/hooks/use-audit-log.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import * as api from '@/api/audit-log'
import {
  useAuditLogs,
  useAuditLogConfigs,
  useUpdateAuditLogConfig,
} from '@/hooks/use-audit-log'
import { QUERYKEY } from '@/constants'
import { IApiResponse, IAuditLogConfig } from '@/types'

vi.mock('@/api/audit-log')

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

describe('useAuditLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls getAuditLogs with the provided query', async () => {
    vi.mocked(api.getAuditLogs).mockResolvedValue({
      message: '',
      statusCode: 200,
      result: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
    } as never)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useAuditLogs({ page: 1, size: 10, event: 'Update' }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.getAuditLogs).toHaveBeenCalledWith({
      page: 1,
      size: 10,
      event: 'Update',
    })
  })
})

describe('useUpdateAuditLogConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('optimistically flips enabled then rolls back on error', async () => {
    const { qc, Wrapper } = makeWrapper()
    const seed: IApiResponse<IAuditLogConfig[]> = {
      message: '',
      statusCode: 200,
      result: [
        { slug: 'cfg-1', entity: 'Order', enabled: true, createdAt: '' },
      ],
    }
    qc.setQueryData(QUERYKEY.auditLogConfigs, seed)
    vi.mocked(api.updateAuditLogConfig).mockRejectedValue(
      new Error('boom'),
    )

    const { result } = renderHook(() => useUpdateAuditLogConfig(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      result.current.mutate({ slug: 'cfg-1', enabled: false })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const after = qc.getQueryData<IApiResponse<IAuditLogConfig[]>>(
      QUERYKEY.auditLogConfigs,
    )
    expect(after?.result?.[0].enabled).toBe(true) // rolled back
  })

  it('keeps optimistic value on success and invalidates query', async () => {
    const { qc, Wrapper } = makeWrapper()
    const seed: IApiResponse<IAuditLogConfig[]> = {
      message: '',
      statusCode: 200,
      result: [
        { slug: 'cfg-1', entity: 'Order', enabled: true, createdAt: '' },
      ],
    }
    qc.setQueryData(QUERYKEY.auditLogConfigs, seed)
    vi.mocked(api.getAuditLogConfigs).mockResolvedValue(seed as never)
    vi.mocked(api.updateAuditLogConfig).mockResolvedValue({
      message: '',
      statusCode: 200,
      result: { slug: 'cfg-1', entity: 'Order', enabled: false, createdAt: '' },
    } as never)

    const { result } = renderHook(() => useUpdateAuditLogConfig(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      result.current.mutate({ slug: 'cfg-1', enabled: false })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const after = qc.getQueryData<IApiResponse<IAuditLogConfig[]>>(
      QUERYKEY.auditLogConfigs,
    )
    expect(after?.result?.[0].enabled).toBe(false)
  })
})

describe('useAuditLogConfigs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches configs', async () => {
    vi.mocked(api.getAuditLogConfigs).mockResolvedValue({
      message: '',
      statusCode: 200,
      result: [],
    } as never)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useAuditLogConfigs(), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.getAuditLogConfigs).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/tests/hooks/use-audit-log.test.tsx`
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add src/api/audit-log.ts src/api/index.ts \
  src/hooks/use-audit-log.ts src/hooks/index.ts \
  src/tests/hooks/use-audit-log.test.tsx
git commit -m "TaskId: TT-56 (2) Add audit-log API + hooks with optimistic update"
```

---

### Task 3: Pure diff helpers (`summarizeDiff`, `computeFieldDiff`)

**Files:**
- Create: `src/app/system/audit-log/viewer/helpers/summarize-diff.ts`
- Create: `src/app/system/audit-log/viewer/helpers/compute-field-diff.ts`
- Create: `src/tests/utils/audit-log/summarize-diff.test.ts`
- Create: `src/tests/utils/audit-log/compute-field-diff.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `summarizeDiff(from, to): DiffSummary` — discriminated union `{ kind: 'create' | 'delete' | 'noChange' } | { kind: 'update', changes: Array<{key,from,to}>, extra: number }`.
  - `computeFieldDiff(from, to): Array<{ key, from, to, kind: 'added' | 'removed' | 'changed' }>` — used by `DetailSheet`.

- [ ] **Step 1: Write failing tests for `summarize-diff`**

`src/tests/utils/audit-log/summarize-diff.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to confirm fail**

Run: `npx vitest run src/tests/utils/audit-log/summarize-diff.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `summarize-diff.ts`**

`src/app/system/audit-log/viewer/helpers/summarize-diff.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/utils/audit-log/summarize-diff.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Write failing tests for `compute-field-diff`**

`src/tests/utils/audit-log/compute-field-diff.test.ts`:

```ts
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
```

- [ ] **Step 6: Run to confirm fail**

Run: `npx vitest run src/tests/utils/audit-log/compute-field-diff.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 7: Implement `compute-field-diff.ts`**

`src/app/system/audit-log/viewer/helpers/compute-field-diff.ts`:

```ts
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
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/tests/utils/audit-log/`
Expected: 12 passed (6 + 6).

- [ ] **Step 9: Commit**

```bash
git add src/app/system/audit-log/viewer/helpers/ \
  src/tests/utils/audit-log/
git commit -m "TaskId: TT-56 (3) Add pure diff helpers (summarize + field diff) with tests"
```

---

### Task 4: `AuditEventBadge` component

**Files:**
- Create: `src/components/app/badge/audit-event-badge.tsx`
- Modify: `src/components/app/badge/index.tsx`

**Interfaces:**
- Consumes: `TAuditEvent` from Task 1.
- Produces: `AuditEventBadge` component with prop `{ event: TAuditEvent }`.

- [ ] **Step 1: Implement badge**

`src/components/app/badge/audit-event-badge.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

import { TAuditEvent } from '@/types'

interface IProps {
  event: TAuditEvent
}

const colorFor = (event: TAuditEvent) => {
  switch (event) {
    case 'Create':
      return 'border-green-500 border text-green-600'
    case 'Update':
      return 'border-blue-500 border text-blue-600'
    case 'Delete':
      return 'border-destructive border text-destructive'
    default:
      return 'border-gray-400 border text-gray-500'
  }
}

export default function AuditEventBadge({ event }: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <span
      className={`inline-block min-w-[5rem] px-1.5 py-1 text-center text-xs rounded-full ${colorFor(
        event,
      )}`}
    >
      {t(`auditLog.event.${event}`, event)}
    </span>
  )
}
```

- [ ] **Step 2: Re-export from `src/components/app/badge/index.tsx`**

Add:

```ts
export { default as AuditEventBadge } from './audit-event-badge'
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/badge/audit-event-badge.tsx \
  src/components/app/badge/index.tsx
git commit -m "TaskId: TT-56 (4) Add AuditEventBadge"
```

---

### Task 5: Filter components (Event, Entity, User, DateRange)

**Files:**
- Create: `src/app/system/audit-log/viewer/filters/event-select.tsx`
- Create: `src/app/system/audit-log/viewer/filters/entity-select.tsx`
- Create: `src/app/system/audit-log/viewer/filters/user-combobox.tsx`
- Create: `src/app/system/audit-log/viewer/filters/date-range-filter.tsx`

**Interfaces:**
- Consumes: `useAuditLogConfigs` (Task 2), `useUsers` (existing), `useDebouncedValue` (existing), `Select`/`Popover`/`Command`/`Switch` from shadcn UI, `SimpleDatePicker` from `@/components/app/picker`.
- Produces:
  - `EventSelect`: props `{ value?: TAuditEvent; onChange: (v: TAuditEvent | undefined) => void }`.
  - `EntitySelect`: props `{ value?: string; onChange: (v: string | undefined) => void }` — pulls list from `useAuditLogConfigs()`; appends "(đã tắt)" suffix for `enabled=false`.
  - `UserCombobox`: props `{ value?: { slug: string; label: string }; onChange: (v?: { slug: string; label: string }) => void }`.
  - `DateRangeFilter`: props `{ value: { fromDate?: string; toDate?: string }; onChange: (v: { fromDate?: string; toDate?: string }) => void }` — outputs ISO strings.

- [ ] **Step 1: Implement `event-select.tsx`**

```tsx
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TAuditEvent } from '@/types'

interface IProps {
  value?: TAuditEvent
  onChange: (v: TAuditEvent | undefined) => void
}

const ALL = '__all__'
const EVENTS: TAuditEvent[] = ['Create', 'Update', 'Delete']

export function EventSelect({ value, onChange }: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : (v as TAuditEvent))}
    >
      <SelectTrigger className="w-[10rem]">
        <SelectValue placeholder={t('auditLog.filter.event')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t('auditLog.filter.entityAll')}</SelectItem>
        {EVENTS.map((e) => (
          <SelectItem key={e} value={e}>
            {t(`auditLog.event.${e}`, e)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 2: Implement `entity-select.tsx`**

```tsx
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuditLogConfigs } from '@/hooks'

interface IProps {
  value?: string
  onChange: (v: string | undefined) => void
}

const ALL = '__all__'

export function EntitySelect({ value, onChange }: IProps) {
  const { t } = useTranslation('auditLog')
  const { data } = useAuditLogConfigs()
  const items = data?.result ?? []

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : v)}
    >
      <SelectTrigger className="w-[12rem]">
        <SelectValue placeholder={t('auditLog.filter.entity')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t('auditLog.filter.entityAll')}</SelectItem>
        {items.map((cfg) => (
          <SelectItem key={cfg.slug} value={cfg.entity}>
            {cfg.entity}
            {!cfg.enabled && (
              <span className="ml-1 text-xs text-muted-foreground">
                {t('auditLog.filter.entityDisabled')}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 3: Implement `user-combobox.tsx`**

`@/components/ui/command` is not present in this codebase — follow the
`Input + Popover` pattern used by `src/components/staff/staff-customer-search-input.tsx`.

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsUpDown, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useDebouncedValue, useUsers } from '@/hooks'

export interface UserOption {
  slug: string
  label: string
}

interface IProps {
  value?: UserOption
  onChange: (v?: UserOption) => void
}

export function UserCombobox({ value, onChange }: IProps) {
  const { t } = useTranslation('auditLog')
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const debounced = useDebouncedValue(keyword, 300)

  const { data } = useUsers(
    open
      ? {
          phonenumber: debounced,
          order: 'DESC',
          hasPaging: true,
          page: 1,
          size: 20,
        }
      : null,
    open,
  )

  const items = (data?.result?.items ?? []) as Array<{
    slug: string
    firstName?: string
    lastName?: string
    phonenumber?: string
  }>

  const labelOf = (u: typeof items[number]) =>
    `${[u.firstName, u.lastName].filter(Boolean).join(' ').trim() || '—'}${
      u.phonenumber ? ` — ${u.phonenumber}` : ''
    }`

  useEffect(() => {
    if (!open) setKeyword('')
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-[16rem] justify-between"
        >
          <span className="truncate">
            {value?.label ?? t('auditLog.filter.userPlaceholder')}
          </span>
          {value ? (
            <X
              className="ml-2 h-4 w-4 opacity-60"
              onClick={(e) => {
                e.stopPropagation()
                onChange(undefined)
              }}
            />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[16rem] p-0">
        <div className="p-2 border-b">
          <Input
            placeholder={t('auditLog.filter.userPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoFocus
          />
        </div>
        <div
          className="max-h-64 overflow-y-auto"
          role="listbox"
          aria-label={t('auditLog.filter.user')}
        >
          {items.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              {t('auditLog.filter.userEmpty')}
            </div>
          ) : (
            items.map((u) => {
              const opt: UserOption = { slug: u.slug, label: labelOf(u) }
              const selected = value?.slug === u.slug
              return (
                <button
                  type="button"
                  key={u.slug}
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                    selected ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 4: Implement `date-range-filter.tsx`**

```tsx
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { MoveRightIcon } from 'lucide-react'

import { SimpleDatePicker } from '@/components/app/picker'

interface IProps {
  value: { fromDate?: string; toDate?: string }
  onChange: (v: { fromDate?: string; toDate?: string }) => void
}

const toIsoStart = (d?: string) =>
  d ? moment(d, 'YYYY-MM-DD').startOf('day').toISOString() : undefined
const toIsoEnd = (d?: string) =>
  d ? moment(d, 'YYYY-MM-DD').endOf('day').toISOString() : undefined
const fromIso = (iso?: string) =>
  iso ? moment(iso).format('YYYY-MM-DD') : ''

export function DateRangeFilter({ value, onChange }: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <div
      className="flex items-center gap-2"
      aria-label={t('auditLog.filter.date')}
    >
      <SimpleDatePicker
        value={fromIso(value.fromDate)}
        onChange={(d) => onChange({ ...value, fromDate: toIsoStart(d) })}
        disableFutureDates
      />
      <MoveRightIcon className="h-4 w-4 text-muted-foreground" />
      <SimpleDatePicker
        value={fromIso(value.toDate)}
        onChange={(d) => onChange({ ...value, toDate: toIsoEnd(d) })}
        disableFutureDates
      />
    </div>
  )
}
```

- [ ] **Step 5: Write test for `EntitySelect` disabled badge**

Create `src/tests/components/audit-log-entity-select.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/hooks', () => ({
  useAuditLogConfigs: () => ({
    data: {
      result: [
        { slug: 's1', entity: 'Order', enabled: true, createdAt: '' },
        { slug: 's2', entity: 'User', enabled: false, createdAt: '' },
      ],
    },
  }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { EntitySelect } from '@/app/system/audit-log/viewer/filters/entity-select'

describe('EntitySelect', () => {
  it('renders disabled badge for configs with enabled=false', async () => {
    const onChange = vi.fn()
    render(<EntitySelect value={undefined} onChange={onChange} />)
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('Order')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('auditLog.filter.entityDisabled')).toBeInTheDocument()
  })

  it('calls onChange with undefined when picking "all"', async () => {
    const onChange = vi.fn()
    render(<EntitySelect value="Order" onChange={onChange} />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByText('auditLog.filter.entityAll'))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})
```

- [ ] **Step 6: Run filter tests**

Run: `npx vitest run src/tests/components/audit-log-entity-select.test.tsx`
Expected: 2 passed.

- [ ] **Step 7: TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: no errors. `IUserQuery` requires `order` and that field is supplied as `'DESC'` in the `useUsers` call.

- [ ] **Step 8: Commit**

```bash
git add src/app/system/audit-log/viewer/filters/ \
  src/tests/components/audit-log-entity-select.test.tsx
git commit -m "TaskId: TT-56 (5) Add audit log filter components + tests"
```

---

### Task 6: Viewer `DetailSheet`

**Files:**
- Create: `src/app/system/audit-log/viewer/detail-sheet.tsx`

**Interfaces:**
- Consumes: `IAuditLog` (Task 1), `computeFieldDiff` (Task 3), `AuditEventBadge` (Task 4), `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `@/components/ui/sheet`, `ScrollArea` from `@/components/ui/scroll-area`, `Button` from `@/components/ui/button`.
- Produces: `DetailSheet` component with props `{ log: IAuditLog | null; open: boolean; onOpenChange: (open: boolean) => void }`.

- [ ] **Step 1: Implement `detail-sheet.tsx`**

```tsx
import moment from 'moment'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'

import { AuditEventBadge } from '@/components/app/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { IAuditLog } from '@/types'

import { computeFieldDiff } from './helpers/compute-field-diff'

interface IProps {
  log: IAuditLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const renderValue = (v: unknown) => {
  if (v === undefined) return <span className="text-muted-foreground">—</span>
  if (v === null) return <span className="text-muted-foreground">null</span>
  if (typeof v === 'object') {
    return (
      <pre className="whitespace-pre-wrap break-all text-xs">
        {JSON.stringify(v, null, 2)}
      </pre>
    )
  }
  return <span>{String(v)}</span>
}

export function DetailSheet({ log, open, onOpenChange }: IProps) {
  const { t } = useTranslation('auditLog')
  const [rawOpen, setRawOpen] = useState(false)
  if (!log) return null
  const diff = computeFieldDiff(log.from, log.to)

  const copyRaw = () =>
    navigator.clipboard?.writeText(
      JSON.stringify({ from: log.from, to: log.to }, null, 2),
    )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AuditEventBadge event={log.event} />
            <span>{log.entity}</span>
          </SheetTitle>
          <div className="text-sm text-muted-foreground">
            {moment(log.createdAt).format('HH:mm DD/MM/YYYY')} — {log.user}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4 pr-2">
          {diff.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {t('auditLog.sheet.noChange')}
            </div>
          ) : (
            <div className="space-y-3">
              {diff.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[8rem_1fr_1fr] gap-2 items-start"
                >
                  <div className="text-sm font-semibold">{row.key}</div>
                  <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded text-sm">
                    <div className="text-xs uppercase text-muted-foreground mb-1">
                      {t('auditLog.sheet.before')}
                    </div>
                    {renderValue(row.from)}
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded text-sm">
                    <div className="text-xs uppercase text-muted-foreground mb-1">
                      {t('auditLog.sheet.after')}
                    </div>
                    {renderValue(row.to)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 border-t pt-3">
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium"
              onClick={() => setRawOpen((v) => !v)}
            >
              {rawOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              {t('auditLog.sheet.rawJson')}
            </button>
            {rawOpen && (
              <div className="mt-2 space-y-2">
                <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap break-all">
                  {JSON.stringify({ from: log.from, to: log.to }, null, 2)}
                </pre>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyRaw}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {t('auditLog.sheet.copyRaw')}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/system/audit-log/viewer/detail-sheet.tsx
git commit -m "TaskId: TT-56 (6) Add audit log detail sheet"
```

---

### Task 7: Viewer tab — DataTable columns + filter bar + URL sync

**Files:**
- Create: `src/app/system/audit-log/viewer/DataTable/columns.tsx`
- Create: `src/app/system/audit-log/viewer/viewer-tab.tsx`

**Interfaces:**
- Consumes: `useAuditLogs` (Task 2), `useAuditLogConfigs` (Task 2), filters from Task 5, `DetailSheet` (Task 6), `AuditEventBadge` (Task 4), `summarizeDiff` (Task 3), `DataTable` + `DataTableColumnHeader` from `@/components/ui`, `usePagination` from `@/hooks`.
- Produces: `ViewerTab` default-export React component.

- [ ] **Step 1: Implement columns**

`src/app/system/audit-log/viewer/DataTable/columns.tsx`:

```tsx
import moment from 'moment'
import { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { AuditEventBadge } from '@/components/app/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/ui'
import { IAuditLog, IAuditLogConfig } from '@/types'

import { summarizeDiff, DiffSummary } from '../helpers/summarize-diff'

const summaryToText = (
  s: DiffSummary,
  t: (k: string, opts?: Record<string, unknown>) => string,
) => {
  switch (s.kind) {
    case 'create':
      return t('auditLog.summary.created')
    case 'delete':
      return t('auditLog.summary.deleted')
    case 'noChange':
      return t('auditLog.sheet.noChange')
    case 'update': {
      const head = s.changes
        .map((c) => `${c.key}: ${String(c.from)} → ${String(c.to)}`)
        .join(', ')
      return s.extra > 0
        ? t('auditLog.summary.updateWithExtra', { head, count: s.extra })
        : head
    }
  }
}

interface UseColumnsArgs {
  configs: IAuditLogConfig[]
  onShowDetail: (row: IAuditLog) => void
}

export const useViewerColumns = ({
  configs,
  onShowDetail,
}: UseColumnsArgs): ColumnDef<IAuditLog>[] => {
  const { t } = useTranslation('auditLog')
  const disabledEntitySet = new Set(
    configs.filter((c) => !c.enabled).map((c) => c.entity),
  )

  return [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('auditLog.col.createdAt')}
        />
      ),
      cell: ({ row }) =>
        moment(row.original.createdAt).format('HH:mm DD/MM/YYYY'),
    },
    {
      accessorKey: 'user',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('auditLog.col.user')}
        />
      ),
      cell: ({ row }) => (
        <span title={row.original.userSlug}>{row.original.user}</span>
      ),
    },
    {
      accessorKey: 'event',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('auditLog.col.event')}
        />
      ),
      cell: ({ row }) => <AuditEventBadge event={row.original.event} />,
    },
    {
      accessorKey: 'entity',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('auditLog.col.entity')}
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <span>{row.original.entity}</span>
          {disabledEntitySet.has(row.original.entity) && (
            <span className="text-xs text-muted-foreground">
              {t('auditLog.filter.entityDisabled')}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'summary',
      header: () => <span>{t('auditLog.col.summary')}</span>,
      cell: ({ row }) => {
        const summary = summarizeDiff(row.original.from, row.original.to)
        return (
          <div className="max-w-[20rem] truncate text-sm">
            {summaryToText(summary, t)}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: () => <span>{t('auditLog.col.action')}</span>,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onShowDetail(row.original)}
        >
          {t('auditLog.col.action')}
        </Button>
      ),
    },
  ]
}
```

- [ ] **Step 2: Implement `viewer-tab.tsx`**

`src/app/system/audit-log/viewer/viewer-tab.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui'
import { useAuditLogConfigs, useAuditLogs, usePagination } from '@/hooks'
import { IAuditLog, TAuditEvent } from '@/types'

import { DetailSheet } from './detail-sheet'
import { EntitySelect } from './filters/entity-select'
import { EventSelect } from './filters/event-select'
import { DateRangeFilter } from './filters/date-range-filter'
import { UserCombobox, UserOption } from './filters/user-combobox'
import { useViewerColumns } from './DataTable/columns'

interface Filters {
  user?: UserOption
  entity?: string
  event?: TAuditEvent
  fromDate?: string
  toDate?: string
}

export default function ViewerTab() {
  const { t } = useTranslation('auditLog')
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<Filters>({
    entity: searchParams.get('entity') ?? undefined,
    event: (searchParams.get('event') as TAuditEvent) ?? undefined,
    fromDate: searchParams.get('fromDate') ?? undefined,
    toDate: searchParams.get('toDate') ?? undefined,
    user: undefined,
  })
  const [selected, setSelected] = useState<IAuditLog | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const writeUrl = (next: Filters) => {
    const np = new URLSearchParams(searchParams)
    const setOrDel = (k: string, v?: string) => {
      if (v) np.set(k, v)
      else np.delete(k)
    }
    setOrDel('entity', next.entity)
    setOrDel('event', next.event)
    setOrDel('fromDate', next.fromDate)
    setOrDel('toDate', next.toDate)
    setOrDel('user', next.user?.slug)
    np.set('page', '1')
    setSearchParams(np, { replace: true })
  }
  const update = (patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      writeUrl(next)
      return next
    })
  }

  const { data, isLoading } = useAuditLogs({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    order: 'DESC',
    user: filters.user?.slug,
    entity: filters.entity,
    event: filters.event,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  })

  const { data: configsResp } = useAuditLogConfigs()
  const configs = configsResp?.result ?? []

  const columns = useViewerColumns({
    configs,
    onShowDetail: (row) => {
      setSelected(row)
      setSheetOpen(true)
    },
  })

  const items = useMemo(() => data?.result?.items ?? [], [data])

  const reset = () => update({
    user: undefined,
    entity: undefined,
    event: undefined,
    fromDate: undefined,
    toDate: undefined,
  })

  return (
    <div className="flex flex-col flex-1 w-full gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <UserCombobox
          value={filters.user}
          onChange={(v) => update({ user: v })}
        />
        <EntitySelect
          value={filters.entity}
          onChange={(v) => update({ entity: v })}
        />
        <EventSelect
          value={filters.event}
          onChange={(v) => update({ event: v })}
        />
        <DateRangeFilter
          value={{ fromDate: filters.fromDate, toDate: filters.toDate }}
          onChange={(v) => update(v)}
        />
        <Button variant="ghost" size="sm" onClick={reset}>
          {t('auditLog.filter.reset')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        pages={data?.result?.totalPages || 0}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <DetailSheet
        log={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/system/audit-log/viewer/DataTable/ \
  src/app/system/audit-log/viewer/viewer-tab.tsx
git commit -m "TaskId: TT-56 (7) Add audit log viewer tab + columns"
```

---

### Task 8: Config tab — `DisableConfirmDialog` + `ConfigTab`

**Files:**
- Create: `src/app/system/audit-log/config/disable-confirm-dialog.tsx`
- Create: `src/app/system/audit-log/config/config-tab.tsx`

**Interfaces:**
- Consumes: `useAuditLogConfigs`, `useUpdateAuditLogConfig` (Task 2), `AlertDialog*` from `@/components/ui/alert-dialog`, `Switch` from `@/components/ui/switch`, `DataTable` + `DataTableColumnHeader` from `@/components/ui`.
- Produces: `ConfigTab` default-export component.

- [ ] **Step 1: Implement `disable-confirm-dialog.tsx`**

`@/components/ui/alert-dialog` is not present in this codebase — use the standard `Dialog` primitive with a destructive button instead.

```tsx
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface IProps {
  open: boolean
  entity?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DisableConfirmDialog({
  open,
  entity,
  onOpenChange,
  onConfirm,
}: IProps) {
  const { t } = useTranslation('auditLog')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('auditLog.config.disableTitle')}</DialogTitle>
          <DialogDescription>
            {t('auditLog.config.disableBody', { entity: entity ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('auditLog.config.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {t('auditLog.config.disableConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Implement `config-tab.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ColumnDef } from '@tanstack/react-table'

import { DataTable, DataTableColumnHeader } from '@/components/ui'
import { Switch } from '@/components/ui/switch'
import {
  useAuditLogConfigs,
  useUpdateAuditLogConfig,
} from '@/hooks'
import { IAuditLogConfig } from '@/types'

import { DisableConfirmDialog } from './disable-confirm-dialog'

export default function ConfigTab() {
  const { t } = useTranslation('auditLog')
  const { data, isLoading } = useAuditLogConfigs()
  const mutation = useUpdateAuditLogConfig()
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<IAuditLogConfig | null>(null)

  const items = data?.result ?? []

  const runMutation = (row: IAuditLogConfig, enabled: boolean) => {
    setPending((p) => new Set(p).add(row.slug))
    mutation.mutate(
      { slug: row.slug, enabled },
      {
        onSettled: () =>
          setPending((p) => {
            const next = new Set(p)
            next.delete(row.slug)
            return next
          }),
      },
    )
  }

  const onToggle = (row: IAuditLogConfig, next: boolean) => {
    if (!next) setConfirm(row)
    else runMutation(row, true)
  }

  const columns: ColumnDef<IAuditLogConfig>[] = useMemo(
    () => [
      {
        accessorKey: 'entity',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('auditLog.config.colEntity')}
          />
        ),
        cell: ({ row }) => row.original.entity,
      },
      {
        accessorKey: 'enabled',
        header: () => (
          <span className="text-sm">
            {t('auditLog.config.colEnabled')}
          </span>
        ),
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            disabled={pending.has(row.original.slug)}
            onCheckedChange={(next) => onToggle(row.original, next)}
            aria-label={row.original.entity}
          />
        ),
      },
    ],
    [pending, t],
  )

  return (
    <div className="flex flex-col gap-3 w-full">
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        pages={0}
      />
      <DisableConfirmDialog
        open={!!confirm}
        entity={confirm?.entity}
        onOpenChange={(o) => {
          if (!o) setConfirm(null)
        }}
        onConfirm={() => {
          if (confirm) runMutation(confirm, false)
          setConfirm(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Write test for `DisableConfirmDialog`**

Create `src/tests/components/audit-log-disable-confirm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, string>) =>
      opts ? `${k}:${Object.values(opts).join(',')}` : k,
  }),
}))

import { DisableConfirmDialog } from '@/app/system/audit-log/config/disable-confirm-dialog'

describe('DisableConfirmDialog', () => {
  it('renders the entity name in the description', () => {
    render(
      <DisableConfirmDialog
        open
        entity="Order"
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(
      screen.getByText('auditLog.config.disableBody:Order'),
    ).toBeInTheDocument()
  })

  it('calls onConfirm when destructive action clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <DisableConfirmDialog
        open
        entity="Order"
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />,
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'auditLog.config.disableConfirm' }),
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/tests/components/audit-log-disable-confirm.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/system/audit-log/config/ \
  src/tests/components/audit-log-disable-confirm.test.tsx
git commit -m "TaskId: TT-56 (8) Add audit log config tab with destructive-confirm + tests"
```

---

### Task 9: `AuditLogPage` shell (Tabs + role guard + URL state) + component test

**Files:**
- Create: `src/app/system/audit-log/audit-log-page.tsx`
- Create: `src/app/system/audit-log/index.ts`
- Create: `src/tests/components/audit-log-page.test.tsx`

**Interfaces:**
- Consumes: `Tabs*` from `@/components/ui/tabs`, `useSearchParams`, `useCurrentRole`, `ViewerTab` (Task 7), `ConfigTab` (Task 8).
- Produces: `AuditLogPage` named export.

- [ ] **Step 1: Implement `audit-log-page.tsx`**

```tsx
import { useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { SquareMenu } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Role } from '@/constants/role'
import { useCurrentRole } from '@/hooks'

import ViewerTab from './viewer/viewer-tab'
import ConfigTab from './config/config-tab'

type TabValue = 'viewer' | 'config'

export function AuditLogPage() {
  const { t } = useTranslation('auditLog')
  const { t: tHelmet } = useTranslation('helmet')
  const role = useCurrentRole()
  const canViewLogs = role === Role.ADMIN || role === Role.SUPER_ADMIN

  const [searchParams, setSearchParams] = useSearchParams()
  const initial = (searchParams.get('tab') as TabValue) || (canViewLogs ? 'viewer' : 'config')
  const effectiveTab: TabValue = canViewLogs ? initial : 'config'

  useEffect(() => {
    if (searchParams.get('tab') !== effectiveTab) {
      const np = new URLSearchParams(searchParams)
      np.set('tab', effectiveTab)
      setSearchParams(np, { replace: true })
    }
  }, [effectiveTab, searchParams, setSearchParams])

  const onTabChange = (value: string) => {
    const np = new URLSearchParams(searchParams)
    np.set('tab', value)
    setSearchParams(np, { replace: true })
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.auditLog.title')}</title>
        <meta
          name="description"
          content={tHelmet('helmet.auditLog.title')}
        />
      </Helmet>
      <span className="flex gap-1 items-center text-lg">
        <SquareMenu />
        {t('auditLog.title')}
      </span>
      <Tabs
        value={effectiveTab}
        onValueChange={onTabChange}
        className="mt-2 flex flex-col flex-1"
      >
        <TabsList>
          {canViewLogs && (
            <TabsTrigger value="viewer">
              {t('auditLog.tab.viewer')}
            </TabsTrigger>
          )}
          <TabsTrigger value="config">{t('auditLog.tab.config')}</TabsTrigger>
        </TabsList>
        {canViewLogs && (
          <TabsContent value="viewer" className="flex-1">
            <ViewerTab />
          </TabsContent>
        )}
        <TabsContent value="config" className="flex-1">
          <ConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Add barrel export `src/app/system/audit-log/index.ts`**

```ts
export { AuditLogPage } from './audit-log-page'
```

- [ ] **Step 3: Write component test `src/tests/components/audit-log-page.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AuditLogPage } from '@/app/system/audit-log/audit-log-page'
import { Role } from '@/constants/role'

vi.mock('@/hooks/use-current-role', () => ({
  useCurrentRole: vi.fn(),
}))
vi.mock('@/hooks/use-audit-log', () => ({
  useAuditLogs: () => ({ data: undefined, isLoading: false }),
  useAuditLogConfigs: () => ({ data: { result: [] }, isLoading: false }),
  useUpdateAuditLogConfig: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/use-user', () => ({
  useUsers: () => ({ data: undefined }),
}))
vi.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: <T,>(v: T) => v,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  Trans: ({ children }: { children: ReactNode }) => children,
}))

import { useCurrentRole } from '@/hooks/use-current-role'

function renderWithUrl(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/system/audit-log" element={<AuditLogPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AuditLogPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Manager only sees the config tab', async () => {
    vi.mocked(useCurrentRole).mockReturnValue(Role.MANAGER)
    renderWithUrl('/system/audit-log')
    await waitFor(() =>
      expect(screen.getByText('auditLog.tab.config')).toBeInTheDocument(),
    )
    expect(screen.queryByText('auditLog.tab.viewer')).toBeNull()
  })

  it('Admin sees both tabs', async () => {
    vi.mocked(useCurrentRole).mockReturnValue(Role.ADMIN)
    renderWithUrl('/system/audit-log')
    expect(await screen.findByText('auditLog.tab.viewer')).toBeInTheDocument()
    expect(screen.getByText('auditLog.tab.config')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run component test**

Run: `npx vitest run src/tests/components/audit-log-page.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/system/audit-log/audit-log-page.tsx \
  src/app/system/audit-log/index.ts \
  src/tests/components/audit-log-page.test.tsx
git commit -m "TaskId: TT-56 (9) Add AuditLogPage shell + role-aware tabs"
```

---

### Task 10: Wire router, sidebar, i18n + browser smoke test

**Files:**
- Modify: `src/router/loadable.tsx`
- Modify: `src/router/index.tsx`
- Modify: `src/constants/role.ts`
- Modify: `src/router/routes.ts` (data source for sidebar entries)
- Modify: `src/i18n.ts`
- Modify: `src/locales/en/helmet.json`
- Modify: `src/locales/vi/helmet.json`
- Modify: `src/locales/en/sidebar.json`
- Modify: `src/locales/vi/sidebar.json`
- Create: `src/locales/en/auditLog.json`
- Create: `src/locales/vi/auditLog.json`

**Interfaces:**
- Consumes: `AuditLogPage` (Task 9), `STAFF_AUDIT_LOG` route constant (Task 1), `Permission.AUDIT_LOG` (Task 1).
- Produces: live route `/system/audit-log` accessible from sidebar.

- [ ] **Step 1: Add lazy loader**

Open `src/router/loadable.tsx`. Below the `LoggerPage` block add:

```ts
//Audit log page
export const AuditLogPage = React.lazy(() =>
  import('@/app/system/audit-log').then((module) => ({
    default: module.AuditLogPage,
  })),
)
```

- [ ] **Step 2: Register the route in `src/router/index.tsx`**

Add `AuditLogPage` to the existing top-level import block. Then add a new child block alongside the `STAFF_LOG_MANAGEMENT` block:

```tsx
{
  path: ROUTE.STAFF_AUDIT_LOG,
  element: (
    <Suspense fallback={<SkeletonCart />}>
      <SuspenseElement component={SystemLayout} />
    </Suspense>
  ),
  children: [
    {
      index: true,
      element: (
        <ProtectedElement
          allowedRoles={[Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER]}
          element={<SuspenseElement component={AuditLogPage} />}
        />
      ),
    },
  ],
},
```

If `Role` is not yet imported in this file, add `import { Role } from '@/constants/role'`.

- [ ] **Step 3: Add `RoutePermissions` entry in `src/constants/role.ts`**

Inside the `RoutePermissions` map, near `[ROUTE.STAFF_LOG_MANAGEMENT]`:

```ts
[ROUTE.STAFF_AUDIT_LOG]: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
```

- [ ] **Step 4: Create `src/locales/en/auditLog.json`**

```json
{
  "auditLog": {
    "title": "Audit history",
    "tab": { "viewer": "Change history", "config": "Tracking config" },
    "col": {
      "createdAt": "Time",
      "user": "Performed by",
      "event": "Event",
      "entity": "Entity",
      "summary": "Change summary",
      "action": "Details"
    },
    "event": { "Create": "Created", "Update": "Updated", "Delete": "Deleted" },
    "summary": {
      "created": "Created",
      "deleted": "Deleted",
      "updateWithExtra": "{{head}} (+{{count}} more)"
    },
    "filter": {
      "user": "User",
      "userPlaceholder": "Search by name or phone",
      "userEmpty": "No user found",
      "entity": "Entity",
      "entityAll": "All",
      "entityDisabled": "(disabled)",
      "event": "Event",
      "date": "Date range",
      "reset": "Reset filters"
    },
    "sheet": {
      "title": "Change detail",
      "before": "Before",
      "after": "After",
      "rawJson": "Raw payload",
      "copyRaw": "Copy JSON",
      "noChange": "No changes"
    },
    "config": {
      "colEntity": "Entity",
      "colEnabled": "Enabled",
      "disableTitle": "Disable audit tracking?",
      "disableBody": "Disabling will stop recording changes for {{entity}}. Existing logs are kept. Continue?",
      "disableConfirm": "Disable audit",
      "cancel": "Cancel"
    },
    "empty": {
      "viewer": "No log matches the filter.",
      "config": "No config found. Try reloading."
    }
  }
}
```

- [ ] **Step 5: Create `src/locales/vi/auditLog.json`**

```json
{
  "auditLog": {
    "title": "Lịch sử audit",
    "tab": { "viewer": "Lịch sử thay đổi", "config": "Cấu hình theo dõi" },
    "col": {
      "createdAt": "Thời gian",
      "user": "Người thực hiện",
      "event": "Sự kiện",
      "entity": "Đối tượng",
      "summary": "Tóm tắt thay đổi",
      "action": "Chi tiết"
    },
    "event": { "Create": "Tạo mới", "Update": "Cập nhật", "Delete": "Xoá" },
    "summary": {
      "created": "Tạo mới",
      "deleted": "Đã xoá",
      "updateWithExtra": "{{head}} (+{{count}} khác)"
    },
    "filter": {
      "user": "Người dùng",
      "userPlaceholder": "Tìm theo tên hoặc SĐT",
      "userEmpty": "Không có người dùng",
      "entity": "Đối tượng",
      "entityAll": "Tất cả",
      "entityDisabled": "(đã tắt)",
      "event": "Sự kiện",
      "date": "Khoảng thời gian",
      "reset": "Xoá bộ lọc"
    },
    "sheet": {
      "title": "Chi tiết thay đổi",
      "before": "Trước",
      "after": "Sau",
      "rawJson": "Dữ liệu thô",
      "copyRaw": "Sao chép JSON",
      "noChange": "Không có thay đổi"
    },
    "config": {
      "colEntity": "Đối tượng",
      "colEnabled": "Bật theo dõi",
      "disableTitle": "Tắt theo dõi audit?",
      "disableBody": "Tắt audit sẽ ngưng ghi nhận thay đổi của {{entity}}. Lịch sử cũ vẫn được giữ. Tiếp tục?",
      "disableConfirm": "Tắt audit",
      "cancel": "Huỷ"
    },
    "empty": {
      "viewer": "Chưa có log nào khớp bộ lọc.",
      "config": "Chưa có cấu hình. Hãy thử tải lại."
    }
  }
}
```

- [ ] **Step 6: Register namespace in `src/i18n.ts`**

Three additions, each at the matching block:

```ts
// Imports
import enAuditLog from '@/locales/en/auditLog.json'
import viAuditLog from '@/locales/vi/auditLog.json'

// resources.en
auditLog: enAuditLog,

// resources.vi
auditLog: viAuditLog,

// ns array
'auditLog',
```

- [ ] **Step 7: Add helmet keys**

`src/locales/en/helmet.json` (inside `helmet`):

```json
"auditLog": { "title": "Audit history", "description": "Browse audit history", "keywords": "audit, history" }
```

`src/locales/vi/helmet.json` (inside `helmet`):

```json
"auditLog": { "title": "Lịch sử audit", "description": "Tra cứu lịch sử audit", "keywords": "audit, lịch sử" }
```

- [ ] **Step 8: Add sidebar label keys**

`src/locales/en/sidebar.json` (under sidebar root):

```json
"auditLog": "Audit history"
```

`src/locales/vi/sidebar.json`:

```json
"auditLog": "Lịch sử audit"
```

- [ ] **Step 9: Add sidebar entry to `src/router/routes.ts`**

Sidebar items are data-driven from `sidebarRoutes: ISidebarRoute[]` in this file. Add `History` to the existing lucide import block, then append a new entry near other admin-level entries (e.g. right after the user-management or branch-management block):

```ts
import { History } from 'lucide-react'

// ... inside sidebarRoutes array
{
  title: 'sidebar.auditLog',
  path: ROUTE.STAFF_AUDIT_LOG,
  icon: History,
  permission: Permission.AUDIT_LOG,
},
```

No change to `app-sidebar.tsx` — it reads from this array via permission filter.

- [ ] **Step 10: Manual BE-coupling verification**

This step is a checklist run by the engineer, not code:

1. Date range param names: confirm with BE — if the actual params are not `fromDate`/`toDate`, update `IAuditLogQuery`, `viewer-tab.tsx`, and `date-range-filter.tsx` accordingly (the change is mechanical).
2. Confirm `Permission.AUDIT_LOG = 'AUDIT_LOG'` matches the BE permission key. If different, update `src/constants/sidebar-permission.ts` only.
3. Open the dev server, log in as **Admin** → confirm `/system/audit-log` loads, both tabs render, filters work, detail sheet opens, pagination works.
4. Log in as **Manager** → confirm only the Config tab renders, switch toggling triggers confirm only on disable, optimistic update is visible.
5. Log in as **Cashier/Staff** → confirm sidebar entry is hidden and direct navigation hits the project's standard 403.

- [ ] **Step 11: Run lint + typecheck + tests**

Run: `npm run lint && npx tsc -b --noEmit && npx vitest run src/tests/utils/audit-log src/tests/hooks/use-audit-log.test.tsx src/tests/components/audit-log-page.test.tsx src/tests/components/audit-log-entity-select.test.tsx src/tests/components/audit-log-disable-confirm.test.tsx`
Expected: lint OK, tsc OK, all tests pass.

- [ ] **Step 12: Commit + push**

```bash
git add -A
git commit -m "TaskId: TT-56 (10) Wire audit log route, sidebar, i18n, helmet"
git push -u origin feature/TT-56-FE-Implement-Audit-Log-Viewer-Screen
```

---

## Self-review notes (for the executor)

- Every cell that displays event/entity/badge respects the case-sensitive `'Create' | 'Update' | 'Delete'` values per spec §3.
- `DataTable` is consumed exactly like in `logger-page.tsx`: pass `columns`, `data`, `isLoading`, `pages`, `onPageChange`, `onPageSizeChange`. No new DataTable subclassing.
- Optimistic update logic lives only in `useUpdateAuditLogConfig` — components must not also flip cache.
- `useUsers` has a special second arg `enabled?: boolean` (see `src/hooks/use-user.ts:46-55`); the combobox passes `open` for both `q` and `enabled` so the query disables itself when closed.
- `summarizeDiff` and `computeFieldDiff` are pure — never reach into React from inside them.
- i18n strings use the `auditLog` namespace exclusively; helmet keys live in `helmet`; sidebar keys live in `sidebar`. Don't mix.
- Components inside subagents must read this plan top-to-bottom — neighboring tasks may share types but never share local state.
