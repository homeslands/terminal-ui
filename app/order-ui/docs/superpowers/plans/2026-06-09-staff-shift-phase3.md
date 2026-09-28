# Staff Shift Phase 3 — Manager Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3 cho MANAGER/ADMIN — dashboard giám sát ca nhân viên. 4 trang mới ở `/system/staff-shifts/*`: realtime active staff list, all-staff history, single-shift detail, stats by-staff. Plus 1 nice-to-have cho STAFF: realtime orders trong ca hiện tại trên indicator dropdown.

**Architecture:** Mở rộng `staff-shift.ts` API + hooks với 3 endpoints mới (active list, active orders, stats). Tận dụng pattern `/system` (DataTable, Helmet, icon title, role-gated via `Permission` enum + JWT scope). Reuse Phase 2 components (`ShiftDetailSummary`, `ShiftOrdersList`) cho manager detail page. Polling 30s cho realtime views.

**Tech Stack:** React 18, TanStack Query v5 (polling via `refetchInterval`), shadcn DataTable + Dialog, react-router-dom v6, react-i18next, TypeScript.

**Out of scope (Phase 4+):**
- Excel export (BE chưa có endpoint)
- Force-close endpoint (chờ BE — note tại `docs/superpowers/notes/2026-06-09-manager-force-close-shift.md`)
- WebSocket realtime (dùng polling)
- Multi-branch picker cho ADMIN (Manager auto-scoped theo branch; ADMIN có thể thêm sau khi đa-chi-nhánh thực sự cần)

---

## Endpoint coverage (từ BE doc)

Phase 3 wire 3 endpoints mới:

| Endpoint | Method | Role | Purpose |
|---|---|---|---|
| `GET /staff-shifts/active?branchSlug=` | GET | MANAGER/ADMIN | List staff đang ACTIVE (realtime) |
| `GET /staff-shifts/active/:staffSlug/orders` | GET | MANAGER/ADMIN | Orders realtime của 1 staff đang ACTIVE |
| `GET /staff-shifts/stats/by-staff?branchSlug=&startDate=&endDate=` | GET | MANAGER/ADMIN | KPI per staff (dates BẮT BUỘC) |
| `GET /staff-shifts?staffSlug=&branchSlug=&...` | GET | MANAGER/ADMIN | All-staff history với filter mở rộng (đã có hook Phase 2, chỉ cần extend query type) |
| `GET /staff-shifts/current/orders` | GET | STAFF | Đơn trong ca CURRENT (STAFF nice-to-have) |

Reuse từ Phase 2 (không cần thay đổi):
- `GET /staff-shifts/:slug` — detail (manager dùng chung)
- `GET /staff-shifts/:slug/orders` — orders trong 1 ca (manager dùng chung)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/staff-shift.type.ts` | Modify | +`IStaffShiftActiveItem`, +`IStaffShiftStatsByStaff`, extend `IStaffShiftListQuery` (+staffSlug, +branchSlug), +`IStaffShiftStatsQuery` |
| `src/api/staff-shift.ts` | Modify | Rename `getMyStaffShifts` → `getStaffShifts` (shared); +`getActiveStaffShifts`, +`getActiveStaffShiftOrders`, +`getStaffShiftStatsByStaff`, +`getCurrentStaffShiftOrders` |
| `src/hooks/use-staff-shift.ts` | Modify | Rename `useMyStaffShifts` → `useStaffShifts`; +`useActiveStaffShifts`, +`useActiveStaffShiftOrders`, +`useStaffShiftStatsByStaff`, +`useCurrentStaffShiftOrders` |
| `src/constants/query.ts` | Modify | +4 query keys: `activeStaffShifts`, `activeStaffShiftOrders`, `staffShiftStatsByStaff`, `currentStaffShiftOrders` |
| `src/constants/route.ts` | Modify | +4 routes under `/system/staff-shifts/*` |
| `src/constants/sidebar-permission.ts` | Modify | +`STAFF_SHIFT_MANAGEMENT = 'STAFF_SHIFT'` (BE coordinated) |
| `src/router/routes.ts` | Modify | +sidebarRoute entry "Quản lý ca nhân viên" với children (Đang làm việc, Lịch sử, Thống kê) |
| `src/router/loadable.tsx` | Modify | +4 lazy imports |
| `src/router/index.tsx` | Modify | Wire 4 manager routes inside `SystemLayout` |
| `src/app/system/staff-shifts/active/page.tsx` | Create | Realtime active staff dashboard |
| `src/app/system/staff-shifts/active/DataTable/columns.tsx` | Create | Columns for active staff |
| `src/app/system/staff-shifts/active/components/active-staff-orders-dialog.tsx` | Create | Dialog xem orders realtime of 1 active staff |
| `src/app/system/staff-shifts/page.tsx` | Create | All-staff history list |
| `src/app/system/staff-shifts/DataTable/columns.tsx` | Create | Columns for history (incl. staff name + branch) |
| `src/app/system/staff-shifts/DataTable/filters.tsx` | Create | Status filter for history list |
| `src/app/system/staff-shifts/[slug]/page.tsx` | Create | Manager shift detail (reuse Phase 2 components + add staff info banner) |
| `src/app/system/staff-shifts/stats/page.tsx` | Create | Stats by-staff page |
| `src/app/system/staff-shifts/stats/DataTable/columns.tsx` | Create | Columns for stats |
| `src/components/staff/staff-info-banner.tsx` | Create | Reusable banner showing staff name + branch (used in manager detail) |
| `src/components/staff/current-shift-indicator.tsx` | Modify | Add expandable "Đơn trong ca" section using `useCurrentStaffShiftOrders` |
| `src/app/staff/my-shifts/page.tsx` | Modify | Update hook name (`useMyStaffShifts` → `useStaffShifts`) — Phase 2 caller rename |
| `public/locales/{vi,en}/sidebar.json` | Modify | +i18n keys for new menu items |

---

### Task 1: Foundation — types + API + hooks + query keys

**Files:**
- Modify: `src/types/staff-shift.type.ts`
- Modify: `src/api/staff-shift.ts`
- Modify: `src/hooks/use-staff-shift.ts`
- Modify: `src/constants/query.ts`
- Modify: `src/app/staff/my-shifts/page.tsx` (rename caller)

Foundation work for all 4 manager pages + STAFF realtime feature. Done in 1 task because tightly coupled (types → API → hooks → caller rename).

- [ ] **Step 1: Add types**

In `src/types/staff-shift.type.ts`, append (keep existing imports + extend the existing `IStaffShiftListQuery`):

```ts
export interface IStaffShiftActiveItem {
  staff: IStaffShiftStaffSummary
  branch: Pick<IBranch, 'slug' | 'name'>
  shift: {
    slug: string
    startTime: string
    durationMinutes: number
    totalOrdersSoFar: number
    totalRevenueSoFar: number
  }
}

export interface IStaffShiftStatsByStaff {
  staff: IStaffShiftStaffSummary
  totalShifts: number
  totalOrders: number
  totalRevenue: number
  avgOrdersPerShift: number
  avgShiftDurationMinutes: number
}

export interface IStaffShiftStatsQuery {
  branchSlug?: string
  startDate: string  // required
  endDate: string    // required
}
```

Find existing `IStaffShiftListQuery` and extend with 2 new optional fields:

```ts
export interface IStaffShiftListQuery {
  startDate?: string
  endDate?: string
  status?: StaffShiftStatus
  page?: number
  size?: number
  staffSlug?: string   // NEW — manager filter
  branchSlug?: string  // NEW — admin filter
}
```

- [ ] **Step 2: API functions — rename + add**

In `src/api/staff-shift.ts`:

2a. Rename `getMyStaffShifts` → `getStaffShifts` (same endpoint `/staff-shifts`, BE handles role filtering). Find:

```ts
export async function getMyStaffShifts(
  query: IStaffShiftListQuery,
): Promise<IApiResponse<IPaginationResponse<IStaffShift>>> {
```

Rename to `getStaffShifts` (body unchanged).

2b. Append 4 new functions after `getStaffShiftOrders`:

```ts
export async function getActiveStaffShifts(
  branchSlug?: string,
): Promise<IApiResponse<IStaffShiftActiveItem[]>> {
  const response = await http.get<IApiResponse<IStaffShiftActiveItem[]>>(
    '/staff-shifts/active',
    { params: branchSlug ? { branchSlug } : undefined, doNotShowLoading: true },
  )
  return response.data
}

export async function getActiveStaffShiftOrders(
  staffSlug: string,
): Promise<IApiResponse<IStaffShiftWithOrders>> {
  const response = await http.get<IApiResponse<IStaffShiftWithOrders>>(
    `/staff-shifts/active/${staffSlug}/orders`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getStaffShiftStatsByStaff(
  query: IStaffShiftStatsQuery,
): Promise<IApiResponse<IStaffShiftStatsByStaff[]>> {
  const response = await http.get<IApiResponse<IStaffShiftStatsByStaff[]>>(
    '/staff-shifts/stats/by-staff',
    { params: query, doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentStaffShiftOrders(): Promise<
  IApiResponse<IStaffShiftWithOrders>
> {
  const response = await http.get<IApiResponse<IStaffShiftWithOrders>>(
    '/staff-shifts/current/orders',
    { doNotShowLoading: true },
  )
  return response.data
}
```

Fold new types into the existing `import type { ... } from '@/types'` block: `IStaffShiftActiveItem`, `IStaffShiftStatsByStaff`, `IStaffShiftStatsQuery`.

- [ ] **Step 3: QUERYKEYs**

In `src/constants/query.ts`, after `staffShiftOrders: ['staffShiftOrders'],` add:

```ts
  activeStaffShifts: ['activeStaffShifts'],
  activeStaffShiftOrders: ['activeStaffShiftOrders'],
  staffShiftStatsByStaff: ['staffShiftStatsByStaff'],
  currentStaffShiftOrders: ['currentStaffShiftOrders'],
```

- [ ] **Step 4: Hooks — rename + add**

In `src/hooks/use-staff-shift.ts`:

4a. Rename existing `useMyStaffShifts` → `useStaffShifts` (just the function name; body unchanged).

4b. Update import line to add new API funcs:
```ts
import {
  closeShift,
  getActiveStaffShifts,
  getActiveStaffShiftOrders,
  getCurrentStaffShift,
  getCurrentStaffShiftOrders,
  getStaffShifts,
  getStaffShiftBySlug,
  getStaffShiftOrders,
  getStaffShiftStatsByStaff,
  openShift,
} from '@/api/staff-shift'
```

(Note: `getMyStaffShifts` renamed → `getStaffShifts` in step 2a.)

4c. Update `IStaffShiftListQuery` import to include `IStaffShiftStatsQuery`.

4d. Append 4 hooks after `useStaffShiftOrders`:

```ts
export const useActiveStaffShifts = (
  branchSlug?: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QUERYKEY.activeStaffShifts, branchSlug ?? null],
    queryFn: () => getActiveStaffShifts(branchSlug),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

export const useActiveStaffShiftOrders = (staffSlug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.activeStaffShiftOrders, staffSlug],
    queryFn: () => getActiveStaffShiftOrders(staffSlug as string),
    enabled: !!staffSlug,
    refetchInterval: 15_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

export const useStaffShiftStatsByStaff = (
  query: IStaffShiftStatsQuery,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QUERYKEY.staffShiftStatsByStaff, query],
    queryFn: () => getStaffShiftStatsByStaff(query),
    enabled: enabled && !!query.startDate && !!query.endDate,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

export const useCurrentStaffShiftOrders = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.currentStaffShiftOrders],
    queryFn: () => getCurrentStaffShiftOrders(),
    enabled,
    refetchInterval: 20_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: (failureCount, error) => {
      const status =
        (error as { status?: number })?.status ??
        (error as { response?: { status?: number } })?.response?.status
      if (status === 404) return false
      return failureCount < 2
    },
  })
}
```

- [ ] **Step 5: Rename caller in Phase 2 page**

In `src/app/staff/my-shifts/page.tsx`, find both:
```ts
import { useMyStaffShifts } from '@/hooks'
```
and the call site:
```ts
const { data, isLoading } = useMyStaffShifts({
```

Replace `useMyStaffShifts` with `useStaffShifts` (both lines).

- [ ] **Step 6: Verify**

```bash
npx tsc -b 2>&1 | head -10
npx eslint src/types/staff-shift.type.ts src/api/staff-shift.ts src/hooks/use-staff-shift.ts src/constants/query.ts src/app/staff/my-shifts/page.tsx 2>&1 | head -5
npx vitest run 2>&1 | tail -5
grep -rn "useMyStaffShifts\|getMyStaffShifts" /Users/phanquyetthang/terminal/app/order-ui/src/ --include='*.tsx' --include='*.ts'
```

Expected: tsc + eslint clean, 517 tests PASS, no remaining usages of old names.

---

### Task 2: Constants + Routes + Sidebar nav

**Files:**
- Modify: `src/constants/sidebar-permission.ts`
- Modify: `src/constants/route.ts`
- Modify: `src/router/loadable.tsx`
- Modify: `src/router/routes.ts`
- Modify: `src/router/index.tsx`
- Modify: `public/locales/vi/sidebar.json`
- Modify: `public/locales/en/sidebar.json`

Add 4 routes under `/system/staff-shifts/*` + sidebar menu group. Permission entry uses `STAFF_SHIFT` (BE coordination required — see Self-Review section for fallback).

- [ ] **Step 1: Add permission enum entry**

In `src/constants/sidebar-permission.ts`, append (inside `Permission` enum, before `CAMPAIGN_MANAGEMENT`):

```ts
  STAFF_SHIFT_MANAGEMENT = 'STAFF_SHIFT',
```

- [ ] **Step 2: Add route constants**

In `src/constants/route.ts`, find existing `STAFF_MY_SHIFT_DETAIL: '/staff/my-shifts/:slug',` and after it add:

```ts
  SYSTEM_STAFF_SHIFTS_ACTIVE: '/system/staff-shifts/active',
  SYSTEM_STAFF_SHIFTS_HISTORY: '/system/staff-shifts',
  SYSTEM_STAFF_SHIFT_DETAIL: '/system/staff-shifts/:slug',
  SYSTEM_STAFF_SHIFTS_STATS: '/system/staff-shifts/stats',
```

(Note: `/system/staff-shifts/stats` is more specific than `/system/staff-shifts/:slug` — router needs the static route declared first in `index.tsx` to match correctly. Will handle in Step 5.)

- [ ] **Step 3: Lazy imports**

In `src/router/loadable.tsx`, after the existing `StaffMyShiftDetailPage` lazy export, append:

```ts
export const SystemActiveStaffShiftsPage = React.lazy(() =>
  import('@/app/system/staff-shifts/active/page').then((module) => ({
    default: module.default,
  })),
)

export const SystemStaffShiftsHistoryPage = React.lazy(() =>
  import('@/app/system/staff-shifts/page').then((module) => ({
    default: module.default,
  })),
)

export const SystemStaffShiftDetailPage = React.lazy(() =>
  import('@/app/system/staff-shifts/[slug]/page').then((module) => ({
    default: module.default,
  })),
)

export const SystemStaffShiftsStatsPage = React.lazy(() =>
  import('@/app/system/staff-shifts/stats/page').then((module) => ({
    default: module.default,
  })),
)
```

- [ ] **Step 4: Add sidebar entry**

In `src/router/routes.ts`, find a good insertion point in the `sidebarRoutes` array (e.g., near `EMPLOYEE_MANAGEMENT` entry). Add:

```ts
  {
    title: 'sidebar.staffShiftManagement',
    path: ROUTE.SYSTEM_STAFF_SHIFTS_ACTIVE,
    icon: ClipboardList,
    permission: Permission.STAFF_SHIFT_MANAGEMENT,
    children: [
      {
        title: 'sidebar.staffShiftActive',
        path: ROUTE.SYSTEM_STAFF_SHIFTS_ACTIVE,
        permission: Permission.STAFF_SHIFT_MANAGEMENT,
      },
      {
        title: 'sidebar.staffShiftHistory',
        path: ROUTE.SYSTEM_STAFF_SHIFTS_HISTORY,
        permission: Permission.STAFF_SHIFT_MANAGEMENT,
      },
      {
        title: 'sidebar.staffShiftStats',
        path: ROUTE.SYSTEM_STAFF_SHIFTS_STATS,
        permission: Permission.STAFF_SHIFT_MANAGEMENT,
      },
    ],
  },
```

Verify that `ClipboardList` is in the lucide-react import at top of file. If not, fold in.

- [ ] **Step 5: Wire routes in router/index.tsx**

In `src/router/index.tsx`:

5a. Add 4 lazy imports to existing import block (alphabetical):
```ts
  SystemActiveStaffShiftsPage,
  SystemStaffShiftsHistoryPage,
  SystemStaffShiftDetailPage,
  SystemStaffShiftsStatsPage,
```

5b. Find `SystemLayout` block (search for `<SystemLayout`). Add 4 routes inside its children. **ORDER MATTERS**: static `/stats` BEFORE dynamic `/:slug`:

```tsx
{
  path: ROUTE.SYSTEM_STAFF_SHIFTS_ACTIVE,
  element: (
    <ProtectedElement element={<SuspenseElement component={SystemActiveStaffShiftsPage} />} />
  ),
},
{
  path: ROUTE.SYSTEM_STAFF_SHIFTS_HISTORY,
  element: (
    <ProtectedElement element={<SuspenseElement component={SystemStaffShiftsHistoryPage} />} />
  ),
},
{
  path: ROUTE.SYSTEM_STAFF_SHIFTS_STATS,
  element: (
    <ProtectedElement element={<SuspenseElement component={SystemStaffShiftsStatsPage} />} />
  ),
},
{
  path: ROUTE.SYSTEM_STAFF_SHIFT_DETAIL,
  element: (
    <ProtectedElement element={<SuspenseElement component={SystemStaffShiftDetailPage} />} />
  ),
},
```

- [ ] **Step 6: i18n entries**

In `public/locales/vi/sidebar.json`, add inside the `sidebar` object:

```json
    "staffShiftManagement": "Quản lý ca nhân viên",
    "staffShiftActive": "Đang làm việc",
    "staffShiftHistory": "Lịch sử ca",
    "staffShiftStats": "Thống kê ca",
```

In `public/locales/en/sidebar.json`, mirror:

```json
    "staffShiftManagement": "Staff Shift Management",
    "staffShiftActive": "Active staff",
    "staffShiftHistory": "Shift history",
    "staffShiftStats": "Shift stats",
```

- [ ] **Step 7: Verify**

```bash
npx tsc -b 2>&1 | head -10
```
Expected: 4 errors only about missing page modules (will be created in subsequent tasks).

---

### Task 3: Active staff dashboard page

**Files:**
- Create: `src/app/system/staff-shifts/active/page.tsx`
- Create: `src/app/system/staff-shifts/active/DataTable/columns.tsx`

Realtime list of staff đang ACTIVE. Click row → opens orders dialog (Task 4).

- [ ] **Step 1: Make directory + columns file**

```bash
mkdir -p /Users/phanquyetthang/terminal/app/order-ui/src/app/system/staff-shifts/active/DataTable
```

Create `src/app/system/staff-shifts/active/DataTable/columns.tsx`:

```tsx
import { ColumnDef } from '@tanstack/react-table'

import { DataTableColumnHeader } from '@/components/ui'
import { formatShiftDuration } from '@/lib/staff-shift-helpers'
import type { IStaffShiftActiveItem } from '@/types'

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

function formatHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const useActiveStaffShiftColumns = (): ColumnDef<IStaffShiftActiveItem>[] => [
  {
    id: 'staff',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nhân viên" />
    ),
    cell: ({ row }) => {
      const s = row.original.staff
      return (
        <div className="text-sm min-w-40">
          <div className="font-semibold">{s.firstName} {s.lastName}</div>
          <div className="text-xs text-muted-foreground">{s.phonenumber}</div>
        </div>
      )
    },
  },
  {
    id: 'branch',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Chi nhánh" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-32">{row.original.branch.name}</div>
    ),
  },
  {
    id: 'startTime',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Bắt đầu" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-20 font-medium">
        {formatHHMM(row.original.shift.startTime)}
      </div>
    ),
  },
  {
    id: 'duration',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Đã làm" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-24">
        {formatShiftDuration(row.original.shift.durationMinutes)}
      </div>
    ),
  },
  {
    id: 'totalOrders',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Đơn" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-16">{row.original.shift.totalOrdersSoFar}</div>
    ),
  },
  {
    id: 'totalRevenue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Doanh thu" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-28 font-semibold text-primary">
        {formatVnd(row.original.shift.totalRevenueSoFar)}
      </div>
    ),
  },
]
```

- [ ] **Step 2: Page file**

Create `src/app/system/staff-shifts/active/page.tsx`:

```tsx
import { useState } from 'react'
import { Helmet } from 'react-helmet'
import { Activity } from 'lucide-react'

import { DataTable } from '@/components/ui'
import { useActiveStaffShifts } from '@/hooks'
import { useActiveStaffShiftColumns } from './DataTable/columns'
import ActiveStaffOrdersDialog from './components/active-staff-orders-dialog'
import type { IStaffShiftActiveItem } from '@/types'

export default function SystemActiveStaffShiftsPage() {
  const { data: activeStaff, isLoading } = useActiveStaffShifts()
  const [selectedStaffSlug, setSelectedStaffSlug] = useState<string | null>(null)

  const handleRowClick = (row: IStaffShiftActiveItem) => {
    setSelectedStaffSlug(row.staff.slug)
  }

  const data = activeStaff ?? []

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>Nhân viên đang làm việc</title>
      </Helmet>

      <span className="flex gap-1 items-center text-lg">
        <Activity className="w-5 h-5 text-primary" />
        Nhân viên đang làm việc
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({data.length} người)
        </span>
      </span>

      <DataTable
        columns={useActiveStaffShiftColumns()}
        data={data}
        isLoading={isLoading}
        pages={0}
        hiddenInput={true}
        hiddenDatePicker={true}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        onRowClick={handleRowClick}
      />

      <ActiveStaffOrdersDialog
        staffSlug={selectedStaffSlug}
        onClose={() => setSelectedStaffSlug(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc -b 2>&1 | head -10
```

Expected: 3 errors left (about other missing pages + missing dialog file). Active page itself shouldn't error besides the dialog import.

---

### Task 4: Active staff orders dialog

**Files:**
- Create: `src/app/system/staff-shifts/active/components/active-staff-orders-dialog.tsx`

Dialog opens when manager clicks a row in active dashboard. Polls orders every 15s. Closes via `onClose`.

- [ ] **Step 1: Make directory + file**

```bash
mkdir -p /Users/phanquyetthang/terminal/app/order-ui/src/app/system/staff-shifts/active/components
```

Create `src/app/system/staff-shifts/active/components/active-staff-orders-dialog.tsx`:

```tsx
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { useActiveStaffShiftOrders } from '@/hooks'
import { ShiftOrdersList } from '@/components/staff/shift-orders-list'
import { ShiftDetailSummary } from '@/components/staff/shift-detail-summary'

interface Props {
  staffSlug: string | null
  onClose: () => void
}

export default function ActiveStaffOrdersDialog({ staffSlug, onClose }: Props) {
  const { data, isLoading } = useActiveStaffShiftOrders(staffSlug ?? undefined)

  return (
    <Dialog open={!!staffSlug} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[80vh] overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {data?.shift
              ? `Ca của ${data.shift.staff?.firstName ?? ''} ${data.shift.staff?.lastName ?? ''}`.trim()
              : 'Chi tiết ca'}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.shift ? (
          <div className="py-8 text-sm text-center text-muted-foreground">
            Không tải được dữ liệu ca
          </div>
        ) : (
          <div className="space-y-4">
            <ShiftDetailSummary shift={data.shift} />
            <ShiftOrdersList orders={data.orders ?? []} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc -b 2>&1 | head -10
npx eslint src/app/system/staff-shifts/active/ 2>&1 | head -5
```

Expected: tsc errors reduced to 3 (about history, detail, stats pages).

---

### Task 5: All-staff history page

**Files:**
- Create: `src/app/system/staff-shifts/page.tsx`
- Create: `src/app/system/staff-shifts/DataTable/columns.tsx`
- Create: `src/app/system/staff-shifts/DataTable/filters.tsx`

History list cho manager — extends Phase 2 list with extra columns (staff name + branch). Reuses `useStaffShifts` (renamed in Task 1) with extra params.

- [ ] **Step 1: Make directory + columns file**

```bash
mkdir -p /Users/phanquyetthang/terminal/app/order-ui/src/app/system/staff-shifts/DataTable
```

Create `src/app/system/staff-shifts/DataTable/columns.tsx`:

```tsx
import { ColumnDef } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'

import { DataTableColumnHeader } from '@/components/ui'
import { formatShiftDuration } from '@/lib/staff-shift-helpers'
import type { IStaffShift } from '@/types'

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

export const useSystemStaffShiftColumns = (): ColumnDef<IStaffShift>[] => [
  {
    id: 'staff',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nhân viên" />
    ),
    cell: ({ row }) => {
      const s = row.original.staff
      return (
        <div className="text-sm min-w-40">
          <div className="font-semibold">{s.firstName} {s.lastName}</div>
          <div className="text-xs text-muted-foreground">{s.phonenumber}</div>
        </div>
      )
    },
  },
  {
    id: 'branch',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Chi nhánh" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-32">{row.original.branch.name}</div>
    ),
  },
  {
    accessorKey: 'startTime',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ngày" />
    ),
    cell: ({ row }) => (
      <div className="w-28 text-sm font-medium">
        {formatDate(row.original.startTime)}
      </div>
    ),
  },
  {
    id: 'timeRange',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Giờ vào → ra" />
    ),
    cell: ({ row }) => {
      const { startTime, endTime } = row.original
      return (
        <div className="flex items-center gap-1.5 text-sm min-w-32">
          <span>{formatHHMM(startTime)}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span>{endTime ? formatHHMM(endTime) : '—'}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'durationMinutes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Thời lượng" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-24">
        {row.original.status === 'CLOSED'
          ? formatShiftDuration(row.original.durationMinutes)
          : '—'}
      </div>
    ),
  },
  {
    accessorKey: 'totalOrders',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Đơn" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-16">{row.original.totalOrders}</div>
    ),
  },
  {
    accessorKey: 'totalRevenue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Doanh thu" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-28 font-semibold text-primary">
        {formatVnd(row.original.totalRevenue)}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trạng thái" />
    ),
    cell: ({ row }) => {
      const isClosed = row.original.status === 'CLOSED'
      return (
        <span
          className={`inline-block rounded px-2.5 py-1 text-xs font-semibold text-white ${
            isClosed ? 'bg-slate-500' : 'bg-primary'
          }`}
        >
          {isClosed ? 'Đã đóng' : 'Đang mở'}
        </span>
      )
    },
  },
]
```

- [ ] **Step 2: Filters file (status select)**

Create `src/app/system/staff-shifts/DataTable/filters.tsx`:

```tsx
import { useState } from 'react'

import {
  DataTableFilterOptionsProps,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import type { IStaffShift } from '@/types'

export default function SystemStaffShiftFilterOptions({
  filterConfig,
  onFilterChange,
}: DataTableFilterOptionsProps<IStaffShift>) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})

  const handleFilterChange = (filterId: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [filterId]: value }))
    onFilterChange?.(filterId, value)
  }

  if (!filterConfig?.length) return null
  return (
    <div className="flex gap-2">
      {filterConfig.map((filter) => (
        <Select
          key={filter.id}
          value={filterValues[filter.id] || 'all'}
          onValueChange={(value) => handleFilterChange(filter.id, value)}
        >
          <SelectTrigger className="h-10 text-xs w-fit">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent side="bottom">
            <SelectGroup>
              <SelectLabel className="text-xs">{filter.label}</SelectLabel>
              {filter.options.map((option) => (
                <SelectItem
                  key={String(option.value)}
                  value={String(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Page file**

Create `src/app/system/staff-shifts/page.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { ClipboardList, MoveRight, X } from 'lucide-react'
import moment from 'moment'

import { Button, DataTable } from '@/components/ui'
import SimpleDatePicker from '@/components/app/picker/simple-date-picker'
import { usePagination } from '@/hooks'
import { useStaffShifts } from '@/hooks'
import { useSystemStaffShiftColumns } from './DataTable/columns'
import SystemStaffShiftFilterOptions from './DataTable/filters'
import type { IStaffShift, StaffShiftStatus } from '@/types'

const STATUS_FILTER_CONFIG = [
  {
    id: 'status',
    label: 'Trạng thái',
    options: [
      { label: 'Tất cả', value: 'all' },
      { label: 'Đang mở', value: 'ACTIVE' },
      { label: 'Đã đóng', value: 'CLOSED' },
    ],
  },
]

export default function SystemStaffShiftsHistoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 10
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [status, setStatus] = useState<StaffShiftStatus | undefined>(undefined)

  useEffect(() => {
    setSearchParams((prev) => {
      prev.set('page', pagination.pageIndex.toString())
      prev.set('size', pagination.pageSize.toString())
      return prev
    })
  }, [pagination.pageIndex, pagination.pageSize, setSearchParams])

  const { data, isLoading } = useStaffShifts({
    page,
    size,
    startDate: startDate ? moment(startDate).format('YYYY-MM-DD') : undefined,
    endDate: endDate ? moment(endDate).format('YYYY-MM-DD') : undefined,
    status,
  })

  const handleFilterChange = (_filterId: string, value: string) => {
    setStatus(value === 'all' ? undefined : (value as StaffShiftStatus))
  }

  const handleRowClick = (row: IStaffShift) => {
    navigate(`/system/staff-shifts/${row.slug}`)
  }

  const hasDateFilter = !!(startDate || endDate)

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>Lịch sử ca nhân viên</title>
      </Helmet>

      <div className="flex flex-wrap gap-3 justify-between items-center">
        <span className="flex gap-2 items-center text-lg">
          <ClipboardList className="w-5 h-5 text-primary" />
          Lịch sử ca nhân viên
          {hasDateFilter && (
            <span className="px-3 py-0.5 ml-2 text-xs font-normal rounded-full border border-primary bg-primary/10 text-primary">
              {startDate ? moment(startDate).format('DD/MM/YYYY') : '...'}
              {' – '}
              {endDate ? moment(endDate).format('DD/MM/YYYY') : '...'}
            </span>
          )}
        </span>
        <div className="flex gap-2 items-center">
          <SimpleDatePicker
            value={startDate}
            onChange={setStartDate}
            allowEmpty
            disableFutureDates
            maxDate={endDate || undefined}
          />
          <MoveRight className="w-4 h-4 text-muted-foreground" />
          <SimpleDatePicker
            value={endDate}
            onChange={setEndDate}
            allowEmpty
            disableFutureDates
            minDate={startDate || undefined}
          />
          {hasDateFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              aria-label="Xoá lọc ngày"
              className="h-9 px-2"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={useSystemStaffShiftColumns()}
        data={data?.items ?? []}
        isLoading={isLoading}
        pages={data?.totalPages ?? 0}
        hiddenInput={true}
        hiddenDatePicker={true}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onRowClick={handleRowClick}
        filterOptions={SystemStaffShiftFilterOptions}
        filterConfig={STATUS_FILTER_CONFIG}
        onFilterChange={handleFilterChange}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc -b 2>&1 | head -10
npx eslint src/app/system/staff-shifts/ 2>&1 | head -5
```

Expected: 2 errors left (detail + stats pages).

---

### Task 6: Manager shift detail page

**Files:**
- Create: `src/components/staff/staff-info-banner.tsx`
- Create: `src/app/system/staff-shifts/[slug]/page.tsx`

Detail page reuses Phase 2 `ShiftDetailSummary` + `ShiftOrdersList` components. Adds staff info banner at top (Phase 2 detail was personal context so didn't need staff name).

- [ ] **Step 1: Reusable staff info banner**

Create `src/components/staff/staff-info-banner.tsx`:

```tsx
import { User, Building2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui'
import type { IStaffShift } from '@/types'

interface Props {
  shift: IStaffShift
}

export function StaffInfoBanner({ shift }: Props) {
  const fullname = `${shift.staff.firstName ?? ''} ${shift.staff.lastName ?? ''}`.trim()
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-wrap gap-4 items-center py-3">
        <div className="flex gap-2 items-center">
          <User className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold">{fullname}</div>
            <div className="text-xs text-muted-foreground">{shift.staff.phonenumber}</div>
          </div>
        </div>
        <div className="flex gap-2 items-center pl-4 border-l">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <div className="text-sm">{shift.branch.name}</div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Page file**

```bash
mkdir -p /Users/phanquyetthang/terminal/app/order-ui/src/app/system/staff-shifts/[slug]
```

Create `src/app/system/staff-shifts/[slug]/page.tsx`:

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { ArrowLeft, ClipboardList, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui'
import { useStaffShiftBySlug, useStaffShiftOrders } from '@/hooks'
import { ShiftDetailSummary } from '@/components/staff/shift-detail-summary'
import { ShiftOrdersList } from '@/components/staff/shift-orders-list'
import { StaffInfoBanner } from '@/components/staff/staff-info-banner'

export default function SystemStaffShiftDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const { data: shift, isLoading: isShiftLoading } = useStaffShiftBySlug(slug)
  const { data: ordersData, isLoading: isOrdersLoading } = useStaffShiftOrders(slug)

  if (isShiftLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!shift) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-sm text-center text-muted-foreground">
          Không tìm thấy ca làm việc
        </div>
      </div>
    )
  }

  const orders = ordersData?.orders ?? []
  const isClosed = shift.status === 'CLOSED'

  return (
    <div className="grid grid-cols-1 gap-3 h-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>Chi tiết ca nhân viên</title>
      </Helmet>

      <div className="flex flex-wrap gap-3 items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/system/staff-shifts')}
          aria-label="Quay lại lịch sử ca"
          className="w-8 h-8"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="flex gap-2 items-center text-lg">
          <ClipboardList className="w-5 h-5 text-primary" />
          Chi tiết ca
          <span
            className={`ml-1 inline-block rounded px-2.5 py-1 text-xs font-semibold text-white ${
              isClosed ? 'bg-slate-500' : 'bg-primary'
            }`}
          >
            {isClosed ? 'Đã đóng' : 'Đang mở'}
          </span>
        </span>
      </div>

      <StaffInfoBanner shift={shift} />
      <ShiftDetailSummary shift={shift} />
      {isOrdersLoading ? (
        <div className="flex justify-center items-center p-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ShiftOrdersList orders={orders} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc -b 2>&1 | head -10
npx eslint src/components/staff/staff-info-banner.tsx 'src/app/system/staff-shifts/[slug]/page.tsx' 2>&1 | head -5
```

Expected: 1 error left (stats page).

---

### Task 7: Stats by-staff page

**Files:**
- Create: `src/app/system/staff-shifts/stats/page.tsx`
- Create: `src/app/system/staff-shifts/stats/DataTable/columns.tsx`

KPI per staff over a date range. Date range BẮT BUỘC per BE doc — default to last 30 days.

- [ ] **Step 1: Make directory + columns file**

```bash
mkdir -p /Users/phanquyetthang/terminal/app/order-ui/src/app/system/staff-shifts/stats/DataTable
```

Create `src/app/system/staff-shifts/stats/DataTable/columns.tsx`:

```tsx
import { ColumnDef } from '@tanstack/react-table'

import { DataTableColumnHeader } from '@/components/ui'
import { formatShiftDuration } from '@/lib/staff-shift-helpers'
import type { IStaffShiftStatsByStaff } from '@/types'

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

export const useStaffShiftStatsColumns = (): ColumnDef<IStaffShiftStatsByStaff>[] => [
  {
    id: 'staff',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nhân viên" />
    ),
    cell: ({ row }) => {
      const s = row.original.staff
      return (
        <div className="text-sm min-w-40">
          <div className="font-semibold">{s.firstName} {s.lastName}</div>
          <div className="text-xs text-muted-foreground">{s.phonenumber}</div>
        </div>
      )
    },
  },
  {
    accessorKey: 'totalShifts',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Số ca" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-20">{row.original.totalShifts}</div>
    ),
  },
  {
    accessorKey: 'totalOrders',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tổng đơn" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-20">{row.original.totalOrders}</div>
    ),
  },
  {
    accessorKey: 'totalRevenue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tổng doanh thu" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-32 font-semibold text-primary">
        {formatVnd(row.original.totalRevenue)}
      </div>
    ),
  },
  {
    accessorKey: 'avgOrdersPerShift',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="TB đơn/ca" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-20">{row.original.avgOrdersPerShift}</div>
    ),
  },
  {
    accessorKey: 'avgShiftDurationMinutes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="TB thời lượng" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-28">
        {formatShiftDuration(row.original.avgShiftDurationMinutes)}
      </div>
    ),
  },
]
```

- [ ] **Step 2: Page file**

Create `src/app/system/staff-shifts/stats/page.tsx`:

```tsx
import { useState } from 'react'
import { Helmet } from 'react-helmet'
import { BarChart3, MoveRight } from 'lucide-react'
import moment from 'moment'

import { DataTable } from '@/components/ui'
import SimpleDatePicker from '@/components/app/picker/simple-date-picker'
import { useStaffShiftStatsByStaff } from '@/hooks'
import { useStaffShiftStatsColumns } from './DataTable/columns'

export default function SystemStaffShiftsStatsPage() {
  const [startDate, setStartDate] = useState<string>(
    moment().subtract(30, 'days').format('YYYY-MM-DD'),
  )
  const [endDate, setEndDate] = useState<string>(moment().format('YYYY-MM-DD'))

  const { data, isLoading } = useStaffShiftStatsByStaff({
    startDate,
    endDate,
  })

  const rows = data ?? []

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>Thống kê ca nhân viên</title>
      </Helmet>

      <div className="flex flex-wrap gap-3 justify-between items-center">
        <span className="flex gap-2 items-center text-lg">
          <BarChart3 className="w-5 h-5 text-primary" />
          Thống kê ca nhân viên
          <span className="px-3 py-0.5 ml-2 text-xs font-normal rounded-full border border-primary bg-primary/10 text-primary">
            {moment(startDate).format('DD/MM/YYYY')}
            {' – '}
            {moment(endDate).format('DD/MM/YYYY')}
          </span>
        </span>
        <div className="flex gap-2 items-center">
          <SimpleDatePicker
            value={startDate}
            onChange={setStartDate}
            disableFutureDates
            maxDate={endDate}
          />
          <MoveRight className="w-4 h-4 text-muted-foreground" />
          <SimpleDatePicker
            value={endDate}
            onChange={setEndDate}
            disableFutureDates
            minDate={startDate}
          />
        </div>
      </div>

      <DataTable
        columns={useStaffShiftStatsColumns()}
        data={rows}
        isLoading={isLoading}
        pages={0}
        hiddenInput={true}
        hiddenDatePicker={true}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc -b 2>&1 | head -10
npx eslint src/app/system/staff-shifts/stats/ 2>&1 | head -5
npx vitest run 2>&1 | tail -5
```

Expected: tsc + eslint clean. Vitest still 517 PASS (or higher if any new tests added; none in this task).

---

### Task 8: STAFF nice-to-have — orders in current shift on indicator dropdown

**Files:**
- Modify: `src/components/staff/current-shift-indicator.tsx`

Add expandable section in indicator dropdown showing orders đã tạo trong ca hiện tại (auto-refetch 20s via `useCurrentStaffShiftOrders`). Reduces context-switch — staff không phải mở tab khác.

- [ ] **Step 1: Add hook + state**

In `src/components/staff/current-shift-indicator.tsx`:

1a. Add import:
```ts
import { useCurrentStaffShiftOrders, useGetCurrentStaffShift } from '@/hooks'
```
(fold into existing `@/hooks` import line — `useGetCurrentStaffShift` already imported.)

1b. Inside component, after the existing `const { data: shift } = useGetCurrentStaffShift(isStaff)` line, add:

```ts
const [ordersOpen, setOrdersOpen] = useState(false)
const { data: ordersData } = useCurrentStaffShiftOrders(isStaff && !!shift && ordersOpen)
```

The `ordersOpen` gate prevents the network call until user expands — saves bandwidth.

- [ ] **Step 2: Add expandable section in dropdown**

Find the dropdown panel (the `{open && (...)}` block). After the "Doanh thu" row but before the `<div className="mt-3 border-t pt-3 space-y-2">` (footer buttons), insert:

```tsx
<div className="mt-2 border-t pt-2">
  <button
    type="button"
    onClick={() => setOrdersOpen((v) => !v)}
    className="flex justify-between items-center w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
  >
    <span>Đơn trong ca ({shift.totalOrders})</span>
    <ChevronDown className={`h-3 w-3 transition ${ordersOpen ? 'rotate-180' : ''}`} />
  </button>
  {ordersOpen && (
    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
      {(ordersData?.orders ?? []).length === 0 ? (
        <div className="text-xs text-center text-muted-foreground py-2">
          Chưa có đơn nào
        </div>
      ) : (
        (ordersData?.orders ?? []).map((order) => (
          <div
            key={order.slug}
            className="flex justify-between items-center text-xs py-1"
          >
            <span className="font-medium">{order.table?.name ?? '—'}</span>
            <span className="text-muted-foreground">
              {new Intl.NumberFormat('vi-VN').format(order.subtotal ?? 0)}đ
            </span>
          </div>
        ))
      )}
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/components/staff/current-shift-indicator.tsx 2>&1 | head -5
```

Expected: clean.

---

### Task 9: Regression + manual smoke

- [ ] **Step 1: Full test suite**

```bash
npx vitest run 2>&1 | tail -5
```
Expected: 517 PASS (no test added or removed in Phase 3).

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -10
```
Expected: PASS (bundle-size warning OK; same as before).

- [ ] **Step 3: Sanity grep for orphaned names**

```bash
grep -rn "useMyStaffShifts\|getMyStaffShifts" /Users/phanquyetthang/terminal/app/order-ui/src/ --include='*.tsx' --include='*.ts'
```
Expected: empty (no orphans from Task 1 rename).

- [ ] **Step 4: Manual smoke as MANAGER**

Pre-conditions: account with MANAGER role, JWT scope includes `STAFF_SHIFT` permission (BE coordination — see Self-Review).

1. Login as MANAGER → sidebar shows "Quản lý ca nhân viên" with 3 children (Đang làm việc / Lịch sử / Thống kê).
2. Click "Đang làm việc" → `/system/staff-shifts/active`. Table shows active staff (or empty state). Wait 30s → table re-fetches silently.
3. Click a row → dialog opens with shift summary + orders. Wait 15s → orders refetch.
4. Close dialog → back to list.
5. Click "Lịch sử ca" → `/system/staff-shifts`. Table shows all-staff shifts. Filter date + status → list narrows. Click a row → `/system/staff-shifts/:slug` detail page (staff info banner at top + stats + orders).
6. Click "Thống kê" → `/system/staff-shifts/stats`. Default date range = last 30 days. Table shows KPI per staff. Adjust date → table re-fetches.

- [ ] **Step 5: Manual smoke as STAFF**

1. Login as STAFF + mở ca + tạo vài order.
2. Click indicator chip "Ca: ..." → dropdown panel.
3. Click "Đơn trong ca (N)" — section expands, shows list of orders đã tạo, scrollable nếu nhiều.
4. Wait 20s → orders refetch silently (verify in DevTools Network).
5. Verify sidebar of STAFF KHÔNG có menu "Quản lý ca nhân viên" (permission gated correctly).

- [ ] **Step 6: Manual smoke role-gating**

1. Login as CUSTOMER → cannot navigate to `/system/staff-shifts/*` (already blocked at SystemLayout level via ProtectedElement).
2. Login as STAFF → navigate manually to `/system/staff-shifts/active` → should redirect to FORBIDDEN (no `STAFF_SHIFT` permission in token).

---

## Self-Review

**Spec coverage**:
- Realtime active dashboard ↔ Tasks 1 (API), 3 (page), 4 (orders dialog). ✓
- All-staff history ↔ Tasks 1 (type extend), 5 (page). ✓
- Manager shift detail ↔ Task 6 (reuses Phase 2 components + banner). ✓
- Stats by-staff ↔ Tasks 1 (API + types), 7 (page). ✓
- STAFF realtime orders in indicator ↔ Tasks 1 (hook), 8 (UI). ✓
- Routes + sidebar nav + i18n ↔ Task 2. ✓
- Regression ↔ Task 9. ✓

**Type consistency**:
- `IStaffShiftListQuery` extension (staffSlug/branchSlug) used by manager history (Task 5) — same query type as Phase 2.
- `IStaffShiftActiveItem` defined in Task 1, consumed by Task 3 columns + Task 4 dialog (via response shape only).
- `IStaffShiftStatsByStaff` defined in Task 1, consumed by Task 7.
- `IStaffShiftWithOrders` (from Phase 2) reused by both `useStaffShiftOrders` (closed-shift orders) and `useCurrentStaffShiftOrders` / `useActiveStaffShiftOrders` (active-shift orders) — same `{shift, orders[]}` shape per BE doc.
- Hook rename `useMyStaffShifts` → `useStaffShifts` consistent at definition + Phase 2 caller (Task 1 Step 5) + Task 5 (manager history).
- Function rename `getMyStaffShifts` → `getStaffShifts` consistent at API def (Task 1 Step 2a) + hook (Task 1 Step 4b).
- Route constants `SYSTEM_STAFF_SHIFTS_ACTIVE`, `SYSTEM_STAFF_SHIFTS_HISTORY`, `SYSTEM_STAFF_SHIFT_DETAIL`, `SYSTEM_STAFF_SHIFTS_STATS` consistent across route.ts + router/index.tsx + router/routes.ts + page navigates (`/system/staff-shifts`, `/system/staff-shifts/{slug}`).

**Placeholder scan**: none.

**Risks & coordination needed**:

1. **`STAFF_SHIFT` permission in BE token**: Task 2 adds `Permission.STAFF_SHIFT_MANAGEMENT = 'STAFF_SHIFT'`. If BE has NOT yet emitted this permission for MANAGER+ roles, the sidebar menu won't appear (ProtectedElement returns false) and direct URL navigation will hit FORBIDDEN. **Coordination required**: send list of new permission + role mapping (MANAGER, ADMIN, SUPER_ADMIN) to BE before deploying. As a dev workaround until BE adds it: temporarily change `permission: Permission.STAFF_SHIFT_MANAGEMENT` → `permission: Permission.EMPLOYEE_MANAGEMENT` (managers already have that). Document this fallback in PR description.

2. **Detail-page route conflict**: `/system/staff-shifts/stats` is more specific than `/system/staff-shifts/:slug`. React Router v6 matches based on declaration order — Task 2 Step 5 lists `/stats` BEFORE `/:slug` (correct). If implementer reorders, `stats` will be parsed as slug and break. Self-check: after Task 2, visit `/system/staff-shifts/stats` and verify the stats page renders (not "shift not found").

3. **Active dashboard re-render churn**: `useActiveStaffShifts` polls every 30s + dialog (`useActiveStaffShiftOrders`) polls every 15s. With many active staff (>50), this could cause table flicker. If observed in smoke: add `placeholderData: (prev) => prev` to the hook to keep stale data during refetch. Plan budget: skip for v1, address only if reported.

4. **Stats endpoint requires dates**: Task 7 defaults to last 30 days. If BE rejects when both dates are present but range is too large, surface error toast (currently silenced via `meta: { ignoreGlobalError: true }`). For v1, default works; if BE returns 400 for >90 days range, clamp the picker.

5. **i18n**: Task 2 Step 6 adds VN + EN sidebar entries. If the app uses other namespaces for menu group titles, verify the `sidebar.json` is the right file (check `app-sidebar.tsx` line 41 — `useTranslation('sidebar')`). All fits.

6. **Bundle size**: Adds ~4 lazy chunks. Each ~10-20kb gzipped (DataTable + columns + dialog). Within budget for /system routes.

**Out of scope (Phase 4)**:
- Excel export per-page (need BE export endpoint)
- Force-close shift (chờ BE — note exists)
- Branch picker for ADMIN/SUPER_ADMIN (Manager auto-scoped; add when multi-branch admin actually needed)
- Stats chart visualizations (currently table-only; add `recharts` chart later)
- Push notification when staff opens/closes shift (BE feature — Phase 4+)
