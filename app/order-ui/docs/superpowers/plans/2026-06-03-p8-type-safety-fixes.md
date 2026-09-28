# P8: Type Safety Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four categories of type bugs: wrong field types in base interfaces, `params: any` in API functions, mismatched error field names in the global error handler, and missing `select` transforms in query hooks.

**Architecture:** All changes are isolated type fixes — no runtime behavior changes. `IApiErrorResponse.timestamp` is declared `boolean` but is always a number. `IQuery.page: number | 1` is a TypeScript no-op union. The global error handler in `App.tsx` reads `data.code` for query errors but `data.statusCode` for mutation errors — one of these is wrong (the backend uses one field name). `params: any` in two remaining api functions leaks `any` into the type system. Applying `select: (data) => data.result` to all query hooks removes boilerplate unwrapping at component level.

**Tech Stack:** TypeScript, TanStack Query v5, Zod, Vitest

---

### Task 1: Fix base type bugs in base.type.ts

**Files:**
- Modify: `src/types/base.type.ts`

- [ ] **Step 1: Read the current file**

```bash
cat -n src/types/base.type.ts
```

Current content (lines 32–38):
```ts
export interface IApiErrorResponse {
  statusCode: number
  timestamp: boolean    // ← bug: should be number
  message: string
  method: string
  path: string
}
```

And lines 22–25:
```ts
export interface IQuery {
  page: number | 1    // ← no-op: number | 1 = number
  pageSize: number | 10
  order: 'ASC' | 'DESC'
}
```

- [ ] **Step 2: Fix `IApiErrorResponse.timestamp`**

Change:
```ts
  timestamp: boolean
```
To:
```ts
  timestamp: number
```

- [ ] **Step 3: Fix `IQuery` default-value comments**

`number | 1` is TypeScript for "a number OR the literal 1" — since `1` is a subtype of `number`, this simplifies to `number`. The intent was to document a default value. Replace with:
```ts
export interface IQuery {
  page: number
  pageSize: number
  order: 'ASC' | 'DESC'
}
```

- [ ] **Step 4: Verify no code depends on the removed union literals**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

---

### Task 2: Fix remaining `params: any` in API functions

**Files:**
- Modify: `src/api/point-transaction.ts`

One `params: any` remains after P6 cleanup: `exportAllSystemPointTransactions(params: any)`. (The other two in `card-order-revenue.ts` are fixed in P6-Task5.)

- [ ] **Step 1: Identify the correct type for `exportAllSystemPointTransactions`**

```bash
grep -n "exportAllSystemPointTransactions\|IPointTransactionQuery\|ISystemPointTransaction" src/hooks/use-point-transaction.ts | head -10
```

The caller passes `IPointTransactionQuery` based on the hook's param building (lines ~89–97). Verify:
```bash
grep -n "IPointTransactionQuery" src/types/point-transaction.type.ts | head -5
```

- [ ] **Step 2: Fix `exportAllSystemPointTransactions` signature in `src/api/point-transaction.ts`**

Change:
```ts
export async function exportAllSystemPointTransactions(params: any): Promise<Blob> {
```
To:
```ts
export async function exportAllSystemPointTransactions(params: IPointTransactionQuery): Promise<Blob> {
```

Add import if not already present:
```ts
import { IPointTransactionQuery } from '@/types'
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "point-transaction"
```

Expected: zero errors.

---

### Task 3: Align error field names in App.tsx global error handler

**Files:**
- Modify: `src/app/App.tsx`

The current global error handler reads `data.code` for query errors (line ~32) but `data.statusCode` for mutation errors (line ~50). Only one can be correct — the backend returns a single field name.

- [ ] **Step 1: Determine which field the backend actually uses**

Check `IApiResponse` (query errors) and `IApiErrorResponse` (mutation errors):
```bash
grep -n "code\|statusCode" src/types/base.type.ts
```

`IApiResponse` has `code: number`. `IApiErrorResponse` has `statusCode: number`. These are two different error shapes — query errors come from successful responses that still have an error code, mutation errors come from HTTP 4xx/5xx responses.

- [ ] **Step 2: Verify the App.tsx handler casts are correct**

Check the current casts:
- Query handler (line ~31): `error as AxiosError<IApiResponse<void>>` → reads `.data.code`
- Mutation handler (line ~49): `error as AxiosError<IApiErrorResponse>` → reads `.data.statusCode`

These are casting to *different* interfaces on purpose. The query handler reads `code` from `IApiResponse`, which is the business error code (e.g. `1017`). The mutation handler reads `statusCode` from `IApiErrorResponse`, which is the HTTP status code equivalent (e.g. `400`, `404`).

The actual inconsistency: `showErrorToast` is called with `code` in one branch and `statusCode` in the other. Check what `showErrorToast` expects:
```bash
grep -n "showErrorToast\|export function showErrorToast" src/utils/toast.ts | head -5
```

- [ ] **Step 3: Fix the handler to use consistent field access**

After reading `toast.ts`, determine if `showErrorToast` expects a business error code or HTTP status. Then update the mutation handler to read the same kind of code.

If `showErrorToast` maps business codes (like `1017`) to messages, the mutation handler should also try to read `data.code` (not `data.statusCode`). Update:

```ts
mutationCache: new MutationCache({
  onError: (error, _, __, mutation) => {
    try {
      if (mutation.meta && has(mutation.meta, 'ignoreGlobalError')) {
        if (mutation.meta.ignoreGlobalError) return
      }
      if (isAxiosError(error)) {
        const axiosError = error as AxiosError<IApiResponse<void>>
        if (axiosError.response?.data.code) {
          showErrorToast(axiosError.response.data.code)
        }
      }
    } catch (err) {
      console.error('Error in mutationCache onError:', err)
    }
  },
}),
```

**Note:** If after reading `toast.ts` you find both `code` and `statusCode` are needed for different error types, add a fallback:
```ts
const code = axiosError.response?.data.code ?? axiosError.response?.data.statusCode
if (code) showErrorToast(code)
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "App.tsx"
```

Expected: zero errors.

---

### Task 4: Apply `select: (data) => data.result` to all query hooks in use-order.ts

**Files:**
- Modify: `src/hooks/use-order.ts`

Currently only `useOrders` has `select: (data) => data.result`. The other query hooks (`useOrdersPublic`, `useOrderBySlug`, `useGetOrderInvoice`, `useGetPublicOrderInvoice`, `useGetAllOrderWithoutLogin`) return the full `IApiResponse<T>`, forcing every component to `.data.result` unwrap.

Applying `select` makes the hook return `T` directly, removing boilerplate at the call site. This is a **breaking change** for any component that currently accesses `.data.result` from these hooks.

- [ ] **Step 1: Find all call sites before making changes**

```bash
grep -rn "useOrdersPublic\|useOrderBySlug\|useGetOrderInvoice\|useGetPublicOrderInvoice\|useGetAllOrderWithoutLogin" src/ | grep -v "use-order.ts\|index.ts"
```

For each result, note whether the component accesses `.data` (raw hook result) or `.data.result` (unwrapped). If it accesses `.data.result`, the component must be updated to `.data` after the hook change.

- [ ] **Step 2: Update `useOrdersPublic`**

```ts
export const useOrdersPublic = () => {
  return useQuery({
    queryKey: QUERYKEY.ordersPublic,
    queryFn: () => getAllOrdersPublic(),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
  })
}
```

- [ ] **Step 3: Update `useOrderBySlug`**

```ts
export const useOrderBySlug = (slug: string | null | undefined) => {
  const isValidSlug = !!slug?.trim()
  return useQuery({
    queryKey: [...QUERYKEY.order, slug],
    queryFn: () => getOrderBySlug(slug!),
    enabled: isValidSlug,
    placeholderData: keepPreviousData,
    select: (data) => data.result,
  })
}
```

- [ ] **Step 4: Update `useGetOrderInvoice`**

```ts
export const useGetOrderInvoice = (params: IGetOrderInvoiceRequest) => {
  return useQuery({
    queryKey: [...QUERYKEY.orderInvoice, params],
    queryFn: () => getOrderInvoice(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
  })
}
```

- [ ] **Step 5: Update component call sites**

For every component found in Step 1 that does `hook().data.result`, change to `hook().data`:

Example pattern:
```ts
// Before
const { data: orderData } = useOrderBySlug(slug)
const order = orderData?.result

// After
const { data: order } = useOrderBySlug(slug)
```

Run TypeScript to find any remaining mismatches:
```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix all reported errors.

- [ ] **Step 6: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1 | wc -l
```

Expected: 0.
