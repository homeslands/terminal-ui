# VAT Cashier Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai luồng "Yêu cầu xuất hoá đơn VAT" phía cashier: thêm column "VAT" với icon button trên order-management (chỉ cho đơn paid), bấm mở dialog 2 tab — "QR đưa khách" (in được, 2 layout A/C) và "Điền hộ khách" (form fill on-behalf).

**Architecture:** 3 layer theo pattern codebase: (1) API functions trong `src/api/vat.ts` wrap qua `IApiResponse<T>` envelope; (2) TanStack Query hooks trong `src/hooks/use-vat.ts` (1 mutation + 1 query + 1 mutation); (3) UI dialog `VatRequestDialog` tách thành 5 sub-components (QrThermal, QrA5, OnBehalfForm, SubmittedView, Tabs orchestrator) để mỗi file ≤ 200 dòng. State machine 3 trạng thái: `loading-link` → `available` (form/QR) → `submitted` (locked view).

**Tech Stack:** React 18 + TS strict, TanStack Query v5, react-hook-form + Zod, qrcode.react, sonner toast, i18next.

## Global Constraints

- Zero coupling với admin/accountant flow (5 endpoint khác trong doc — out of scope).
- Cashier dùng public endpoint cho status check + submit (không Bearer token), endpoint lấy link cần token.
- Tax code validation: `/^(\d{10}|\d{13})$/` (đúng 10 hoặc 13 chữ số) — match BE.
- Form fields per doc: `customerName` (required), `taxCode` (required), `address` (required), `email` (required), `companyName` (optional), `note` (optional).
- Mỗi invoice chỉ submit 1 lần — sau khi submit, dialog hiển "SubmittedView" + button đóng.
- Mọi file mới ≤ 200 dòng; component split khi cần.
- Tuân thủ patterns existing (xem "Pattern References" cuối plan).
- Working tree WIP files giữ nguyên — không động.
- I18n keys mới đặt namespace `vat.*` trong `menu.json` (form labels) và `toast.*` trong `toast.json` (success/error messages).
- BE error codes chưa biết cụ thể — fallback `data.message` cho đến khi BE confirm. Khi có code, thêm vào `errorCodes` map.
- Tests: API + hook = unit tests (renderHook + msw mock); UI sub-components = smoke tests (render + 1 interaction).

---

## File Structure

### New files

| Path | Purpose | Lines (target) | Task |
|---|---|---|---|
| `src/types/vat.type.ts` | TS types cho VAT entities + DTOs | ~40 | 1 |
| `src/schemas/vat.schema.ts` | Zod schema cho form submit + edit | ~35 | 2 |
| `src/api/vat.ts` (rewrite) | 3 API functions (link, status, submit) | ~50 | 3 |
| `src/hooks/use-vat.ts` | 3 hooks (mutation, query, mutation) | ~70 | 4 |
| `src/components/app/dialog/vat-request/vat-qr-thermal-card.tsx` | QR layout 80mm thermal (variant A) | ~80 | 5 |
| `src/components/app/dialog/vat-request/vat-qr-a5-sheet.tsx` | QR layout A5 (variant C) | ~100 | 6 |
| `src/components/app/dialog/vat-request/vat-request-on-behalf-form.tsx` | Form điền hộ (variant D) | ~180 | 7 |
| `src/components/app/dialog/vat-request/vat-request-submitted-view.tsx` | Locked view sau khi submit | ~50 | 8 |
| `src/components/app/dialog/vat-request/vat-request-qr-tabs.tsx` | Tabs để switch giữa thermal/A5 + print button | ~90 | 9 |
| `src/components/app/dialog/vat-request/vat-request-dialog.tsx` | Main dialog orchestrator | ~180 | 10 |
| `src/components/app/dialog/vat-request/index.ts` | Barrel re-export | ~5 | 10 |

### Test files

| Path | Task |
|---|---|
| `src/tests/api/vat.test.ts` | 3 |
| `src/tests/hooks/use-vat.test.tsx` | 4 |
| `src/tests/schemas/vat.schema.test.ts` | 2 |
| `src/tests/components/dialog/vat-qr-thermal-card.test.tsx` | 5 |
| `src/tests/components/dialog/vat-qr-a5-sheet.test.tsx` | 6 |
| `src/tests/components/dialog/vat-request-on-behalf-form.test.tsx` | 7 |
| `src/tests/components/dialog/vat-request-submitted-view.test.tsx` | 8 |
| `src/tests/components/dialog/vat-request-qr-tabs.test.tsx` | 9 |
| `src/tests/components/dialog/vat-request-dialog.test.tsx` | 10 |

### Modified files

| Path | What changes | Task |
|---|---|---|
| `src/constants/query.ts` | Thêm `vat: ['vat']` key | 3 |
| `src/utils/toast.tsx` | Thêm 2-3 VAT error code mapping (placeholder, refine khi có BE) | 3 |
| `src/components/app/dialog/index.tsx` | Re-export `VatRequestDialog` | 10 |
| `src/app/system/order-management/DataTable/columns/order-history-columns.tsx` | Thêm column "VAT" với icon button | 11 |
| `src/locales/vi/menu.json` | VAT form labels (~15 keys) | 12 |
| `src/locales/en/menu.json` | English mirrors | 12 |
| `src/locales/vi/toast.json` | VAT toast messages (~6 keys) | 12 |
| `src/locales/en/toast.json` | English mirrors | 12 |
| `src/router/index.tsx` | Xoá demo route `/demo/vat-qr` | 13 |
| `src/router/loadable.tsx` | Xoá `VatQrDemoPage` lazy import | 13 |
| `src/app/demo/vat-qr/page.tsx` | **DELETE** | 13 |

---

## Pattern References (đọc khi cần)

| Pattern | File:line | Note |
|---|---|---|
| API function envelope | `src/api/order.ts:28-39` | `http.get<IApiResponse<T>>` → return `response.data`; `doNotShowLoading: true` cho silent fetch |
| `IApiResponse<T>` shape | `src/types/base.type.ts:1-42` | `{statusCode, message, result: T, timestamp}` |
| Hook query | `src/hooks/use-order.ts:107-117` | useQuery + `select: (data) => data.result` |
| Hook mutation w/ onMutate | `src/hooks/use-order.ts:287-323` | Optimistic update + rollback pattern |
| QUERYKEY object | `src/constants/query.ts:1-96` | Thêm key mới trong object |
| Error codes map | `src/utils/toast.tsx:9-90` | `{BE_statusCode: 'toast.i18nKey'}` |
| Zod schema export | `src/schemas/voucher.schema.ts:1-50` | Schema + `z.infer<typeof X>` type |
| Dialog pattern | `src/components/staff/close-shift-dialog.tsx:1-60` | Parent controls `open/onOpenChange`; multi-step via local state |
| Column hook | `src/app/system/order-management/DataTable/columns/order-history-columns.tsx:32-100` | `useXColumns(): ColumnDef<T>[]` returns array |
| i18n namespace | `src/locales/vi/menu.json` | Top-level `menu.*` flat structure |

---

## PHASE 1 — Foundation (types + schema + API/constants)

### Task 1: Types

**Files:**
- Create: `src/types/vat.type.ts`

**Interfaces:**
- Consumes: none
- Produces:
  ```ts
  export interface IVatLinkResponse { url: string }
  export type VatPublicStatus = 'AVAILABLE' | 'SUBMITTED'
  export interface IVatPublicStatus {
    invoiceSlug: string
    status: VatPublicStatus
  }
  export interface IVatSubmitRequest {
    customerName: string
    taxCode: string
    address: string
    email: string
    companyName?: string
    note?: string
  }
  export interface IVatRequest {
    slug: string
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'
    customerName: string
    taxCode: string
    address: string
    email: string
    companyName?: string
    note?: string
    createdAt: string
  }
  ```

- [ ] **Step 1: Create the file**

```ts
// src/types/vat.type.ts

export interface IVatLinkResponse {
  url: string
}

export type VatPublicStatus = 'AVAILABLE' | 'SUBMITTED'

export interface IVatPublicStatus {
  invoiceSlug: string
  status: VatPublicStatus
}

export interface IVatSubmitRequest {
  customerName: string
  taxCode: string
  address: string
  email: string
  companyName?: string
  note?: string
}

export type VatRequestStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'

export interface IVatRequest {
  slug: string
  status: VatRequestStatus
  customerName: string
  taxCode: string
  address: string
  email: string
  companyName?: string
  note?: string
  createdAt: string
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit 2>&1 | grep vat.type
```
Expected: empty (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/types/vat.type.ts
git commit -m "feat(vat): add VAT entity + DTO types"
```

---

### Task 2: Zod Schema

**Files:**
- Create: `src/schemas/vat.schema.ts`
- Create: `src/tests/schemas/vat.schema.test.ts`

**Interfaces:**
- Consumes: `IVatSubmitRequest` from Task 1 (shape compatibility check)
- Produces:
  ```ts
  export const vatSubmitSchema: ZodObject<...>
  export type VatSubmitFormValues = z.infer<typeof vatSubmitSchema>
  ```

- [ ] **Step 1: Write failing tests**

Create `src/tests/schemas/vat.schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { vatSubmitSchema } from '@/schemas/vat.schema'

describe('vatSubmitSchema', () => {
  const valid = {
    customerName: 'Công ty ABC',
    taxCode: '0123456789',
    address: '123 Nguyễn Huệ',
    email: 'abc@xyz.com',
  }

  it('accepts valid minimal payload (no companyName/note)', () => {
    expect(vatSubmitSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts with optional fields', () => {
    expect(
      vatSubmitSchema.safeParse({
        ...valid,
        companyName: 'TNHH ABC',
        note: 'gấp',
      }).success,
    ).toBe(true)
  })

  it('rejects 9-digit taxCode', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '012345678' }).success,
    ).toBe(false)
  })

  it('accepts 10-digit taxCode', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '0123456789' }).success,
    ).toBe(true)
  })

  it('rejects 11-digit taxCode', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '01234567890' }).success,
    ).toBe(false)
  })

  it('accepts 13-digit taxCode', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '0123456789012' })
        .success,
    ).toBe(true)
  })

  it('rejects taxCode with non-digits', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, taxCode: '012345678a' }).success,
    ).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, email: 'not-email' }).success,
    ).toBe(false)
  })

  it('rejects empty customerName', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, customerName: '' }).success,
    ).toBe(false)
  })

  it('rejects empty address', () => {
    expect(
      vatSubmitSchema.safeParse({ ...valid, address: '' }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
npx vitest run src/tests/schemas/vat.schema.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema**

Create `src/schemas/vat.schema.ts`:

```ts
import { z } from 'zod'

/**
 * VAT-side rule: tax code phải đúng 10 hoặc 13 chữ số (chính sách thuế VN).
 * 10 = cá nhân/hộ kinh doanh, 13 = chi nhánh.
 */
export const vatSubmitSchema = z.object({
  customerName: z.string().min(1, 'customerName.required'),
  taxCode: z
    .string()
    .min(1, 'taxCode.required')
    .regex(/^(\d{10}|\d{13})$/, 'taxCode.invalidFormat'),
  address: z.string().min(1, 'address.required'),
  email: z.string().email('email.invalid'),
  companyName: z.string().optional(),
  note: z.string().optional(),
})

export type VatSubmitFormValues = z.infer<typeof vatSubmitSchema>
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npx vitest run src/tests/schemas/vat.schema.test.ts
```
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/vat.schema.ts src/tests/schemas/vat.schema.test.ts
git commit -m "feat(vat): add Zod schema for submit form"
```

---

### Task 3: API functions + QUERYKEY + error codes

**Files:**
- Modify: `src/api/vat.ts` (rewrite — file đang có skeleton broken)
- Create: `src/tests/api/vat.test.ts`
- Modify: `src/constants/query.ts` (add `vat` key)
- Modify: `src/utils/toast.tsx` (add 2 placeholder VAT error codes)

**Interfaces:**
- Consumes: `IVatLinkResponse`, `IVatPublicStatus`, `IVatSubmitRequest`, `IVatRequest` (Task 1)
- Produces:
  ```ts
  // src/api/vat.ts
  export async function getVatLink(orderSlug: string): Promise<IApiResponse<IVatLinkResponse>>
  export async function getVatRequestPublic(invoiceSlug: string): Promise<IApiResponse<IVatPublicStatus>>
  export async function submitVatRequestPublic(invoiceSlug: string, body: IVatSubmitRequest): Promise<IApiResponse<IVatRequest>>

  // src/constants/query.ts (extended)
  vat: ['vat']
  vatRequestPublic: ['vat-request-public']
  ```

- [ ] **Step 1: Write failing tests**

Create `src/tests/api/vat.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock http BEFORE importing the module under test (vi.mock is hoisted)
vi.mock('@/utils/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { http } from '@/utils/http'
import {
  getVatLink,
  getVatRequestPublic,
  submitVatRequestPublic,
} from '@/api/vat'

describe('vat API', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
    vi.mocked(http.post).mockReset()
  })

  it('getVatLink calls POST /orders/:slug/vat-link', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: { statusCode: 200, result: { url: '/vat-request/INV-1' } },
    } as never)
    const res = await getVatLink('order-1')
    expect(http.post).toHaveBeenCalledWith('/orders/order-1/vat-link')
    expect(res.result.url).toBe('/vat-request/INV-1')
  })

  it('getVatRequestPublic calls GET /vat-request/public/:slug with doNotShowLoading', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: {
        statusCode: 200,
        result: { invoiceSlug: 'INV-1', status: 'AVAILABLE' },
      },
    } as never)
    const res = await getVatRequestPublic('INV-1')
    expect(http.get).toHaveBeenCalledWith('/vat-request/public/INV-1', {
      doNotShowLoading: true,
    })
    expect(res.result.status).toBe('AVAILABLE')
  })

  it('submitVatRequestPublic POSTs body to /vat-request/public/:slug', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: {
        statusCode: 201,
        result: {
          slug: 'VAT-1',
          status: 'PENDING',
          customerName: 'ABC',
          taxCode: '0123456789',
          address: 'addr',
          email: 'a@b.com',
          createdAt: '2026-06-26T00:00:00.000Z',
        },
      },
    } as never)
    const body = {
      customerName: 'ABC',
      taxCode: '0123456789',
      address: 'addr',
      email: 'a@b.com',
    }
    const res = await submitVatRequestPublic('INV-1', body)
    expect(http.post).toHaveBeenCalledWith('/vat-request/public/INV-1', body)
    expect(res.result.slug).toBe('VAT-1')
  })
})
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
npx vitest run src/tests/api/vat.test.ts
```
Expected: FAIL — `getVatLink is not exported from '@/api/vat'`.

- [ ] **Step 3: Implement API**

Replace contents of `src/api/vat.ts`:

```ts
import { http } from '@/utils/http'
import type { IApiResponse } from '@/types'
import type {
  IVatLinkResponse,
  IVatPublicStatus,
  IVatRequest,
  IVatSubmitRequest,
} from '@/types/vat.type'

/**
 * Đổi `order.slug` → URL public `/vat-request/{invoiceSlug}` để cashier
 * render QR hoặc dùng `invoiceSlug` cho form điền hộ.
 * Yêu cầu: order ở status paid/completed/shipping. BE từ chối nếu sai.
 */
export async function getVatLink(
  orderSlug: string,
): Promise<IApiResponse<IVatLinkResponse>> {
  const response = await http.post<IApiResponse<IVatLinkResponse>>(
    `/orders/${orderSlug}/vat-link`,
  )
  return response.data
}

/**
 * Check trạng thái invoice — đã có VAT request submit chưa.
 * Public (không Bearer token). Dùng doNotShowLoading vì gọi mỗi lần mở
 * dialog, không muốn NProgress chớp lên.
 */
export async function getVatRequestPublic(
  invoiceSlug: string,
): Promise<IApiResponse<IVatPublicStatus>> {
  const response = await http.get<IApiResponse<IVatPublicStatus>>(
    `/vat-request/public/${invoiceSlug}`,
    { doNotShowLoading: true },
  )
  return response.data
}

/**
 * Submit form VAT (1 lần duy nhất). Khách hoặc cashier điền hộ đều dùng
 * endpoint này. BE gửi email confirm sau khi thành công.
 */
export async function submitVatRequestPublic(
  invoiceSlug: string,
  body: IVatSubmitRequest,
): Promise<IApiResponse<IVatRequest>> {
  const response = await http.post<IApiResponse<IVatRequest>>(
    `/vat-request/public/${invoiceSlug}`,
    body,
  )
  return response.data
}
```

- [ ] **Step 4: Add QUERYKEY entries**

Open `src/constants/query.ts`, find the QUERYKEY object (around line 1-96), add inside the object:

```ts
  vat: ['vat'],
  vatRequestPublic: ['vat-request-public'],
```

(Insert anywhere alphabetically appropriate. Don't reorder existing keys.)

- [ ] **Step 5: Add VAT error code placeholders**

Open `src/utils/toast.tsx`, find the `errorCodes` map (around line 9). Add inside the object (BE chưa confirm code cụ thể, dùng placeholder; sẽ refine khi tích hợp BE thực tế):

```ts
  // VAT — placeholder codes, refine when BE confirms exact statusCodes
  102000: 'toast.vatRequestNotFound',
  102001: 'toast.vatRequestAlreadyExists',
```

- [ ] **Step 6: Run tests — verify PASS**

```bash
npx vitest run src/tests/api/vat.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 7: Verify TS + lint**

```bash
npx tsc --noEmit 2>&1 | grep -E "vat|query.ts|toast" | head
npm run lint 2>&1 | grep -E "api/vat|query.ts|utils/toast" | head
```
Expected: empty.

- [ ] **Step 8: Commit**

```bash
git add src/api/vat.ts src/tests/api/vat.test.ts src/constants/query.ts src/utils/toast.tsx
git commit -m "feat(vat): add API functions + QUERYKEY + error code placeholders"
```

---

## PHASE 2 — Hooks

### Task 4: TanStack Query hooks

**Files:**
- Create: `src/hooks/use-vat.ts`
- Create: `src/tests/hooks/use-vat.test.tsx`

**Interfaces:**
- Consumes: API functions from Task 3, `QUERYKEY.vatRequestPublic` from Task 3
- Produces:
  ```ts
  export function useGetVatLink(): UseMutationResult<IApiResponse<IVatLinkResponse>, Error, string>
  export function useVatRequestStatus(invoiceSlug: string | null | undefined): UseQueryResult<IVatPublicStatus, Error>
  export function useSubmitVatRequest(): UseMutationResult<IApiResponse<IVatRequest>, Error, { invoiceSlug: string; body: IVatSubmitRequest }>
  ```

- [ ] **Step 1: Write failing tests**

Create `src/tests/hooks/use-vat.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/api/vat', () => ({
  getVatLink: vi.fn(),
  getVatRequestPublic: vi.fn(),
  submitVatRequestPublic: vi.fn(),
}))

import * as api from '@/api/vat'
import {
  useGetVatLink,
  useSubmitVatRequest,
  useVatRequestStatus,
} from '@/hooks/use-vat'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useGetVatLink', () => {
  beforeEach(() => vi.mocked(api.getVatLink).mockReset())
  it('triggers getVatLink with order slug on mutate', async () => {
    vi.mocked(api.getVatLink).mockResolvedValue({
      result: { url: '/vat-request/INV-1' },
    } as never)
    const { result } = renderHook(() => useGetVatLink(), { wrapper })
    result.current.mutate('order-1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.getVatLink).toHaveBeenCalledWith('order-1')
  })
})

describe('useVatRequestStatus', () => {
  beforeEach(() => vi.mocked(api.getVatRequestPublic).mockReset())
  it('does not fetch when invoiceSlug is null', () => {
    renderHook(() => useVatRequestStatus(null), { wrapper })
    expect(api.getVatRequestPublic).not.toHaveBeenCalled()
  })

  it('fetches and unwraps result when invoiceSlug provided', async () => {
    vi.mocked(api.getVatRequestPublic).mockResolvedValue({
      result: { invoiceSlug: 'INV-1', status: 'AVAILABLE' },
    } as never)
    const { result } = renderHook(() => useVatRequestStatus('INV-1'), {
      wrapper,
    })
    await waitFor(() => expect(result.current.data?.status).toBe('AVAILABLE'))
  })
})

describe('useSubmitVatRequest', () => {
  beforeEach(() => vi.mocked(api.submitVatRequestPublic).mockReset())
  it('passes invoiceSlug + body to API on mutate', async () => {
    vi.mocked(api.submitVatRequestPublic).mockResolvedValue({
      result: { slug: 'VAT-1', status: 'PENDING' },
    } as never)
    const { result } = renderHook(() => useSubmitVatRequest(), { wrapper })
    const body = {
      customerName: 'ABC',
      taxCode: '0123456789',
      address: 'x',
      email: 'a@b.com',
    }
    result.current.mutate({ invoiceSlug: 'INV-1', body })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.submitVatRequestPublic).toHaveBeenCalledWith('INV-1', body)
  })
})
```

- [ ] **Step 2: Run tests — verify FAIL**

```bash
npx vitest run src/tests/hooks/use-vat.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement hooks**

Create `src/hooks/use-vat.ts`:

```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  getVatLink,
  getVatRequestPublic,
  submitVatRequestPublic,
} from '@/api/vat'
import { QUERYKEY } from '@/constants'
import type { IVatSubmitRequest } from '@/types/vat.type'

/**
 * Mutation: đổi order.slug → VAT public URL (chứa invoiceSlug). Cashier
 * gọi mỗi khi mở dialog VAT cho 1 đơn cụ thể.
 */
export const useGetVatLink = () => {
  return useMutation({
    mutationFn: (orderSlug: string) => getVatLink(orderSlug),
  })
}

/**
 * Query: status public của invoice — AVAILABLE (chưa có VAT request) hoặc
 * SUBMITTED (đã có). Dialog dùng để gate UI: render form hay locked view.
 *
 * Enabled = !!invoiceSlug để không fetch sớm khi chưa có link.
 * staleTime: 0 + refetchOnMount: 'always' — luôn lấy fresh status khi mở
 * lại dialog (tránh race nếu cashier mở dialog trước, khách submit qua QR).
 */
export const useVatRequestStatus = (invoiceSlug: string | null | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.vatRequestPublic, invoiceSlug],
    queryFn: () => getVatRequestPublic(invoiceSlug!),
    enabled: !!invoiceSlug,
    staleTime: 0,
    refetchOnMount: 'always',
    select: (data) => data.result,
  })
}

/**
 * Mutation: cashier (hoặc khách qua public form) submit VAT request.
 * onSuccess invalidate status query → dialog refresh sang SubmittedView.
 */
export const useSubmitVatRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      invoiceSlug,
      body,
    }: {
      invoiceSlug: string
      body: IVatSubmitRequest
    }) => submitVatRequestPublic(invoiceSlug, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: [...QUERYKEY.vatRequestPublic, vars.invoiceSlug],
      })
    },
  })
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npx vitest run src/tests/hooks/use-vat.test.tsx
```
Expected: 4 tests pass.

- [ ] **Step 5: Verify TS + lint**

```bash
npx tsc --noEmit 2>&1 | grep use-vat | head
npm run lint 2>&1 | grep use-vat | head
```
Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-vat.ts src/tests/hooks/use-vat.test.tsx
git commit -m "feat(vat): add TanStack Query hooks (link/status/submit)"
```

---

## PHASE 3 — UI Sub-components

### Task 5: VatQrThermalCard (variant A)

**Files:**
- Create: `src/components/app/dialog/vat-request/vat-qr-thermal-card.tsx`
- Create: `src/tests/components/dialog/vat-qr-thermal-card.test.tsx`

**Interfaces:**
- Consumes: `qrcode.react` (existing dep)
- Produces:
  ```tsx
  interface VatQrThermalCardProps {
    url: string
    invoiceRef?: string
    dateTime?: string
  }
  export function VatQrThermalCard(props: VatQrThermalCardProps): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/dialog/vat-qr-thermal-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VatQrThermalCard } from '@/components/app/dialog/vat-request/vat-qr-thermal-card'

describe('VatQrThermalCard', () => {
  it('renders the QR + heading + invoice ref', () => {
    render(
      <VatQrThermalCard
        url="https://x.com/vat-request/INV-1"
        invoiceRef="HD-001"
        dateTime="26/06/2026 14:30"
      />,
    )
    expect(screen.getByText(/yêu cầu hoá đơn vat/i)).toBeTruthy()
    expect(screen.getByText(/HD-001/)).toBeTruthy()
    expect(screen.getByText(/26\/06\/2026/)).toBeTruthy()
  })

  it('renders without invoiceRef gracefully', () => {
    render(<VatQrThermalCard url="https://x.com/vat-request/INV-1" />)
    expect(screen.getByText(/yêu cầu hoá đơn vat/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx vitest run src/tests/components/dialog/vat-qr-thermal-card.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/app/dialog/vat-request/vat-qr-thermal-card.tsx`:

```tsx
import { QRCodeSVG } from 'qrcode.react'

interface VatQrThermalCardProps {
  url: string
  invoiceRef?: string
  dateTime?: string
}

/**
 * Layout 80mm × 80mm cho POS thermal printer. Đen trắng, font monospace,
 * QR 140px. Đủ để khách scan từ điện thoại ở khoảng cách 15-20cm.
 *
 * Dùng inline style cho width/font (Tailwind không có unit mm) để layout
 * cố định đúng kích thước in.
 */
export function VatQrThermalCard({
  url,
  invoiceRef,
  dateTime,
}: VatQrThermalCardProps) {
  return (
    <div
      className="vat-printable bg-white p-4 font-mono text-black"
      style={{
        width: '80mm',
        minHeight: '80mm',
        fontSize: '11px',
        lineHeight: 1.3,
      }}
    >
      <div className="text-center">
        <div className="text-sm font-bold">THE TERMINAL</div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-xs font-semibold">YÊU CẦU HOÁ ĐƠN VAT</div>
        <div className="mt-1 text-[10px]">
          Quét QR để điền thông tin xuất HĐ
        </div>
      </div>

      <div className="my-3 flex justify-center">
        <div className="border border-black p-1">
          <QRCodeSVG value={url} size={140} level="M" />
        </div>
      </div>

      <div className="text-center text-[10px]">
        {invoiceRef && <div>HĐ #{invoiceRef}</div>}
        {dateTime && <div>{dateTime}</div>}
        <div className="mt-2 border-t border-dashed border-black pt-2">
          Yêu cầu trong vòng 24h sau thanh toán.
          <br />
          Nếu lỗi, gọi: 0886 128 008
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx vitest run src/tests/components/dialog/vat-qr-thermal-card.test.tsx
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/dialog/vat-request/vat-qr-thermal-card.tsx src/tests/components/dialog/vat-qr-thermal-card.test.tsx
git commit -m "feat(vat): add VatQrThermalCard component (variant A)"
```

---

### Task 6: VatQrA5Sheet (variant C)

**Files:**
- Create: `src/components/app/dialog/vat-request/vat-qr-a5-sheet.tsx`
- Create: `src/tests/components/dialog/vat-qr-a5-sheet.test.tsx`

**Interfaces:**
- Consumes: `qrcode.react`
- Produces:
  ```tsx
  interface VatQrA5SheetProps {
    url: string
    invoiceRef?: string
    tableLabel?: string
    amountLabel?: string
    dateTime?: string
  }
  export function VatQrA5Sheet(props: VatQrA5SheetProps): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/dialog/vat-qr-a5-sheet.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VatQrA5Sheet } from '@/components/app/dialog/vat-request/vat-qr-a5-sheet'

describe('VatQrA5Sheet', () => {
  it('renders heading, QR area, and order info rows', () => {
    render(
      <VatQrA5Sheet
        url="https://x.com/vat-request/INV-1"
        invoiceRef="HD-001"
        tableLabel="Bàn 13"
        amountLabel="125.000đ"
        dateTime="26/06/2026 14:30"
      />,
    )
    expect(screen.getByText(/yêu cầu xuất hoá đơn vat/i)).toBeTruthy()
    expect(screen.getByText(/Bàn 13/)).toBeTruthy()
    expect(screen.getByText(/125\.000đ/)).toBeTruthy()
  })

  it('renders 4 numbered steps', () => {
    render(<VatQrA5Sheet url="https://x.com/vat-request/INV-1" />)
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx vitest run src/tests/components/dialog/vat-qr-a5-sheet.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/app/dialog/vat-request/vat-qr-a5-sheet.tsx`:

```tsx
import { QRCodeSVG } from 'qrcode.react'

interface VatQrA5SheetProps {
  url: string
  invoiceRef?: string
  tableLabel?: string
  amountLabel?: string
  dateTime?: string
}

/**
 * Layout A5 (148×210mm) — full color, hướng dẫn 4 bước cho khách lớn tuổi.
 * Có thể in laser/inkjet, đặt sẵn trên bàn hoặc đưa khách 1:1.
 */
export function VatQrA5Sheet({
  url,
  invoiceRef,
  tableLabel,
  amountLabel,
  dateTime,
}: VatQrA5SheetProps) {
  return (
    <div
      className="vat-printable bg-white p-8 text-black"
      style={{
        width: '148mm',
        minHeight: '210mm',
        fontFamily: 'sans-serif',
      }}
    >
      <div className="border-b-2 pb-4" style={{ borderColor: '#C9A84C' }}>
        <div
          className="text-xs uppercase tracking-widest"
          style={{ color: '#C9A84C' }}
        >
          The Terminal
        </div>
        <h2 className="mt-1 text-xl font-bold">Yêu cầu xuất hoá đơn VAT</h2>
        <p className="mt-1 text-sm text-gray-600">
          Quý khách vui lòng quét mã QR và điền thông tin để chúng tôi xuất
          hoá đơn VAT theo yêu cầu.
        </p>
      </div>

      <div className="my-6 flex items-center gap-6">
        <div
          className="rounded-lg p-3"
          style={{ background: '#fefaf0', border: '2px solid #C9A84C' }}
        >
          <QRCodeSVG value={url} size={180} level="Q" fgColor="#1a1a1a" />
        </div>
        <div className="flex-1 text-sm">
          <div className="space-y-1.5">
            {invoiceRef && <Row label="Số hoá đơn" value={`#${invoiceRef}`} />}
            {tableLabel && <Row label="Bàn" value={tableLabel} />}
            {amountLabel && <Row label="Tổng tiền" value={amountLabel} bold />}
            {dateTime && <Row label="Thời gian" value={dateTime} />}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Step n={1} t="Mở camera điện thoại" d="Hướng camera vào mã QR phía trên, chờ nhận diện." />
        <Step n={2} t="Bấm vào link hiện ra" d="Mở trình duyệt và tải trang điền thông tin." />
        <Step n={3} t="Điền đầy đủ thông tin" d="Tên công ty, mã số thuế (10 hoặc 13 chữ số), địa chỉ, email nhận hoá đơn." />
        <Step n={4} t="Nhấn gửi yêu cầu" d="Hệ thống sẽ gửi email xác nhận và xử lý hoá đơn VAT trong vòng 24h." />
      </div>

      <div className="mt-8 border-t pt-3 text-center text-xs text-gray-500">
        Hỗ trợ: 0886 128 008 — trend.coffee.tea@gmail.com
        <br />
        Số 3, Nguyễn Công Trứ, Bình Thọ, Thủ Đức
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-600">{label}</span>
      <span className={bold ? 'font-bold' : 'font-medium'}>{value}</span>
    </div>
  )
}

function Step({ n, t, d }: { n: number; t: string; d: string }) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: '#C9A84C' }}
      >
        {n}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{t}</div>
        <div className="text-xs text-gray-600">{d}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx vitest run src/tests/components/dialog/vat-qr-a5-sheet.test.tsx
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/dialog/vat-request/vat-qr-a5-sheet.tsx src/tests/components/dialog/vat-qr-a5-sheet.test.tsx
git commit -m "feat(vat): add VatQrA5Sheet component (variant C)"
```

---

### Task 7: VatRequestOnBehalfForm

**Files:**
- Create: `src/components/app/dialog/vat-request/vat-request-on-behalf-form.tsx`
- Create: `src/tests/components/dialog/vat-request-on-behalf-form.test.tsx`

**Interfaces:**
- Consumes: `vatSubmitSchema`, `VatSubmitFormValues` (Task 2)
- Produces:
  ```tsx
  interface VatRequestOnBehalfFormProps {
    isSubmitting: boolean
    submitError?: string
    onSubmit: (values: VatSubmitFormValues) => void
    onCancel: () => void
  }
  export function VatRequestOnBehalfForm(props: VatRequestOnBehalfFormProps): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/dialog/vat-request-on-behalf-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VatRequestOnBehalfForm } from '@/components/app/dialog/vat-request/vat-request-on-behalf-form'

describe('VatRequestOnBehalfForm', () => {
  it('renders 4 required fields + 2 optional', () => {
    render(
      <VatRequestOnBehalfForm
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/customername/i)).toBeTruthy()
    expect(screen.getByLabelText(/taxcode/i)).toBeTruthy()
    expect(screen.getByLabelText(/address/i)).toBeTruthy()
    expect(screen.getByLabelText(/^email/i)).toBeTruthy()
  })

  it('calls onSubmit with valid payload', async () => {
    const onSubmit = vi.fn()
    render(
      <VatRequestOnBehalfForm
        isSubmitting={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/customername/i), 'Công ty ABC')
    await user.type(screen.getByLabelText(/taxcode/i), '0123456789')
    await user.type(screen.getByLabelText(/address/i), '123 NH')
    await user.type(screen.getByLabelText(/^email/i), 'a@b.com')
    await user.click(screen.getByRole('button', { name: /gửi yêu cầu|submit/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      customerName: 'Công ty ABC',
      taxCode: '0123456789',
      address: '123 NH',
      email: 'a@b.com',
    })
  })

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = vi.fn()
    render(
      <VatRequestOnBehalfForm
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /đóng|cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx vitest run src/tests/components/dialog/vat-request-on-behalf-form.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/app/dialog/vat-request/vat-request-on-behalf-form.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { vatSubmitSchema, type VatSubmitFormValues } from '@/schemas/vat.schema'

interface VatRequestOnBehalfFormProps {
  isSubmitting: boolean
  submitError?: string
  onSubmit: (values: VatSubmitFormValues) => void
  onCancel: () => void
}

/**
 * Form cashier điền hộ khách tại quầy. Validation realtime qua Zod
 * (mã số thuế 10/13 chữ số, email format). Strip non-digit khỏi taxCode
 * input để giảm typo.
 */
export function VatRequestOnBehalfForm({
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
}: VatRequestOnBehalfFormProps) {
  const { t } = useTranslation('menu')
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<VatSubmitFormValues>({
    resolver: zodResolver(vatSubmitSchema),
    mode: 'onBlur',
  })

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      aria-label="vat-on-behalf-form"
    >
      <Field label="customerName" required error={errors.customerName?.message}>
        <input
          {...register('customerName')}
          id="customerName"
          placeholder={t('vat.customerNamePlaceholder')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </Field>

      <Field
        label="taxCode"
        required
        hint={t('vat.taxCodeHint')}
        error={errors.taxCode?.message}
      >
        <input
          {...register('taxCode')}
          id="taxCode"
          inputMode="numeric"
          maxLength={13}
          onChange={(e) =>
            setValue('taxCode', e.target.value.replace(/\D/g, ''), {
              shouldValidate: true,
            })
          }
          placeholder="0123456789"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="companyName" hint={t('vat.optional')}>
          <input
            {...register('companyName')}
            id="companyName"
            placeholder={t('vat.companyNamePlaceholder')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
          />
        </Field>
        <Field label="email" required error={errors.email?.message}>
          <input
            {...register('email')}
            id="email"
            type="email"
            placeholder="ketoan@abc.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
          />
        </Field>
      </div>

      <Field label="address" required error={errors.address?.message}>
        <input
          {...register('address')}
          id="address"
          placeholder={t('vat.addressPlaceholder')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </Field>

      <Field label="note" hint={t('vat.optional')}>
        <textarea
          {...register('note')}
          id="note"
          rows={2}
          placeholder={t('vat.notePlaceholder')}
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-pos-gold focus:outline-none focus:ring-1 focus:ring-pos-gold"
        />
      </Field>

      <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        <span className="text-base">⚠</span>
        <span>{t('vat.submitOnceWarning')}</span>
      </div>

      {submitError && (
        <div className="rounded-md border-l-4 border-destructive bg-destructive/10 p-3 text-xs text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="outline" type="button" onClick={onCancel}>
          {t('vat.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('vat.submitting') : t('vat.submit')}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  const { t } = useTranslation('menu')
  return (
    <div>
      <label
        htmlFor={label}
        className="mb-1 flex items-center gap-1 text-sm font-medium"
      >
        {t(`vat.${label}`)}
        {required && <span className="text-red-500">*</span>}
        {hint && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({hint})
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-500">{t(`vat.error.${error}`)}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx vitest run src/tests/components/dialog/vat-request-on-behalf-form.test.tsx
```
Expected: 3 tests pass. (Test có thể fail nếu thiếu i18n keys — keys sẽ thêm Task 12. Nếu test fail vì missing keys, dùng default text trong test fallback — review trong Task 12.)

- [ ] **Step 5: Commit**

```bash
git add src/components/app/dialog/vat-request/vat-request-on-behalf-form.tsx src/tests/components/dialog/vat-request-on-behalf-form.test.tsx
git commit -m "feat(vat): add VatRequestOnBehalfForm (variant D)"
```

---

### Task 8: VatRequestSubmittedView

**Files:**
- Create: `src/components/app/dialog/vat-request/vat-request-submitted-view.tsx`
- Create: `src/tests/components/dialog/vat-request-submitted-view.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  interface VatRequestSubmittedViewProps {
    invoiceSlug: string
    onClose: () => void
  }
  export function VatRequestSubmittedView(props: VatRequestSubmittedViewProps): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/dialog/vat-request-submitted-view.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VatRequestSubmittedView } from '@/components/app/dialog/vat-request/vat-request-submitted-view'

describe('VatRequestSubmittedView', () => {
  it('renders the already-submitted message and invoiceSlug', () => {
    render(<VatRequestSubmittedView invoiceSlug="INV-1" onClose={vi.fn()} />)
    expect(screen.getByText(/đã được ghi nhận|already/i)).toBeTruthy()
    expect(screen.getByText(/INV-1/)).toBeTruthy()
  })

  it('triggers onClose when button clicked', () => {
    const onClose = vi.fn()
    render(<VatRequestSubmittedView invoiceSlug="INV-1" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /đóng|close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx vitest run src/tests/components/dialog/vat-request-submitted-view.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/app/dialog/vat-request/vat-request-submitted-view.tsx`:

```tsx
import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'

interface VatRequestSubmittedViewProps {
  invoiceSlug: string
  onClose: () => void
}

/**
 * Locked view khi `status === SUBMITTED`. Cashier không submit lại được
 * (BE từ chối 409). Dialog hiển message confirm + nút đóng.
 */
export function VatRequestSubmittedView({
  invoiceSlug,
  onClose,
}: VatRequestSubmittedViewProps) {
  const { t } = useTranslation('menu')
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="rounded-full bg-emerald-100 p-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      </div>
      <div>
        <h3 className="text-base font-semibold">
          {t('vat.alreadySubmittedTitle')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('vat.alreadySubmittedBody')}
        </p>
      </div>
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <span className="font-mono">{invoiceSlug}</span>
      </div>
      <Button onClick={onClose}>{t('vat.close')}</Button>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx vitest run src/tests/components/dialog/vat-request-submitted-view.test.tsx
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/dialog/vat-request/vat-request-submitted-view.tsx src/tests/components/dialog/vat-request-submitted-view.test.tsx
git commit -m "feat(vat): add VatRequestSubmittedView (locked state)"
```

---

### Task 9: VatRequestQrTabs (switch A/C + print)

**Files:**
- Create: `src/components/app/dialog/vat-request/vat-request-qr-tabs.tsx`
- Create: `src/tests/components/dialog/vat-request-qr-tabs.test.tsx`

**Interfaces:**
- Consumes: `VatQrThermalCard` (Task 5), `VatQrA5Sheet` (Task 6)
- Produces:
  ```tsx
  interface VatRequestQrTabsProps {
    url: string
    invoiceRef?: string
    tableLabel?: string
    amountLabel?: string
    dateTime?: string
  }
  export function VatRequestQrTabs(props: VatRequestQrTabsProps): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/dialog/vat-request-qr-tabs.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VatRequestQrTabs } from '@/components/app/dialog/vat-request/vat-request-qr-tabs'

describe('VatRequestQrTabs', () => {
  it('renders thermal variant by default', () => {
    render(<VatRequestQrTabs url="https://x.com/v/INV-1" />)
    expect(screen.getByText(/yêu cầu hoá đơn vat/i)).toBeTruthy()
  })

  it('switches to A5 variant when tab clicked', () => {
    render(<VatRequestQrTabs url="https://x.com/v/INV-1" />)
    fireEvent.click(screen.getByRole('button', { name: /a5/i }))
    expect(screen.getByText(/yêu cầu xuất hoá đơn vat/i)).toBeTruthy()
  })

  it('renders a print button', () => {
    render(<VatRequestQrTabs url="https://x.com/v/INV-1" />)
    expect(screen.getByRole('button', { name: /in|print/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx vitest run src/tests/components/dialog/vat-request-qr-tabs.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/app/dialog/vat-request/vat-request-qr-tabs.tsx`:

```tsx
import { useState } from 'react'
import { Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui'
import { VatQrThermalCard } from './vat-qr-thermal-card'
import { VatQrA5Sheet } from './vat-qr-a5-sheet'

type QrVariant = 'thermal' | 'a5'

interface VatRequestQrTabsProps {
  url: string
  invoiceRef?: string
  tableLabel?: string
  amountLabel?: string
  dateTime?: string
}

/**
 * Tab UI để cashier preview/switch giữa 2 layout in (A = thermal 80mm,
 * C = A5). Click "In" mở print dialog của browser — Print CSS chỉ in
 * vùng `.vat-printable`, các nút/header ẩn.
 */
export function VatRequestQrTabs({
  url,
  invoiceRef,
  tableLabel,
  amountLabel,
  dateTime,
}: VatRequestQrTabsProps) {
  const { t } = useTranslation('menu')
  const [variant, setVariant] = useState<QrVariant>('thermal')

  const handlePrint = () => window.print()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex gap-2">
          <Button
            variant={variant === 'thermal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setVariant('thermal')}
          >
            {t('vat.qrThermal')}
          </Button>
          <Button
            variant={variant === 'a5' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setVariant('a5')}
          >
            {t('vat.qrA5')}
          </Button>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          {t('vat.print')}
        </Button>
      </div>

      <div className="flex justify-center overflow-auto bg-gray-50 p-4">
        {variant === 'thermal' ? (
          <VatQrThermalCard
            url={url}
            invoiceRef={invoiceRef}
            dateTime={dateTime}
          />
        ) : (
          <VatQrA5Sheet
            url={url}
            invoiceRef={invoiceRef}
            tableLabel={tableLabel}
            amountLabel={amountLabel}
            dateTime={dateTime}
          />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground print:hidden">
        {t('vat.printHint')}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npx vitest run src/tests/components/dialog/vat-request-qr-tabs.test.tsx
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/dialog/vat-request/vat-request-qr-tabs.tsx src/tests/components/dialog/vat-request-qr-tabs.test.tsx
git commit -m "feat(vat): add VatRequestQrTabs (thermal/A5 switch + print)"
```

---

## PHASE 4 — Main dialog orchestrator

### Task 10: VatRequestDialog

**Files:**
- Create: `src/components/app/dialog/vat-request/vat-request-dialog.tsx`
- Create: `src/components/app/dialog/vat-request/index.ts`
- Create: `src/tests/components/dialog/vat-request-dialog.test.tsx`
- Modify: `src/components/app/dialog/index.tsx` (add re-export)

**Interfaces:**
- Consumes: `useGetVatLink`, `useVatRequestStatus`, `useSubmitVatRequest` (Task 4); all 4 sub-components (Tasks 5-9)
- Produces:
  ```tsx
  interface VatRequestDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderSlug: string
    /** Optional info for richer A5 print (table name, amount, datetime). */
    invoiceRef?: string
    tableLabel?: string
    amountLabel?: string
    dateTime?: string
  }
  export function VatRequestDialog(props: VatRequestDialogProps): JSX.Element
  ```

- [ ] **Step 1: Write failing smoke test**

Create `src/tests/components/dialog/vat-request-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/api/vat', () => ({
  getVatLink: vi.fn(),
  getVatRequestPublic: vi.fn(),
  submitVatRequestPublic: vi.fn(),
}))

import * as api from '@/api/vat'
import { VatRequestDialog } from '@/components/app/dialog/vat-request/vat-request-dialog'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('VatRequestDialog', () => {
  it('does not render when open=false', () => {
    render(
      <VatRequestDialog
        open={false}
        onOpenChange={vi.fn()}
        orderSlug="order-1"
      />,
      { wrapper },
    )
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('fetches link on open=true', async () => {
    vi.mocked(api.getVatLink).mockResolvedValue({
      result: { url: '/vat-request/INV-1' },
    } as never)
    vi.mocked(api.getVatRequestPublic).mockResolvedValue({
      result: { invoiceSlug: 'INV-1', status: 'AVAILABLE' },
    } as never)
    render(
      <VatRequestDialog
        open={true}
        onOpenChange={vi.fn()}
        orderSlug="order-1"
      />,
      { wrapper },
    )
    await waitFor(() => expect(api.getVatLink).toHaveBeenCalledWith('order-1'))
  })

  it('shows submitted view when status=SUBMITTED', async () => {
    vi.mocked(api.getVatLink).mockResolvedValue({
      result: { url: '/vat-request/INV-1' },
    } as never)
    vi.mocked(api.getVatRequestPublic).mockResolvedValue({
      result: { invoiceSlug: 'INV-1', status: 'SUBMITTED' },
    } as never)
    render(
      <VatRequestDialog
        open={true}
        onOpenChange={vi.fn()}
        orderSlug="order-1"
      />,
      { wrapper },
    )
    await waitFor(() =>
      expect(screen.getByText(/đã được ghi nhận|already/i)).toBeTruthy(),
    )
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npx vitest run src/tests/components/dialog/vat-request-dialog.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement dialog**

Create `src/components/app/dialog/vat-request/vat-request-dialog.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import {
  useGetVatLink,
  useSubmitVatRequest,
  useVatRequestStatus,
} from '@/hooks/use-vat'
import { showToast, showErrorToastMessage } from '@/utils'
import type { VatSubmitFormValues } from '@/schemas/vat.schema'
import { VatRequestQrTabs } from './vat-request-qr-tabs'
import { VatRequestOnBehalfForm } from './vat-request-on-behalf-form'
import { VatRequestSubmittedView } from './vat-request-submitted-view'

type ActiveMode = 'qr' | 'form'

interface VatRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderSlug: string
  invoiceRef?: string
  tableLabel?: string
  amountLabel?: string
  dateTime?: string
}

/**
 * Main orchestrator cho luồng VAT cashier.
 *
 * State flow:
 *   open=true → fetch /orders/:slug/vat-link → extract invoiceSlug from URL
 *   → fetch /vat-request/public/:invoiceSlug → status
 *   → render: SubmittedView (if SUBMITTED) | tab QR+Form (if AVAILABLE)
 */
export function VatRequestDialog({
  open,
  onOpenChange,
  orderSlug,
  invoiceRef,
  tableLabel,
  amountLabel,
  dateTime,
}: VatRequestDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const [mode, setMode] = useState<ActiveMode>('qr')

  const getLink = useGetVatLink()
  const submitMutation = useSubmitVatRequest()

  // Trigger link fetch khi dialog mở
  useEffect(() => {
    if (open && orderSlug) {
      getLink.mutate(orderSlug)
    }
    if (!open) {
      getLink.reset()
      submitMutation.reset()
      setMode('qr')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderSlug])

  // Extract invoiceSlug từ URL trả về: '/vat-request/{invoiceSlug}'
  const url = getLink.data?.result?.url ?? null
  const invoiceSlug = useMemo(() => {
    if (!url) return null
    const match = url.match(/\/vat-request\/([^/?#]+)/)
    return match?.[1] ?? null
  }, [url])

  const status = useVatRequestStatus(invoiceSlug)

  const handleSubmit = (values: VatSubmitFormValues) => {
    if (!invoiceSlug) return
    submitMutation.mutate(
      { invoiceSlug, body: values },
      {
        onSuccess: () => {
          showToast(tToast('toast.vatSubmitSuccess'))
        },
        onError: (err: unknown) => {
          const e = err as {
            response?: { data?: { message?: string } }
            message?: string
          }
          showErrorToastMessage(
            e?.response?.data?.message ||
              e?.message ||
              tToast('toast.vatSubmitFailed'),
          )
        },
      },
    )
  }

  const handleClose = () => onOpenChange(false)

  const isLoadingLink = getLink.isPending
  const isLoadingStatus = status.isLoading
  const hasError = getLink.isError || status.isError

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('vat.dialogTitle')}</DialogTitle>
        </DialogHeader>

        {isLoadingLink || isLoadingStatus ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-pos-gold" />
          </div>
        ) : hasError || !url || !invoiceSlug ? (
          <div className="py-8 text-center text-sm text-destructive">
            {t('vat.fetchLinkFailed')}
          </div>
        ) : status.data?.status === 'SUBMITTED' ? (
          <VatRequestSubmittedView
            invoiceSlug={invoiceSlug}
            onClose={handleClose}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 border-b">
              <ModeTab
                active={mode === 'qr'}
                onClick={() => setMode('qr')}
                label={t('vat.modeQrLabel')}
              />
              <ModeTab
                active={mode === 'form'}
                onClick={() => setMode('form')}
                label={t('vat.modeFormLabel')}
              />
            </div>
            {mode === 'qr' ? (
              <VatRequestQrTabs
                url={fullUrl(url)}
                invoiceRef={invoiceRef}
                tableLabel={tableLabel}
                amountLabel={amountLabel}
                dateTime={dateTime}
              />
            ) : (
              <VatRequestOnBehalfForm
                isSubmitting={submitMutation.isPending}
                submitError={getSubmitErrorMessage(submitMutation.error)}
                onSubmit={handleSubmit}
                onCancel={handleClose}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-pos-gold text-pos-gold'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}

/**
 * BE thường trả URL dạng relative `/vat-request/INV-1`. Khi render trong QR,
 * phải đổi sang absolute để khách scan ra link đầy đủ.
 */
function fullUrl(maybeRelative: string): string {
  if (/^https?:\/\//.test(maybeRelative)) return maybeRelative
  if (typeof window === 'undefined') return maybeRelative
  return `${window.location.origin}${maybeRelative}`
}

function getSubmitErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined
  const e = error as {
    response?: { data?: { message?: string } }
    message?: string
  }
  return e?.response?.data?.message ?? e?.message
}
```

- [ ] **Step 4: Add barrel + re-export**

Create `src/components/app/dialog/vat-request/index.ts`:

```ts
export { VatRequestDialog } from './vat-request-dialog'
```

Open `src/components/app/dialog/index.tsx`. Find the existing re-exports (e.g. `export { default as QrCodeDialog } from './qr-code-dialog'`). Add a line:

```ts
export { VatRequestDialog } from './vat-request'
```

- [ ] **Step 5: Run test — verify PASS**

```bash
npx vitest run src/tests/components/dialog/vat-request-dialog.test.tsx
```
Expected: 3 tests pass.

- [ ] **Step 6: Verify TS + lint**

```bash
npx tsc --noEmit 2>&1 | grep vat-request | head
npm run lint 2>&1 | grep vat-request | head
```
Expected: empty.

- [ ] **Step 7: Commit**

```bash
git add src/components/app/dialog/vat-request/ src/components/app/dialog/index.tsx src/tests/components/dialog/vat-request-dialog.test.tsx
git commit -m "feat(vat): add VatRequestDialog orchestrator + barrel export"
```

---

## PHASE 5 — Integration into order-management

### Task 11: Add "VAT" column with action button

**Files:**
- Modify: `src/app/system/order-management/DataTable/columns/order-history-columns.tsx`

**Interfaces:**
- Consumes: `VatRequestDialog` from Task 10
- Produces: New column accessor `'vatRequest'` rendered as icon button per row (visible only when `order.status === OrderStatus.PAID`)

- [ ] **Step 1: Add column + dialog state to the columns hook**

Open `src/app/system/order-management/DataTable/columns/order-history-columns.tsx`.

Find the existing imports block (top of file). Add:

```ts
import { Receipt } from 'lucide-react'
import { VatRequestDialog } from '@/components/app/dialog'
```

Find the state declarations near the top of `useOrderHistoryColumns` (after `paymentPrecheckSlug` state added in earlier work). Add:

```ts
  const [vatDialogOrder, setVatDialogOrder] = useState<IOrder | null>(null)
```

- [ ] **Step 2: Add the column to the returned array**

Find the `return [` array of columns (around line 102). Insert this new column object **immediately after** the `callCustomerToGetOrder` column block (which closes around line 181) and **before** the `exportInvoice` column:

```ts
    {
      accessorKey: 'vatRequest',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.vatRequest')} />
      ),
      cell: ({ row }) => {
        const order = row.original
        const enabled = order?.status === OrderStatus.PAID
        return (
          <Button
            variant="ghost"
            size="icon"
            disabled={!enabled}
            className="h-8 w-8 text-pos-gold disabled:text-muted-foreground/40"
            onClick={(e) => {
              e.stopPropagation()
              if (!enabled) return
              setVatDialogOrder(order)
            }}
            aria-label={t('order.vatRequest')}
            title={
              enabled ? t('order.vatRequest') : t('order.vatRequestUnavailable')
            }
          >
            <Receipt className="h-4 w-4" />
          </Button>
        )
      },
    },
```

- [ ] **Step 3: Render the dialog at the end of the hook**

This is the tricky part: a hook can't render JSX directly. The dialog must mount via a portal-friendly side channel. The simplest path: extract the dialog mount into the parent page that consumes `useOrderHistoryColumns`.

**For this task only**, expose the dialog state via an additional return slot. Change the hook signature:

Find the `export const useOrderHistoryColumns = (): ColumnDef<IOrder>[] => {`. Change return type and final statement:

```ts
export const useOrderHistoryColumns = (): {
  columns: ColumnDef<IOrder>[]
  VatDialogPortal: () => JSX.Element | null
} => {
  // ...existing state + handlers unchanged...

  const VatDialogPortal = () => {
    if (!vatDialogOrder) return null
    return (
      <VatRequestDialog
        open={!!vatDialogOrder}
        onOpenChange={(o) => {
          if (!o) setVatDialogOrder(null)
        }}
        orderSlug={vatDialogOrder.slug}
        invoiceRef={
          vatDialogOrder.referenceNumber != null
            ? String(vatDialogOrder.referenceNumber)
            : undefined
        }
        tableLabel={vatDialogOrder.table?.name ?? undefined}
        amountLabel={
          vatDialogOrder.subtotal != null
            ? formatCurrency(vatDialogOrder.subtotal)
            : undefined
        }
        dateTime={
          vatDialogOrder.createdAt
            ? moment(vatDialogOrder.createdAt).format('DD/MM/YYYY HH:mm')
            : undefined
        }
      />
    )
  }

  return { columns: [/* existing array */], VatDialogPortal }
}
```

- [ ] **Step 4: Update the consumer to use the new return shape**

Find every file that calls `useOrderHistoryColumns()` (likely `src/app/system/order-management/page.tsx` or similar). Run:

```bash
grep -rn "useOrderHistoryColumns" src/ --include='*.tsx' --include='*.ts'
```

For each consumer, change destructuring:

```ts
// BEFORE
const columns = useOrderHistoryColumns()

// AFTER
const { columns, VatDialogPortal } = useOrderHistoryColumns()
```

And add `<VatDialogPortal />` somewhere in the JSX (typically just before the closing fragment of the page).

- [ ] **Step 5: Add i18n placeholders so build doesn't break**

i18n keys `order.vatRequest`, `order.vatRequestUnavailable` are added in Task 12. For now, they'll resolve to the key string if missing — acceptable for the build but not for visual polish. Verify they don't break:

```bash
npm run build 2>&1 | tail -5
```
Expected: build succeeds.

- [ ] **Step 6: Verify lint + tests**

```bash
npx tsc --noEmit 2>&1 | grep order-history-columns | head
npm run lint 2>&1 | grep order-history-columns | head
npm run test 2>&1 | tail -5
```
Expected: tsc clean, lint clean, all tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/system/order-management/DataTable/columns/order-history-columns.tsx
# Plus the consumer file(s) found in Step 4
git commit -m "feat(vat): integrate VAT column + dialog into order-management"
```

---

## PHASE 6 — i18n + cleanup

### Task 12: i18n keys (VI + EN)

**Files:**
- Modify: `src/locales/vi/menu.json`
- Modify: `src/locales/en/menu.json`
- Modify: `src/locales/vi/toast.json`
- Modify: `src/locales/en/toast.json`

- [ ] **Step 1: Add VAT keys to `src/locales/vi/menu.json`**

Find the existing top-level `menu.*` keys. Add the following entries (preserve existing JSON structure — insert in alphabetical position):

```json
    "vatRequest": "Yêu cầu VAT",
    "vatRequestUnavailable": "Chỉ áp dụng cho đơn đã thanh toán",
    "vat": {
      "dialogTitle": "Yêu cầu xuất hoá đơn VAT",
      "modeQrLabel": "QR đưa khách",
      "modeFormLabel": "Điền hộ khách",
      "qrThermal": "Bill 80mm",
      "qrA5": "A5",
      "print": "In",
      "printHint": "Bấm In để mở print preview của trình duyệt.",
      "fetchLinkFailed": "Không tạo được link VAT. Vui lòng thử lại.",
      "customerName": "Tên khách / Đại diện",
      "customerNamePlaceholder": "VD: Nguyễn Văn A hoặc Công ty TNHH ABC",
      "taxCode": "Mã số thuế",
      "taxCodeHint": "10 chữ số (cá nhân/hộ KD) hoặc 13 chữ số (chi nhánh)",
      "companyName": "Tên công ty",
      "companyNamePlaceholder": "Công ty TNHH ABC",
      "email": "Email nhận hoá đơn",
      "address": "Địa chỉ",
      "addressPlaceholder": "123 Nguyễn Huệ, Quận 1, TP.HCM",
      "note": "Ghi chú",
      "notePlaceholder": "Yêu cầu thêm nếu có...",
      "optional": "tuỳ chọn",
      "submitOnceWarning": "Sau khi bấm Gửi, không thể chỉnh sửa. Kiểm tra kỹ thông tin.",
      "submit": "Gửi yêu cầu",
      "submitting": "Đang gửi...",
      "cancel": "Đóng",
      "close": "Đóng",
      "alreadySubmittedTitle": "Yêu cầu VAT đã được ghi nhận",
      "alreadySubmittedBody": "Khách sẽ nhận hoá đơn qua email trong vòng 24h.",
      "error": {
        "customerName.required": "Vui lòng nhập tên khách",
        "taxCode.required": "Vui lòng nhập mã số thuế",
        "taxCode.invalidFormat": "Mã số thuế phải đúng 10 hoặc 13 chữ số",
        "address.required": "Vui lòng nhập địa chỉ",
        "email.invalid": "Email không hợp lệ"
      }
    },
```

- [ ] **Step 2: Add EN mirrors to `src/locales/en/menu.json`**

Same shape, English text:

```json
    "vatRequest": "VAT request",
    "vatRequestUnavailable": "Only available for paid orders",
    "vat": {
      "dialogTitle": "VAT invoice request",
      "modeQrLabel": "QR for customer",
      "modeFormLabel": "Fill on behalf",
      "qrThermal": "Bill 80mm",
      "qrA5": "A5",
      "print": "Print",
      "printHint": "Click Print to open the browser print preview.",
      "fetchLinkFailed": "Could not generate VAT link. Please try again.",
      "customerName": "Customer / Representative name",
      "customerNamePlaceholder": "e.g. John Smith or ABC Co., Ltd",
      "taxCode": "Tax code",
      "taxCodeHint": "10 digits (individual) or 13 digits (branch)",
      "companyName": "Company name",
      "companyNamePlaceholder": "ABC Co., Ltd",
      "email": "Email for invoice",
      "address": "Address",
      "addressPlaceholder": "123 Nguyen Hue St., District 1, HCMC",
      "note": "Note",
      "notePlaceholder": "Additional notes if any...",
      "optional": "optional",
      "submitOnceWarning": "After clicking Submit you cannot edit. Please verify carefully.",
      "submit": "Submit",
      "submitting": "Submitting...",
      "cancel": "Close",
      "close": "Close",
      "alreadySubmittedTitle": "VAT request already submitted",
      "alreadySubmittedBody": "Customer will receive the invoice by email within 24h.",
      "error": {
        "customerName.required": "Please enter customer name",
        "taxCode.required": "Please enter tax code",
        "taxCode.invalidFormat": "Tax code must be exactly 10 or 13 digits",
        "address.required": "Please enter address",
        "email.invalid": "Invalid email format"
      }
    },
```

- [ ] **Step 3: Add toast keys to `src/locales/vi/toast.json`**

```json
        "vatSubmitSuccess": "Đã gửi yêu cầu xuất hoá đơn VAT.",
        "vatSubmitFailed": "Gửi yêu cầu VAT thất bại. Vui lòng thử lại.",
        "vatRequestNotFound": "Không tìm thấy yêu cầu VAT.",
        "vatRequestAlreadyExists": "Yêu cầu VAT cho đơn này đã tồn tại."
```

- [ ] **Step 4: Add toast keys to `src/locales/en/toast.json`**

```json
    "vatSubmitSuccess": "VAT request submitted.",
    "vatSubmitFailed": "Failed to submit VAT request. Please try again.",
    "vatRequestNotFound": "VAT request not found.",
    "vatRequestAlreadyExists": "VAT request already exists for this order."
```

- [ ] **Step 5: Verify JSON syntax + run full test suite**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/vi/menu.json'))" && echo "vi menu OK"
node -e "JSON.parse(require('fs').readFileSync('src/locales/en/menu.json'))" && echo "en menu OK"
node -e "JSON.parse(require('fs').readFileSync('src/locales/vi/toast.json'))" && echo "vi toast OK"
node -e "JSON.parse(require('fs').readFileSync('src/locales/en/toast.json'))" && echo "en toast OK"
npm run test 2>&1 | tail -5
```
Expected: 4× "OK", all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/locales/vi/menu.json src/locales/en/menu.json src/locales/vi/toast.json src/locales/en/toast.json
git commit -m "i18n(vat): add VAT request keys (vi + en)"
```

---

### Task 13: Cleanup demo route

**Files:**
- Delete: `src/app/demo/vat-qr/page.tsx`
- Modify: `src/router/loadable.tsx` (remove `VatQrDemoPage` lazy import)
- Modify: `src/router/index.tsx` (remove `/demo/vat-qr` route)

- [ ] **Step 1: Delete the demo page file**

```bash
rm src/app/demo/vat-qr/page.tsx
rmdir src/app/demo/vat-qr 2>/dev/null
rmdir src/app/demo 2>/dev/null
```

- [ ] **Step 2: Remove from loadable**

Open `src/router/loadable.tsx`. Find and DELETE these lines:

```ts
// Demo: VAT QR variants — public route /demo/vat-qr (xoá sau khi chọn xong)
export const VatQrDemoPage = React.lazy(() => import('@/app/demo/vat-qr/page'))
```

- [ ] **Step 3: Remove from router**

Open `src/router/index.tsx`. Find and DELETE:
- The `VatQrDemoPage` entry in the top-level import from `./loadable`.
- The route entry:

```ts
      // Demo VAT QR variants (xoá sau khi user chọn xong)
      {
        path: '/demo/vat-qr',
        element: <SuspenseElement component={VatQrDemoPage} />,
      },
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit 2>&1 | grep -E "vat-qr|VatQrDemo" | head
npm run build 2>&1 | tail -5
```
Expected: tsc clean, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/router/loadable.tsx src/router/index.tsx
git add -u  # picks up the deleted page file
git commit -m "chore(vat): remove demo QR route after design selection"
```

---

## PHASE 7 — Final validation

### Task 14: End-to-end manual + automated validation

- [ ] **Step 1: Full test suite**

```bash
npm run test
```
Expected: all PASS, no regressions.

- [ ] **Step 2: Production build**

```bash
npm run build
```
Expected: succeed, no errors.

- [ ] **Step 3: Lint**

```bash
npm run lint 2>&1 | tail -10
```
Expected: 0 errors. Warnings unchanged from main branch start.

- [ ] **Step 4: Line-count check on new files**

```bash
wc -l src/components/app/dialog/vat-request/*.tsx
wc -l src/api/vat.ts src/hooks/use-vat.ts src/schemas/vat.schema.ts src/types/vat.type.ts
```
Targets:
- Dialog orchestrator: ≤ 200 lines
- Each sub-component: ≤ 200 lines
- API/hook/schema/types: each ≤ 100 lines

- [ ] **Step 5: Manual smoke (dev server)**

```bash
npm run dev
```

Click through these scenarios on `/system/order-management`:

| Scenario | Expected |
|---|---|
| Đơn pending → VAT button | Disabled, tooltip "Chỉ áp dụng cho đơn đã thanh toán" |
| Đơn paid → VAT button | Enabled, click mở dialog |
| Dialog mở → loading spinner | Hiển ~200ms rồi hiện QR/form |
| Tab "QR đưa khách" → bấm Bill 80mm vs A5 | Switch layout, QR có URL đầy đủ |
| Bấm "In" trong tab QR | Browser print dialog mở, preview đúng layout |
| Tab "Điền hộ khách" → submit valid form | Toast success, dialog refresh sang SubmittedView |
| Tab "Điền hộ" → mã số thuế 9 chữ số | Inline error "phải đúng 10 hoặc 13 chữ số" |
| Tab "Điền hộ" → email không hợp lệ | Inline error "Email không hợp lệ" |
| Đóng dialog rồi mở lại đơn vừa submit | Trực tiếp hiển SubmittedView (không phải form) |
| BE 404 (order không tồn tại) | Toast error + dialog hiển "Không tạo được link VAT" |
| BE 400 (chưa paid — race) | Toast error fallback |

- [ ] **Step 6: No code commit (validation only)**

If any smoke test fails, fix root cause and commit separately with `fix(vat): <specific>`. Don't bundle into a generic "validation fixes" commit.

---

## Self-Review Notes

**1. Spec coverage:**
- ✅ Endpoint 1 `POST /orders/:slug/vat-link` — Task 3 (`getVatLink`)
- ✅ Endpoint 2 `GET /vat-request/public/:slug` — Task 3 (`getVatRequestPublic`)
- ✅ Endpoint 3 `POST /vat-request/public/:slug` — Task 3 (`submitVatRequestPublic`)
- ✅ Tax code 10/13 digit validation — Task 2 (`vatSubmitSchema`)
- ✅ Email format validation — Task 2
- ✅ Required vs optional fields per doc — Task 2 + Task 7
- ✅ Submit-once enforcement — Task 4 (`useVatRequestStatus` gates), Task 8 (`SubmittedView`), Task 10 (dialog flow)
- ✅ Column visible only for paid orders — Task 11 (`enabled` flag)
- ✅ QR variant A (thermal) + C (A5) — Tasks 5, 6, 9
- ✅ Cashier on-behalf form — Task 7
- ✅ Dialog UX — Task 10
- ✅ Print support — Task 9 (`window.print` + print CSS in printable layouts)
- ✅ i18n bilingual — Task 12

**2. Out of scope (NOT in this plan):**
- Admin/accountant list (`GET /vat-request`) — separate plan when needed
- Edit khách info (`PATCH /vat-request/:slug`) — separate plan
- Accountant info (`PATCH /vat-request/:slug/accountant-info`) — separate plan
- Status workflow (`PATCH /vat-request/:slug/status`) — separate plan
- Sidebar item for VAT management — out of scope (no list page yet)
- Real BE error code mapping — placeholders in Task 3, refine after BE integration

**3. Type consistency:**
- `IVatLinkResponse`, `IVatPublicStatus`, `IVatSubmitRequest`, `IVatRequest` defined in Task 1, used verbatim in Tasks 3, 4, 7, 10.
- `VatSubmitFormValues` from Task 2's `z.infer` used in Tasks 7, 10.
- `QUERYKEY.vat`, `QUERYKEY.vatRequestPublic` added in Task 3, consumed in Task 4.
- Dialog props (`orderSlug`, `invoiceRef`, `tableLabel`, etc.) consistent between Task 10 and Task 11.

**4. Risk areas flagged:**
- Task 11 changes `useOrderHistoryColumns` return shape (`ColumnDef[]` → `{columns, VatDialogPortal}`). Consumers must be updated; the grep in Step 4 ensures none are missed.
- BE error codes are placeholders (Task 3). After BE integration, revisit `errorCodes` map and add real codes.
- Print CSS lives inline in QR components (`className="vat-printable"`); the dialog must not strip this when rendering. Verify in Task 14 smoke.
