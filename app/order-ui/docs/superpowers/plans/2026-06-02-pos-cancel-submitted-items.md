# POS Cancel Submitted Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow staff to reduce or remove items from submitted orders (before payment) via a merged editable list in the Submitted Orders dialog.

**Architecture:** A pure helper `applySubmittedQuantity` in `staff-orders.ts` encapsulates the LIFO removal logic and is unit-tested independently. The hook action `setSubmittedQuantity` calls this helper and persists state. `SubmittedOrdersDialog` is refactored from a read-only grouped view to a merged editable list with `−` and `×` controls. Props flow down: `table-order.tsx` → `OrderSummary` → `SubmittedOrdersDialog`.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, Tailwind CSS (pos-* tokens)

---

## Data flow overview

```
useTableSessions.setSubmittedQuantity(tableId, menuItemId, note, newQty)
  └─ applySubmittedQuantity(orders, menuItemId, note, newQty)   ← pure, unit-tested
       └─ LIFO: iterate newest→oldest, reduce qty, drop empty items/orders
       └─ returns new SubmittedOrder[]

table-order.tsx
  └─ onSetSubmittedQuantity={(menuItemId, note, qty) => setSubmittedQuantity(id, menuItemId, note, qty)}
       └─ OrderSummary (new prop onSetSubmittedQuantity)
            └─ SubmittedOrdersDialog (new prop onSetQuantity)
                 └─ mergeOrderItems(submittedOrders) → merged rows with − / × controls
```

Payment page, receipt page, and invoice page all derive from `session.submittedOrders` — they automatically reflect changes with no modification needed.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Modify** | `src/lib/staff-orders.ts` | Add `applySubmittedQuantity` pure helper |
| **Modify** | `src/tests/lib/staff-orders.test.ts` | Unit tests for `applySubmittedQuantity` |
| **Modify** | `src/hooks/useTableSessions.ts` | Add `setSubmittedQuantity` action + interface entry |
| **Modify** | `src/components/staff/submitted-orders-dialog.tsx` | Replace grouped read-only view with merged editable list |
| **Create** | `src/tests/components/staff/submitted-orders-dialog.test.tsx` | Component tests for edit controls |
| **Modify** | `src/components/staff/order-summary.tsx` | Add `onSetSubmittedQuantity` prop, pass to dialog |
| **Modify** | `src/tests/components/staff/order-summary.test.tsx` | Add prop to defaultProps, add wiring test |
| **Modify** | `src/app/staff/table-order.tsx` | Wire `setSubmittedQuantity` from hook to OrderSummary |

---

## Task 1: `applySubmittedQuantity` pure helper

The removal logic is pure (no React), so it lives in `src/lib/staff-orders.ts` and is unit-tested directly. The hook in Task 2 is a thin wrapper.

**Algorithm:** Calculate `toRemove = currentTotal - newQty`. Iterate `submittedOrders` newest-first (LIFO). For each order, reduce the matching item's quantity by `min(toRemove, item.quantity)`. Remove items that reach 0. Remove orders whose `items[]` become empty. Restore original order before returning.

**Files:**
- Modify: `src/lib/staff-orders.ts`
- Modify: `src/tests/lib/staff-orders.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/tests/lib/staff-orders.test.ts` (after the existing `mergeOrderItems` describe block):

```ts
import { applySubmittedQuantity } from '@/lib/staff-orders'

// Helper reused below
const item = (
  menuItemId: string,
  quantity: number,
  note = '',
): SubmittedOrder['items'][number] => ({
  menuItemId,
  name: menuItemId,
  priceNum: 10_000,
  price: '10.000đ',
  quantity,
  note,
})

describe('applySubmittedQuantity', () => {
  it('reduces quantity of a single item in a single order', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 3)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 1)
    expect(result[0].items[0].quantity).toBe(1)
  })

  it('removes the item when newQty reaches 0', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 2), item('m2', 1)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 0)
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0].menuItemId).toBe('m2')
  })

  it('removes the order entirely when its last item is removed', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 1)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 0)
    expect(result).toHaveLength(0)
  })

  it('applies LIFO — removes from newest order first', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [item('m1', 2)]),
      order('o2', [item('m1', 1)]),
    ]
    // Reduce from total 3 to 2 (remove 1). LIFO: o2 should lose its m1.
    const result = applySubmittedQuantity(orders, 'm1', '', 2)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('o1')
    expect(result[0].items[0].quantity).toBe(2)
  })

  it('spans multiple orders when needed (LIFO)', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [item('m1', 2)]),
      order('o2', [item('m1', 3)]),
    ]
    // Reduce from 5 to 1 (remove 4). o2 loses all 3, o1 loses 1.
    const result = applySubmittedQuantity(orders, 'm1', '', 1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('o1')
    expect(result[0].items[0].quantity).toBe(1)
  })

  it('is a no-op when newQty equals current total', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 2)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 2)
    expect(result).toBe(orders) // same reference — no mutation
  })

  it('is a no-op when newQty exceeds current total', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 2)])]
    const result = applySubmittedQuantity(orders, 'm1', '', 99)
    expect(result).toBe(orders)
  })

  it('matches by note — different notes are treated as separate items', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [item('m1', 2, 'ít đường'), item('m1', 1, 'không đường')]),
    ]
    const result = applySubmittedQuantity(orders, 'm1', 'ít đường', 1)
    const ít = result[0].items.find((i) => i.note === 'ít đường')
    const không = result[0].items.find((i) => i.note === 'không đường')
    expect(ít?.quantity).toBe(1)
    expect(không?.quantity).toBe(1) // untouched
  })

  it('does not mutate the input array', () => {
    const orders: SubmittedOrder[] = [order('o1', [item('m1', 3)])]
    const original = orders[0].items[0].quantity
    applySubmittedQuantity(orders, 'm1', '', 1)
    expect(orders[0].items[0].quantity).toBe(original)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/lib/staff-orders.test.ts
```

Expected: FAIL — `applySubmittedQuantity` not exported from `@/lib/staff-orders`

- [ ] **Step 3: Implement `applySubmittedQuantity`**

Append to `src/lib/staff-orders.ts` (after the existing `mergeOrderItems` function):

```ts
export function applySubmittedQuantity(
  orders: SubmittedOrder[],
  menuItemId: string,
  note: string,
  newQty: number,
): SubmittedOrder[] {
  const currentTotal = orders.reduce((sum, o) => {
    const found = o.items.find((i) => i.menuItemId === menuItemId && i.note === note)
    return sum + (found?.quantity ?? 0)
  }, 0)

  let toRemove = currentTotal - newQty
  if (toRemove <= 0) return orders

  const result = [...orders]
    .reverse()
    .map((o) => {
      if (toRemove <= 0) return o
      const idx = o.items.findIndex((i) => i.menuItemId === menuItemId && i.note === note)
      if (idx === -1) return o

      const take = Math.min(toRemove, o.items[idx].quantity)
      toRemove -= take
      const newQtyForItem = o.items[idx].quantity - take
      const newItems =
        newQtyForItem === 0
          ? o.items.filter((_, i) => i !== idx)
          : o.items.map((it, i) => (i === idx ? { ...it, quantity: newQtyForItem } : it))
      return { ...o, items: newItems }
    })
    .reverse()

  return result.filter((o) => o.items.length > 0)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/lib/staff-orders.test.ts
```

Expected: all tests pass (existing `mergeOrderItems` tests + new `applySubmittedQuantity` tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/staff-orders.ts src/tests/lib/staff-orders.test.ts
git commit -m "feat(pos): add applySubmittedQuantity LIFO helper"
```

---

## Task 2: `setSubmittedQuantity` hook action

Thin wrapper that calls `applySubmittedQuantity` and persists state.

**Files:**
- Modify: `src/hooks/useTableSessions.ts`

- [ ] **Step 1: Add to the `UseTableSessions` interface**

In `src/hooks/useTableSessions.ts`, update the interface (lines 29–41) to add the new action:

```ts
export interface UseTableSessions {
  sessions: Sessions
  openSession: (tableId: string, tableName: string) => void
  addItem: (tableId: string, item: OrderItem) => void
  updateItem: (tableId: string, menuItemId: string, patch: { quantity?: number; note?: string }) => void
  removeItem: (tableId: string, menuItemId: string) => void
  submitOrder: (tableId: string) => void
  requestPayment: (tableId: string) => void
  closeSession: (tableId: string) => void
  cancelSession: (tableId: string) => void
  clearPendingItems: (tableId: string) => void
  setInvoiceRequest: (tableId: string, request: InvoiceRequest) => void
  setSubmittedQuantity: (tableId: string, menuItemId: string, note: string, newQty: number) => void
}
```

- [ ] **Step 2: Add the import for the helper and implement the action**

At the top of `src/hooks/useTableSessions.ts`, update the import from `staff-orders`:

```ts
import { applySubmittedQuantity } from '@/lib/staff-orders'
```

Then, inside `useTableSessions` (after the `setInvoiceRequest` callback and before the `return` statement), add:

```ts
const setSubmittedQuantity = useCallback(
  (tableId: string, menuItemId: string, note: string, newQty: number) => {
    mutate((prev) => {
      const session = prev[tableId]
      if (!session) return prev
      const submittedOrders = applySubmittedQuantity(
        session.submittedOrders,
        menuItemId,
        note,
        newQty,
      )
      return { ...prev, [tableId]: { ...session, submittedOrders } }
    })
  },
  [mutate],
)
```

- [ ] **Step 3: Add to the return object**

In the `return` statement at the bottom of `useTableSessions`, add `setSubmittedQuantity`:

```ts
return {
  sessions,
  openSession,
  addItem,
  updateItem,
  removeItem,
  submitOrder,
  requestPayment,
  closeSession,
  cancelSession,
  clearPendingItems,
  setInvoiceRequest,
  setSubmittedQuantity,
}
```

- [ ] **Step 4: Run full test suite to verify no regressions**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTableSessions.ts
git commit -m "feat(pos): add setSubmittedQuantity hook action"
```

---

## Task 3: `SubmittedOrdersDialog` edit mode

Replace the read-only "Lần 1/2" grouped view with a merged editable list. Uses `mergeOrderItems` (already in `staff-orders.ts`) to flatten orders for display.

**Files:**
- Modify: `src/components/staff/submitted-orders-dialog.tsx`
- Create: `src/tests/components/staff/submitted-orders-dialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/tests/components/staff/submitted-orders-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubmittedOrdersDialog } from '@/components/staff/submitted-orders-dialog'
import type { SubmittedOrder } from '@/types/session'

const submitted: SubmittedOrder[] = [
  {
    id: 'o1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
    ],
  },
  {
    id: 'o2',
    submittedAt: '2026-06-01T10:05:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
      { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 1, note: '' },
    ],
  },
]

function openDialog(onSetQuantity = vi.fn()) {
  render(
    <SubmittedOrdersDialog
      submittedOrders={submitted}
      submittedTotal={120_000}
      onSetQuantity={onSetQuantity}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /xem chi tiết/i }))
}

describe('SubmittedOrdersDialog', () => {
  it('shows merged quantities after opening the dialog', () => {
    openDialog()
    // m1 appears in o1 (qty 2) and o2 (qty 1) → merged qty 3
    expect(screen.getByTestId('qty-m1-')).toHaveTextContent('3')
    expect(screen.getByText('Cà phê đen')).toBeInTheDocument()
    expect(screen.getByText('Trà đào')).toBeInTheDocument()
  })

  it('− button calls onSetQuantity with (menuItemId, note, currentQty - 1)', () => {
    const onSetQuantity = vi.fn()
    openDialog(onSetQuantity)
    fireEvent.click(screen.getByLabelText('Giảm Cà phê đen'))
    expect(onSetQuantity).toHaveBeenCalledWith('m1', '', 2) // 3 − 1 = 2
  })

  it('× button calls onSetQuantity with (menuItemId, note, 0)', () => {
    const onSetQuantity = vi.fn()
    openDialog(onSetQuantity)
    fireEvent.click(screen.getByLabelText('Xóa Trà đào'))
    expect(onSetQuantity).toHaveBeenCalledWith('m2', '', 0)
  })

  it('shows item note when present', () => {
    const withNote: SubmittedOrder[] = [
      {
        id: 'o1',
        submittedAt: '2026-06-01T10:00:00Z',
        items: [
          { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: 'ít đường' },
        ],
      },
    ]
    render(
      <SubmittedOrdersDialog
        submittedOrders={withNote}
        submittedTotal={25_000}
        onSetQuantity={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /xem chi tiết/i }))
    expect(screen.getByText('(ít đường)')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/components/staff/submitted-orders-dialog.test.tsx
```

Expected: FAIL — `onSetQuantity` prop not in component, `data-testid` not present

- [ ] **Step 3: Rewrite `SubmittedOrdersDialog`**

Replace the entire content of `src/components/staff/submitted-orders-dialog.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import type { SubmittedOrder } from '@/types/session'
import { formatVnd } from '@/data/staff-data'
import { mergeOrderItems } from '@/lib/staff-orders'

interface Props {
  submittedOrders: SubmittedOrder[]
  submittedTotal: number
  onSetQuantity: (menuItemId: string, note: string, newQty: number) => void
}

export function SubmittedOrdersDialog({ submittedOrders, submittedTotal, onSetQuantity }: Props) {
  const merged = mergeOrderItems(submittedOrders)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-xs text-pos-gold hover:underline">
          Xem chi tiết
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Món đã đặt</DialogTitle>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto -mx-6 px-6">
          {merged.map((item) => (
            <div
              key={`${item.menuItemId}::${item.note}`}
              className="flex items-center gap-2 border-b border-border py-2.5 last:border-0"
            >
              <span className="flex-1 text-sm">
                {item.name}
                {item.note && (
                  <span className="ml-1 text-xs italic text-muted-foreground">
                    ({item.note})
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Giảm ${item.name}`}
                  onClick={() => onSetQuantity(item.menuItemId, item.note, item.quantity - 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-muted-foreground/30 text-xs hover:bg-muted"
                >
                  −
                </button>
                <span
                  data-testid={`qty-${item.menuItemId}-${item.note}`}
                  className="w-5 text-center text-sm tabular-nums"
                >
                  {item.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Xóa ${item.name}`}
                  onClick={() => onSetQuantity(item.menuItemId, item.note, 0)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-destructive hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  ×
                </button>
              </div>
              <span className="w-20 text-right text-xs tabular-nums text-pos-gold">
                {formatVnd(item.priceNum * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">Tổng đã đặt</span>
          <span className="text-sm font-bold text-pos-gold">{formatVnd(submittedTotal)}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/components/staff/submitted-orders-dialog.test.tsx
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/submitted-orders-dialog.tsx src/tests/components/staff/submitted-orders-dialog.test.tsx
git commit -m "feat(pos): editable submitted orders dialog with merged view"
```

---

## Task 4: Wire `OrderSummary` and `table-order.tsx`

Plumb `onSetSubmittedQuantity` from `table-order.tsx` through `OrderSummary` down to `SubmittedOrdersDialog`.

**Files:**
- Modify: `src/components/staff/order-summary.tsx`
- Modify: `src/tests/components/staff/order-summary.test.tsx`
- Modify: `src/app/staff/table-order.tsx`

- [ ] **Step 1: Update `OrderSummary` props and pass-through**

In `src/components/staff/order-summary.tsx`, update the `Props` interface to add the new prop:

```ts
interface Props {
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  onUpdateItem: (menuItemId: string, patch: { quantity?: number; note?: string }) => void
  onRemoveItem: (menuItemId: string) => void
  onClearAll: () => void
  onSubmitOrder: () => void
  onPay: () => void
  onDraftReceipt: () => void
  onSetSubmittedQuantity: (menuItemId: string, note: string, newQty: number) => void
}
```

Update the function signature to destructure the new prop:

```ts
export function OrderSummary({
  pendingItems,
  submittedOrders,
  onUpdateItem,
  onRemoveItem,
  onSubmitOrder,
  onPay,
  onDraftReceipt,
  onSetSubmittedQuantity,
}: Props) {
```

Update the `SubmittedOrdersDialog` usage in the JSX (the "Submitted orders" section, currently around line 128–135):

```tsx
{hasSubmitted && (
  <div className="flex items-center justify-between border-t border-pos-border px-4 py-2">
    <span className="text-xs text-pos-dim">
      Đã đặt {submittedOrders.length} lần · {formatVnd(submittedTotal)}
    </span>
    <SubmittedOrdersDialog
      submittedOrders={submittedOrders}
      submittedTotal={submittedTotal}
      onSetQuantity={onSetSubmittedQuantity}
    />
  </div>
)}
```

- [ ] **Step 2: Update `order-summary.test.tsx` — add the new prop to `defaultProps`**

In `src/tests/components/staff/order-summary.test.tsx`, update `defaultProps`:

```ts
function defaultProps(overrides: Partial<React.ComponentProps<typeof OrderSummary>> = {}) {
  return {
    pendingItems: pending,
    submittedOrders: submitted,
    onUpdateItem: vi.fn(),
    onRemoveItem: vi.fn(),
    onClearAll: vi.fn(),
    onSubmitOrder: vi.fn(),
    onPay: vi.fn(),
    onDraftReceipt: vi.fn(),
    onSetSubmittedQuantity: vi.fn(),
    ...overrides,
  }
}
```

Also add a new test to verify the prop reaches the dialog's controls:

```ts
it('passes onSetSubmittedQuantity to the dialog — minus fires with qty - 1', () => {
  const onSet = vi.fn()
  render(<OrderSummary {...defaultProps({ onSetSubmittedQuantity: onSet })} />)
  fireEvent.click(screen.getByRole('button', { name: /xem chi tiết/i }))
  // submitted has Trà đào qty:1; clicking − should call with (m2, '', 0)
  fireEvent.click(screen.getByLabelText('Giảm Trà đào'))
  expect(onSet).toHaveBeenCalledWith('m2', '', 0)
})
```

- [ ] **Step 3: Run tests to verify `order-summary` tests pass**

```bash
npx vitest run src/tests/components/staff/order-summary.test.tsx
```

Expected: all tests pass (8 tests including the new one)

- [ ] **Step 4: Wire `table-order.tsx`**

In `src/app/staff/table-order.tsx`, destructure `setSubmittedQuantity` from the hook:

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
} = useTableSessions()
```

Pass it to `OrderSummary`:

```tsx
<OrderSummary
  pendingItems={session.pendingItems}
  submittedOrders={session.submittedOrders}
  onUpdateItem={(menuItemId, patch) => updateItem(id, menuItemId, patch)}
  onRemoveItem={handleRemoveItem}
  onClearAll={() => clearPendingItems(id)}
  onSubmitOrder={() => submitOrder(id)}
  onPay={handlePay}
  onDraftReceipt={() => setShowDraft(true)}
  onSetSubmittedQuantity={(menuItemId, note, newQty) =>
    setSubmittedQuantity(id, menuItemId, note, newQty)
  }
/>
```

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/order-summary.tsx src/tests/components/staff/order-summary.test.tsx src/app/staff/table-order.tsx
git commit -m "feat(pos): wire setSubmittedQuantity through OrderSummary to dialog"
```

---

## Self-review

**Spec coverage:**
- Staff can reduce submitted item quantity (− button): Task 3 + Task 4 ✓
- Staff can remove entire submitted item line (× button): Task 3 + Task 4 ✓
- LIFO removal across multiple orders: Task 1 ✓
- Payment / receipt / invoice pages auto-reflect changes: no modification needed — they derive from `session.submittedOrders` ✓
- No mutation of input array: Task 1 test + implementation ✓

**Placeholder scan:** None found. All steps have complete code.

**Type consistency:**
- `applySubmittedQuantity(orders, menuItemId, note, newQty)` — same signature in Task 1 impl, Task 2 call, and Task 3 test ✓
- `onSetQuantity(menuItemId, note, newQty)` in `SubmittedOrdersDialog` props — matches call sites in Task 3 tests and Task 4 `onSetSubmittedQuantity` forwarding ✓
- `setSubmittedQuantity(tableId, menuItemId, note, newQty)` in `UseTableSessions` interface — matches Task 2 impl and Task 4 wire ✓
- `data-testid={`qty-${item.menuItemId}-${item.note}`}` used in test as `qty-m1-` (note is `''`) — matches ✓
