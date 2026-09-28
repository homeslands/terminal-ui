# Staff POS UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 UX issues phát hiện sau khi rà use case thực tế staff-assisted ordering — restore "Đổi bàn" feature via soft-transfer pattern, chống tạo đơn trùng do double-tap, dạy `SubmittedOrdersDialog` tự đóng khi data đổi, prompt khi back ra với pending unsubmitted, và polling định kỳ cho tablet kiosk.

**Architecture:**

1. **Soft transfer**: thêm field `transferredFromTable` vào `TableSession`. Khi staff confirm dialog cảnh báo, transfer giữ `orderSlug` + ghi field này. Reconciler đọc field này và bỏ qua `clear` action (vì server ở bàn mới chưa biết về order). UI header hiện badge "⚠ Bill server vẫn ghi bàn cũ".

2. **Submit-pending guard**: hoist `isPending` từ `useCreateOrder` + `useAddNewOrderItem` lên `table-order.tsx`, pass vào `ConfirmOrderDialog` → disable cả trigger lẫn nút XÁC NHẬN khi đang gửi.

3. **SubmittedOrdersDialog stale-close**: dialog snapshot `submittedOrders` lúc mở; nếu prop đổi structurally (orderItemSlug set khác đi) → tự đóng + toast "Dữ liệu đã thay đổi, vui lòng mở lại".

4. **Empty session back prompt**: trong `handleBack`, nếu chỉ có pendingItems (no server state), show confirm dialog "Bỏ X món chưa đặt?".

5. **Polling cho kiosk**: thêm `refetchInterval: 30_000` vào `useGetActiveOrderByTable`. Tablet fullscreen không có focus event sẽ vẫn sync mỗi 30s.

**Tech Stack:** React 18, TanStack Query v5, Zustand + persist, Vitest + Testing Library, TypeScript.

**Out of scope (cần plan riêng / backend / product align):**
- API `PATCH /orders/{slug}.table` để thực sự move order trên server (Phase 2 của soft transfer).
- Chef workflow khi staff cancel/edit item đã in bill (business + backend).
- Realtime push thay thế polling 30s.
- Floor plan bulk hydrate.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/session.ts` | Modify | Thêm field `transferredFromTable?: string` vào `TableSession`. |
| `src/stores/table-sessions.store.ts` | Modify | Cập nhật `transferSession` action để set `transferredFromTable` khi origin có `orderSlug`; thêm setter `clearTransferredMark`. |
| `src/lib/staff-orders.ts` | Modify | `computeSessionReconciliation`: nếu local có `transferredFromTable` + server null → noop thay vì clear. |
| `src/lib/__tests__/staff-orders.test.ts` | Modify | +1 test cho branch transferred → noop. |
| `src/lib/staff-orders.ts` (sub: `transferSession` helper) | Modify | Propagate `transferredFromTable` trong helper move. |
| `src/components/staff/transfer-table-dialog.tsx` | Modify | Bỏ logic `disabledReason`; thêm prop `requiresConfirm?: boolean` + dialog cảnh báo "Bill vẫn in bàn cũ". |
| `src/tests/components/staff/transfer-table-dialog.test.tsx` | Modify | Update 2 tests cũ (disabled state), +1 test cho confirm dialog flow. |
| `src/app/staff/table-order.tsx` | Modify | (a) wire `requiresConfirm` vào TransferTableDialog dựa trên server state; (b) hoist `isPending` của `useCreateOrder`+`useAddNewOrderItem` xuống `ConfirmOrderDialog`; (c) `handleBack` confirm prompt; (d) clear `transferredFromTable` sau khi cancel/pay; (e) header badge khi `transferredFromTable` set. |
| `src/components/staff/confirm-order-dialog.tsx` | Modify | Thêm prop `submitting?: boolean` → disable trigger + XÁC NHẬN button khi true. |
| `src/components/staff/submitted-orders-dialog.tsx` | Modify | Snapshot orderItemSlug set lúc mở; useEffect compare; tự đóng + onStaleClose callback khi structurally khác. |
| `src/hooks/use-order.ts` | Modify | Thêm `refetchInterval: 30_000` vào `useGetActiveOrderByTable`. |

---

### Task 1: Schema + helper — track `transferredFromTable`

**Files:**
- Modify: `src/types/session.ts`
- Modify: `src/stores/table-sessions.store.ts`
- Modify: `src/lib/staff-orders.ts` (the `transferSession` helper)
- Test: `src/hooks/__tests__/useTableSessions.test.tsx`

- [ ] **Step 1: Add field to TableSession**

Open `src/types/session.ts`. In the `TableSession` interface (around line 24), add:

```ts
export interface TableSession {
  tableId: string
  tableName: string
  status: TableSessionStatus
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  openedAt: string
  orderSlug?: string
  invoiceRequest?: InvoiceRequest
  /**
   * Set when this session was moved from another table via `transferSession`
   * while it had an active server order. The server still ghi nhận order ở
   * `transferredFromTable`. Used by reconciler to suppress `clear` and by UI
   * to show a warning badge. Cleared when order is paid/canceled.
   */
  transferredFromTable?: string
}
```

- [ ] **Step 2: Write failing test for transferSession propagation**

In `src/hooks/__tests__/useTableSessions.test.tsx`, append inside the main `describe('useTableSessions', ...)`:

```ts
  it('transferSession marks transferredFromTable on the new session when origin has orderSlug', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.setOrderSlug('t1', 'order-abc'))
    act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
    expect(result.current.sessions.t2.transferredFromTable).toBe('t1')
    expect(result.current.sessions.t2.orderSlug).toBe('order-abc')
    expect(result.current.sessions.t1).toBeUndefined()
  })

  it('transferSession does not mark transferredFromTable when origin has no orderSlug', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
    expect(result.current.sessions.t2.transferredFromTable).toBeUndefined()
  })

  it('clearTransferredMark removes transferredFromTable', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.setOrderSlug('t1', 'order-abc'))
    act(() => result.current.transferSession('t1', 't2', 'Bàn 02'))
    act(() => result.current.clearTransferredMark('t2'))
    expect(result.current.sessions.t2.transferredFromTable).toBeUndefined()
  })
```

- [ ] **Step 3: Run failing tests**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx -t 'transferSession marks\|clearTransferredMark'`
Expected: 3 FAIL (setter missing + field not propagated).

- [ ] **Step 4: Update `transferSession` helper trong `staff-orders.ts`**

Open `src/lib/staff-orders.ts`. Find the existing `transferSession(prev, fromTableId, toTableId, newTableName)` helper. Modify it to set `transferredFromTable` IF source had `orderSlug`:

```ts
export function transferSession(
  prev: Record<string, TableSession>,
  fromTableId: string,
  toTableId: string,
  newTableName: string,
): Record<string, TableSession> {
  const source = prev[fromTableId]
  if (!source) return prev
  if (prev[toTableId]) return prev // target occupied
  const next = { ...prev }
  delete next[fromTableId]
  next[toTableId] = {
    ...source,
    tableId: toTableId,
    tableName: newTableName,
    // Mark soft-transfer state so reconciler knows server doesn't know about
    // the new table yet (server still ghi nhận order ở fromTableId).
    ...(source.orderSlug ? { transferredFromTable: fromTableId } : {}),
  }
  return next
}
```

If the helper currently has different shape (e.g. just spreads source as-is), preserve existing fields + add the conditional `transferredFromTable`.

- [ ] **Step 5: Add `clearTransferredMark` setter to store**

In `src/stores/table-sessions.store.ts`, add to interface `ITableSessionsStore` (after `replaceSubmittedOrders`):

```ts
  clearTransferredMark: (tableId: string) => void
```

Add to implementation (after `replaceSubmittedOrders`):

```ts
      clearTransferredMark: (tableId) =>
        set((state) =>
          patchSession(state, tableId, (session) => {
            if (!session.transferredFromTable) return session
            const { transferredFromTable: _t, ...rest } = session
            void _t
            return rest as TableSession
          }),
        ),
```

(The `void _t` is to satisfy linter for unused destructured var; or use eslint-disable comment if your codebase prefers that.)

- [ ] **Step 6: Run tests again**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx -t 'transferSession marks\|clearTransferredMark'`
Expected: 3 PASS.

- [ ] **Step 7: Full hook test file no regression**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx`
Expected: 28 PASS (25 cũ + 3 mới).

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b 2>&1 | head -10`
Expected: clean.

---

### Task 2: Reconciler awareness of `transferredFromTable`

**Files:**
- Modify: `src/lib/staff-orders.ts`
- Test: `src/lib/__tests__/staff-orders.test.ts`

Khi local có `transferredFromTable` set + server returns null → đó là trạng thái soft transfer, KHÔNG phải đơn bị xóa. Reconciler phải trả `noop` thay vì `clear`.

- [ ] **Step 1: Failing test**

In `src/lib/__tests__/staff-orders.test.ts`, append inside `describe('computeSessionReconciliation', ...)`:

```ts
  it('returns noop when local has transferredFromTable + orderSlug and server returns null (soft transfer)', () => {
    const local = makeSession({
      orderSlug: 'order-abc',
      transferredFromTable: 't1',
    })
    const action = computeSessionReconciliation(local, null)
    expect(action).toEqual({ type: 'noop' })
  })

  it('still returns clear when no transferredFromTable and server returns null', () => {
    const local = makeSession({ orderSlug: 'order-abc' })
    const action = computeSessionReconciliation(local, null)
    expect(action).toEqual({ type: 'clear', staleOrderSlug: 'order-abc' })
  })
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t 'soft transfer\|still returns clear'`
Expected: first FAIL (returns clear), second PASS (existing behavior).

- [ ] **Step 3: Update `computeSessionReconciliation`**

In `src/lib/staff-orders.ts`, find the block:

```ts
  if (!serverOrder) {
    return localSlug ? { type: 'clear', staleOrderSlug: localSlug } : { type: 'noop' }
  }
```

Replace with:

```ts
  if (!serverOrder) {
    if (!localSlug) return { type: 'noop' }
    // Soft-transferred session: server doesn't know about this table yet.
    // Suppress clear so user doesn't lose data; UI shows warning badge.
    if (localSession?.transferredFromTable) return { type: 'noop' }
    return { type: 'clear', staleOrderSlug: localSlug }
  }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts`
Expected: all PASS (existing + 2 new = 16 tests in file).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b 2>&1 | head -10`
Expected: clean.

---

### Task 3: `TransferTableDialog` confirm-flow + UI badge

**Files:**
- Modify: `src/components/staff/transfer-table-dialog.tsx`
- Modify: `src/app/staff/table-order.tsx`
- Test: `src/tests/components/staff/transfer-table-dialog.test.tsx`

Bỏ logic `disabledReason` (chuyển sang `requiresConfirm`). Khi `requiresConfirm=true`, click trigger sẽ mở confirm dialog cảnh báo TRƯỚC khi mở selector chọn bàn.

- [ ] **Step 1: Update `TransferTableDialog` props + logic**

Open `src/components/staff/transfer-table-dialog.tsx`. Replace `disabledReason?: string` in Props with:

```ts
interface Props {
  currentTableId: string
  currentTableName: string
  tables: Table[]
  sessions: Record<string, TableSession>
  onTransfer: (toTableId: string, toTableName: string) => void
  /**
   * When true, clicking the trigger first shows a soft-transfer warning dialog
   * (server vẫn ghi đơn ở bàn cũ). Staff phải confirm trước khi vào selector.
   */
  requiresConfirm?: boolean
}
```

Update component destructure to take `requiresConfirm` instead of `disabledReason`. Update the trigger button: enabled always, but `handleOpen` checks `requiresConfirm`:

```tsx
  const [showWarning, setShowWarning] = useState(false)

  const handleTriggerClick = () => {
    if (requiresConfirm) {
      setShowWarning(true)
      return
    }
    handleOpen()
  }

  const handleWarningConfirm = () => {
    setShowWarning(false)
    handleOpen()
  }
```

Replace trigger button:

```tsx
      <Button variant="outline" size="sm" onClick={handleTriggerClick}>
        Đổi bàn
      </Button>
```

Add warning dialog at the bottom of the component (before closing fragment):

```tsx
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Cảnh báo đổi bàn có đơn</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Đơn hiện tại đang ghi nhận ở <strong>{currentTableName}</strong> trên server. Khi đổi sang bàn mới:</p>
            <ul className="list-disc pl-5 space-y-1 text-pos-muted">
              <li>Bill in ra vẫn ghi <strong>{currentTableName}</strong> cho tới khi đơn hoàn tất</li>
              <li>Bếp đã in ticket với <strong>{currentTableName}</strong></li>
              <li>Cần thông báo bếp + cashier về việc khách đã chuyển bàn</li>
            </ul>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setShowWarning(false)}>HỦY</Button>
            <Button onClick={handleWarningConfirm} className="bg-pos-gold text-black hover:bg-pos-gold/80">
              TÔI ĐÃ HIỂU, ĐỔI BÀN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

You'll need to add `DialogFooter` import if not present. Reuse existing `useState` import.

- [ ] **Step 2: Update existing tests**

In `src/tests/components/staff/transfer-table-dialog.test.tsx`, find the 2 tests added in the morning fixes:
- `'disables the trigger and surfaces the reason via title when disabledReason is set'`
- `'keeps the trigger enabled when no disabledReason'`

Replace them with:

```ts
  it('opens warning dialog before selector when requiresConfirm is set', async () => {
    const onTransfer = vi.fn()
    render(
      <TransferTableDialog
        currentTableId="t1"
        currentTableName="Bàn 01"
        tables={tables}
        sessions={{}}
        onTransfer={onTransfer}
        requiresConfirm
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đổi bàn' }))
    // Warning dialog appears, not the selector
    expect(screen.getByText(/Cảnh báo đổi bàn có đơn/)).toBeInTheDocument()
    expect(screen.queryByText('Bàn 02')).not.toBeInTheDocument()
    // Confirm the warning
    fireEvent.click(screen.getByRole('button', { name: /TÔI ĐÃ HIỂU/ }))
    // Selector now appears
    expect(screen.getByText('Bàn 02')).toBeInTheDocument()
  })

  it('opens selector directly when requiresConfirm is not set', () => {
    render(
      <TransferTableDialog
        currentTableId="t1"
        currentTableName="Bàn 01"
        tables={tables}
        sessions={{}}
        onTransfer={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đổi bàn' }))
    expect(screen.queryByText(/Cảnh báo/)).not.toBeInTheDocument()
    expect(screen.getByText('Bàn 02')).toBeInTheDocument()
  })

  it('does not call onTransfer when warning is canceled', () => {
    const onTransfer = vi.fn()
    render(
      <TransferTableDialog
        currentTableId="t1"
        currentTableName="Bàn 01"
        tables={tables}
        sessions={{}}
        onTransfer={onTransfer}
        requiresConfirm
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đổi bàn' }))
    fireEvent.click(screen.getByRole('button', { name: 'HỦY' }))
    expect(screen.queryByText(/Cảnh báo/)).not.toBeInTheDocument()
    expect(onTransfer).not.toHaveBeenCalled()
  })
```

- [ ] **Step 3: Run dialog test file**

Run: `npx vitest run src/tests/components/staff/transfer-table-dialog.test.tsx`
Expected: existing 8 cũ - 2 replaced + 3 mới = 9 PASS. Verify count.

- [ ] **Step 4: Wire `requiresConfirm` in `table-order.tsx`**

Open `src/app/staff/table-order.tsx`. Find the existing `transferDisabledReason` block (added in morning fix) — REMOVE it:

```ts
  const transferDisabledReason =
    (session.orderSlug || session.submittedOrders.length > 0)
      ? 'Hoàn thành thanh toán hoặc hủy đơn hiện tại trước khi chuyển bàn'
      : undefined
```

Replace with:

```ts
  const requiresTransferConfirm = !!(session.orderSlug || session.submittedOrders.length > 0)
```

Update the JSX usage of `<TransferTableDialog>`: change `disabledReason={transferDisabledReason}` → `requiresConfirm={requiresTransferConfirm}`.

- [ ] **Step 5: Add header badge when transferred**

In `src/app/staff/table-order.tsx`, find `<PosPageHeader ... center={<TableStatusBadge ... />} ... />`. Add a wrapper around `TableStatusBadge` that includes the transferred badge:

```tsx
        center={
          <div className="flex items-center gap-2">
            <TableStatusBadge tableName={session.tableName} status={session.status} />
            {session.transferredFromTable && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-400"
                title={`Bill server vẫn ghi tên bàn cũ. Đơn được khởi tạo ở ${session.transferredFromTable}`}
              >
                ⚠ Đã chuyển bàn
              </span>
            )}
          </div>
        }
```

- [ ] **Step 6: Clear `transferredFromTable` sau khi pay/cancel**

Find `handleCancelOrder` — sau `await deleteOrderAsync(...)` và TRƯỚC `cancelSession(id)`, không cần thêm gì (cancelSession xóa luôn session, mất cả `transferredFromTable`).

Find `handlePay` — đây là chỗ navigate sang payment screen. Sau khi user thanh toán xong, `payment.tsx` thường gọi `closeSession`. Để đảm bảo `transferredFromTable` được dọn ở payment success path: trong `handlePay`, sau khi `requestPayment(id)` và TRƯỚC `navigate(...)`, gọi `clearTransferredMark(id)`. Destructure `clearTransferredMark` từ `useTableSessions()`.

```ts
  const handlePay = () => {
    requestPayment(id)
    clearTransferredMark(id)
    navigate(`/staff/table/${id}/payment`)
  }
```

(Rationale: nếu staff đã quyết định thanh toán, đơn sắp đóng — clear mark để nếu họ back ra/vào lại không còn badge.)

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b 2>&1 | head -10`
Run: `npx eslint src/app/staff/table-order.tsx src/components/staff/transfer-table-dialog.tsx 2>&1 | head -10`
Expected: clean.

- [ ] **Step 8: Full vitest**

Run: `npx vitest run 2>&1 | tail -5`
Expected: all PASS.

- [ ] **Step 9: Manual smoke**

Scenarios cần test thủ công:
1. Đổi bàn khi không có gì (chỉ pending hoặc trống) → selector mở thẳng, không có warning. ✓
2. Đổi bàn khi đã submit (có orderSlug) → warning dialog mở trước. Bấm HỦY → đóng dialog, không transfer. ✓
3. Bấm "TÔI ĐÃ HIỂU" → selector mở → chọn bàn mới → transfer thành công.
4. Sau transfer: header bàn mới có badge "⚠ Đã chuyển bàn", hover thấy tooltip.
5. Reconciler không destroy data (kiểm tra submittedOrders còn nguyên ở bàn mới).
6. Bấm "Thanh toán" → navigate payment, sau đó back → badge biến mất.
7. Bấm "Hủy đơn" → cancelSession + navigate /staff. OK.

Record PASS/FAIL.

---

### Task 4: Disable submit trigger when mutation pending

**Files:**
- Modify: `src/components/staff/confirm-order-dialog.tsx`
- Modify: `src/app/staff/table-order.tsx`

- [ ] **Step 1: Add `submitting` prop to `ConfirmOrderDialog`**

Open `src/components/staff/confirm-order-dialog.tsx`. Update Props:

```ts
interface Props {
  pendingItems: OrderItem[]
  pendingTotal: number
  disabled: boolean
  onConfirm: () => void
  /**
   * When true, both trigger button (ĐẶT MÓN) and inner XÁC NHẬN button are
   * disabled to prevent duplicate submits during a pending network request.
   */
  submitting?: boolean
}
```

Destructure `submitting` in the component. Update the trigger button:

```tsx
<Button
  disabled={disabled || submitting}
  className="mb-2 w-full bg-transparent border border-pos-gold/20 text-sm font-semibold text-pos-gold hover:bg-pos-gold/10"
>
  {submitting ? 'ĐANG GỬI…' : 'ĐẶT MÓN'}
</Button>
```

Update the XÁC NHẬN button inside the dialog footer:

```tsx
<DialogClose asChild>
  <Button
    onClick={onConfirm}
    disabled={submitting}
    className="bg-pos-gold text-black hover:bg-pos-gold/80"
  >
    {submitting ? 'ĐANG GỬI…' : 'XÁC NHẬN'}
  </Button>
</DialogClose>
```

Note: the `DialogClose` wrapper auto-closes the dialog on click. With `submitting`, the disable should also prevent the close. The internal Button's `disabled` prevents the onClick from firing — but DialogClose may still close. Better to remove `DialogClose` wrapper while submitting OR conditionally render:

Simpler approach: remove the `DialogClose` wrapping entirely; close the dialog programmatically in `onConfirm` (controlled state). But this adds complexity. For minimum diff, keep `DialogClose` and trust that user can't multi-tap a disabled button in the same render cycle:

```tsx
<DialogClose asChild>
  <Button
    onClick={onConfirm}
    disabled={submitting}
    className="bg-pos-gold text-black hover:bg-pos-gold/80"
  >
    {submitting ? 'ĐANG GỬI…' : 'XÁC NHẬN'}
  </Button>
</DialogClose>
```

Note: Once `onConfirm` is called, the parent sets submitting=true → next render disables. If user is already in pointer-down state, the click already fired. Acceptable.

- [ ] **Step 2: Wire `submitting` from `table-order.tsx`**

Open `src/app/staff/table-order.tsx`. Find the mutation declarations:

```ts
  const { mutateAsync: createOrderAsync } = useCreateOrder()
  const { mutateAsync: addOrderItemAsync } = useAddNewOrderItem()
```

Expand to also pick `isPending`:

```ts
  const { mutateAsync: createOrderAsync, isPending: isCreatingOrder } = useCreateOrder()
  const { mutateAsync: addOrderItemAsync, isPending: isAddingOrderItem } = useAddNewOrderItem()
```

Compute combined flag near the other derived values:

```ts
  const isSubmittingOrder = isCreatingOrder || isAddingOrderItem
```

Pass to `<OrderSummary>`:

```tsx
<OrderSummary
  pendingItems={session.pendingItems}
  submittedOrders={session.submittedOrders}
  onUpdateItem={...}
  onRemoveItem={...}
  onClearAll={...}
  onSubmitOrder={handleSubmitOrder}
  onPay={handlePay}
  onDraftReceipt={...}
  onConfirmChanges={handleSubmittedChanges}
  onCancelOrder={handleCancelOrder}
  isSubmittingOrder={isSubmittingOrder}
/>
```

- [ ] **Step 3: Forward `isSubmittingOrder` through `OrderSummary`**

Open `src/components/staff/order-summary.tsx`. Add `isSubmittingOrder?: boolean` to its Props. Destructure it. Pass to `<ConfirmOrderDialog ... submitting={isSubmittingOrder} />`.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc -b 2>&1 | head -10`
Expected: clean.

- [ ] **Step 5: Run vitest**

Run: `npx vitest run 2>&1 | tail -5`
Expected: existing tests still pass (the new prop is optional, default undefined = falsy).

- [ ] **Step 6: Manual smoke**

Throttle mạng (DevTools Network Throttling = "Slow 3G") → bấm "ĐẶT MÓN" → "XÁC NHẬN" → expected: cả 2 nút disabled với text "ĐANG GỬI…", không thể bấm lại trong vài giây cho tới khi response về.

---

### Task 5: `SubmittedOrdersDialog` auto-close on stale data

**Files:**
- Modify: `src/components/staff/submitted-orders-dialog.tsx`

Khi dialog đang mở mà server-side data thay đổi (reconciler refresh ghi đè submittedOrders), draft state nội bộ trở nên stale → confirm sẽ 404. Fix: snapshot orderItemSlug set lúc mở; nếu sau đó set thay đổi → tự đóng dialog + toast.

- [ ] **Step 1: Snapshot + stale detection**

Open `src/components/staff/submitted-orders-dialog.tsx`. Inside the component, after `const [open, setOpen] = useState(false)`, add:

```ts
  const openSnapshotKeyRef = useRef<string | null>(null)

  // Build a stable identifier for the current submittedOrders structure
  // (sorted orderItemSlugs joined). When this changes while open, the dialog
  // is showing outdated data — auto-close to force a fresh open.
  const currentKey = submittedOrders
    .flatMap((o) => o.items.map((it) => it.orderItemSlug ?? `${it.menuItemId}:${it.note}`))
    .sort()
    .join('|')

  useEffect(() => {
    if (open) {
      if (openSnapshotKeyRef.current === null) {
        openSnapshotKeyRef.current = currentKey
      } else if (openSnapshotKeyRef.current !== currentKey) {
        // Submitted order list changed under the user — close to force re-open.
        setOpen(false)
        openSnapshotKeyRef.current = null
        showErrorToastMessage('Dữ liệu đơn đã thay đổi, vui lòng mở lại để xem')
      }
    } else {
      openSnapshotKeyRef.current = null
    }
  }, [open, currentKey])
```

You'll need imports: `useEffect, useRef` from React, `showErrorToastMessage` from `@/utils` (mirror what `table-order.tsx` uses).

- [ ] **Step 2: Reset draft state when dialog closes**

Find where `draft` and `draftNotes` state are declared. After your useEffect above, add another:

```ts
  useEffect(() => {
    if (!open) {
      setDraft({})
      setDraftNotes({})
    }
  }, [open])
```

(This may already exist somewhere — if so, skip. Check before adding.)

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc -b 2>&1 | head -10`
Run: `npx eslint src/components/staff/submitted-orders-dialog.tsx 2>&1 | head -10`
Expected: clean. If exhaustive-deps warns on `currentKey` or `submittedOrders`, double-check deps.

- [ ] **Step 4: Run existing dialog tests**

Run: `npx vitest run src/tests/components/staff/submitted-orders-dialog.test.tsx 2>&1 | tail -10`
Expected: all PASS (existing tests don't test the new behavior — that's manual).

- [ ] **Step 5: Manual smoke**

Scenarios:
1. Mở dialog → đổi quantity 1 item → click confirm → API call thành công → dialog đóng. ✓
2. Mở dialog → từ DevTools, gọi `useTableSessionsStore.getState().replaceSubmittedOrders('table-slug', [...new data...])` để giả lập server refresh → dialog tự đóng + toast hiển thị.

---

### Task 6: Prompt "Bỏ X món chưa đặt?" khi back ra với pending unsubmitted

**Files:**
- Modify: `src/app/staff/table-order.tsx`

Hiện `handleBack` chỉ `closeSession` khi cả `pendingItems` và `submittedOrders` đều rỗng. Pending items "treo" gây bàn ma trên sơ đồ.

- [ ] **Step 1: Add confirm dialog state + prompt**

In `src/app/staff/table-order.tsx`, near other `useState` declarations (e.g. `showDraft`), add:

```ts
  const [showDiscardPendingDialog, setShowDiscardPendingDialog] = useState(false)
```

Replace `handleBack`:

```ts
  const handleBack = () => {
    const hasPending = session.pendingItems.length > 0
    const hasSubmitted = session.submittedOrders.length > 0 || !!session.orderSlug
    if (!hasPending && !hasSubmitted) {
      closeSession(id)
      navigate('/staff')
      return
    }
    if (hasPending && !hasSubmitted) {
      // Pending items without any server-side state — prompt before discarding
      setShowDiscardPendingDialog(true)
      return
    }
    // Has server-side state — leave the session intact for next visit
    navigate('/staff')
  }

  const handleDiscardPendingConfirm = () => {
    setShowDiscardPendingDialog(false)
    closeSession(id)
    navigate('/staff')
  }
```

- [ ] **Step 2: Render the discard dialog**

Add a `<Dialog>` somewhere near the existing `ReceiptDialog`/`TransferTableDialog` JSX:

```tsx
      <Dialog open={showDiscardPendingDialog} onOpenChange={setShowDiscardPendingDialog}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Bỏ {session.pendingItems.length} món chưa đặt?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-pos-muted">
            Các món đang chọn chưa được gửi cho bếp. Quay lại sẽ xoá danh sách này.
          </p>
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setShowDiscardPendingDialog(false)}>
              Ở lại
            </Button>
            <Button
              onClick={handleDiscardPendingConfirm}
              className="bg-destructive text-white hover:bg-destructive/80"
            >
              Bỏ và quay lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

Required imports: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `@/components/ui` (may already be imported via other components — check).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc -b 2>&1 | head -10`
Run: `npx eslint src/app/staff/table-order.tsx 2>&1 | head -10`
Expected: clean.

- [ ] **Step 4: Manual smoke**

1. Vào bàn trống → back → expected: navigate /staff, session đóng. ✓
2. Vào bàn, thêm 2 món pending, KHÔNG submit → back → expected: dialog "Bỏ 2 món chưa đặt?". 
   - Bấm "Ở lại" → ở nguyên trang. ✓
   - Bấm "Bỏ và quay lại" → navigate /staff, session đóng. ✓
3. Vào bàn, thêm pending, submit (có orderSlug) → back → expected: navigate /staff thẳng (không prompt vì có server state).

---

### Task 7: Polling cho kiosk

**Files:**
- Modify: `src/hooks/use-order.ts`

- [ ] **Step 1: Add `refetchInterval` to `useGetActiveOrderByTable`**

Open `src/hooks/use-order.ts`. Find `useGetActiveOrderByTable`. Add `refetchInterval: 30_000`:

```ts
export const useGetActiveOrderByTable = (tableSlug: string) => {
  return useQuery({
    queryKey: [QUERYKEY.activeOrderByTable, tableSlug],
    queryFn: () => getActiveOrderByTable(tableSlug),
    enabled: !!tableSlug,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    select: (data) => data.result,
  })
}
```

- [ ] **Step 2: Run vitest**

Run: `npx vitest run 2>&1 | tail -5`
Expected: all PASS (hooks aren't unit-tested at this layer; polling doesn't affect mocked queries in tests).

- [ ] **Step 3: Manual smoke**

Tablet trong dev mode: mở `/staff/table/<slug>` → DevTools Network tab → đợi ≥30s → quan sát request `GET /orders/table/<slug>/active` tự fire mỗi 30s mà không cần focus event.

Verify also: nếu staff thao tác mutation (ĐẶT MÓN), invalidate vẫn fire ngay không cần đợi interval.

---

### Task 8: Full regression

- [ ] **Step 1: Run all tests**

Run: `npx vitest run 2>&1 | tail -10`
Expected: all PASS. Net change:
- Task 1: +3 tests
- Task 2: +2 tests
- Task 3: -2 (replaced) + 3 = +1 test
- Total: +6 tests vs baseline of 496 → **502 expected**.

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 3: End-to-end manual smoke**

Combined scenarios:
1. **Soft transfer**: tạo đơn ở bàn 5, transfer sang bàn 8 với warning → badge xuất hiện → continue ordering ở bàn 8 → thanh toán → badge biến mất.
2. **Double-tap chống trùng**: throttle mạng, double-tap "ĐẶT MÓN" → chỉ 1 createOrder request fire.
3. **Stale dialog auto-close**: mở SubmittedOrdersDialog, trigger refresh từ DevTools → dialog đóng + toast.
4. **Empty session prompt**: thêm pending không submit → back → prompt "Bỏ X món chưa đặt?".
5. **Polling kiosk**: để tab mở 30s+ không thao tác → quan sát Network tab thấy auto refetch.
6. **Existing flows still work**: cross-device hydrate (sáng nay), reconciler refresh (chiều nay), reconciler clear (đơn bị xóa từ device khác), pendingItems giữ lại khi clear-with-pending.

---

## Self-Review

**Spec coverage:**
- #1 (Đổi bàn) ↔ Task 1 + Task 2 + Task 3 (full soft-transfer flow). ✓
- #6 (Double-tap) ↔ Task 4. ✓
- #5 (Stale dialog) ↔ Task 5. ✓
- #2 (Empty session rác) ↔ Task 6. ✓
- #4 (Kiosk no refresh) ↔ Task 7. ✓

**Type consistency:**
- `transferredFromTable?: string` consistent giữa `TableSession`, `transferSession` helper, store setter `clearTransferredMark`, reconciler check, JSX badge.
- `requiresConfirm?: boolean` consistent giữa `TransferTableDialog` Props, `table-order.tsx` caller, test usage.
- `submitting?: boolean` consistent giữa `ConfirmOrderDialog` Props, `OrderSummary` forward, `table-order.tsx` source.
- `isSubmittingOrder` derive từ 2 isPending — single source of truth.

**Out-of-scope guardrails:**
- Phase 2 (backend API for table move) raised as follow-up, not in scope.
- Chef cancellation workflow flagged as cross-team concern, not addressed.

**Placeholder scan:** none.

**Risk notes:**
- Task 3 Step 1: `DialogClose` không re-render khi `submitting` đổi state ngay sau click — first click vẫn submit, subsequent multi-clicks bị block. Acceptable per Task 4 Step 1 design note.
- Task 5: `currentKey` derive mỗi render — nếu `submittedOrders` array changes identity mà content same (vd Zustand re-write same data), key cũng same → no false-positive close. OK.
- Task 1 Step 5: `clearTransferredMark` dùng destructure-omit + cast to `TableSession` — safe vì `transferredFromTable` là optional.
- Task 7: 30s interval có thể tăng server load nếu nhiều tablet cùng mở. Tradeoff acceptable cho phase này. Monitor + adjust nếu cần.
