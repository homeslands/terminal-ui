# Staff Shift Phase 4 — Stats / Charts / UX Polish / Admin Advanced

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 4 phủ 4 nhóm follow-up sau Phase 3: (A) stats-by-date page + chart, (B) UX polish (close-shift summary modal, period preset filter), (C) admin advanced (search SĐT + multi-branch pickers cho history + stats), (D) BE-blocked items (document, không implement đợt này).

**Architecture:** Tận dụng pattern Phase 3 (`/system` DataTable, hook with `meta: { ignoreGlobalError: true }`, polling), thêm `echarts` cho chart visualizations (đã có sẵn trong project, dùng pattern từ `revenue-chart.tsx`). Stats page chuyển từ single table → tabs (by-staff / by-date) bằng shadcn `Tabs`. Close-shift summary modal hiển thị sau khi PATCH /staff-shifts/close trả về thành công, thay vì auto-navigate ngay. Period preset filter là 1 component reusable wrap `PeriodOfTimeSelect` đã có + emit `(startDate, endDate)`.

**Tech Stack:** React 18, TanStack Query v5, shadcn UI (Tabs, Dialog), `echarts` (đã có), react-router-dom v6, TypeScript.

**Sections trong plan:**
- Section A: Stats by-date (Tasks 1-3)
- Section B: UX polish (Tasks 4-6)
- Section C: Admin advanced (Tasks 7-9)
- Section D: Regression (Task 10)
- Section E: BE-blocked items — documented only, không implement

Có thể stop sau bất kỳ section nào — mỗi section produce working software độc lập.

**Out of scope (Section E, defer cho khi BE sẵn sàng):**
- Force-close shift endpoint cho manager
- Excel export per page (cần BE export endpoint)
- WebSocket realtime (đang dùng polling)
- Push notification khi staff mở/đóng ca
- `STAFF_SHIFT` permission swap (1-line change khi BE add — TODO comment đã đặt)
- Unit tests cho staff-shift hooks (hardening, optional, defer riêng plan tests)
- Full i18n cho columns/headers (hiện hardcoded VN — defer riêng plan i18n)

---

## Endpoint coverage

Phase 4 wire thêm 1 endpoint mới:

| Endpoint | Method | Role | Status |
|---|---|---|---|
| `GET /staff-shifts/stats/by-date?branchSlug=&startDate=&endDate=` | GET | MANAGER+ | NEW — Task 1 |

Reuse từ Phase 3 (không thay đổi):
- `GET /staff-shifts/stats/by-staff` — by-staff stats
- `useUsers` để search staff theo SĐT

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/staff-shift.type.ts` | Modify | +`IStaffShiftStatsByDate` interface |
| `src/api/staff-shift.ts` | Modify | +`getStaffShiftStatsByDate(query)` |
| `src/hooks/use-staff-shift.ts` | Modify | +`useStaffShiftStatsByDate(query, enabled?)` |
| `src/constants/query.ts` | Modify | +`staffShiftStatsByDate` querykey |
| `src/app/system/staff-shifts/stats/page.tsx` | Modify | Tabs wrapper (by-staff / by-date) |
| `src/app/system/staff-shifts/stats/components/stats-by-staff-tab.tsx` | Create | Extract existing by-staff content vào component |
| `src/app/system/staff-shifts/stats/components/stats-by-date-tab.tsx` | Create | By-date table + chart |
| `src/app/system/staff-shifts/stats/DataTable/by-date-columns.tsx` | Create | Columns for by-date table |
| `src/app/system/staff-shifts/stats/components/by-date-chart.tsx` | Create | echarts line chart cho revenue + orders trend |
| `src/components/staff/close-shift-summary-dialog.tsx` | Create | Reusable summary dialog sau close shift |
| `src/components/staff/close-shift-dialog.tsx` | Modify | Sau close success → render summary dialog thay vì onClosed ngay |
| `src/components/app/popover/period-preset-popover.tsx` | Create | Date range preset (7d, 30d, this month, this quarter) reusable |
| `src/app/staff/my-shifts/page.tsx` | Modify | Wire period preset |
| `src/app/system/staff-shifts/page.tsx` | Modify | Wire period preset + branch picker cho ADMIN |
| `src/app/system/staff-shifts/stats/page.tsx` | Modify (later in plan) | Branch picker cho ADMIN |
| `src/app/system/staff-shifts/active/page.tsx` | Modify | Search SĐT input giống manager history |

---

## SECTION A — Stats by-date (Tasks 1-3)

### Task 1: Foundation — type + API + hook + querykey

**Files:**
- Modify: `src/types/staff-shift.type.ts`
- Modify: `src/api/staff-shift.ts`
- Modify: `src/hooks/use-staff-shift.ts`
- Modify: `src/constants/query.ts`

- [ ] **Step 1: Add type**

In `src/types/staff-shift.type.ts`, append after `IStaffShiftStatsByStaff`:

```ts
export interface IStaffShiftStatsByDate {
  date: string  // ISO date, e.g. "2024-01-01"
  totalShifts: number
  totalStaffWorked: number
  totalOrders: number
  totalRevenue: number
}
```

Reuse `IStaffShiftStatsQuery` from Phase 3 (same shape: `branchSlug?, startDate, endDate`).

- [ ] **Step 2: Add API function**

In `src/api/staff-shift.ts`, append after `getStaffShiftStatsByStaff` (around line 102):

```ts
export async function getStaffShiftStatsByDate(
  query: IStaffShiftStatsQuery,
): Promise<IApiResponse<IStaffShiftStatsByDate[]>> {
  const response = await http.get<IApiResponse<IStaffShiftStatsByDate[]>>(
    '/staff-shifts/stats/by-date',
    { params: query, doNotShowLoading: true },
  )
  return response.data
}
```

Fold `IStaffShiftStatsByDate` into existing `import type { ... } from '@/types'` block at top of file.

- [ ] **Step 3: Add querykey**

In `src/constants/query.ts`, after `staffShiftStatsByStaff: ['staffShiftStatsByStaff'],` add:

```ts
  staffShiftStatsByDate: ['staffShiftStatsByDate'],
```

- [ ] **Step 4: Add hook**

In `src/hooks/use-staff-shift.ts`:

4a. Add `getStaffShiftStatsByDate` to existing `@/api/staff-shift` import (alphabetical between `getStaffShiftStatsByStaff` and `openShift`).

4b. Append hook after `useStaffShiftStatsByStaff`:

```ts
export const useStaffShiftStatsByDate = (
  query: IStaffShiftStatsQuery,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QUERYKEY.staffShiftStatsByDate, query],
    queryFn: () => getStaffShiftStatsByDate(query),
    enabled: enabled && !!query.startDate && !!query.endDate,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/types/staff-shift.type.ts src/api/staff-shift.ts src/hooks/use-staff-shift.ts src/constants/query.ts 2>&1 | head -5
npx vitest run 2>&1 | tail -5
```

Expected: tsc + eslint clean. 517 tests PASS.

---

### Task 2: Stats page tabs + by-date table

**Files:**
- Modify: `src/app/system/staff-shifts/stats/page.tsx`
- Create: `src/app/system/staff-shifts/stats/components/stats-by-staff-tab.tsx`
- Create: `src/app/system/staff-shifts/stats/components/stats-by-date-tab.tsx`
- Create: `src/app/system/staff-shifts/stats/DataTable/by-date-columns.tsx`

Tách hiện tại stats page chỉ có 1 table by-staff → wrap bằng shadcn `Tabs` với 2 tab (by-staff đang có + by-date mới). Date filter share giữa 2 tab (state ở parent).

- [ ] **Step 1: Extract by-staff tab**

```bash
mkdir -p /Users/phanquyetthang/terminal/app/order-ui/src/app/system/staff-shifts/stats/components
```

Create `src/app/system/staff-shifts/stats/components/stats-by-staff-tab.tsx`:

```tsx
import { DataTable } from '@/components/ui'
import { useStaffShiftStatsByStaff } from '@/hooks'
import { useStaffShiftStatsColumns } from '../DataTable/columns'

interface Props {
  startDate: string
  endDate: string
}

export default function StatsByStaffTab({ startDate, endDate }: Props) {
  const { data, isLoading } = useStaffShiftStatsByStaff({ startDate, endDate })
  const rows = data ?? []

  return (
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
  )
}
```

- [ ] **Step 2: By-date columns**

Create `src/app/system/staff-shifts/stats/DataTable/by-date-columns.tsx`:

```tsx
import { ColumnDef } from '@tanstack/react-table'
import moment from 'moment'

import { DataTableColumnHeader } from '@/components/ui'
import type { IStaffShiftStatsByDate } from '@/types'

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

export const useStaffShiftStatsByDateColumns = (): ColumnDef<IStaffShiftStatsByDate>[] => [
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ngày" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-28 font-medium">
        {moment(row.original.date).format('DD/MM/YYYY')}
      </div>
    ),
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
    accessorKey: 'totalStaffWorked',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nhân viên" />
    ),
    cell: ({ row }) => (
      <div className="text-sm w-24">{row.original.totalStaffWorked}</div>
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
]
```

- [ ] **Step 3: By-date tab**

Create `src/app/system/staff-shifts/stats/components/stats-by-date-tab.tsx`:

```tsx
import { DataTable } from '@/components/ui'
import { useStaffShiftStatsByDate } from '@/hooks'
import { useStaffShiftStatsByDateColumns } from '../DataTable/by-date-columns'

interface Props {
  startDate: string
  endDate: string
}

export default function StatsByDateTab({ startDate, endDate }: Props) {
  const { data, isLoading } = useStaffShiftStatsByDate({ startDate, endDate })
  const rows = data ?? []

  return (
    <div className="space-y-4">
      <DataTable
        columns={useStaffShiftStatsByDateColumns()}
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

- [ ] **Step 4: Refactor stats page với tabs**

Rewrite `src/app/system/staff-shifts/stats/page.tsx`:

```tsx
import { useState } from 'react'
import { Helmet } from 'react-helmet'
import { BarChart3, MoveRight } from 'lucide-react'
import moment from 'moment'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import SimpleDatePicker from '@/components/app/picker/simple-date-picker'
import StatsByStaffTab from './components/stats-by-staff-tab'
import StatsByDateTab from './components/stats-by-date-tab'

export default function SystemStaffShiftsStatsPage() {
  const [startDate, setStartDate] = useState<string>(
    moment().subtract(30, 'days').format('YYYY-MM-DD'),
  )
  const [endDate, setEndDate] = useState<string>(moment().format('YYYY-MM-DD'))

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

      <Tabs defaultValue="by-staff" className="w-full">
        <TabsList>
          <TabsTrigger value="by-staff">Theo nhân viên</TabsTrigger>
          <TabsTrigger value="by-date">Theo ngày</TabsTrigger>
        </TabsList>
        <TabsContent value="by-staff" className="mt-3">
          <StatsByStaffTab startDate={startDate} endDate={endDate} />
        </TabsContent>
        <TabsContent value="by-date" className="mt-3">
          <StatsByDateTab startDate={startDate} endDate={endDate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/app/system/staff-shifts/stats/ 2>&1 | head -5
```

Expected: clean. Verify `Tabs, TabsContent, TabsList, TabsTrigger` exported from `@/components/ui` — if not, import from `@/components/ui/tabs`.

---

### Task 3: Chart cho by-date (revenue + orders trend)

**Files:**
- Create: `src/app/system/staff-shifts/stats/components/by-date-chart.tsx`
- Modify: `src/app/system/staff-shifts/stats/components/stats-by-date-tab.tsx`

Line chart 2 series (revenue + orders) theo ngày. Dùng `echarts` pattern từ `src/app/system/revenue/components/revenue-chart.tsx`.

- [ ] **Step 1: Chart component**

Create `src/app/system/staff-shifts/stats/components/by-date-chart.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import moment from 'moment'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import type { IStaffShiftStatsByDate } from '@/types'

interface Props {
  data: IStaffShiftStatsByDate[]
}

interface TooltipParam {
  name: string
  value: number
  seriesName: string
}

function formatVndShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function ByDateChart({ data }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const chart = echarts.init(chartRef.current)

    const sorted = [...data].sort(
      (a, b) => moment(a.date).valueOf() - moment(b.date).valueOf(),
    )
    const dates = sorted.map((d) => moment(d.date).format('DD/MM'))
    const revenues = sorted.map((d) => d.totalRevenue)
    const orders = sorted.map((d) => d.totalOrders)

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: (params: TooltipParam[]) => {
          const date = params[0].name
          const lines = params
            .map((p) => {
              const value =
                p.seriesName === 'Doanh thu'
                  ? new Intl.NumberFormat('vi-VN').format(p.value) + 'đ'
                  : `${p.value} đơn`
              return `${p.seriesName}: ${value}`
            })
            .join('<br/>')
          return `${date}<br/>${lines}`
        },
      },
      legend: { data: ['Doanh thu', 'Đơn hàng'], bottom: 0 },
      grid: { left: 50, right: 50, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Doanh thu',
          position: 'left',
          axisLabel: { formatter: (v: number) => formatVndShort(v), fontSize: 10 },
        },
        {
          type: 'value',
          name: 'Đơn',
          position: 'right',
          axisLabel: { fontSize: 10 },
        },
      ],
      series: [
        {
          name: 'Doanh thu',
          type: 'line',
          smooth: true,
          data: revenues,
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: 'Đơn hàng',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          data: orders,
          itemStyle: { color: '#3b82f6' },
        },
      ],
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [data])

  if (data.length === 0) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-8 text-sm text-center text-muted-foreground">
          Chưa có dữ liệu để vẽ biểu đồ
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Xu hướng theo ngày</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="w-full h-64" />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Wire chart vào by-date tab**

Modify `src/app/system/staff-shifts/stats/components/stats-by-date-tab.tsx`:

```tsx
import { DataTable } from '@/components/ui'
import { useStaffShiftStatsByDate } from '@/hooks'
import { useStaffShiftStatsByDateColumns } from '../DataTable/by-date-columns'
import ByDateChart from './by-date-chart'

interface Props {
  startDate: string
  endDate: string
}

export default function StatsByDateTab({ startDate, endDate }: Props) {
  const { data, isLoading } = useStaffShiftStatsByDate({ startDate, endDate })
  const rows = data ?? []

  return (
    <div className="space-y-4">
      <ByDateChart data={rows} />
      <DataTable
        columns={useStaffShiftStatsByDateColumns()}
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
npx tsc -b 2>&1 | head -5
npx eslint src/app/system/staff-shifts/stats/components/ 2>&1 | head -5
npm run build 2>&1 | tail -5
```

Expected: tsc + eslint + build clean. Bundle size may grow ~10kb from echarts chunk (already imported elsewhere so likely shared).

---

## SECTION B — UX polish (Tasks 4-6)

### Task 4: Close-shift summary modal

**Files:**
- Create: `src/components/staff/close-shift-summary-dialog.tsx`
- Modify: `src/components/staff/close-shift-dialog.tsx`

Per BE doc line 283: "`PATCH /staff-shifts/close` thành công | Hiện modal tổng kết ca (totalOrders, totalRevenue)". Hiện flow chỉ navigate ra login ngay. Thêm step modal show summary trước khi onClosed.

- [ ] **Step 1: Summary dialog component**

Create `src/components/staff/close-shift-summary-dialog.tsx`:

```tsx
import { Package, Wallet, Clock } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { computeCashVariance, formatShiftDuration } from '@/lib/staff-shift-helpers'
import type { IStaffShift } from '@/types'

interface Props {
  shift: IStaffShift | null
  onConfirm: () => void
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

export function CloseShiftSummaryDialog({ shift, onConfirm }: Props) {
  if (!shift) return null

  const variance = computeCashVariance({
    openingCash: shift.openingCash,
    closingCash: shift.closingCash,
    totalRevenue: shift.totalRevenue,
  })

  return (
    <Dialog open={!!shift} onOpenChange={(open) => !open && onConfirm()}>
      <DialogContent
        className="max-w-md"
        aria-describedby={undefined}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            Đã đóng ca
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold text-white bg-slate-500">
              ĐÓNG
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
              <CardTitle className="text-xs font-medium">Đơn</CardTitle>
              <Package className="w-3 h-3 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{shift.totalOrders}</div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
              <CardTitle className="text-xs font-medium">Doanh thu</CardTitle>
              <Wallet className="w-3 h-3 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-primary">
                {formatVnd(shift.totalRevenue)}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
              <CardTitle className="text-xs font-medium">Thời lượng</CardTitle>
              <Clock className="w-3 h-3 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {formatShiftDuration(shift.durationMinutes)}
              </div>
            </CardContent>
          </Card>
        </div>

        {variance !== null && variance !== 0 && (
          <div
            className={`rounded-md px-3 py-2 text-xs ${
              variance > 0
                ? 'border border-emerald-400/40 bg-emerald-50 text-emerald-700'
                : 'border border-amber-400/40 bg-amber-50 text-amber-700'
            }`}
          >
            Chênh lệch tiền mặt: <strong>{variance > 0 ? '+' : ''}{formatVnd(variance)}</strong>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onConfirm} className="w-full">
            Đóng và đăng xuất
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire vào CloseShiftDialog**

Open `src/components/staff/close-shift-dialog.tsx` và xem flow hiện tại — sau khi `useCloseShift` mutation thành công, sẽ call `onClosed?.()`. Thay flow đó bằng: lưu `closedShift` state local rồi render `CloseShiftSummaryDialog`. Khi user click "Đóng và đăng xuất" → call `onClosed?.()`.

Edit:

2a. Add imports + state:

```tsx
import { useState } from 'react'  // nếu chưa có
import { CloseShiftSummaryDialog } from './close-shift-summary-dialog'
import type { IStaffShift } from '@/types'
```

2b. Inside component, add state:

```tsx
const [closedShift, setClosedShift] = useState<IStaffShift | null>(null)
```

2c. Find the mutation success handler. Hiện tại nó call `onClosed?.()` ngay. Thay bằng:

```tsx
// Inside mutation onSuccess or handleConfirm after mutation resolves:
const result = await mutateAsync(...)
setClosedShift(result.result)
onOpenChange(false)  // close the close-shift dialog itself
```

(Adjust theo flow thực — nếu file dùng mutateAsync/await pattern khác, mirror existing pattern. Tìm chỗ `onClosed?.()` được call và inject `setClosedShift` ngay trước nó.)

2d. Append render at bottom of component (sibling tới existing dialog):

```tsx
<CloseShiftSummaryDialog
  shift={closedShift}
  onConfirm={() => {
    setClosedShift(null)
    onClosed?.()
  }}
/>
```

- [ ] **Step 3: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/components/staff/close-shift-dialog.tsx src/components/staff/close-shift-summary-dialog.tsx 2>&1 | head -5
npx vitest run 2>&1 | tail -5
```

Expected: clean. 517 PASS.

- [ ] **Step 4: Manual smoke**

1. Login STAFF + mở ca + tạo 1-2 order
2. Đóng ca từ indicator dropdown → form mở ca dialog xuất hiện
3. Nhập closing cash + note → confirm
4. Sau mutation success → summary dialog hiện với 3 stat card + variance banner (nếu có chênh)
5. Click "Đóng và đăng xuất" → navigate ra login

---

### Task 5: Period preset popover component

**Files:**
- Create: `src/components/app/popover/period-preset-popover.tsx`
- Modify: `src/components/app/popover/index.tsx` (re-export)

Reusable component cho preset filter "7 ngày / 30 ngày / Tháng này / Quý này / Năm nay / Custom". Emit `onApply(startDate, endDate)` với format `YYYY-MM-DD`.

- [ ] **Step 1: Create component**

Create `src/components/app/popover/period-preset-popover.tsx`:

```tsx
import { useState } from 'react'
import moment from 'moment'
import { Calendar as CalendarIcon } from 'lucide-react'

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import SimpleDatePicker from '@/components/app/picker/simple-date-picker'

interface Props {
  onApply: (startDate: string, endDate: string) => void
  label?: string
}

const PRESETS: { id: string; label: string; range: () => [string, string] }[] = [
  {
    id: '7d',
    label: '7 ngày qua',
    range: () => [
      moment().subtract(7, 'days').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
  {
    id: '30d',
    label: '30 ngày qua',
    range: () => [
      moment().subtract(30, 'days').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
  {
    id: 'thisMonth',
    label: 'Tháng này',
    range: () => [
      moment().startOf('month').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
  {
    id: 'lastMonth',
    label: 'Tháng trước',
    range: () => [
      moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
      moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
    ],
  },
  {
    id: 'thisQuarter',
    label: 'Quý này',
    range: () => [
      moment().startOf('quarter').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
  {
    id: 'thisYear',
    label: 'Năm nay',
    range: () => [
      moment().startOf('year').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
]

export default function PeriodPresetPopover({ onApply, label = 'Khoảng thời gian' }: Props) {
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')

  const handlePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    const [start, end] = preset.range()
    onApply(start, end)
    setOpen(false)
  }

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return
    onApply(customStart, customEnd)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="w-4 h-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-3 w-72">
        <div className="space-y-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.id)}
              className="px-2 py-1.5 w-full text-sm text-left rounded hover:bg-muted"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="pt-3 mt-3 border-t">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            Tuỳ chỉnh
          </div>
          <div className="flex flex-col gap-2">
            <SimpleDatePicker
              value={customStart}
              onChange={setCustomStart}
              allowEmpty
              disableFutureDates
              maxDate={customEnd || undefined}
            />
            <SimpleDatePicker
              value={customEnd}
              onChange={setCustomEnd}
              allowEmpty
              disableFutureDates
              minDate={customStart || undefined}
            />
            <Button
              size="sm"
              onClick={handleCustomApply}
              disabled={!customStart || !customEnd}
            >
              Áp dụng
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Re-export**

Modify `src/components/app/popover/index.tsx`, append:

```ts
export { default as PeriodPresetPopover } from './period-preset-popover'
```

- [ ] **Step 3: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/components/app/popover/ 2>&1 | head -5
```

Expected: clean.

---

### Task 6: Wire period preset to history + stats pages

**Files:**
- Modify: `src/app/staff/my-shifts/page.tsx`
- Modify: `src/app/system/staff-shifts/page.tsx`
- Modify: `src/app/system/staff-shifts/stats/page.tsx`

Replace 2x `SimpleDatePicker` patterns với `PeriodPresetPopover` ở 3 trang. Giữ `MoveRight` icon + clear button cũ chỉ ở 2 trang non-required (my-shifts + manager history). Stats page giữ 2x SimpleDatePicker (vì dates bắt buộc — preset bổ sung, không thay thế).

Quyết định gọn: ở stats page thêm `PeriodPresetPopover` cạnh 2 date picker (cho phép quick switch).

- [ ] **Step 1: My-shifts (STAFF)**

Open `src/app/staff/my-shifts/page.tsx`. Tìm block JSX với 2 `SimpleDatePicker`:

```tsx
<div className="flex gap-2 items-center">
  <SimpleDatePicker
    value={startDate}
    onChange={setStartDate}
    ...
  />
  <MoveRight ... />
  <SimpleDatePicker
    value={endDate}
    onChange={setEndDate}
    ...
  />
  {hasDateFilter && (<Button onClick={...}><X /></Button>)}
</div>
```

Thay bằng:

```tsx
<div className="flex gap-2 items-center">
  <PeriodPresetPopover
    onApply={(s, e) => {
      setStartDate(s)
      setEndDate(e)
    }}
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
      className="px-2 h-9"
    >
      <X className="w-4 h-4" />
    </Button>
  )}
</div>
```

Update import — add `PeriodPresetPopover` from `@/components/app/popover`. Remove unused `SimpleDatePicker` import + `MoveRight` if no longer used elsewhere.

- [ ] **Step 2: Manager history**

Mirror Step 1 cho `src/app/system/staff-shifts/page.tsx`. Same swap.

- [ ] **Step 3: Stats page (BỔ SUNG, không thay thế)**

Open `src/app/system/staff-shifts/stats/page.tsx`. Trong header div phải, BEFORE 2 SimpleDatePicker, thêm `PeriodPresetPopover`:

```tsx
<div className="flex gap-2 items-center">
  <PeriodPresetPopover
    onApply={(s, e) => {
      setStartDate(s)
      setEndDate(e)
    }}
  />
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
```

Update import — add `PeriodPresetPopover`.

- [ ] **Step 4: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/app/staff/my-shifts/page.tsx src/app/system/staff-shifts/page.tsx src/app/system/staff-shifts/stats/page.tsx 2>&1 | head -5
npx vitest run 2>&1 | tail -5
```

Expected: clean. 517 PASS.

- [ ] **Step 5: Manual smoke**

1. `/staff/my-shifts` → "Khoảng thời gian" button → preset list → click "7 ngày qua" → list narrow + chip hiển thị range
2. Custom → pick 2 dates → "Áp dụng" → list narrow
3. Mirror cho `/system/staff-shifts` + `/system/staff-shifts/stats`

---

## SECTION C — Admin advanced (Tasks 7-9)

### Task 7: Search SĐT trên active dashboard

**Files:**
- Modify: `src/app/system/staff-shifts/active/page.tsx`

Mirror pattern từ manager history (two-step lookup `useUsers` → slug → filter). Vì `useActiveStaffShifts` không support filter theo staffSlug ở BE, FE client-side filter sau khi fetch.

- [ ] **Step 1: Add search input + client-side filter**

Open `src/app/system/staff-shifts/active/page.tsx`. Add state + lookup:

```tsx
const [phonenumber, setPhonenumber] = useState<string>('')

const { data: usersData } = useUsers(
  phonenumber
    ? {
        phonenumber,
        role: Role.STAFF,
        page: 1,
        size: 1,
        order: 'DESC',
        hasPaging: true,
      }
    : null,
  !!phonenumber,
)
const matchedStaffSlug = usersData?.result?.items?.[0]?.slug
const noStaffMatch = !!phonenumber && !matchedStaffSlug

const filteredData = phonenumber
  ? data.filter((item) => item.staff.slug === matchedStaffSlug)
  : data
```

Update imports — add `useUsers` from `@/hooks`, `Role` from `@/constants`.

- [ ] **Step 2: Pass to DataTable**

Replace `data={data}` với `data={filteredData}`. Add search props:

```tsx
<DataTable
  columns={useActiveStaffShiftColumns()}
  data={filteredData}
  isLoading={isLoading}
  pages={0}
  hiddenInput={false}
  hiddenDatePicker={true}
  searchPlaceholder="Tìm theo SĐT nhân viên..."
  onInputChange={(v) => setPhonenumber(v.trim())}
  onPageChange={() => {}}
  onPageSizeChange={() => {}}
  onRowClick={handleRowClick}
/>
```

- [ ] **Step 3: Empty state**

Above DataTable, conditional banner:

```tsx
{noStaffMatch && (
  <div className="px-3 py-2 text-xs rounded border border-amber-400/40 bg-amber-50 text-amber-700">
    Không tìm thấy nhân viên có SĐT <strong>{phonenumber}</strong>
  </div>
)}
```

- [ ] **Step 4: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/app/system/staff-shifts/active/page.tsx 2>&1 | head -5
```

Expected: clean.

---

### Task 8: Multi-branch picker cho stats page

**Files:**
- Modify: `src/app/system/staff-shifts/stats/page.tsx`

Mirror pattern Phase 3 từ active page — MANAGER auto từ `branchStore`, ADMIN render `BranchSelect`.

- [ ] **Step 1: Add role + branch state**

Open `src/app/system/staff-shifts/stats/page.tsx`. Add imports:

```ts
import { BranchSelect } from '@/components/app/select'
import { useBranchStore, useUserStore } from '@/stores'
import { Role } from '@/constants'
```

Inside component:

```ts
const userInfo = useUserStore((s) => s.getUserInfo())
const { branch: storeBranch } = useBranchStore()
const role = userInfo?.role?.name
const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN

const [adminSelectedBranch, setAdminSelectedBranch] = useState<string | undefined>(
  undefined,
)
const branchSlug = isAdmin ? adminSelectedBranch : storeBranch?.slug
```

- [ ] **Step 2: Pass branchSlug to both stats queries**

Update tabs to pass branchSlug:

```tsx
<TabsContent value="by-staff" className="mt-3">
  <StatsByStaffTab startDate={startDate} endDate={endDate} branchSlug={branchSlug} />
</TabsContent>
<TabsContent value="by-date" className="mt-3">
  <StatsByDateTab startDate={startDate} endDate={endDate} branchSlug={branchSlug} />
</TabsContent>
```

Update `stats-by-staff-tab.tsx` + `stats-by-date-tab.tsx` Props interface:

```ts
interface Props {
  startDate: string
  endDate: string
  branchSlug?: string
}
```

And pass to hook: `useStaffShiftStatsByStaff({ startDate, endDate, branchSlug })` + `useStaffShiftStatsByDate({ startDate, endDate, branchSlug })`.

- [ ] **Step 3: Render picker in header**

Add `<BranchSelect>` cạnh PeriodPresetPopover (chỉ khi `isAdmin`):

```tsx
<div className="flex gap-2 items-center">
  {isAdmin && <BranchSelect onChange={setAdminSelectedBranch} />}
  <PeriodPresetPopover ... />
  <SimpleDatePicker ... />
  ...
</div>
```

- [ ] **Step 4: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/app/system/staff-shifts/stats/ 2>&1 | head -5
```

Expected: clean.

---

### Task 9: Multi-branch picker cho manager history page

**Files:**
- Modify: `src/app/system/staff-shifts/page.tsx`

Mirror Task 8 cho history page.

- [ ] **Step 1: Add role + branch state**

Open `src/app/system/staff-shifts/page.tsx`. Add imports:

```ts
import { BranchSelect } from '@/components/app/select'
import { useBranchStore, useUserStore } from '@/stores'
```

`Role` đã import từ Phase 3 work (verify với grep `Role` trong file — nếu chưa thì add).

Inside component (sau `usePagination()`):

```ts
const userInfo = useUserStore((s) => s.getUserInfo())
const { branch: storeBranch } = useBranchStore()
const role = userInfo?.role?.name
const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN

const [adminSelectedBranch, setAdminSelectedBranch] = useState<string | undefined>(
  undefined,
)
const branchSlug = isAdmin ? adminSelectedBranch : storeBranch?.slug
```

- [ ] **Step 2: Pass branchSlug to useStaffShifts**

Update hook call:

```ts
const { data, isLoading: isShiftsLoading } = useStaffShifts(
  {
    page,
    size,
    startDate: ...,
    endDate: ...,
    status,
    staffSlug: matchedStaffSlug,
    branchSlug,
  },
  shouldFetchShifts,
)
```

- [ ] **Step 3: Render picker in header**

Add `<BranchSelect>` ở header right div, trước PeriodPresetPopover:

```tsx
<div className="flex gap-2 items-center">
  {isAdmin && <BranchSelect onChange={setAdminSelectedBranch} />}
  <PeriodPresetPopover ... />
  {hasDateFilter && (...clear button...)}
</div>
```

- [ ] **Step 4: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/app/system/staff-shifts/page.tsx 2>&1 | head -5
npx vitest run 2>&1 | tail -5
```

Expected: clean. 517 PASS.

---

## SECTION D — Regression (Task 10)

### Task 10: Full regression + manual smoke

- [ ] **Step 1: All tests**

```bash
npx vitest run 2>&1 | tail -5
```
Expected: 517 PASS (no new tests added in Phase 4 — out of scope per Section E).

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -10
```
Expected: PASS. Bundle size may grow ~5-10kb từ echarts chunk (đã shared).

- [ ] **Step 3: Sanity grep no orphans**

```bash
grep -rn "useMyStaffShifts\|getMyStaffShifts" src/ --include='*.tsx' --include='*.ts'
```
Expected: empty.

- [ ] **Step 4: Smoke as STAFF**

1. Login STAFF + mở ca + tạo 2 orders
2. Indicator dropdown → "Đơn trong ca" expand → thấy 2 đơn
3. Click "Lịch sử ca của tôi" → `/staff/my-shifts`
4. "Khoảng thời gian" button → "7 ngày qua" → list narrow
5. Indicator dropdown → "Đóng ca" → form → confirm → **summary modal hiện ra** (Task 4) với 3 stat + variance nếu có
6. "Đóng và đăng xuất" → navigate ra login

- [ ] **Step 5: Smoke as MANAGER**

1. Login MANAGER → sidebar "Quản lý ca nhân viên"
2. "Đang làm việc" → search SĐT staff thuộc branch → table narrow → click row → dialog
3. "Lịch sử ca" → search SĐT + period preset + status filter → cumulative narrow
4. "Thống kê" → toggle 2 tabs (Theo nhân viên / Theo ngày)
5. By-date tab → chart line + table
6. Period preset → "Tháng này" → 2 dates auto fill + queries re-fetch

- [ ] **Step 6: Smoke as ADMIN**

1. Login ADMIN → sidebar có menu
2. "Đang làm việc" → **BranchSelect** xuất hiện → đổi branch → data refetch
3. "Lịch sử ca" → BranchSelect + search SĐT + period → cumulative narrow
4. "Thống kê" → BranchSelect ở header → đổi branch → cả 2 tab refetch

---

## SECTION E — BE-blocked items (KHÔNG implement đợt này)

Các features sau cần BE coordination — document để track follow-up:

### E.1 — Force-close shift cho manager
- **BE deps**: Endpoint `PATCH /staff-shifts/{slug}/force-close` cho MANAGER+
- **FE work khi unblock**: Add `forceCloseShift` API + hook + "Force close" button trên detail page
- **Note doc**: `docs/superpowers/notes/2026-06-09-manager-force-close-shift.md`

### E.2 — Excel export
- **BE deps**: Endpoint `GET /staff-shifts/export?format=xlsx&...` trả file binary
- **FE work khi unblock**: Add "Export" button trên history + stats pages, dùng axios responseType blob, trigger download
- **Defer**: Sau khi BE confirm endpoint shape

### E.3 — WebSocket realtime
- **BE deps**: WebSocket server với events `shift.opened`, `shift.closed`, `shift.updated`
- **FE work khi unblock**: Subscribe trong active dashboard + indicator, invalidate queries on event, bỏ polling
- **Defer**: BE chưa có WS infrastructure cho shifts

### E.4 — Push notification khi staff mở/đóng ca
- **BE deps**: BE emit FCM message khi staff mở/đóng ca
- **FE work khi unblock**: Add handler trong `notification-provider.tsx` cho `STAFF_SHIFT_OPENED` + `STAFF_SHIFT_CLOSED` codes, show toast + invalidate queries
- **Defer**: BE chưa wire notification cho shift events

### E.5 — `STAFF_SHIFT` permission swap
- **BE deps**: Add `'STAFF_SHIFT'` vào JWT scope cho MANAGER/ADMIN/SUPER_ADMIN
- **FE work khi unblock**: Trong `src/router/routes.ts:118,123,128,133` đổi `Permission.ORDER_MANAGEMENT` → `Permission.STAFF_SHIFT_MANAGEMENT` (TODO comment đã đặt ở line 114)
- **1-line change**, có thể làm ngay khi BE confirm

---

## Self-Review

**Spec coverage** (Section A-D):
- Stats by-date types + API + hook ↔ Task 1. ✓
- Stats page tabs + by-date table ↔ Task 2. ✓
- By-date chart (echarts revenue + orders trend) ↔ Task 3. ✓
- Close-shift summary modal ↔ Task 4. ✓
- Period preset popover component ↔ Task 5. ✓
- Wire period preset 3 pages ↔ Task 6. ✓
- Search SĐT active dashboard ↔ Task 7. ✓
- Multi-branch picker stats ↔ Task 8. ✓
- Multi-branch picker history ↔ Task 9. ✓
- Regression ↔ Task 10. ✓

**Section E** documented, không có task implement — intentional (BE-blocked).

**Type consistency**:
- `IStaffShiftStatsByDate.date` defined Task 1, consumed Task 2 (columns) + Task 3 (chart sort + axis label).
- `IStaffShiftStatsQuery` reused (Phase 3) for both `useStaffShiftStatsByStaff` and `useStaffShiftStatsByDate` — same shape `{ branchSlug?, startDate, endDate }`.
- `branchSlug?: string` propagates: page state → tab Props → hook query. Same key everywhere.
- `PeriodPresetPopover.onApply(start, end)` callback signature consistent at Tasks 5 + 6 (all 3 wires).
- `BranchSelect` `onChange: (slug: string) => void` consistent ở Tasks 7 + 8 (đã xài Phase 3).

**Placeholder scan**: none. All code blocks complete.

**Risks**:
1. **Close-shift dialog refactor (Task 4 Step 2)** — chưa show exact diff vì cần đọc current file. Implementer cần tìm chỗ `onClosed?.()` được call, inject `setClosedShift(result.result)` before. Nếu hiện tại không capture `result` từ mutation thì add `mutateAsync` pattern. Plan budget 30 phút; nếu phức tạp escalate.
2. **Echarts bundle size** — `echarts` đã import elsewhere (revenue page) nên chunk shared. By-date chart sẽ tree-shake nếu lazy-loaded. Acceptable.
3. **BranchSelect onChange ref stability** (đã fix Phase 3): pass `setAdminSelectedBranch` setter trực tiếp, không inline arrow function — tránh infinite loop.
4. **`useUsers` returns null when q is null** — `useUsers(null, false)` returns `{data: undefined}`. Optional chaining cần thiết: `usersData?.result?.items?.[0]?.slug`.
5. **Stats date range bắt buộc** — by-date query needs both dates. PeriodPresetPopover always emits both. Default fallback (30 days) đã ở Phase 3. OK.
6. **Permission `ORDER_MANAGEMENT` tạm** — vẫn chờ BE add `STAFF_SHIFT` (Section E.5). Plan không fix item này.

**Estimate**:
- Section A: 1 ngày
- Section B: 1-1.5 ngày
- Section C: 0.5-1 ngày
- Total: ~2.5-3.5 ngày

**Out of scope** (defer plan riêng):
- Unit/integration tests cho staff-shift hooks + pages
- Full i18n translation cho headers + columns
- Mobile responsive tweaks (current layout OK desktop, mobile chưa test)
