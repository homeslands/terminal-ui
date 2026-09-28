# Staff POS — Bug Fixes & UX Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical bugs and add 5 UX improvements to the staff POS ordering flow identified in a full UX audit.

**Architecture:** All state lives in `useTableSessions` (localStorage-backed hook). Components are pure UI — they receive handlers as props. No API calls exist yet; this plan stays in that model. Tests use Vitest + Testing Library.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, @testing-library/react, framer-motion, shadcn/ui Button

**Out of scope:** API integration, split bill, variants/modifiers, multi-device sync.

---

## File Map

| File | Change |
|------|--------|
| `src/components/staff/order-summary.tsx` | Remove animation stagger, remove ConfirmPaymentDialog |
| `src/lib/staff-orders.ts` | Key merge by `menuItemId::note`, add `note` to MergedItem |
| `src/tests/lib/staff-orders.test.ts` | Update tests for note-aware grouping |
| `src/components/staff/receipt-dialog.tsx` | Show note per item row |
| `src/app/staff/payment.tsx` | Fix "Huỷ" → closeSession + confirm, show note in item list |
| `src/hooks/useTableSessions.ts` | Add `cancelSession` action |
| `src/components/staff/confirm-payment-dialog.tsx` | Delete (replaced by direct button) |
| `src/components/staff/menu-panel.tsx` | Search input, inline qty stepper, loading/error states |
| `src/tests/components/staff/menu-panel.test.tsx` | Update + add tests |
| `src/components/staff/payment-panel.tsx` | "Còn thiếu" indicator |
| `src/tests/components/staff/payment-panel.test.tsx` | Add deficit indicator test |
| `src/tests/components/staff/order-summary.test.tsx` | Update THANH TOÁN test |

---

## Task 1: Remove animation stagger delay in OrderSummary

**Files:**
- Modify: `src/components/staff/order-summary.tsx:67`

- [ ] **Step 1: Remove delay from motion.li**

In `src/components/staff/order-summary.tsx`, find the `motion.li` and remove `transition={{ delay: index * 0.1 }}`:

```tsx
<motion.li
  key={p.menuItemId}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, x: -100 }}
  className="mx-3 mb-2 rounded-lg border border-[#232323] bg-[#1a1a1a] p-3"
>
```

Also remove `index` from the `.map()` destructure:
```tsx
{pendingItems.map((p) => (
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/tests/components/staff/order-summary.test.tsx
```

Expected: all 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/staff/order-summary.tsx
git commit -m "fix: remove animation stagger delay in order summary list"
```

---

## Task 2: Fix mergeOrderItems — group by menuItemId + note

Items ordered with different notes (e.g., "ít đường" vs "không đường") must stay as separate rows. Currently they get merged and the note is lost.

**Files:**
- Modify: `src/lib/staff-orders.ts`
- Modify: `src/tests/lib/staff-orders.test.ts`
- Modify: `src/components/staff/receipt-dialog.tsx`
- Modify: `src/app/staff/payment.tsx`

- [ ] **Step 1: Write the failing test**

In `src/tests/lib/staff-orders.test.ts`, add after the existing tests:

```ts
it('keeps items with the same menuItemId but different notes as separate rows', () => {
  const orders: SubmittedOrder[] = [
    order('o1', [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: 'ít đường' },
    ]),
    order('o2', [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: 'không đường' },
    ]),
  ]
  const merged = mergeOrderItems(orders)
  expect(merged).toHaveLength(2)
  expect(merged[0]).toMatchObject({ menuItemId: 'm1', quantity: 1, note: 'ít đường' })
  expect(merged[1]).toMatchObject({ menuItemId: 'm1', quantity: 2, note: 'không đường' })
})

it('merges items with the same menuItemId AND same note', () => {
  const orders: SubmittedOrder[] = [
    order('o1', [{ menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: 'ít đường' }]),
    order('o2', [{ menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 3, note: 'ít đường' }]),
  ]
  const merged = mergeOrderItems(orders)
  expect(merged).toHaveLength(1)
  expect(merged[0]).toMatchObject({ quantity: 4, note: 'ít đường' })
})
```

Also update the existing `'sums quantities for items with the same menuItemId across orders'` test — different notes should now yield 2 rows:

```ts
it('sums quantities for items with the same menuItemId AND same note across orders', () => {
  const orders: SubmittedOrder[] = [
    order('o1', [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
    ]),
    order('o2', [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 3, note: '' },
      { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 2, note: '' },
    ]),
  ]
  const merged = mergeOrderItems(orders)
  expect(merged).toHaveLength(2)
  expect(merged.find((m) => m.menuItemId === 'm1')?.quantity).toBe(4)
  expect(merged.find((m) => m.menuItemId === 'm2')?.quantity).toBe(2)
})
```

Also update `'drops the note field in the merged result'` — note is now preserved:

```ts
it('preserves the note field in the merged result', () => {
  const orders: SubmittedOrder[] = [
    order('o1', [{ menuItemId: 'm1', name: 'X', priceNum: 1000, price: '1.000đ', quantity: 1, note: 'keep me' }]),
  ]
  expect(mergeOrderItems(orders)[0]).toMatchObject({ note: 'keep me' })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/lib/staff-orders.test.ts
```

Expected: FAIL on new tests.

- [ ] **Step 3: Update MergedItem and mergeOrderItems**

Replace `src/lib/staff-orders.ts` entirely:

```ts
import type { SubmittedOrder } from '@/types/session'

export interface MergedItem {
  menuItemId: string
  name: string
  priceNum: number
  price: string
  quantity: number
  note: string
}

export function mergeOrderItems(orders: SubmittedOrder[]): MergedItem[] {
  const map = new Map<string, MergedItem>()
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.menuItemId}::${item.note}`
      const existing = map.get(key)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        map.set(key, {
          menuItemId: item.menuItemId,
          name: item.name,
          priceNum: item.priceNum,
          price: item.price,
          quantity: item.quantity,
          note: item.note,
        })
      }
    }
  }
  return Array.from(map.values())
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/lib/staff-orders.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Update receipt-dialog.tsx to show note**

In `src/components/staff/receipt-dialog.tsx`, update the item row inside `<ul>`:

```tsx
{merged.map((m, i) => (
  <li key={`${m.menuItemId}-${i}`} className="py-1.5 text-sm">
    <div className="flex items-baseline gap-3">
      <span className="w-7 shrink-0 text-center text-xs font-semibold text-[#555]">
        {m.quantity}×
      </span>
      <span className="flex-1 text-[#f5f0e8]">{m.name}</span>
      <span className="shrink-0 tabular-nums font-semibold text-[#C9A84C]">
        {formatVnd(m.priceNum * m.quantity)}
      </span>
    </div>
    {m.note && (
      <p className="ml-10 mt-0.5 text-xs text-[#555] italic">{m.note}</p>
    )}
  </li>
))}
```

Note: key changed to `${m.menuItemId}-${i}` because same menuItemId can appear multiple times with different notes.

- [ ] **Step 6: Update payment.tsx item list to show note**

In `src/app/staff/payment.tsx`, update the item list in the left panel:

```tsx
{merged.map((m, i) => (
  <li key={`${m.menuItemId}-${i}`} className="py-1.5">
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-7 shrink-0 text-center text-xs font-semibold text-[#555]">
        {m.quantity}×
      </span>
      <span className="flex-1 text-[#f5f0e8]">{m.name}</span>
      <span className="shrink-0 tabular-nums font-semibold text-[#C9A84C]">
        {formatVnd(m.priceNum * m.quantity)}
      </span>
    </div>
    {m.note && (
      <p className="ml-10 mt-0.5 text-xs text-[#555] italic">{m.note}</p>
    )}
  </li>
))}
```

- [ ] **Step 7: Run all staff tests**

```bash
npx vitest run src/tests/components/staff/ src/tests/lib/staff-orders.test.ts
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/staff-orders.ts src/tests/lib/staff-orders.test.ts src/components/staff/receipt-dialog.tsx src/app/staff/payment.tsx
git commit -m "fix: merge order items by menuItemId+note to preserve distinct notes"
```

---

## Task 3: Fix payment "Huỷ" bug — session stuck in waiting_payment

Currently "Huỷ" in payment page just navigates to `/staff` without closing the session. The table stays `waiting_payment` forever.

**Files:**
- Modify: `src/hooks/useTableSessions.ts`
- Modify: `src/app/staff/payment.tsx`

- [ ] **Step 1: Add cancelSession to useTableSessions**

`cancelSession` is semantically identical to `closeSession` (both delete the session). Add it as a named alias so call sites are self-documenting:

In `src/hooks/useTableSessions.ts`, update the `UseTableSessions` interface:

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
}
```

Add `cancelSession` in the hook body (reuses the same `mutate` logic as `closeSession`):

```ts
const cancelSession = useCallback((tableId: string) => {
  mutate((prev) => {
    if (!prev[tableId]) return prev
    const next = { ...prev }
    delete next[tableId]
    return next
  })
}, [mutate])
```

Update the return object to include `cancelSession`.

- [ ] **Step 2: Wire confirm dialog + cancelSession in payment.tsx**

In `src/app/staff/payment.tsx`, add a `confirmCancel` state and replace the "Huỷ" button:

```tsx
const [confirmCancel, setConfirmCancel] = useState(false)
```

Update the destructure from `useTableSessions`:
```tsx
const { sessions, closeSession, cancelSession, setInvoiceRequest } = useTableSessions()
```

Replace the "Huỷ" button:

```tsx
<Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>
  Huỷ bàn
</Button>
```

Add the confirm dialog at the bottom of the JSX (before the closing `</div>`):

```tsx
{confirmCancel && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div className="w-72 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-5 text-[#f5f0e8]">
      <p className="mb-1 text-sm font-semibold">Huỷ bàn?</p>
      <p className="mb-4 text-xs text-[#888]">Toàn bộ đơn đã đặt sẽ bị xoá. Không thể hoàn tác.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setConfirmCancel(false)}>Quay lại</Button>
        <Button
          className="bg-red-700 text-white hover:bg-red-600"
          onClick={() => { cancelSession(id); navigate('/staff') }}
        >
          Xác nhận huỷ
        </Button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tests/components/staff/
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTableSessions.ts src/app/staff/payment.tsx
git commit -m "fix: cancelSession on payment Huỷ button — session no longer stuck in waiting_payment"
```

---

## Task 4: Remove ConfirmPaymentDialog (unnecessary confirm step)

The dialog "Chuyển sang màn hình thanh toán cho bàn này?" adds a click with no useful information. Replace it with a direct button.

**Files:**
- Modify: `src/components/staff/order-summary.tsx`
- Delete: `src/components/staff/confirm-payment-dialog.tsx`
- Modify: `src/tests/components/staff/order-summary.test.tsx`

- [ ] **Step 1: Check existing test still expects THANH TOÁN button**

In `src/tests/components/staff/order-summary.test.tsx`, the test:
```ts
it('THANH TOÁN and draft receipt disabled when no submitted orders', () => {
  expect(screen.getByRole('button', { name: /THANH TOÁN/ })).toBeDisabled()
})
```
This will still pass because the new button will be named "THANH TOÁN →".

- [ ] **Step 2: Replace ConfirmPaymentDialog with direct Button in order-summary.tsx**

In `src/components/staff/order-summary.tsx`:

Remove the import:
```tsx
// DELETE this line:
import { ConfirmPaymentDialog } from './confirm-payment-dialog'
```

Replace `<ConfirmPaymentDialog disabled={!hasSubmitted || canSubmit} onConfirm={onPay} />` with:

```tsx
<Button
  disabled={!hasSubmitted || canSubmit}
  onClick={onPay}
  className="w-full bg-[#C9A84C] text-black hover:bg-[#b8973e]"
>
  THANH TOÁN →
</Button>
```

The `<div className="grid grid-cols-1 gap-2">` wrapper can be removed since there's only one button now.

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/tests/components/staff/order-summary.test.tsx
```

Expected: all tests PASS. In particular:
- `'THANH TOÁN and draft receipt disabled when no submitted orders'` → PASS (button still exists, still disabled)

- [ ] **Step 4: Delete confirm-payment-dialog.tsx**

```bash
rm src/components/staff/confirm-payment-dialog.tsx
```

Check nothing else imports it:
```bash
grep -r "confirm-payment-dialog" src/ --include="*.tsx" --include="*.ts"
```
Expected: no output (file deleted, import removed).

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/order-summary.tsx
git rm src/components/staff/confirm-payment-dialog.tsx
git commit -m "refactor: remove ConfirmPaymentDialog — payment navigates directly on click"
```

---

## Task 5: Menu search

**Files:**
- Modify: `src/components/staff/menu-panel.tsx`
- Modify: `src/tests/components/staff/menu-panel.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/tests/components/staff/menu-panel.test.tsx`:

```tsx
it('search input filters items by name (case-insensitive)', () => {
  render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
  const searchInput = screen.getByPlaceholderText(/Tìm món/)
  fireEvent.change(searchInput, { target: { value: 'cà phê' } })
  expect(screen.getByText('Cà phê đen')).toBeInTheDocument()
  // Trà đào cam sả should not appear (different category, but search overrides category)
})

it('shows empty message when search matches nothing', () => {
  render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText(/Tìm món/), { target: { value: 'xyzxyz' } })
  expect(screen.getByText(/Không tìm thấy món/)).toBeInTheDocument()
})
```

Note: existing tests need `onDecrement` prop added (Task 6 adds it). For now add `onDecrement={() => {}}` to all existing `render(<MenuPanel ...>)` calls in the test file.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx
```

Expected: FAIL (no search input, no onDecrement prop yet).

- [ ] **Step 3: Add search to MenuPanel**

In `src/components/staff/menu-panel.tsx`:

Add `searchQuery` state and `onDecrement` prop (will be used in Task 6):

```tsx
interface Props {
  pendingItems: OrderItem[]
  onAdd: (item: Omit<OrderItem, 'quantity' | 'note'>) => void
  onDecrement: (menuItemId: string) => void
}
```

Add state:
```tsx
const [searchQuery, setSearchQuery] = useState('')
```

Update `items` memo to filter by search (search overrides category filter when non-empty):

```tsx
const items = useMemo(() => {
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase()
    return menuItems.filter((m) => m.name.toLowerCase().includes(q))
  }
  return menuItems.filter((m) => m.categoryId === effectiveCat)
}, [menuItems, effectiveCat, searchQuery])
```

Add search input above the menu grid. The search sits at the top of the right panel (above the grid), spanning the full width. Replace the opening `<div className="grid flex-1 ...">` with:

```tsx
<div className="flex min-h-0 flex-1 flex-col">
  {/* Search */}
  <div className="border-b border-[#2a2a2a] p-2">
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Tìm món..."
      className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1.5 text-sm placeholder:text-[#444] focus:outline-none"
    />
  </div>

  {/* Grid */}
  {items.length === 0 ? (
    <div className="flex flex-1 items-center justify-center text-sm text-[#444]">
      Không tìm thấy món nào
    </div>
  ) : (
    <div className="grid auto-rows-max grid-cols-3 gap-2 overflow-y-auto p-3 content-start">
      {items.map((m) => {
        // ... existing card JSX
      })}
    </div>
  )}
</div>
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx
```

Expected: search tests PASS (other tests may still fail due to `onDecrement` prop — fix in Task 6).

- [ ] **Step 5: Commit (partial — will be completed after Task 6)**

Skip commit here; commit together with Task 6.

---

## Task 6: Inline quantity stepper in MenuPanel for already-added items

When an item is already in `pendingItems`, show `[−][2][+]` directly on the card instead of the "Thêm" button.

**Files:**
- Modify: `src/components/staff/menu-panel.tsx` (continued from Task 5)
- Modify: `src/app/staff/table-order.tsx`
- Modify: `src/tests/components/staff/menu-panel.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `src/tests/components/staff/menu-panel.test.tsx`:

```tsx
it('shows inline stepper instead of Thêm button when item already in pending', () => {
  const pending: OrderItem[] = [
    { menuItemId: 'menu-001', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
  ]
  const onDecrement = vi.fn()
  render(<MenuPanel pendingItems={pending} onAdd={() => {}} onDecrement={onDecrement} />)
  // Thêm button should not appear for this item
  expect(screen.queryByRole('button', { name: 'Thêm' })).not.toBeInTheDocument()
  // Should show quantity
  expect(screen.getByText('2')).toBeInTheDocument()
  // Minus button calls onDecrement
  fireEvent.click(screen.getByLabelText('Giảm Cà phê đen'))
  expect(onDecrement).toHaveBeenCalledWith('menu-001')
})
```

Also update the existing `'calls onAdd...'` test to use `onDecrement`:
```tsx
it('calls onAdd with the menu item shape (no quantity, no note)', () => {
  const onAdd = vi.fn()
  render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={() => {}} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Thêm' })[0])
  // ... rest unchanged
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx
```

Expected: new stepper test FAIL.

- [ ] **Step 3: Replace add button with stepper in MenuPanel card**

In the card's button area, replace the single `<Button size="sm" ...>Thêm</Button>` with:

```tsx
{count > 0 ? (
  <div className="flex items-center gap-1">
    <button
      type="button"
      aria-label={`Giảm ${m.name}`}
      onClick={() => onDecrement(m.id)}
      className="flex h-6 w-6 items-center justify-center rounded bg-[#2a2a2a] text-sm hover:bg-[#333]"
    >
      −
    </button>
    <span className="w-5 text-center text-xs font-semibold">{count}</span>
    <button
      type="button"
      aria-label={`Tăng ${m.name}`}
      onClick={() =>
        onAdd({
          menuItemId: m.id,
          name: m.name,
          priceNum: m.priceNum,
          price: m.price,
        })
      }
      className="flex h-6 w-6 items-center justify-center rounded bg-[#2a2a2a] text-sm hover:bg-[#333]"
    >
      +
    </button>
  </div>
) : (
  <Button
    size="sm"
    onClick={() =>
      onAdd({
        menuItemId: m.id,
        name: m.name,
        priceNum: m.priceNum,
        price: m.price,
      })
    }
    className="bg-emerald-800 text-emerald-200 hover:bg-emerald-700"
  >
    Thêm
  </Button>
)}
```

Remove the corner badge (`count > 0 && <span className="absolute right-1.5...">`) since count is now shown inline.

- [ ] **Step 4: Add onDecrement handler in table-order.tsx**

In `src/app/staff/table-order.tsx`, add:

```tsx
const handleDecrement = (menuItemId: string) => {
  const item = session.pendingItems.find((i) => i.menuItemId === menuItemId)
  if (!item) return
  if (item.quantity <= 1) {
    removeItem(id, menuItemId)
    toast.error(`Đã xóa ${item.name}`)
  } else {
    updateItem(id, menuItemId, { quantity: item.quantity - 1 })
  }
}
```

Pass to `MenuPanel`:
```tsx
<MenuPanel pendingItems={session.pendingItems} onAdd={handleAdd} onDecrement={handleDecrement} />
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Commit Tasks 5 + 6 together**

```bash
git add src/components/staff/menu-panel.tsx src/app/staff/table-order.tsx src/tests/components/staff/menu-panel.test.tsx
git commit -m "feat: menu search and inline quantity stepper for already-added items"
```

---

## Task 7: MenuPanel loading and error states

**Files:**
- Modify: `src/components/staff/menu-panel.tsx`

- [ ] **Step 1: Check what useSpecificMenu returns**

`useSpecificMenu` is a TanStack Query hook. It returns `{ data, isLoading, isError }`.

- [ ] **Step 2: Add loading and error states**

In `src/components/staff/menu-panel.tsx`, destructure `isLoading` and `isError` from the hook:

```tsx
const { data: menuData, isLoading, isError } = useSpecificMenu(
  { date: today, branch: userInfo?.branch?.slug },
  !!userInfo?.slug,
)
```

Add early returns in the JSX before the main render. Place inside the right-panel area (`<div className="flex min-h-0 flex-1 flex-col">`), right before the search input:

```tsx
if (isLoading) {
  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[160px] shrink-0 border-r border-[#2a2a2a] bg-[#111]" />
      <div className="flex flex-1 items-center justify-center text-sm text-[#444]">
        Đang tải thực đơn...
      </div>
    </div>
  )
}

if (isError) {
  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[160px] shrink-0 border-r border-[#2a2a2a] bg-[#111]" />
      <div className="flex flex-1 items-center justify-center text-sm text-red-400">
        Không tải được thực đơn. Vui lòng thử lại.
      </div>
    </div>
  )
}
```

These return before the `categories` / `items` memo computation, so `menuData` is guaranteed non-null when the main render runs.

- [ ] **Step 3: Run all menu-panel tests**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx
```

Expected: all PASS (the mock returns data immediately so loading/error branches don't affect existing tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/staff/menu-panel.tsx
git commit -m "feat: add loading and error states to MenuPanel"
```

---

## Task 8: Payment panel "Còn thiếu" indicator

When `0 < amount < total`, show how much is still missing so staff can prompt the customer.

**Files:**
- Modify: `src/components/staff/payment-panel.tsx`
- Modify: `src/tests/components/staff/payment-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/tests/components/staff/payment-panel.test.tsx`:

```tsx
it('shows deficit amount when received > 0 but < total', () => {
  render(<PaymentPanel total={340_000} onConfirm={() => {}} />)
  fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '200000' } })
  expect(screen.getByTestId('deficit')).toHaveTextContent('140.000đ')
})

it('does not show deficit when amount is 0', () => {
  render(<PaymentPanel total={340_000} onConfirm={() => {}} />)
  expect(screen.queryByTestId('deficit')).not.toBeInTheDocument()
})

it('does not show deficit when amount >= total', () => {
  render(<PaymentPanel total={340_000} onConfirm={() => {}} />)
  fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '400000' } })
  expect(screen.queryByTestId('deficit')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/components/staff/payment-panel.test.tsx
```

Expected: FAIL on deficit tests.

- [ ] **Step 3: Add deficit indicator to PaymentPanel**

In `src/components/staff/payment-panel.tsx`, compute deficit:

```tsx
const deficit = total - amount
const showDeficit = amount > 0 && amount < total
```

Replace the "Tiền thừa" row with a conditional section showing either deficit or change:

```tsx
{showDeficit ? (
  <div className="flex items-baseline justify-between text-sm">
    <span className="text-red-400">Còn thiếu</span>
    <span data-testid="deficit" className="text-lg font-bold text-red-400">
      {formatVnd(deficit)}
    </span>
  </div>
) : (
  <div className="flex items-baseline justify-between text-sm">
    <span className="text-[#888]">Tiền thừa</span>
    <span data-testid="change" className="text-lg font-bold text-[#f5f0e8]">
      {formatVnd(Math.max(0, change))}
    </span>
  </div>
)}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tests/components/staff/payment-panel.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/payment-panel.tsx src/tests/components/staff/payment-panel.test.tsx
git commit -m "feat: show deficit amount in payment panel when received < total"
```

---

## Self-Review

**Spec coverage:**
- ✅ Animation stagger → Task 1
- ✅ mergeOrderItems note bug → Task 2
- ✅ Payment "Huỷ" stuck session → Task 3
- ✅ ConfirmPaymentDialog removal → Task 4
- ✅ Menu search → Task 5
- ✅ Inline stepper → Task 6
- ✅ Loading/error states → Task 7
- ✅ Tiền thiếu indicator → Task 8

**Explicitly NOT in this plan** (too large / need backend):
- Void/cancel submitted item
- Variants / modifiers
- Split bill
- API integration
- Session expiry / multi-device sync

**Type consistency check:**
- `MergedItem.note: string` added in Task 2, used in Tasks 2 (receipt-dialog, payment) — consistent ✅
- `UseTableSessions.cancelSession` added in Task 3, consumed in payment.tsx — consistent ✅
- `MenuPanel.onDecrement` added in Task 5, wired in Task 6 — consistent ✅
- `data-testid="deficit"` in Task 8 matches test queries — consistent ✅
