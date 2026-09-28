# Staff Shift Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/staff/my-shift` dashboard page showing each staff member's shift stats (revenue, order count, item count, top 5 items) with mock data that can later be swapped for a real API.

**Architecture:** New route inside the existing `StaffPosLayout` at `/staff/my-shift`. A `useStaffShift(date, shift)` hook returns mock stats; components (`ShiftSelector`, `ShiftStatCards`, `ShiftTopItems`) are pure display. Shift auto-detects from the current hour; user can switch ca or date.

**Tech Stack:** React, TypeScript, Vitest + React Testing Library, Tailwind CSS (`pos-*` tokens), Lucide icons, React Router v6.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/types/shift.ts` |
| Create | `src/utils/shift.ts` |
| Create | `src/utils/__tests__/shift.test.ts` |
| Create | `src/hooks/useStaffShift.ts` |
| Create | `src/hooks/__tests__/useStaffShift.test.ts` |
| Create | `src/components/staff/shift-selector.tsx` |
| Create | `src/tests/components/staff/shift-selector.test.tsx` |
| Create | `src/components/staff/shift-stat-cards.tsx` |
| Create | `src/components/staff/shift-top-items.tsx` |
| Create | `src/app/staff/my-shift.tsx` |
| Modify | `src/app/staff/index.ts` |
| Modify | `src/constants/route.ts` |
| Modify | `src/router/loadable.tsx` |
| Modify | `src/router/index.tsx` |
| Modify | `src/app/staff/floor-plan.tsx` |

---

### Task 1: Types and shift utilities

**Files:**
- Create: `src/types/shift.ts`
- Create: `src/utils/shift.ts`
- Create: `src/utils/__tests__/shift.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/utils/__tests__/shift.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getCurrentShift, getShiftConfig, SHIFTS } from '../shift'

describe('SHIFTS config', () => {
  it('has exactly 3 shifts with correct keys', () => {
    expect(SHIFTS).toHaveLength(3)
    expect(SHIFTS.map((s) => s.key)).toEqual(['morning', 'afternoon', 'evening'])
  })

  it('getShiftConfig returns matching config', () => {
    expect(getShiftConfig('morning').label).toBe('Ca sáng')
    expect(getShiftConfig('afternoon').label).toBe('Ca chiều')
    expect(getShiftConfig('evening').label).toBe('Ca tối')
  })
})

describe('getCurrentShift', () => {
  let realDate: typeof Date

  beforeEach(() => { realDate = global.Date })
  afterEach(() => { global.Date = realDate })

  const mockHour = (h: number) => {
    global.Date = class extends realDate {
      getHours() { return h }
    } as typeof Date
  }

  it('returns morning for hours 6–13', () => {
    mockHour(6);  expect(getCurrentShift()).toBe('morning')
    mockHour(13); expect(getCurrentShift()).toBe('morning')
  })

  it('returns afternoon for hours 14–21', () => {
    mockHour(14); expect(getCurrentShift()).toBe('afternoon')
    mockHour(21); expect(getCurrentShift()).toBe('afternoon')
  })

  it('returns evening for hours 22–5', () => {
    mockHour(22); expect(getCurrentShift()).toBe('evening')
    mockHour(0);  expect(getCurrentShift()).toBe('evening')
    mockHour(5);  expect(getCurrentShift()).toBe('evening')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/__tests__/shift.test.ts
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Create types**

```ts
// src/types/shift.ts
export type ShiftKey = 'morning' | 'afternoon' | 'evening'

export interface ShiftStats {
  revenue: number
  orderCount: number
  itemCount: number
  topItems: { name: string; quantity: number }[]
}

export interface ShiftConfig {
  key: ShiftKey
  label: string
  hours: string
  startHour: number
  endHour: number
}
```

- [ ] **Step 4: Create shift utilities**

```ts
// src/utils/shift.ts
import type { ShiftConfig, ShiftKey } from '@/types/shift'

export const SHIFTS: ShiftConfig[] = [
  { key: 'morning',   label: 'Ca sáng',  hours: '06:00 – 14:00', startHour: 6,  endHour: 14 },
  { key: 'afternoon', label: 'Ca chiều', hours: '14:00 – 22:00', startHour: 14, endHour: 22 },
  { key: 'evening',   label: 'Ca tối',   hours: '22:00 – 06:00', startHour: 22, endHour: 6  },
]

export function getShiftConfig(key: ShiftKey): ShiftConfig {
  return SHIFTS.find((s) => s.key === key)!
}

export function getCurrentShift(): ShiftKey {
  const h = new Date().getHours()
  if (h >= 6 && h < 14) return 'morning'
  if (h >= 14 && h < 22) return 'afternoon'
  return 'evening'
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/utils/__tests__/shift.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/shift.ts src/utils/shift.ts src/utils/__tests__/shift.test.ts
git commit -m "feat: add shift types and getCurrentShift utility"
```

---

### Task 2: useStaffShift hook (mock data)

**Files:**
- Create: `src/hooks/useStaffShift.ts`
- Create: `src/hooks/__tests__/useStaffShift.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/hooks/__tests__/useStaffShift.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStaffShift } from '../useStaffShift'

describe('useStaffShift', () => {
  it('returns isLoading false immediately', () => {
    const { result } = renderHook(() => useStaffShift('2026-06-02', 'morning'))
    expect(result.current.isLoading).toBe(false)
  })

  it('returns a ShiftStats object with correct shape', () => {
    const { result } = renderHook(() => useStaffShift('2026-06-02', 'morning'))
    const d = result.current.data!
    expect(typeof d.revenue).toBe('number')
    expect(typeof d.orderCount).toBe('number')
    expect(typeof d.itemCount).toBe('number')
    expect(Array.isArray(d.topItems)).toBe(true)
    expect(d.topItems).toHaveLength(5)
    expect(typeof d.topItems[0].name).toBe('string')
    expect(typeof d.topItems[0].quantity).toBe('number')
  })

  it('returns different data for different shifts', () => {
    const { result: r1 } = renderHook(() => useStaffShift('2026-06-02', 'morning'))
    const { result: r2 } = renderHook(() => useStaffShift('2026-06-02', 'afternoon'))
    expect(r1.current.data!.revenue).not.toBe(r2.current.data!.revenue)
  })

  it('returns different data for different dates', () => {
    const { result: r1 } = renderHook(() => useStaffShift('2026-06-02', 'morning'))
    const { result: r2 } = renderHook(() => useStaffShift('2026-06-03', 'morning'))
    expect(r1.current.data!.revenue).not.toBe(r2.current.data!.revenue)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/__tests__/useStaffShift.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create the hook**

```ts
// src/hooks/useStaffShift.ts
import type { ShiftKey, ShiftStats } from '@/types/shift'

function mockSeed(date: string, shift: ShiftKey): number {
  let h = 0
  for (const c of date + shift) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return h
}

const MOCK_ITEMS = ['Cà phê đen', 'Trà đào cam sả', 'Bạc xỉu', 'Sinh tố xoài', 'Nước cam']

export function useStaffShift(
  date: string,
  shift: ShiftKey,
): { data: ShiftStats; isLoading: false } {
  const s = mockSeed(date, shift)
  const data: ShiftStats = {
    revenue:    800_000 + (s % 20) * 100_000,
    orderCount: 5  + (s % 15),
    itemCount:  10 + (s % 30),
    topItems: MOCK_ITEMS.map((name, i) => ({
      name,
      quantity: Math.max(1, 8 - i * 2 + (s % (i + 2))),
    })),
  }
  return { data, isLoading: false }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/__tests__/useStaffShift.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useStaffShift.ts src/hooks/__tests__/useStaffShift.test.ts
git commit -m "feat: add useStaffShift mock hook"
```

---

### Task 3: ShiftSelector component

**Files:**
- Create: `src/components/staff/shift-selector.tsx`
- Create: `src/tests/components/staff/shift-selector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/tests/components/staff/shift-selector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShiftSelector } from '@/components/staff/shift-selector'

const TODAY = new Date().toISOString().slice(0, 10)

describe('ShiftSelector', () => {
  it('renders all 3 shift buttons', () => {
    render(
      <ShiftSelector shift="morning" date={TODAY} onShiftChange={() => {}} onDateChange={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Ca sáng' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ca chiều' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ca tối' })).toBeInTheDocument()
  })

  it('active shift button has gold styling', () => {
    render(
      <ShiftSelector shift="afternoon" date={TODAY} onShiftChange={() => {}} onDateChange={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Ca chiều' })).toHaveClass('bg-pos-gold')
  })

  it('clicking a different shift calls onShiftChange', () => {
    const onShiftChange = vi.fn()
    render(
      <ShiftSelector shift="morning" date={TODAY} onShiftChange={onShiftChange} onDateChange={() => {}} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ca chiều' }))
    expect(onShiftChange).toHaveBeenCalledWith('afternoon')
  })

  it('prev button calls onDateChange with previous day', () => {
    const onDateChange = vi.fn()
    render(
      <ShiftSelector shift="morning" date="2026-06-02" onShiftChange={() => {}} onDateChange={onDateChange} />
    )
    fireEvent.click(screen.getByLabelText('Ngày trước'))
    expect(onDateChange).toHaveBeenCalledWith('2026-06-01')
  })

  it('next button is disabled when date is today', () => {
    render(
      <ShiftSelector shift="morning" date={TODAY} onShiftChange={() => {}} onDateChange={() => {}} />
    )
    expect(screen.getByLabelText('Ngày sau')).toBeDisabled()
  })

  it('next button is enabled for a past date', () => {
    const onDateChange = vi.fn()
    render(
      <ShiftSelector shift="morning" date="2026-06-01" onShiftChange={() => {}} onDateChange={onDateChange} />
    )
    const next = screen.getByLabelText('Ngày sau')
    expect(next).not.toBeDisabled()
    fireEvent.click(next)
    expect(onDateChange).toHaveBeenCalledWith('2026-06-02')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/components/staff/shift-selector.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create ShiftSelector**

```tsx
// src/components/staff/shift-selector.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SHIFTS, getShiftConfig } from '@/utils/shift'
import type { ShiftKey } from '@/types/shift'

interface Props {
  shift: ShiftKey
  date: string
  onShiftChange: (shift: ShiftKey) => void
  onDateChange: (date: string) => void
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function ShiftSelector({ shift, date, onShiftChange, onDateChange }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const isToday = date === today
  const config = getShiftConfig(shift)

  const displayDate = new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        {/* Shift toggle */}
        <div className="flex gap-1 rounded-lg border border-pos-border bg-pos-surface p-1">
          {SHIFTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onShiftChange(s.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                shift === s.key
                  ? 'bg-pos-gold text-black'
                  : 'text-pos-muted hover:text-pos-text'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Date picker */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Ngày trước"
            onClick={() => onDateChange(addDays(date, -1))}
            className="flex h-7 w-7 items-center justify-center rounded border border-pos-border text-pos-muted hover:text-pos-text"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[96px] text-center text-xs text-pos-text">{displayDate}</span>
          <button
            type="button"
            aria-label="Ngày sau"
            disabled={isToday}
            onClick={() => onDateChange(addDays(date, 1))}
            className="flex h-7 w-7 items-center justify-center rounded border border-pos-border text-pos-muted hover:text-pos-text disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Sub-label */}
      <p className="text-[11px] text-pos-muted">{config.hours}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/components/staff/shift-selector.test.tsx
```
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/shift-selector.tsx src/tests/components/staff/shift-selector.test.tsx
git commit -m "feat: add ShiftSelector component"
```

---

### Task 4: ShiftStatCards component

**Files:**
- Create: `src/components/staff/shift-stat-cards.tsx`

No dedicated test — pure display component with no logic, covered by the page snapshot.

- [ ] **Step 1: Create ShiftStatCards**

```tsx
// src/components/staff/shift-stat-cards.tsx
import { ReceiptText, ShoppingBasket } from 'lucide-react'
import type { ShiftStats } from '@/types/shift'
import { formatVnd } from '@/data/staff-data'

interface Props {
  stats: ShiftStats
}

export function ShiftStatCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Revenue — accent card */}
      <div className="rounded-xl bg-pos-gold p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-black/60">Doanh thu</p>
        <p className="mt-1.5 text-2xl font-extrabold text-black">{formatVnd(stats.revenue)}</p>
        <p className="mt-0.5 text-[11px] text-black/50">từ {stats.orderCount} đơn</p>
      </div>

      {/* Order count */}
      <div className="rounded-xl border border-pos-border bg-pos-surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-pos-muted">Số đơn</p>
          <ReceiptText size={15} className="text-pos-muted" />
        </div>
        <p className="mt-1.5 text-2xl font-extrabold text-pos-text">{stats.orderCount}</p>
        <p className="mt-0.5 text-[11px] text-pos-faint">đơn đã gửi bếp</p>
      </div>

      {/* Item count */}
      <div className="rounded-xl border border-pos-border bg-pos-surface p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-pos-muted">Số món</p>
          <ShoppingBasket size={15} className="text-pos-muted" />
        </div>
        <p className="mt-1.5 text-2xl font-extrabold text-pos-text">{stats.itemCount}</p>
        <p className="mt-0.5 text-[11px] text-pos-faint">lượt món đã bán</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite to confirm nothing broken**

```bash
npx vitest run
```
Expected: All tests PASS (no new tests added, no regressions).

- [ ] **Step 3: Commit**

```bash
git add src/components/staff/shift-stat-cards.tsx
git commit -m "feat: add ShiftStatCards component"
```

---

### Task 5: ShiftTopItems component

**Files:**
- Create: `src/components/staff/shift-top-items.tsx`

- [ ] **Step 1: Create ShiftTopItems**

```tsx
// src/components/staff/shift-top-items.tsx
import type { ShiftStats } from '@/types/shift'

interface Props {
  topItems: ShiftStats['topItems']
}

const OPACITIES = ['opacity-100', 'opacity-80', 'opacity-60', 'opacity-45', 'opacity-30']

export function ShiftTopItems({ topItems }: Props) {
  const max = Math.max(...topItems.map((i) => i.quantity), 1)

  return (
    <div className="rounded-xl border border-pos-border bg-pos-surface p-4">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-pos-muted">
        Top món bán chạy
      </p>
      <div className="flex flex-col gap-3">
        {topItems.slice(0, 5).map((item, idx) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-[120px] shrink-0 truncate text-xs text-pos-text">{item.name}</span>
            <div className="flex-1 rounded-sm bg-pos-elevated" style={{ height: 8 }}>
              <div
                className={`h-full rounded-sm bg-pos-gold ${OPACITIES[idx]}`}
                style={{ width: `${(item.quantity / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs text-pos-muted">{item.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/staff/shift-top-items.tsx
git commit -m "feat: add ShiftTopItems component"
```

---

### Task 6: My-shift page

**Files:**
- Create: `src/app/staff/my-shift.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/staff/my-shift.tsx
import { useState } from 'react'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { ShiftSelector } from '@/components/staff/shift-selector'
import { ShiftStatCards } from '@/components/staff/shift-stat-cards'
import { ShiftTopItems } from '@/components/staff/shift-top-items'
import { useStaffShift } from '@/hooks/useStaffShift'
import { useUserStore } from '@/stores'
import { getCurrentShift } from '@/utils/shift'
import type { ShiftKey } from '@/types/shift'

export default function StaffMyShiftPage() {
  const { userInfo } = useUserStore()
  const today = new Date().toISOString().slice(0, 10)

  const [shift, setShift] = useState<ShiftKey>(getCurrentShift)
  const [date, setDate] = useState(today)

  const { data } = useStaffShift(date, shift)

  const staffName = userInfo
    ? `${userInfo.firstName} ${userInfo.lastName}`.trim()
    : 'Nhân viên'

  return (
    <div className="flex h-full flex-col bg-pos-bg text-pos-text">
      <PosPageHeader
        backTo="/staff"
        backLabel="← Sơ đồ bàn"
      />
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <div>
            <h1 className="text-base font-bold text-pos-text">Dashboard ca làm việc</h1>
            <p className="text-xs text-pos-muted">{staffName}</p>
          </div>

          <ShiftSelector
            shift={shift}
            date={date}
            onShiftChange={setShift}
            onDateChange={setDate}
          />

          {data && (
            <>
              <ShiftStatCards stats={data} />
              <ShiftTopItems topItems={data.topItems} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/my-shift.tsx
git commit -m "feat: add StaffMyShiftPage"
```

---

### Task 7: Wire routes and entry point

**Files:**
- Modify: `src/app/staff/index.ts`
- Modify: `src/constants/route.ts`
- Modify: `src/router/loadable.tsx`
- Modify: `src/router/index.tsx`
- Modify: `src/app/staff/floor-plan.tsx`

- [ ] **Step 1: Export page from index**

In `src/app/staff/index.ts`, add one line:

```ts
// existing lines stay; add:
export { default as StaffMyShiftPage } from './my-shift'
```

- [ ] **Step 2: Add route constant**

In `src/constants/route.ts`, find the POS routes block (search for `STAFF_POS_FLOOR_PLAN`) and add:

```ts
STAFF_POS_MY_SHIFT: '/staff/my-shift',
```

- [ ] **Step 3: Add lazy import**

In `src/router/loadable.tsx`, after the `StaffReceiptPage` block (around line 652), add:

```tsx
export const StaffMyShiftPage = React.lazy(() =>
  import('@/app/staff').then((module) => ({
    default: module.StaffMyShiftPage,
  })),
)
```

- [ ] **Step 4: Add route to router**

In `src/router/index.tsx`:

1. Import at top with the other Staff POS imports (around line 93):
```tsx
StaffMyShiftPage,
```

2. Inside the `StaffPosLayout` children array, after the `StaffReceiptPage` route, add:
```tsx
{
  path: ROUTE.STAFF_POS_MY_SHIFT,
  element: <SuspenseElement component={StaffMyShiftPage} />,
},
```

- [ ] **Step 5: Add entry button to floor plan**

In `src/app/staff/floor-plan.tsx`, add a Link to the dashboard. The current return is:

```tsx
return (
  <div className="bg-pos-bg text-pos-text">
    <main className="mx-auto max-w-6xl px-2 py-4">
      <FloorPlan tables={tables} sessions={sessions} onTableClick={handleTableClick} />
    </main>
  </div>
)
```

Replace with:

```tsx
import { Link } from 'react-router-dom'
import { BarChart2 } from 'lucide-react'
import { ROUTE } from '@/constants'

// ... (existing imports and logic stay)

return (
  <div className="bg-pos-bg text-pos-text">
    <div className="flex items-center justify-end px-4 pt-3">
      <Link
        to={ROUTE.STAFF_POS_MY_SHIFT}
        className="flex items-center gap-1.5 rounded-lg border border-pos-border bg-pos-surface px-3 py-1.5 text-xs font-medium text-pos-muted transition hover:border-pos-gold hover:text-pos-gold"
      >
        <BarChart2 size={13} />
        Ca của tôi
      </Link>
    </div>
    <main className="mx-auto max-w-6xl px-2 py-4">
      <FloorPlan tables={tables} sessions={sessions} onTableClick={handleTableClick} />
    </main>
  </div>
)
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/staff/index.ts src/constants/route.ts src/router/loadable.tsx src/router/index.tsx src/app/staff/floor-plan.tsx
git commit -m "feat: wire staff shift dashboard route and floor plan entry point"
```
