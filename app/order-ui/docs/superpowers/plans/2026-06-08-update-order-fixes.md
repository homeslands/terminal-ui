# Update Order Flow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 silent UX issues trong flow `/system/order-management/:slug/update`: (1) đơn rỗng làm stuck toàn bộ trang, (2) confirm flow không rollback khi 1 trong N request fail → server divergent, (3) reinit preserve logic fragile + auto-fire không có ý kiến user.

**Architecture:**
1. **Empty-order recovery**: bỏ guard `orderItems.length === 0`, init `updatingData` với mảng rỗng, hiện banner "đơn chưa có món, hãy thêm" trong cart-content phải.
2. **Rollback added items**: trong `handleSubmit` của `client-confirm-update-order-dialog.tsx`, track slug các item vừa add thành công. Nếu phase nào sau đó fail → loop `deleteOrderItem` undo các item đã add. Toast khác biệt "Đã hoàn tác X món vừa thêm".
3. **Explicit reinit prompt**: thay `setShouldReinitialize(true)` auto-fire bằng `pendingReinitOrder` state. Khi có pending → show dialog "Server có data mới, tải lại?" — user quyết định. Bỏ luôn cụm preserve fragile có `setTimeout(100)`.

**Tech Stack:** React 18, TanStack Query v5, Zustand, Vitest + Testing Library, TypeScript, react-router-dom v6.

**Out of scope (cần thảo luận / backend):**
- Full transactional rollback (vd: rollback delete khi update fail). Cần snapshot trước delete; phức tạp, ROI thấp.
- BE bulk endpoint `PATCH /orders/{slug}/items` để atomic. Cần BE đầu tư.
- Auto-merge server changes vào local draft (3-way merge). Out of scope vì user-driven là đủ.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/lib/update-order-helpers.ts` | **Create** | 3 pure helpers: `shouldShowEmptyItemsBanner`, `hasServerOrderDiverged`, type `OrderRollbackEntry`. |
| `src/lib/__tests__/update-order-helpers.test.ts` | **Create** | Unit tests cho 3 helpers. |
| `src/app/system/update-order/page.tsx` | Modify | (a) bỏ guard empty items khi init, (b) thay auto-reinit bằng `pendingReinitOrder` state + prompt dialog. |
| `src/app/system/update-order/components/update-order-content.tsx` | Modify | Hiện banner "đơn chưa có món" khi `orderItems.length === 0`. |
| `src/app/system/update-order/components/reinit-confirm-dialog.tsx` | **Create** | Dialog "Server có data mới. Tải lại?". Component nhỏ tự chứa. |
| `src/components/app/dialog/client-confirm-update-order-dialog.tsx` | Modify | Track added slugs, rollback on failure, toast khác biệt. |

---

### Task 1: Pure helper `shouldShowEmptyItemsBanner` (Fix 1 foundation)

**Files:**
- Create: `src/lib/update-order-helpers.ts`
- Create: `src/lib/__tests__/update-order-helpers.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/update-order-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldShowEmptyItemsBanner } from '../update-order-helpers'

describe('shouldShowEmptyItemsBanner', () => {
  it('returns true when orderItems is empty array', () => {
    expect(shouldShowEmptyItemsBanner([])).toBe(true)
  })

  it('returns true when orderItems is undefined', () => {
    expect(shouldShowEmptyItemsBanner(undefined)).toBe(true)
  })

  it('returns false when orderItems has at least one item', () => {
    expect(shouldShowEmptyItemsBanner([{ id: 'x' } as never])).toBe(false)
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `npx vitest run src/lib/__tests__/update-order-helpers.test.ts -t shouldShowEmptyItemsBanner`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

Create `src/lib/update-order-helpers.ts`:

```ts
import type { IOrderItem } from '@/types'

export function shouldShowEmptyItemsBanner(orderItems: IOrderItem[] | undefined): boolean {
  return !orderItems || orderItems.length === 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/update-order-helpers.test.ts -t shouldShowEmptyItemsBanner`
Expected: 3 PASS.

---

### Task 2: Pure helper `hasServerOrderDiverged` (Fix 3 foundation)

**Files:**
- Modify: `src/lib/update-order-helpers.ts`
- Modify: `src/lib/__tests__/update-order-helpers.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/lib/__tests__/update-order-helpers.test.ts`:

```ts
import { hasServerOrderDiverged } from '../update-order-helpers'
import type { IOrder } from '@/types'

function makeOrder(orderItems: Array<{ slug: string; quantity: number; note?: string }>): IOrder {
  return {
    slug: 'order-x',
    orderItems: orderItems.map((it) => ({
      slug: it.slug,
      quantity: it.quantity,
      note: it.note ?? '',
    })),
  } as unknown as IOrder
}

describe('hasServerOrderDiverged', () => {
  it('returns false when both orders have identical item slug+quantity+note', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 2, note: 'ít đá' }])
    const b = makeOrder([{ slug: 'i1', quantity: 2, note: 'ít đá' }])
    expect(hasServerOrderDiverged(a, b)).toBe(false)
  })

  it('returns true when item quantity differs', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 2 }])
    const b = makeOrder([{ slug: 'i1', quantity: 5 }])
    expect(hasServerOrderDiverged(a, b)).toBe(true)
  })

  it('returns true when item note differs', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 2, note: 'ít đá' }])
    const b = makeOrder([{ slug: 'i1', quantity: 2, note: 'không đá' }])
    expect(hasServerOrderDiverged(a, b)).toBe(true)
  })

  it('returns true when item count differs (added on server)', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 1 }])
    const b = makeOrder([{ slug: 'i1', quantity: 1 }, { slug: 'i2', quantity: 1 }])
    expect(hasServerOrderDiverged(a, b)).toBe(true)
  })

  it('returns true when slug differs (item replaced)', () => {
    const a = makeOrder([{ slug: 'i1', quantity: 1 }])
    const b = makeOrder([{ slug: 'i2', quantity: 1 }])
    expect(hasServerOrderDiverged(a, b)).toBe(true)
  })

  it('returns false when both orders have empty orderItems', () => {
    const a = makeOrder([])
    const b = makeOrder([])
    expect(hasServerOrderDiverged(a, b)).toBe(false)
  })

  it('returns false when null is compared with null', () => {
    expect(hasServerOrderDiverged(null, null)).toBe(false)
  })

  it('returns true when one side is null and other has data', () => {
    expect(hasServerOrderDiverged(null, makeOrder([{ slug: 'i1', quantity: 1 }]))).toBe(true)
    expect(hasServerOrderDiverged(makeOrder([{ slug: 'i1', quantity: 1 }]), null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `npx vitest run src/lib/__tests__/update-order-helpers.test.ts -t hasServerOrderDiverged`
Expected: FAIL — `hasServerOrderDiverged is not exported`.

- [ ] **Step 3: Implement helper**

Append to `src/lib/update-order-helpers.ts`:

```ts
import type { IOrder } from '@/types'

/**
 * Returns true if `local` and `server` differ in item slug, quantity, or note.
 * Order-insensitive (compares sorted fingerprints). Use to decide whether to
 * prompt user to reload after server-side changes.
 */
export function hasServerOrderDiverged(
  local: IOrder | null,
  server: IOrder | null,
): boolean {
  if (local === null && server === null) return false
  if (local === null || server === null) return true
  return fingerprint(local) !== fingerprint(server)
}

function fingerprint(order: IOrder): string {
  const items = order.orderItems ?? []
  return items
    .map((it) => `${it.slug}:${it.quantity}:${it.note ?? ''}`)
    .sort()
    .join('|')
}
```

Note: the test factory builds `IOrder` with minimal fields via `as unknown as IOrder` — the helper only reads `orderItems[].slug/quantity/note`, doesn't care about other IOrder fields.

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run src/lib/__tests__/update-order-helpers.test.ts`
Expected: 11 PASS (3 from Task 1 + 8 from Task 2).

---

### Task 3: Type + helper `OrderRollbackEntry` (Fix 2 foundation)

**Files:**
- Modify: `src/lib/update-order-helpers.ts`
- Modify: `src/lib/__tests__/update-order-helpers.test.ts`

We need a small orchestrator that, given a list of slugs to roll back and a delete function, attempts each delete and returns count of successful rollbacks. Pure-ish (delete is injected).

- [ ] **Step 1: Write failing test**

Append to `src/lib/__tests__/update-order-helpers.test.ts`:

```ts
import { rollbackAddedItems } from '../update-order-helpers'
import { vi } from 'vitest'

describe('rollbackAddedItems', () => {
  it('calls deleteFn for each slug in reverse order and returns count', async () => {
    const calls: string[] = []
    const deleteFn = vi.fn(async (slug: string) => {
      calls.push(slug)
    })
    const result = await rollbackAddedItems(['a', 'b', 'c'], deleteFn)
    expect(calls).toEqual(['c', 'b', 'a'])
    expect(result.succeeded).toBe(3)
    expect(result.failed).toBe(0)
  })

  it('continues rolling back even if some deletes fail', async () => {
    const deleteFn = vi.fn(async (slug: string) => {
      if (slug === 'b') throw new Error('boom')
    })
    const result = await rollbackAddedItems(['a', 'b', 'c'], deleteFn)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(deleteFn).toHaveBeenCalledTimes(3)
  })

  it('returns zero counts when slug list is empty', async () => {
    const deleteFn = vi.fn()
    const result = await rollbackAddedItems([], deleteFn)
    expect(result).toEqual({ succeeded: 0, failed: 0 })
    expect(deleteFn).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `npx vitest run src/lib/__tests__/update-order-helpers.test.ts -t rollbackAddedItems`
Expected: FAIL — `rollbackAddedItems is not exported`.

- [ ] **Step 3: Implement helper**

Append to `src/lib/update-order-helpers.ts`:

```ts
/**
 * Roll back items we successfully added by deleting them in reverse order.
 * Continues on individual delete failures (best-effort cleanup).
 * Returns counts so caller can show a "Rolled back X of Y" toast.
 */
export async function rollbackAddedItems(
  slugs: string[],
  deleteFn: (slug: string) => Promise<unknown>,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0
  let failed = 0
  for (const slug of [...slugs].reverse()) {
    try {
      await deleteFn(slug)
      succeeded++
    } catch {
      failed++
    }
  }
  return { succeeded, failed }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/__tests__/update-order-helpers.test.ts`
Expected: 14 PASS (3 + 8 + 3 new).

- [ ] **Step 5: Verify build**

Run: `npx tsc -b 2>&1 | head -5`
Expected: clean.

---

### Task 4: Apply rollback in `handleSubmit` (Fix 2 wiring)

**Files:**
- Modify: `src/components/app/dialog/client-confirm-update-order-dialog.tsx`

Wire `rollbackAddedItems` into the existing `handleSubmit` catch block. Track added slugs in `newItemSlugMap` (already exists in code).

- [ ] **Step 1: Add import**

In `src/components/app/dialog/client-confirm-update-order-dialog.tsx`, add to existing imports:

```ts
import { rollbackAddedItems } from '@/lib/update-order-helpers'
```

- [ ] **Step 2: Wrap deleteOrderItem in a Promise helper INSIDE handleSubmit**

Currently `deleteOrderItem` is the mutation from `useDeleteOrderItem` and uses callback style. To use with `rollbackAddedItems`, we need a Promise-returning wrapper.

Inside `handleSubmit` (top of function body, AFTER the early return guard `if (!orderDraft || !originalOrder) return`), add:

```ts
    // Promise wrapper around deleteOrderItem mutation for rollback
    const deleteOneItem = (slug: string) => new Promise<void>((resolve, reject) => {
      deleteOrderItem(slug, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      })
    })
```

- [ ] **Step 3: Update catch block to rollback**

Find the existing `} catch { showErrorToast(11000) }` at the end of `handleSubmit` (around line 294-296). Replace with:

```ts
    } catch (err) {
      // Rollback the items we successfully added so server state doesn't
      // diverge from local. Best-effort: continue on individual failures.
      const addedSlugs = Array.from(newItemSlugMap.values())
      if (addedSlugs.length > 0) {
        const { succeeded, failed } = await rollbackAddedItems(addedSlugs, deleteOneItem)
        if (succeeded > 0) {
          showToast(tToast('toast.rollbackAddedItems', { count: succeeded }))
        }
        if (failed > 0) {
          showErrorToastMessage(tToast('toast.rollbackPartialFail', { count: failed }))
        }
      }
      showErrorToast(11000)
      // Re-throw not needed; user sees toast.
      void err
    }
```

Note: `tToast` is already in scope (the `useTranslation('toast')` hook). `showToast` and `showErrorToastMessage` may need to be imported — check the existing imports at top of file and add any missing.

- [ ] **Step 4: Add 2 toast keys**

In the toast i18n namespace files (find them via `find public/locales -name 'toast.json'`), add 2 keys:

```json
"rollbackAddedItems": "Đã hoàn tác {{count}} món vừa thêm do lỗi cập nhật",
"rollbackPartialFail": "Không hoàn tác được {{count}} món, vui lòng kiểm tra đơn"
```

Add to **all locale files** (typically `vi/toast.json` and `en/toast.json`). For en: translate appropriately:
- `"rollbackAddedItems": "Rolled back {{count}} newly added items due to update failure"`
- `"rollbackPartialFail": "Failed to roll back {{count}} items, please verify the order"`

If only 1 locale exists, only update that. Run `find public/locales -name "toast.json"` to know what's there.

- [ ] **Step 5: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/components/app/dialog/client-confirm-update-order-dialog.tsx 2>&1 | head -10`
Run: `npx vitest run 2>&1 | tail -5`
Expected: all clean + tests pass.

- [ ] **Step 6: Manual smoke**

1. Mở `/system/order-management/<slug>/update` cho 1 đơn đang PENDING.
2. Add 3 món qua menu trái.
3. DevTools Network → Throttle to "Offline" hoặc block `/order-items/*` PATCH endpoint với "Network conditions → block request URL".
4. Bấm "Xác nhận cập nhật" → expected:
   - 3 món đã add thành công ở server (POST `/order-items`)
   - 1 trong các call patch sau (vd `updateOrderType` hoặc voucher) fail
   - Catch fire → rollback fire → 3 DELETE `/order-items/<slug>` lần lượt
   - Toast "Đã hoàn tác 3 món vừa thêm…" + toast lỗi gốc
5. Refresh page → đơn trở về state ban đầu (chưa có 3 món). ✓

---

### Task 5: Empty-order banner (Fix 1 wiring)

**Files:**
- Modify: `src/app/system/update-order/page.tsx`
- Modify: `src/app/system/update-order/components/update-order-content.tsx`

- [ ] **Step 1: Bỏ guard empty items khi init**

In `src/app/system/update-order/page.tsx`, find:

```ts
            // Validate order data có đầy đủ không
            if (!orderData.slug || !orderData.orderItems || orderData.orderItems.length === 0) {
                return
            }
```

Replace with:

```ts
            // Chỉ cần slug để init; orderItems có thể rỗng (đơn vừa tạo, hoặc bị clear hết món)
            // — user vẫn add món mới qua menu trái.
            if (!orderData.slug) {
                return
            }
```

- [ ] **Step 2: Render banner trong cart-content khi rỗng**

In `src/app/system/update-order/components/update-order-content.tsx`, find the place that renders `orderItems` list. Around line 162 it has:

```tsx
                        {orderItems && orderItems.length > 0 ? (
```

Find the ELSE branch (when orderItems is empty). It likely renders nothing or generic empty state. Update to show explicit banner.

Locate the existing empty branch and replace with this banner. Add necessary import for `shouldShowEmptyItemsBanner` + an icon (e.g. `Info` from `lucide-react` if not imported).

```tsx
                        ) : (
                          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
                            <Info className="w-8 h-8 text-orange-400" />
                            <div>
                              <div className="font-semibold text-foreground">Đơn này chưa có món</div>
                              <div className="mt-1 text-xs">
                                Bạn có thể thêm món mới từ menu bên trái.
                              </div>
                            </div>
                          </div>
                        )}
```

Add to imports if not present:
```ts
import { Info } from 'lucide-react'
```

(Don't use `shouldShowEmptyItemsBanner` helper here — the existing `orderItems.length > 0` check is equivalent and inline. Helper exists for Task 6 reuse; not required here.)

- [ ] **Step 3: Verify**

Run: `npx tsc -b 2>&1 | head -5`
Run: `npx eslint src/app/system/update-order/page.tsx src/app/system/update-order/components/update-order-content.tsx 2>&1 | head -5`
Run: `npx vitest run 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 4: Manual smoke**

1. Find or create an order with 0 items (test data). If hard to reproduce, temporarily mock `useOrderBySlug` to return `{ orderItems: [] }` in browser console.
2. Vào `/system/order-management/<emptySlug>/update`.
3. Expected: banner "Đơn này chưa có món" hiện bên phải; menu trái **enabled** (không xám); add món được vào draft; bấm "Xác nhận" lưu được.

---

### Task 6: Explicit reinit confirm dialog (Fix 3 wiring)

**Files:**
- Create: `src/app/system/update-order/components/reinit-confirm-dialog.tsx`
- Modify: `src/app/system/update-order/page.tsx`

Thay `setShouldReinitialize(true)` auto-fire bằng `pendingReinitOrder` state. Khi có pending → render `<ReinitConfirmDialog>`. User confirm → run reinit (đơn giản: `initializeUpdating(serverOrder)` — drop draft, không preserve). User dismiss → set pendingReinitOrder(null), giữ draft.

- [ ] **Step 1: Create ReinitConfirmDialog component**

Create `src/app/system/update-order/components/reinit-confirm-dialog.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui'

interface Props {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ReinitConfirmDialog({ open, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Đơn vừa được cập nhật ở thiết bị khác</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tải lại để xem dữ liệu mới nhất từ server. Mọi thay đổi đang chỉnh sửa (chưa lưu) sẽ bị bỏ.
        </p>
        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onCancel}>
            Tiếp tục chỉnh
          </Button>
          <Button onClick={onConfirm}>Tải lại</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire vào page.tsx**

In `src/app/system/update-order/page.tsx`:

(a) Add imports:
```ts
import { ReinitConfirmDialog } from './components/reinit-confirm-dialog'
import { hasServerOrderDiverged } from '@/lib/update-order-helpers'
```

(b) Add state at top of component, near other useState:
```ts
    const [pendingReinitOrder, setPendingReinitOrder] = useState<typeof order | null>(null)
```

(c) Find the polling effect (around line 234-256). After `const orderData = updatedOrder.data`, add divergence detection:

```ts
            if (orderData) {
                // Stop polling if order status changed from PENDING
                if (orderData.status !== OrderStatus.PENDING) {
                    setIsPolling(false)
                }
                // Detect server-side divergence: if server data differs from what we initialized,
                // prompt user to reload (instead of auto-reinitializing).
                if (
                    updatingData?.originalOrder &&
                    hasServerOrderDiverged(updatingData.originalOrder, orderData) &&
                    pendingReinitOrder === null
                ) {
                    setPendingReinitOrder(orderData)
                }
            }
```

(d) Replace the existing `_handleRefetchAndReinitialize` callback (around line 258-261) — remove `setShouldReinitialize(true)`:

```ts
    const _handleRefetchAndReinitialize = useCallback(async () => {
        const result = await refetchOrder()
        if (result.data && updatingData?.originalOrder &&
            hasServerOrderDiverged(updatingData.originalOrder, result.data)) {
            setPendingReinitOrder(result.data)
        }
    }, [refetchOrder, updatingData])
```

(e) Add handlers below `_handleRefetchAndReinitialize`:

```ts
    const handleReinitConfirm = () => {
        if (pendingReinitOrder) {
            clearUpdatingData()
            initializeUpdating(pendingReinitOrder)
        }
        setPendingReinitOrder(null)
    }

    const handleReinitCancel = () => {
        setPendingReinitOrder(null)
    }
```

(f) Render dialog at the end of the return (right before the closing tag of the outer div):

```tsx
            <ReinitConfirmDialog
                open={pendingReinitOrder !== null}
                onConfirm={handleReinitConfirm}
                onCancel={handleReinitCancel}
            />
```

(g) **Remove the complex preserve block**: find the `if (shouldReinitialize)` block (line 44-168 — the big block with `setTimeout(100)`, preservedItemChanges, etc.) and remove it entirely. Replace the surrounding `if-else` so the else branch (first-time init) becomes the only branch:

Find:
```ts
            if (shouldReinitialize) {
                // ... ~120 lines of preserve logic ...
            } else {
                // ✅ Force initialize updating phase với original order
                try {
                    initializeUpdating(orderData)
                    setIsDataLoaded(true)
                } catch (error) {
                    console.error('❌ Update Order: Failed to initialize updating data:', error)
                }
            }
```

Replace with:
```ts
            // First-time init only. Subsequent server changes are handled via
            // ReinitConfirmDialog (explicit user confirm).
            try {
                initializeUpdating(orderData)
                setIsDataLoaded(true)
            } catch (error) {
                console.error('❌ Update Order: Failed to initialize updating data:', error)
            }
```

(h) Remove `shouldReinitialize` state and `setShouldReinitialize` (around line 19):
```ts
    const [shouldReinitialize, setShouldReinitialize] = useState<boolean>(false)
```

Delete this line + remove `shouldReinitialize` from the useEffect deps array (currently includes it).

(i) The useEffect condition simplifies — find:
```ts
        if (order && order.orderItems && (!isDataLoaded || shouldReinitialize) && !isRefetching) {
```

Change to:
```ts
        if (order && !isDataLoaded && !isRefetching) {
```

(removing `order.orderItems` check too since Task 5 handles empty case.)

- [ ] **Step 3: Verify**

Run: `npx tsc -b 2>&1 | head -10`
Expected: clean. Watch for unused-var warnings (vd `_handleRefetchAndReinitialize` if no longer called — keep it since `SystemMenuInUpdateOrderTabs onSubmit={_handleRefetchAndReinitialize}` still uses it).

Run: `npx eslint src/app/system/update-order/page.tsx 2>&1 | head -10`
Expected: clean.

Run: `npx vitest run 2>&1 | tail -5`
Expected: tests pass. Net new tests = 11 from Tasks 1-3, no test changes for Tasks 4-6 (they wire imperative logic that's hard to unit-test cleanly; covered by manual smoke).

- [ ] **Step 4: Manual smoke**

1. Mở `/system/order-management/<slug>/update` cho 1 đơn PENDING.
2. Add 1 món vào draft local (không submit).
3. Mở tab khác / device khác → sửa order đó qua API hoặc UI (vd: thêm 1 món qua POST `/order-items`).
4. Quay về tab gốc → đợi ≤5s polling → expected: dialog "Đơn vừa được cập nhật…" xuất hiện.
5. Test "Tiếp tục chỉnh" → dialog đóng, draft local giữ nguyên (món vừa add còn nguyên). 
6. Lặp lại scenario, test "Tải lại" → dialog đóng, draft bị reset, server data load lên (món vừa add ở step 2 mất, món thêm ở step 3 hiện).

---

### Task 7: Full regression

- [ ] **Step 1: Run all tests**

Run: `npx vitest run 2>&1 | tail -10`
Expected: all PASS. Net change: +14 unit tests from Tasks 1-3 (3 + 8 + 3).

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -15`
Expected: PASS, dist/ produced.

- [ ] **Step 3: End-to-end manual smoke**

Chạy lại 3 manual scenarios từ Task 4 (rollback), Task 5 (empty order), Task 6 (reinit prompt). Mỗi scenario PASS/FAIL.

---

## Self-Review

**Spec coverage:**
- Fix 1 (empty order stuck) ↔ Task 1 helper + Task 5 wiring. ✓
- Fix 2 (rollback) ↔ Task 3 helper + Task 4 wiring. ✓
- Fix 3 (reinit prompt) ↔ Task 2 helper + Task 6 wiring. ✓

**Out-of-scope respected:**
- Không attempt full transactional rollback (delete + update).
- Không thay BE.
- Không auto-merge — chỉ explicit user confirm.

**Placeholder scan:** none — mỗi step có code/command/expected output cụ thể.

**Type consistency:**
- `shouldShowEmptyItemsBanner(IOrderItem[] | undefined): boolean` — caller dùng inline check tương đương, helper exist cho future reuse.
- `hasServerOrderDiverged(IOrder | null, IOrder | null): boolean` — caller pass `updatingData.originalOrder` + `orderData`, cả 2 là `IOrder | null/undefined`. Đồng nhất.
- `rollbackAddedItems(string[], (slug) => Promise<unknown>): Promise<{succeeded, failed}>` — caller wrap `deleteOrderItem` callback-style trong Promise, signature khớp.
- `ReinitConfirmDialog` Props: `open, onConfirm, onCancel`. page.tsx pass `pendingReinitOrder !== null` + 2 handlers. Khớp.

**Risk notes:**
- Task 6 xoá ~120 dòng preserve logic. Nếu có corner case mình chưa nghĩ tới (vd: pickup time preserve khi reinit) → có thể bị mất. Manual smoke step 5 đã check "draft giữ nguyên khi cancel" — verify pickup time + voucher + table cũng còn nguyên.
- Task 4 rollback chỉ cover ADDED items. Nếu update/delete fail giữa chừng → state partial vẫn divergent (vd: 1 món đã delete server thành công, sau đó voucher update fail → món đó vẫn mất, user không thấy). Acceptable per "Out of scope" note.
- Task 5 init với empty array — chưa verify `initializeUpdating` xử lý đúng empty case. Nếu nó throw → page bị stuck khác. Manual smoke step 4 sẽ verify.
