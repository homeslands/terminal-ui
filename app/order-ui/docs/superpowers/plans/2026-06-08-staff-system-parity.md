# Staff ↔ System Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Only Phase A has step-by-step tasks below — Phases B-F are high-level design specs to plan against later.**

**Goal:** Bring `/staff/table/:id` POS flow to feature-parity with `/system/menu` (full ordering UX) while preserving staff-optimized UI + multi-batch model. Roadmap covers 6 phases; this document implements Phase A and outlines B-F.

**Architecture:** Incremental feature port — each phase adds 1 capability without breaking existing /staff flow. Decouple shared UI from `useOrderFlowStore` (which /system uses) by introducing staff-specific component variants that work against `useTableSessionsStore`. Long-term option: extract truly shared primitives, but only after 2nd consumer needs it.

**Tech Stack:** React 18, Zustand + persist, TanStack Query v5, Vitest + Testing Library, TypeScript.

---

## Roadmap overview (6 phases)

| Phase | Scope | Effort | Status |
|---|---|---|---|
| **A** | Order description + customer linking | 3-4 days | **Detailed below** |
| B | Multi-batch refactor (giữ AT_TABLE) | 2-3 days | Outlined |
| C | TAKE_OUT + promotion per item + gift handling | 5-7 days | Outlined |
| D | Full voucher system với re-validation | 5-7 days | Outlined |
| E | POINT payment + loyalty points | 2-3 days | Outlined |
| F | Server-truth reconciler cho promotion/voucher/subtotal | 3-4 days | Outlined |

**DELIVERY type intentionally excluded** — không phù hợp với context POS bàn (waiter ở bàn không xử lý đơn ship). Tiếp tục dùng `/system/menu` flow.

---

## Phase B (overview only) — Multi-batch refactor

**Goal**: chuyển /staff từ first-submit-only sang tách rõ "Gửi batch" vs "Thanh toán", cho phép sửa/add món giữa các batch.

**Files to touch**:
- `src/stores/table-sessions.store.ts` — refactor session schema để track `submittedItems` riêng vs `pendingItems` với `orderItemSlug`
- `src/app/staff/table-order.tsx` — handleSubmitOrder hiện đã có if/else cho first vs subsequent. Mở rộng pattern.
- `src/components/staff/order-summary.tsx` — tách 2 nút "Gửi batch" + "Thanh toán"
- `src/components/staff/submitted-orders-dialog.tsx` — đã có sẵn, reuse cho edit

**Key challenges**:
- Voucher re-validation giữa batches (defer đến Phase D)
- Cross-device sync khi nhiều batch (đã có reconciler refresh)
- BE auto-cancel timeout cho order PENDING quá lâu

**Effort**: 2-3 ngày.

---

## Phase C (overview only) — TAKE_OUT + Promotion + Gift

**Goal**: hỗ trợ TAKE_OUT order type, promotion per item, gift item handling.

**Files**:
- `src/types/session.ts` — thêm `type: OrderTypeEnum`, `timeLeftTakeOut?: number` vào `TableSession`
- `src/stores/table-sessions.store.ts` — setters cho type + pickup time
- `src/components/staff/order-summary.tsx` — OrderTypeSelect (AT_TABLE/TAKE_OUT toggle), PickupTimeSelect cho TAKE_OUT
- `src/components/staff/menu-panel.tsx` — pass promotion data when adding item
- Reuse `calculateCartItemDisplay` / `calculateCartTotals` từ `@/utils` cho promotion math
- Gift filter: extend `pendingItems`/`submittedOrders` consumers để bỏ qua `isGift=true` khi đếm voucher maxItems

**Key challenges**:
- AT_TABLE vs TAKE_OUT cần xử lý khác (TAKE_OUT không cần `table` slug)
- Reconciler phải tolerate non-AT_TABLE order types
- Gift items có thể không cho phép sửa quantity/note

**Effort**: 5-7 ngày.

---

## Phase D (overview only) — Voucher system

**Goal**: full voucher support trong /staff với re-validation logic.

**Files**:
- `src/types/session.ts` — `voucher?: IVoucher | null` trên TableSession
- `src/stores/table-sessions.store.ts` — `applyVoucher`, `removeVoucher` setters
- `src/components/staff/order-summary.tsx` — voucher badge + StaffVoucherListSheet
- `src/components/app/sheet/staff-voucher-list-sheet.tsx` — đã có sẵn từ /system, có thể reuse hoặc fork
- 5 useEffect tương tự cart-content.tsx:
  1. Validate khi voucher hoặc owner đổi
  2. Auto-remove nếu cartItemQuantity > voucher.maxItems
  3. Validate SAME_PRICE_PRODUCT type
  4. Auto-remove nếu subtotal < voucher.minOrderValue
  5. Auto-remove nếu mất customer info + voucher có isVerificationIdentity
- Per-batch: gọi `updateVoucherInOrder` API sau khi submit batch (giống `client-confirm-update-order-dialog.tsx`)

**Key challenges**:
- Phụ thuộc Phase B (multi-batch) để re-apply voucher đúng
- Re-validation phức tạp; có thể trích logic ra helper riêng test được
- BE phải verify voucher khi mỗi batch (race với multi-staff)

**Effort**: 5-7 ngày.

---

## Phase E (overview only) — Loyalty points + POINT payment

**Goal**: hỗ trợ thanh toán bằng điểm tích lũy + apply `accumulatedPointsToUse`.

**Files**:
- `src/types/session.ts` — `accumulatedPointsToUse?: number`
- `src/components/staff/payment-panel.tsx` — thêm tab POINT (đã có ở /system)
- `src/app/staff/payment.tsx` — handle PaymentMethod.POINT
- Reuse `useInitiatePayment` với `paymentMethod: POINT` + `membershipCard` slug (hoặc qrToken nếu scan)

**Key challenges**:
- Cần Phase A (customer linking) làm tiền đề — không có customer thì không có loyalty points
- BE constraint: customer phải có membership card active

**Effort**: 2-3 ngày.

---

## Phase F (overview only) — Server-truth reconciler enhancement

**Goal**: reconciler hiện chỉ sync slug + quantity + note. Mở rộng để sync promotion, voucher, subtotal đã apply.

**Files**:
- `src/lib/staff-orders.ts` — `mapServerOrderItemToOrderItem` thêm field `promotion`, `subtotal`, `customPrice`
- `src/types/session.ts` — thêm các field tương ứng vào `OrderItem`
- `src/components/staff/order-summary.tsx` — hiển thị tiền giảm + voucher đã apply (từ server)
- `src/lib/__tests__/staff-orders.test.ts` — extend mapper tests

**Key challenges**:
- Phụ thuộc Phase D (voucher) để có voucher info trên client
- Backward compat với data cũ (item không có promotion)

**Effort**: 3-4 ngày.

---

## Phase A (implementation detail) — Order description + Customer linking

**Phase A goal:** /staff session lưu được **note tổng đơn** (description) và **liên kết customer**; gửi đúng payload khi createOrder.

**Phase A scope** (out of scope for this phase, deferred to later phases):
- Sửa description/customer SAU khi đã submit (cần Phase B multi-batch + updateOrderType API)
- Tạo customer mới từ /staff (chỉ search/select customer đã tồn tại)
- RFID scan (defer)
- Validate customer phải có membership active (cần Phase E)

**Architecture for Phase A**:
- Tạo 2 component decoupled mới trong `src/components/staff/`: `StaffOrderNoteInput` (simple controlled textarea) + `StaffCustomerSearchInput` (search + select via callback props). Không reuse `@/components/app/input/customer-search-input.tsx` vì component đó couple chặt với `useOrderFlowStore`.
- Mở rộng `TableSession` schema với `description?: string` + `customer?: TableCustomer` (subset của `IUserInfo`).
- 2 store setters: `setOrderDescription`, `setOrderCustomer`.
- Disable cả 2 inputs khi `session.orderSlug` đã set (post-submit).

---

### Phase A — File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/session.ts` | Modify | Thêm `description?: string`, `customer?: TableCustomer` vào `TableSession`. Định nghĩa `TableCustomer` interface (subset của `IUserInfo`). |
| `src/stores/table-sessions.store.ts` | Modify | Thêm 2 setters `setOrderDescription`, `setOrderCustomer` (last cũng dùng để clear bằng cách pass `null`). |
| `src/hooks/__tests__/useTableSessions.test.tsx` | Modify | +3 tests cho 2 setters mới (set, clear, no-op when session missing). |
| `src/components/staff/staff-order-note-input.tsx` | **Create** | Controlled textarea với label "Ghi chú đơn". Props: `value`, `onChange`, `disabled`. |
| `src/components/staff/staff-customer-search-input.tsx` | **Create** | Search customer theo số điện thoại + list dropdown + selected display + clear button. Props: `customer: TableCustomer | null`, `onSelect: (c: TableCustomer) => void`, `onClear: () => void`, `disabled`. Dùng `useUsers` hook. |
| `src/tests/components/staff/staff-customer-search-input.test.tsx` | **Create** | 4 tests cơ bản: render placeholder khi không có customer, hiển thị customer khi có, gọi onSelect khi chọn item, gọi onClear khi bấm X. |
| `src/components/staff/order-summary.tsx` | Modify | Render 2 input mới ở footer. Wire vào props từ table-order.tsx. |
| `src/app/staff/table-order.tsx` | Modify | (a) Destructure 2 setters mới từ `useTableSessions()`. (b) Pass `description`, `customer` props xuống `OrderSummary`. (c) Trong `handleSubmitOrder`, dùng `session.customer?.slug ?? userInfo.slug` cho `owner` + `session.description ?? ''` cho `description`. |

---

### Phase A — Task 1: Schema + store setters

**Files:**
- Modify: `src/types/session.ts`
- Modify: `src/stores/table-sessions.store.ts`
- Modify: `src/hooks/__tests__/useTableSessions.test.tsx`

- [ ] **Step 1: Add interface + fields to session types**

In `src/types/session.ts`, add a new interface above `TableSession`:

```ts
/**
 * Subset of IUserInfo stored on a TableSession when a customer is linked to
 * the order. Display info + slug for API payload. Full customer record stays
 * in the user store / BE.
 */
export interface TableCustomer {
  slug: string
  firstName: string
  lastName: string
  phonenumber: string
}
```

Update `TableSession` interface — add the 2 fields, placed after `transferredFromTable`:

```ts
  /**
   * Free-text note for the whole order (vd: "khách dị ứng tôm"). Set before
   * first submit; included in createOrder payload as `description`.
   */
  description?: string
  /**
   * Customer linked to this order. When set, `owner` in createOrder payload
   * uses `customer.slug` instead of staff slug. Display fields (firstName,
   * etc.) are stored for UI without re-fetching.
   */
  customer?: TableCustomer
```

- [ ] **Step 2: Write failing tests for store setters**

In `src/hooks/__tests__/useTableSessions.test.tsx`, append inside the main `describe('useTableSessions', ...)`:

```ts
  it('setOrderDescription sets description on the session', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() => result.current.setOrderDescription('t1', 'khách dị ứng tôm'))
    expect(result.current.sessions.t1.description).toBe('khách dị ứng tôm')
  })

  it('setOrderCustomer attaches and clears customer', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() =>
      result.current.setOrderCustomer('t1', {
        slug: 'cus-1',
        firstName: 'Nguyễn',
        lastName: 'A',
        phonenumber: '0901234567',
      }),
    )
    expect(result.current.sessions.t1.customer?.slug).toBe('cus-1')

    act(() => result.current.setOrderCustomer('t1', null))
    expect(result.current.sessions.t1.customer).toBeUndefined()
  })

  it('setOrderDescription is a no-op when the session does not exist', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.setOrderDescription('nonexistent', 'note'))
    expect(result.current.sessions.nonexistent).toBeUndefined()
  })
```

- [ ] **Step 3: Run failing tests**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx -t 'setOrderDescription\|setOrderCustomer'`
Expected: 3 FAIL — setters not exist.

- [ ] **Step 4: Add setters to store interface + implementation**

In `src/stores/table-sessions.store.ts`:

(a) Add to `ITableSessionsStore` interface (after `clearTransferredMark`):

```ts
  setOrderDescription: (tableId: string, description: string) => void
  setOrderCustomer: (tableId: string, customer: TableCustomer | null) => void
```

Also add `TableCustomer` to the existing type import at top:
```ts
import type { OrderItem, SubmittedOrder, TableCustomer, TableSession } from '@/types/session'
```

(b) Add implementations (after `clearTransferredMark` block):

```ts
      setOrderDescription: (tableId, description) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({ ...session, description })),
        ),

      setOrderCustomer: (tableId, customer) =>
        set((state) =>
          patchSession(state, tableId, (session) => {
            if (customer === null) {
              if (!session.customer) return session
              const { customer: _c, ...rest } = session
              void _c
              return rest as TableSession
            }
            return { ...session, customer }
          }),
        ),
```

- [ ] **Step 5: Run tests to verify passing**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx -t 'setOrderDescription\|setOrderCustomer'`
Expected: 3 PASS.

- [ ] **Step 6: Run full hook test file**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx`
Expected: 31 PASS (28 existing + 3 new).

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/types/session.ts src/stores/table-sessions.store.ts 2>&1 | head -5`
Expected: clean.

---

### Phase A — Task 2: `StaffOrderNoteInput` component

**Files:**
- Create: `src/components/staff/staff-order-note-input.tsx`

Simple controlled textarea, no state, no store coupling.

- [ ] **Step 1: Create component**

Create `src/components/staff/staff-order-note-input.tsx`:

```tsx
import { NotepadText } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function StaffOrderNoteInput({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded border border-pos-border bg-pos-card">
      <NotepadText size={14} className="mt-1 shrink-0 text-pos-faint" />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Ghi chú cho cả đơn (vd: khách dị ứng tôm)..."
        rows={2}
        className="flex-1 resize-none bg-transparent text-xs text-pos-text placeholder:text-pos-faint focus:outline-none disabled:opacity-50"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean.

Run: `npx eslint src/components/staff/staff-order-note-input.tsx 2>&1 | head -5`
Expected: clean.

(No tests needed — component is pure controlled input, behavior trivial.)

---

### Phase A — Task 3: `StaffCustomerSearchInput` component

**Files:**
- Create: `src/components/staff/staff-customer-search-input.tsx`
- Create: `src/tests/components/staff/staff-customer-search-input.test.tsx`

Search-and-select customer via phone number. Uses `useUsers` hook (already exists). Callback-based, no store coupling.

- [ ] **Step 1: Create component**

Create `src/components/staff/staff-customer-search-input.tsx`:

```tsx
import { useState } from 'react'
import { CircleX, User2Icon } from 'lucide-react'

import { Input, Button } from '@/components/ui'
import { useDebouncedInput, useUsers } from '@/hooks'
import { Role } from '@/constants'
import type { IUserInfo } from '@/types'
import type { TableCustomer } from '@/types/session'

interface Props {
  customer: TableCustomer | null
  onSelect: (customer: TableCustomer) => void
  onClear: () => void
  disabled?: boolean
}

function toTableCustomer(user: IUserInfo): TableCustomer {
  return {
    slug: user.slug,
    firstName: user.firstName,
    lastName: user.lastName,
    phonenumber: user.phonenumber,
  }
}

export function StaffCustomerSearchInput({ customer, onSelect, onClear, disabled }: Props) {
  const { inputValue, setInputValue, debouncedInputValue } = useDebouncedInput()
  const [showList, setShowList] = useState(false)

  const { data: usersData } = useUsers(
    debouncedInputValue
      ? {
          order: 'DESC',
          page: 1,
          size: 10,
          phonenumber: debouncedInputValue,
          role: Role.CUSTOMER,
          hasPaging: true,
        }
      : null,
    !!debouncedInputValue && !disabled,
  )

  const users = usersData?.result?.items ?? []

  if (customer) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-pos-border bg-pos-card">
        <User2Icon size={14} className="text-pos-gold shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-pos-text truncate">
            {customer.lastName} {customer.firstName}
          </div>
          <div className="text-[10px] text-pos-faint truncate">{customer.phonenumber}</div>
        </div>
        {!disabled && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bỏ chọn khách"
            onClick={onClear}
            className="h-6 w-6 text-pos-faint hover:text-destructive"
          >
            <CircleX size={14} />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          setShowList(true)
        }}
        onFocus={() => setShowList(true)}
        onBlur={() => setTimeout(() => setShowList(false), 150)}
        disabled={disabled}
        placeholder="Tìm khách theo số điện thoại..."
        className="w-full rounded border border-pos-border bg-pos-card px-3 py-1.5 text-xs placeholder:text-pos-faint"
      />
      {showList && users.length > 0 && (
        <div
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border border-pos-border bg-pos-card shadow-lg"
        >
          {users.map((u) => (
            <button
              key={u.slug}
              type="button"
              onClick={() => {
                onSelect(toTableCustomer(u))
                setInputValue('')
                setShowList(false)
              }}
              className="block w-full px-3 py-2 text-left text-xs hover:bg-pos-hover"
            >
              <div className="font-semibold text-pos-text">
                {u.lastName} {u.firstName}
              </div>
              <div className="text-[10px] text-pos-faint">{u.phonenumber}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write tests**

Create `src/tests/components/staff/staff-customer-search-input.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StaffCustomerSearchInput } from '@/components/staff/staff-customer-search-input'
import type { TableCustomer } from '@/types/session'

// Mock the useUsers hook so the test doesn't hit the network.
vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/hooks')>('@/hooks')
  return {
    ...actual,
    useUsers: () => ({
      data: {
        result: {
          items: [
            {
              slug: 'cus-1',
              firstName: 'An',
              lastName: 'Nguyễn',
              phonenumber: '0901234567',
              dob: '',
              email: '',
              address: '',
              language: 'vi',
            },
          ],
        },
      },
    }),
    useDebouncedInput: () => {
      let value = ''
      return {
        inputValue: value,
        setInputValue: (v: string) => {
          value = v
        },
        debouncedInputValue: value,
      }
    },
  }
})

const customer: TableCustomer = {
  slug: 'cus-1',
  firstName: 'An',
  lastName: 'Nguyễn',
  phonenumber: '0901234567',
}

describe('StaffCustomerSearchInput', () => {
  it('renders placeholder input when no customer is selected', () => {
    render(
      <StaffCustomerSearchInput
        customer={null}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(
      screen.getByPlaceholderText(/Tìm khách theo số điện thoại/),
    ).toBeInTheDocument()
  })

  it('renders customer name + phone when customer is selected', () => {
    render(
      <StaffCustomerSearchInput
        customer={customer}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByText('Nguyễn An')).toBeInTheDocument()
    expect(screen.getByText('0901234567')).toBeInTheDocument()
  })

  it('calls onClear when clicking the clear button', () => {
    const onClear = vi.fn()
    render(
      <StaffCustomerSearchInput
        customer={customer}
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    )
    fireEvent.click(screen.getByLabelText('Bỏ chọn khách'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('hides the clear button when disabled', () => {
    render(
      <StaffCustomerSearchInput
        customer={customer}
        onSelect={vi.fn()}
        onClear={vi.fn()}
        disabled
      />,
    )
    expect(screen.queryByLabelText('Bỏ chọn khách')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/tests/components/staff/staff-customer-search-input.test.tsx`
Expected: 4 PASS.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/staff-customer-search-input.tsx src/tests/components/staff/staff-customer-search-input.test.tsx 2>&1 | head -5`
Expected: clean.

---

### Phase A — Task 4: Wire components into `OrderSummary`

**Files:**
- Modify: `src/components/staff/order-summary.tsx`

Render 2 inputs ở footer của OrderSummary. Add 4 new props (description + customer state + handlers).

- [ ] **Step 1: Extend OrderSummary Props**

Open `src/components/staff/order-summary.tsx`. Find the `Props` interface (around top of file) and extend:

```ts
import type { OrderItem, SubmittedOrder, TableCustomer } from '@/types/session'

interface Props {
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  onUpdateItem: (...) => void          // (existing — preserve)
  onRemoveItem: (menuItemId: string) => void
  onClearAll: () => void
  onSubmitOrder: () => void
  onPay: () => void
  onDraftReceipt: () => void
  onConfirmChanges: (...) => Promise<void>
  onCancelOrder: () => Promise<void>
  isSubmittingOrder?: boolean
  /**
   * Phase A: order-level note (description). Disable when order already
   * submitted (orderSlug set on session).
   */
  description: string
  onDescriptionChange: (value: string) => void
  /**
   * Phase A: linked customer. null when no customer attached.
   */
  customer: TableCustomer | null
  onSelectCustomer: (customer: TableCustomer) => void
  onClearCustomer: () => void
  /**
   * True when order already submitted to server (orderSlug exists).
   * Disables description and customer edit (will be lifted in Phase B).
   */
  isPostSubmit: boolean
}
```

(Adjust to match the existing Props shape — preserve all existing fields verbatim; only ADD the 5 new ones above.)

Destructure new props in component signature:

```ts
export function OrderSummary({
  // ... existing
  description,
  onDescriptionChange,
  customer,
  onSelectCustomer,
  onClearCustomer,
  isPostSubmit,
}: Props) {
```

- [ ] **Step 2: Add imports**

At top of file:

```ts
import { StaffOrderNoteInput } from './staff-order-note-input'
import { StaffCustomerSearchInput } from './staff-customer-search-input'
```

- [ ] **Step 3: Render in footer**

In the JSX, find the footer section (where `ConfirmOrderDialog` is rendered, around the bottom). Insert ABOVE the buttons:

```tsx
        {/* Phase A: order metadata */}
        <div className="flex flex-col gap-2 px-3 py-2">
          <StaffCustomerSearchInput
            customer={customer}
            onSelect={onSelectCustomer}
            onClear={onClearCustomer}
            disabled={isPostSubmit}
          />
          <StaffOrderNoteInput
            value={description}
            onChange={onDescriptionChange}
            disabled={isPostSubmit}
          />
        </div>
```

Choose placement that fits the existing layout — somewhere between the pendingItems list and the action buttons (ConfirmOrderDialog / pay / draft receipt). If the existing footer has a `<div className="border-t border-pos-border p-4">` wrapper, place the new block right inside it, above the buttons.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc -b 2>&1 | head -10`
Expected: errors expected at the caller site (table-order.tsx) because the new required props aren't passed yet. That's Task 5. **Only verify that the OrderSummary file itself doesn't have errors** — look for errors specifically mentioning `order-summary.tsx`.

If OrderSummary itself errors (vd: missing import, wrong type) — fix before continuing.

---

### Phase A — Task 5: Wire props in `table-order.tsx`

**Files:**
- Modify: `src/app/staff/table-order.tsx`

Pass description/customer state from session into OrderSummary; pass them in createOrder payload; expose change handlers.

- [ ] **Step 1: Destructure new setters from useTableSessions**

In `src/app/staff/table-order.tsx`, find the existing `useTableSessions()` destructure (around top of component). Add `setOrderDescription` and `setOrderCustomer` to it.

- [ ] **Step 2: Wire OrderSummary props**

Find the `<OrderSummary ... />` JSX. Add the 5 new props (compute values from `session`):

```tsx
<OrderSummary
  // ... all existing props preserved ...
  description={session.description ?? ''}
  onDescriptionChange={(value) => setOrderDescription(id, value)}
  customer={session.customer ?? null}
  onSelectCustomer={(c) => setOrderCustomer(id, c)}
  onClearCustomer={() => setOrderCustomer(id, null)}
  isPostSubmit={!!session.orderSlug}
/>
```

- [ ] **Step 3: Include description + owner in createOrderAsync payload**

Find `handleSubmitOrder` (around line 215). Inside the `if (!currentSession.orderSlug)` branch, modify the `createOrderAsync({...})` call:

```ts
        const data = await createOrderAsync({
          type: OrderTypeEnum.AT_TABLE,
          table: id,
          branch: userInfo?.branch?.slug ?? '',
          owner: currentSession.customer?.slug ?? userInfo?.slug ?? '',
          approvalBy: userInfo?.slug ?? '',
          description: currentSession.description ?? '',
          orderItems: apiItems.map((item) => ({
            quantity: item.quantity,
            variant: item.variantSlug!,
            promotion: null,
            note: item.note || '',
          })),
          voucher: null,
        })
```

(Note: `description` is added; `owner` now uses customer slug when present, fallback staff slug.)

If TypeScript complains that `description` is not in `ICreateOrderRequest`, verify the type definition (`src/types/order.type.ts` or similar) — it IS supported already by /system flow. If type is missing the field, ADD it as optional `description?: string`.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc -b 2>&1 | head -10`
Expected: clean.

- [ ] **Step 5: Run lint**

Run: `npx eslint src/app/staff/table-order.tsx src/components/staff/order-summary.tsx 2>&1 | head -10`
Expected: clean.

- [ ] **Step 6: Run full vitest**

Run: `npx vitest run 2>&1 | tail -5`
Expected: 521 PASS (517 baseline + 3 store + 4 component = 524 actually, but some tests may need updating — verify count). If any existing OrderSummary test fails because of new required props, update the test's render call to pass default values.

Specifically check `src/tests/components/staff/order-summary.test.tsx` — likely needs to be updated to pass the new required props. Add defaults:

```ts
const defaultProps = {
  description: '',
  onDescriptionChange: vi.fn(),
  customer: null,
  onSelectCustomer: vi.fn(),
  onClearCustomer: vi.fn(),
  isPostSubmit: false,
}
```

Pass `{...defaultProps}` in the existing test render calls.

---

### Phase A — Task 6: Regression + manual smoke

- [ ] **Step 1: Full regression**

Run: `npx vitest run 2>&1 | tail -10`
Expected: all PASS. Net new tests: +3 (store setters) + +4 (StaffCustomerSearchInput) = **+7 tests** vs baseline 517 → expect 524.

Run: `npm run build 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 2: Manual smoke**

1. Mở `/staff` → click bàn trống → vào `/staff/table/<slug>`.
2. **Order note**: gõ "khách dị ứng tôm" vào textarea bên dưới list món. Refresh page → text vẫn còn (Zustand persist).
3. **Customer search**:
   - Gõ số điện thoại (vd "0901") → đợi 300ms debounce → dropdown list hiện customers.
   - Click vào 1 customer → input thay bằng display "Họ Tên + Phone" + nút X.
   - Bấm X → quay lại input search trống.
4. **Submit + verify payload**:
   - Chọn customer, gõ description.
   - Add 1 món → bấm ĐẶT MÓN.
   - DevTools Network → `POST /orders` → expected payload có:
     - `owner: "<customer-slug>"` (không phải staff slug)
     - `description: "khách dị ứng tôm"`
5. **Post-submit disable**:
   - Sau khi submit, `orderSlug` được set → cả 2 input phải disabled (xám, không click được nút X).
   - Customer display vẫn hiển thị (read-only).

Record PASS/FAIL từng case.

---

## Self-Review (Phase A)

**Spec coverage**:
- Order description ↔ Tasks 1 (schema) + 2 (component) + 4 (wire) + 5 (payload). ✓
- Customer linking ↔ Tasks 1 (schema) + 3 (component) + 4 (wire) + 5 (payload). ✓
- Disable post-submit ↔ Task 4 (`disabled` prop wiring) + Task 5 (`isPostSubmit={!!session.orderSlug}`). ✓
- Tests ↔ Task 1 (3 store tests) + Task 3 (4 component tests). ✓
- Regression ↔ Task 6. ✓

**Type consistency**:
- `TableCustomer` interface defined in Task 1 (`src/types/session.ts`), used in Task 3 component props, Task 4 OrderSummary props, Task 5 wiring. Same shape everywhere.
- `setOrderDescription(tableId, description: string)` consistent in Task 1 (test + impl), Task 5 (caller).
- `setOrderCustomer(tableId, customer: TableCustomer | null)` consistent in Task 1, Task 5.

**Placeholder scan**: no TBD/TODO. Each step has code or command.

**Risks**:
- `ICreateOrderRequest.description` may not exist as optional field — Task 5 Step 3 has fallback instruction to add it. Verify in real codebase.
- Existing `OrderSummary` test may need defaults helper — Task 5 Step 6 covers.
- Mock of `useUsers` in component test (Task 3) bypasses real query. Acceptable for unit; integration coverage via Task 6 manual smoke.

**Out of scope (explicit)**:
- Sửa description/customer sau submit → Phase B
- Tạo customer mới → defer
- RFID → defer
- Membership card validation → Phase E

---

## Plan complete

This document covers:
1. **6-phase roadmap** (overview) — Phases A-F outlined with goals, files, challenges, effort.
2. **Phase A detailed implementation** — 6 tasks ready for subagent-driven execution.

Phases B-F to be detailed when their time comes (each will get its own dedicated implementation plan written from this roadmap).
