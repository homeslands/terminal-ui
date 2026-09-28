# P3: API Layer Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove DOM manipulation from the API layer, add missing QUERYKEY constants, and replace raw string query keys in `use-order.ts`.

**Architecture:** API functions in `src/api/` should return data — never touch the DOM or Zustand stores. `exportPublicOrderInvoice` in `src/api/order.ts` currently creates a `<a>` element, clicks it, and appends/removes it from `document.body`. This belongs in the hook (`src/hooks/use-order.ts`) as a `onSuccess` side-effect. Query key constants in `src/constants/query.ts` are missing 6 order-related entries that `use-order.ts` currently declares as raw string literals — centralizing them prevents typos when invalidating from other hooks.

**Tech Stack:** TypeScript, TanStack Query, Axios, Vitest

---

### Task 1: Move DOM download side-effect out of exportPublicOrderInvoice

**Files:**
- Modify: `src/api/order.ts`
- Modify: `src/hooks/use-order.ts`

**Context — current state in src/api/order.ts (lines 252–288):**

```ts
export async function exportPublicOrderInvoice(order: string): Promise<Blob> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()
  const currentDate = new Date().toISOString()
  setFileName(`TRENDCoffee-invoice-${currentDate}.pdf`)
  setIsDownloading(true)
  try {
    const response = await http.post(`/invoice/export/public`, { order }, {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? 1),
        )
        setProgress(percentCompleted)
      },
      doNotShowLoading: true,
    } as AxiosRequestConfig)

    // ← DOM manipulation: belongs in the hook, not here
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `TRENDCoffee-invoice-${currentDate}.pdf`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    return response.data
  } finally {
    setIsDownloading(false)
    reset()
  }
}
```

- [ ] **Step 1: Slim down exportPublicOrderInvoice in api/order.ts**

Replace the function so it only fetches and returns the blob — no DOM, no download store, no filename side-effects:

```ts
export async function exportPublicOrderInvoice(order: string): Promise<Blob> {
  const response = await http.post(
    `/invoice/export/public`,
    { order },
    {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      doNotShowLoading: true,
    },
  )
  return response.data
}
```

- [ ] **Step 2: Add download side-effect to useExportPublicOrderInvoice in use-order.ts**

Find the existing `useExportPublicOrderInvoice` hook (or `useExportOrderInvoice` if that's the public variant — check the file). Replace it with a version that handles the download store and DOM trigger in `onSuccess`:

```ts
export const useExportPublicOrderInvoice = () => {
  const { setProgress, setFileName, setIsDownloading, reset } = useDownloadStore()

  return useMutation({
    mutationFn: async (order: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-invoice-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportPublicOrderInvoice(order)
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: (blob) => {
      const currentDate = new Date().toISOString()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `TRENDCoffee-invoice-${currentDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

Note: `useDownloadStore` must be imported in `use-order.ts` at the top if not already present.

- [ ] **Step 3: Check if useDownloadStore is already imported in use-order.ts**

```bash
grep -n "useDownloadStore" src/hooks/use-order.ts
```

If it is not imported, add:
```ts
import { useDownloadStore } from '@/stores'
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "order\.ts|use-order\.ts"
```

Expected: no errors.

- [ ] **Step 5: Verify no remaining `document.createElement` in api/ directory**

```bash
grep -rn "document\.createElement\|document\.body" src/api/
```

Expected: zero results.

- [ ] **Step 6: Commit**

```bash
git add src/api/order.ts src/hooks/use-order.ts
git commit -m "refactor(api): move DOM download trigger from exportPublicOrderInvoice to hook"
```

---

### Task 2: Add missing QUERYKEY entries

**Files:**
- Modify: `src/constants/query.ts`

The following raw strings are used as query keys in `use-order.ts` but have no corresponding entry in `QUERYKEY`:

| Raw string used in hook | Proposed QUERYKEY name |
|------------------------|----------------------|
| `'orders'` | `orders` |
| `'order'` | `order` |
| `'order-invoice'` | `orderInvoice` |
| `'public-order-invoice'` | `publicOrderInvoice` |
| `'orders-public'` | `ordersPublic` |
| `'orders-without-login'` | `ordersWithoutLogin` |

- [ ] **Step 1: Add entries to QUERYKEY in src/constants/query.ts**

Open the file and add the missing entries inside the `QUERYKEY` object (alphabetical order is not required — add them together for readability):

```ts
  orders: ['orders'],
  order: ['order'],
  orderInvoice: ['order-invoice'],
  publicOrderInvoice: ['public-order-invoice'],
  ordersPublic: ['orders-public'],
  ordersWithoutLogin: ['orders-without-login'],
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/constants/query.ts
git commit -m "feat(constants): add missing order-related QUERYKEY entries"
```

---

### Task 3: Replace raw string query keys in use-order.ts

**Files:**
- Modify: `src/hooks/use-order.ts`

- [ ] **Step 1: Verify QUERYKEY is already imported in use-order.ts**

```bash
grep -n "QUERYKEY" src/hooks/use-order.ts | head -5
```

Expected: at least `import { QUERYKEY } from '@/constants'` present. If missing, add the import.

- [ ] **Step 2: Replace raw strings with QUERYKEY constants**

Current (line 55):
```ts
queryKey: ['orders', q],
```
Replace with:
```ts
queryKey: [...QUERYKEY.orders, q],
```

Current (line 64):
```ts
queryKey: ['orders-public'],
```
Replace with:
```ts
queryKey: QUERYKEY.ordersPublic,
```

Current (line 75):
```ts
queryKey: ['order', slug],
```
Replace with:
```ts
queryKey: [...QUERYKEY.order, slug],
```

Current (line 140):
```ts
queryKey: ['order-invoice', params],
```
Replace with:
```ts
queryKey: [...QUERYKEY.orderInvoice, params],
```

Current (line 148):
```ts
queryKey: ['public-order-invoice', order],
```
Replace with:
```ts
queryKey: [...QUERYKEY.publicOrderInvoice, order],
```

Current (line 306):
```ts
queryKey: ['orders-without-login'],
```
Replace with:
```ts
queryKey: QUERYKEY.ordersWithoutLogin,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "use-order"
```

Expected: zero errors.

- [ ] **Step 4: Verify no raw order-related string query keys remain**

```bash
grep -n "queryKey.*\['" src/hooks/use-order.ts
```

Expected: zero results (all query keys now use QUERYKEY constants).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-order.ts
git commit -m "refactor(hooks): replace raw string query keys in use-order.ts with QUERYKEY constants"
```
