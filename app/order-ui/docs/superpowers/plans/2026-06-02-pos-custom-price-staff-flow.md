# Custom-Price Items in Staff POS ("Đặt Hộ") — Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "giá tuỳ chỉnh" (custom-price) support to the staff-assisted ordering (đặt hộ) POS flow, mirroring the behaviour that already exists in the client/system order flow.

**Architecture:** Extend `OrderItem` with an optional `isCustomPrice` flag; the existing `priceNum` field carries the entered price (no new field needed). `MenuPanel` detects `product.isCustomPrice` from the menu API and renders an inline price-input (number field + ✓ confirm button) instead of the "Thêm" button. `OrderSummary` renders a "Tuỳ chỉnh" badge and hides quantity +/− controls for custom items. `useTableSessions.addItem` prevents adding the same custom-price item twice (no quantity merging). The payment page already uses `priceNum × quantity` — no change needed there.

**Tech Stack:** TypeScript, React, Vitest + React Testing Library, Tailwind CSS (`pos-*` tokens), Zustand-style `useState` + localStorage hooks.

---

## File Map

| File | Change |
|---|---|
| `src/types/session.ts` | Add `isCustomPrice?: boolean` to `OrderItem` |
| `src/hooks/useTableSessions.ts` | Guard `addItem`: custom-price items are unique by `menuItemId` (no merge) |
| `src/components/staff/menu-panel.tsx` | Map `isCustomPrice` from API; inline price input for custom items |
| `src/components/staff/order-summary.tsx` | Badge + locked quantity for custom-price pending items |
| `src/hooks/__tests__/useTableSessions.test.tsx` | New guard tests |
| `src/tests/components/staff/menu-panel.test.tsx` | Extend mock + new custom-price tests |
| `src/tests/components/staff/order-summary.test.tsx` | New custom-price display tests |

No changes to `lib/staff-orders.ts`, `app/staff/payment.tsx`, or `app/staff/table-order.tsx` — they already work correctly with `priceNum`.

---

### Task 1: Extend `OrderItem` with `isCustomPrice`

**Files:**
- Modify: `src/types/session.ts`

- [ ] **Step 1: Add the field**

```ts
// src/types/session.ts
import type { InvoiceRequest } from './invoice'

export interface OrderItem {
  menuItemId: string
  name: string
  priceNum: number
  price: string
  quantity: number
  note: string
  isCustomPrice?: boolean
}

export interface SubmittedOrder {
  id: string
  items: OrderItem[]
  submittedAt: string
}

export type TableSessionStatus = 'empty' | 'serving' | 'waiting_payment' | 'done'

export interface TableSession {
  tableId: string
  tableName: string
  status: TableSessionStatus
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  openedAt: string
  invoiceRequest?: InvoiceRequest
}
```

- [ ] **Step 2: Verify the build compiles with no type errors**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/types/session.ts
git commit -m "feat(pos): add isCustomPrice flag to OrderItem type"
```

---

### Task 2: Guard `addItem` against duplicate custom-price entries

**Files:**
- Modify: `src/hooks/useTableSessions.ts:88-100`
- Test: `src/hooks/__tests__/useTableSessions.test.tsx`

The current `addItem` merges items by `menuItemId` (increments `quantity`). For custom-price items the price was negotiated per visit, so adding the same product twice should be a no-op (quantity stays at 1).

- [ ] **Step 1: Write failing tests**

Add at the end of the `useTableSessions` describe block in `src/hooks/__tests__/useTableSessions.test.tsx`:

```ts
describe('addItem — custom-price guard', () => {
  it('adding a custom-price item twice does not increment quantity', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 1'))
    const item: OrderItem = {
      menuItemId: 'cp-1',
      name: 'Món đặc biệt',
      priceNum: 50_000,
      price: '50.000đ',
      quantity: 1,
      note: '',
      isCustomPrice: true,
    }
    act(() => result.current.addItem('t1', item))
    act(() => result.current.addItem('t1', item))
    expect(result.current.sessions['t1'].pendingItems).toHaveLength(1)
    expect(result.current.sessions['t1'].pendingItems[0].quantity).toBe(1)
  })

  it('regular item alongside custom-price item is added normally', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 1'))
    const customItem: OrderItem = {
      menuItemId: 'cp-1', name: 'Đặc biệt', priceNum: 50_000, price: '50.000đ',
      quantity: 1, note: '', isCustomPrice: true,
    }
    const regularItem: OrderItem = {
      menuItemId: 'reg-1', name: 'Cà phê', priceNum: 25_000, price: '25.000đ',
      quantity: 1, note: '', isCustomPrice: false,
    }
    act(() => result.current.addItem('t1', customItem))
    act(() => result.current.addItem('t1', regularItem))
    expect(result.current.sessions['t1'].pendingItems).toHaveLength(2)
  })

  it('regular item still merges by quantity when added twice', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 1'))
    const reg: OrderItem = {
      menuItemId: 'reg-1', name: 'Cà phê', priceNum: 25_000, price: '25.000đ',
      quantity: 1, note: '', isCustomPrice: false,
    }
    act(() => result.current.addItem('t1', reg))
    act(() => result.current.addItem('t1', reg))
    expect(result.current.sessions['t1'].pendingItems[0].quantity).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests — expect 3 failures**

```bash
npx vitest run src/hooks/__tests__/useTableSessions.test.tsx 2>&1 | tail -20
```

Expected: 3 failures mentioning quantity or length mismatch.

- [ ] **Step 3: Implement the guard in `addItem`**

Replace the `addItem` callback in `src/hooks/useTableSessions.ts` (lines 88-100):

```ts
const addItem = useCallback((tableId: string, item: OrderItem) => {
  mutate((prev) => {
    const session = prev[tableId]
    if (!session) return prev
    const existing = session.pendingItems.find((p) => p.menuItemId === item.menuItemId)
    // Custom-price items are unique: same menuItemId already present → no-op
    if (existing && item.isCustomPrice) return prev
    const pendingItems = existing
      ? session.pendingItems.map((p) =>
          p.menuItemId === item.menuItemId ? { ...p, quantity: p.quantity + item.quantity } : p,
        )
      : [...session.pendingItems, item]
    return { ...prev, [tableId]: { ...session, pendingItems } }
  })
}, [mutate])
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/hooks/__tests__/useTableSessions.test.tsx 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTableSessions.ts src/hooks/__tests__/useTableSessions.test.tsx
git commit -m "feat(pos): prevent duplicate custom-price items in addItem"
```

---

### Task 3: Extend `MenuPanel` — detect `isCustomPrice`, inline price input

**Files:**
- Modify: `src/components/staff/menu-panel.tsx`
- Test: `src/tests/components/staff/menu-panel.test.tsx`

**UX:**
- Custom-price item, not yet in pending → price input `[   Giá...   ] [✓]`
- Custom-price item, already in pending → show entered price + `[×]` remove button
- Regular item → existing "Thêm" / stepper behaviour unchanged

- [ ] **Step 1: Add custom-price mock item + write failing tests**

In `src/tests/components/staff/menu-panel.test.tsx`, add the third item to `mockMenuItems` (after line 62) and add a new describe block:

```ts
// Add this object to the mockMenuItems array after the second item:
{
  slug: 'menu-003',
  createdAt: '2024-01-01',
  currentStock: 5,
  defaultStock: 5,
  isLocked: false,
  promotion: null,
  product: {
    name: 'Bánh đặc biệt',
    slug: 'banh-dac-biet',
    image: '',
    description: '',
    isActive: true,
    isLimit: false,
    isTopSell: false,
    isNew: false,
    isCombo: false,
    isGift: false,
    images: [],
    rating: 0,
    saleQuantityHistory: 0,
    productChefArea: '',
    createdAt: '2024-01-01',
    isCustomPrice: true,
    catalog: { slug: 'cat-coffee', name: 'Cà phê', description: '', createdAt: '2024-01-01' },
    variants: [{ price: 0, slug: 'v3', costPrice: 0, product: {} as never, size: { name: 'M', description: '', slug: 's1' } }],
  },
},
```

Then add this describe block at the end of the file:

```ts
describe('MenuPanel — custom-price items', () => {
  it('shows "Tuỳ chỉnh" label and price input instead of Thêm button', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    // Bánh đặc biệt is in the Cà phê category which is active by default
    expect(screen.getByLabelText('Nhập giá Bánh đặc biệt')).toBeInTheDocument()
    expect(screen.getByText('Tuỳ chỉnh')).toBeInTheDocument()
    // confirm button starts disabled
    expect(screen.getByLabelText('Xác nhận giá Bánh đặc biệt')).toBeDisabled()
  })

  it('confirm button enables once a positive price is entered', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    fireEvent.change(screen.getByLabelText('Nhập giá Bánh đặc biệt'), { target: { value: '80000' } })
    expect(screen.getByLabelText('Xác nhận giá Bánh đặc biệt')).not.toBeDisabled()
  })

  it('confirming a price calls onAdd with isCustomPrice:true and the entered priceNum', () => {
    const onAdd = vi.fn()
    render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={() => {}} />)
    fireEvent.change(screen.getByLabelText('Nhập giá Bánh đặc biệt'), { target: { value: '80000' } })
    fireEvent.click(screen.getByLabelText('Xác nhận giá Bánh đặc biệt'))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: 'menu-003',
        name: 'Bánh đặc biệt',
        priceNum: 80_000,
        isCustomPrice: true,
      }),
    )
  })

  it('already-added custom-price item shows remove button, not price input', () => {
    const pending: OrderItem[] = [
      {
        menuItemId: 'menu-003',
        name: 'Bánh đặc biệt',
        priceNum: 80_000,
        price: '80.000đ',
        quantity: 1,
        note: '',
        isCustomPrice: true,
      },
    ]
    const onDecrement = vi.fn()
    render(<MenuPanel pendingItems={pending} onAdd={() => {}} onDecrement={onDecrement} />)
    expect(screen.queryByLabelText('Nhập giá Bánh đặc biệt')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Xóa Bánh đặc biệt')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Xóa Bánh đặc biệt'))
    expect(onDecrement).toHaveBeenCalledWith('menu-003')
  })
})
```

- [ ] **Step 2: Run tests — expect 4 failures**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx 2>&1 | tail -20
```

- [ ] **Step 3: Implement `MenuPanel` changes**

In `src/components/staff/menu-panel.tsx`:

**3a. Add `customPriceInputs` state** (after the `searchQuery` state on line 40):

```ts
const [customPriceInputs, setCustomPriceInputs] = useState<Record<string, string>>({})
```

**3b. Extend the `menuItems` useMemo** — add `isCustomPrice` mapping (replace lines 42-57):

```ts
const menuItems = useMemo(
  () =>
    (menuData?.result?.menuItems ?? []).map((item) => {
      const isCustomPrice = !!item.product.isCustomPrice
      const priceNum = isCustomPrice ? 0 : (item.product.variants[0]?.price ?? 0)
      return {
        id: item.slug,
        categoryId: item.product.catalog.slug,
        name: item.product.name,
        description: item.product.description,
        priceNum,
        price: isCustomPrice ? '' : formatVnd(priceNum),
        image: item.product.image,
        isCustomPrice,
      }
    }),
  [menuData],
)
```

**3c. Replace the bottom row of the item card** — replace the `<div className="flex items-center justify-between">` section (current lines 187-236) with the following:

```tsx
<div className="flex items-center justify-between">
  {m.isCustomPrice ? (
    <span className="text-xs font-semibold text-orange-400">Tuỳ chỉnh</span>
  ) : (
    <span className="text-xs font-bold text-pos-gold">{m.price}</span>
  )}
  {m.isCustomPrice ? (
    count > 0 ? (
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-orange-400">
          {formatVnd(pendingItems.find((p) => p.menuItemId === m.id)?.priceNum ?? 0)}
        </span>
        <button
          type="button"
          aria-label={`Xóa ${m.name}`}
          onClick={() => onDecrement(m.id)}
          className="flex h-6 w-6 items-center justify-center rounded bg-pos-border text-sm hover:bg-red-900/30"
        >
          ×
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          value={customPriceInputs[m.id] ?? ''}
          onChange={(e) =>
            setCustomPriceInputs((prev) => ({ ...prev, [m.id]: e.target.value }))
          }
          placeholder="Giá..."
          aria-label={`Nhập giá ${m.name}`}
          className="h-6 w-16 rounded border border-pos-border bg-pos-card px-1.5 text-xs text-pos-text focus:outline-none"
        />
        <button
          type="button"
          disabled={!(customPriceInputs[m.id] && +customPriceInputs[m.id] > 0)}
          aria-label={`Xác nhận giá ${m.name}`}
          onClick={() => {
            const p = +(customPriceInputs[m.id] ?? 0)
            if (p <= 0) return
            onAdd({ menuItemId: m.id, name: m.name, priceNum: p, price: formatVnd(p), isCustomPrice: true })
            setCustomPriceInputs((prev) => { const n = { ...prev }; delete n[m.id]; return n })
          }}
          className="flex h-6 w-6 items-center justify-center rounded bg-pos-gold text-black text-sm disabled:opacity-40"
        >
          ✓
        </button>
      </div>
    )
  ) : count > 0 ? (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Giảm ${m.name}`}
        onClick={() => onDecrement(m.id)}
        className="flex h-6 w-6 items-center justify-center rounded bg-pos-border text-sm hover:bg-pos-hover"
      >
        −
      </button>
      <span
        data-testid={`badge-${m.id}`}
        className="w-5 text-center text-xs font-semibold"
      >
        {count}
      </span>
      <button
        type="button"
        aria-label={`Tăng ${m.name}`}
        onClick={() =>
          onAdd({ menuItemId: m.id, name: m.name, priceNum: m.priceNum, price: m.price })
        }
        className="flex h-6 w-6 items-center justify-center rounded bg-pos-border text-sm hover:bg-pos-hover"
      >
        +
      </button>
    </div>
  ) : (
    <Button
      size="sm"
      onClick={() =>
        onAdd({ menuItemId: m.id, name: m.name, priceNum: m.priceNum, price: m.price })
      }
      className="bg-pos-gold text-black hover:bg-pos-gold/80"
    >
      Thêm
    </Button>
  )}
</div>
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx 2>&1 | tail -10
```

Expected: all 11 tests pass (7 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/menu-panel.tsx src/tests/components/staff/menu-panel.test.tsx
git commit -m "feat(pos): inline custom-price input in MenuPanel for isCustomPrice items"
```

---

### Task 4: Update `OrderSummary` — badge and locked quantity for custom-price items

**Files:**
- Modify: `src/components/staff/order-summary.tsx`
- Test: `src/tests/components/staff/order-summary.test.tsx`

Custom-price items show an orange "Tuỳ chỉnh" badge and no +/− stepper (quantity is locked at 1 since `addItem` prevents duplicates and you'd remove + re-add with a new price instead).

- [ ] **Step 1: Write failing tests**

Add at the end of `src/tests/components/staff/order-summary.test.tsx`:

```ts
describe('OrderSummary — custom-price items', () => {
  const customPending: OrderItem[] = [
    {
      menuItemId: 'cp1',
      name: 'Món đặc biệt',
      priceNum: 80_000,
      price: '80.000đ',
      quantity: 1,
      note: '',
      isCustomPrice: true,
    },
  ]

  it('shows Tuỳ chỉnh badge for custom-price pending items', () => {
    render(<OrderSummary {...defaultProps({ pendingItems: customPending })} />)
    expect(screen.getByText('Tuỳ chỉnh')).toBeInTheDocument()
  })

  it('does not show +/- quantity buttons for custom-price pending items', () => {
    render(<OrderSummary {...defaultProps({ pendingItems: customPending })} />)
    expect(screen.queryByLabelText('Tăng Món đặc biệt')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Giảm Món đặc biệt')).not.toBeInTheDocument()
  })

  it('trash button is still present and calls onRemoveItem', () => {
    const onRemove = vi.fn()
    render(<OrderSummary {...defaultProps({ pendingItems: customPending, onRemoveItem: onRemove })} />)
    fireEvent.click(screen.getByLabelText('Xóa Món đặc biệt'))
    expect(onRemove).toHaveBeenCalledWith('cp1')
  })

  it('total is computed from priceNum for custom-price items', () => {
    render(<OrderSummary {...defaultProps({ pendingItems: customPending, submittedOrders: [] })} />)
    expect(screen.getByTestId('pending-total')).toHaveTextContent('80.000đ')
  })
})
```

- [ ] **Step 2: Run tests — expect 4 failures**

```bash
npx vitest run src/tests/components/staff/order-summary.test.tsx 2>&1 | tail -20
```

- [ ] **Step 3: Implement `OrderSummary` changes**

In `src/components/staff/order-summary.tsx`, replace the pending item card body (lines 69-127) with:

```tsx
<motion.li
  key={p.menuItemId}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, x: -100 }}
  className="mx-3 mb-2 rounded-lg border border-pos-border bg-pos-card p-3"
>
  {/* Row 1: name + custom badge + price */}
  <div className="flex items-center justify-between gap-2">
    <span className="flex-1 truncate text-sm font-semibold leading-tight">{p.name}</span>
    {p.isCustomPrice && (
      <span className="shrink-0 rounded bg-orange-500/20 px-1 py-0.5 text-[10px] font-semibold text-orange-400">
        Tuỳ chỉnh
      </span>
    )}
    <span className="shrink-0 text-xs font-semibold text-pos-gold">
      {formatVnd(p.priceNum * p.quantity)}
    </span>
  </div>

  {/* Row 2: quantity controls (hidden for custom-price) + trash */}
  <div className="mt-2 flex items-center justify-between">
    {!p.isCustomPrice ? (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          aria-label={`Giảm ${p.name}`}
          onClick={() => {
            if (p.quantity <= 1) onRemoveItem(p.menuItemId)
            else onUpdateItem(p.menuItemId, { quantity: p.quantity - 1 })
          }}
          className="p-1 rounded-full border border-muted-foreground/30 h-fit w-fit hover:bg-gray-100"
        >
          <Minus size={12} />
        </Button>
        <span className="w-5 text-center text-sm">{p.quantity}</span>
        <Button
          variant="ghost"
          aria-label={`Tăng ${p.name}`}
          onClick={() => onUpdateItem(p.menuItemId, { quantity: p.quantity + 1 })}
          className="p-1 rounded-full border border-muted-foreground/30 h-fit w-fit hover:bg-gray-100"
        >
          <Plus size={12} />
        </Button>
      </div>
    ) : (
      <div />
    )}
    <Button
      variant="ghost"
      aria-label={`Xóa ${p.name}`}
      onClick={() => onRemoveItem(p.menuItemId)}
      className="flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-red-900/30 hover:text-red-400"
    >
      <Trash2 size={14} />
    </Button>
  </div>

  {/* Row 3: note input */}
  <div className="mt-2 flex items-center gap-2">
    <NotepadText size={14} className="shrink-0 text-pos-faint" />
    <input
      type="text"
      value={p.note}
      placeholder="Thêm ghi chú..."
      onChange={(e) => onUpdateItem(p.menuItemId, { note: e.target.value })}
      className="h-7 flex-1 rounded border border-pos-border bg-pos-input px-2.5 text-xs placeholder:text-pos-faint"
    />
  </div>
</motion.li>
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx vitest run src/tests/components/staff/order-summary.test.tsx 2>&1 | tail -10
```

Expected: all tests pass (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/order-summary.tsx src/tests/components/staff/order-summary.test.tsx
git commit -m "feat(pos): show badge and lock quantity for custom-price items in OrderSummary"
```

---

### Task 5: Full suite green check

- [ ] **Step 1: Run all tests**

```bash
npm run test 2>&1 | tail -20
```

Expected: all test files pass, 0 failures.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Final commit (if any leftover changes)**

If clean, done. Otherwise:

```bash
git add -p
git commit -m "fix(pos): clean up any leftover type errors from custom-price migration"
```
