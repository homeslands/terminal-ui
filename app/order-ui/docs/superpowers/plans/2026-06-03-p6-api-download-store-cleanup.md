# P6: API Download Store Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all `useDownloadStore.getState()` calls from API functions across 7 files — API functions must only fetch data and return it, never touch UI state.

**Architecture:** The established pattern (from `useExportPublicOrderInvoice` in `src/hooks/use-order.ts`) is: the API function is a pure HTTP call returning `Promise<Blob>`. The corresponding hook wraps it with download-store setup (`setFileName`, `setIsDownloading`, progress tracking) in `mutationFn`, and any file-save side-effect (DOM anchor trigger or `saveAs()`) in `onSuccess`. Each task below applies this pattern to one file pair.

**Tech Stack:** TypeScript, Axios, Zustand `useDownloadStore`, TanStack Query `useMutation`, file-saver, Vitest

---

### Reference pattern (DO NOT CHANGE — already correct)

`src/api/order.ts` — `exportPublicOrderInvoice`:
```ts
export async function exportPublicOrderInvoice(order: string): Promise<Blob> {
  const response = await http.post(
    `/invoice/export/public`,
    { order },
    { responseType: 'blob', headers: { Accept: 'application/pdf' }, doNotShowLoading: true },
  )
  return response.data
}
```

`src/hooks/use-order.ts` — `useExportPublicOrderInvoice`:
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

---

### Task 1: order.ts — exportPaymentQRCode, getOrderProvisionalBill, exportOrderInvoice

**Files:**
- Modify: `src/api/order.ts`
- Modify: `src/hooks/use-order.ts`

- [ ] **Step 1: Slim down `exportPaymentQRCode` in `src/api/order.ts`**

Replace (lines ~103–130):
```ts
export async function exportPaymentQRCode(slug: string): Promise<Blob> {
  const response = await http.post(`payment/${slug}/export`, null, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}
```

- [ ] **Step 2: Slim down `getOrderProvisionalBill` in `src/api/order.ts`**

Replace (lines ~175–203):
```ts
export async function getOrderProvisionalBill(slug: string): Promise<Blob> {
  const response = await http.post(
    `/invoice/export/temporary`,
    { order: slug },
    {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      doNotShowLoading: true,
    },
  )
  return response.data
}
```

- [ ] **Step 3: Slim down `exportOrderInvoice` in `src/api/order.ts`**

Replace (lines ~215–244):
```ts
export async function exportOrderInvoice(order: string): Promise<Blob> {
  const response = await http.post(
    `/invoice/export`,
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

- [ ] **Step 4: Remove `useDownloadStore` import from `src/api/order.ts` if no longer used**

```bash
grep -n "useDownloadStore" src/api/order.ts
```

Expected: zero results. If zero, delete the import line `import { useDownloadStore } from '@/stores'`.

- [ ] **Step 5: Update `useExportPayment` in `src/hooks/use-order.ts`**

Replace:
```ts
export const useExportPayment = () => {
  const { setProgress, setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportPaymentQRCode(slug)
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
      link.setAttribute('download', `TRENDCoffee-${currentDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

- [ ] **Step 6: Update `useGetOrderProvisionalBill` in `src/hooks/use-order.ts`**

Replace:
```ts
export const useGetOrderProvisionalBill = () => {
  const { setProgress, setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await getOrderProvisionalBill(slug)
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
      link.setAttribute('download', `TRENDCoffee-${currentDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

- [ ] **Step 7: Update `useExportOrderInvoice` in `src/hooks/use-order.ts`**

Find the existing hook (search for `useExportOrderInvoice`). Replace with:
```ts
export const useExportOrderInvoice = () => {
  const { setProgress, setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`Invoice-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportOrderInvoice(slug)
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
      link.setAttribute('download', `Invoice-${currentDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

- [ ] **Step 8: Verify no DOM/store code remains in `src/api/order.ts`**

```bash
grep -n "document\.createElement\|useDownloadStore\|setIsDownloading" src/api/order.ts
```

Expected: zero results.

- [ ] **Step 9: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "order\.ts\|use-order\.ts"
```

Expected: zero errors.

---

### Task 2: revenue.ts — exportExcelRevenue, exportPDFRevenue

**Files:**
- Modify: `src/api/revenue.ts`
- Modify: `src/hooks/use-revenue.ts`

- [ ] **Step 1: Slim down `exportExcelRevenue` in `src/api/revenue.ts`**

Replace the full function body:
```ts
export async function exportExcelRevenue(params: IRevenueQuery): Promise<Blob> {
  const response = await http.get(`/revenue/branch/export`, {
    params,
    responseType: 'blob',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    doNotShowLoading: true,
  })
  return response.data
}
```

- [ ] **Step 2: Slim down `exportPDFRevenue` in `src/api/revenue.ts`**

Replace:
```ts
export async function exportPDFRevenue(params: IRevenueQuery): Promise<Blob> {
  const response = await http.post(`/revenue/branch/export-pdf`, params, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}
```

- [ ] **Step 3: Remove `useDownloadStore` import from `src/api/revenue.ts`**

Delete the import line after confirming no remaining usages:
```bash
grep -n "useDownloadStore" src/api/revenue.ts
```

- [ ] **Step 4: Update `useExportExcelRevenue` in `src/hooks/use-revenue.ts`**

Replace:
```ts
export const useExportExcelRevenue = () => {
  const { setProgress, setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (q: IRevenueQuery) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-doanh-thu-${currentDate}.xlsx`)
      setIsDownloading(true)
      try {
        return await exportExcelRevenue(q)
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
      link.setAttribute('download', `TRENDCoffee-doanh-thu-${currentDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

Add `import { useDownloadStore } from '@/stores'` at the top of `use-revenue.ts` if not present.

- [ ] **Step 5: Update `useExportPDFRevenue` in `src/hooks/use-revenue.ts`**

Replace:
```ts
export const useExportPDFRevenue = () => {
  const { setProgress, setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (q: IRevenueQuery) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-doanh-thu-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportPDFRevenue(q)
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
      link.setAttribute('download', `TRENDCoffee-doanh-thu-${currentDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "revenue"
```

Expected: zero errors.

---

### Task 3: chef-area.ts — exportChefOrder, exportManualChefOrderTicket, exportAutoChefOrderTicket

**Files:**
- Modify: `src/api/chef-area.ts`
- Modify: `src/hooks/use-chef-area.ts`

- [ ] **Step 1: Slim down `exportChefOrder` in `src/api/chef-area.ts`**

Replace (lines ~58–82):
```ts
export async function exportChefOrder(slug: string): Promise<Blob> {
  const response = await http.get(`/chef-order/${slug}/export`, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}
```

- [ ] **Step 2: Slim down `exportManualChefOrderTicket` in `src/api/chef-area.ts`**

Replace (lines ~178–206):
```ts
export async function exportManualChefOrderTicket(slug: string): Promise<Blob> {
  const response = await http.get(
    `/chef-order/${slug}/export-manual/tickets`,
    {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      doNotShowLoading: true,
    },
  )
  return response.data
}
```

- [ ] **Step 3: Slim down `exportAutoChefOrderTicket` in `src/api/chef-area.ts`**

Replace (lines ~208–233):
```ts
export async function exportAutoChefOrderTicket(slug: string): Promise<Blob> {
  const response = await http.get(`/chef-order/${slug}/export-auto/tickets`, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}
```

- [ ] **Step 4: Remove `useDownloadStore` import from `src/api/chef-area.ts`**

```bash
grep -n "useDownloadStore" src/api/chef-area.ts
```

Expected: zero. Delete the import.

- [ ] **Step 5: Update `useExportChefOrder` in `src/hooks/use-chef-area.ts`**

Replace:
```ts
export const useExportChefOrder = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportChefOrder(slug)
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
      link.setAttribute('download', `TRENDCoffee-${currentDate}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

- [ ] **Step 6: Add `useExportManualChefOrderTicket` and `useExportAutoChefOrderTicket` to `src/hooks/use-chef-area.ts`**

Check if these hooks already exist:
```bash
grep -n "useExportManualChefOrderTicket\|useExportAutoChefOrderTicket" src/hooks/use-chef-area.ts
```

If they exist, update them. If not, add them:
```ts
export const useExportManualChefOrderTicket = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-invoice-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportManualChefOrderTicket(slug)
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

export const useExportAutoChefOrderTicket = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (slug: string) => {
      const currentDate = new Date().toISOString()
      setFileName(`TRENDCoffee-invoice-${currentDate}.pdf`)
      setIsDownloading(true)
      try {
        return await exportAutoChefOrderTicket(slug)
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

Add import of `useDownloadStore` to `use-chef-area.ts` imports if not already present.
Also add import of `exportManualChefOrderTicket`, `exportAutoChefOrderTicket` from `@/api` if not present.

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "chef-area"
```

Expected: zero errors.

---

### Task 4: card-order.ts — exportExcel

**Files:**
- Modify: `src/api/card-order.ts`
- Modify: `src/hooks/use-card-order.ts`

The `exportExcel` function in `src/api/card-order.ts` uses `params: any`. The callers pass `ICardOrderGetRequest` (imported in `use-card-order.ts`). Fix the type too.

- [ ] **Step 1: Slim down `exportExcel` in `src/api/card-order.ts` and fix the type**

Replace:
```ts
export async function exportExcel(params: ICardOrderGetRequest): Promise<Blob> {
  const response = await http.get(`/card-order/export/excel`, {
    params,
    responseType: 'blob',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    doNotShowLoading: true,
  })
  return response.data
}
```

Add `ICardOrderGetRequest` to the imports at the top of `card-order.ts`:
```ts
import { ICardOrderGetRequest, ICardOrderResponse } from '@/types'
```
(already imported — just confirm it's there).

Remove the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment and the `params: any` parameter.

- [ ] **Step 2: Remove `useDownloadStore` import from `src/api/card-order.ts`**

```bash
grep -n "useDownloadStore" src/api/card-order.ts
```

Expected: zero. Delete the import.

- [ ] **Step 3: Update `useExportExcel` in `src/hooks/use-card-order.ts`**

Replace:
```ts
export const useExportExcel = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (params: ICardOrderGetRequest) => {
      const currentDate = new Date().toISOString().split('T')[0]
      setFileName(`danh-sach-don-hang-the-qua-tang-${currentDate}.xlsx`)
      setIsDownloading(true)
      try {
        return await exportExcel(params)
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: (blob) => {
      const currentDate = new Date().toISOString().split('T')[0]
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `danh-sach-don-hang-the-qua-tang-${currentDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

Add `import { useDownloadStore } from '@/stores'` to `use-card-order.ts` if not present.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "card-order"
```

Expected: zero errors.

---

### Task 5: card-order-revenue.ts — exportAllCardOrderRevenueApi, exportPdfCardOrderRevenueApi

**Files:**
- Modify: `src/api/card-order-revenue.ts`
- Modify: `src/hooks/use-card-order-revenue.ts`

Both functions use `params: any`. The hook `useExportCardOrderRevenue` passes `ICardOrderRevenueQuery` (imported in `use-card-order-revenue.ts`). Fix both.

- [ ] **Step 1: Slim down `exportAllCardOrderRevenueApi` in `src/api/card-order-revenue.ts`**

Check what types are available:
```bash
grep -n "ICardOrderRevenueQuery\|import" src/api/card-order-revenue.ts | head -10
```

Replace with:
```ts
export async function exportAllCardOrderRevenueApi(params: ICardOrderRevenueQuery): Promise<Blob> {
  const response = await http.get(`/card-order-revenue/export/excel`, {
    params,
    responseType: 'blob',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    doNotShowLoading: true,
  })
  return response.data
}
```

Add `ICardOrderRevenueQuery` to imports at the top of `card-order-revenue.ts`:
```ts
import { ICardOrderRevenueQuery } from '@/types/card-order-revenue.type'
```

- [ ] **Step 2: Slim down `exportPdfCardOrderRevenueApi` in `src/api/card-order-revenue.ts`**

Replace (check the actual endpoint URL first with `grep -n "export-pdf\|export/pdf" src/api/card-order-revenue.ts`):
```ts
export async function exportPdfCardOrderRevenueApi(params: ICardOrderRevenueQuery): Promise<Blob> {
  const response = await http.post(`/card-order-revenue/export/pdf`, params, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}
```

Note: verify the exact endpoint by reading the current function before replacing.

- [ ] **Step 3: Remove `useDownloadStore` import from `src/api/card-order-revenue.ts`**

```bash
grep -n "useDownloadStore" src/api/card-order-revenue.ts
```

Expected: zero. Delete the import.

- [ ] **Step 4: Update `useExportCardOrderRevenue` in `src/hooks/use-card-order-revenue.ts`**

Replace:
```ts
export const useExportCardOrderRevenue = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async (params: ICardOrderRevenueQuery) => {
      const currentDate = new Date().toISOString().split('T')[0]
      setFileName(`card-order-revenue-${currentDate}.xlsx`)
      setIsDownloading(true)
      try {
        return await exportAllCardOrderRevenueApi(params)
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: (blob) => {
      const currentDate = new Date().toISOString().split('T')[0]
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `card-order-revenue-${currentDate}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    },
  })
}
```

- [ ] **Step 5: Update `useExportPdfCardOrderRevenue` similarly**

Same pattern with `exportPdfCardOrderRevenueApi`, filename `.pdf`, Accept `application/pdf`.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "card-order-revenue"
```

Expected: zero errors.

---

### Task 6: product.ts — exportAllProductsFile, getProductImportTemplate

**Files:**
- Modify: `src/api/product.ts`
- Modify: `src/hooks/use-product.ts`

These functions use `saveAs` from `file-saver` (not DOM anchor). The API functions also read `useAuthStore.getState().token` to set Authorization manually — unnecessary since the Axios interceptor already adds the header. Both issues are fixed here.

- [ ] **Step 1: Slim down `exportAllProductsFile` in `src/api/product.ts`**

Replace:
```ts
export async function exportAllProductsFile(): Promise<{ blob: Blob; fileName: string }> {
  const response = await http.get('/products/export', {
    responseType: 'blob',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    doNotShowLoading: true,
  })
  const contentDisposition = response.headers['content-disposition']
  const fileNameMatch = contentDisposition?.match(/filename="(.+)"/)
  const fileName = fileNameMatch ? fileNameMatch[1] : 'all-products.xlsx'
  return { blob: new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName }
}
```

- [ ] **Step 2: Slim down `getProductImportTemplate` in `src/api/product.ts`**

Replace:
```ts
export async function getProductImportTemplate(): Promise<{ blob: Blob; fileName: string }> {
  const response = await http.get('/products/import-template', {
    responseType: 'blob',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    doNotShowLoading: true,
  })
  const contentDisposition = response.headers['content-disposition']
  const fileNameMatch = contentDisposition?.match(/filename="(.+)"/)
  const fileName = fileNameMatch ? fileNameMatch[1] : 'product-import-template.xlsx'
  return { blob: new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName }
}
```

- [ ] **Step 3: Remove `useDownloadStore` and `useAuthStore` imports from `src/api/product.ts`**

```bash
grep -n "useDownloadStore\|useAuthStore" src/api/product.ts
```

Delete both import lines.

- [ ] **Step 4: Update `useExportAllProductsFile` in `src/hooks/use-product.ts`**

Replace:
```ts
export const useExportAllProductsFile = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async () => {
      setIsDownloading(true)
      try {
        return await exportAllProductsFile()
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: ({ blob, fileName }) => {
      setFileName(fileName)
      saveAs(blob, fileName)
    },
  })
}
```

Note: `saveAs` is from `file-saver`. Confirm it is already imported in `use-product.ts`:
```bash
grep -n "saveAs\|file-saver" src/hooks/use-product.ts
```

If missing, add: `import { saveAs } from 'file-saver'`

Add `import { useDownloadStore } from '@/stores'` to `use-product.ts` if not present.

- [ ] **Step 5: Update `useExportProductImportTemplate` in `src/hooks/use-product.ts`**

Same pattern:
```ts
export const useExportProductImportTemplate = () => {
  const { setFileName, setIsDownloading, reset } = useDownloadStore()
  return useMutation({
    mutationFn: async () => {
      setIsDownloading(true)
      try {
        return await getProductImportTemplate()
      } finally {
        setIsDownloading(false)
        reset()
      }
    },
    onSuccess: ({ blob, fileName }) => {
      setFileName(fileName)
      saveAs(blob, fileName)
    },
  })
}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "product"
```

Expected: zero errors.

---

### Task 7: point-transaction.ts — 3 export functions

**Files:**
- Modify: `src/api/point-transaction.ts`
- Modify: `src/hooks/use-point-transaction.ts`

The hook `usePointTransactions` already manages its own `isExportingAll`/`exportingTransactionSlug` loading states and uses `saveAs` directly. The API functions just need to stop touching `useDownloadStore`.

- [ ] **Step 1: Slim down `exportAllPointTransactions` in `src/api/point-transaction.ts`**

Read the current function first:
```bash
sed -n '35,75p' src/api/point-transaction.ts
```

Replace body so it only fetches:
```ts
export async function exportAllPointTransactions(
  userSlug: string,
  fromDate?: string,
  toDate?: string,
  type?: string,
): Promise<Blob> {
  const response = await http.get(`/point-transaction/export/${userSlug}`, {
    params: { fromDate, toDate, type },
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}
```

Verify the endpoint and param names match the current implementation before replacing.

- [ ] **Step 2: Slim down `exportAllSystemPointTransactions` in `src/api/point-transaction.ts` and fix `params: any`**

Check the current types used by the caller:
```bash
grep -n "exportAllSystemPointTransactions\|IPointTransactionQuery\|ISystemPointTransaction" src/hooks/use-point-transaction.ts | head -5
```

Replace with the appropriate typed params (use `IPointTransactionQuery` if that's what callers pass):
```ts
export async function exportAllSystemPointTransactions(params: IPointTransactionQuery): Promise<Blob> {
  const response = await http.get(`/point-transaction/system/export`, {
    params,
    responseType: 'blob',
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    doNotShowLoading: true,
  })
  return response.data
}
```

Verify endpoint and Accept header match the current implementation.

- [ ] **Step 3: Slim down `exportPointTransactionBySlug` in `src/api/point-transaction.ts`**

```ts
export async function exportPointTransactionBySlug(slug: string): Promise<Blob> {
  const response = await http.get(`/point-transaction/export/specific/${slug}`, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    doNotShowLoading: true,
  })
  return response.data
}
```

Verify endpoint matches current implementation.

- [ ] **Step 4: Remove `useDownloadStore` import from `src/api/point-transaction.ts`**

```bash
grep -n "useDownloadStore" src/api/point-transaction.ts
```

Expected: zero. Delete the import.

- [ ] **Step 5: Confirm `use-point-transaction.ts` hook already handles loading state**

The hook uses local `isExportingAll` and `exportingTransactionSlug` state with `setIsExportingAll` and `setExportingTransactionSlug`. These are fine — no changes needed to the hook loading state.

Confirm `saveAs` calls are still present in the hook:
```bash
grep -n "saveAs" src/hooks/use-point-transaction.ts
```

Expected: 2 results (in `exportAll` and `exportTransaction` callbacks).

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "point-transaction"
```

Expected: zero errors.

---

### Final verification

- [ ] **Confirm zero `useDownloadStore` in all api files**

```bash
grep -rn "useDownloadStore" src/api/
```

Expected: zero results.

- [ ] **Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | wc -l
```

Expected: 0.
