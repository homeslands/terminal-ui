# POS Component Extraction Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract four repeated UI patterns from the staff ordering flow into dedicated, tested components to eliminate duplication and make each page easier to maintain.

**Architecture:** Four new components are created in `src/components/staff/`, each with its own test file. Then four page files are updated to use them. The component tasks (1–4) are independent of each other and can each be verified before touching any page. Page update tasks (5–8) depend on tasks 1–4 being complete.

**Tech Stack:** React, TypeScript, Tailwind CSS (pos-* tokens), React Router v6, Vitest, React Testing Library

---

## Duplication map — why each component is worth extracting

| Pattern | Appears in | Problem if left inline |
|---------|-----------|----------------------|
| Not-found error state | table-order, payment, receipt, invoice | Styling diverges across 4 files over time |
| Table name + status badge | table-order, payment | Color logic for status in 2 places |
| Page-level sub-header | table-order, payment, receipt, invoice | 4 copies of identical `border-b border-pos-border bg-pos-surface` shell |
| Cancel confirmation dialog | payment | 50-line JSX block inside an already-large page file |

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| **Create** | `src/components/staff/pos-not-found.tsx` | Error state with link back to `/staff` |
| **Create** | `src/components/staff/table-status-badge.tsx` | Table name + status colour chip |
| **Create** | `src/components/staff/pos-page-header.tsx` | Sub-header shell: back link + center slot + right slot |
| **Create** | `src/components/staff/confirm-cancel-dialog.tsx` | "Huỷ bàn?" confirmation overlay |
| **Create** | `src/tests/components/staff/pos-not-found.test.tsx` | Tests for PosNotFoundState |
| **Create** | `src/tests/components/staff/table-status-badge.test.tsx` | Tests for TableStatusBadge |
| **Create** | `src/tests/components/staff/pos-page-header.test.tsx` | Tests for PosPageHeader |
| **Create** | `src/tests/components/staff/confirm-cancel-dialog.test.tsx` | Tests for ConfirmCancelDialog |
| **Modify** | `src/app/staff/table-order.tsx` | Use PosNotFoundState, PosPageHeader, TableStatusBadge |
| **Modify** | `src/app/staff/payment.tsx` | Use PosNotFoundState, PosPageHeader, TableStatusBadge, ConfirmCancelDialog |
| **Modify** | `src/app/staff/receipt.tsx` | Use PosNotFoundState, PosPageHeader |
| **Modify** | `src/app/staff/invoice.tsx` | Use PosNotFoundState, PosPageHeader |

---

## Task 1: `PosNotFoundState`

The same centered error div + link to `/staff` appears in four page files. Extract it.

**Files:**
- Create: `src/components/staff/pos-not-found.tsx`
- Create: `src/tests/components/staff/pos-not-found.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/tests/components/staff/pos-not-found.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PosNotFoundState } from '@/components/staff/pos-not-found'

function renderIt(message: string) {
  render(
    <MemoryRouter>
      <PosNotFoundState message={message} />
    </MemoryRouter>,
  )
}

describe('PosNotFoundState', () => {
  it('renders the message', () => {
    renderIt('Không tìm thấy bàn.')
    expect(screen.getByText('Không tìm thấy bàn.')).toBeInTheDocument()
  })

  it('renders a link to /staff', () => {
    renderIt('Lỗi.')
    expect(screen.getByRole('link', { name: /sơ đồ/i })).toHaveAttribute('href', '/staff')
  })

  it('wrapper uses bg-pos-bg and text-pos-text', () => {
    const { container } = renderIt('Lỗi.')
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('bg-pos-bg')
    expect(wrapper).toHaveClass('text-pos-text')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/components/staff/pos-not-found.test.tsx
```

Expected: FAIL — `PosNotFoundState` not found

- [ ] **Step 3: Create `src/components/staff/pos-not-found.tsx`**

```tsx
import { Link } from 'react-router-dom'

interface Props {
  message: string
}

export function PosNotFoundState({ message }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-pos-bg text-pos-text">
      <p>
        {message}{' '}
        <Link to="/staff" className="text-pos-gold underline">
          ← Sơ đồ
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/components/staff/pos-not-found.test.tsx
```

Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/pos-not-found.tsx src/tests/components/staff/pos-not-found.test.tsx
git commit -m "feat(pos): extract PosNotFoundState component"
```

---

## Task 2: `TableStatusBadge`

The table-name + status colour chip is copied between `table-order.tsx` and `payment.tsx`. The colour-by-status logic belongs in one place.

**Files:**
- Create: `src/components/staff/table-status-badge.tsx`
- Create: `src/tests/components/staff/table-status-badge.test.tsx`

`TableSessionStatus` is exported from `src/types/session.ts` as `'empty' | 'serving' | 'waiting_payment' | 'done'`.

- [ ] **Step 1: Write failing test**

Create `src/tests/components/staff/table-status-badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableStatusBadge } from '@/components/staff/table-status-badge'

describe('TableStatusBadge', () => {
  it('renders table name', () => {
    render(<TableStatusBadge tableName="Bàn 01" status="serving" />)
    expect(screen.getByText('Bàn 01')).toBeInTheDocument()
  })

  it('shows ĐANG PHỤC VỤ with gold colour for serving status', () => {
    render(<TableStatusBadge tableName="Bàn 01" status="serving" />)
    const label = screen.getByText('ĐANG PHỤC VỤ')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass('text-pos-gold')
  })

  it('shows CHỜ THANH TOÁN with orange colour for waiting_payment status', () => {
    render(<TableStatusBadge tableName="Bàn 02" status="waiting_payment" />)
    const label = screen.getByText('CHỜ THANH TOÁN')
    expect(label).toBeInTheDocument()
    expect(label).toHaveClass('text-orange-400')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/components/staff/table-status-badge.test.tsx
```

Expected: FAIL — `TableStatusBadge` not found

- [ ] **Step 3: Create `src/components/staff/table-status-badge.tsx`**

```tsx
import type { TableSessionStatus } from '@/types/session'

interface Props {
  tableName: string
  status: TableSessionStatus
}

export function TableStatusBadge({ tableName, status }: Props) {
  const isWaiting = status === 'waiting_payment'

  return (
    <div className="flex overflow-hidden rounded text-xs font-semibold">
      <span className="bg-pos-border px-2.5 py-1 text-pos-text">{tableName}</span>
      <span
        className={`px-2.5 py-1 ${
          isWaiting
            ? 'bg-orange-500/20 text-orange-400'
            : 'bg-pos-gold/20 text-pos-gold'
        }`}
      >
        {isWaiting ? 'CHỜ THANH TOÁN' : 'ĐANG PHỤC VỤ'}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/components/staff/table-status-badge.test.tsx
```

Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/table-status-badge.tsx src/tests/components/staff/table-status-badge.test.tsx
git commit -m "feat(pos): extract TableStatusBadge component"
```

---

## Task 3: `PosPageHeader`

Four page files share the same `border-b border-pos-border bg-pos-surface` header shell. Content varies via three slots: back link (always present), center (badge or nothing), right (buttons or clock or nothing).

**Files:**
- Create: `src/components/staff/pos-page-header.tsx`
- Create: `src/tests/components/staff/pos-page-header.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/tests/components/staff/pos-page-header.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PosPageHeader } from '@/components/staff/pos-page-header'

function renderHeader(props: Partial<React.ComponentProps<typeof PosPageHeader>> = {}) {
  return render(
    <MemoryRouter>
      <PosPageHeader backTo="/staff" backLabel="← Sơ đồ bàn" {...props} />
    </MemoryRouter>,
  )
}

describe('PosPageHeader', () => {
  it('renders back link with correct href', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: '← Sơ đồ bàn' })).toHaveAttribute('href', '/staff')
  })

  it('back link has muted and hover-gold classes', () => {
    renderHeader()
    expect(screen.getByRole('link')).toHaveClass('text-pos-muted', 'hover:text-pos-gold')
  })

  it('renders center slot content', () => {
    renderHeader({ center: <span>Center content</span> })
    expect(screen.getByText('Center content')).toBeInTheDocument()
  })

  it('renders right slot content', () => {
    renderHeader({ right: <button>Action</button> })
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('adds print:hidden class when printHidden is true', () => {
    const { container } = renderHeader({ printHidden: true })
    expect(container.querySelector('header')).toHaveClass('print:hidden')
  })

  it('does not add print:hidden class by default', () => {
    const { container } = renderHeader()
    expect(container.querySelector('header')).not.toHaveClass('print:hidden')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/components/staff/pos-page-header.test.tsx
```

Expected: FAIL — `PosPageHeader` not found

- [ ] **Step 3: Create `src/components/staff/pos-page-header.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface Props {
  backTo: string
  backLabel: string
  center?: ReactNode
  right?: ReactNode
  printHidden?: boolean
}

export function PosPageHeader({ backTo, backLabel, center, right, printHidden }: Props) {
  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between border-b border-pos-border bg-pos-surface px-4 py-2.5',
        printHidden && 'print:hidden',
      )}
    >
      <Link to={backTo} className="text-sm text-pos-muted hover:text-pos-gold">
        {backLabel}
      </Link>
      <div>{center}</div>
      <div>{right}</div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/components/staff/pos-page-header.test.tsx
```

Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/pos-page-header.tsx src/tests/components/staff/pos-page-header.test.tsx
git commit -m "feat(pos): extract PosPageHeader component"
```

---

## Task 4: `ConfirmCancelDialog`

The cancel-table confirmation overlay is currently 50 lines of JSX inline inside `payment.tsx`. Extracting it makes `payment.tsx` easier to read and makes the dialog independently testable.

**Files:**
- Create: `src/components/staff/confirm-cancel-dialog.tsx`
- Create: `src/tests/components/staff/confirm-cancel-dialog.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/tests/components/staff/confirm-cancel-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmCancelDialog } from '@/components/staff/confirm-cancel-dialog'

describe('ConfirmCancelDialog', () => {
  it('renders nothing when open is false', () => {
    render(
      <ConfirmCancelDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.queryByText('Huỷ bàn?')).not.toBeInTheDocument()
  })

  it('renders dialog content when open is true', () => {
    render(
      <ConfirmCancelDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('Huỷ bàn?')).toBeInTheDocument()
    expect(screen.getByText(/toàn bộ đơn đã đặt sẽ bị xoá/i)).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmCancelDialog open={true} onConfirm={onConfirm} onCancel={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /xác nhận huỷ/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when back button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmCancelDialog open={true} onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /quay lại/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/components/staff/confirm-cancel-dialog.test.tsx
```

Expected: FAIL — `ConfirmCancelDialog` not found

- [ ] **Step 3: Create `src/components/staff/confirm-cancel-dialog.tsx`**

```tsx
import { Button } from '@/components/ui'

interface Props {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmCancelDialog({ open, onConfirm, onCancel }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-72 rounded-lg border border-pos-border bg-pos-card p-5 text-pos-text">
        <p className="mb-1 text-sm font-semibold">Huỷ bàn?</p>
        <p className="mb-4 text-xs text-pos-muted">
          Toàn bộ đơn đã đặt sẽ bị xoá. Không thể hoàn tác.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCancel}>
            Quay lại
          </Button>
          <Button
            className="bg-red-700 text-white hover:bg-red-600"
            onClick={onConfirm}
          >
            Xác nhận huỷ
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/components/staff/confirm-cancel-dialog.test.tsx
```

Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/confirm-cancel-dialog.tsx src/tests/components/staff/confirm-cancel-dialog.test.tsx
git commit -m "feat(pos): extract ConfirmCancelDialog component"
```

---

## Task 5: Update `table-order.tsx`

Swap in `PosNotFoundState`, `PosPageHeader`, `TableStatusBadge`. Behaviour is unchanged — this is pure refactor.

**Files:**
- Modify: `src/app/staff/table-order.tsx`

- [ ] **Step 1: Replace the file content**

Full updated `src/app/staff/table-order.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MenuPanel } from '@/components/staff/menu-panel'
import { OrderSummary } from '@/components/staff/order-summary'
import { ReceiptDialog } from '@/components/staff/receipt-dialog'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { TableStatusBadge } from '@/components/staff/table-status-badge'
import { useTableSessions } from '@/hooks/useTableSessions'
import type { OrderItem } from '@/types/session'

export default function StaffTableOrderPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    sessions,
    addItem,
    updateItem,
    removeItem,
    submitOrder,
    requestPayment,
    clearPendingItems,
  } = useTableSessions()

  const [showDraft, setShowDraft] = useState(false)
  const [time, setTime] = useState(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setTime(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      )
    }
    const timerId = setInterval(tick, 10_000)
    return () => clearInterval(timerId)
  }, [])

  const session = sessions[id]

  if (!session) {
    return <PosNotFoundState message="Không tìm thấy bàn hoặc phiên đã đóng." />
  }

  const handleAdd = (item: Omit<OrderItem, 'quantity' | 'note'>) => {
    addItem(id, { ...item, quantity: 1, note: '' })
    toast.success(`Đã thêm ${item.name}`)
  }

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

  const handleRemoveItem = (menuItemId: string) => {
    const name = session.pendingItems.find((i) => i.menuItemId === menuItemId)?.name ?? 'Món'
    removeItem(id, menuItemId)
    toast.error(`Đã xóa ${name}`)
  }

  const handlePay = () => {
    requestPayment(id)
    navigate(`/staff/table/${id}/payment`)
  }

  return (
    <div className="flex h-full flex-col bg-pos-bg text-pos-text">
      <PosPageHeader
        backTo="/staff"
        backLabel="← Sơ đồ bàn"
        center={<TableStatusBadge tableName={session.tableName} status={session.status} />}
        right={<span className="font-mono text-sm text-pos-muted">{time}</span>}
      />
      <main className="grid min-h-0 flex-1 grid-cols-[1fr_300px]">
        <div className="min-h-0">
          <MenuPanel
            pendingItems={session.pendingItems}
            onAdd={handleAdd}
            onDecrement={handleDecrement}
          />
        </div>
        <div className="min-h-0 border-l border-pos-border">
          <OrderSummary
            pendingItems={session.pendingItems}
            submittedOrders={session.submittedOrders}
            onUpdateItem={(menuItemId, patch) => updateItem(id, menuItemId, patch)}
            onRemoveItem={handleRemoveItem}
            onClearAll={() => clearPendingItems(id)}
            onSubmitOrder={() => submitOrder(id)}
            onPay={handlePay}
            onDraftReceipt={() => setShowDraft(true)}
          />
        </div>
      </main>
      {showDraft && (
        <ReceiptDialog
          tableId={id}
          tableLabel={session.tableName}
          orders={session.submittedOrders}
          isDraft
          onClose={() => setShowDraft(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite to confirm no regressions**

```bash
npm run test
```

Expected: all tests pass (unused `Link` import removed — if lint complains, it's already been removed from the file above)

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/table-order.tsx
git commit -m "refactor(pos): use shared components in table-order page"
```

---

## Task 6: Update `payment.tsx`

Swap in `PosNotFoundState`, `PosPageHeader`, `TableStatusBadge`, `ConfirmCancelDialog`. The inline cancel dialog block (~15 lines of JSX) is replaced by the extracted component.

**Files:**
- Modify: `src/app/staff/payment.tsx`

- [ ] **Step 1: Replace the file content**

Full updated `src/app/staff/payment.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PaymentPanel } from '@/components/staff/payment-panel'
import { InvoiceForm } from '@/components/staff/invoice-form'
import { ReceiptDialog } from '@/components/staff/receipt-dialog'
import { ConfirmCancelDialog } from '@/components/staff/confirm-cancel-dialog'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { TableStatusBadge } from '@/components/staff/table-status-badge'
import { Button } from '@/components/ui'
import { useTableSessions } from '@/hooks/useTableSessions'
import { mergeOrderItems } from '@/lib/staff-orders'
import { formatVnd } from '@/data/staff-data'
import type { InvoiceRequest } from '@/types/invoice'

export default function StaffPaymentPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessions, closeSession, cancelSession, setInvoiceRequest } = useTableSessions()
  const [showReceipt, setShowReceipt] = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const session = sessions[id]

  const merged = useMemo(
    () => mergeOrderItems(session?.submittedOrders ?? []),
    [session?.submittedOrders],
  )
  const total = useMemo(
    () => merged.reduce((s, m) => s + m.priceNum * m.quantity, 0),
    [merged],
  )

  if (!session) {
    return <PosNotFoundState message="Không tìm thấy phiên thanh toán." />
  }

  const handleConfirm = () => {
    toast.success('Đã thanh toán')
    closeSession(id)
    navigate('/staff')
  }

  const handleInvoiceSubmit = (req: InvoiceRequest) => {
    setInvoiceRequest(id, req)
    setShowInvoiceForm(false)
    navigate(`/staff/table/${id}/invoice`)
  }

  return (
    <div className="flex h-full flex-col bg-pos-bg text-pos-text">
      <PosPageHeader
        backTo={`/staff/table/${id}`}
        backLabel="← Quay lại"
        center={<TableStatusBadge tableName={session.tableName} status="waiting_payment" />}
      />

      <main className="grid min-h-0 flex-1 grid-cols-2">
        {/* Left: order detail */}
        <div className="flex min-h-0 flex-col border-r border-pos-border">
          <div className="flex items-baseline justify-between border-b border-pos-border px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-widest text-pos-muted">
              Chi tiết đơn
            </span>
            <span className="text-sm font-semibold">{merged.length} món</span>
          </div>

          <ul className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
            {merged.map((m) => (
              <li key={`${m.menuItemId}::${m.note}`} className="py-1.5">
                <div className="flex items-baseline gap-3 text-sm">
                  <span className="w-7 shrink-0 text-center text-xs font-semibold text-pos-dim">
                    {m.quantity}×
                  </span>
                  <span className="flex-1 text-pos-text">{m.name}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-pos-gold">
                    {formatVnd(m.priceNum * m.quantity)}
                  </span>
                </div>
                {m.note && (
                  <p className="ml-10 mt-0.5 text-xs italic text-pos-dim">{m.note}</p>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-pos-border px-4 py-3">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-pos-muted">
                Tổng cộng
              </span>
              <span className="text-xl font-bold text-pos-gold">{formatVnd(total)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReceipt(true)}>
                Hoá đơn tạm
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowInvoiceForm(true)}>
                Xuất hoá đơn
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmCancel(true)}>
                Huỷ bàn
              </Button>
            </div>
          </div>
        </div>

        {/* Right: payment panel */}
        <div className="min-h-0 overflow-y-auto bg-pos-surface p-4">
          <PaymentPanel total={total} onConfirm={handleConfirm} />
        </div>
      </main>

      {showReceipt && (
        <ReceiptDialog
          tableId={id}
          tableLabel={session.tableName}
          orders={session.submittedOrders}
          isDraft
          onClose={() => setShowReceipt(false)}
        />
      )}

      {showInvoiceForm && (
        <InvoiceForm
          onSubmit={handleInvoiceSubmit}
          onCancel={() => setShowInvoiceForm(false)}
        />
      )}

      <ConfirmCancelDialog
        open={confirmCancel}
        onConfirm={() => {
          cancelSession(id)
          navigate('/staff')
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/payment.tsx
git commit -m "refactor(pos): use shared components in payment page"
```

---

## Task 7: Update `receipt.tsx`

Swap in `PosNotFoundState` and `PosPageHeader`. The inline header (back link + IN/HOÀN TẤT buttons) moves into the `right` slot.

**Files:**
- Modify: `src/app/staff/receipt.tsx`

- [ ] **Step 1: Replace the file content**

Full updated `src/app/staff/receipt.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ReceiptPreview } from '@/components/staff/receipt-preview'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_TABLES } from '@/data/staff-data'

export default function StaffReceiptPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { sessions, closeSession } = useTableSessions()
  const isDraft = params.get('draft') !== 'false'

  const [issuedAt] = useState(() => new Date().toISOString())

  const table = useMemo(() => STAFF_TABLES.find((t) => t.id === id), [id])
  const session = sessions[id]

  if (!table || !session) {
    return <PosNotFoundState message="Không tìm thấy phiên." />
  }

  const handleDone = () => {
    closeSession(id)
    navigate('/staff')
  }

  return (
    <div className="min-h-screen bg-pos-bg text-pos-text">
      <PosPageHeader
        backTo={`/staff/table/${id}`}
        backLabel="← Quay lại"
        printHidden
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-pos-gold px-3 py-1 text-xs font-bold text-pos-gold"
            >
              IN
            </button>
            {!isDraft && (
              <button
                type="button"
                onClick={handleDone}
                className="rounded bg-emerald-800 px-3 py-1 text-xs font-bold text-emerald-200"
              >
                HOÀN TẤT
              </button>
            )}
          </div>
        }
      />
      <main className="bg-white py-4 print:bg-white print:py-0">
        <ReceiptPreview
          tableLabel={table.label}
          orders={session.submittedOrders}
          isDraft={isDraft}
          issuedAt={issuedAt}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: all tests pass (the existing `receipt-page.test.tsx` still passes because `PosNotFoundState` renders the same `bg-pos-bg text-pos-text` wrapper)

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/receipt.tsx
git commit -m "refactor(pos): use shared components in receipt page"
```

---

## Task 8: Update `invoice.tsx`

Swap in `PosNotFoundState` and `PosPageHeader`.

**Files:**
- Modify: `src/app/staff/invoice.tsx`

- [ ] **Step 1: Replace the file content**

Full updated `src/app/staff/invoice.tsx`:

```tsx
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InvoicePreview } from '@/components/staff/invoice-preview'
import { buildInvoice } from '@/lib/staff-invoice'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_ADMIN_SETTINGS } from '@/data/staff-data'

export default function StaffInvoicePage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessions, closeSession } = useTableSessions()
  const session = sessions[id]

  const invoice = useMemo(() => {
    if (!session || !session.invoiceRequest) return null
    return buildInvoice(
      session,
      session.invoiceRequest,
      {
        name: STAFF_ADMIN_SETTINGS.restaurantName,
        address: STAFF_ADMIN_SETTINGS.address,
        taxCode: STAFF_ADMIN_SETTINGS.taxCode,
        phone: STAFF_ADMIN_SETTINGS.phone,
      },
      STAFF_ADMIN_SETTINGS.vatRate,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!session || !invoice) {
    return <PosNotFoundState message="Thiếu dữ liệu hoá đơn." />
  }

  const handleDone = () => {
    closeSession(id)
    navigate('/staff')
  }

  return (
    <div className="min-h-screen bg-pos-bg text-pos-text">
      <PosPageHeader
        backTo={`/staff/table/${id}/payment`}
        backLabel="← Quay lại"
        printHidden
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-pos-gold px-3 py-1 text-xs font-bold text-pos-gold"
            >
              IN
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="rounded bg-emerald-800 px-3 py-1 text-xs font-bold text-emerald-200"
            >
              HOÀN TẤT
            </button>
          </div>
        }
      />
      <main className="bg-white print:bg-white">
        <InvoicePreview invoice={invoice} />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: all tests pass (the existing `invoice-page.test.tsx` still passes because `PosNotFoundState` renders the same `bg-pos-bg text-pos-text` wrapper)

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/invoice.tsx
git commit -m "refactor(pos): use shared components in invoice page"
```

---

## Self-review

**Spec coverage:**
- `PosNotFoundState` → Task 1 + used in Tasks 5–8 ✓
- `TableStatusBadge` → Task 2 + used in Tasks 5–6 ✓
- `PosPageHeader` → Task 3 + used in Tasks 5–8 ✓
- `ConfirmCancelDialog` → Task 4 + used in Task 6 ✓

**Type consistency check:**
- `PosNotFoundState` prop: `message: string` — used as string in all page tasks ✓
- `TableStatusBadge` prop: `status: TableSessionStatus` — `session.status` is `TableSessionStatus`, matches ✓
- `PosPageHeader` props: `backTo: string`, `backLabel: string`, `center?: ReactNode`, `right?: ReactNode`, `printHidden?: boolean` — all usages match ✓
- `ConfirmCancelDialog` props: `open: boolean`, `onConfirm: () => void`, `onCancel: () => void` — usage in Task 6 matches ✓

**Existing test compatibility:**
- `receipt-page.test.tsx` checks `wrapper` has `bg-pos-bg` — after Task 7, `PosNotFoundState` renders this class ✓
- `invoice-page.test.tsx` checks `wrapper` has `bg-pos-bg` — after Task 8, `PosNotFoundState` renders this class ✓
