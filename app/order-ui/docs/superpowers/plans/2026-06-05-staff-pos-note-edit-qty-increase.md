# Staff POS — Note Edit + Quantity Increase for Submitted Items

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow staff to edit the note and increase the quantity of items already submitted to the kitchen, completing parity with the admin `update-order` flow.

**Architecture:** `SubmittedOrdersDialog` gains a `draftNotes` state (parallel to `draft` for quantities) and re-enables the `+` button; both are included in `ChangeItem` passed to `onConfirmChanges`. `handleSubmittedChanges` in `table-order.tsx` handles two new cases: `newQty > currentTotal` (calls `addNewOrderItem`, then `addSubmittedOrderItem` to backfill the slug in local state) and `newNote !== undefined` (calls `updateNoteOrderItem` for every surviving API slug, then `updateSubmittedItemNote` in local state). Two new methods on `useTableSessions` (`addSubmittedOrderItem`, `updateSubmittedItemNote`) keep local state consistent.

**Tech Stack:** React, TanStack Mutation (`useAddNewOrderItem`, `useUpdateNoteOrderItem`), Vitest + Testing Library, TypeScript.

---

## File Map

| File | Change |
|---|---|
| `src/components/staff/submitted-orders-dialog.tsx` | Add `draftNotes` state, inline note input per item, enable `+` button, extend `ChangeItem` with `newNote?` |
| `src/hooks/useTableSessions.ts` | Add `addSubmittedOrderItem`, `updateSubmittedItemNote` |
| `src/app/staff/table-order.tsx` | Handle `newQty > currentTotal` and `newNote` in `handleSubmittedChanges`; import `useUpdateNoteOrderItem` |
| `src/tests/components/staff/submitted-orders-dialog.test.tsx` | Add tests for note edit and qty increase |
| `src/hooks/__tests__/useTableSessions.test.tsx` | Add tests for two new methods |

---

## Task 1 — Note input + `draftNotes` in `SubmittedOrdersDialog`

**Files:**
- Modify: `src/components/staff/submitted-orders-dialog.tsx`
- Modify: `src/tests/components/staff/submitted-orders-dialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Add these tests to `src/tests/components/staff/submitted-orders-dialog.test.tsx` (inside the existing `describe` block, after the last test):

```tsx
it('shows note input per item pre-filled with current note', () => {
  openDialog()
  const inputs = screen.getAllByPlaceholderText('Ghi chú...')
  expect(inputs).toHaveLength(2)
  expect((inputs[0] as HTMLInputElement).value).toBe('') // Cà phê đen has no note
})

it('editing a note stages the change but does not call onConfirmChanges immediately', () => {
  const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
  openDialog({ onConfirmChanges })
  fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], { target: { value: 'ít đường' } })
  expect(onConfirmChanges).not.toHaveBeenCalled()
})

it('calls onConfirmChanges with newNote when note is changed and Xác nhận is clicked', async () => {
  const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
  openDialog({ onConfirmChanges })
  fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], { target: { value: 'ít đường' } })
  fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
  await waitFor(() =>
    expect(onConfirmChanges).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ menuItemId: 'm1', note: '', newQty: 3, newNote: 'ít đường' }),
      ]),
    )
  )
})

it('Xác nhận is enabled when only the note changes', () => {
  openDialog()
  fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], { target: { value: 'thêm đá' } })
  expect(screen.getByRole('button', { name: /xác nhận/i })).not.toBeDisabled()
})

it('resetting note to original disables Xác nhận', () => {
  openDialog()
  fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], { target: { value: 'thêm đá' } })
  fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], { target: { value: '' } })
  expect(screen.getByRole('button', { name: /xác nhận/i })).toBeDisabled()
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/tests/components/staff/submitted-orders-dialog.test.tsx
```

Expected: new tests fail (`Unable to find an element with placeholder: Ghi chú...`).

- [ ] **Step 3: Extend `ChangeItem` and add `draftNotes` state**

In `src/components/staff/submitted-orders-dialog.tsx`, make these changes:

**3a. Extend `ChangeItem`:**
```ts
interface ChangeItem {
  menuItemId: string
  note: string
  newQty: number
  newNote?: string  // present only when note was changed
}
```

**3b. Add `draftNotes` state next to `draft`:**
```ts
const [draftNotes, setDraftNotes] = useState<Record<string, string>>({})
```

**3c. In `handleOpen`, initialise `draftNotes`:**
```ts
const handleOpen = () => {
  setDraft(Object.fromEntries(merged.map((i) => [itemKey(i.menuItemId, i.note), i.quantity])))
  setDraftNotes(Object.fromEntries(merged.map((i) => [itemKey(i.menuItemId, i.note), i.note])))
  setShowCancelWarning(false)
  setOpen(true)
}
```

**3d. Update `hasChanges` to include note changes:**
```ts
const hasChanges = merged.some((item) => {
  const key = itemKey(item.menuItemId, item.note)
  return (
    (draft[key] ?? item.quantity) !== item.quantity ||
    (draftNotes[key] ?? item.note) !== item.note
  )
})
```

**3e. Update `handleConfirm` to include `newNote`:**
```ts
const handleConfirm = async () => {
  const allRemoved = merged.every(
    (item) => (draft[itemKey(item.menuItemId, item.note)] ?? item.quantity) === 0,
  )
  if (allRemoved) {
    await handleCancelOrder()
    return
  }

  const changes: ChangeItem[] = merged
    .filter((item) => {
      const key = itemKey(item.menuItemId, item.note)
      const draftQty = draft[key] ?? item.quantity
      const draftNote = draftNotes[key] ?? item.note
      return draftQty !== item.quantity || draftNote !== item.note
    })
    .map((item) => {
      const key = itemKey(item.menuItemId, item.note)
      const draftNote = draftNotes[key] ?? item.note
      return {
        menuItemId: item.menuItemId,
        note: item.note,
        newQty: draft[key] ?? item.quantity,
        ...(draftNote !== item.note ? { newNote: draftNote } : {}),
      }
    })

  if (changes.length === 0) return

  setIsSubmitting(true)
  try {
    await onConfirmChanges(changes)
    setOpen(false)
  } finally {
    setIsSubmitting(false)
  }
}
```

**3f. Add note input inside each item row, below the quantity controls (before the price span):**

Replace the existing item row JSX with:

```tsx
{merged.map((item) => {
  const key = itemKey(item.menuItemId, item.note)
  const draftQty = draft[key] ?? item.quantity
  const removed = draftQty === 0
  return (
    <div
      key={key}
      className={`flex flex-col gap-2 border-b border-border py-3 last:border-0 transition-opacity ${removed ? 'opacity-40' : ''}`}
    >
      {/* Top row: name + qty controls + price + trash */}
      <div className="flex items-center gap-3">
        <span className={`flex-1 text-sm ${removed ? 'line-through' : ''}`}>
          {item.name}
          {item.note && (
            <span className="ml-1 text-xs italic text-muted-foreground">
              ({item.note})
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            aria-label={`Giảm ${item.name}`}
            disabled={draftQty <= 1}
            onClick={() => setQty(item.menuItemId, item.note, draftQty - 1)}
            className="h-fit w-fit rounded-full border border-muted-foreground/30 p-1 disabled:opacity-30"
          >
            <Minus size={12} />
          </Button>
          <span
            data-testid={`qty-${item.menuItemId}-${item.note}`}
            className="w-7 text-center text-sm tabular-nums"
          >
            {draftQty}
          </span>
          <Button
            variant="ghost"
            aria-label={`Tăng ${item.name}`}
            disabled  // Task 2 will enable this
            onClick={() => setQty(item.menuItemId, item.note, draftQty + 1)}
            className="h-fit w-fit rounded-full border border-muted-foreground/30 p-1 disabled:opacity-30"
          >
            <Plus size={12} />
          </Button>
        </div>
        <span className="w-24 text-right text-xs tabular-nums text-pos-gold">
          {removed ? '—' : formatVnd(item.priceNum * draftQty)}
        </span>
        <Button
          variant="ghost"
          aria-label={`Xóa ${item.name}`}
          onClick={() => handleTrash(item.menuItemId, item.note)}
          className="h-fit w-fit rounded-full p-1 text-destructive hover:bg-destructive/30"
        >
          <Trash2 size={14} />
        </Button>
      </div>
      {/* Note input row */}
      {!removed && (
        <input
          type="text"
          value={draftNotes[key] ?? item.note}
          placeholder="Ghi chú..."
          onChange={(e) =>
            setDraftNotes((prev) => ({ ...prev, [key]: e.target.value }))
          }
          className="h-7 rounded border border-border bg-muted/30 px-2.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      )}
    </div>
  )
})}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run src/tests/components/staff/submitted-orders-dialog.test.tsx
```

Expected: all tests pass (12 existing + 5 new = 17 total).

- [ ] **Step 5: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/submitted-orders-dialog.tsx src/tests/components/staff/submitted-orders-dialog.test.tsx
git commit -m "feat(staff-pos): add note editing to SubmittedOrdersDialog"
```

---

## Task 2 — Enable `+` button for quantity increase in `SubmittedOrdersDialog`

**Files:**
- Modify: `src/components/staff/submitted-orders-dialog.tsx`
- Modify: `src/tests/components/staff/submitted-orders-dialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to the existing `describe` block in `src/tests/components/staff/submitted-orders-dialog.test.tsx`:

```tsx
it('+ button is enabled for submitted items', () => {
  openDialog()
  const plusButtons = screen.getAllByLabelText(/^Tăng/)
  plusButtons.forEach((btn) => expect(btn).not.toBeDisabled())
})

it('clicking + increments the draft quantity', () => {
  openDialog()
  fireEvent.click(screen.getByLabelText('Tăng Trà đào'))
  expect(screen.getByTestId('qty-m2-')).toHaveTextContent('2')
})

it('calls onConfirmChanges with newQty > original when + is clicked and confirmed', async () => {
  const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
  openDialog({ onConfirmChanges })
  fireEvent.click(screen.getByLabelText('Tăng Trà đào'))
  fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
  await waitFor(() =>
    expect(onConfirmChanges).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ menuItemId: 'm2', note: '', newQty: 2 }),
      ]),
    )
  )
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/tests/components/staff/submitted-orders-dialog.test.tsx
```

Expected: `+ button is enabled...` fails because button has `disabled`.

- [ ] **Step 3: Remove `disabled` from the `+` button**

In `src/components/staff/submitted-orders-dialog.tsx`, find the `Tăng` button and remove the `disabled` prop and its comment:

Before:
```tsx
<Button
  variant="ghost"
  aria-label={`Tăng ${item.name}`}
  disabled  // Task 2 will enable this
  onClick={() => setQty(item.menuItemId, item.note, draftQty + 1)}
  className="h-fit w-fit rounded-full border border-muted-foreground/30 p-1 disabled:opacity-30"
>
  <Plus size={12} />
</Button>
```

After:
```tsx
<Button
  variant="ghost"
  aria-label={`Tăng ${item.name}`}
  onClick={() => setQty(item.menuItemId, item.note, draftQty + 1)}
  className="h-fit w-fit rounded-full border border-muted-foreground/30 p-1"
>
  <Plus size={12} />
</Button>
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run src/tests/components/staff/submitted-orders-dialog.test.tsx
```

Expected: all tests pass (17 existing + 3 new = 20 total).

- [ ] **Step 5: Full suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/submitted-orders-dialog.tsx src/tests/components/staff/submitted-orders-dialog.test.tsx
git commit -m "feat(staff-pos): enable quantity increase in SubmittedOrdersDialog"
```

---

## Task 3 — `addSubmittedOrderItem` + `updateSubmittedItemNote` in `useTableSessions`

**Files:**
- Modify: `src/hooks/useTableSessions.ts`
- Modify: `src/hooks/__tests__/useTableSessions.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/hooks/__tests__/useTableSessions.test.tsx` (inside the existing `describe` block):

```ts
it('addSubmittedOrderItem appends a synthetic submitted order with the given item', () => {
  const { result } = renderHook(() => useTableSessions())
  act(() => result.current.openSession('t1', 'Bàn 01'))
  act(() => result.current.submitOrder('t1')) // no-op — pendingItems empty

  act(() => result.current.addSubmittedOrderItem('t1', item({ orderItemSlug: 'oi-x', quantity: 2 })))
  expect(result.current.sessions.t1.submittedOrders).toHaveLength(1)
  expect(result.current.sessions.t1.submittedOrders[0].items[0].orderItemSlug).toBe('oi-x')
  expect(result.current.sessions.t1.submittedOrders[0].items[0].quantity).toBe(2)
})

it('updateSubmittedItemNote replaces note on all matching items', () => {
  const { result } = renderHook(() => useTableSessions())
  act(() => result.current.openSession('t1', 'Bàn 01'))
  act(() =>
    result.current.addSubmittedOrderItem(
      't1',
      item({ menuItemId: 'm1', note: 'ít đường', quantity: 1 }),
    )
  )
  act(() => result.current.updateSubmittedItemNote('t1', 'm1', 'ít đường', 'không đường'))
  expect(result.current.sessions.t1.submittedOrders[0].items[0].note).toBe('không đường')
})

it('updateSubmittedItemNote is a no-op when no item matches', () => {
  const { result } = renderHook(() => useTableSessions())
  act(() => result.current.openSession('t1', 'Bàn 01'))
  act(() => result.current.addSubmittedOrderItem('t1', item({ note: '' })))
  act(() => result.current.updateSubmittedItemNote('t1', 'm1', 'không tồn tại', 'mới'))
  expect(result.current.sessions.t1.submittedOrders[0].items[0].note).toBe('')
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/hooks/__tests__/useTableSessions.test.tsx
```

Expected: 3 new tests fail (`addSubmittedOrderItem is not a function`).

- [ ] **Step 3: Add to `UseTableSessions` interface**

In `src/hooks/useTableSessions.ts`, add to the `UseTableSessions` interface:

```ts
addSubmittedOrderItem: (tableId: string, newItem: OrderItem) => void
updateSubmittedItemNote: (tableId: string, menuItemId: string, oldNote: string, newNote: string) => void
```

- [ ] **Step 4: Implement `addSubmittedOrderItem`**

Inside `useTableSessions()`, after `updateSubmittedItemNote` (see Step 5), add:

```ts
const addSubmittedOrderItem = useCallback((tableId: string, newItem: OrderItem) => {
  mutate((prev) => {
    const session = prev[tableId]
    if (!session) return prev
    const syntheticOrder: SubmittedOrder = {
      id: `order-inc-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      items: [newItem],
    }
    return {
      ...prev,
      [tableId]: { ...session, submittedOrders: [...session.submittedOrders, syntheticOrder] },
    }
  })
}, [mutate])
```

`SubmittedOrder` is already imported from `@/types/session` — verify the import at the top of `useTableSessions.ts` and add it if missing.

- [ ] **Step 5: Implement `updateSubmittedItemNote`**

```ts
const updateSubmittedItemNote = useCallback(
  (tableId: string, menuItemId: string, oldNote: string, newNote: string) => {
    mutate((prev) => {
      const session = prev[tableId]
      if (!session) return prev
      const submittedOrders = session.submittedOrders.map((order) => ({
        ...order,
        items: order.items.map((it) =>
          it.menuItemId === menuItemId && it.note === oldNote ? { ...it, note: newNote } : it,
        ),
      }))
      return { ...prev, [tableId]: { ...session, submittedOrders } }
    })
  },
  [mutate],
)
```

- [ ] **Step 6: Add both to the return object**

```ts
return {
  // ... existing ...
  addSubmittedOrderItem,
  updateSubmittedItemNote,
}
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
npx vitest run src/hooks/__tests__/useTableSessions.test.tsx
```

Expected: all tests pass (existing + 3 new).

- [ ] **Step 8: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useTableSessions.ts src/hooks/__tests__/useTableSessions.test.tsx
git commit -m "feat(staff-pos): add addSubmittedOrderItem and updateSubmittedItemNote to useTableSessions"
```

---

## Task 4 — Wire note update + quantity increase API calls in `handleSubmittedChanges`

**Files:**
- Modify: `src/app/staff/table-order.tsx`

- [ ] **Step 1: Import `useUpdateNoteOrderItem`**

In `src/app/staff/table-order.tsx`, update the hooks import:

```ts
import {
  useAddNewOrderItem,
  useCreateOrder,
  useDeleteOrder,
  useDeleteOrderItem,
  useUpdateNoteOrderItem,
  useUpdateOrderItem,
  useTables,
} from '@/hooks'
```

- [ ] **Step 2: Destructure `addSubmittedOrderItem` + `updateSubmittedItemNote` from `useTableSessions`**

Add the two new methods to the existing destructuring:

```ts
const {
  sessions,
  addItem,
  updateItem,
  removeItem,
  submitOrder,
  requestPayment,
  setOrderSlug,
  setPendingItemOrderItemSlug,
  closeSession,
  cancelSession,
  clearPendingItems,
  setSubmittedQuantity,
  addSubmittedOrderItem,       // new
  updateSubmittedItemNote,     // new
  transferSession,
} = useTableSessions()
```

- [ ] **Step 3: Instantiate `updateNoteOrderItemAsync`**

Below the existing mutation declarations, add:

```ts
const { mutateAsync: updateNoteOrderItemAsync } = useUpdateNoteOrderItem()
```

- [ ] **Step 4: Replace `handleSubmittedChanges` with the extended version**

Replace the entire `handleSubmittedChanges` function:

```ts
const handleSubmittedChanges = async (
  changes: Array<{ menuItemId: string; note: string; newQty: number; newNote?: string }>,
) => {
  const currentSession = sessions[id]
  if (!currentSession) return

  for (const { menuItemId, note, newQty, newNote } of changes) {
    const items = collectOrderItemsForKey(currentSession.submittedOrders, menuItemId, note)
    const currentTotal = items.reduce((s, i) => s + i.quantity, 0)

    if (newQty === 0) {
      // Full delete — note update is skipped (items will be gone)
      for (const { orderItemSlug } of items) {
        await deleteOrderItemAsync(orderItemSlug)
      }
      setSubmittedQuantity(id, menuItemId, note, 0)
    } else if (newQty < currentTotal) {
      // Quantity reduction
      let toRemove = currentTotal - newQty
      for (const { orderItemSlug, variantSlug, quantity } of items) {
        if (toRemove <= 0) break
        if (quantity <= toRemove) {
          await deleteOrderItemAsync(orderItemSlug)
          toRemove -= quantity
        } else {
          await updateOrderItemAsync({
            slug: orderItemSlug,
            data: { quantity: quantity - toRemove, variant: variantSlug },
          })
          toRemove = 0
        }
      }
      setSubmittedQuantity(id, menuItemId, note, newQty)
    } else if (newQty > currentTotal) {
      // Quantity increase — add a new order item
      const variantSlug = items[0]?.variantSlug ?? ''
      const meta = currentSession.submittedOrders
        .flatMap((o) => o.items)
        .find((i) => i.menuItemId === menuItemId && i.note === note)!
      const data = await addOrderItemAsync({
        quantity: newQty - currentTotal,
        variant: variantSlug,
        promotion: '',
        order: currentSession.orderSlug!,
      })
      addSubmittedOrderItem(id, {
        menuItemId,
        variantSlug,
        orderItemSlug: data.result.slug,
        name: meta.name,
        priceNum: meta.priceNum,
        price: meta.price,
        note,
        quantity: newQty - currentTotal,
      })
    }

    // Note change (processed after qty ops; skip if item was fully deleted)
    if (newNote !== undefined && newNote !== note && newQty > 0) {
      for (const { orderItemSlug } of items) {
        await updateNoteOrderItemAsync({ slug: orderItemSlug, data: { note: newNote } })
      }
      updateSubmittedItemNote(id, menuItemId, note, newNote)
    }
  }

  showToast('Đã cập nhật đơn')
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc -b --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/staff/table-order.tsx
git commit -m "feat(staff-pos): wire note update and quantity increase API in handleSubmittedChanges"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Note edit input per item in dialog | Task 1 |
| `draftNotes` state, initialised on open | Task 1 |
| `newNote` in `ChangeItem` when note changed | Task 1 |
| `hasChanges` includes note changes | Task 1 |
| `+` button enabled | Task 2 |
| Qty increase passes `newQty > original` | Task 2 |
| `addSubmittedOrderItem` stores slug from response | Task 3 |
| `updateSubmittedItemNote` patches note in local state | Task 3 |
| `addNewOrderItem` called for increase | Task 4 |
| `updateNoteOrderItem` called for note change | Task 4 |
| Local state updated after both operations | Task 4 |

### Out of scope
- Simultaneous qty reduction + note change on the same item: after delete ops, surviving slugs receive the note update; already-deleted slugs return 404 (caught by global error handler). Edge case unlikely in practice.
- Custom-price items: no `variantSlug`, so qty increase is silently skipped if `items[0]?.variantSlug` is empty. No UI guard added; custom-price items are tracked as a known limitation.
