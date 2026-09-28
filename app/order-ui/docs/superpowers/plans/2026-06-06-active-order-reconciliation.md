# Active Order Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp `useGetActiveOrderByTable` vào staff-assisted ordering flow để server trở thành source of truth cho `orderSlug` + `submittedOrders`, vá các bug "tạo đơn trùng / mất session khi reload / không thấy đơn của thiết bị khác".

**Architecture:** Thêm 2 pure functions vào `src/lib/staff-orders.ts` — một mapper `IOrderDetail → OrderItem` và một reconciler `(localSession, serverOrder) → ReconcileAction` — rồi wire chúng vào `app/staff/table-order.tsx`: query active order khi mount, apply action lên Zustand store, invalidate query sau mỗi mutation. **Server thắng** cho `orderSlug` + `submittedOrders`; **local thắng** cho `pendingItems` (chưa gửi server).

**Tech Stack:** React + TanStack Query (đã sẵn `useGetActiveOrderByTable`), Zustand + persist (`useTableSessionsStore`), Vitest + Testing Library, TypeScript.

**Out of scope (để plan riêng):**
- Sync active order ở `floor-plan.tsx` (cần bulk API).
- Realtime invalidation qua FCM notification.
- Merge logic phức tạp khi local `pendingItems` đè lên item server vừa thêm từ thiết bị khác.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/staff-orders.ts` | Modify | Thêm `mapServerOrderItemToOrderItem`, `mapServerOrderToSubmitted`, `computeSessionReconciliation` (pure). |
| `src/lib/__tests__/staff-orders.test.ts` | Create (nếu chưa có; nếu có thì Modify) | Unit test 3 helper mới. |
| `src/app/staff/table-order.tsx` | Modify | Gọi `useGetActiveOrderByTable(id)`, apply reconciliation effect, invalidate query sau mutation. |
| `src/hooks/use-order.ts` | Read-only | Đã có `useGetActiveOrderByTable` + `QUERYKEY.activeOrderByTable`. Không sửa. |

---

### Task 1: Mapper `mapServerOrderItemToOrderItem`

**Files:**
- Modify: `src/lib/staff-orders.ts`
- Test: `src/lib/__tests__/staff-orders.test.ts`

- [ ] **Step 1: Kiểm tra file test đã tồn tại chưa**

Run: `ls src/lib/__tests__/staff-orders.test.ts 2>/dev/null && echo EXISTS || echo CREATE_NEW`

Nếu `CREATE_NEW`, tạo file rỗng:

```bash
mkdir -p src/lib/__tests__
```

- [ ] **Step 2: Viết failing test**

Thêm vào `src/lib/__tests__/staff-orders.test.ts` (giữ nguyên các test cũ nếu có):

```ts
import { describe, it, expect } from 'vitest'
import { mapServerOrderItemToOrderItem } from '../staff-orders'
import type { IOrderDetail } from '@/types'

function makeDetail(overrides: Partial<IOrderDetail> = {}): IOrderDetail {
  return {
    createdAt: '2026-06-06T00:00:00Z',
    slug: 'oi-1',
    note: '',
    quantity: 2,
    subtotal: 50_000,
    status: { PENDING: 1, COMPLETED: 0, FAILED: 0, RUNNING: 0 },
    variant: {
      slug: 'v-coffee-m',
      price: 25_000,
      costPrice: 10_000,
      size: { name: 'M', description: '', slug: 'size-m' },
      product: {
        slug: 'p-coffee',
        name: 'Cà phê đen',
        description: '',
        isActive: true,
        isLimit: false,
        isTopSell: false,
        isNew: false,
        isCombo: false,
        isGift: false,
        image: '',
        images: [],
        rating: 0,
        catalog: { slug: '', name: '', description: '' },
        variants: [],
        createdAt: '',
        saleQuantityHistory: 0,
        productChefArea: '',
      },
    },
    size: { name: 'M', description: '', slug: 'size-m' },
    trackingOrderItems: [],
    ...overrides,
  } as IOrderDetail
}

describe('mapServerOrderItemToOrderItem', () => {
  it('maps standard fields from IOrderDetail', () => {
    const result = mapServerOrderItemToOrderItem(makeDetail())
    expect(result).toMatchObject({
      menuItemId: 'p-coffee',
      variantSlug: 'v-coffee-m',
      orderItemSlug: 'oi-1',
      name: 'Cà phê đen',
      priceNum: 25_000,
      quantity: 2,
      note: '',
    })
    expect(result.isCustomPrice).toBeFalsy()
  })

  it('uses customPrice when isCustomPrice=true and sets customPriceId from orderItemSlug', () => {
    const result = mapServerOrderItemToOrderItem(
      makeDetail({ slug: 'oi-cp-9', isCustomPrice: true, customPrice: 80_000 }),
    )
    expect(result.priceNum).toBe(80_000)
    expect(result.isCustomPrice).toBe(true)
    expect(result.customPriceId).toBe('oi-cp-9')
  })

  it('preserves note as-is', () => {
    const result = mapServerOrderItemToOrderItem(makeDetail({ note: 'ít đường' }))
    expect(result.note).toBe('ít đường')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t mapServerOrderItemToOrderItem`
Expected: FAIL — `mapServerOrderItemToOrderItem is not exported from '../staff-orders'`.

- [ ] **Step 4: Implement `mapServerOrderItemToOrderItem`**

Thêm vào cuối `src/lib/staff-orders.ts` (giữ nguyên các export hiện có):

```ts
import type { IOrderDetail } from '@/types'
import { formatVnd } from '@/data/staff-data'
import type { OrderItem } from '@/types/session'

export function mapServerOrderItemToOrderItem(detail: IOrderDetail): OrderItem {
  const isCustom = detail.isCustomPrice === true
  const priceNum = isCustom && detail.customPrice !== undefined
    ? detail.customPrice
    : detail.variant.price
  return {
    menuItemId: detail.variant.product.slug,
    variantSlug: detail.variant.slug,
    orderItemSlug: detail.slug,
    name: detail.variant.product.name,
    priceNum,
    price: formatVnd(priceNum),
    quantity: detail.quantity,
    note: detail.note ?? '',
    isCustomPrice: isCustom || undefined,
    customPriceId: isCustom ? detail.slug : undefined,
  }
}
```

Lưu ý import: `IOrderDetail` đã có sẵn trong `@/types`. Nếu file đang dùng `import type { SubmittedOrder, TableSession } from '@/types/session'`, mở rộng dòng đó để add `OrderItem`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t mapServerOrderItemToOrderItem`
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/staff-orders.ts src/lib/__tests__/staff-orders.test.ts
git commit -m "feat(staff): add mapServerOrderItemToOrderItem helper"
```

---

### Task 2: Mapper `mapServerOrderToSubmitted`

**Files:**
- Modify: `src/lib/staff-orders.ts`
- Test: `src/lib/__tests__/staff-orders.test.ts`

- [ ] **Step 1: Viết failing test**

Append vào `src/lib/__tests__/staff-orders.test.ts`:

```ts
import { mapServerOrderToSubmitted } from '../staff-orders'
import type { IOrder } from '@/types'

function makeOrder(overrides: Partial<IOrder> = {}): IOrder {
  return {
    createdAt: '2026-06-06T10:30:00Z',
    slug: 'order-abc',
    orderItems: [
      makeDetail({ slug: 'oi-1', quantity: 2 }),
      makeDetail({ slug: 'oi-2', quantity: 1, note: 'thêm đá' }),
    ],
    // Other fields not relevant to the mapper — cast through unknown.
    ...overrides,
  } as unknown as IOrder
}

describe('mapServerOrderToSubmitted', () => {
  it('returns one SubmittedOrder containing all mapped items', () => {
    const order = makeOrder()
    const submitted = mapServerOrderToSubmitted(order)
    expect(submitted.id).toBe('order-abc')
    expect(submitted.submittedAt).toBe('2026-06-06T10:30:00Z')
    expect(submitted.items).toHaveLength(2)
    expect(submitted.items[0].orderItemSlug).toBe('oi-1')
    expect(submitted.items[1].note).toBe('thêm đá')
  })

  it('returns empty items array when server order has no orderItems', () => {
    const submitted = mapServerOrderToSubmitted(makeOrder({ orderItems: [] }))
    expect(submitted.items).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t mapServerOrderToSubmitted`
Expected: FAIL — `mapServerOrderToSubmitted is not exported`.

- [ ] **Step 3: Implement `mapServerOrderToSubmitted`**

Append vào `src/lib/staff-orders.ts`:

```ts
import type { IOrder } from '@/types'

export function mapServerOrderToSubmitted(order: IOrder): SubmittedOrder {
  return {
    id: order.slug,
    submittedAt: order.createdAt,
    items: (order.orderItems ?? []).map(mapServerOrderItemToOrderItem),
  }
}
```

(`SubmittedOrder` đã có sẵn trong file import — không cần thêm.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t mapServerOrderToSubmitted`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staff-orders.ts src/lib/__tests__/staff-orders.test.ts
git commit -m "feat(staff): add mapServerOrderToSubmitted helper"
```

---

### Task 3: Pure reconciler `computeSessionReconciliation`

**Files:**
- Modify: `src/lib/staff-orders.ts`
- Test: `src/lib/__tests__/staff-orders.test.ts`

Thiết kế discriminated union để caller chỉ phải `switch(action.type)` — không có boolean flag mơ hồ.

- [ ] **Step 1: Viết failing test**

Append vào `src/lib/__tests__/staff-orders.test.ts`:

```ts
import { computeSessionReconciliation } from '../staff-orders'
import type { TableSession } from '@/types/session'

function makeSession(overrides: Partial<TableSession> = {}): TableSession {
  return {
    tableId: 't1',
    tableName: 'Bàn 01',
    status: 'serving',
    pendingItems: [],
    submittedOrders: [],
    openedAt: '2026-06-06T10:00:00Z',
    ...overrides,
  }
}

describe('computeSessionReconciliation', () => {
  it('returns noop when both sides have the same orderSlug', () => {
    const local = makeSession({ orderSlug: 'order-abc' })
    const server = makeOrder({ slug: 'order-abc' })
    expect(computeSessionReconciliation(local, server)).toEqual({ type: 'noop' })
  })

  it('returns noop when server has no active order and local has no orderSlug', () => {
    expect(computeSessionReconciliation(makeSession(), null)).toEqual({ type: 'noop' })
  })

  it('returns hydrate when local has no orderSlug but server has an active order', () => {
    const server = makeOrder({ slug: 'order-from-server' })
    const action = computeSessionReconciliation(makeSession(), server)
    expect(action.type).toBe('hydrate')
    if (action.type === 'hydrate') {
      expect(action.orderSlug).toBe('order-from-server')
      expect(action.submittedOrder.id).toBe('order-from-server')
    }
  })

  it('returns clear when local has orderSlug but server returns null', () => {
    const action = computeSessionReconciliation(makeSession({ orderSlug: 'order-stale' }), null)
    expect(action).toEqual({ type: 'clear', staleOrderSlug: 'order-stale' })
  })

  it('returns mismatch when local and server have different orderSlugs', () => {
    const local = makeSession({ orderSlug: 'order-local' })
    const server = makeOrder({ slug: 'order-server' })
    const action = computeSessionReconciliation(local, server)
    expect(action.type).toBe('mismatch')
    if (action.type === 'mismatch') {
      expect(action.localOrderSlug).toBe('order-local')
      expect(action.serverOrderSlug).toBe('order-server')
      expect(action.submittedOrder.id).toBe('order-server')
    }
  })

  it('returns noop when local session itself is null and server returns null', () => {
    expect(computeSessionReconciliation(null, null)).toEqual({ type: 'noop' })
  })

  it('returns hydrate when local session is null and server has an order', () => {
    const action = computeSessionReconciliation(null, makeOrder({ slug: 'order-1' }))
    expect(action.type).toBe('hydrate')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t computeSessionReconciliation`
Expected: FAIL — `computeSessionReconciliation is not exported`.

- [ ] **Step 3: Implement `computeSessionReconciliation`**

Append vào `src/lib/staff-orders.ts`:

```ts
export type ReconcileAction =
  | { type: 'noop' }
  | { type: 'hydrate'; orderSlug: string; submittedOrder: SubmittedOrder }
  | { type: 'clear'; staleOrderSlug: string }
  | {
      type: 'mismatch'
      localOrderSlug: string
      serverOrderSlug: string
      submittedOrder: SubmittedOrder
    }

export function computeSessionReconciliation(
  localSession: TableSession | null,
  serverOrder: IOrder | null,
): ReconcileAction {
  const localSlug = localSession?.orderSlug
  if (!serverOrder) {
    return localSlug ? { type: 'clear', staleOrderSlug: localSlug } : { type: 'noop' }
  }
  if (!localSlug) {
    return {
      type: 'hydrate',
      orderSlug: serverOrder.slug,
      submittedOrder: mapServerOrderToSubmitted(serverOrder),
    }
  }
  if (localSlug === serverOrder.slug) {
    return { type: 'noop' }
  }
  return {
    type: 'mismatch',
    localOrderSlug: localSlug,
    serverOrderSlug: serverOrder.slug,
    submittedOrder: mapServerOrderToSubmitted(serverOrder),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts -t computeSessionReconciliation`
Expected: 7 tests PASS.

- [ ] **Step 5: Run full staff-orders test file to confirm no regressions**

Run: `npx vitest run src/lib/__tests__/staff-orders.test.ts`
Expected: all tests PASS (3 mapServerOrderItem + 2 mapServerOrder + 7 reconciler + bất kỳ test cũ).

- [ ] **Step 6: Commit**

```bash
git add src/lib/staff-orders.ts src/lib/__tests__/staff-orders.test.ts
git commit -m "feat(staff): add computeSessionReconciliation pure function"
```

---

### Task 4: Thêm setter `replaceSubmittedOrders` vào store

Hydrate path cần ghi `orderSlug` + `submittedOrders` cùng lúc. Hiện store có `setOrderSlug` nhưng không có cách bulk-replace `submittedOrders`. Thêm một setter nhỏ thay vì hack qua `addSubmittedOrderItem` từng cái (sẽ tạo nhiều synthetic SubmittedOrder rác).

**Files:**
- Modify: `src/stores/table-sessions.store.ts`
- Test: `src/hooks/__tests__/useTableSessions.test.tsx`

- [ ] **Step 1: Viết failing test**

Append vào `src/hooks/__tests__/useTableSessions.test.tsx` trong describe `'useTableSessions'`:

```ts
  it('replaceSubmittedOrders overwrites submittedOrders for the table', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1', 'Bàn 01'))
    act(() =>
      result.current.replaceSubmittedOrders('t1', [
        {
          id: 'order-abc',
          submittedAt: '2026-06-06T10:30:00Z',
          items: [item({ menuItemId: 'm1', quantity: 3, orderItemSlug: 'oi-1' })],
        },
      ]),
    )
    expect(result.current.sessions.t1.submittedOrders).toHaveLength(1)
    expect(result.current.sessions.t1.submittedOrders[0].id).toBe('order-abc')
    expect(result.current.sessions.t1.submittedOrders[0].items[0].quantity).toBe(3)
  })

  it('replaceSubmittedOrders is a no-op when the session does not exist', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.replaceSubmittedOrders('nonexistent', []))
    expect(result.current.sessions.nonexistent).toBeUndefined()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx -t replaceSubmittedOrders`
Expected: FAIL — `result.current.replaceSubmittedOrders is not a function`.

- [ ] **Step 3: Add setter to store + interface**

Trong `src/stores/table-sessions.store.ts`:

Thêm vào interface `ITableSessionsStore` (chèn ngay dưới `addSubmittedOrderItem`):

```ts
  replaceSubmittedOrders: (tableId: string, orders: SubmittedOrder[]) => void
```

Thêm vào implementation (chèn ngay dưới `addSubmittedOrderItem`):

```ts
      replaceSubmittedOrders: (tableId, orders) =>
        set((state) =>
          patchSession(state, tableId, (session) => ({ ...session, submittedOrders: orders })),
        ),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx -t replaceSubmittedOrders`
Expected: 2 tests PASS.

- [ ] **Step 5: Run full hook test file**

Run: `npx vitest run src/hooks/__tests__/useTableSessions.test.tsx`
Expected: all previous tests + 2 new = all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/table-sessions.store.ts src/hooks/__tests__/useTableSessions.test.tsx
git commit -m "feat(staff): add replaceSubmittedOrders setter to table sessions store"
```

---

### Task 5: Reconciliation effect trong `table-order.tsx`

**Files:**
- Modify: `src/app/staff/table-order.tsx`

Vì page hiện bail out sớm khi `!session`, ta phải nới lỏng gate đó: nếu vẫn còn loading hoặc server có active order → khoan show "Not found".

- [ ] **Step 1: Import dependencies**

Sửa các import ở đầu file:

```ts
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { showErrorToastMessage, showToast } from '@/utils'
import { MenuPanel } from '@/components/staff/menu-panel'
import { OrderSummary } from '@/components/staff/order-summary'
import { ReceiptDialog } from '@/components/staff/receipt-dialog'
import { PosNotFoundState } from '@/components/staff/pos-not-found'
import { PosPageHeader } from '@/components/staff/pos-page-header'
import { TableStatusBadge } from '@/components/staff/table-status-badge'
import { TransferTableDialog } from '@/components/staff/transfer-table-dialog'
import { useTableSessions } from '@/hooks/useTableSessions'
import {
  useAddNewOrderItem,
  useCreateOrder,
  useDeleteOrder,
  useDeleteOrderItem,
  useUpdateNoteOrderItem,
  useUpdateOrderItem,
  useTables,
  useGetActiveOrderByTable,
} from '@/hooks'
import { collectOrderItemsForKey } from '@/lib/staff-orders'
import { computeSessionReconciliation } from '@/lib/staff-orders'
import { QUERYKEY } from '@/constants'
import { useUserStore } from '@/stores'
import type { OrderItem } from '@/types/session'
import { OrderTypeEnum } from '@/types'
import type { Table } from '@/data/staff-data'
```

(Có thể gộp `computeSessionReconciliation` vào dòng import `collectOrderItemsForKey` thành một — tùy convention file.)

- [ ] **Step 2: Lấy thêm hooks ở đầu component**

Ngay dưới chỗ destructure `useTableSessions()`, thêm:

```ts
  const queryClient = useQueryClient()
  const {
    data: serverActiveOrder,
    isLoading: isLoadingActiveOrder,
  } = useGetActiveOrderByTable(id)
  const { replaceSubmittedOrders } = useTableSessions()
```

(Nếu hiện đã destructure đủ từ một call duy nhất, append `replaceSubmittedOrders` vào destructure đó thay vì gọi 2 lần.)

- [ ] **Step 3: Thêm reconciliation effect**

Chèn ngay TRƯỚC dòng `if (!session)` gate:

```ts
  const sessionForReconcile = sessions[id] ?? null
  useEffect(() => {
    if (isLoadingActiveOrder) return
    const action = computeSessionReconciliation(sessionForReconcile, serverActiveOrder ?? null)
    switch (action.type) {
      case 'noop':
        return
      case 'hydrate': {
        // Open session if it doesn't exist locally (e.g. direct URL refresh)
        if (!sessionForReconcile) {
          const tableName = tables.find((t) => t.id === id)?.label ?? id
          openSession(id, tableName)
        }
        setOrderSlug(id, action.orderSlug)
        replaceSubmittedOrders(id, [action.submittedOrder])
        return
      }
      case 'mismatch': {
        setOrderSlug(id, action.serverOrderSlug)
        replaceSubmittedOrders(id, [action.submittedOrder])
        showToast('Đơn đã được cập nhật từ thiết bị khác')
        return
      }
      case 'clear': {
        // Server says no active order — local orderSlug is stale (paid/canceled elsewhere).
        cancelSession(id)
        showErrorToastMessage('Đơn này đã đóng từ thiết bị khác')
        navigate('/staff')
        return
      }
    }
  }, [
    id,
    isLoadingActiveOrder,
    serverActiveOrder,
    sessionForReconcile,
    tables,
    openSession,
    setOrderSlug,
    replaceSubmittedOrders,
    cancelSession,
    navigate,
  ])
```

(`openSession` cần được destructure từ `useTableSessions()` — bổ sung vào danh sách destructure ở đầu component nếu thiếu.)

- [ ] **Step 4: Nới gate "not found" để chờ query xong**

Thay block:

```ts
  if (!session) {
    return <PosNotFoundState message="Không tìm thấy bàn hoặc phiên đã đóng." />
  }
```

Bằng:

```ts
  if (!session) {
    if (isLoadingActiveOrder) {
      return <PosNotFoundState message="Đang tải phiên bàn..." />
    }
    return <PosNotFoundState message="Không tìm thấy bàn hoặc phiên đã đóng." />
  }
```

(Có thể tách thành component loading riêng sau — bước này ưu tiên tối thiểu.)

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Smoke test thủ công**

Chạy dev server: `npm run dev`

Test các tình huống sau (mỗi cái 1 lần, dùng dev tools để clear localStorage giữa các test):

1. **Cross-device hydrate**: tạo order ở thiết bị/browser A (bấm "ĐẶT MÓN" trên bàn X). Mở browser B (incognito, đã đăng nhập staff), vào URL `/staff/table/<X-slug>`. Expected: thấy đơn đã đặt trong "Đã đặt N lần".
2. **Stale local clear**: ở browser A, tạo order. Hủy đơn từ trang khác (hoặc xoá order qua admin). Quay lại browser A trang `/staff/table/<X>`. Expected: toast "Đơn này đã đóng từ thiết bị khác" + navigate về `/staff`.
3. **Noop**: tạo order, rồi reload page. Expected: không có toast lạ, UI giữ nguyên `submittedOrders`.
4. **Direct URL refresh sau khi clear localStorage**: ở browser A đã có order PENDING, mở DevTools → clear localStorage → reload. Expected: page tự openSession + hydrate submittedOrders từ server (không bị "Not found").

Báo PASS/FAIL từng mục.

- [ ] **Step 7: Commit**

```bash
git add src/app/staff/table-order.tsx
git commit -m "feat(staff): reconcile local table session against server active order"
```

---

### Task 6: Invalidate query sau mỗi mutation

Sau mỗi `await` mutation thay đổi order, invalidate `[QUERYKEY.activeOrderByTable, id]` để các thiết bị khác refetch khi quay lại trang. Cùng device cũng được hưởng — đảm bảo data luôn fresh.

**Files:**
- Modify: `src/app/staff/table-order.tsx`

- [ ] **Step 1: Tạo helper invalidate gọn ở đầu component**

Sau hàm `handleAdd` (hoặc tương đương), trước `handleSubmitOrder`, thêm:

```ts
  const invalidateActiveOrder = () =>
    queryClient.invalidateQueries({ queryKey: [QUERYKEY.activeOrderByTable, id] })
```

- [ ] **Step 2: Gọi invalidate sau `handleSubmitOrder`**

Trong `handleSubmitOrder`, sau dòng `submitOrder(id)` và TRƯỚC `} catch`:

```ts
      submitOrder(id)
      invalidateActiveOrder()
```

- [ ] **Step 3: Gọi invalidate sau `handleSubmittedChanges`**

Trong `handleSubmittedChanges`, sau dòng `showToast('Đã cập nhật đơn')`:

```ts
      showToast('Đã cập nhật đơn')
      invalidateActiveOrder()
```

- [ ] **Step 4: Gọi invalidate sau `handleCancelOrder`**

Trong `handleCancelOrder`, sau `await deleteOrderAsync(...)` và TRƯỚC `cancelSession(id)`:

```ts
    await deleteOrderAsync(currentSession.orderSlug)
    invalidateActiveOrder()
    cancelSession(id)
```

(Invalidate trước cancelSession vì invalidate sẽ refetch — và refetch sẽ thấy server đã xóa → trả null → reconcile sẽ bắn 'clear'. Tuy nhiên đã cancelSession local rồi nên reconcile chỉ nhận noop. Thứ tự này tránh race.)

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Smoke test thủ công**

Chạy dev: `npm run dev`. Test:

1. Mở 2 browser cùng bàn X. Browser A bấm "ĐẶT MÓN" thêm 1 món. Switch sang browser B (đang ở `/staff/table/<X>`) — không cần reload, đợi vài giây hoặc tab focus → expected: B refetch và thấy món A vừa thêm trong "Đã đặt".

(Lưu ý: không có realtime — B chỉ refetch khi window focus/refetch interval. Đây là behavior chấp nhận được cho phase này; sẽ wire realtime ở plan sau.)

- [ ] **Step 7: Commit**

```bash
git add src/app/staff/table-order.tsx
git commit -m "feat(staff): invalidate active order query after mutations"
```

---

### Task 7: Full regression run

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: all PASS (giữ ≥ 478 tests + tests mới của task 1-4).

- [ ] **Step 2: Run typecheck + lint**

Run: `npm run build`
Expected: PASS (lint + tsc -b + vite build đều xanh).

- [ ] **Step 3: Final smoke test trên build production**

Run: `npm run dev` rồi đi lại 4 scenario của Task 5 Step 6 + scenario của Task 6 Step 6 lần nữa.

Expected: tất cả pass.

- [ ] **Step 4: Commit nếu có chỉnh sửa nhỏ phát sinh**

(Nếu không có gì, bỏ qua step này.)

---

## Self-Review

**Spec coverage:**
- Hydrate khi local thiếu orderSlug ↔ Task 5 case `'hydrate'`. ✓
- Tránh tạo đơn trùng khi localStorage mất ↔ Task 5 hydrate path set `orderSlug` trước khi user kịp bấm "ĐẶT MÓN" lần nữa. ✓
- Multi-device thấy chung đơn ↔ Task 5 hydrate + Task 6 invalidate. ✓
- Detect order closed phía server ↔ Task 5 case `'clear'`. ✓
- Pure helpers test được ↔ Task 1-3 có TDD. ✓
- Bulk replace submittedOrders ↔ Task 4. ✓

**Out of scope (documented):**
- Floor plan badge, realtime invalidation, merge phức tạp khi local pending overlap server new items.

**Placeholder scan:** không có TBD/TODO/"implement later". Tất cả step có code/command cụ thể.

**Type consistency:**
- `mapServerOrderItemToOrderItem` → `OrderItem` (từ `@/types/session`)
- `mapServerOrderToSubmitted` → `SubmittedOrder`
- `computeSessionReconciliation` nhận `TableSession | null`, `IOrder | null`, trả `ReconcileAction`
- `replaceSubmittedOrders(tableId, orders: SubmittedOrder[])` — khớp giữa store interface, implementation, test, và Task 5 hydrate caller.
- `QUERYKEY.activeOrderByTable` đã tồn tại — Task 6 sử dụng đúng tên.

Không phát hiện gap.
