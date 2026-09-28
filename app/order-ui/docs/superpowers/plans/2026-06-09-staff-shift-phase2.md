# Staff Shift Phase 2 — Staff History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 2 cho staff role — lịch sử ca + chi tiết ca + orders trong ca. Refactor trang `/staff/my-shift` từ mock data sang real API.

**Architecture:** Mở rộng `api/staff-shift.ts` + hooks với 3 endpoints mới (list + detail + orders). Tạo 2 trang mới (`/staff/my-shifts` list, `/staff/my-shifts/:slug` detail). Refactor `/staff/my-shift` cũ (mock dashboard với 3-shift toggle) thành redirect tới list page — preserve URL nhưng đổi content. Light theme matching /system pattern (Card-based) inside POS layout.

**Tech Stack:** React 18, TanStack Query v5, shadcn UI (Card, Table-ish, Input date), react-router-dom v6, Vitest + Testing Library, TypeScript.

**Out of scope (Phase 3+):**
- Manager dashboard (active staff realtime, all-shifts history table, stats by-staff / by-date)
- Excel export
- Multi-branch picker (admin only)
- POINT payment / loyalty

---

## Endpoint coverage (from BE doc)

Phase 2 uses these endpoints (all STAFF role):

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /staff-shifts?startDate&endDate&status&page&size` | GET | List my shifts with filters |
| `GET /staff-shifts/:slug` | GET | Single shift detail |
| `GET /staff-shifts/:slug/orders` | GET | Orders inside a specific shift |
| `GET /staff-shifts/current/orders` | GET | Orders inside CURRENT shift (nice-to-have on indicator dropdown — defer) |

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/staff-shift.type.ts` | Modify | Add `IStaffShiftListQuery`, `IStaffShiftWithOrders` types |
| `src/api/staff-shift.ts` | Modify | Add `getMyStaffShifts(query)`, `getStaffShiftBySlug(slug)`, `getStaffShiftOrders(slug)` |
| `src/hooks/use-staff-shift.ts` | Modify | Add `useMyStaffShifts(query)`, `useStaffShiftBySlug(slug)`, `useStaffShiftOrders(slug)` |
| `src/constants/query.ts` | Modify | Add 3 new QUERYKEYs |
| `src/constants/route.ts` | Modify | Add `STAFF_MY_SHIFTS_HISTORY` + `STAFF_MY_SHIFT_DETAIL` |
| `src/app/staff/my-shifts/page.tsx` | Create | History list page with filters + cards |
| `src/app/staff/my-shifts/[slug]/page.tsx` | Create | Single shift detail page |
| `src/app/staff/my-shift.tsx` | Modify (replace content) | Refactor: redirect old mock dashboard → new history page |
| `src/router/loadable.tsx` | Modify | Lazy imports for new pages |
| `src/router/index.tsx` | Modify | Add 2 new routes inside StaffPosLayout |
| `src/components/staff/shift-history-card.tsx` | Create | Reusable card for shift in list |
| `src/components/staff/shift-detail-summary.tsx` | Create | Reusable summary stats block for detail page |
| `src/components/staff/shift-orders-list.tsx` | Create | List of orders within a shift |
| `src/lib/__tests__/staff-shift-helpers.test.ts` | Modify | +tests for `buildShiftListQuery` if added |

---

### Task 1: Extend types

**Files:**
- Modify: `src/types/staff-shift.type.ts`

- [ ] **Step 1: Add list query + list response types**

In `src/types/staff-shift.type.ts`, append:

```ts
export interface IStaffShiftListQuery {
  startDate?: string  // ISO date
  endDate?: string    // ISO date
  status?: StaffShiftStatus
  page?: number
  size?: number
}
```

The list endpoint returns `IApiResponse<IPaginationResponse<IStaffShift>>` — already covered by existing types.

For `/staff-shifts/:slug/orders` response shape (from doc):
```
{ shift: StaffShiftResponseDto, orders: [OrderResponseDto] }
```

Add:
```ts
import type { IOrder } from './dish.type'

export interface IStaffShiftWithOrders {
  shift: IStaffShift
  orders: IOrder[]
}
```

If importing `IOrder` from `./dish.type` creates a circular dep, use `import type` (which it should be, since types are erased).

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean.

---

### Task 2: API functions

**Files:**
- Modify: `src/api/staff-shift.ts`

- [ ] **Step 1: Add 3 functions**

In `src/api/staff-shift.ts`, append (after existing functions):

```ts
import type {
  IPaginationResponse,
  IStaffShiftListQuery,
  IStaffShiftWithOrders,
} from '@/types'

export async function getMyStaffShifts(
  query: IStaffShiftListQuery,
): Promise<IApiResponse<IPaginationResponse<IStaffShift>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<IStaffShift>>>(
    '/staff-shifts',
    { params: query, doNotShowLoading: true },
  )
  return response.data
}

export async function getStaffShiftBySlug(
  slug: string,
): Promise<IApiResponse<IStaffShift>> {
  const response = await http.get<IApiResponse<IStaffShift>>(
    `/staff-shifts/${slug}`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getStaffShiftOrders(
  slug: string,
): Promise<IApiResponse<IStaffShiftWithOrders>> {
  const response = await http.get<IApiResponse<IStaffShiftWithOrders>>(
    `/staff-shifts/${slug}/orders`,
    { doNotShowLoading: true },
  )
  return response.data
}
```

Fold `IPaginationResponse`, `IStaffShiftListQuery`, `IStaffShiftWithOrders` into the existing `@/types` import line.

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/api/staff-shift.ts 2>&1 | head -5`
Expected: clean.

---

### Task 3: Hooks + QUERYKEYs

**Files:**
- Modify: `src/constants/query.ts`
- Modify: `src/hooks/use-staff-shift.ts`

- [ ] **Step 1: Add QUERYKEYs**

In `src/constants/query.ts`, find the QUERYKEY object. After `currentStaffShift: ['currentStaffShift'],` (added in Phase 1), add:

```ts
  myStaffShifts: ['myStaffShifts'],
  staffShiftBySlug: ['staffShiftBySlug'],
  staffShiftOrders: ['staffShiftOrders'],
```

- [ ] **Step 2: Add hooks**

In `src/hooks/use-staff-shift.ts`, append (after existing Phase 1 hooks):

```ts
import { keepPreviousData } from '@tanstack/react-query'
import {
  getMyStaffShifts,
  getStaffShiftBySlug,
  getStaffShiftOrders,
} from '@/api/staff-shift'
import type { IStaffShiftListQuery } from '@/types'

export const useMyStaffShifts = (query: IStaffShiftListQuery) => {
  return useQuery({
    queryKey: [...QUERYKEY.myStaffShifts, query],
    queryFn: () => getMyStaffShifts(query),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

export const useStaffShiftBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.staffShiftBySlug, slug],
    queryFn: () => getStaffShiftBySlug(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

export const useStaffShiftOrders = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.staffShiftOrders, slug],
    queryFn: () => getStaffShiftOrders(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}
```

Fold the new API + type imports into existing import lines if possible.

- [ ] **Step 3: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/hooks/use-staff-shift.ts 2>&1 | head -5`
Run: `npx vitest run 2>&1 | tail -5`
Expected: clean + all tests pass.

---

### Task 4: Routes + lazy imports

**Files:**
- Modify: `src/constants/route.ts`
- Modify: `src/router/loadable.tsx`
- Modify: `src/router/index.tsx`

- [ ] **Step 1: Add route constants**

In `src/constants/route.ts`, find `STAFF_POS_MY_SHIFT: '/staff/my-shift',`. Add 2 new entries:

```ts
  STAFF_MY_SHIFTS_HISTORY: '/staff/my-shifts',
  STAFF_MY_SHIFT_DETAIL: '/staff/my-shifts/:slug',
```

- [ ] **Step 2: Add lazy imports**

In `src/router/loadable.tsx`, find existing `StaffMyShiftPage` lazy export. Add:

```ts
export const StaffMyShiftsHistoryPage = React.lazy(() =>
  import('@/app/staff/my-shifts/page').then((module) => ({
    default: module.default,
  })),
)

export const StaffMyShiftDetailPage = React.lazy(() =>
  import('@/app/staff/my-shifts/[slug]/page').then((module) => ({
    default: module.default,
  })),
)
```

- [ ] **Step 3: Wire routes**

In `src/router/index.tsx`, find the `StaffPosLayout` block. Near other STAFF_POS_* routes, add:

```tsx
{
  path: ROUTE.STAFF_MY_SHIFTS_HISTORY,
  element: <ProtectedElement element={<SuspenseElement component={StaffMyShiftsHistoryPage} />} />,
},
{
  path: ROUTE.STAFF_MY_SHIFT_DETAIL,
  element: <ProtectedElement element={<SuspenseElement component={StaffMyShiftDetailPage} />} />,
},
```

Also add the imports for new pages at the top of index.tsx (mirror existing pattern).

- [ ] **Step 4: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Expected: errors expected because page files don't exist yet (Task 6 + 7). Verify errors are ONLY about missing page files; other code clean.

---

### Task 5: `ShiftHistoryCard` component

**Files:**
- Create: `src/components/staff/shift-history-card.tsx`

Reusable card for one shift in a list. Click → navigate to detail.

- [ ] **Step 1: Implement**

Create `src/components/staff/shift-history-card.tsx`:

```tsx
import { Calendar, Package, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui'
import { formatShiftDuration } from '@/lib/staff-shift-helpers'
import type { IStaffShift } from '@/types'

interface Props {
  shift: IStaffShift
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

function formatHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function ShiftHistoryCard({ shift }: Props) {
  const navigate = useNavigate()
  return (
    <Card
      className="shadow-none cursor-pointer hover:border-primary transition"
      onClick={() => navigate(`/staff/my-shifts/${shift.slug}`)}
    >
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {formatDate(shift.startTime)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatHHMM(shift.startTime)} → {shift.endTime ? formatHHMM(shift.endTime) : 'Đang mở'}
              {shift.status === 'CLOSED' && ` · ${formatShiftDuration(shift.durationMinutes)}`}
            </div>
          </div>
          <span
            className={
              shift.status === 'CLOSED'
                ? 'rounded px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground'
                : 'rounded px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary'
            }
          >
            {shift.status === 'CLOSED' ? 'Đã đóng' : 'Đang mở'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 text-xs items-center">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Package className="h-3 w-3" />
            {shift.totalOrders} đơn
          </div>
          <div className="text-right font-semibold text-primary">{formatVnd(shift.totalRevenue)}</div>
        </div>
        <div className="mt-2 flex items-center justify-end text-xs text-muted-foreground">
          Chi tiết <ChevronRight className="ml-0.5 h-3 w-3" />
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/shift-history-card.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 6: History list page (`/staff/my-shifts`)

**Files:**
- Create: `src/app/staff/my-shifts/page.tsx`

Page with filters (date range + status) + paginated list of ShiftHistoryCard.

- [ ] **Step 1: Implement**

Create `src/app/staff/my-shifts/page.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button, Input } from '@/components/ui'
import { useMyStaffShifts } from '@/hooks'
import { ShiftHistoryCard } from '@/components/staff/shift-history-card'
import type { StaffShiftStatus } from '@/types'

export default function StaffMyShiftsHistoryPage() {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [status, setStatus] = useState<StaffShiftStatus | ''>('')
  const [page, setPage] = useState<number>(1)

  const query = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status: (status || undefined) as StaffShiftStatus | undefined,
      page,
      size: 10,
    }),
    [startDate, endDate, status, page],
  )

  const { data, isLoading } = useMyStaffShifts(query)
  const shifts = data?.items ?? []
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/staff')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Sơ đồ bàn
        </Button>
        <h1 className="text-base font-bold">Lịch sử ca của tôi</h1>
      </div>

      <div className="border-b px-4 py-3 flex flex-wrap gap-2 items-center">
        <Input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
          className="w-40"
          aria-label="Từ ngày"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
          className="w-40"
          aria-label="Đến ngày"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as StaffShiftStatus | ''); setPage(1) }}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          aria-label="Trạng thái"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang mở</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : shifts.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Không có ca nào trong khoảng thời gian này
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl mx-auto">
            {shifts.map((shift) => (
              <ShiftHistoryCard key={shift.slug} shift={shift} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </Button>
            <span className="text-sm text-muted-foreground">
              Trang {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/app/staff/my-shifts/page.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 7: `ShiftDetailSummary` + `ShiftOrdersList` components

**Files:**
- Create: `src/components/staff/shift-detail-summary.tsx`
- Create: `src/components/staff/shift-orders-list.tsx`

- [ ] **Step 1: Implement ShiftDetailSummary**

Create `src/components/staff/shift-detail-summary.tsx`:

```tsx
import { Package, Wallet, FileText } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { formatShiftDuration } from '@/lib/staff-shift-helpers'
import type { IStaffShift } from '@/types'

interface Props {
  shift: IStaffShift
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Đang mở'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ShiftDetailSummary({ shift }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Đơn xử lý</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shift.totalOrders}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none bg-primary text-white">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-bold">Doanh thu</CardTitle>
            <Wallet className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatVnd(shift.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Thời gian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatShiftDuration(shift.durationMinutes)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatDateTime(shift.startTime)} → {formatDateTime(shift.endTime)}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tiền mặt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">
              {formatVnd(shift.openingCash ?? 0)} → {formatVnd(shift.closingCash ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>
      {shift.note && (
        <Card className="shadow-none">
          <CardHeader className="flex flex-row gap-2 items-center pb-2 space-y-0">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{shift.note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement ShiftOrdersList**

Create `src/components/staff/shift-orders-list.tsx`:

```tsx
import { Package } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import type { IOrder } from '@/types'

interface Props {
  orders: IOrder[]
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

function formatHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ShiftOrdersList({ orders }: Props) {
  if (orders.length === 0) {
    return (
      <Card className="shadow-none">
        <CardContent className="text-center text-sm text-muted-foreground py-8">
          Ca này chưa có đơn nào
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          {orders.length} đơn hàng
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Bàn</th>
                <th className="px-4 py-2 font-medium">Giờ tạo</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
                <th className="px-4 py-2 font-medium text-right">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.slug} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-2 font-semibold">{order.table?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatHHMM(order.createdAt)}</td>
                  <td className="px-4 py-2">
                    <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-primary">
                    {formatVnd(order.subtotal ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/shift-detail-summary.tsx src/components/staff/shift-orders-list.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 8: Detail page (`/staff/my-shifts/:slug`)

**Files:**
- Create: `src/app/staff/my-shifts/[slug]/page.tsx`

- [ ] **Step 1: Implement**

Create `src/app/staff/my-shifts/[slug]/page.tsx`:

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui'
import { useStaffShiftBySlug, useStaffShiftOrders } from '@/hooks'
import { ShiftDetailSummary } from '@/components/staff/shift-detail-summary'
import { ShiftOrdersList } from '@/components/staff/shift-orders-list'

export default function StaffMyShiftDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const { data: shift, isLoading: isShiftLoading } = useStaffShiftBySlug(slug)
  const { data: ordersData, isLoading: isOrdersLoading } = useStaffShiftOrders(slug)

  if (isShiftLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!shift) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center text-sm text-muted-foreground">
          Không tìm thấy ca làm việc
        </div>
      </div>
    )
  }

  const orders = ordersData?.orders ?? []

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/staff/my-shifts')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Lịch sử ca
        </Button>
        <h1 className="text-base font-bold">Chi tiết ca</h1>
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <ShiftDetailSummary shift={shift} />
        {isOrdersLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ShiftOrdersList orders={orders} />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/app/staff/my-shifts/[slug]/page.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 9: Refactor old `/staff/my-shift` page

**Files:**
- Modify: `src/app/staff/my-shift.tsx`

The old page renders mock 3-shift toggle dashboard. Replace with a redirect-style page that auto-navigates to `/staff/my-shifts` (the new history list).

Why not just delete the file: route `STAFF_POS_MY_SHIFT: '/staff/my-shift'` may have external links (vd from header dropdown or sidebar). Preserve URL → redirect.

- [ ] **Step 1: Replace content with redirect**

Replace entire `src/app/staff/my-shift.tsx`:

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { ROUTE } from '@/constants'

export default function StaffMyShiftPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(ROUTE.STAFF_MY_SHIFTS_HISTORY, { replace: true })
  }, [navigate])
  return null
}
```

- [ ] **Step 2: Clean up no-longer-used mock infra**

The mock hook `useStaffShift(date, shift)` (the OLD one — NOT to be confused with `useGetCurrentStaffShift` etc. shipped in Phase 1) lives in `src/hooks/use-staff-shift.ts`. After this refactor it has zero callers. Verify with:

```bash
grep -rn "useStaffShift\b" src/ --include="*.tsx" --include="*.ts"
```

If only the export line + (now-redirecting) my-shift.tsx use it, delete:
- `src/hooks/use-staff-shift.ts` — remove the OLD `useStaffShift` function only (keep Phase 1 hooks: `useGetCurrentStaffShift`, `useOpenShift`, `useCloseShift` + Phase 2 hooks from Task 3)
- `src/hooks/__tests__/use-staff-shift.test.ts` — delete entirely (only tests the old mock hook)
- `src/utils/shift.ts` (if only used by the old page)
- `src/types/shift.ts` or `src/types/shift.type.ts` (if only `ShiftKey`/`ShiftConfig` exported, only used by old page)
- `src/components/staff/shift-selector.tsx`, `shift-stat-cards.tsx`, `shift-top-items.tsx` (if only used by old page)

For each file: verify with `grep -rn "<symbol>" src/ --include="*.tsx" --include="*.ts"` before deleting. If anything else uses it, leave alone.

CAUTION: do NOT delete `src/hooks/use-staff-shift.ts` entirely — Phase 1 added new hooks to that same file.

- [ ] **Step 3: Verify**

Run: `npx tsc -b 2>&1 | head -10`
Run: `npx eslint src/app/staff/my-shift.tsx 2>&1 | head -5`
Run: `npx vitest run 2>&1 | tail -5`
Expected: clean + tests pass (some tests for the old mock hook will be deleted in step 2 — that's expected reduction).

If tests for the old mock hook were deleted: test count drops by ~N. Report final count.

---

### Task 10: Link to history from indicator + my-shift entry

**Files:**
- Modify: `src/components/staff/current-shift-indicator.tsx`

Add a "Xem lịch sử ca" link in the indicator dropdown for easy access to history.

- [ ] **Step 1: Add link in dropdown**

In `src/components/staff/current-shift-indicator.tsx`, find the dropdown panel. Above the Đóng ca button section, add:

Find this block:
```tsx
<div className="mt-3 border-t pt-3 space-y-2">
  {longShift && (...)}
  <Button onClick={() => { setOpen(false); setCloseOpen(true) }} className="w-full">
    <LogOut className="mr-2 h-4 w-4" />
    Đóng ca
  </Button>
</div>
```

(Note: assumes Edge Cases plan Task 2 already applied — the `longShift` banner. If running this plan BEFORE edge-cases plan, remove the `{longShift && ...}` block from the snippet.)

Modify to add a history link:

```tsx
<div className="mt-3 border-t pt-3 space-y-2">
  {longShift && (
    <div className="rounded-md border border-orange-400/40 bg-orange-400/10 px-3 py-2 text-xs text-orange-700">
      ⚠ Ca đã mở hơn 10 tiếng. Hãy đóng ca nếu đã hết giờ làm.
    </div>
  )}
  <Button
    variant="outline"
    onClick={() => { setOpen(false); navigate('/staff/my-shifts') }}
    className="w-full"
  >
    <History className="mr-2 h-4 w-4" />
    Lịch sử ca của tôi
  </Button>
  <Button onClick={() => { setOpen(false); setCloseOpen(true) }} className="w-full">
    <LogOut className="mr-2 h-4 w-4" />
    Đóng ca
  </Button>
</div>
```

Add imports:
- `History` to existing `lucide-react` import
- `useNavigate` from `react-router-dom`

Add inside component:
```ts
const navigate = useNavigate()
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/current-shift-indicator.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 11: Full regression + smoke

- [ ] **Step 1: Run all tests**

Run: `npx vitest run 2>&1 | tail -5`
Expected: tests pass. Count may have dropped if Task 9 deleted old mock-hook tests. Report delta.

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 3: Manual smoke**

Run dev server. Login as STAFF.

1. Open shift → enter floor plan.
2. Header indicator → click → dropdown → click "Lịch sử ca của tôi" → navigate to `/staff/my-shifts`.
3. Verify history list shows past closed shifts + current active shift (if any).
4. Test filters: pick date range → list narrows. Pick status ACTIVE → only shows active. Reset filters → all show.
5. Pagination: if >10 shifts, "Trang 1 / N" appears with ‹ › working.
6. Click a shift card → navigate to `/staff/my-shifts/:slug` detail.
7. Detail page: 4 stat cards (đơn / doanh thu / thời gian / tiền mặt) + note card if note exists + orders table at bottom.
8. Click "← Lịch sử ca" → back to list.
9. Navigate to `/staff/my-shift` (OLD URL) → auto-redirect to `/staff/my-shifts`.

Record PASS/FAIL.

---

## Self-Review

**Spec coverage**:
- List my shifts ↔ Tasks 2 (API), 3 (hook), 5 (card), 6 (page). ✓
- Shift detail ↔ Tasks 2, 3, 7, 8. ✓
- Orders in shift ↔ Tasks 2, 3, 7 (list comp), 8 (wired). ✓
- Old page refactor ↔ Task 9. ✓
- Navigation from indicator ↔ Task 10. ✓

**Type consistency**:
- `IStaffShiftListQuery` consistent at type def + API + hook + page caller.
- `IStaffShiftWithOrders.orders: IOrder[]` consumed by `ShiftOrdersList`.
- 3 new QUERYKEYs use same array-shorthand pattern.
- Route constants `STAFF_MY_SHIFTS_HISTORY` + `STAFF_MY_SHIFT_DETAIL` consistent at definition + router + navigate calls.

**Placeholder scan**: none.

**Risks**:
- Task 9 file deletion assumes old mock hook is the ONLY use of dependencies (`shift.ts` utils, `ShiftKey` type, 3 components). If anything else uses them, leave alone (verify via grep). If unsure, skip deletion + accept dead code (less risky than breaking).
- `IOrder.table?.name` and `IOrder.subtotal` field shapes assumed — verify from existing IOrder type. If different naming (vd `tableName`, `totalAmount`), adapt in `ShiftOrdersList`.
- Date filter Input `type="date"` returns ISO `YYYY-MM-DD` — BE expected ISO. Should work as-is.
- Pagination size hardcoded 10. Acceptable for v1, future config in URL params if needed.
- `useMyStaffShifts` uses query object as queryKey — keepPreviousData smooths transitions. Object identity matters: `useMemo` already used in page (Task 6) to stabilize.

**Out of scope (Phase 3)**:
- Manager dashboard (`/system/staff-shifts/active`, history table, stats)
- Multi-branch admin picker
- Excel export
