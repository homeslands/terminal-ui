# Admin Table-based Order Flow (Cafe → Restaurant Migration)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> **Each task: NO `git commit`. Leave changes in working tree for user.**

**Goal:** Refactor admin order flow từ single-shot (cafe pattern cũ) sang table-based multi-batch (restaurant pattern). Admin có route đặt món riêng trong admin layout, share components với staff để tránh duplicate.

**Architecture:**
- **Shared inner components**: `MenuPanel`, `OrderSummary`, `PaymentPanel`, etc. — reuse cho cả staff + admin
- **Different chrome**: Staff dùng `StaffPosLayout`, Admin dùng `SystemLayout` (sidebar + breadcrumb)
- **New routes**:
  - `/system/tables` — table picker grid
  - `/system/table/:id` — order screen
  - `/system/table/:id/payment` — payment screen
- **Retire**: `/system/menu` (single-shot pattern không phù hợp nhà hàng dine-in)
- **Permission**: `/system/table/*` accessible to ADMIN, SUPER_ADMIN, MANAGER (STAFF dùng `/staff/table`)

**User decisions (confirmed):**
1. Layout đầy đủ (sidebar + breadcrumb + header) cho admin order
2. Sidebar "Đặt món" → table picker trước → chọn bàn → menu
3. Manager xem được TẤT CẢ bàn (không filter theo staff)
4. Retire `/system/menu` ngay

**Risk:** Medium. Extract logic + new routes. Verify shared state (useTableSessionsStore) hoạt động đúng khi 2 layout cùng dùng.

---

## File Structure

**Create (new files):**
- `src/components/staff/table-order-screen.tsx` — shared order screen logic (extracted)
- `src/components/staff/table-payment-screen.tsx` — shared payment screen (extracted)
- `src/app/system/table-order.tsx` — admin entry (wraps shared in SystemLayout context)
- `src/app/system/table-payment.tsx` — admin payment entry
- `src/app/system/tables-picker.tsx` — table grid picker for admin

**Modify:**
- `src/app/staff/table-order.tsx` — refactor to thin wrapper using shared component
- `src/app/staff/payment.tsx` — refactor to thin wrapper
- `src/constants/route.ts` — add SYSTEM_TABLES, SYSTEM_TABLE_ORDER, SYSTEM_TABLE_PAYMENT
- `src/router/index.tsx` — register new routes
- `src/router/routes.ts` — sidebar entry "Đặt món" → /system/tables
- `src/constants/role.ts` — permissions for new routes (ADMIN, SUPER_ADMIN, MANAGER)

**Delete (Phase 4 retire):**
- `src/app/system/menu/` directory entire (page + components)
- `src/constants/route.ts` — remove STAFF_MENU route entry
- Sidebar entry "Đặt hộ" (old)
- `useOrderFlowStore` if no other consumers (audit first)

---

## Task TABLE-1: Extract shared order screen component

**Goal:** Move logic from `src/app/staff/table-order.tsx` to a reusable component, so admin can mount the same logic inside SystemLayout.

### Step 1: Create `src/components/staff/table-order-screen.tsx`

Move ALL logic + JSX from `table-order.tsx` to new file. Export as `TableOrderScreen`:

```tsx
import { useParams } from 'react-router-dom'
// ... all existing imports

export interface TableOrderScreenProps {
  /**
   * Custom back navigation handler. Staff → /staff floor plan.
   * Admin → /system/tables.
   */
  onBack?: () => void
  /**
   * If true, hide PosPageHeader (admin will use SystemLayout breadcrumb instead).
   */
  hideHeader?: boolean
  /**
   * Override default payment navigation. Staff → /staff/table/:id/payment.
   * Admin → /system/table/:id/payment.
   */
  paymentPath?: (tableId: string) => string
}

export function TableOrderScreen({
  onBack,
  hideHeader = false,
  paymentPath = (id) => `/staff/table/${id}/payment`,
}: TableOrderScreenProps) {
  const { id = '' } = useParams<{ id: string }>()
  // ... existing logic from table-order.tsx
}
```

### Step 2: Make `src/app/staff/table-order.tsx` thin wrapper

```tsx
import { TableOrderScreen } from '@/components/staff/table-order-screen'

export default function StaffTableOrderPage() {
  return <TableOrderScreen />
}
```

### Step 3: Verify tsc + tests

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Expect 550/550 pass — behavior unchanged.

### Step 4: Smoke test (mental)

- `/staff/table/<id>` vẫn hoạt động như cũ
- Add món + submit + navigate payment vẫn OK

---

## Task TABLE-2: Extract shared payment screen component

**Same pattern as TABLE-1 nhưng cho payment.tsx.**

### Step 1: Create `src/components/staff/table-payment-screen.tsx`

Move logic from `src/app/staff/payment.tsx` to new file. Props:
- `onBack?: () => void`
- `hideHeader?: boolean`  
- `tableOrderPath?: (id) => string` — for "← Quay lại" navigation
- `onPaymentSuccess?: () => void` — navigate after payment

### Step 2: Make `payment.tsx` thin wrapper

```tsx
import { TablePaymentScreen } from '@/components/staff/table-payment-screen'

export default function StaffPaymentPage() {
  return <TablePaymentScreen />
}
```

### Step 3: Verify

```bash
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

---

## Task TABLE-3: Add admin routes + types

### Step 1: Add route constants

In `src/constants/route.ts`, add:

```ts
SYSTEM_TABLES: '/system/tables',
SYSTEM_TABLE_ORDER: '/system/table/:id',
SYSTEM_TABLE_PAYMENT: '/system/table/:id/payment',
```

### Step 2: Add to RoutePermissions

In `src/constants/role.ts`:

```ts
[ROUTE.SYSTEM_TABLES]: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
[ROUTE.SYSTEM_TABLE_ORDER]: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
[ROUTE.SYSTEM_TABLE_PAYMENT]: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
```

> STAFF KHÔNG include vì họ đã có `/staff/table/*`.

### Step 3: Register routes in `src/router/index.tsx`

Find the SystemLayout children area. Add:

```tsx
{
  path: ROUTE.SYSTEM_TABLES,
  element: <SuspenseElement component={SystemTablesPickerPage} />,
},
{
  path: ROUTE.SYSTEM_TABLE_ORDER,
  element: <SuspenseElement component={SystemTableOrderPage} />,
},
{
  path: ROUTE.SYSTEM_TABLE_PAYMENT,
  element: <SuspenseElement component={SystemTablePaymentPage} />,
},
```

Import pages from `@/app/system/...`.

---

## Task TABLE-4: Create admin entry pages

### Step 1: Create `src/app/system/table-order.tsx`

```tsx
import { useNavigate, useParams } from 'react-router-dom'
import { TableOrderScreen } from '@/components/staff/table-order-screen'
import { ROUTE } from '@/constants'

export default function SystemTableOrderPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  return (
    <TableOrderScreen
      hideHeader={true}                                       // admin dùng SystemLayout breadcrumb thay
      onBack={() => navigate(ROUTE.SYSTEM_TABLES)}            // back về table picker
      paymentPath={(tid) => `/system/table/${tid}/payment`}   // payment trong admin scope
    />
  )
}
```

### Step 2: Create `src/app/system/table-payment.tsx`

Similar pattern:

```tsx
import { useNavigate, useParams } from 'react-router-dom'
import { TablePaymentScreen } from '@/components/staff/table-payment-screen'

export default function SystemTablePaymentPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams<{ id: string }>()
  return (
    <TablePaymentScreen
      hideHeader={true}
      tableOrderPath={(tid) => `/system/table/${tid}`}
      onPaymentSuccess={() => navigate('/system/tables')}
    />
  )
}
```

### Step 3: Verify imports + routes wire up

---

## Task TABLE-5: Create table picker page

### Step 1: Create `src/app/system/tables-picker.tsx`

Grid layout showing all tables. Each table card:
- Table name
- Status (empty / serving / waiting_payment / done)
- Click → navigate `/system/table/<slug>`

```tsx
import { useNavigate } from 'react-router-dom'
import { useGetTables } from '@/hooks'   // verify exists
import { Card } from '@/components/ui'

export default function SystemTablesPickerPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useGetTables()
  const tables = data?.result ?? []

  if (isLoading) return <div>Đang tải bàn...</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Chọn bàn để đặt món</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {tables.map((table) => (
          <Card
            key={table.slug}
            className="cursor-pointer hover:bg-pos-gold/10 p-4 text-center"
            onClick={() => navigate(`/system/table/${table.slug}`)}
          >
            <div className="text-xl font-bold">Bàn {table.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {table.status === 'reserved' ? '🟡 Đang phục vụ' : '⚪ Trống'}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

> Verify hook name `useGetTables` or similar. Grep:
> ```bash
> grep -n "useGetTables\|useGetAllTables\|getTables" src/hooks/
> ```

---

## Task TABLE-6: Update sidebar

### Step 1: Modify `src/router/routes.ts`

Find sidebar entry "Đặt hộ" (current STAFF_MENU). Replace with:

```ts
{
  title: 'sidebar.orderForCustomer',  // i18n key, add to vi.json
  path: ROUTE.SYSTEM_TABLES,
  icon: Utensils,  // or appropriate icon from lucide-react
  permission: Permission.STAFF_MENU,  // reuse existing permission OR add new
}
```

### Step 2: Update i18n

In `src/locales/vi/sidebar.json` (or similar):
```json
{
  "orderForCustomer": "Đặt món"
}
```

In en:
```json
{
  "orderForCustomer": "Order for Customer"
}
```

---

## Task TABLE-7: Retire `/system/menu`

### Step 1: Remove route registration

In `src/router/index.tsx`, find and remove the `STAFF_MENU` route registration.

### Step 2: Remove route constant

In `src/constants/route.ts`, remove `STAFF_MENU` line (and any references in role.ts).

### Step 3: Delete files

```bash
rm -rf src/app/system/menu/
```

> Verify no other file imports from `src/app/system/menu/` before deleting. Grep:
> ```bash
> grep -rn "from '@/app/system/menu" src/ | head -10
> ```

### Step 4: Cleanup useOrderFlowStore consumers

Grep `useOrderFlowStore` usage. If only `system/menu` and related cart-content used it → remove the store. If shared with payment or other → leave as legacy.

```bash
grep -rn "useOrderFlowStore" src/ | grep -v ".test." | head -20
```

If can remove → delete `src/stores/order-flow.store.ts` + remove from `src/stores/index.ts` barrel.

If cannot → add `@deprecated` comment.

---

## Task TABLE-8: Final verification

### Step 1: Test suite

```bash
npx tsc -b 2>&1 | tail -3
npx eslint src/ 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Expect 550/550 pass.

### Step 2: Manual smoke test

- Login as ADMIN → sidebar có item "Đặt món"
- Click "Đặt món" → tables picker
- Click 1 bàn → vào order screen (admin chrome: sidebar + breadcrumb hiện)
- Add món → "Đặt món" → submit
- Navigate payment → customer search + voucher
- Confirm thanh toán
- Login as STAFF → vẫn vào `/staff/table/<id>` như cũ (no regression)
- Navigate `/system/menu` cũ → 404 hoặc redirect
- Manager dùng /system/table/:id thấy bàn của tất cả staff (không bị filter)

---

## Notes / Design Decisions

1. **Share components, không share routes**: Inner UI components (MenuPanel, OrderSummary, PaymentPanel) reusable. Routes + layouts khác nhau theo context.

2. **`hideHeader` prop**: Admin có SystemLayout với breadcrumb riêng — không cần PosPageHeader. Staff cần PosPageHeader vì StaffPosLayout đơn giản.

3. **`paymentPath` callback**: Cho phép customize navigation. Staff → `/staff/table/:id/payment`. Admin → `/system/table/:id/payment`.

4. **`useTableSessionsStore` shared state**: Cả staff + admin dùng cùng store. Manager xem bàn 5 sẽ thấy đúng order mà staff đang đặt. Multi-tab sync hoạt động.

5. **Permission**: ADMIN/SUPER_ADMIN/MANAGER vào `/system/table/*`. STAFF vẫn block khỏi `/system/*` (đã có). ADMIN vẫn block khỏi `/staff/*` (đã có).

6. **`StaffShiftGate` cho admin?**: Staff bị block bởi shift gate. Admin có cần shift mới đặt hộ không? Probably KHÔNG — admin có thể đặt hộ ngoài giờ ca. Khi mount `TableOrderScreen` trong admin context → skip shift gate. Add `skipShiftGate` prop nếu cần.

7. **Retire `/system/menu` ngay**: User confirm. Không có deprecation period. Backup: route old có thể navigate trực tiếp bằng URL — sẽ 404.

8. **Multi-batch state**: `useTableSessionsStore` persist localStorage `terminal_sessions`. Admin và staff cùng key → share state. Đây là feature, không phải bug.

9. **Permission cho `useOrderFlowStore`**: If retire, audit consumers ngoài `/system/menu` (payment-page.tsx có thể dùng — careful).

10. **i18n**: New sidebar entry cần i18n key. Add ở vi + en cùng lúc.
