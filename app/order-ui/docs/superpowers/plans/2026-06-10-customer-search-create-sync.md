# Customer Search + Create Sync Admin → Staff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ UI/UX tìm khách bằng SĐT + tạo tài khoản từ admin (`CustomerSearchInput` ở cart-content) sang staff (`StaffCustomerSearchInput` ở order-summary), kèm flow mới: khi search 0 kết quả → CTA "Tạo khách mới" inline pre-fill SĐT đã gõ.

**Architecture:** Refactor `CreateCustomerForm` + `CreateCustomerDialog` để accept controlled `open/onOpenChange` + `defaultPhoneNumber` + `onCreated` callback (decouple khỏi `useOrderFlowStore`). Port admin features sang staff: scan RFID/QR button, pagination scroll, active/inactive badge, loading state. Cả 2 search component thêm empty state với CTA "Tạo mới" → mở dialog pre-filled → trên success auto-select customer vừa tạo.

**Tech Stack:** React 18, TanStack Query v5, react-hook-form, Zod, shadcn (Dialog, Form), TypeScript.

**Scope:** Sync feature parity + new empty-state CTA. KHÔNG refactor sang unified shared component (giữ 2 file riêng để tránh risk break admin). KHÔNG đổi schema BE.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/components/app/form/create-customer-form.tsx` | Modify | Accept `defaultPhoneNumber?` + `onCreated?` callback. Decouple `addCustomerInfo` (existing behavior → caller responsibility). |
| `src/components/app/dialog/create-customer-dialog.tsx` | Modify | Accept controlled `open?/onOpenChange?` + `defaultPhoneNumber?` + `onCreated?`. Trigger button optional (chỉ render khi uncontrolled). |
| `src/app/system/customers/DataTable/actions/customer-action.tsx` | Modify | Pass `onCreated={addCustomerInfo}` để giữ behavior cũ (admin customer page). |
| `src/app/system/menu/components/cart-content.tsx` | Modify | Pass `onCreated={addCustomerInfo}` nếu file đang dùng CreateCustomerDialog. |
| `src/components/app/drawer/cart-drawer.tsx` | Modify | Same as above. |
| `src/components/app/input/customer-search-input.tsx` | Modify | Empty state row "Tạo khách mới với SĐT này" + controlled CreateCustomerDialog với pre-fill + on created → addCustomerInfo. |
| `src/components/staff/staff-customer-search-input.tsx` | Modify | Port admin features: scan RFID button, pagination scroll, active/inactive badge, loading state, empty state CTA. |

**Total:** 7 files. No new files.

---

### Task 1: Refactor `CreateCustomerForm` — decouple from store + add props

**Files:**
- Modify: `src/components/app/form/create-customer-form.tsx`

Hiện form auto-call `addCustomerInfo(response.result)` trong onSuccess — coupling admin-specific. Tách ra: caller pass `onCreated` callback.

- [ ] **Step 1: Update Props interface**

Find:
```ts
interface IFormCreateCustomerProps {
  onSubmit: (isOpen: boolean) => void
}
```

Replace with:
```ts
interface IFormCreateCustomerProps {
  /** Called with the open boolean after submit (true = keep open on error, false = close). */
  onSubmit: (isOpen: boolean) => void
  /** Pre-fill the phone number field (vd from search input). */
  defaultPhoneNumber?: string
  /** Called with the newly-created user. Replaces internal addCustomerInfo coupling. */
  onCreated?: (user: import('@/types').IUserInfo) => void
}
```

- [ ] **Step 2: Wire defaultPhoneNumber**

Find the `defaultValues` in useForm:
```ts
defaultValues: {
  phonenumber: '',
  password: '',
  ...
},
```

Change to:
```ts
defaultValues: {
  phonenumber: defaultPhoneNumber ?? '',
  password: '',
  ...
},
```

Also accept the new props in function signature:
```ts
export const CreateCustomerForm: React.FC<IFormCreateCustomerProps> = ({
  onSubmit,
  defaultPhoneNumber,
  onCreated,
}) => {
```

- [ ] **Step 3: Replace `addCustomerInfo` with `onCreated`**

Find:
```ts
const { addCustomerInfo } = useOrderFlowStore()
```
Remove this line (no longer needed inside form).

Remove the import if `useOrderFlowStore` is only used here:
```ts
import { useOrderFlowStore, useUserStore } from '@/stores'
// → 
import { useUserStore } from '@/stores'
```

Find the `handleSubmit` body:
```ts
const handleSubmit = (data: ICreateUserRequest) => {
  createUser(data, {
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: ['users'],
        exact: false,
        refetchType: 'all'
      })
      if (response?.result) {
        addCustomerInfo(response.result)
      }
      onSubmit(false)
      form.reset()
      showToast(t('toast.createUserSuccess'))
    },
  })
}
```

Replace `addCustomerInfo` call with `onCreated`:
```ts
const handleSubmit = (data: ICreateUserRequest) => {
  createUser(data, {
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: ['users'],
        exact: false,
        refetchType: 'all'
      })
      if (response?.result) {
        onCreated?.(response.result)
      }
      onSubmit(false)
      form.reset()
      showToast(t('toast.createUserSuccess'))
    },
  })
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/components/app/form/create-customer-form.tsx 2>&1 | head -5
```

Expected: tsc errors về `addCustomerInfo` từ existing callers (CreateCustomerDialog) — sẽ fix Task 2. Form file itself clean.

If `useOrderFlowStore` not used elsewhere in this file → remove import. If still used (vd unused import warning), clean up.

---

### Task 2: Refactor `CreateCustomerDialog` — controlled mode + pass-through props

**Files:**
- Modify: `src/components/app/dialog/create-customer-dialog.tsx`

Hiện dialog uncontrolled (own state). Cần controlled mode để caller (search input) trigger từ ngoài + pass defaultPhoneNumber + onCreated.

- [ ] **Step 1: Update Props**

Replace function signature + add props:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'

import { CreateCustomerForm } from '@/components/app/form'
import type { IUserInfo } from '@/types'

interface Props {
  /** Controlled mode — pass both open + onOpenChange to control externally. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Pre-fill phone number in the form. */
  defaultPhoneNumber?: string
  /** Called with newly-created user on success. */
  onCreated?: (user: IUserInfo) => void
  /** Hide the default trigger button (useful when caller opens dialog programmatically). */
  hideTrigger?: boolean
}

export default function CreateCustomerDialog({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  defaultPhoneNumber,
  onCreated,
  hideTrigger,
}: Props = {}) {
  const { t } = useTranslation(['customer'])
  const [internalOpen, setInternalOpen] = useState(false)

  // Controlled if BOTH open + onOpenChange are passed; else uncontrolled.
  const isControlled = openProp !== undefined && onOpenChangeProp !== undefined
  const isOpen = isControlled ? openProp : internalOpen
  const setIsOpen = isControlled ? onOpenChangeProp : setInternalOpen

  const handleSubmit = (open: boolean) => {
    setIsOpen(open)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button className="w-full gap-1" onClick={() => setIsOpen(true)}>
            {t('customer.create')}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-[90%] rounded-md p-0 sm:max-w-[50%]">
        <DialogHeader className="p-4">
          <DialogTitle>{t('customer.create')}</DialogTitle>
          <DialogDescription>
            {t('customer.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <CreateCustomerForm
          onSubmit={handleSubmit}
          defaultPhoneNumber={defaultPhoneNumber}
          onCreated={onCreated}
        />

        <DialogFooter className="flex justify-end p-4 border-t">
          <Button type="submit" form="create-customer-form">
            {t('customer.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Note: Default trigger button preserved cho backward compat (uncontrolled callers).

- [ ] **Step 2: Verify**

```bash
npx tsc -b 2>&1 | head -10
npx eslint src/components/app/dialog/create-customer-dialog.tsx 2>&1 | head -5
```

Expected: tsc errors remaining về existing admin callers (they don't pass `onCreated`) — Task 3 will fix.

---

### Task 3: Update existing admin callers — pass `onCreated`

**Files:**
- Modify: `src/app/system/customers/DataTable/actions/customer-action.tsx`
- Modify: `src/app/system/menu/components/cart-content.tsx`
- Modify: `src/components/app/drawer/cart-drawer.tsx`

Preserve existing behavior: each admin caller was relying on internal `addCustomerInfo` from form. Now form is decoupled — wire callback explicitly.

- [ ] **Step 1: Customer page action**

In `src/app/system/customers/DataTable/actions/customer-action.tsx`, find `<CreateCustomerDialog />` usage. The customer page doesn't need `onCreated` (just creates user for admin list — no select needed). Leave as-is (uncontrolled trigger button visible):

```tsx
<CreateCustomerDialog />
```

No change needed for this file. Verify the JSX is still valid. (If TypeScript complains because of stricter props, ensure the default `{}` works.)

- [ ] **Step 2: cart-content**

In `src/app/system/menu/components/cart-content.tsx`, find `<CreateCustomerDialog />` usage. If admin cart-content wants the new customer auto-selected as cart owner, pass:

```tsx
import { useOrderFlowStore } from '@/stores'
// ... inside component:
const { addCustomerInfo } = useOrderFlowStore()
// ...
<CreateCustomerDialog onCreated={(user) => addCustomerInfo(user)} />
```

If the file already has `useOrderFlowStore` destructure, just add `addCustomerInfo` to it.

- [ ] **Step 3: cart-drawer**

Same pattern as Step 2 for `src/components/app/drawer/cart-drawer.tsx`.

- [ ] **Step 4: Verify**

```bash
npx tsc -b 2>&1 | head -10
npx eslint src/app/system/customers/DataTable/actions/customer-action.tsx src/app/system/menu/components/cart-content.tsx src/components/app/drawer/cart-drawer.tsx 2>&1 | head -10
npx vitest run 2>&1 | tail -5
```

Expected: tsc + eslint clean, 517 tests PASS.

---

### Task 4: Admin `CustomerSearchInput` — empty state with "Tạo mới" CTA

**Files:**
- Modify: `src/components/app/input/customer-search-input.tsx`

When search has value + 0 results + not loading → show CTA row inside dropdown. Click → open controlled `CreateCustomerDialog` pre-filled with current input.

- [ ] **Step 1: Add state + dialog import**

In `src/components/app/input/customer-search-input.tsx`, add imports:

```ts
import CreateCustomerDialog from '@/components/app/dialog/create-customer-dialog'
import { UserPlus } from 'lucide-react'
```

Inside component, add state:

```ts
const [isCreateOpen, setIsCreateOpen] = useState(false)
```

- [ ] **Step 2: Render empty CTA**

Find the user list dropdown block:
```tsx
{users.length > 0 && (
  <div ref={userListRef} onScroll={handleScroll} ...>
    {users.map(...)}
  </div>
)}
```

Add a sibling block AFTER it for empty state:

```tsx
{users.length === 0 && debouncedInputValue && !userByPhoneNumber && (
  <div className="overflow-y-auto absolute z-50 mt-11 w-full bg-white rounded-md border shadow-lg dark:bg-background">
    <button
      type="button"
      onClick={() => setIsCreateOpen(true)}
      className="flex gap-2 items-center p-3 w-full text-left transition hover:bg-primary/10"
    >
      <div className="flex justify-center items-center p-2 rounded-full bg-primary/10">
        <UserPlus className="w-4 h-4 text-primary" />
      </div>
      <div>
        <div className="text-sm font-semibold">Tạo khách mới</div>
        <div className="text-xs text-muted-foreground">
          với SĐT <strong>{debouncedInputValue}</strong>
        </div>
      </div>
    </button>
  </div>
)}
```

Note: condition is fired when search debounced + has no results (the API returned but items empty, or fetch hasn't resolved yet — we use `!userByPhoneNumber` to mean "no data yet" OR "no items"). To make it more precise:

Refine:
```tsx
{debouncedInputValue && users.length === 0 && userByPhoneNumber?.result?.items?.length === 0 && (
  ...CTA above
)}
```

Show CTA only when API explicitly returned 0 items (not while loading).

- [ ] **Step 3: Render controlled dialog**

At the end of the component (after `<ScanRFIDCustomerDialog ... />`), add:

```tsx
<CreateCustomerDialog
  hideTrigger
  open={isCreateOpen}
  onOpenChange={setIsCreateOpen}
  defaultPhoneNumber={debouncedInputValue}
  onCreated={(user) => {
    handleAddOwner(user)
    setIsCreateOpen(false)
  }}
/>
```

- [ ] **Step 4: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/components/app/input/customer-search-input.tsx 2>&1 | head -5
```

Expected: clean.

- [ ] **Step 5: Manual smoke**

Admin /system/menu cart-content:
1. Gõ SĐT không tồn tại (vd `0999999999`) → dropdown hiện "Tạo khách mới với SĐT 0999999999"
2. Click → CreateCustomerDialog mở với phonenumber pre-filled
3. Điền thông tin + submit → user mới được tạo → tự động set làm owner cart

---

### Task 5: Sync admin features to `StaffCustomerSearchInput` — scan + pagination + active badge + loading

**Files:**
- Modify: `src/components/staff/staff-customer-search-input.tsx`

Port admin's `CustomerSearchInput` features sang staff. Giữ POS theme tokens.

- [ ] **Step 1: Add imports**

```ts
import { useEffect, useRef, useState } from 'react'
import { CircleX, User2Icon, Scan, Loader2 } from 'lucide-react'

import { Input, Button } from '@/components/ui'
import { ScanRFIDCustomerDialog } from '@/components/app/dialog'
import { useDebouncedInput, usePagination, useUsers } from '@/hooks'
import { Role } from '@/constants'
import type { IUserInfo } from '@/types'
import type { TableCustomer } from '@/types/session'
```

- [ ] **Step 2: Add state + hooks**

Replace component body's state section:

```tsx
const { inputValue, setInputValue, debouncedInputValue } = useDebouncedInput()
const [showList, setShowList] = useState(false)
const [users, setUsers] = useState<IUserInfo[]>([])
const [isRFIDDialogOpen, setIsRFIDDialogOpen] = useState(false)
const [scannedIdentityCode, setScannedIdentityCode] = useState<string>('')
const { pagination, setPagination } = usePagination()
const userListRef = useRef<HTMLDivElement>(null)

// Search by identity (QR scan)
const { data: userByIdentityCode, isFetching: isFetchingIdentityCode } = useUsers(
  scannedIdentityCode
    ? {
        order: 'DESC',
        page: 1,
        size: 10,
        slug: scannedIdentityCode,
        role: Role.CUSTOMER,
        hasPaging: false,
      }
    : null,
  !!scannedIdentityCode,
)

// Search by phone number with pagination
const { data: userByPhone, isFetching: isFetchingByPhone } = useUsers(
  debouncedInputValue
    ? {
        order: 'DESC',
        page: pagination.pageIndex,
        size: pagination.pageSize,
        phonenumber: debouncedInputValue,
        role: Role.CUSTOMER,
        hasPaging: true,
      }
    : null,
  !!debouncedInputValue && !disabled,
)
```

Remove the old `usersData` + `users = usersData?.result?.items ?? []`.

- [ ] **Step 3: Wire users state + scroll**

Add useEffect to populate users:

```tsx
useEffect(() => {
  if (debouncedInputValue === '') {
    setUsers([])
    return
  }
  if (userByPhone?.result?.items) {
    if (pagination.pageIndex === 1) {
      setUsers(userByPhone.result.items)
    } else {
      setUsers((prev) => [...prev, ...userByPhone.result.items])
    }
  }
}, [debouncedInputValue, userByPhone, pagination.pageIndex])

const handleScroll = () => {
  if (userListRef.current) {
    const { scrollTop, scrollHeight, clientHeight } = userListRef.current
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setPagination((prev) => ({ ...prev, pageIndex: prev.pageIndex + 1 }))
    }
  }
}
```

- [ ] **Step 4: Wire identity code (scan) handler**

Add useEffect for scan result:

```tsx
const handleSelectRef = useRef<(u: IUserInfo) => void>(() => {})
handleSelectRef.current = (u) => {
  onSelect(toTableCustomer(u))
  setInputValue('')
  setShowList(false)
}

useEffect(() => {
  if (!scannedIdentityCode) return
  if (isFetchingIdentityCode) return
  const items = userByIdentityCode?.result?.items
  if (!items) return
  if (items.length === 1 && items[0].isActive) {
    handleSelectRef.current(items[0])
    setIsRFIDDialogOpen(false)
  }
  setScannedIdentityCode('')
}, [userByIdentityCode, scannedIdentityCode, isFetchingIdentityCode])
```

- [ ] **Step 5: Update JSX — input + scan button + dropdown with active badge + loading + scroll**

Replace the existing return JSX entirely. Selected display stays same; the search input adds scan button beside it; dropdown shows loading row when fetching with empty users, active badge per user, scroll handler:

```tsx
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

const showLoading = !!debouncedInputValue && isFetchingByPhone && users.length === 0
const showEmpty =
  !!debouncedInputValue &&
  !isFetchingByPhone &&
  users.length === 0 &&
  userByPhone?.result?.items?.length === 0

return (
  <>
    <div className="relative">
      <div className="flex gap-2">
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
          className="flex-1 rounded border border-pos-border bg-pos-card px-3 py-1.5 text-xs placeholder:text-pos-faint"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsRFIDDialogOpen(true)}
          disabled={disabled}
          aria-label="Quét thẻ thành viên"
          className="shrink-0"
        >
          <Scan className="w-3.5 h-3.5" />
        </Button>
      </div>
      {showList && (showLoading || users.length > 0 || showEmpty) && (
        <div
          ref={userListRef}
          onScroll={handleScroll}
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border border-pos-border bg-pos-card shadow-lg"
        >
          {showLoading && (
            <div className="flex justify-center items-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-pos-faint" />
            </div>
          )}
          {!showLoading && users.length > 0 && users.map((u) => (
            <button
              key={u.slug}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!u.isActive) return
                onSelect(toTableCustomer(u))
                setInputValue('')
                setShowList(false)
              }}
              className={`flex gap-2 items-center w-full px-3 py-2 text-left text-xs ${
                u.isActive
                  ? 'hover:bg-pos-hover cursor-pointer'
                  : 'cursor-not-allowed opacity-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-pos-text truncate">
                  {u.lastName} {u.firstName}
                </div>
                <div className="text-[10px] text-pos-faint truncate">{u.phonenumber}</div>
              </div>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  u.isActive
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-red-500/15 text-red-500'
                }`}
              >
                {u.isActive ? 'Hoạt động' : 'Khoá'}
              </span>
            </button>
          ))}
          {showEmpty && (
            <div className="py-3 px-3 text-xs text-center text-pos-faint">
              Không tìm thấy khách với SĐT này
            </div>
          )}
        </div>
      )}
    </div>

    <ScanRFIDCustomerDialog
      isOpen={isRFIDDialogOpen}
      onOpenChange={setIsRFIDDialogOpen}
      onUserSelect={(user) => {
        if (!user.isActive) return
        onSelect(toTableCustomer(user))
        setIsRFIDDialogOpen(false)
      }}
      onQrTokenScanned={(token) => setScannedIdentityCode(token)}
      defaultTab="rfid"
    />
  </>
)
```

NOTE: Empty state currently shows "Không tìm thấy" plain text — the "Tạo mới" CTA is Task 6.

- [ ] **Step 6: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/components/staff/staff-customer-search-input.tsx 2>&1 | head -5
npx vitest run 2>&1 | tail -5
```

Expected: clean. May need to verify props/import paths.

---

### Task 6: Staff search — empty state CTA "Tạo mới" + wire CreateCustomerDialog

**Files:**
- Modify: `src/components/staff/staff-customer-search-input.tsx`

Replace "Không tìm thấy" plain text với CTA tương tự admin (Task 4).

- [ ] **Step 1: Add imports**

```ts
import { UserPlus } from 'lucide-react'
import CreateCustomerDialog from '@/components/app/dialog/create-customer-dialog'
```

- [ ] **Step 2: Add state**

Inside component:
```ts
const [isCreateOpen, setIsCreateOpen] = useState(false)
```

- [ ] **Step 3: Replace empty text với CTA button**

Find the empty state block from Task 5 step 5:
```tsx
{showEmpty && (
  <div className="py-3 px-3 text-xs text-center text-pos-faint">
    Không tìm thấy khách với SĐT này
  </div>
)}
```

Replace with CTA:
```tsx
{showEmpty && (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => setIsCreateOpen(true)}
    className="flex gap-2 items-center w-full p-3 text-left transition hover:bg-pos-hover"
  >
    <div className="flex justify-center items-center p-1.5 rounded-full bg-pos-gold/10 shrink-0">
      <UserPlus className="w-3.5 h-3.5 text-pos-gold" />
    </div>
    <div className="min-w-0">
      <div className="text-xs font-semibold text-pos-text">Tạo khách mới</div>
      <div className="text-[10px] text-pos-faint truncate">
        với SĐT {debouncedInputValue}
      </div>
    </div>
  </button>
)}
```

- [ ] **Step 4: Render controlled dialog**

After `<ScanRFIDCustomerDialog />`, add:

```tsx
<CreateCustomerDialog
  hideTrigger
  open={isCreateOpen}
  onOpenChange={setIsCreateOpen}
  defaultPhoneNumber={debouncedInputValue}
  onCreated={(user) => {
    onSelect(toTableCustomer(user))
    setInputValue('')
    setShowList(false)
    setIsCreateOpen(false)
  }}
/>
```

- [ ] **Step 5: Verify**

```bash
npx tsc -b 2>&1 | head -5
npx eslint src/components/staff/staff-customer-search-input.tsx 2>&1 | head -5
```

Expected: clean.

---

### Task 7: Regression + manual smoke

- [ ] **Step 1: Full test suite + build**

```bash
npx vitest run 2>&1 | tail -5
npm run build 2>&1 | tail -5
```

Expected: 517 PASS, build success.

- [ ] **Step 2: Manual smoke admin**

1. Login admin → `/system/menu` cart-content
2. Gõ SĐT không tồn tại → CTA "Tạo khách mới với SĐT ..." hiện ra
3. Click → CreateCustomerDialog mở với phonenumber pre-filled
4. Điền lastName/firstName/password/dob → Submit → toast success → user mới làm owner cart
5. Scan RFID/QR (nếu có hardware test) → user select OK
6. Gõ SĐT tồn tại → dropdown list + active badge + scroll pagination

- [ ] **Step 3: Manual smoke staff**

1. Login STAFF + mở ca + vào `/staff/table/<id>`
2. Trong order-summary, panel customer: gõ SĐT không tồn tại → CTA "Tạo khách mới với SĐT ..." (POS-themed)
3. Click → CreateCustomerDialog mở pre-fill
4. Submit → user mới được tạo + auto-select làm customer cho session bàn
5. Scan button → dialog scan RFID/QR mở
6. Gõ SĐT có thật → list hiện + active badge + scroll load thêm
7. Active customer cho phép select; inactive customer disabled

- [ ] **Step 4: Sanity grep**

```bash
grep -rn "addCustomerInfo" src/components/app/form/create-customer-form.tsx
```
Expected: empty (đã decouple).

```bash
grep -rn "CreateCustomerDialog" src/ --include='*.tsx' | head -10
```
Expected: thấy ở các caller mới + admin existing.

---

## Self-Review

**Spec coverage**:
- Đồng bộ search by SĐT admin→staff ↔ Task 5 (port scan, pagination, badge, loading). ✓
- Đồng bộ tạo tài khoản admin→staff ↔ Task 2 (controlled dialog) + Task 6 (wire vào staff). ✓
- Empty state CTA "Tạo mới" ↔ Task 4 (admin) + Task 6 (staff). ✓
- Pre-fill SĐT trong create form ↔ Task 1 (form accepts defaultPhoneNumber). ✓
- Auto-select user vừa tạo ↔ Task 4 + 6 (onCreated callback → handleAddOwner/onSelect). ✓
- Decouple form khỏi `addCustomerInfo` ↔ Task 1 + 3. ✓

**Type consistency**:
- `IUserInfo` consumed by `onCreated(user: IUserInfo)` ở 3 places (Form, Dialog, callers).
- `TableCustomer` shape stays internal to staff side via `toTableCustomer(user)` helper (existing).
- `defaultPhoneNumber?: string` consistent across Form + Dialog props.
- Controlled Dialog mode: `open?: boolean` + `onOpenChange?: (boolean) => void` — pattern consistent với shadcn Dialog.

**Placeholder scan**: none.

**Risks**:
1. **`addCustomerInfo` chỉ tồn tại trong `useOrderFlowStore`** — đó là admin cart state. Khi staff dùng CreateCustomerDialog với `onCreated={onSelect}`, mapping `IUserInfo → TableCustomer` cần đúng. Staff component đã có `toTableCustomer(user)` helper.
2. **CreateCustomerForm dùng `queryClient.invalidateQueries(['users'])`** — staff side cũng cần invalidate? Có lẽ không (staff không hiển thị user list). OK keep as-is.
3. **Backward compat dialog** — admin caller `customer-action.tsx` dùng `<CreateCustomerDialog />` không pass props → default trigger button render + uncontrolled state. Task 2 ensures this still works.
4. **Scan dialog `ScanRFIDCustomerDialog`** ở staff: assumes scan hardware available. Acceptable — staff có thể chưa dùng scan, button vẫn nằm đó vô hại.
5. **Loading state in admin search input** không nằm trong scope — Task 5 chỉ thêm cho staff. Optional follow-up cho admin (nếu user muốn).

**Out of scope**:
- Unified shared component cho cả admin + staff (refactor lớn — defer)
- Keyboard navigation (↑↓ arrows)
- Search by name (chỉ SĐT)
- Tests mới cho 2 component (existing test infra không cover empty state — nếu user yêu cầu thêm thì plan riêng)
