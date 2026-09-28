# Admin Menu Restoration Plan (UI cũ + Logic mới)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> **DO NOT git commit per task** — leave changes in working tree for user.

**Goal:** Khôi phục UI cũ của `/system/menu` (table tabs + product grid) làm shell cho admin order flow, NHƯNG thay logic chọn món sang `useTableSessionsStore` (multi-batch, dine-in only, customer/voucher ở payment).

**Architecture:**
- UI shell: layout 75/25 (menu trái + cart phải), Tabs `[table | menu]` (dine-in only, bỏ delivery/take-out)
- Visual của table picker + menu grid: GIỮ NGUYÊN từ HEAD
- Logic: thay `useOrderFlowStore`/`useCartItemStore` → `useTableSessionsStore` (table-keyed sessions)
- Active table: lưu qua URL query param `?table=<slug>` (mới) + giữ `?tab=table|menu` (đã có)
- Cart bên phải: component MỚI (`AdminCartContent`) — visual inherits từ cart cũ, logic subscribe session theo URL param
- Payment: reuse route `/system/table/:id/payment` + `TablePaymentScreen` (đã build TABLE-4)

**Tech Stack:** React 18, Vite, TypeScript, Zustand persist, TanStack Query, React Router v6, shadcn/ui, Tailwind, i18n react-i18next

---

## File scope

### Files to restore (from HEAD, then modify):
- `src/app/system/menu/page.tsx` — entry layout
- `src/app/system/menu/components/system-menus.tsx` — product grid
- `src/components/app/tabs/system-menu.tabs.tsx` — Tabs container
- `src/components/app/tabscontent/system-menu.tabscontent.tsx` — Tab content wrapper
- `src/components/app/tabs/index.ts` — barrel re-export
- `src/components/app/tabscontent/index.ts` — barrel re-export

### Files to create:
- `src/app/system/menu/components/admin-cart-content.tsx` — NEW cart panel (table session driven)

### Files to delete (cleanup TABLE-3..5):
- `src/app/system/table-order.tsx`
- `src/app/system/tables-picker.tsx`
- `src/app/system/menu/checkout-cart.tsx` (legacy, never used by new flow)
- `src/app/system/menu/components/cart-content.tsx` (legacy, replaced by admin-cart-content)

### Files to modify:
- `src/constants/route.ts` — restore `STAFF_MENU`, remove `SYSTEM_TABLES`, `SYSTEM_TABLE_ORDER`
- `src/constants/role.ts` — add `STAFF_MENU` to RoutePermissions for ADMIN/MANAGER, remove `SYSTEM_TABLES`/`SYSTEM_TABLE_ORDER`
- `src/router/loadable.tsx` — restore `MenuPage` lazy, remove `SystemTablesPickerPage`/`SystemTableOrderPage` lazy (keep `SystemTablePaymentPage`)
- `src/router/index.tsx` — restore `/system/menu` route, remove `/system/tables` + `/system/table/:id` routes (keep `/system/table/:id/payment`)
- `src/router/routes.ts` — sidebar entry `orderForCustomer` → `path: ROUTE.STAFF_MENU` (was `ROUTE.SYSTEM_TABLES`)
- `src/app/system/menu/index.tsx` — barrel — restore page export
- `src/app/system/menu/order-success.tsx` — already kept (TABLE-7), no change needed

### Files to keep (no change):
- `src/components/staff/table-payment-screen.tsx` — shared component for payment
- `src/app/system/table-payment.tsx` — admin payment entry
- `src/components/staff/table-order-screen.tsx` — staff still uses it
- `src/app/staff/table-order.tsx` — staff order flow
- `src/components/app/select/system-table-select.tsx` — existing, will be used in tabs

---

## Phase 1: Cleanup + Restore route shell

### Task ADMIN-1: Delete TABLE-3..5 artifacts + restore /system/menu route

**Files:**
- Delete: `src/app/system/table-order.tsx`
- Delete: `src/app/system/tables-picker.tsx`
- Modify: `src/constants/route.ts`
- Modify: `src/constants/role.ts`
- Modify: `src/router/loadable.tsx`
- Modify: `src/router/index.tsx`
- Modify: `src/router/routes.ts`
- Modify: `src/locales/vi/sidebar.json` (no change required if already done — verify)

- [ ] **Step 1: Delete the two files**

```bash
rm src/app/system/table-order.tsx
rm src/app/system/tables-picker.tsx
```

- [ ] **Step 2: Update `src/constants/route.ts`**

Remove these two lines (keep `SYSTEM_TABLE_PAYMENT`):
```ts
SYSTEM_TABLES: '/system/tables',
SYSTEM_TABLE_ORDER: '/system/table/:id',
```

Add back (in the appropriate section, likely SYSTEM area):
```ts
STAFF_MENU: '/system/menu',
```

> If `STAFF_MENU` already exists in another place, just verify path is correct.

- [ ] **Step 3: Update `src/constants/role.ts`**

Remove these RoutePermissions entries:
```ts
[ROUTE.SYSTEM_TABLES]: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
[ROUTE.SYSTEM_TABLE_ORDER]: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
```

Add back (keep matching the SYSTEM_TABLE_PAYMENT entry for consistency):
```ts
[ROUTE.STAFF_MENU]: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
```

- [ ] **Step 4: Update `src/router/loadable.tsx`**

Remove lazy imports for `SystemTablesPickerPage`, `SystemTableOrderPage`. Keep `SystemTablePaymentPage`.

Add back:
```ts
export const MenuPage = lazy(() => import('@/app/system/menu/page'))
```

- [ ] **Step 5: Update `src/router/index.tsx`**

Remove the route entries for `/system/tables` and `/system/table/:id` (keep `/system/table/:id/payment`).

Add back inside SystemLayout child routes (wrapped with ProtectedElement):
```tsx
{
  path: ROUTE.STAFF_MENU,
  element: <ProtectedElement allowedPermissions={[ROUTE.STAFF_MENU]}><SuspenseElement component={MenuPage} /></ProtectedElement>
}
```

Remove imports for the deleted page components.

- [ ] **Step 6: Update `src/router/routes.ts`**

Find the sidebar entry created in TABLE-6:
```ts
{
  title: 'sidebar.orderForCustomer',
  path: ROUTE.SYSTEM_TABLES,
  icon: Utensils,
  permission: Permission.STAFF_MENU,
}
```

Change `path: ROUTE.SYSTEM_TABLES` → `path: ROUTE.STAFF_MENU`. Keep title, icon, permission as-is.

- [ ] **Step 7: Verify build (will FAIL — page.tsx still missing — expected)**

```bash
npx tsc -b 2>&1 | tail -10
```

Expected: errors about `MenuPage` import (file doesn't exist yet). This is OK — Step 8 restores it.

- [ ] **Step 8: Restore `src/app/system/menu/page.tsx` from HEAD**

```bash
git show HEAD:./src/app/system/menu/page.tsx > src/app/system/menu/page.tsx
```

Verify file exists with content:
```bash
head -20 src/app/system/menu/page.tsx
```

Expected: shows `SystemMenuPage` component with layout from HEAD.

- [ ] **Step 9: Restore other deleted files from HEAD**

```bash
git show HEAD:./src/app/system/menu/components/system-menus.tsx > src/app/system/menu/components/system-menus.tsx
git show HEAD:./src/components/app/tabs/system-menu.tabs.tsx > src/components/app/tabs/system-menu.tabs.tsx
git show HEAD:./src/components/app/tabscontent/system-menu.tabscontent.tsx > src/components/app/tabscontent/system-menu.tabscontent.tsx
```

- [ ] **Step 10: Restore barrel exports**

In `src/components/app/tabs/index.ts`, add back:
```ts
export * from './system-menu.tabs'
```

In `src/components/app/tabscontent/index.ts`, add back:
```ts
export * from './system-menu.tabscontent'
```

- [ ] **Step 11: Delete the now-unneeded legacy cart files**

```bash
rm src/app/system/menu/checkout-cart.tsx  # legacy from HEAD — will not be used
rm src/app/system/menu/components/cart-content.tsx  # legacy — will be replaced by admin-cart-content
```

> Note: `page.tsx` imports `CartContent` from `./components/cart-content`. This will fail compilation. Task ADMIN-5 fixes the import. For this task only, the build is expected to be temporarily broken.

- [ ] **Step 12: Verify intermediate state**

```bash
npx tsc -b 2>&1 | tail -10
```

Expected: errors about missing `cart-content` import in `page.tsx`. ADMIN-5 will fix.

```bash
ls -la src/app/system/menu/
ls -la src/app/system/table-order.tsx 2>&1 | tail -3   # expect: No such file
ls -la src/app/system/tables-picker.tsx 2>&1 | tail -3 # expect: No such file
```

**NO COMMIT.**

---

## Phase 2: Simplify Tabs (dine-in only)

### Task ADMIN-2: Strip delivery/take-out from SystemMenuTabs

**Files:**
- Modify: `src/components/app/tabs/system-menu.tabs.tsx`

The restored file from HEAD has tabs for `table`, `delivery`, `menu` and conditional logic checking `cartItems?.type === OrderTypeEnum.AT_TABLE | DELIVERY`. Nhà hàng dine-in only → keep ONLY `table` + `menu` tabs.

- [ ] **Step 1: Remove delivery + take-out conditionals**

In `src/components/app/tabs/system-menu.tabs.tsx`:

1. Delete the entire `delivery` `TabsTrigger` and `TabsContent` blocks (the ones wrapped in `cartItems?.type === OrderTypeEnum.DELIVERY` checks).
2. Remove the conditional `cartItems?.type === OrderTypeEnum.AT_TABLE &&` wrapper around `table` `TabsTrigger` and `TabsContent` — make them always render.
3. Delete the `useEffect` that switches tabs based on `cartItems?.type` (TAKE_OUT, DELIVERY) — no longer relevant.
4. Delete the `useEffect` guard for default-customer/delivery — no longer relevant.
5. Remove unused imports: `SystemMapAddressSelect`, `OrderTypeEnum` (if no other use), `setOrderingType`.

- [ ] **Step 2: Read active-table query param from URL**

Add at top of component (next to existing `useSearchParams`):
```ts
const activeTableSlug = searchParams.get('table') ?? null
```

This will be consumed by `SystemMenus` add-to-cart logic (Task ADMIN-4).

- [ ] **Step 3: Adapt initial tab default**

The default tab from URL is `searchParams.get('tab') || 'table'`. Keep this. After ADMIN-3, when a table is selected via SystemTableSelect, the URL will switch to `?tab=menu&table=<slug>` so this default still works.

- [ ] **Step 4: Pass `activeTableSlug` down to SystemMenuTabscontent**

Change:
```tsx
<SystemMenuTabscontent menu={specificMenuResult} isLoading={isLoading} />
```
to:
```tsx
<SystemMenuTabscontent menu={specificMenuResult} isLoading={isLoading} activeTableSlug={activeTableSlug} />
```

- [ ] **Step 5: Verify build (still expected to fail on page.tsx import)**

```bash
npx tsc -b 2>&1 | tail -15
```

Expected errors:
- `page.tsx` still missing `cart-content` (fixed in ADMIN-5)
- `SystemMenuTabscontent` doesn't accept `activeTableSlug` prop yet (fixed in next step + ADMIN-3 wiring)

Add the prop to `system-menu.tabscontent.tsx`:
```tsx
export function SystemMenuTabscontent({
  menu,
  isLoading,
  activeTableSlug,
}: {
  menu?: ISpecificMenu
  isLoading?: boolean
  activeTableSlug: string | null
}) {
  return (
    <div className="flex flex-col w-full">
      <SystemMenus menu={menu} isLoading={isLoading} activeTableSlug={activeTableSlug} />
    </div>
  )
}
```

(SystemMenus prop wiring happens in ADMIN-3.)

- [ ] **Step 6: Run lint to catch unused imports**

```bash
npx eslint src/components/app/tabs/system-menu.tabs.tsx src/components/app/tabscontent/system-menu.tabscontent.tsx 2>&1 | tail -10
```

Fix any unused-var warnings.

**NO COMMIT.**

---

## Phase 3: New cart panel (table session driven)

### Task ADMIN-3: Create AdminCartContent component

**Files:**
- Create: `src/app/system/menu/components/admin-cart-content.tsx`

**Visual design** (inherits OLD CartContent aesthetics — white card, header, scroll area, total, button):
- Empty state (no `?table=<slug>` query): centered "Chưa chọn bàn" icon + text
- With session: header showing table name (e.g. "Bàn 5"), scrollable item list, order-note input (`<CartNoteInput>` or `<Textarea>`), total row, 2 CTAs:
  - "Đặt món" (primary) — submits pendingItems via API + clears pending
  - "Thanh toán" (outline, disabled if 0 submitted items) — navigates to `/system/table/<slug>/payment`

**Logic:** mirror staff `OrderSummary` but simplified — no customer/voucher UI (those go to payment screen).

- [ ] **Step 1: Look at staff OrderSummary for reference (read-only)**

```bash
grep -n "submitOrder\|addItem\|pendingItems\|submittedOrders\|navigate.*payment" src/components/staff/order-summary.tsx | head -30
```

Identify:
- How submit batch is wired (likely `useMutation` calling createOrder/addItems + `submitOrder()` from store on success)
- How "Thanh toán" navigation works
- Note input pattern

- [ ] **Step 2: Look at useTableSessions API**

```bash
sed -n '1,30p' src/hooks/useTableSessions.ts
```

Confirms `addItem`, `submitOrder`, `setOrderDescription`, `clearPendingItems`, etc. are available.

- [ ] **Step 3: Create the component**

`src/app/system/menu/components/admin-cart-content.tsx`:

```tsx
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShoppingCart, Trash2 } from 'lucide-react'

import { Button, ScrollArea, Textarea } from '@/components/ui'
import { useTableSessions } from '@/hooks/useTableSessions'
import { ROUTE } from '@/constants/route'
import { formatCurrency } from '@/utils'

export function AdminCartContent() {
  const { t } = useTranslation('menu')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tableSlug = searchParams.get('table') ?? ''

  const { sessions, removeItem, setOrderDescription } = useTableSessions()
  const session = tableSlug ? sessions[tableSlug] : null

  const pending = session?.pendingItems ?? []
  const submitted = useMemo(
    () => session?.submittedOrders?.flatMap((o) => o.items) ?? [],
    [session?.submittedOrders],
  )

  const allItems = useMemo(() => [...submitted, ...pending], [submitted, pending])
  const total = useMemo(
    () => allItems.reduce((sum, it) => sum + (it.priceNum ?? 0) * it.quantity, 0),
    [allItems],
  )

  if (!tableSlug || !session) {
    return (
      <aside className="hidden xl:flex w-[25%] xl:w-[30%] flex-col h-screen border-l bg-pos-card items-center justify-center text-pos-muted text-sm gap-2 px-4">
        <ShoppingCart className="w-12 h-12 text-pos-muted/40" />
        <p>{t('order.noTableSelected', 'Chưa chọn bàn')}</p>
      </aside>
    )
  }

  const handleSubmitBatch = () => {
    // TODO ADMIN-4: wire createOrder/addItems mutation
    // For now, just call submitOrder() locally to move items pending → submitted
    // Actual API call should be inserted via mutation hook in ADMIN-4 (or here if simpler)
  }

  const handleGoToPayment = () => {
    navigate(`/system/table/${tableSlug}/payment`)
  }

  return (
    <aside className="hidden xl:flex w-[25%] xl:w-[30%] flex-col h-screen border-l bg-pos-card">
      <div className="px-4 pt-4 pb-3 border-b">
        <h2 className="text-lg font-bold text-pos-gold">
          {t('order.orderInformation')}
        </h2>
        <p className="text-xs text-pos-muted mt-1">
          {t('order.tableNumber')}: <span className="font-semibold">{session.tableName}</span>
        </p>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        {allItems.length === 0 ? (
          <p className="text-center text-sm text-pos-muted py-8">
            {t('order.emptyCart', 'Chưa có món nào')}
          </p>
        ) : (
          <ul className="space-y-3">
            {allItems.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 pb-2 border-b border-pos-border/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-pos-muted">
                    {item.quantity} × {formatCurrency(item.priceNum ?? 0)}
                  </p>
                  {item.note && <p className="text-xs italic text-pos-muted">{item.note}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold">
                    {formatCurrency((item.priceNum ?? 0) * item.quantity)}
                  </span>
                  {pending.includes(item) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-pos-muted hover:text-destructive"
                      onClick={() => removeItem(tableSlug, item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="border-t px-4 py-3 space-y-3">
        <div>
          <label className="text-xs text-pos-muted">
            {t('order.note', 'Ghi chú đơn')}
          </label>
          <Textarea
            value={session.orderDescription ?? ''}
            onChange={(e) => setOrderDescription(tableSlug, e.target.value)}
            placeholder={t('order.notePlaceholder', 'Ghi chú cho bếp...')}
            className="mt-1 min-h-[60px] text-sm"
          />
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-pos-muted">{t('order.total')}</span>
          <span className="text-xl font-bold text-pos-gold">
            {formatCurrency(total)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={pending.length === 0}
            onClick={handleSubmitBatch}
          >
            {t('order.submit', 'Đặt món')}
          </Button>
          <Button
            disabled={submitted.length === 0}
            onClick={handleGoToPayment}
          >
            {t('order.continueToPayment', 'Thanh toán')}
          </Button>
        </div>
      </div>
    </aside>
  )
}
```

> NOTE: This component intentionally has a TODO at `handleSubmitBatch`. The actual API mutation wiring is done in ADMIN-4 (the next task) where the implementer should look at staff's `useCreateOrder`/`useAddItemsToOrder` hooks and copy the same pattern. Acceptable to leave the local `submitOrder(tableSlug)` call here for now and add the mutation in ADMIN-4.

- [ ] **Step 4: Check that referenced types exist on OrderItem**

```bash
grep -n "priceNum\|menuItemId\|note\|quantity" src/types/session.ts | head -10
```

If `priceNum` is not on `OrderItem`, use whichever field actually holds the resolved price (likely `originalPrice` or a similar). Adjust the component code accordingly.

- [ ] **Step 5: Verify TS + lint**

```bash
npx tsc -b 2>&1 | tail -10
npx eslint src/app/system/menu/components/admin-cart-content.tsx 2>&1 | tail -10
```

Fix any errors. (page.tsx import of cart-content may still fail until ADMIN-5.)

**NO COMMIT.**

---

## Phase 4: Wire add-to-cart to session

### Task ADMIN-4: Modify SystemMenus add-to-cart + wire submit-batch mutation

**Files:**
- Modify: `src/app/system/menu/components/system-menus.tsx`
- Modify: `src/app/system/menu/components/admin-cart-content.tsx` (wire mutation in handleSubmitBatch)

The restored `SystemMenus` from HEAD uses `useOrderFlowStore.addOrderingItem` for add-to-cart. Replace with `useTableSessions().addItem(tableSlug, item)`.

- [ ] **Step 1: Update SystemMenus component signature to accept activeTableSlug**

```tsx
interface IMenuProps {
  menu?: ISpecificMenu
  isLoading?: boolean
  activeTableSlug: string | null
}

export default function SystemMenus({ menu, isLoading, activeTableSlug }: IMenuProps) {
  // ...
}
```

- [ ] **Step 2: Replace order-flow logic with table-sessions**

In the component body, REMOVE:
- `useOrderFlowStore` hook call + destructured methods (`currentStep`, `orderingData`, `initializeOrdering`, `addOrderingItem`, `setCurrentStep`)
- The `useEffect` that ensures ORDERING phase / initializes ordering data — no longer relevant for admin

ADD:
```ts
import { useTableSessions } from '@/hooks/useTableSessions'
import { showToast, showErrorToast } from '@/utils'

const { addItem } = useTableSessions()
```

- [ ] **Step 3: Rewrite handleAddToCart**

```tsx
const handleAddToCart = (product: IMenuItem) => {
  if (!activeTableSlug) {
    showErrorToast(/* code or fallback string */ 'Vui lòng chọn bàn trước')
    return
  }
  if (!product?.product?.isCustomPrice && (!product?.product?.variants || product?.product?.variants.length === 0)) return

  const firstVariant = product?.product?.variants?.[0]
  const orderItem: OrderItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    menuItemId: product?.product?.slug ?? '',
    productSlug: product?.product?.slug ?? '',
    variantSlug: firstVariant?.slug ?? '',
    name: product?.product?.name ?? '',
    quantity: 1,
    priceNum: product?.product?.isCustomPrice ? 0 : firstVariant?.price ?? 0,
    price: formatCurrency(product?.product?.isCustomPrice ? 0 : firstVariant?.price ?? 0),
    image: product?.product?.image ?? '',
    isCustomPrice: product?.product?.isCustomPrice ?? false,
    promotion: product?.promotion ?? null,
    vatRate: product?.product?.vatRate ?? 0,
    note: '',
  }
  addItem(activeTableSlug, orderItem)
  showToast(tToast('toast.addSuccess'))
}
```

> The exact `OrderItem` shape comes from `src/types/session.ts`. Read that file before this step and match all required fields. The fields above are educated guesses — verify against the actual type.

- [ ] **Step 4: Drop the old SystemAddToCartDrawer if it was using order-flow**

Check if `SystemAddToCartDrawer` (imported at top of system-menus.tsx) uses `useOrderFlowStore`. If yes, either:
- (preferred) Convert it the same way (props-driven, accept `activeTableSlug` + `addItem` callback)
- (acceptable for restoration scope) Bypass the drawer entirely — for simple click, call `handleAddToCart` directly without opening drawer

> If converting the drawer is too invasive for one task, mark it as a follow-up TODO with a comment in the file and skip for now. Add a manual confirm dialog before adding (if no variants).

- [ ] **Step 5: Wire submit-batch mutation in AdminCartContent**

Find the existing staff submit pattern:
```bash
grep -rn "useCreateOrder\|useAddNewOrderItems\|addItemsToOrder" src/hooks src/api | head -10
```

In `admin-cart-content.tsx`, replace the TODO with:
```ts
const { mutate: createOrder, isPending: isCreating } = useCreateOrder()
const { mutate: addItems, isPending: isAdding } = useAddItemsToOrder()
const isSubmitting = isCreating || isAdding

const handleSubmitBatch = () => {
  if (pending.length === 0) return
  const hasExisting = !!session?.orderSlug
  if (hasExisting) {
    addItems({ orderSlug: session.orderSlug, items: pending.map(toApiItem) }, {
      onSuccess: () => {
        submitOrder(tableSlug)  // pending → submitted in store
        showToast(tToast('toast.orderSubmitted'))
      },
    })
  } else {
    createOrder(buildCreatePayload(session, pending), {
      onSuccess: (res) => {
        setOrderSlug(tableSlug, res.result.slug)
        submitOrder(tableSlug)
        showToast(tToast('toast.orderSubmitted'))
      },
    })
  }
}
```

> Look at staff's OrderSummary submit logic for the exact payload shape — `toApiItem`, `buildCreatePayload` should mirror what staff does. Don't reinvent.

- [ ] **Step 6: Add submission state to button**

```tsx
<Button
  variant="outline"
  disabled={pending.length === 0 || isSubmitting}
  onClick={handleSubmitBatch}
>
  {isSubmitting ? t('order.submitting') : t('order.submit', 'Đặt món')}
</Button>
```

- [ ] **Step 7: Verify**

```bash
npx tsc -b 2>&1 | tail -10
npx eslint src/app/system/menu/components/ 2>&1 | tail -10
```

Fix all errors.

**NO COMMIT.**

---

## Phase 5: Wire table picker + page integration

### Task ADMIN-5: Wire SystemTableSelect to open session + page.tsx integration

**Files:**
- Modify: `src/app/system/menu/page.tsx`
- Modify: `src/components/app/select/system-table-select.tsx` (or use a small wrapper if the original is reused elsewhere)

- [ ] **Step 1: Inspect existing SystemTableSelect**

```bash
sed -n '1,80p' src/components/app/select/system-table-select.tsx
```

Identify:
- How a table click currently sets state (likely `setSelectedTable` in `useOrderFlowStore`)
- The UI structure (grid of tables, status badge, etc.)

- [ ] **Step 2: Replace state update on click**

In `system-table-select.tsx`, find the table click handler and replace:

```ts
// OLD (likely):
setSelectedTable(table)
addCartItem({ ...orderingData, tableName: table.name, table: table.slug })

// NEW:
import { useTableSessions } from '@/hooks/useTableSessions'
const { openSession } = useTableSessions()
const [searchParams, setSearchParams] = useSearchParams()

const handleSelectTable = (table: ITable) => {
  openSession(table.slug, table.name)
  setSearchParams({ tab: 'menu', table: table.slug }, { replace: false })
}
```

> If `SystemTableSelect` is also used in other contexts (`/system/update-order` or staff), DO NOT directly modify shared behavior. Instead:
> - Add an optional prop `onSelect?: (table: ITable) => void` to make behavior overridable
> - If `onSelect` is provided, call it; otherwise fall back to old behavior
> - In `system-menu.tabs.tsx`, render `<SystemTableSelect onSelect={handleAdminSelect} />` with the table-session integration

> Check shared usage first:
> ```bash
> grep -rn "SystemTableSelect\b" src/ --include="*.tsx" | grep -v "select-in-" | head -10
> ```

- [ ] **Step 3: Update page.tsx to use AdminCartContent**

Replace the broken import in `src/app/system/menu/page.tsx`:

```tsx
import { useIsMobile } from '@/hooks'
import { SystemMenuTabs } from '@/components/app/tabs'
import { AdminCartContent } from './components/admin-cart-content'

export default function SystemMenuPage() {
  const isMobile = useIsMobile()

  return (
    <div className="flex w-full h-screen">
      <div className={`flex ${isMobile ? 'w-full' : 'w-[75%] xl:w-[70%] pr-6 xl:pr-0'} flex-col gap-2 overflow-hidden`}>
        <SystemMenuTabs />
      </div>
      {!isMobile && <AdminCartContent />}
    </div>
  )
}
```

> Layout fix: changed root `flex-col` to `flex` (horizontal split) — original was `flex-col` but inner divs would force horizontal anyway. Verify visual matches old (75% left, 25-30% right side-by-side).

- [ ] **Step 4: Add i18n strings (vi + en)**

In `public/locales/vi/menu.json` (or wherever menu translations live):
```json
"order": {
  ...existing...,
  "noTableSelected": "Chưa chọn bàn",
  "emptyCart": "Chưa có món nào",
  "submit": "Đặt món",
  "submitting": "Đang đặt...",
  "continueToPayment": "Thanh toán",
  "note": "Ghi chú đơn",
  "notePlaceholder": "Ghi chú cho bếp..."
}
```

Same keys in `public/locales/en/menu.json`:
```json
"noTableSelected": "No table selected",
"emptyCart": "Empty cart",
"submit": "Order",
"submitting": "Submitting...",
"continueToPayment": "Payment",
"note": "Order note",
"notePlaceholder": "Note for kitchen..."
```

Then remove the inline fallback strings (`, 'Chưa chọn bàn'`) from `admin-cart-content.tsx`.

- [ ] **Step 5: Verify build**

```bash
npx tsc -b 2>&1 | tail -10
npx eslint src/ 2>&1 | tail -10
npx vitest run 2>&1 | tail -10
```

Expect: clean TS, clean lint (or only pre-existing warnings), all tests pass.

**NO COMMIT.**

---

## Phase 6: Final verification + smoke test

### Task ADMIN-6: Full verification

- [ ] **Step 1: Run all checks**

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -5
npx eslint src/ 2>&1 | tail -5
npx vitest run 2>&1 | tail -5
```

Report results.

- [ ] **Step 2: Verify route layout**

```bash
# /system/menu route registered
grep -n "STAFF_MENU\|MenuPage" src/router/index.tsx | head -5

# /system/tables + /system/table/:id removed
grep -rn "SYSTEM_TABLES\|SYSTEM_TABLE_ORDER" src/constants/route.ts
# Expected: nothing

# /system/table/:id/payment still present
grep -n "SYSTEM_TABLE_PAYMENT" src/constants/route.ts
# Expected: present
```

- [ ] **Step 3: Verify sidebar entry**

```bash
grep -n "orderForCustomer\|STAFF_MENU" src/router/routes.ts
```

Expected: sidebar entry uses `path: ROUTE.STAFF_MENU`.

- [ ] **Step 4: Manual smoke test (user runs)**

Document the smoke checklist:
1. Login as ADMIN → sidebar shows "Đặt món" → click → navigates to `/system/menu`
2. `/system/menu` opens at `?tab=table` (default) → see SystemTableSelect (table grid UI of old admin flow)
3. Click a table → URL changes to `?tab=menu&table=<slug>` → auto-switch to menu tab → see product grid (old UI/UX preserved)
4. AdminCartContent (right): now shows table name + empty list
5. Click a product → adds to cart in pending list → cart shows item with quantity 1
6. Click "Đặt món" button → API call → item moves from pending to submitted
7. Add another item → adds to pending (next batch)
8. Click "Đặt món" again → second batch submitted
9. Click "Thanh toán" → navigates `/system/table/<slug>/payment` (TablePaymentScreen)
10. Payment screen: enter customer phone, optionally pick voucher, complete payment → back to `/system/menu` or table picker

- [ ] **Step 5: Report final status**

Report:
- All checks: PASS / FAIL counts
- Files created
- Files restored from HEAD
- Files deleted (cleanup)
- Manual smoke checklist for user
- Overall: READY / NEEDS-FIX

**NO COMMIT.**

---

## Design Decisions

1. **Why use URL `?table=<slug>`:** Bookmarkable, refresh-safe, no extra global state. Cart panel just reads URL.
2. **Why keep `SystemTableSelect` shared (with optional `onSelect` prop):** Component is also used in `/system/update-order` flow — avoid forking. The prop pattern is the same one used by `StaffTableVoucherSheet` (props-driven for reusability).
3. **Why mirror staff OrderSummary submit logic instead of reusing it:** Visual is different (old admin cart style vs staff POS panel) but logic must match. Composition via shared hooks (`useCreateOrder`, `useAddItemsToOrder`) avoids duplication.
4. **Why dine-in only:** User confirmed nhà hàng không phục vụ take-away. Removing the TabsTrigger conditionals also simplifies state — no `cartItems?.type` ambiguity.
5. **Why empty cart shows "Chưa chọn bàn" (vs disabled):** Better UX hint — user knows what to do next. Visually communicates the gated state.
6. **Why customer/note split (customer → payment, note → cart):** User confirmed this split. Order note is kitchen-facing (decided at order time), customer is invoice-facing (decided at payment time).

---

## Out of scope (potential follow-ups)

- Reconciling `useOrderFlowStore` deprecation — still used by `/system/update-order` and `/client/*` flows. Separate refactor.
- Cart re-style (matching new staff POS aesthetic) — current plan inherits old visual deliberately per user request.
- Multi-table tabs in cart panel (allowing admin to switch between active table sessions without leaving menu) — could be added later as a tab bar above AdminCartContent.
