# Reconciler Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 2 CRITICAL data-integrity bugs in the active-order-reconciliation feature shipped earlier today: (1) item-level changes from another device never sync into local UI, (2) transfer-table feature silently destroys server-side order data after merge of reconciliation.

**Architecture:** Tách bug-by-bug:
1. **Reconciler item sync** — thêm action `'refresh'` vào `ReconcileAction` để always re-sync `submittedOrders` từ server kể cả khi `orderSlug` không đổi. Caller áp `replaceSubmittedOrders` silently.
2. **Transfer guard** — disable nút "Đổi bàn" khi local session đã có `orderSlug` (đơn đã tồn tại server-side). Pending-only transfer vẫn cho phép vì không đụng server. Kèm tooltip giải thích. Đây là band-aid cho tới khi có API `PATCH /orders/{slug}` để move order giữa các bàn.

**Tech Stack:** React + TanStack Query, Zustand, Vitest + Testing Library, TypeScript.

**Out of scope (đã document trong phân tích — plan riêng):**
- Server constraint "1 PENDING order per table" + 409 handling cho 2 staff race.
- Idempotency key cho createOrder.
- Confirm dialog khi server-side cancel happens.
- Payment/Receipt screen reconciliation.
- Floor plan bulk hydrate.
- PendingItems realtime sync.
- Cross-tab sync.
- API to actually transfer order on the server (this plan only stops silent data destruction).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/staff-orders.ts` | Modify | Add `'refresh'` variant to `ReconcileAction`, update `computeSessionReconciliation` decision tree. |
| `src/lib/__tests__/staff-orders.test.ts` | Modify | Update the now-incorrect "noop when same slug" test to assert `'refresh'`; add tests for the new branch. |
| `src/app/staff/table-order.tsx` | Modify | Handle `'refresh'` case in switch (silent `replaceSubmittedOrders`); pass `hasServerOrder` flag to `TransferTableDialog`. |
| `src/components/staff/transfer-table-dialog.tsx` | Modify | Accept `disabledReason?: string` prop; render trigger button disabled with title attribute when prop is set. |
| `src/tests/components/staff/transfer-table-dialog.test.tsx` | Modify | Add 2 tests: disabled state when `disabledReason` is set, enabled otherwise. |

---

### Task 1: Add `'refresh'` action to reconciler

**Files:**
- Modify: `src/lib/staff-orders.ts`
- Test: `src/lib/__tests__/staff-orders.test.ts`

The current decision tree returns `noop` when `localSlug === serverOrder.slug`. This misses item-level changes (quantity edit, item delete, new item added by another device) since the slug doesn't change. Replace that branch with a new `'refresh'` action that carries a fresh `submittedOrder` snapshot.

- [ ] **Step 1: Update the failing test for the now-incorrect noop case**

In `src/lib/__tests__/staff-orders.test.ts`, find the existing test:

```ts
  it('returns noop when both sides have the same orderSlug', () => {
    const local = makeSession({ orderSlug: 'order-abc' })
    const server = makeOrder({ slug: 'order-abc' })
    expect(computeSessionReconciliation(local, server)).toEqual({ type: 'noop' })
  })
```

Replace it with:

```ts
  it('returns refresh when both sides have the same orderSlug (resync items from server)', () => {
    const local = makeSession({ orderSlug: 'order-abc' })
    const server = makeOrder({ slug: 'order-abc' })
    const action = computeSessionReconciliation(local, server)
    expect(action.type).toBe('refresh')
    if (action.type === 'refresh') {
      expect(action.submittedOrder.id).toBe('order-abc')
      expect(action.submittedOrder.items).toHaveLength(2)
    }
  })
```

- [ ] **Step 2: Run failing test**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t 'returns refresh'`
Expected: FAIL — assertion mismatches because current code still returns `{ type: 'noop' }`.

- [ ] **Step 3: Update `ReconcileAction` union**

In `src/lib/staff-orders.ts`, find the `ReconcileAction` type (~line 154) and add the `'refresh'` variant:

```ts
export type ReconcileAction =
  | { type: 'noop' }
  | { type: 'hydrate'; orderSlug: string; submittedOrder: SubmittedOrder }
  | { type: 'refresh'; submittedOrder: SubmittedOrder }
  | { type: 'clear'; staleOrderSlug: string }
  | {
      type: 'mismatch'
      localOrderSlug: string
      serverOrderSlug: string
      submittedOrder: SubmittedOrder
    }
```

- [ ] **Step 4: Update `computeSessionReconciliation` decision tree**

In the same file, find the `if (localSlug === serverOrder.slug) { return { type: 'noop' } }` block. Replace it with:

```ts
  if (localSlug === serverOrder.slug) {
    return {
      type: 'refresh',
      submittedOrder: mapServerOrderToSubmitted(serverOrder),
    }
  }
```

The rest of the function stays the same.

- [ ] **Step 5: Run new test to verify it passes**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t 'returns refresh'`
Expected: PASS.

- [ ] **Step 6: Add coverage test for item-level changes**

This is the bug the new action exists for — test that quantity changes in the server payload are reflected. Append inside the `describe('computeSessionReconciliation', ...)` block (after the new refresh test):

```ts
  it('refresh action carries updated item quantities from server', () => {
    const local = makeSession({ orderSlug: 'order-abc' })
    const server = makeOrder({
      slug: 'order-abc',
      orderItems: [
        makeDetail({ slug: 'oi-1', quantity: 5 }), // server-side qty change
      ],
    } as unknown as Parameters<typeof makeOrder>[0])
    const action = computeSessionReconciliation(local, server)
    expect(action.type).toBe('refresh')
    if (action.type === 'refresh') {
      expect(action.submittedOrder.items).toHaveLength(1)
      expect(action.submittedOrder.items[0].quantity).toBe(5)
    }
  })
```

- [ ] **Step 7: Run new test**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t 'refresh action carries'`
Expected: PASS.

- [ ] **Step 8: Run full file to confirm no regressions**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts`
Expected: all PASS (15 tests total = original 14 minus 1 replaced + 2 new = 15). Verify the count matches.

- [ ] **Step 9: Run typecheck**

Run: `npx tsc -b 2>&1 | head -10`
Expected: clean.

⚠️ Expect `tsc` to also report errors in `src/app/staff/table-order.tsx` because the switch in the reconciliation effect no longer exhaustively handles `ReconcileAction` (TS narrows on discriminated unions). If you see errors there, that's the Task 2 signal — proceed to Task 2 immediately (do NOT silence the errors).

---

### Task 2: Handle `'refresh'` action in `table-order.tsx`

**Files:**
- Modify: `src/app/staff/table-order.tsx`

- [ ] **Step 1: Find the switch in the reconciliation effect**

Open `src/app/staff/table-order.tsx`. Find the `switch (action.type)` block inside the reconciliation `useEffect`. It currently has cases `'noop'`, `'hydrate'`, `'mismatch'`, `'clear'`.

- [ ] **Step 2: Add `'refresh'` case**

Insert directly after `case 'noop':`:

```ts
      case 'refresh': {
        // Silent re-sync of submitted items when another device modified the order
        // (item quantity edit, item deleted, new item added) without changing orderSlug.
        // No toast — this is normal background sync.
        replaceSubmittedOrders(id, [action.submittedOrder])
        return
      }
```

- [ ] **Step 3: Verify typecheck clean**

Run: `npx tsc -b 2>&1 | head -10`
Expected: clean. If there's still an "ReconcileAction not exhaustive" error, the case wasn't added correctly.

- [ ] **Step 4: Verify lint**

Run: `npx eslint src/app/staff/table-order.tsx 2>&1 | head -10`
Expected: clean.

- [ ] **Step 5: Verify full vitest still passes**

Run: `npx vitest run 2>&1 | tail -5`
Expected: all PASS. The component-level wiring isn't unit-tested (it's a `useEffect` switch), so we rely on the pure-function test from Task 1 + typecheck for correctness.

- [ ] **Step 6: Manual sanity check (no automation)**

Cannot easily unit-test the effect. The fix is observable in the smoke scenario:
- Open table T from Device A → submit some items.
- Open table T from Device B → see the items.
- On Device A, edit quantity of an item via `SubmittedOrdersDialog` → confirm.
- Switch to Device B (window focus). Expected: B's "Đã đặt" line + dialog now show the new quantity automatically (previously: stale until B navigated out/in).

Record PASS/FAIL after a manual run.

---

### Task 3: Block transfer when server-side order exists

**Files:**
- Modify: `src/components/staff/transfer-table-dialog.tsx`
- Modify: `src/app/staff/table-order.tsx`
- Test: `src/tests/components/staff/transfer-table-dialog.test.tsx`

Today `transferSession` is local-only Zustand. After this morning's reconciler ships, transferring a table that has `orderSlug` causes:
1. Server still has the order at the OLD table.
2. Reconciler at the NEW table sees server null → fires `clear` → toast + may navigate away → user loses sight of the order.
3. The OLD table's order becomes an orphan visible to any other staff opening that table.

Until backend exposes a "move order between tables" API, the safest fix is to **disable the transfer trigger** when the session has any server-side state (`orderSlug` set OR `submittedOrders.length > 0` — both indicate server has work tied to this table). Pending-only transfer is still allowed because that state is purely client-side.

- [ ] **Step 1: Add `disabledReason` prop to `TransferTableDialog`**

In `src/components/staff/transfer-table-dialog.tsx`, update the Props interface:

```ts
interface Props {
  currentTableId: string
  currentTableName: string
  tables: Table[]
  sessions: Record<string, TableSession>
  onTransfer: (toTableId: string, toTableName: string) => void
  disabledReason?: string
}
```

Update component signature to destructure it:

```ts
export function TransferTableDialog({
  currentTableId,
  currentTableName,
  tables,
  sessions,
  onTransfer,
  disabledReason,
}: Props) {
```

Update the trigger button (currently just `<Button variant="outline" size="sm" onClick={handleOpen}>Đổi bàn</Button>`):

```tsx
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={!!disabledReason}
        title={disabledReason}
        aria-label={disabledReason ? `Đổi bàn — ${disabledReason}` : 'Đổi bàn'}
      >
        Đổi bàn
      </Button>
```

- [ ] **Step 2: Add disabled-state test**

In `src/tests/components/staff/transfer-table-dialog.test.tsx`, find the existing `describe` block. Add inside it:

```ts
  it('disables the trigger and surfaces the reason via title when disabledReason is set', () => {
    render(
      <TransferTableDialog
        currentTableId="t1"
        currentTableName="Bàn 01"
        tables={[
          { id: 't1', label: 'Bàn 01', seats: 4 },
          { id: 't2', label: 'Bàn 02', seats: 4 },
        ]}
        sessions={{}}
        onTransfer={vi.fn()}
        disabledReason="Đã có đơn ghi nhận, không thể đổi bàn"
      />,
    )
    const trigger = screen.getByRole('button', { name: /Đổi bàn/ })
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveAttribute('title', 'Đã có đơn ghi nhận, không thể đổi bàn')
  })

  it('keeps the trigger enabled when no disabledReason', () => {
    render(
      <TransferTableDialog
        currentTableId="t1"
        currentTableName="Bàn 01"
        tables={[{ id: 't1', label: 'Bàn 01', seats: 4 }]}
        sessions={{}}
        onTransfer={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Đổi bàn' })).toBeEnabled()
  })
```

Note: the test file already imports `render`, `screen`, `vi`. If imports are missing, mirror what the existing tests use.

- [ ] **Step 3: Run new tests**

Run: `npx vitest run src/tests/components/staff/transfer-table-dialog.test.tsx -t 'disables the trigger\|keeps the trigger enabled'`
Expected: 2 PASS.

- [ ] **Step 4: Run full test file for no regressions**

Run: `npx vitest run src/tests/components/staff/transfer-table-dialog.test.tsx`
Expected: all PASS (existing + 2 new).

- [ ] **Step 5: Wire `disabledReason` from `table-order.tsx`**

In `src/app/staff/table-order.tsx`, find the `<TransferTableDialog ... />` usage (~line 346). Add prop computation right before it (inside the component body, where other derived values live):

```ts
  const transferDisabledReason =
    (session.orderSlug || session.submittedOrders.length > 0)
      ? 'Hoàn thành thanh toán hoặc hủy đơn hiện tại trước khi chuyển bàn'
      : undefined
```

Update the JSX:

```tsx
              <TransferTableDialog
                currentTableId={id}
                currentTableName={session.tableName}
                tables={tables}
                sessions={sessions}
                onTransfer={handleTransfer}
                disabledReason={transferDisabledReason}
              />
```

Placement note: this expression uses `session`, so it must come AFTER the `if (!session)` gate. Look at existing code — derive `transferDisabledReason` right above the JSX return, or inline it into the JSX as `disabledReason={(session.orderSlug || session.submittedOrders.length > 0) ? '...' : undefined}` if you prefer terseness.

- [ ] **Step 6: Run typecheck + lint**

Run: `npx tsc -b 2>&1 | head -10`
Expected: clean.

Run: `npx eslint src/app/staff/table-order.tsx src/components/staff/transfer-table-dialog.tsx 2>&1 | head -10`
Expected: clean.

- [ ] **Step 7: Run full vitest**

Run: `npx vitest run 2>&1 | tail -5`
Expected: all PASS.

- [ ] **Step 8: Manual smoke (no automation)**

Cannot reproduce server-state easily in unit test. Manual scenarios:
1. Open table → don't submit anything → click "Đổi bàn" → expected: dialog opens (enabled because no server state).
2. Open table → add items → bấm "ĐẶT MÓN" (creates server order, `orderSlug` set) → click "Đổi bàn" → expected: button disabled, hover shows tooltip "Hoàn thành thanh toán hoặc hủy đơn hiện tại trước khi chuyển bàn".
3. With submitted order, "Hủy đơn" → expected: button re-enables (since `cancelSession` removes session entirely; if user re-opens the table fresh, no orderSlug yet).

Record PASS/FAIL after a manual run.

---

### Task 4: Full regression

- [ ] **Step 1: Run all tests**

Run: `npx vitest run 2>&1 | tail -10`
Expected: all PASS. Net change in test count: +3 from Task 1 (replaced 1 + added 2) + 2 from Task 3 = **+5 tests** vs. baseline of 493 → **498 expected**.

- [ ] **Step 2: Run build (lint + tsc + vite)**

Run: `npm run build 2>&1 | tail -15`
Expected: PASS, dist/ produced.

- [ ] **Step 3: End-to-end smoke**

Run: `npm run dev`. Verify Task 2 Step 6 + Task 3 Step 8 manual scenarios pass. Plus the existing scenarios from the morning's plan (Task 5 Step 6 of `2026-06-06-active-order-reconciliation.md`) still pass — specifically the cross-device hydrate path shouldn't be affected by these changes.

Record observations.

---

## Self-Review

**Spec coverage:**
- Issue 1 (item-level sync gap) ↔ Task 1 + Task 2. ✓
- Issue 2 (transfer destroys data) ↔ Task 3 (band-aid disable; real fix needs backend). ✓

**Placeholder scan:** No TBD/TODO. Each step has either code or exact command.

**Type consistency:**
- `ReconcileAction` adds `'refresh'` variant with `submittedOrder: SubmittedOrder` field — matches the field name used in `'hydrate'` and `'mismatch'` for consistency. The caller in Task 2 reads `action.submittedOrder` — matches.
- `replaceSubmittedOrders(id, [action.submittedOrder])` — matches existing setter signature `(tableId: string, orders: SubmittedOrder[]) => void`.
- `TransferTableDialog.disabledReason?: string` consistent between component declaration, test usage, and caller wiring.
- `session.orderSlug` is `string | undefined` (optional in `TableSession` per `types/session.ts:31`). The check `session.orderSlug || session.submittedOrders.length > 0` correctly treats empty string and undefined as "no server state". (Note: this morning's fix uses `setOrderSlug(id, '')` in the `clear` branch — empty string IS the "no server" signal, so check is correct.)

**Out-of-scope guardrails:**
- Task 3 is explicitly band-aid; the comment in the toast/tooltip text leans staff toward "complete current order first". Plan document calls out the real fix needs backend API.
- No realtime push, no cross-tab sync, no payment/receipt reconciliation introduced.
