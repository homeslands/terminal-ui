# Transfer Table (Đổi bàn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow staff to transfer an active table session (including pending items and submitted orders) to a different empty table.

**Architecture:** A pure `transferSession` function in `src/lib/staff-orders.ts` handles the immutable state transformation; `useTableSessions` wraps it as an action; a new `TransferTableDialog` component provides a two-step UI (pick table → confirm); `table-order.tsx` wires it together and navigates to the new table on success.

**Tech Stack:** React, TypeScript, Vitest + React Testing Library, shadcn/ui (Dialog, Button), Lucide icons, TanStack Query (useTables), Zustand (useUserStore).

---

## File Map

| File | Change |
|------|--------|
| `src/lib/staff-orders.ts` | Add `transferSession()` pure function |
| `src/tests/lib/staff-orders.test.ts` | Add `transferSession` test suite |
| `src/hooks/useTableSessions.ts` | Add `transferSession` action + interface entry |
| `src/hooks/__tests__/useTableSessions.test.tsx` | Add `transferSession` hook tests |
| `src/components/staff/transfer-table-dialog.tsx` | **NEW** — dialog component |
| `src/tests/components/staff/transfer-table-dialog.test.tsx` | **NEW** — dialog tests |
| `src/app/staff/table-order.tsx` | Wire dialog, fetch tables, handle navigation |

---

## Task 1: Pure function `transferSession`

**Files:**
- Modify: `src/lib/staff-orders.ts`
- Test: `src/tests/lib/staff-orders.test.ts`

### Context

`src/lib/staff-orders.ts` already exports `mergeOrderItems` and `applySubmittedQuantity`. Add `transferSession` at the bottom of the same file. The `Sessions` type is `Record<string, TableSession>` (imported from `@/types/session`).

`TableSession` shape (from `src/types/session.ts`):
```ts
interface TableSession {
  tableId: string
  tableName: string
  status: 'empty' | 'serving' | 'waiting_payment' | 'done'
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  openedAt: string
  invoiceRequest?: InvoiceRequest
}
```

- [ ] **Step 1: Write the failing tests**

Add this entire block at the bottom of `src/tests/lib/staff-orders.test.ts` (after the existing `applySubmittedQuantity` suite):

```ts
import { transferSession } from '@/lib/staff-orders'
import type { TableSession } from '@/types/session'

const makeSession = (tableId: string, tableName: string): TableSession => ({
  tableId,
  tableName,
  status: 'serving',
  pendingItems: [],
  submittedOrders: [],
  openedAt: '2026-06-01T10:00:00Z',
})

describe('transferSession', () => {
  it('moves the session to the target table with updated tableId and tableName', () => {
    const sessions = { t1: makeSession('t1', 'Bàn 01') }
    const result = transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(result.t1).toBeUndefined()
    expect(result.t2).toMatchObject({ tableId: 't2', tableName: 'Bàn 02', status: 'serving' })
  })

  it('preserves pendingItems, submittedOrders, and openedAt from the original session', () => {
    const base = makeSession('t1', 'Bàn 01')
    const sessions = {
      t1: {
        ...base,
        pendingItems: [{ menuItemId: 'm1', name: 'X', priceNum: 10_000, price: '10.000đ', quantity: 2, note: '' }],
        submittedOrders: [{ id: 'o1', submittedAt: '2026-06-01T10:00:00Z', items: [] }],
        openedAt: '2026-06-01T09:00:00Z',
      },
    }
    const result = transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(result.t2.pendingItems).toHaveLength(1)
    expect(result.t2.submittedOrders).toHaveLength(1)
    expect(result.t2.openedAt).toBe('2026-06-01T09:00:00Z')
  })

  it('is a no-op (same reference) when the source table does not have a session', () => {
    const sessions = { t2: makeSession('t2', 'Bàn 02') }
    const result = transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(result).toBe(sessions)
  })

  it('is a no-op (same reference) when the target table already has a session', () => {
    const sessions = { t1: makeSession('t1', 'Bàn 01'), t2: makeSession('t2', 'Bàn 02') }
    const result = transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(result).toBe(sessions)
  })

  it('does not mutate the input sessions object', () => {
    const sessions = { t1: makeSession('t1', 'Bàn 01') }
    const originalT1 = sessions.t1
    transferSession(sessions, 't1', 't2', 'Bàn 02')
    expect(sessions.t1).toBe(originalT1)
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run src/tests/lib/staff-orders.test.ts
```

Expected: FAIL — `transferSession is not exported from '@/lib/staff-orders'`

- [ ] **Step 3: Implement `transferSession`**

**3a. Update the existing import at the top of `src/lib/staff-orders.ts`** (line 1 — the file currently imports only `SubmittedOrder`):

```ts
import type { SubmittedOrder, TableSession } from '@/types/session'
```

**3b. Append the type alias and function at the bottom of `src/lib/staff-orders.ts`**:

```ts
type Sessions = Record<string, TableSession>

export function transferSession(
  sessions: Sessions,
  fromTableId: string,
  toTableId: string,
  newTableName: string,
): Sessions {
  if (!sessions[fromTableId]) return sessions
  if (sessions[toTableId]) return sessions
  const next = { ...sessions }
  delete next[fromTableId]
  next[toTableId] = { ...sessions[fromTableId], tableId: toTableId, tableName: newTableName }
  return next
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npx vitest run src/tests/lib/staff-orders.test.ts
```

Expected: all tests PASS (no failures)

- [ ] **Step 5: Commit**

```bash
git add src/lib/staff-orders.ts src/tests/lib/staff-orders.test.ts
git commit -m "feat(pos): add transferSession pure function"
```

---

## Task 2: `transferSession` hook action

**Files:**
- Modify: `src/hooks/useTableSessions.ts`
- Test: `src/hooks/__tests__/useTableSessions.test.tsx`

### Context

`useTableSessions` exposes a `UseTableSessions` interface. Actions call `mutate()` which runs `setSessions` + `saveToStorage`. Follow the same pattern as `closeSession`:

```ts
const closeSession = useCallback((tableId: string) => {
  mutate((prev) => {
    if (!prev[tableId]) return prev
    const next = { ...prev }
    delete next[tableId]
    return next
  })
}, [mutate])
```

The hook test file (`src/hooks/__tests__/useTableSessions.test.tsx`) uses `renderHook` + `act`. Each test calls `act(() => result.current.openSession(...))` before exercising the action under test.

- [ ] **Step 1: Write the failing tests**

Add this block at the bottom of `src/hooks/__tests__/useTableSessions.test.tsx` (inside the existing `describe('useTableSessions', ...)` block, before the closing `}`):

```ts
it('transferSession moves session to the new table and removes the old one', () => {
  const { result } = renderHook(() => useTableSessions())
  act(() => result.current.openSession('t1', 'Bàn 01'))
  act(() => result.current.addItem('t1', item()))
  act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
  expect(result.current.sessions.t1).toBeUndefined()
  expect(result.current.sessions.t2).toBeDefined()
  expect(result.current.sessions.t2.tableName).toBe('Bàn 02')
  expect(result.current.sessions.t2.pendingItems).toHaveLength(1)
})

it('transferSession persists the new session to localStorage', () => {
  const { result } = renderHook(() => useTableSessions())
  act(() => result.current.openSession('t1', 'Bàn 01'))
  act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.sessions) || '{}')
  expect(stored.t1).toBeUndefined()
  expect(stored.t2).toBeDefined()
})

it('transferSession is a no-op when target is occupied', () => {
  const { result } = renderHook(() => useTableSessions())
  act(() => result.current.openSession('t1', 'Bàn 01'))
  act(() => result.current.openSession('t2', 'Bàn 02'))
  act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
  expect(result.current.sessions.t1).toBeDefined()
  expect(result.current.sessions.t2.tableName).toBe('Bàn 02')
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run src/hooks/__tests__/useTableSessions.test.tsx
```

Expected: FAIL — `result.current.transferSession is not a function`

- [ ] **Step 3: Add the action to the hook**

In `src/hooks/useTableSessions.ts`:

**3a. Add `transferSession` to the `UseTableSessions` interface** (after `setSubmittedQuantity`):

```ts
transferSession: (fromTableId: string, toTableId: string, newTableName: string) => void
```

**3b. Import `transferSession` from `@/lib/staff-orders`** (add to the existing import line):

```ts
import { applySubmittedQuantity, transferSession } from '@/lib/staff-orders'
```

**3c. Add the implementation** (after the `setSubmittedQuantity` implementation):

```ts
const transfer = useCallback(
  (fromTableId: string, toTableId: string, newTableName: string) => {
    mutate((prev) => transferSession(prev, fromTableId, toTableId, newTableName))
  },
  [mutate],
)
```

**3d. Add to the return object** (after `setSubmittedQuantity`):

```ts
transferSession: transfer,
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npx vitest run src/hooks/__tests__/useTableSessions.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTableSessions.ts src/hooks/__tests__/useTableSessions.test.tsx
git commit -m "feat(pos): add transferSession action to useTableSessions"
```

---

## Task 3: `TransferTableDialog` component

**Files:**
- Create: `src/components/staff/transfer-table-dialog.tsx`
- Create: `src/tests/components/staff/transfer-table-dialog.test.tsx`

### Context

The dialog follows the same controlled pattern as `SubmittedOrdersDialog`:
- A `Button` trigger opens a `Dialog` (no `DialogTrigger` — fully controlled via `useState`)
- All state is local until "Xác nhận" is clicked
- Uses `Button`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from `@/components/ui`

The dialog has **two views** toggled by local `confirming` state:
1. **Table picker**: grid of all tables except `currentTableId`. Tables without a session are clickable. Tables with a session are dimmed + disabled.
2. **Confirmation**: "Chuyển [currentTableName] → [selectedTable.label]?" with Huỷ / Xác nhận buttons.

`Table` type (from `@/data/staff-data`):
```ts
interface Table { id: string; label: string; seats: number }
```

`TableSession` shape — only `status` field is needed to determine occupancy; a table is occupied when `sessions[id]` exists.

Design tokens to use: `bg-pos-card`, `bg-pos-elevated`, `border-pos-border`, `text-pos-text`, `text-pos-muted`, `text-pos-dim`, `text-pos-gold` (for "Đổi bàn" button variant outline), `bg-pos-gold` (confirm button).

- [ ] **Step 1: Write the failing tests**

Create `src/tests/components/staff/transfer-table-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransferTableDialog } from '@/components/staff/transfer-table-dialog'
import type { TableSession } from '@/types/session'

const tables = [
  { id: 't1', label: 'Bàn 01', seats: 4 },
  { id: 't2', label: 'Bàn 02', seats: 4 },
  { id: 't3', label: 'Bàn 03', seats: 6 },
]

const occupiedSession = (): TableSession => ({
  tableId: 't2',
  tableName: 'Bàn 02',
  status: 'serving',
  pendingItems: [],
  submittedOrders: [],
  openedAt: '',
})

function open(onTransfer = vi.fn()) {
  render(
    <TransferTableDialog
      currentTableId="t1"
      currentTableName="Bàn 01"
      tables={tables}
      sessions={{ t2: occupiedSession() }}
      onTransfer={onTransfer}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /đổi bàn/i }))
}

describe('TransferTableDialog', () => {
  it('shows all tables except the current one when opened', () => {
    open()
    expect(screen.queryByText('Bàn 01')).not.toBeInTheDocument()
    expect(screen.getByText('Bàn 02')).toBeInTheDocument()
    expect(screen.getByText('Bàn 03')).toBeInTheDocument()
  })

  it('occupied table button is disabled', () => {
    open()
    expect(screen.getByRole('button', { name: /bàn 02/i })).toBeDisabled()
  })

  it('empty table button is enabled', () => {
    open()
    expect(screen.getByRole('button', { name: /bàn 03/i })).not.toBeDisabled()
  })

  it('selecting a table shows confirmation view', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /bàn 03/i }))
    expect(screen.getByText(/bàn 01/i)).toBeInTheDocument()
    expect(screen.getByText(/bàn 03/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /xác nhận/i })).toBeInTheDocument()
  })

  it('Xác nhận calls onTransfer with correct tableId and tableName', () => {
    const onTransfer = vi.fn()
    open(onTransfer)
    fireEvent.click(screen.getByRole('button', { name: /bàn 03/i }))
    fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
    expect(onTransfer).toHaveBeenCalledWith('t3', 'Bàn 03')
  })

  it('Huỷ on confirmation view returns to table picker without calling onTransfer', () => {
    const onTransfer = vi.fn()
    open(onTransfer)
    fireEvent.click(screen.getByRole('button', { name: /bàn 03/i }))
    fireEvent.click(screen.getByRole('button', { name: /huỷ/i }))
    expect(onTransfer).not.toHaveBeenCalled()
    expect(screen.getByText('Bàn 02')).toBeInTheDocument()
  })

  it('shows empty message when all other tables are occupied', () => {
    render(
      <TransferTableDialog
        currentTableId="t1"
        currentTableName="Bàn 01"
        tables={[{ id: 't1', label: 'Bàn 01', seats: 4 }, { id: 't2', label: 'Bàn 02', seats: 4 }]}
        sessions={{ t2: occupiedSession() }}
        onTransfer={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /đổi bàn/i }))
    expect(screen.getByText(/không có bàn trống/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npx vitest run src/tests/components/staff/transfer-table-dialog.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/staff/transfer-table-dialog'`

- [ ] **Step 3: Implement the component**

Create `src/components/staff/transfer-table-dialog.tsx`:

```tsx
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui'
import type { Table } from '@/data/staff-data'
import type { TableSession } from '@/types/session'

interface Props {
  currentTableId: string
  currentTableName: string
  tables: Table[]
  sessions: Record<string, TableSession>
  onTransfer: (toTableId: string, toTableName: string) => void
}

export function TransferTableDialog({
  currentTableId,
  currentTableName,
  tables,
  sessions,
  onTransfer,
}: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Table | null>(null)

  const otherTables = tables.filter((t) => t.id !== currentTableId)
  const hasAvailable = otherTables.some((t) => !sessions[t.id])

  const handleOpen = () => {
    setSelected(null)
    setOpen(true)
  }

  const handleConfirm = () => {
    if (!selected) return
    onTransfer(selected.id, selected.label)
    setOpen(false)
  }

  const handleCancelConfirm = () => setSelected(null)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        Đổi bàn
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selected ? 'Xác nhận đổi bàn' : 'Chọn bàn mới'}
          </DialogTitle>
        </DialogHeader>

        {selected ? (
          <div className="flex flex-col gap-4 pt-1">
            <p className="text-sm text-pos-muted">
              Chuyển toàn bộ đơn từ{' '}
              <span className="font-semibold text-pos-text">{currentTableName}</span> sang{' '}
              <span className="font-semibold text-pos-text">{selected.label}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelConfirm}>
                Huỷ
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                className="bg-pos-gold text-black hover:bg-pos-gold/80"
              >
                Xác nhận
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-1">
            {!hasAvailable ? (
              <p className="text-sm text-pos-muted">Không có bàn trống.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {otherTables.map((t) => {
                  const occupied = !!sessions[t.id]
                  return (
                    <Button
                      key={t.id}
                      variant="outline"
                      disabled={occupied}
                      onClick={() => setSelected(t)}
                      className="flex h-16 flex-col items-center justify-center gap-0.5 border-pos-border bg-pos-card text-pos-text hover:border-pos-gold hover:bg-pos-elevated disabled:opacity-40"
                    >
                      <span className="text-sm font-semibold">{t.label}</span>
                      <span className="text-[10px] text-pos-muted">
                        {occupied ? 'Đang có khách' : `${t.seats} chỗ`}
                      </span>
                    </Button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
npx vitest run src/tests/components/staff/transfer-table-dialog.test.tsx
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/transfer-table-dialog.tsx src/tests/components/staff/transfer-table-dialog.test.tsx
git commit -m "feat(pos): add TransferTableDialog component"
```

---

## Task 4: Wire into `table-order.tsx`

**Files:**
- Modify: `src/app/staff/table-order.tsx`

### Context

`table-order.tsx` currently:
- Gets `id` from `useParams`
- Reads session from `useTableSessions`
- Renders `PosPageHeader` with a center badge and right time display
- Does **not** fetch the full tables list

We need to:
1. Import `useTables` (from `@/hooks`) and `useUserStore` (from `@/stores`) — both already used in `floor-plan.tsx`
2. Import `TransferTableDialog`
3. Destructure `transferSession` from `useTableSessions`
4. Build `tables: Table[]` from `tablesData?.result` (same shape as in floor-plan)
5. Render `TransferTableDialog` inside `PosPageHeader`'s `right` slot alongside the clock, **only when `session.status !== 'waiting_payment'`**
6. On `onTransfer`: call `transferSession(id, toId, toName)` then `navigate(`/staff/table/${toId}`)`

The `useTables` return shape: `{ data: { result: { slug: string; name: string }[] } | undefined }`. Same mapping as floor-plan:
```ts
const tables = useMemo(
  () => (tablesData?.result ?? []).map((t) => ({ id: t.slug, label: t.name, seats: 4 })),
  [tablesData],
)
```

There is no existing test file for `table-order.tsx` and writing a full page integration test is out of scope — the component tests for `TransferTableDialog` and hook tests for `transferSession` already cover the behavior.

- [ ] **Step 1: Add imports**

In `src/app/staff/table-order.tsx`, add to existing imports:

```ts
import { useMemo } from 'react'           // add to the existing react import line
import { useTables } from '@/hooks'
import { useUserStore } from '@/stores'
import { TransferTableDialog } from '@/components/staff/transfer-table-dialog'
import type { Table } from '@/data/staff-data'
```

> `useMemo` — add to the existing `import { useEffect, useState } from 'react'` line.

- [ ] **Step 2: Fetch tables and destructure new action**

Inside `StaffTableOrderPage`, after the existing hooks:

```ts
const { userInfo } = useUserStore()
const { data: tablesData } = useTables(userInfo?.branch?.slug ?? '')
const tables: Table[] = useMemo(
  () => (tablesData?.result ?? []).map((t) => ({ id: t.slug, label: t.name, seats: 4 })),
  [tablesData],
)
```

Add `transferSession` to the destructure from `useTableSessions`:

```ts
const {
  sessions,
  addItem,
  updateItem,
  removeItem,
  submitOrder,
  requestPayment,
  clearPendingItems,
  setSubmittedQuantity,
  transferSession,        // ← add this
} = useTableSessions()
```

- [ ] **Step 3: Add the transfer handler**

After `handlePay`:

```ts
const handleTransfer = (toTableId: string, toTableName: string) => {
  transferSession(id, toTableId, toTableName)
  navigate(`/staff/table/${toTableId}`)
}
```

- [ ] **Step 4: Render `TransferTableDialog` in the header**

Replace the `right` prop of `PosPageHeader` from:

```tsx
right={<span className="font-mono text-sm text-pos-muted">{time}</span>}
```

to:

```tsx
right={
  <div className="flex items-center gap-2">
    {session.status !== 'waiting_payment' && (
      <TransferTableDialog
        currentTableId={id}
        currentTableName={session.tableName}
        tables={tables}
        sessions={sessions}
        onTransfer={handleTransfer}
      />
    )}
    <span className="font-mono text-sm text-pos-muted">{time}</span>
  </div>
}
```

- [ ] **Step 5: Run the full test suite**

```bash
npm run test
```

Expected: all tests PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add src/app/staff/table-order.tsx
git commit -m "feat(pos): wire TransferTableDialog into table-order page"
```

---

## Task 5: Full test run and lint check

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: all tests PASS

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: successful build, no TypeScript errors
