# Floor Plan Cross-Device Order Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị đúng thông tin đơn (số món + tổng tiền) trên `TableCard` của floor plan `/staff` cho **mọi nhân viên** trên mọi máy, không chỉ máy đã đặt đơn.

**Architecture:** Hiện tại floor plan dùng 2 nguồn data: (a) `GET /tables` → chỉ trả `status` (`available`/`reserved`), không có thông tin đơn; (b) Zustand `useTableSessions` localStorage → có đầy đủ thông tin nhưng **chỉ trên máy đã đặt đơn**. Hệ quả: nhân viên 2 nhìn thấy bàn `reserved` nhưng số món = 0, tổng tiền = 0. Giải pháp: gọi thêm `GET /orders?branch=...&status=pending&hasPaging=false` (endpoint đã có sẵn qua `getAllOrders`) để lấy list active orders cho branch, build map `orderByTableSlug`, truyền vào `TableCard` làm fallback khi local session trống. Polling 3s cùng nhịp với `useTables`.

**Tech Stack:** React 18, TanStack Query v5, TypeScript, Vitest, react-testing-library, Zustand.

## Global Constraints

- Test framework: Vitest. Chạy: `npx vitest run <path>` từ `/Users/phanquyetthang/terminal/app/order-ui`.
- Lint: `npm run lint`. Build: `npm run build`.
- Test files đặt ở `src/tests/<mirror-src-path>/<name>.test.ts(x)`.
- Branch: `feature/TT-30-FE-Add-New-User-Roles-and-Implement-Permission-Mapping` — đang chứa nhiều WIP, mỗi commit phải scope chính xác file của task. Dùng `git add` với explicit path.
- TypeScript strict; no `any` outside narrow well-justified casts.
- `useOrders` hook ở `src/hooks/use-order.ts:57` hiện không nhận options — Task 1 mở rộng nhưng giữ backward compat (params mới optional).
- KHÔNG đụng các flow ngoài scope: client-side cart, voucher sheets, admin-cart-content, table-payment-screen, owner-sync hook.

## File Structure

**Modify:**
- `src/hooks/use-order.ts` (line 57-64): mở rộng `useOrders` chấp nhận options `{ refetchInterval, enabled }`. Thêm hook mới `useActiveOrdersByBranch(branch, options)` wrap `useOrders` với query params cố định.
- `src/components/staff/table-card.tsx`: thêm prop `serverOrder?: IOrder | null` (fallback source). Memo deriv logic: ưu tiên `session`, fallback `serverOrder`, cuối cùng zero.
- `src/components/staff/floor-plan.tsx`: thêm prop `serverOrders?: Record<string, IOrder>`, cập nhật occupancy count + pass `serverOrders[t.id]` xuống TableCard.
- `src/app/staff/floor-plan.tsx`: gọi `useActiveOrdersByBranch(branch, { refetchInterval: 3_000 })`, build map theo `o.table.slug`, pass xuống `FloorPlan`. **(staff `/staff` route)**
- `src/components/app/tabs/system-menu.tabs.tsx`: cùng pattern như `app/staff/floor-plan.tsx` — gọi `useActiveOrdersByBranch`, build map, pass xuống `FloorPlan` tab "Bàn". **(admin `/system/menu?tab=table` route)**

**Create:**
- `src/tests/hooks/use-active-orders-by-branch.test.tsx` (mới): unit test cho hook mới.
- `src/tests/components/staff/table-card-server-order.test.tsx` (mới): test TableCard render với `serverOrder` prop (no session).

**NOT touched:**
- `src/api/order.ts` (`getAllOrders` không đổi)
- `src/types/order.type.ts` (`IOrdersQuery` không đổi)
- `src/stores/table-sessions.store.ts` (Zustand session vẫn là source ưu tiên)
- `src/hooks/use-table.ts` (`useTables` không đổi)

---

## Task 1: Mở rộng `useOrders` + thêm `useActiveOrdersByBranch` hook

**Files:**
- Modify: `src/hooks/use-order.ts` (line 57-64)
- Test: `src/tests/hooks/use-active-orders-by-branch.test.tsx` (mới)

**Interfaces:**
- Produces:
  - `useOrders(q: IOrdersQuery, options?: { refetchInterval?: number; enabled?: boolean })` — backward compat (options optional).
  - `useActiveOrdersByBranch(branch: string | undefined, options?: { refetchInterval?: number }): UseQueryResult<IPaginationResponse<IOrder>>`
    - Internally calls `useOrders({ branch, status: 'pending', hasPaging: false, page: 1, size: 200, order: 'DESC' }, options)`.
    - Disabled when `branch` is empty.

- [ ] **Step 1: Write the failing test**

Tạo `src/tests/hooks/use-active-orders-by-branch.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { useActiveOrdersByBranch } from '@/hooks/use-order'

const getAllOrdersMock = vi.fn()

vi.mock('@/api/order', async () => {
  const actual = await vi.importActual<typeof import('@/api/order')>(
    '@/api/order',
  )
  return {
    ...actual,
    getAllOrders: (...args: unknown[]) => getAllOrdersMock(...args),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useActiveOrdersByBranch', () => {
  beforeEach(() => {
    getAllOrdersMock.mockReset()
    getAllOrdersMock.mockResolvedValue({
      result: { items: [], totalPages: 1, total: 0 },
    })
  })

  it('calls getAllOrders with branch + status=pending + hasPaging=false', async () => {
    renderHook(() => useActiveOrdersByBranch('branch-1'), { wrapper })
    await waitFor(() => {
      expect(getAllOrdersMock).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'branch-1',
          status: 'pending',
          hasPaging: false,
        }),
      )
    })
  })

  it('does not fetch when branch is empty', async () => {
    renderHook(() => useActiveOrdersByBranch(''), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(getAllOrdersMock).not.toHaveBeenCalled()
  })

  it('does not fetch when branch is undefined', async () => {
    renderHook(() => useActiveOrdersByBranch(undefined), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(getAllOrdersMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/hooks/use-active-orders-by-branch.test.tsx
```

Expected: FAIL — `Cannot find name 'useActiveOrdersByBranch'` hoặc `Failed to resolve import`.

- [ ] **Step 3: Mở rộng `useOrders` + thêm `useActiveOrdersByBranch`**

Trong `src/hooks/use-order.ts`, replace block `useOrders` (line 57-64):

```ts
export const useOrders = (
  q: IOrdersQuery,
  options?: { refetchInterval?: number; enabled?: boolean },
) => {
  return useQuery({
    queryKey: [...QUERYKEY.orders, q],
    queryFn: () => getAllOrders(q),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  })
}

/**
 * Fetch active (status=pending) orders for a branch. Used by the floor plan
 * to derive cross-device order info on TableCard. Disabled when `branch` is
 * empty (no-op render before user info loads).
 */
export const useActiveOrdersByBranch = (
  branch: string | undefined,
  options?: { refetchInterval?: number },
) => {
  const safeBranch = branch ?? ''
  return useOrders(
    {
      branch: safeBranch,
      status: 'pending',
      hasPaging: false,
      page: 1,
      size: 200,
      order: 'DESC',
    },
    {
      refetchInterval: options?.refetchInterval,
      enabled: !!safeBranch,
    },
  )
}
```

Lưu ý:
- `useOrders` thêm 2 option mới — both optional, callers cũ không vỡ.
- `useActiveOrdersByBranch` đặt `enabled: !!safeBranch` để skip fetch khi chưa có branch.
- `size: 200` — assume max 200 active orders per branch tại 1 thời điểm. Nếu vượt, BE phải hỗ trợ pagination hoặc nâng giới hạn.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/hooks/use-active-orders-by-branch.test.tsx
```

Expected: PASS 3/3.

- [ ] **Step 5: Run lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 6: Commit**

Explicit paths:

```bash
git add src/hooks/use-order.ts src/tests/hooks/use-active-orders-by-branch.test.tsx
git commit -m "feat(hooks): add useActiveOrdersByBranch for floor plan cross-device sync"
```

Verify 2 files via `git status`.

---

## Task 2: Mở rộng `TableCard` để fallback từ `serverOrder`

**Files:**
- Modify: `src/components/staff/table-card.tsx` (line 7-92)
- Test: `src/tests/components/staff/table-card-server-order.test.tsx` (mới)

**Interfaces:**
- Consumes: `IOrder` từ `@/types` (đã import sẵn ở nhiều chỗ).
- Produces: `TableCard` accepts optional prop `serverOrder?: IOrder | null`. Khi `session` trống/empty/done VÀ `serverOrder` có → render `itemCount` + `total` từ `serverOrder.orderItems`/`serverOrder.subtotal`, badge "Có khách".

- [ ] **Step 1: Write the failing test**

Tạo `src/tests/components/staff/table-card-server-order.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TableCard } from '@/components/staff/table-card'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'

const baseTable: Table = {
  id: 't1',
  label: 'Bàn 1',
  seats: 4,
  status: 'reserved',
}

const baseOrder = {
  slug: 'order-1',
  status: 'pending',
  subtotal: 150_000,
  orderItems: [
    { quantity: 2 },
    { quantity: 1 },
  ],
  table: { slug: 't1' },
} as unknown as IOrder

describe('TableCard — serverOrder fallback', () => {
  it('derives itemCount and total from serverOrder when no local session', () => {
    render(
      <TableCard
        table={baseTable}
        session={undefined}
        serverOrder={baseOrder}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('3 món')).toBeInTheDocument()
    expect(screen.getByText(/150\.000/)).toBeInTheDocument()
    expect(screen.getByText('Có khách')).toBeInTheDocument()
  })

  it('prefers local session over serverOrder when both present', () => {
    render(
      <TableCard
        table={baseTable}
        session={
          {
            status: 'serving',
            tableName: 'Bàn 1',
            pendingItems: [
              { quantity: 5, priceNum: 10_000 } as never,
            ],
            submittedOrders: [],
          } as never
        }
        serverOrder={baseOrder}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('5 món')).toBeInTheDocument()
    expect(screen.getByText(/50\.000/)).toBeInTheDocument()
  })

  it('shows empty seats when neither session nor serverOrder is present', () => {
    render(
      <TableCard
        table={{ ...baseTable, status: 'available' }}
        session={undefined}
        serverOrder={null}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('4 chỗ')).toBeInTheDocument()
    expect(screen.getByText('Trống')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/components/staff/table-card-server-order.test.tsx
```

Expected: FAIL — `Property 'serverOrder' does not exist on type` (TS error) hoặc assertions không khớp.

- [ ] **Step 3: Implement `serverOrder` prop**

Trong `src/components/staff/table-card.tsx`, replace toàn bộ component:

```tsx
import { useMemo, memo } from 'react'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'
import { formatVnd } from '@/data/staff-data'
import { Button } from '../ui'

interface Props {
  table: Table
  session: TableSession | undefined
  /** Active order from BE (cross-device source). Fallback when local session
   *  is empty — gives nhân viên khác thấy số món + tổng tiền dù máy này không
   *  phải máy đặt đơn. */
  serverOrder?: IOrder | null
  onClick: (tableId: string) => void
}

function TableCardComponent({ table, session, serverOrder, onClick }: Props) {
  const localStatus = session?.status
  const isLocalActive = !!session && localStatus !== 'empty' && localStatus !== 'done'
  const isServerActive = table.status === 'reserved' || !!serverOrder
  const isActive = isServerActive || isLocalActive
  const status: TableSession['status'] | 'occupied' = isLocalActive
    ? (localStatus as TableSession['status'])
    : isServerActive
      ? 'occupied'
      : 'empty'

  const { itemCount, total } = useMemo(() => {
    if (isLocalActive && session) {
      const pendingCount = session.pendingItems.reduce((s, i) => s + i.quantity, 0)
      const submittedCount = session.submittedOrders.reduce(
        (s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0),
        0,
      )
      const pendingTotal = session.pendingItems.reduce(
        (s, i) => s + i.priceNum * i.quantity,
        0,
      )
      const submittedTotal = session.submittedOrders.reduce(
        (s, o) =>
          s + o.items.reduce((ss, i) => ss + i.priceNum * i.quantity, 0),
        0,
      )
      return {
        itemCount: pendingCount + submittedCount,
        total: pendingTotal + submittedTotal,
      }
    }
    if (serverOrder) {
      const itemCount =
        serverOrder.orderItems?.reduce(
          (s, i) => s + (i.quantity ?? 0),
          0,
        ) ?? 0
      const total = serverOrder.subtotal ?? 0
      return { itemCount, total }
    }
    return { itemCount: 0, total: 0 }
  }, [isLocalActive, session, serverOrder])

  const borderClass =
    status === 'serving'
      ? 'border-pos-gold'
      : status === 'waiting_payment'
        ? 'border-orange-500'
        : status === 'occupied'
          ? 'border-pos-gold'
          : 'border-pos-border'

  const badgeClass =
    status === 'serving'
      ? 'bg-pos-gold text-white'
      : status === 'waiting_payment'
        ? 'bg-orange-500 text-white'
        : status === 'occupied'
          ? 'bg-pos-gold text-white'
          : 'bg-pos-border text-pos-dim'

  const badgeLabel =
    status === 'serving'
      ? 'Đang phục vụ'
      : status === 'waiting_payment'
        ? 'Chờ thanh toán'
        : status === 'occupied'
          ? 'Có khách'
          : 'Trống'

  return (
    <Button
      onClick={() => onClick(table.id)}
      data-testid="table-card"
      className={`flex flex-col items-start gap-2 rounded-lg border shadow-none ${borderClass} bg-pos-card p-4 min-h-24 text-left transition hover:bg-pos-elevated focus:outline-none focus:ring-2 focus:ring-pos-gold`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-base font-semibold text-pos-text">{table.label}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
        >
          {badgeLabel}
        </span>
      </div>
      {isActive ? (
        <div className="text-xs text-pos-muted">
          <div>{itemCount} món</div>
          <div className="text-pos-gold">{formatVnd(total)}</div>
        </div>
      ) : (
        <span className="text-xs text-pos-dim">{table.seats} chỗ</span>
      )}
    </Button>
  )
}

export const TableCard = memo(TableCardComponent)
```

Thay đổi quan trọng so với bản cũ:
- Thêm prop `serverOrder` (optional).
- `isServerActive` giờ TRUE khi `table.status === 'reserved'` **hoặc** `serverOrder` có giá trị (đề phòng BE chưa kịp set status `reserved` mà đơn đã tồn tại).
- `useMemo` ưu tiên: `isLocalActive` → local calc; sau đó `serverOrder` → BE calc; cuối cùng zero.
- `borderClass`, `badgeClass`, `badgeLabel` không đổi.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/components/staff/table-card-server-order.test.tsx
```

Expected: PASS 3/3.

- [ ] **Step 5: Run existing TableCard test**

```bash
npx vitest run src/tests/components/staff/table-card.test.tsx
```

Expected: PASS — existing tests gọi TableCard chưa truyền `serverOrder`, hành vi backward compat.

- [ ] **Step 6: Run lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/staff/table-card.tsx src/tests/components/staff/table-card-server-order.test.tsx
git commit -m "feat(staff): TableCard fallback to serverOrder when local session empty"
```

---

## Task 3: Cập nhật `FloorPlan` component nhận `serverOrders` map

**Files:**
- Modify: `src/components/staff/floor-plan.tsx` (full file)

**Interfaces:**
- Consumes: `TableCard.serverOrder` từ Task 2.
- Produces: `FloorPlan` accepts `serverOrders?: Record<string, IOrder>` prop. Occupancy count cộng cả `tables` có server order, pass xuống `TableCard`.

- [ ] **Step 1: Đọc state hiện tại**

```bash
cat /Users/phanquyetthang/terminal/app/order-ui/src/components/staff/floor-plan.tsx
```

Component hiện đếm occupied dựa trên `t.status === 'reserved'` HOẶC local session active. Logic mới: nếu `serverOrders[t.id]` có → cũng occupied.

- [ ] **Step 2: Implement**

Replace toàn bộ `src/components/staff/floor-plan.tsx`:

```tsx
import { TableCard } from './table-card'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'

interface Props {
  tables: Table[]
  sessions: Record<string, TableSession>
  /** Map of tableSlug → active server order. Used by TableCard to derive
   *  cross-device order info (số món + tổng tiền) khi local session trống. */
  serverOrders?: Record<string, IOrder>
  onTableClick: (tableId: string) => void
}

export function FloorPlan({ tables, sessions, serverOrders, onTableClick }: Props) {
  const total = tables.length
  // Occupancy precedence: local active session > server `t.status === 'reserved'`
  // > existence of server order for this table.
  let occupied = 0
  for (const t of tables) {
    const isServerOccupied = t.status === 'reserved'
    const hasServerOrder = !!serverOrders?.[t.id]
    const localStatus = sessions[t.id]?.status
    const isLocalOccupied =
      localStatus === 'serving' || localStatus === 'waiting_payment'
    if (
      isServerOccupied ||
      hasServerOrder ||
      (t.status === undefined && isLocalOccupied)
    ) {
      occupied++
    }
  }
  const empty = total - occupied

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Tổng số" value={total} testId="stat-total" />
        <Stat label="Có khách" value={occupied} testId="stat-occupied" accent="text-yellow-400" />
        <Stat label="Trống" value={empty} testId="stat-empty" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => (
          <TableCard
            key={t.id}
            table={t}
            session={sessions[t.id]}
            serverOrder={serverOrders?.[t.id] ?? null}
            onClick={onTableClick}
          />
        ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  testId,
  accent,
}: {
  label: string
  value: number
  testId: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-pos-border bg-pos-surface p-4">
      <div className="text-xs uppercase tracking-wide text-pos-muted">{label}</div>
      <div
        data-testid={testId}
        className={`mt-1 text-2xl font-bold ${accent ?? 'text-pos-text'}`}
      >
        {value}
      </div>
    </div>
  )
}
```

Thay đổi:
- Thêm prop `serverOrders` (optional).
- Occupancy count thêm condition `hasServerOrder`.
- Pass `serverOrder={serverOrders?.[t.id] ?? null}` xuống TableCard.

- [ ] **Step 3: Run existing FloorPlan tests**

```bash
npx vitest run src/tests/components/staff/floor-plan.test.tsx
```

Expected: PASS — tests cũ không pass `serverOrders`, hành vi backward compat (default occupancy chỉ dựa `t.status` + local session).

- [ ] **Step 4: Run lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/floor-plan.tsx
git commit -m "feat(staff): FloorPlan accepts serverOrders map for cross-device occupancy"
```

---

## Task 4: Wire `useActiveOrdersByBranch` vào `StaffFloorPlanPage`

**Files:**
- Modify: `src/app/staff/floor-plan.tsx` (full file)

**Interfaces:**
- Consumes: `useActiveOrdersByBranch` từ Task 1, `FloorPlan.serverOrders` từ Task 3.

- [ ] **Step 1: Implement**

Replace `src/app/staff/floor-plan.tsx`:

```tsx
import { useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FloorPlan } from '@/components/staff/floor-plan'
import { useTableSessions } from '@/hooks/useTableSessions'
import { useActiveOrdersByBranch, useTables } from '@/hooks'
import { useUserStore } from '@/stores'
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'

export default function StaffFloorPlanPage() {
  const navigate = useNavigate()
  const { sessions, openSession } = useTableSessions()
  const { userInfo } = useUserStore()
  const branchSlug = userInfo?.branch?.slug ?? ''
  const { data: tablesData } = useTables(branchSlug, { refetchInterval: 3_000 })
  const { data: activeOrders } = useActiveOrdersByBranch(branchSlug, {
    refetchInterval: 3_000,
  })

  const tables: Table[] = useMemo(
    () =>
      (tablesData?.result ?? []).map((t) => ({
        id: t.slug,
        label: t.name,
        seats: 4,
        status: t.status as Table['status'],
      })),
    [tablesData],
  )

  const serverOrders = useMemo(() => {
    const map: Record<string, IOrder> = {}
    const items = activeOrders?.items ?? []
    for (const o of items) {
      const tableSlug = o.table?.slug
      if (tableSlug) map[tableSlug] = o
    }
    return map
  }, [activeOrders])

  // Refs so handleTableClick can read latest sessions/tables without listing
  // them as useCallback deps. Without this, the callback identity flips on
  // every order mutation or table refetch, defeating React.memo on TableCard.
  const sessionsRef = useRef(sessions)
  const tablesRef = useRef(tables)
  sessionsRef.current = sessions
  tablesRef.current = tables

  const handleTableClick = useCallback(
    (tableId: string) => {
      const s = sessionsRef.current[tableId]
      if (!s || s.status === 'empty' || s.status === 'done') {
        const name = tablesRef.current.find((t) => t.id === tableId)?.label ?? tableId
        openSession(tableId, name)
        navigate(`/staff/table/${tableId}`)
      } else if (s.status === 'waiting_payment') {
        navigate(`/staff/table/${tableId}/payment`)
      } else {
        navigate(`/staff/table/${tableId}`)
      }
    },
    [openSession, navigate],
  )

  return (
    <div className="bg-pos-bg text-pos-text">
      <main className="mx-auto max-w-6xl px-2 py-4">
        <FloorPlan
          tables={tables}
          sessions={sessions}
          serverOrders={serverOrders}
          onTableClick={handleTableClick}
        />
      </main>
    </div>
  )
}
```

Thay đổi:
- Thêm `useActiveOrdersByBranch(branchSlug, { refetchInterval: 3_000 })`.
- Thêm `serverOrders` map memo build từ `activeOrders.items`.
- Pass `serverOrders` xuống `FloorPlan`.
- Giữ nguyên `handleTableClick` (vẫn dùng local session để route quyết định payment vs order).

Lưu ý quan trọng: nếu user click vào bàn có `serverOrder` nhưng KHÔNG có local session → handler sẽ gọi `openSession` (tạo session mới empty) rồi navigate đến `table-order-screen`. `table-order-screen` có reconcile effect tự sync từ `useGetActiveOrderByTable`. Hành vi đó vẫn đúng.

- [ ] **Step 2: Verify `useActiveOrdersByBranch` xuất từ `@/hooks` index**

```bash
grep -n "useActiveOrdersByBranch\|useOrders\b" /Users/phanquyetthang/terminal/app/order-ui/src/hooks/index.ts
```

Nếu `useOrders` đã có ở index → kỳ vọng `useActiveOrdersByBranch` cũng tự export qua `export *`. Nếu index có chọn lọc → thêm tay vào index.ts. Verify import path.

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 4: Run focused test**

```bash
npx vitest run src/tests/components/staff src/tests/hooks
```

Expected: tất cả PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/staff/floor-plan.tsx
git commit -m "fix(staff): floor plan fetches active orders to show cross-device order info"
```

---

## Task 4b: Wire `useActiveOrdersByBranch` vào admin `/system/menu` tab "Bàn"

**Files:**
- Modify: `src/components/app/tabs/system-menu.tabs.tsx` (line 1-40 imports + line 24-26 + line 135)

**Interfaces:**
- Consumes: `useActiveOrdersByBranch` từ Task 1, `FloorPlan.serverOrders` prop từ Task 3.

Đây là route admin (`/system/menu?tab=table`). Component này render cùng `<FloorPlan />` như staff page nhưng hiện đang KHÔNG pass `serverOrders` → admin/cashier cũng gặp bug y hệt staff. Task này wire vào để fix đồng đều cả 2 route.

- [ ] **Step 1: Đọc file**

```bash
sed -n '1,50p' /Users/phanquyetthang/terminal/app/order-ui/src/components/app/tabs/system-menu.tabs.tsx
```

Xác định:
- Line 12: import `useTables` từ `@/hooks`.
- Line 24-26: `useTables(userInfo?.branch?.slug ?? '', { refetchInterval: 3_000 })` — đã có pattern poll 3s.
- Line 135: `<FloorPlan tables={tables} sessions={sessions} onTableClick={handleAdminTableClick} />` — chưa pass `serverOrders`.

- [ ] **Step 2: Thêm import**

Trong import statement (line 12):

```ts
import { useActiveOrdersByBranch, useSpecificMenu, useTables } from '@/hooks'
```

Thêm import IOrder ở cuối block import types:

```ts
import type { Table } from '@/data/staff-data'
import type { IOrder } from '@/types'
```

- [ ] **Step 3: Gọi hook + build map**

Ngay sau khối `const { data: tablesData } = useTables(...)` (~line 24-26), thêm:

```ts
const { data: activeOrders } = useActiveOrdersByBranch(
  userInfo?.branch?.slug ?? '',
  { refetchInterval: 3_000 },
)

const serverOrders = useMemo(() => {
  const map: Record<string, IOrder> = {}
  const items = activeOrders?.items ?? []
  for (const o of items) {
    const tableSlug = o.table?.slug
    if (tableSlug) map[tableSlug] = o
  }
  return map
}, [activeOrders])
```

- [ ] **Step 4: Pass `serverOrders` xuống FloorPlan**

Tìm `<FloorPlan ... />` (~line 135) và thay:

```tsx
<FloorPlan
  tables={tables}
  sessions={sessions}
  serverOrders={serverOrders}
  onTableClick={handleAdminTableClick}
/>
```

- [ ] **Step 5: Run lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no new errors.

- [ ] **Step 6: Run focused tests**

```bash
npx vitest run src/tests
```

Expected: tất cả PASS — không có test nào trực tiếp cho file này nên không phá tests khác.

- [ ] **Step 7: Commit**

```bash
git add src/components/app/tabs/system-menu.tabs.tsx
git commit -m "fix(admin): /system/menu tab Bàn fetches active orders for cross-device sync"
```

---

## Task 5: End-to-end manual verification

**Files:** không sửa code.

- [ ] **Step 1: Full test suite + build**

```bash
npm run test
npm run build
```

Expected: tất cả PASS, build OK.

- [ ] **Step 2: Repro bug + verify fix (single device)**

```bash
npm run dev
```

Trên browser:
1. Login role staff.
2. Vào `/staff` (floor plan) — quan sát: bàn có `status: reserved` từ BE phải hiển thị badge "Có khách" + số món + tổng tiền (kể cả bàn chưa từng có session local).
3. Network tab: thấy 2 request mỗi 3s: `GET /tables?branch=...` và `GET /orders?branch=...&status=pending&hasPaging=false`.

- [ ] **Step 3: Verify cross-device — `/staff` route**

Mở 2 browser khác nhau (hoặc 1 thường + 1 incognito), login 2 nhân viên khác nhau cùng branch.

1. NV1 đặt đơn cho bàn X (thêm món, tạo order).
2. NV2 đứng ở `/staff` floor plan, đợi tối đa 3s.
3. Quan sát NV2's floor plan: bàn X chuyển sang "Có khách" + số món + tổng tiền HIỂN THỊ ĐÚNG.

- [ ] **Step 3b: Verify cross-device — `/system/menu?tab=table` route (admin)**

Admin login máy khác, vào `/system/menu`, chuyển sang tab "Bàn".

1. Quan sát: tab Bàn hiển thị floor plan giống `/staff`.
2. Network tab: thấy `GET /tables?branch=...` + `GET /orders?branch=...&status=pending&hasPaging=false` poll 3s/lần.
3. Lặp lại Step 3: NV1 đặt đơn bàn X → admin tab Bàn refresh trong 3s thấy bàn X có số món + tổng tiền.

So sánh: cả 2 route phải có hành vi giống nhau.

- [ ] **Step 4: Verify priority — local session > serverOrder**

1. NV1 đang ở floor plan, đã có local session "serving" cho bàn X (đặt thêm 1 món chưa submit).
2. Floor plan của NV1 hiển thị số món/tổng từ LOCAL (bao gồm cả pending chưa submit).
3. NV2 chỉ thấy số/tổng từ BE (chỉ submitted).
4. Sau khi NV1 submit → BE update → NV2's polling 3s thấy đầy đủ.

- [ ] **Step 5: Verify empty path**

1. Bàn Y chưa có đơn, status `available`, không có serverOrder, no local session.
2. TableCard hiển thị "Trống" + "X chỗ" — như cũ.

- [ ] **Step 6: Verify khi user click bàn có serverOrder + no local session**

1. NV2 click bàn X (có serverOrder, no session).
2. Handler `openSession` tạo session empty → navigate `/staff/table/{id}`.
3. `table-order-screen` mount → reconcile effect (existing) sync từ `useGetActiveOrderByTable` → session đầy đủ với orderSlug + submittedOrders.
4. Quay lại `/staff` — bàn X giờ có local session "serving", hiển thị từ local.

- [ ] **Step 7: Verify performance**

DevTools → Performance → Network tab:
- 2 polling request/3s mỗi máy → tải BE chấp nhận được.
- Response của `useActiveOrdersByBranch` có thể lớn nếu branch nhiều bàn active — verify response size <100KB cho 50 bàn. Nếu lớn, cân nhắc BE thêm slim DTO cho list endpoint.

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Bug "nhân viên 2 thấy bàn reserved nhưng không thấy đơn" → Task 4 (wire `/staff`) + Task 4b (wire `/system/menu`) + Task 2-3 (UI fallback)
- ✅ Cả 2 route dùng cùng `<FloorPlan />` component → Task 3 fix một chỗ áp dụng cả hai
- ✅ Polling đồng nhịp 3s với /tables → Task 4 + 4b
- ✅ Backward compat: local session ưu tiên → Task 2 useMemo logic
- ✅ Tests: hook + TableCard fallback → Task 1, 2
- ✅ Manual cross-device verify cho cả 2 route → Task 5 Step 3 + 3b

**2. Placeholder scan:** đã rà — không có TBD/TODO. Mỗi step có code/command cụ thể.

**3. Type consistency:**
- `useActiveOrdersByBranch(branch: string | undefined, options?: { refetchInterval?: number })` — Task 1, dùng Task 4.
- `serverOrder?: IOrder | null` — Task 2 prop, truyền từ Task 3 component.
- `serverOrders?: Record<string, IOrder>` — Task 3 prop, build ở Task 4.
- `IOrder` từ `@/types` — verified import path trong Task 2.

**4. Out-of-scope guards:**
- Không đụng `useTables`, `useGetActiveOrderByTable`, `table-order-screen` reconcile effect, voucher sheets, owner-sync hook.
- Không đụng BE API.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-floor-plan-cross-device-order-sync.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch implementer per task, 2-stage review giữa các task. Theo memory feedback của bạn.

**2. Inline Execution** — Tuần tự trong session này qua `superpowers:executing-plans`, checkpoint sau Task 1, 4, 5.

Chọn approach nào?
