# Staff Shift Edge Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Phase 1 staff shift with 3 edge case UX improvements: warn when shift has been open too long (>10h), warn before logout while shift is active, and verify whether BE supports manager force-close (implement if yes, document if no).

**Architecture:** Pure additive — 1 helper, 2 small UI states on existing components, 1 logout interceptor. No new routes, no API changes (unless BE confirms force-close endpoint exists). Total ~1-2 days work.

**Tech Stack:** React 18, Zustand, shadcn UI (Dialog, AlertDialog), Vitest, TypeScript.

**Out of scope:**
- Auto-close timeout from BE (server-side concern)
- Notification system for "ca quá dài" — just visual change, no toast
- Logout warning for non-STAFF (only STAFF has shifts)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/staff-shift-helpers.ts` | Modify | Add `isLongShift(durationMinutes)` predicate (threshold = 10h) |
| `src/lib/__tests__/staff-shift-helpers.test.ts` | Modify | +3 tests for `isLongShift` |
| `src/components/staff/current-shift-indicator.tsx` | Modify | Apply warning color + tooltip when `isLongShift` is true |
| `src/components/staff/logout-during-shift-warning.tsx` | Create | Reusable AlertDialog component asking confirmation before logout |
| `src/components/app/dropdown/system-profile-dropdown.tsx` | Modify (conditional) | Intercept "Đăng xuất" click → check active shift → show warning if any |
| `docs/superpowers/notes/2026-06-09-manager-force-close-shift.md` | Create (or skip) | Document BE inquiry result for manager force-close shift |

---

### Task 1: `isLongShift` helper + tests

**Files:**
- Modify: `src/lib/staff-shift-helpers.ts`
- Modify: `src/lib/__tests__/staff-shift-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/lib/__tests__/staff-shift-helpers.test.ts`, append:

```ts
import { isLongShift } from '../staff-shift-helpers'

describe('isLongShift', () => {
  it('returns false for shifts under 10 hours', () => {
    expect(isLongShift(599)).toBe(false) // 9h 59m
  })

  it('returns true at exactly 10 hours', () => {
    expect(isLongShift(600)).toBe(true) // 10h
  })

  it('returns true for shifts over 10 hours', () => {
    expect(isLongShift(720)).toBe(true) // 12h
  })

  it('returns false for null/undefined', () => {
    expect(isLongShift(null)).toBe(false)
    expect(isLongShift(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run failing tests**

Run: `npx vitest run src/lib/__tests__/staff-shift-helpers.test.ts -t isLongShift`
Expected: 4 FAIL — `isLongShift is not exported`.

- [ ] **Step 3: Implement**

Append to `src/lib/staff-shift-helpers.ts`:

```ts
const LONG_SHIFT_THRESHOLD_MINUTES = 600 // 10 hours

/**
 * Returns true when shift has been open for 10+ hours.
 * Used to visually flag shifts the staff likely forgot to close.
 */
export function isLongShift(durationMinutes: number | null | undefined): boolean {
  if (durationMinutes === null || durationMinutes === undefined) return false
  return durationMinutes >= LONG_SHIFT_THRESHOLD_MINUTES
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/lib/__tests__/staff-shift-helpers.test.ts`
Expected: 13 PASS (9 existing + 4 new).

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean.

---

### Task 2: Apply long-shift warning style on `CurrentShiftIndicator`

**Files:**
- Modify: `src/components/staff/current-shift-indicator.tsx`

When `isLongShift(shift.durationMinutes)` is true, swap chip color from primary (gold) → orange and add `title` tooltip.

- [ ] **Step 1: Add import**

In `src/components/staff/current-shift-indicator.tsx`, add `isLongShift` to the existing import from helpers:

```ts
import { formatShiftDuration, isLongShift } from '@/lib/staff-shift-helpers'
```

- [ ] **Step 2: Apply conditional classes + title**

Find the Button at the top of the component (the chip). Update className + add `title`:

```tsx
const longShift = isLongShift(shift.durationMinutes)

return (
  <>
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        title={longShift ? 'Ca đã mở hơn 10 tiếng — bạn nên đóng ca' : undefined}
        className={
          longShift
            ? 'flex items-center gap-2 border-orange-400/60 bg-orange-400/10 text-orange-500 hover:bg-orange-400/20'
            : 'flex items-center gap-2 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
        }
      >
        <Clock className="h-4 w-4" />
        <span className="text-xs font-semibold">
          Ca: {formatShiftDuration(shift.durationMinutes)} · {shift.totalOrders} đơn
        </span>
        <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
      </Button>
      ...
```

Place `const longShift = ...` right above the `return` statement so it's computed once per render.

Also update the duration line inside the dropdown to highlight the warning. Find the existing:
```tsx
<div className="flex justify-between">
  <span className="text-muted-foreground">Đã làm</span>
  <span className="font-semibold text-primary">{formatShiftDuration(shift.durationMinutes)}</span>
</div>
```

Replace with:
```tsx
<div className="flex justify-between">
  <span className="text-muted-foreground">Đã làm</span>
  <span className={`font-semibold ${longShift ? 'text-orange-500' : 'text-primary'}`}>
    {formatShiftDuration(shift.durationMinutes)}
  </span>
</div>
```

And inside the dropdown panel, add a warning banner ABOVE the "Đóng ca" button when long shift:

Find:
```tsx
<div className="mt-3 border-t pt-3">
  <Button onClick={() => { setOpen(false); setCloseOpen(true) }} className="w-full">
    <LogOut className="mr-2 h-4 w-4" />
    Đóng ca
  </Button>
</div>
```

Replace with:
```tsx
<div className="mt-3 border-t pt-3 space-y-2">
  {longShift && (
    <div className="rounded-md border border-orange-400/40 bg-orange-400/10 px-3 py-2 text-xs text-orange-700">
      ⚠ Ca đã mở hơn 10 tiếng. Hãy đóng ca nếu đã hết giờ làm.
    </div>
  )}
  <Button onClick={() => { setOpen(false); setCloseOpen(true) }} className="w-full">
    <LogOut className="mr-2 h-4 w-4" />
    Đóng ca
  </Button>
</div>
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/current-shift-indicator.tsx 2>&1 | head -5`
Run: `npx vitest run 2>&1 | tail -5`
Expected: all clean + 532 PASS (528 existing + 4 from Task 1).

- [ ] **Step 4: Manual smoke**

Hard to simulate 10h shift in dev. Workaround: temporarily change `LONG_SHIFT_THRESHOLD_MINUTES` to `5` in helpers + open a shift, wait 5 minutes → chip turns orange, dropdown shows warning banner. Revert threshold after verifying.

---

### Task 3: `LogoutDuringShiftWarning` component

**Files:**
- Create: `src/components/staff/logout-during-shift-warning.tsx`

Reusable AlertDialog asking "Bạn đang có ca mở. Đăng xuất sẽ không đóng ca tự động. Tiếp tục?"

- [ ] **Step 1: Check existing AlertDialog primitive**

```bash
ls /Users/phanquyetthang/terminal/app/order-ui/src/components/ui/alert-dialog* 2>&1
```

If exists, use it. If not, fall back to `Dialog` primitive (already used).

- [ ] **Step 2: Implement**

Create `src/components/staff/logout-during-shift-warning.tsx`:

```tsx
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function LogoutDuringShiftWarning({ open, onOpenChange, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Bạn đang có ca mở</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Đăng xuất sẽ <strong>không tự đóng ca</strong>. Ca vẫn ACTIVE trên server đến khi bạn đăng nhập lại và đóng ca thủ công.
        </p>
        <p className="text-sm text-muted-foreground">
          Bạn có chắc muốn đăng xuất không?
        </p>
        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Quay lại
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
            className="bg-destructive text-white hover:bg-destructive/80"
          >
            Vẫn đăng xuất
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/staff/logout-during-shift-warning.tsx 2>&1 | head -5`
Expected: clean.

---

### Task 4: Wire logout warning into SystemProfileDropdown

**Files:**
- Modify: `src/components/app/dropdown/system-profile-dropdown.tsx`

Intercept "Đăng xuất" click → check active shift → show warning if any. If user confirms, proceed with logout.

- [ ] **Step 1: Read existing dropdown**

```bash
cat /Users/phanquyetthang/terminal/app/order-ui/src/components/app/dropdown/system-profile-dropdown.tsx | head -80
```

Identify:
- Where logout is triggered (likely a menu item with `onClick={handleLogout}`)
- What `handleLogout` does (clears stores + navigates)
- Whether the dropdown is rendered for all roles or staff-only

- [ ] **Step 2: Add active-shift check + warning state**

In `src/components/app/dropdown/system-profile-dropdown.tsx`, add imports at top:

```ts
import { useState } from 'react'
import { useUserStore } from '@/stores'
import { useGetCurrentStaffShift } from '@/hooks'
import { Role } from '@/constants'
import { LogoutDuringShiftWarning } from '@/components/staff/logout-during-shift-warning'
```

(Adjust if `useState`, `useUserStore` already imported — fold.)

Inside the component, add state + role/shift check:

```ts
const [warningOpen, setWarningOpen] = useState(false)
const userInfo = useUserStore((s) => s.getUserInfo())
const isStaff = userInfo?.role?.name === Role.STAFF
const { data: shift } = useGetCurrentStaffShift(isStaff)
```

Update the logout handler. Find existing pattern (likely `handleLogout` calling `setLogout` + navigate). Wrap with check:

```ts
const handleLogoutClick = () => {
  if (isStaff && shift) {
    setWarningOpen(true)
    return
  }
  performLogout() // existing logout actions
}
```

Rename existing `handleLogout` body to `performLogout` (the actual logout effect), and bind `handleLogoutClick` to the menu item.

At the end of the JSX, render the warning dialog:

```tsx
<LogoutDuringShiftWarning
  open={warningOpen}
  onOpenChange={setWarningOpen}
  onConfirm={performLogout}
/>
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/app/dropdown/system-profile-dropdown.tsx 2>&1 | head -5`
Run: `npx vitest run 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 4: Manual smoke**

1. Login as STAFF + mở ca.
2. Click avatar dropdown → "Đăng xuất" → expected warning dialog.
3. Click "Quay lại" → dialog closes, NOT logged out.
4. Click "Vẫn đăng xuất" → logout proceeds, back to login screen.
5. Login as MANAGER/ADMIN → click "Đăng xuất" → expected: logout immediately, no warning (no shift to check).

---

### Task 5: Document manager force-close inquiry

**Files:**
- Create: `docs/superpowers/notes/2026-06-09-manager-force-close-shift.md`

The plan doc for staff shifts doesn't mention a manager-force-close endpoint. Verify with BE team. If exists → add Phase 2 task. If not → document why FE can't implement.

- [ ] **Step 1: Check existing API doc**

```bash
grep -in "force.*close\|admin.*close\|manager.*close" /Users/phanquyetthang/terminal/app/order-ui/src/docs/feature-management-staff-shifts-FE-Tester.md
```

Expected: no matches (doc doesn't mention force-close).

- [ ] **Step 2: Write note**

Create `docs/superpowers/notes/2026-06-09-manager-force-close-shift.md`:

```md
# Manager Force-Close Shift — Inquiry

**Status**: Pending BE clarification.

## Problem

Per `src/docs/feature-management-staff-shifts-FE-Tester.md`:
- Only STAFF role can call `PATCH /staff-shifts/close`.
- The doc lists permission table where MANAGER/ADMIN/SUPER_ADMIN do NOT have close permission.

This leaves no recovery path when:
- Staff forgets to close ca (cứ qua đêm)
- Staff bỏ về không đóng ca
- Staff laptop/tablet hỏng giữa ca, không thể login lại

The ca stays ACTIVE on server, blocking the staff from opening a new ca next day.

## Questions for BE team

1. Is there an admin/manager endpoint to force-close a staff's shift?
2. If not, is there an auto-close after N hours of inactivity?
3. What's the intended workaround when staff cannot close their own shift?

## FE side once BE confirms

| BE answer | FE work |
|---|---|
| Has endpoint `PATCH /staff-shifts/{slug}/force-close` for MANAGER+ | Add `forceCloseShift` API + hook + admin UI button in shift detail page (Phase 2/3) |
| Has auto-close after X hours | No FE work needed; add tooltip on long-shift indicator explaining "Sẽ tự đóng sau X giờ" |
| No solution exists | Block this PR; raise as P0 to product/BE |

## Action
- [ ] Send this doc to BE lead via Slack/Linear
- [ ] Update plan when answer received
```

- [ ] **Step 3: Verify file exists**

```bash
ls /Users/phanquyetthang/terminal/app/order-ui/docs/superpowers/notes/2026-06-09-manager-force-close-shift.md
```
Expected: file listed.

---

### Task 6: Full regression

- [ ] **Step 1: Run all tests**

Run: `npx vitest run 2>&1 | tail -5`
Expected: 532 PASS (528 + 4 new).

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 3: End-to-end manual smoke**

Combine Tasks 2 + 4 smoke scenarios. Record PASS/FAIL.

---

## Self-Review

**Spec coverage**:
- Long-shift warning (>10h) ↔ Task 1 (helper) + Task 2 (UI). ✓
- Logout-during-shift warning ↔ Task 3 (component) + Task 4 (wiring). ✓
- Manager force-close ↔ Task 5 (document inquiry; defer impl until BE confirms). ✓
- Regression ↔ Task 6. ✓

**Type consistency**:
- `isLongShift(number | null | undefined): boolean` consistent across helper + caller.
- `LogoutDuringShiftWarning` props (open/onOpenChange/onConfirm) consistent at component def + caller.

**Placeholder scan**: none.

**Risks**:
- Task 4 requires reading existing dropdown structure — implementer might find logout logic spread across multiple files. If complex, may take longer than 1 hour. Plan budgets it as a small task; if implementer reports >2x effort, escalate.
- 10h threshold is arbitrary. May want config-driven later. Out of scope for Phase 1 polish.
