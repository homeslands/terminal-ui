# Staff Shift Management — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force staff to open a shift before creating orders. Wire `/staff-shifts/*` BE endpoints into FE: shift gate (block /staff/* if no active shift), header indicator (live duration + stats), open/close dialogs (with cash + note + summary).

**Architecture:** New API client + types + hooks + 4 UI components + 1 layout wrapper + 1 mutation error handler. STAFF role only — gate is wrapped INSIDE `StaffPosLayout` so it only blocks staff routes, not admin/system. Light theme matching `/system` admin pages (per UX feedback — Cards, light tokens, no `pos-*`).

**Tech Stack:** React 18, TanStack Query v5, Zustand (for user role check), shadcn UI (Card/Dialog/Input/Button), Vitest + Testing Library, TypeScript, react-router-dom v6.

**Out of scope (Phase 2+):**
- Staff shift history list page + detail
- Manager dashboard (active staff realtime, history table, stats)
- POINT payment / loyalty points
- Manager force-close shift (BE doesn't expose this anyway)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/staff-shift.type.ts` | Create | `IStaffShift`, `IOpenShiftRequest`, `ICloseShiftRequest` interfaces |
| `src/api/staff-shift.ts` | Create | 3 functions: `openShift`, `closeShift`, `getCurrentShift` |
| `src/hooks/use-staff-shift.ts` | Create | TanStack hooks: `useOpenShift`, `useCloseShift`, `useGetCurrentShift` (polling 30s) |
| `src/constants/query.ts` | Modify | Add `QUERYKEY.currentStaffShift` |
| `src/components/staff/open-shift-screen.tsx` | Create | Full-screen gate Card with form (openingCash + submit) |
| `src/components/staff/close-shift-dialog.tsx` | Create | 2-step Dialog: form (closingCash + note) → summary modal (stats + variance) |
| `src/components/staff/current-shift-indicator.tsx` | Create | Header button "Ca: 2h30 · 5 đơn" + dropdown (details + đóng ca) |
| `src/components/staff/staff-shift-gate.tsx` | Create | Wrapper: uses `useGetCurrentShift` + role check; renders children OR open screen OR spinner |
| `src/app/staff/layout.tsx` | Modify | Wrap `<Outlet />` with `<StaffShiftGate>`; add `<CurrentShiftIndicator />` in header |
| `src/app/staff/table-order.tsx` | Modify | In `useCreateOrder` onError, detect "chưa mở ca" 400 → invalidate currentStaffShift query (triggers gate to re-render with no-shift state) |
| `src/lib/__tests__/staff-shift-helpers.test.ts` | Create | Unit tests for `formatShiftDuration`, `computeCashVariance` |
| `src/lib/staff-shift-helpers.ts` | Create | Pure helpers used by indicator + summary |
| `src/utils/index.ts` | Read-only | Verify `Role` constant exported (existing) |

**No router changes** — gate is layout-level, no new route needed.

---

### Task 1: Types + constants

**Files:**
- Create: `src/types/staff-shift.type.ts`
- Modify: `src/constants/query.ts`

- [ ] **Step 1: Create types file**

Create `src/types/staff-shift.type.ts`:

```ts
import type { IBase } from './base.type'
import type { IBranch } from './branch.type'

export type StaffShiftStatus = 'ACTIVE' | 'CLOSED'

export interface IStaffShiftStaffSummary {
  slug: string
  firstName: string
  lastName: string
  phonenumber: string
}

export interface IStaffShift extends IBase {
  staff: IStaffShiftStaffSummary
  branch: Pick<IBranch, 'slug' | 'name'>
  startTime: string
  endTime: string | null
  status: StaffShiftStatus
  openingCash: number | null
  closingCash: number | null
  note: string | null
  totalOrders: number
  totalRevenue: number
  durationMinutes?: number
}

export interface IOpenShiftRequest {
  openingCash?: number
}

export interface ICloseShiftRequest {
  closingCash?: number
  note?: string
}
```

If `IBranch` doesn't exist with `slug`+`name` shape, use a minimal inline type instead:
```ts
import type { IBase } from './base.type'

// ... rest

  branch: { slug: string; name: string }
```

Verify which works via `grep -n "export interface IBranch\b" src/types/*.ts`. Use whichever resolves cleanly.

- [ ] **Step 2: Re-export from types index**

Read `src/types/index.ts`. Append:
```ts
export * from './staff-shift.type'
```

- [ ] **Step 3: Add QUERYKEY**

In `src/constants/query.ts`, find the QUERYKEY object end. Before the closing `}`, add:

```ts
  currentStaffShift: ['currentStaffShift'],
```

(Mirror existing format — array of strings.)

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean.

---

### Task 2: API client functions

**Files:**
- Create: `src/api/staff-shift.ts`

- [ ] **Step 1: Write API functions**

Create `src/api/staff-shift.ts`:

```ts
import { http } from '@/utils'
import type {
  IApiResponse,
  IStaffShift,
  IOpenShiftRequest,
  ICloseShiftRequest,
} from '@/types'

export async function openShift(
  params: IOpenShiftRequest,
): Promise<IApiResponse<IStaffShift>> {
  const response = await http.post<IApiResponse<IStaffShift>>(
    '/staff-shifts/open',
    params,
  )
  return response.data
}

export async function closeShift(
  params: ICloseShiftRequest,
): Promise<IApiResponse<IStaffShift>> {
  const response = await http.patch<IApiResponse<IStaffShift>>(
    '/staff-shifts/close',
    params,
  )
  return response.data
}

export async function getCurrentStaffShift(): Promise<IApiResponse<IStaffShift>> {
  const response = await http.get<IApiResponse<IStaffShift>>(
    '/staff-shifts/current',
    { doNotShowLoading: true },
  )
  return response.data
}
```

The `doNotShowLoading: true` on getCurrentStaffShift mirrors what `useGetActiveOrderByTable` does — avoid showing nprogress bar for background polling.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean.

---

### Task 3: Pure helpers + tests

**Files:**
- Create: `src/lib/staff-shift-helpers.ts`
- Create: `src/lib/__tests__/staff-shift-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/staff-shift-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatShiftDuration, computeCashVariance } from '../staff-shift-helpers'

describe('formatShiftDuration', () => {
  it('formats minutes only when under 1 hour', () => {
    expect(formatShiftDuration(45)).toBe('45m')
  })

  it('formats hours only when exact multiple of 60', () => {
    expect(formatShiftDuration(120)).toBe('2h')
  })

  it('formats hours + minutes for mixed values', () => {
    expect(formatShiftDuration(150)).toBe('2h 30m')
  })

  it('returns "0m" for zero', () => {
    expect(formatShiftDuration(0)).toBe('0m')
  })

  it('handles missing/null minutes as "—"', () => {
    expect(formatShiftDuration(undefined)).toBe('—')
    expect(formatShiftDuration(null)).toBe('—')
  })
})

describe('computeCashVariance', () => {
  it('returns positive when closing cash exceeds opening + revenue (gain)', () => {
    const result = computeCashVariance({ openingCash: 500_000, closingCash: 4_000_000, totalRevenue: 3_000_000 })
    expect(result).toBe(500_000)
  })

  it('returns negative when closing cash short of expected', () => {
    const result = computeCashVariance({ openingCash: 500_000, closingCash: 3_000_000, totalRevenue: 3_000_000 })
    expect(result).toBe(-500_000)
  })

  it('returns 0 when closing cash matches expected exactly', () => {
    const result = computeCashVariance({ openingCash: 500_000, closingCash: 3_500_000, totalRevenue: 3_000_000 })
    expect(result).toBe(0)
  })

  it('returns null when any input is null (cannot compute)', () => {
    expect(computeCashVariance({ openingCash: null, closingCash: 1000, totalRevenue: 500 })).toBe(null)
    expect(computeCashVariance({ openingCash: 1000, closingCash: null, totalRevenue: 500 })).toBe(null)
  })
})
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run src/lib/__tests__/staff-shift-helpers.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement helpers**

Create `src/lib/staff-shift-helpers.ts`:

```ts
/**
 * Format shift duration in minutes to "Xh Ym" or "Xh" or "Ym" form.
 * Returns "—" for null/undefined inputs.
 */
export function formatShiftDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes === 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Variance = closingCash - openingCash - totalRevenue.
 * Positive = more cash than expected (gain).
 * Negative = short by that amount.
 * Returns null if any input is null (cannot compute).
 */
export function computeCashVariance(args: {
  openingCash: number | null
  closingCash: number | null
  totalRevenue: number
}): number | null {
  if (args.openingCash === null || args.closingCash === null) return null
  return args.closingCash - args.openingCash - args.totalRevenue
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/__tests__/staff-shift-helpers.test.ts`
Expected: 9 PASS.

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean.

---

### Task 4: TanStack hooks

**Files:**
- Create: `src/hooks/use-staff-shift.ts`
- Modify: `src/hooks/index.ts` (re-export)

- [ ] **Step 1: Write hooks**

Create `src/hooks/use-staff-shift.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { openShift, closeShift, getCurrentStaffShift } from '@/api/staff-shift'
import { QUERYKEY } from '@/constants'
import type { IOpenShiftRequest, ICloseShiftRequest } from '@/types'

export const useGetCurrentStaffShift = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.currentStaffShift],
    queryFn: () => getCurrentStaffShift(),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    // 404 = no active shift; don't retry the not-found case
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status
      if (status === 404) return false
      return failureCount < 2
    },
  })
}

export const useOpenShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: IOpenShiftRequest) => openShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.currentStaffShift] })
    },
  })
}

export const useCloseShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ICloseShiftRequest) => closeShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.currentStaffShift] })
    },
  })
}
```

Note on retry: the `error.status` shape depends on http client interceptor. If `error.status` isn't reliable, fallback to inspecting `error.message` or `error.response?.status`. Verify by reading 1-2 existing hooks that handle 404 differently (e.g. `useGetActiveOrderByTable` doesn't special-case 404 but returns `null` via `data.result`). If 404 throws → adapt retry condition accordingly. If it doesn't throw and returns `data.result === null`, simplify by removing custom retry and the `select` will produce `null` for no-shift case.

- [ ] **Step 2: Verify shape of 404 response**

Run a quick check (skip if BE 404 behavior is well-documented):
```bash
grep -rn "doNotShowLoading\|notFound" src/utils/http.ts | head -10
```

Verify how http interceptor handles 404. If `404` becomes thrown error → keep retry logic. If `404` returns `null` data → simplify hook to:

```ts
export const useGetCurrentStaffShift = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.currentStaffShift],
    queryFn: () => getCurrentStaffShift(),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result ?? null,
  })
}
```

Pick the version that matches actual interceptor behavior. The error case is more defensive — prefer it if uncertain.

- [ ] **Step 3: Re-export from hooks index**

Read `src/hooks/index.ts`. Append:
```ts
export * from './use-staff-shift'
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean.

Run: `npx eslint src/api/staff-shift.ts src/hooks/use-staff-shift.ts src/types/staff-shift.type.ts src/lib/staff-shift-helpers.ts 2>&1 | head -5`
Expected: clean.

---

### Task 5: `OpenShiftScreen` component

**Files:**
- Create: `src/components/staff/open-shift-screen.tsx`

Full-screen card with form for openingCash. Light theme per `/system` pattern. Submit triggers `useOpenShift`.

- [ ] **Step 1: Implement component**

Create `src/components/staff/open-shift-screen.tsx`:

```tsx
import { useState } from 'react'
import { Clock, Wallet, Loader2 } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { useOpenShift } from '@/hooks'
import { showErrorToastMessage, showToast } from '@/utils'

export function OpenShiftScreen() {
  const [cash, setCash] = useState<string>('')
  const { mutate: openShiftMutate, isPending } = useOpenShift()

  const handleSubmit = () => {
    const openingCash = cash.trim() === '' ? undefined : Number(cash)
    if (openingCash !== undefined && (Number.isNaN(openingCash) || openingCash < 0)) {
      showErrorToastMessage('Số tiền không hợp lệ')
      return
    }
    openShiftMutate(
      { openingCash },
      {
        onSuccess: () => {
          showToast('Đã mở ca làm việc')
        },
        onError: () => {
          showErrorToastMessage('Không thể mở ca. Vui lòng thử lại.')
        },
      },
    )
  }

  return (
    <div className="flex h-full items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Bắt đầu ca làm việc</CardTitle>
          <p className="text-xs text-muted-foreground">Mở ca trước khi tạo đơn hàng</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Tiền mặt đầu ca (tuỳ chọn)
            </label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                inputMode="numeric"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                placeholder="0"
                disabled={isPending}
                className="pl-9 pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Số tiền có sẵn ở quầy để đối soát cuối ca
            </p>
          </div>
          <Button onClick={handleSubmit} disabled={isPending} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? 'Đang mở ca…' : 'Bắt đầu ca'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/open-shift-screen.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 6: `CloseShiftDialog` component

**Files:**
- Create: `src/components/staff/close-shift-dialog.tsx`

2-step dialog. Step 1: form (closingCash + note + summary preview). Step 2: success summary modal (stats + variance + final action).

- [ ] **Step 1: Implement**

Create `src/components/staff/close-shift-dialog.tsx`:

```tsx
import { useState } from 'react'
import { CheckCircle2, Sparkles, Loader2 } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui'
import { useCloseShift } from '@/hooks'
import { formatShiftDuration, computeCashVariance } from '@/lib/staff-shift-helpers'
import { showErrorToastMessage } from '@/utils'
import type { IStaffShift } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current shift to summarize. Passed by parent (header indicator). */
  shift: IStaffShift
  /** Called after user dismisses the success summary. Parent decides what to do (vd: logout, navigate). */
  onClosed?: (closedShift: IStaffShift) => void
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

export function CloseShiftDialog({ open, onOpenChange, shift, onClosed }: Props) {
  const [step, setStep] = useState<'form' | 'summary'>('form')
  const [cash, setCash] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [closedShift, setClosedShift] = useState<IStaffShift | null>(null)

  const { mutate: closeShiftMutate, isPending } = useCloseShift()

  const handleSubmit = () => {
    const closingCash = cash.trim() === '' ? undefined : Number(cash)
    if (closingCash !== undefined && (Number.isNaN(closingCash) || closingCash < 0)) {
      showErrorToastMessage('Số tiền không hợp lệ')
      return
    }
    closeShiftMutate(
      { closingCash, note: note.trim() || undefined },
      {
        onSuccess: (data) => {
          setClosedShift(data.result)
          setStep('summary')
        },
        onError: () => {
          showErrorToastMessage('Không thể đóng ca. Vui lòng thử lại.')
        },
      },
    )
  }

  const handleFinish = () => {
    onOpenChange(false)
    if (closedShift) onClosed?.(closedShift)
    // Reset internal state on next open
    setTimeout(() => {
      setStep('form')
      setCash('')
      setNote('')
      setClosedShift(null)
    }, 200)
  }

  const variance =
    closedShift !== null
      ? computeCashVariance({
          openingCash: closedShift.openingCash,
          closingCash: closedShift.closingCash,
          totalRevenue: closedShift.totalRevenue,
        })
      : null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v) }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Đóng ca làm việc
              </DialogTitle>
            </DialogHeader>

            <Card className="shadow-none">
              <CardContent className="grid grid-cols-2 gap-y-1.5 pt-4 text-sm">
                <span className="text-muted-foreground">Thời gian</span>
                <span className="text-right font-semibold">{formatShiftDuration(shift.durationMinutes)}</span>
                <span className="text-muted-foreground">Đơn xử lý</span>
                <span className="text-right font-semibold">{shift.totalOrders}</span>
                <span className="text-muted-foreground">Doanh thu</span>
                <span className="text-right font-semibold text-primary">{formatVnd(shift.totalRevenue)}</span>
              </CardContent>
            </Card>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Tiền mặt cuối ca (tuỳ chọn)</label>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  disabled={isPending}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Ghi chú (tuỳ chọn)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={isPending}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <DialogFooter className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Huỷ
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? 'Đang đóng…' : 'Xác nhận đóng'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'summary' && closedShift && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Ca đã đóng
              </DialogTitle>
              <p className="text-center text-xs text-muted-foreground">
                Cảm ơn bạn đã làm việc {formatShiftDuration(closedShift.durationMinutes)}!
              </p>
            </DialogHeader>

            <Card className="shadow-none">
              <CardContent className="space-y-2 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Đơn xử lý</span>
                  <span className="font-semibold">{closedShift.totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Doanh thu</span>
                  <span className="font-semibold text-primary">{formatVnd(closedShift.totalRevenue)}</span>
                </div>
                {closedShift.totalOrders > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trung bình/đơn</span>
                    <span className="font-semibold">
                      {formatVnd(Math.round(closedShift.totalRevenue / closedShift.totalOrders))}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {variance !== null && (
              <Card className="shadow-none">
                <CardContent className="space-y-2 pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tiền đầu ca</span>
                    <span className="font-semibold">{formatVnd(closedShift.openingCash ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tiền cuối ca</span>
                    <span className="font-semibold">{formatVnd(closedShift.closingCash ?? 0)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Chênh lệch</span>
                    <span className={`font-semibold ${variance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {variance >= 0 ? '+' : ''}{formatVnd(variance)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button onClick={handleFinish} className="w-full">
                Đóng
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/close-shift-dialog.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 7: `CurrentShiftIndicator` component

**Files:**
- Create: `src/components/staff/current-shift-indicator.tsx`

Header button + dropdown. Button shows duration + order count. Click → dropdown with full stats + "Đóng ca" button → triggers `CloseShiftDialog`.

- [ ] **Step 1: Implement**

Create `src/components/staff/current-shift-indicator.tsx`:

```tsx
import { useState } from 'react'
import { Clock, ChevronDown, LogOut } from 'lucide-react'

import { Button } from '@/components/ui'
import { useGetCurrentStaffShift } from '@/hooks'
import { formatShiftDuration } from '@/lib/staff-shift-helpers'
import { CloseShiftDialog } from './close-shift-dialog'

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ'
}

function formatHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Props {
  /**
   * Called after user successfully closes the shift. Parent should typically
   * navigate (e.g. to login or floor plan) or refresh.
   */
  onShiftClosed?: () => void
}

export function CurrentShiftIndicator({ onShiftClosed }: Props) {
  const [open, setOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const { data: shift } = useGetCurrentStaffShift()

  if (!shift) return null

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Clock className="h-4 w-4" />
          <span className="text-xs font-semibold">
            Ca: {formatShiftDuration(shift.durationMinutes)} · {shift.totalOrders} đơn
          </span>
          <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
        </Button>

        {open && (
          <div
            className="absolute right-0 top-full z-20 mt-2 w-72 rounded-md border bg-card p-4 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Ca hiện tại
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bắt đầu</span>
                <span className="font-semibold">{formatHHMM(shift.startTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Đã làm</span>
                <span className="font-semibold text-primary">{formatShiftDuration(shift.durationMinutes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Đơn</span>
                <span className="font-semibold">{shift.totalOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Doanh thu</span>
                <span className="font-semibold">{formatVnd(shift.totalRevenue)}</span>
              </div>
            </div>
            <div className="mt-3 border-t pt-3">
              <Button
                onClick={() => { setOpen(false); setCloseOpen(true) }}
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Đóng ca
              </Button>
            </div>
          </div>
        )}
      </div>

      <CloseShiftDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        shift={shift}
        onClosed={() => {
          onShiftClosed?.()
        }}
      />

      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
    </>
  )
}
```

The trailing fixed overlay div catches outside-clicks to close the dropdown.

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/current-shift-indicator.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 8: `StaffShiftGate` wrapper

**Files:**
- Create: `src/components/staff/staff-shift-gate.tsx`

Wraps children. Uses `useGetCurrentStaffShift` and `useUserStore` to check role + shift state. Behavior:
- Non-STAFF role → render children unchanged (admin/manager pass through)
- STAFF + loading → spinner
- STAFF + no shift (404 / null data) → render `<OpenShiftScreen />` (blocks children)
- STAFF + has shift → render children

- [ ] **Step 1: Implement**

Create `src/components/staff/staff-shift-gate.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { useUserStore } from '@/stores'
import { Role } from '@/constants'
import { useGetCurrentStaffShift } from '@/hooks'
import { OpenShiftScreen } from './open-shift-screen'

interface Props {
  children: ReactNode
}

export function StaffShiftGate({ children }: Props) {
  const userInfo = useUserStore((s) => s.getUserInfo())
  const isStaff = userInfo?.role?.name === Role.STAFF

  // Only fetch when user is STAFF. Other roles bypass the gate entirely.
  const { data: shift, isLoading, isError } = useGetCurrentStaffShift(isStaff)

  if (!isStaff) return <>{children}</>

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Either 404 (caught as error, no retry) OR successfully resolved with no shift.
  if (isError || !shift) {
    return <OpenShiftScreen />
  }

  return <>{children}</>
}
```

Note: `Role.STAFF` constant exists in `src/constants/role.ts`. Verify the exact value matches what userInfo.role.name returns. If the constant uses different casing (vd `'staff'` vs `'STAFF'`), check before running.

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/staff-shift-gate.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 9: Wire into `StaffPosLayout` + indicator

**Files:**
- Modify: `src/app/staff/layout.tsx`

Add gate wrapper around `<Outlet />` and indicator in header. Also handle navigate after shift close.

- [ ] **Step 1: Update layout**

Replace `src/app/staff/layout.tsx` content with:

```tsx
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import {
  SettingsDropdown,
  SystemProfileDropdown,
} from '@/components/app/dropdown'
import { ROUTE } from '@/constants'
import { StaffShiftGate } from '@/components/staff/staff-shift-gate'
import { CurrentShiftIndicator } from '@/components/staff/current-shift-indicator'
import { useAuthStore, useUserStore } from '@/stores'

export function StaffPosLayout() {
  const navigate = useNavigate()
  const { setLogout } = useAuthStore()
  const { removeUserInfo } = useUserStore()

  const handleShiftClosed = () => {
    // After staff finishes shift, log them out and go to login.
    setLogout()
    removeUserInfo()
    navigate(ROUTE.LOGIN)
  }

  return (
    <div className="flex h-screen flex-col bg-pos-bg text-pos-text">
      <header className="flex shrink-0 items-center justify-between border-b border-pos-border bg-pos-surface px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            to={ROUTE.OVERVIEW}
            className="flex items-center gap-1 text-xs text-pos-muted transition-colors hover:text-pos-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quản lý
          </Link>
          <span className="text-sm font-bold tracking-widest text-pos-gold">THE TERMINAL</span>
        </div>
        <div className="flex items-center gap-2">
          <CurrentShiftIndicator onShiftClosed={handleShiftClosed} />
          <SettingsDropdown />
          <SystemProfileDropdown />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <StaffShiftGate>
          <Outlet />
        </StaffShiftGate>
      </div>
    </div>
  )
}
```

If `useAuthStore.setLogout` or `useUserStore.removeUserInfo` have different names, check existing usage in `src/components/app/elements/protected-element.tsx` lines 67-72 and mirror that pattern.

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/app/staff/layout.tsx 2>&1 | head -5`
Expected: clean.

Run: `npx vitest run 2>&1 | tail -5`
Expected: existing 519+ tests still pass.

---

### Task 10: Handle 400 "chưa mở ca" in createOrder

**Files:**
- Modify: `src/app/staff/table-order.tsx`

When `useCreateOrder` returns 400 with the "chưa mở ca" message, invalidate the currentStaffShift query so the gate re-renders with no-shift state (showing OpenShiftScreen).

- [ ] **Step 1: Update handleSubmitOrder catch block**

In `src/app/staff/table-order.tsx`, find `handleSubmitOrder` (around line 215). Current catch:

```ts
} catch {
  showErrorToastMessage('Không thể gửi đơn. Vui lòng thử lại.')
}
```

Replace with:

```ts
} catch (err) {
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message ?? '')
      : ''
  if (message.toLowerCase().includes('chưa mở ca') || message.toLowerCase().includes('mở ca')) {
    showErrorToastMessage('Ca đã đóng. Vui lòng mở lại ca để tiếp tục.')
    queryClient.invalidateQueries({ queryKey: [...QUERYKEY.currentStaffShift] })
  } else {
    showErrorToastMessage('Không thể gửi đơn. Vui lòng thử lại.')
  }
}
```

`queryClient` is already declared in this file (used by `invalidateActiveOrder`). `QUERYKEY` is already imported. No new imports needed.

- [ ] **Step 2: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/app/staff/table-order.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 11: Full regression

- [ ] **Step 1: Run all tests**

Run: `npx vitest run 2>&1 | tail -5`
Expected: all PASS. Net new tests: +9 (5 formatShiftDuration + 4 computeCashVariance). Existing baseline ~519 → expect ~528.

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 3: Manual smoke**

Run dev server. Login as STAFF account without active shift (or close any existing shift via API).

1. Navigate to `/staff` → expect `<OpenShiftScreen />` blocks the floor plan.
2. Fill openingCash = 500000 → click "Bắt đầu ca" → toast "Đã mở ca" → floor plan renders.
3. Header shows indicator "Ca: 0h ?m · 0 đơn". Click → dropdown with full stats.
4. Wait 30s → indicator updates duration (polling).
5. Click bàn → tạo order → ĐẶT MÓN → submit success → indicator updates orders/revenue on next poll.
6. Click indicator → "Đóng ca" → fill closingCash + note → click "Xác nhận đóng" → step 2 summary appears with variance.
7. Click "Đóng" → logout + redirect to login.

Edge cases:
- Try creating order WITHOUT shift (simulate by closing shift mid-edit then submitting): expect toast "Ca đã đóng. Vui lòng mở lại ca…" + gate re-renders.
- Login as MANAGER/ADMIN: navigate to `/staff` → gate passes through (no fetch of /current).

Record PASS/FAIL each step.

---

## Self-Review

**Spec coverage**:
- P1.1 OpenShiftDialog ↔ Task 5 (`OpenShiftScreen`). ✓
- P1.2 CloseShiftDialog ↔ Task 6 (`CloseShiftDialog` 2-step). ✓
- P1.3 CurrentShiftIndicator ↔ Task 7. ✓
- P1.4 NoActiveShiftGate ↔ Task 8 (`StaffShiftGate`). ✓
- P1.5 OrderCreate error handler ↔ Task 10. ✓
- P1.6 CloseShiftSummaryModal ↔ Task 6 step 2 (same component). ✓
- API + types + hooks foundation ↔ Tasks 1, 2, 4. ✓
- Helpers + tests ↔ Task 3. ✓
- Layout integration ↔ Task 9. ✓

**Type consistency**:
- `IStaffShift.durationMinutes` is optional (BE might omit on initial open). `formatShiftDuration` handles null/undefined.
- `openingCash`/`closingCash` are `number | null` on `IStaffShift` (server may not record), `number | undefined` on request DTOs.
- `useGetCurrentStaffShift(enabled?: boolean)` signature consistent at hook def + StaffShiftGate caller (pass isStaff).
- `CloseShiftDialog` props (open/onOpenChange/shift/onClosed) match CurrentShiftIndicator caller.
- QUERYKEY format `currentStaffShift: ['currentStaffShift']` matches existing pattern.

**Placeholder scan**: none.

**Risk notes**:
- **404 handling**: hook retry logic guesses BE returns error for 404. If actual behavior differs (returns null `data.result`), Task 4 Step 2 covers the alternative. Implementer must verify.
- **Role constant**: assumed `Role.STAFF === 'STAFF'`. If different casing, gate fails silently. Task 8 step 1 mentions verifying.
- **Logout after shift close** is opinionated. If business prefers staff to stay logged in (just open new shift later), change Task 9 `handleShiftClosed` to just refetch `/current` instead of logout. Default to logout because doc implies end-of-day workflow.
- **POS dark theme vs system light theme**: per user feedback, open + close UIs use light theme (Card-based). The indicator in POS layout header sits on dark bg but uses `border-primary/40 bg-primary/10 text-primary` which renders OK on both backgrounds.
- **Existing /staff/my-shift page**: TT-2 (3) shipped an older mock-data based page. Phase 1 doesn't touch it. Phase 2 will refactor that page to wire real APIs.
