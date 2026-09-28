# Work Shift (Ca Làm Việc — Cashier) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế mô hình ca-theo-staff (`/staff-shifts`) bằng mô hình ca-theo-cashier (`/work-shifts`) theo spec `src/docs/feature-work-shift.md`, rồi xoá sạch code cũ.

**Architecture:** Dựng module `work-shift` mới song song (types → api → hooks → components → pages), không rename file cũ. Điểm khác biệt kiến trúc lớn nhất so với code cũ: **không còn gate ở layout** — staff tạo order tự do, hệ thống gán order vào ca sau (pre-shift linking); gate chuyển xuống **bước thanh toán**. Sau khi module mới chạy được thì xoá toàn bộ `staff-shift.*`, `src/app/system/staff-shifts/`, `src/app/staff/my-shifts/`, `src/app/staff/preview/`.

**Tech Stack:** React 18 + TypeScript, Vite, TanStack Query v5, Zustand, react-hook-form + Zod, Radix/shadcn + Tailwind, i18next (static imports), Vitest + Testing Library.

## Global Constraints

- HTTP client: luôn `import { http } from '@/utils'`. Không tạo axios instance mới. Không set header `Authorization` thủ công.
- Mọi API function trả `Promise<IApiResponse<T>>` và `return response.data`. Không try/catch trong tầng `src/api/`.
- Query key luôn lấy từ `QUERYKEY.*` (`src/constants/query.ts`), không viết mảng string inline.
- Request nền/polling phải có `doNotShowLoading: true` (dùng cùng cách như `src/api/staff-shift.ts` hiện tại — truyền thẳng trong config object).
- **`IPaginationResponse<T>` (`{ items, total, page, pageSize, totalPages, hasNext, hasPrevious }`) KHÔNG dùng được cho work-shift.** BE work-shift trả `{ data, total, page, size }` → dùng type riêng `IWorkShiftPage<T>`.
- Base URL các endpoint: `/work-shifts`. Endpoint thanh toán hiện có trong codebase là `/payment/initiate` (spec ghi `/payments/initiate` — **không đổi code, chỉ xử lý error code**).
- **Layout — quy tắc không được vi phạm:** CASHIER, MANAGER, ADMIN, SUPER_ADMIN đều ở `SystemLayout` (sidebar trái + `AppHeader` + breadcrumb). `StaffPosLayout` tại `/staff/*` chỉ dành cho STAFF chạy bàn và **không chứa gì liên quan tới ca**. Toàn bộ UI ca nằm dưới `/system/work-shifts`; ngoại lệ duy nhất staff gặp là banner chặn thanh toán (Task 8). `SystemLayout` đã cấp padding ngang cho `<main>` — page chỉ đặt padding dọc.
- Error code work-shift: `161000`–`161006`. Xem Task 2 để biết mapping đầy đủ.
- `openingCash` là **bắt buộc** và `>= 0` (khác code cũ, nơi nó optional).
- BE **không** trả `durationMinutes` → FE tự tính từ `actualStartTime`.
- Text hiển thị dùng i18n namespace `workShift` (`src/locales/{en,vi}/work-shift.json`), không hardcode chuỗi tiếng Việt như code shift cũ.
- Role: `Role.CASHIER`, `Role.MANAGER`, `Role.ADMIN`, `Role.SUPER_ADMIN`, `Role.STAFF` — đã có sẵn trong `src/constants/role.ts`.
- Commit sau mỗi task. Chạy `npm run lint` trước khi commit.

---

### Task 1: Types + mở rộng IOrder

**Files:**
- Create: `src/types/work-shift.type.ts`
- Modify: `src/types/index.ts` (thêm 1 dòng export)
- Modify: `src/types/dish.type.ts:202` (thêm field `workShift` vào `IOrder`)

**Interfaces:**
- Produces: `WorkShiftStatus`, `IWorkShiftUserSummary`, `IWorkShiftBasic`, `IWorkShift`, `IWorkShiftPaymentSummaryItem`, `IWorkShiftStaffSummaryItem`, `IWorkShiftSummary`, `IWorkShiftInvoice`, `IOpenWorkShiftRequest`, `ICloseWorkShiftRequest`, `IForceCloseWorkShiftRequest`, `IWorkShiftListQuery`, `IWorkShiftPage<T>`, `IOrderWorkShiftRef`

- [ ] **Step 1: Tạo file types**

Create `src/types/work-shift.type.ts`:

```ts
import type { IBranch } from './branch.type'

export enum WorkShiftStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

/** Tham chiếu ca gắn trên order/invoice. */
export interface IOrderWorkShiftRef {
  slug: string
  status: WorkShiftStatus
}

export interface IWorkShiftUserSummary {
  slug: string
  firstName: string
  lastName: string
  phonenumber: string
}

/** WorkShiftBasicDto — spec §Phụ lục. */
export interface IWorkShiftBasic {
  slug: string
  cashier: IWorkShiftUserSummary
  branch: Pick<IBranch, 'slug' | 'name'>
  actualStartTime: string
  actualEndTime: string | null
  status: WorkShiftStatus
  openingCash: number
  closingCash: number | null
  note: string | null
  createdAt: string
}

/** WorkShiftResponseDto — Basic + số liệu tổng hợp. */
export interface IWorkShift extends IWorkShiftBasic {
  totalOrders: number
  totalInvoicesPaid: number
  totalRevenue: number
  /** Chỉ có giá trị > 0 ngay tại response mở ca. */
  preShiftOrdersLinked: number
}

export interface IWorkShiftPaymentSummaryItem {
  paymentMethod: string
  displayName: string
  totalAmount: number
  invoiceCount: number
}

export interface IWorkShiftStaffSummaryItem {
  staff: IWorkShiftUserSummary
  totalOrdersCreated: number
  totalOrdersRevenue: number
}

/** WorkShiftSummaryResponseDto — trả về bởi close / force-close / summary. */
export interface IWorkShiftSummary {
  workShift: IWorkShiftBasic
  openingCash: number
  closingCash: number | null
  cashRevenue: number
  /** null khi ca còn ACTIVE (chưa có closingCash). */
  cashDifference: number | null
  paymentSummary: IWorkShiftPaymentSummaryItem[]
  totalRevenue: number
  totalOrders: number
  totalInvoicesPaid: number
  crossShiftOrdersCount: number
  staffSummary: IWorkShiftStaffSummaryItem[]
  totalStaffWorked: number
}

export interface IWorkShiftInvoice {
  slug: string
  referenceNumber: number
  paymentMethod: string
  amount: number
  status: string
  /** BE trả tên thu ngân dạng chuỗi, không phải object. */
  cashier: string
  createdAt: string
}

export interface IOpenWorkShiftRequest {
  openingCash: number
}

export interface ICloseWorkShiftRequest {
  closingCash?: number
  note?: string
}

export interface IForceCloseWorkShiftRequest {
  note: string
}

export interface IWorkShiftListQuery {
  page?: number
  size?: number
  cashierSlug?: string
  branchSlug?: string
  startDate?: string
  endDate?: string
  status?: WorkShiftStatus
}

/**
 * BE work-shift phân trang theo shape { data, total, page, size }.
 * KHÔNG dùng IPaginationResponse (shape { items, pageSize, ... }).
 */
export interface IWorkShiftPage<T> {
  data: T[]
  total: number
  page: number
  size: number
}
```

- [ ] **Step 2: Export từ barrel**

Trong `src/types/index.ts`, thêm ngay dưới dòng `export * from './staff-shift.type'`:

```ts
export * from './work-shift.type'
```

- [ ] **Step 3: Thêm field workShift vào IOrder**

Trong `src/types/dish.type.ts`, thêm import ở đầu file:

```ts
import type { IOrderWorkShiftRef } from './work-shift.type'
```

Trong `export interface IOrder extends IBase {` (dòng 202), thêm field:

```ts
  /** Ca làm việc order thuộc về. null khi order tạo lúc chưa có ca (pre-shift). */
  workShift?: IOrderWorkShiftRef | null
```

- [ ] **Step 4: Kiểm tra typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS, không lỗi mới.

- [ ] **Step 5: Commit**

```bash
git add src/types/work-shift.type.ts src/types/index.ts src/types/dish.type.ts
git commit -m "feat(work-shift): add work shift types and IOrder.workShift ref"
```

---

### Task 2: Error codes + toast mapping + i18n toast keys

**Files:**
- Create: `src/constants/work-shift.ts`
- Modify: `src/constants/index.ts`
- Modify: `src/utils/toast.tsx:337-340` (thêm vào map `errorCodes`)
- Modify: `src/locales/vi/toast.json`, `src/locales/en/toast.json`
- Test: `src/lib/__tests__/work-shift-error.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `WORK_SHIFT_ERROR_CODE` (const object), `getApiErrorCode(error: unknown): number | undefined`

- [ ] **Step 1: Viết test thất bại cho getApiErrorCode**

Create `src/lib/__tests__/work-shift-error.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getApiErrorCode } from '../api-error'
import { WORK_SHIFT_ERROR_CODE } from '@/constants/work-shift'

describe('getApiErrorCode', () => {
  it('reads statusCode from axios-style error response', () => {
    const err = { response: { data: { statusCode: 161003 } } }
    expect(getApiErrorCode(err)).toBe(161003)
  })

  it('falls back to legacy code field when statusCode is absent', () => {
    const err = { response: { data: { code: 161006 } } }
    expect(getApiErrorCode(err)).toBe(161006)
  })

  it('prefers statusCode over legacy code', () => {
    const err = { response: { data: { statusCode: 161003, code: 999 } } }
    expect(getApiErrorCode(err)).toBe(161003)
  })

  it('returns undefined for non-api errors', () => {
    expect(getApiErrorCode(new Error('boom'))).toBeUndefined()
    expect(getApiErrorCode(null)).toBeUndefined()
    expect(getApiErrorCode(undefined)).toBeUndefined()
  })
})

describe('WORK_SHIFT_ERROR_CODE', () => {
  it('maps every documented work-shift error code', () => {
    expect(WORK_SHIFT_ERROR_CODE.NOT_FOUND).toBe(161000)
    expect(WORK_SHIFT_ERROR_CODE.BRANCH_HAS_ACTIVE).toBe(161001)
    expect(WORK_SHIFT_ERROR_CODE.NO_ACTIVE).toBe(161002)
    expect(WORK_SHIFT_ERROR_CODE.BRANCH_NO_ACTIVE).toBe(161003)
    expect(WORK_SHIFT_ERROR_CODE.FORBIDDEN).toBe(161004)
    expect(WORK_SHIFT_ERROR_CODE.NOT_ACTIVE).toBe(161005)
    expect(WORK_SHIFT_ERROR_CODE.PAYMENT_FORBIDDEN_FOR_STAFF).toBe(161006)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run src/lib/__tests__/work-shift-error.test.ts`
Expected: FAIL — `Failed to resolve import "../api-error"`.

- [ ] **Step 3: Tạo constants error code**

Create `src/constants/work-shift.ts`:

```ts
/** Error code work-shift từ BE — spec §6 Error Codes. */
export const WORK_SHIFT_ERROR_CODE = {
  /** 404 — Không tìm thấy ca làm việc */
  NOT_FOUND: 161000,
  /** 400 — Chi nhánh đã có ca đang ACTIVE */
  BRANCH_HAS_ACTIVE: 161001,
  /** 400 — Thu ngân này không có ca nào ACTIVE */
  NO_ACTIVE: 161002,
  /** 400 — Chi nhánh chưa có ca mở, không thể thanh toán */
  BRANCH_NO_ACTIVE: 161003,
  /** 403 — Không có quyền truy cập ca này */
  FORBIDDEN: 161004,
  /** 400 — Ca không ở trạng thái ACTIVE */
  NOT_ACTIVE: 161005,
  /** 403 — Staff không được tạo payment */
  PAYMENT_FORBIDDEN_FOR_STAFF: 161006,
} as const

export type TWorkShiftErrorCode =
  (typeof WORK_SHIFT_ERROR_CODE)[keyof typeof WORK_SHIFT_ERROR_CODE]

/** Số phút cửa sổ hiển thị đơn xuyên ca — spec §4 Luồng C. */
export const CROSS_SHIFT_WINDOW_MINUTES = 120
```

- [ ] **Step 4: Tạo helper trích error code**

Create `src/lib/api-error.ts`:

```ts
/**
 * Trích BE error code từ lỗi axios.
 * BE trả `statusCode` ở shape mới, `code` ở shape cũ — ưu tiên statusCode.
 * Trả undefined nếu không phải lỗi API.
 */
export function getApiErrorCode(error: unknown): number | undefined {
  const data = (
    error as { response?: { data?: { statusCode?: number; code?: number } } }
  )?.response?.data
  if (!data) return undefined
  return data.statusCode ?? data.code
}
```

- [ ] **Step 5: Export constants từ barrel**

Trong `src/constants/index.ts`, thêm:

```ts
export * from './work-shift'
```

- [ ] **Step 6: Chạy lại test**

Run: `npx vitest run src/lib/__tests__/work-shift-error.test.ts`
Expected: PASS — 5 tests passed.

- [ ] **Step 7: Thêm mapping vào toast**

Trong `src/utils/toast.tsx`, thêm ngay trước dòng `}` đóng object `errorCodes` (sau dòng `102001: 'toast.vatRequestAlreadyExists',`):

```ts
  // Work shift (ca làm việc)
  161000: 'toast.workShiftNotFound',
  161001: 'toast.workShiftBranchHasActive',
  161002: 'toast.workShiftNoActive',
  161003: 'toast.workShiftBranchNoActive',
  161004: 'toast.workShiftForbidden',
  161005: 'toast.workShiftNotActive',
  161006: 'toast.workShiftPaymentForbiddenForStaff',
```

- [ ] **Step 8: Thêm i18n key tiếng Việt**

Trong `src/locales/vi/toast.json`, thêm vào object gốc:

```json
  "workShiftNotFound": "Không tìm thấy ca làm việc",
  "workShiftBranchHasActive": "Chi nhánh đã có ca làm việc đang hoạt động",
  "workShiftNoActive": "Bạn chưa mở ca làm việc",
  "workShiftBranchNoActive": "Chưa có ca làm việc nào được mở. Vui lòng liên hệ thu ngân để mở ca trước khi thanh toán",
  "workShiftForbidden": "Bạn không có quyền truy cập ca làm việc này",
  "workShiftNotActive": "Ca làm việc này đã đóng",
  "workShiftPaymentForbiddenForStaff": "Nhân viên không có quyền tạo thanh toán. Vui lòng liên hệ thu ngân"
```

- [ ] **Step 9: Thêm i18n key tiếng Anh**

Trong `src/locales/en/toast.json`, thêm vào object gốc:

```json
  "workShiftNotFound": "Work shift not found",
  "workShiftBranchHasActive": "This branch already has an active work shift",
  "workShiftNoActive": "You have not opened a work shift",
  "workShiftBranchNoActive": "No active work shift. Please ask a cashier to open one before taking payment",
  "workShiftForbidden": "You do not have permission to access this work shift",
  "workShiftNotActive": "This work shift is already closed",
  "workShiftPaymentForbiddenForStaff": "Staff cannot create payments. Please contact a cashier"
```

- [ ] **Step 10: Lint + commit**

```bash
npm run lint
git add src/constants/work-shift.ts src/constants/index.ts src/lib/api-error.ts src/lib/__tests__/work-shift-error.test.ts src/utils/toast.tsx src/locales/vi/toast.json src/locales/en/toast.json
git commit -m "feat(work-shift): add 161xxx error codes, toast mapping and api-error helper"
```

---

### Task 3: Helpers + tests (TDD)

**Files:**
- Create: `src/lib/work-shift-helpers.ts`
- Test: `src/lib/__tests__/work-shift-helpers.test.ts`

**Interfaces:**
- Consumes: `IOrderWorkShiftRef` (Task 1), `CROSS_SHIFT_WINDOW_MINUTES` (Task 2)
- Produces:
  - `computeShiftDurationMinutes(startIso: string, nowMs?: number): number`
  - `formatShiftDuration(minutes: number | null | undefined): string`
  - `isLongShift(minutes: number | null | undefined): boolean`
  - `computeCashDifference(args: { openingCash: number; closingCash: number | null; cashRevenue: number }): number | null`
  - `isCrossShiftOrder(orderWorkShiftSlug: string | null | undefined, currentShiftSlug: string): boolean`

- [ ] **Step 1: Viết test thất bại**

Create `src/lib/__tests__/work-shift-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
  isLongShift,
  computeCashDifference,
  isCrossShiftOrder,
} from '../work-shift-helpers'

describe('computeShiftDurationMinutes', () => {
  it('computes whole minutes elapsed since start', () => {
    const start = '2026-06-29T08:00:00.000Z'
    const now = new Date('2026-06-29T10:30:00.000Z').getTime()
    expect(computeShiftDurationMinutes(start, now)).toBe(150)
  })

  it('floors partial minutes', () => {
    const start = '2026-06-29T08:00:00.000Z'
    const now = new Date('2026-06-29T08:00:59.000Z').getTime()
    expect(computeShiftDurationMinutes(start, now)).toBe(0)
  })

  it('clamps to 0 when start is in the future (clock skew)', () => {
    const start = '2026-06-29T12:00:00.000Z'
    const now = new Date('2026-06-29T08:00:00.000Z').getTime()
    expect(computeShiftDurationMinutes(start, now)).toBe(0)
  })

  it('returns 0 for an unparseable start time', () => {
    expect(computeShiftDurationMinutes('not-a-date', Date.now())).toBe(0)
  })
})

describe('formatShiftDuration', () => {
  it('formats minutes only when under 1 hour', () => {
    expect(formatShiftDuration(45)).toBe('45m')
  })

  it('formats hours only when an exact multiple of 60', () => {
    expect(formatShiftDuration(120)).toBe('2h')
  })

  it('formats hours + minutes for mixed values', () => {
    expect(formatShiftDuration(150)).toBe('2h 30m')
  })

  it('returns "0m" for zero', () => {
    expect(formatShiftDuration(0)).toBe('0m')
  })

  it('returns em dash for null/undefined', () => {
    expect(formatShiftDuration(null)).toBe('—')
    expect(formatShiftDuration(undefined)).toBe('—')
  })
})

describe('isLongShift', () => {
  it('flags shifts at or beyond 10 hours', () => {
    expect(isLongShift(600)).toBe(true)
    expect(isLongShift(601)).toBe(true)
  })

  it('does not flag shorter shifts', () => {
    expect(isLongShift(599)).toBe(false)
  })

  it('does not flag null/undefined', () => {
    expect(isLongShift(null)).toBe(false)
    expect(isLongShift(undefined)).toBe(false)
  })
})

describe('computeCashDifference', () => {
  it('returns a positive value when the drawer holds extra cash', () => {
    expect(
      computeCashDifference({
        openingCash: 500_000,
        closingCash: 1_200_000,
        cashRevenue: 650_000,
      }),
    ).toBe(50_000)
  })

  it('returns a negative value when the drawer is short', () => {
    expect(
      computeCashDifference({
        openingCash: 500_000,
        closingCash: 1_000_000,
        cashRevenue: 650_000,
      }),
    ).toBe(-150_000)
  })

  it('returns 0 on an exact match', () => {
    expect(
      computeCashDifference({
        openingCash: 500_000,
        closingCash: 1_150_000,
        cashRevenue: 650_000,
      }),
    ).toBe(0)
  })

  it('returns null while the shift is still ACTIVE (no closingCash)', () => {
    expect(
      computeCashDifference({
        openingCash: 500_000,
        closingCash: null,
        cashRevenue: 650_000,
      }),
    ).toBeNull()
  })
})

describe('isCrossShiftOrder', () => {
  it('flags an order whose shift differs from the current shift', () => {
    expect(isCrossShiftOrder('ws-a', 'ws-b')).toBe(true)
  })

  it('does not flag an order belonging to the current shift', () => {
    expect(isCrossShiftOrder('ws-b', 'ws-b')).toBe(false)
  })

  it('does not flag an order with no shift (pre-shift, just linked)', () => {
    expect(isCrossShiftOrder(null, 'ws-b')).toBe(false)
    expect(isCrossShiftOrder(undefined, 'ws-b')).toBe(false)
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run src/lib/__tests__/work-shift-helpers.test.ts`
Expected: FAIL — `Failed to resolve import "../work-shift-helpers"`.

- [ ] **Step 3: Cài đặt helpers**

Create `src/lib/work-shift-helpers.ts`:

```ts
const LONG_SHIFT_THRESHOLD_MINUTES = 600 // 10 giờ

/**
 * Số phút ca đã mở. BE work-shift không trả durationMinutes nên FE tự tính.
 * Clamp về 0 khi lệch đồng hồ hoặc start không parse được.
 */
export function computeShiftDurationMinutes(
  startIso: string,
  nowMs: number = Date.now(),
): number {
  const startMs = new Date(startIso).getTime()
  if (Number.isNaN(startMs)) return 0
  return Math.max(0, Math.floor((nowMs - startMs) / 60_000))
}

/** Format số phút thành "Xh Ym" / "Xh" / "Ym". Trả "—" khi không có giá trị. */
export function formatShiftDuration(
  minutes: number | null | undefined,
): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes === 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** True khi ca đã mở từ 10 giờ trở lên — dùng để gợi ý force-close. */
export function isLongShift(
  durationMinutes: number | null | undefined,
): boolean {
  if (durationMinutes === null || durationMinutes === undefined) return false
  return durationMinutes >= LONG_SHIFT_THRESHOLD_MINUTES
}

/**
 * cashDifference = closingCash - openingCash - cashRevenue.
 * > 0 thừa tiền mặt, < 0 thiếu, = 0 khớp. null khi ca chưa đóng.
 *
 * BE cũng trả sẵn `cashDifference`; hàm này dùng để đối chiếu phía client
 * và để hiển thị preview trong dialog đóng ca trước khi submit.
 */
export function computeCashDifference(args: {
  openingCash: number
  closingCash: number | null
  cashRevenue: number
}): number | null {
  if (args.closingCash === null) return null
  return args.closingCash - args.openingCash - args.cashRevenue
}

/**
 * True khi order thuộc ca khác với ca đang xem (đơn xuyên ca — spec §4 Luồng C).
 * Order chưa có ca (null) không tính là xuyên ca.
 */
export function isCrossShiftOrder(
  orderWorkShiftSlug: string | null | undefined,
  currentShiftSlug: string,
): boolean {
  if (!orderWorkShiftSlug) return false
  return orderWorkShiftSlug !== currentShiftSlug
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/lib/__tests__/work-shift-helpers.test.ts`
Expected: PASS — 19 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/work-shift-helpers.ts src/lib/__tests__/work-shift-helpers.test.ts
git commit -m "feat(work-shift): add duration, cash-difference and cross-shift helpers"
```

---

### Task 4: API layer

**Files:**
- Create: `src/api/work-shift.ts`

**Interfaces:**
- Consumes: types từ Task 1
- Produces: `openWorkShift`, `closeWorkShift`, `getCurrentWorkShift`, `getCurrentWorkShiftOrders`, `getCurrentWorkShiftInvoices`, `getCurrentWorkShiftStaff`, `getCurrentWorkShiftSummary`, `getActiveWorkShifts`, `getWorkShifts`, `getWorkShiftBySlug`, `getWorkShiftOrders`, `getWorkShiftInvoices`, `getWorkShiftStaff`, `getWorkShiftSummary`, `forceCloseWorkShift`

- [ ] **Step 1: Tạo file API**

Create `src/api/work-shift.ts`:

```ts
import { http } from '@/utils'
import type {
  IApiResponse,
  ICloseWorkShiftRequest,
  IForceCloseWorkShiftRequest,
  IOpenWorkShiftRequest,
  IOrder,
  IWorkShift,
  IWorkShiftInvoice,
  IWorkShiftListQuery,
  IWorkShiftPage,
  IWorkShiftStaffSummaryItem,
  IWorkShiftSummary,
} from '@/types'

// ---------- Cashier ----------

export async function openWorkShift(
  params: IOpenWorkShiftRequest,
): Promise<IApiResponse<IWorkShift>> {
  const response = await http.post<IApiResponse<IWorkShift>>(
    '/work-shifts/open',
    params,
  )
  return response.data
}

export async function closeWorkShift(
  params: ICloseWorkShiftRequest,
): Promise<IApiResponse<IWorkShiftSummary>> {
  const response = await http.patch<IApiResponse<IWorkShiftSummary>>(
    '/work-shifts/close',
    params,
  )
  return response.data
}

export async function getCurrentWorkShift(): Promise<IApiResponse<IWorkShift>> {
  const response = await http.get<IApiResponse<IWorkShift>>(
    '/work-shifts/current',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentWorkShiftOrders(): Promise<
  IApiResponse<IOrder[]>
> {
  const response = await http.get<IApiResponse<IOrder[]>>(
    '/work-shifts/current/orders',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentWorkShiftInvoices(): Promise<
  IApiResponse<IWorkShiftInvoice[]>
> {
  const response = await http.get<IApiResponse<IWorkShiftInvoice[]>>(
    '/work-shifts/current/invoices',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentWorkShiftStaff(): Promise<
  IApiResponse<IWorkShiftStaffSummaryItem[]>
> {
  const response = await http.get<IApiResponse<IWorkShiftStaffSummaryItem[]>>(
    '/work-shifts/current/staff',
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getCurrentWorkShiftSummary(): Promise<
  IApiResponse<IWorkShiftSummary>
> {
  const response = await http.get<IApiResponse<IWorkShiftSummary>>(
    '/work-shifts/current/summary',
    { doNotShowLoading: true },
  )
  return response.data
}

// ---------- Manager / Admin ----------

export async function getActiveWorkShifts(
  branchSlug?: string,
): Promise<IApiResponse<IWorkShift[]>> {
  const response = await http.get<IApiResponse<IWorkShift[]>>(
    '/work-shifts/active',
    {
      params: branchSlug ? { branchSlug } : undefined,
      doNotShowLoading: true,
    },
  )
  return response.data
}

export async function forceCloseWorkShift(
  slug: string,
  params: IForceCloseWorkShiftRequest,
): Promise<IApiResponse<IWorkShiftSummary>> {
  const response = await http.patch<IApiResponse<IWorkShiftSummary>>(
    `/work-shifts/${slug}/force-close`,
    params,
  )
  return response.data
}

// ---------- Dùng chung ----------

export async function getWorkShifts(
  query: IWorkShiftListQuery,
): Promise<IApiResponse<IWorkShiftPage<IWorkShift>>> {
  const response = await http.get<IApiResponse<IWorkShiftPage<IWorkShift>>>(
    '/work-shifts',
    { params: query, doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftBySlug(
  slug: string,
): Promise<IApiResponse<IWorkShift>> {
  const response = await http.get<IApiResponse<IWorkShift>>(
    `/work-shifts/${slug}`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftOrders(
  slug: string,
): Promise<IApiResponse<IOrder[]>> {
  const response = await http.get<IApiResponse<IOrder[]>>(
    `/work-shifts/${slug}/orders`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftInvoices(
  slug: string,
): Promise<IApiResponse<IWorkShiftInvoice[]>> {
  const response = await http.get<IApiResponse<IWorkShiftInvoice[]>>(
    `/work-shifts/${slug}/invoices`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftStaff(
  slug: string,
): Promise<IApiResponse<IWorkShiftStaffSummaryItem[]>> {
  const response = await http.get<IApiResponse<IWorkShiftStaffSummaryItem[]>>(
    `/work-shifts/${slug}/staff`,
    { doNotShowLoading: true },
  )
  return response.data
}

export async function getWorkShiftSummary(
  slug: string,
): Promise<IApiResponse<IWorkShiftSummary>> {
  const response = await http.get<IApiResponse<IWorkShiftSummary>>(
    `/work-shifts/${slug}/summary`,
    { doNotShowLoading: true },
  )
  return response.data
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/work-shift.ts
git commit -m "feat(work-shift): add work-shift api layer (15 endpoints)"
```

---

### Task 5: Query keys + hooks

**Files:**
- Modify: `src/constants/query.ts` (thêm 12 key)
- Create: `src/hooks/use-work-shift.ts`
- Modify: `src/hooks/index.ts`

**Interfaces:**
- Consumes: API functions từ Task 4
- Produces: `useCurrentWorkShift`, `useOpenWorkShift`, `useCloseWorkShift`, `useCurrentWorkShiftOrders`, `useCurrentWorkShiftInvoices`, `useCurrentWorkShiftStaff`, `useCurrentWorkShiftSummary`, `useActiveWorkShifts`, `useWorkShifts`, `useWorkShiftBySlug`, `useWorkShiftOrders`, `useWorkShiftInvoices`, `useWorkShiftStaff`, `useWorkShiftSummary`, `useForceCloseWorkShift`

- [ ] **Step 1: Thêm query keys**

Trong `src/constants/query.ts`, thêm ngay sau dòng `currentStaffShiftOrders: ['currentStaffShiftOrders'],`:

```ts
  workShiftCurrent: ['workShiftCurrent'],
  workShiftCurrentOrders: ['workShiftCurrentOrders'],
  workShiftCurrentInvoices: ['workShiftCurrentInvoices'],
  workShiftCurrentStaff: ['workShiftCurrentStaff'],
  workShiftCurrentSummary: ['workShiftCurrentSummary'],
  workShiftsActive: ['workShiftsActive'],
  workShifts: ['workShifts'],
  workShiftBySlug: ['workShiftBySlug'],
  workShiftOrders: ['workShiftOrders'],
  workShiftInvoices: ['workShiftInvoices'],
  workShiftStaff: ['workShiftStaff'],
  workShiftSummary: ['workShiftSummary'],
```

- [ ] **Step 2: Tạo hooks**

Create `src/hooks/use-work-shift.ts`:

```ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  closeWorkShift,
  forceCloseWorkShift,
  getActiveWorkShifts,
  getCurrentWorkShift,
  getCurrentWorkShiftInvoices,
  getCurrentWorkShiftOrders,
  getCurrentWorkShiftStaff,
  getCurrentWorkShiftSummary,
  getWorkShiftBySlug,
  getWorkShiftInvoices,
  getWorkShiftOrders,
  getWorkShifts,
  getWorkShiftStaff,
  getWorkShiftSummary,
  openWorkShift,
} from '@/api/work-shift'
import { QUERYKEY } from '@/constants'
import type {
  ICloseWorkShiftRequest,
  IForceCloseWorkShiftRequest,
  IOpenWorkShiftRequest,
  IWorkShiftListQuery,
} from '@/types'

/**
 * 404 = chưa mở ca (trạng thái hợp lệ, không phải lỗi hạ tầng) → không retry.
 * Dùng chung cho mọi query /work-shifts/current*.
 */
const retryExceptNotFound = (failureCount: number, error: unknown) => {
  const status =
    (error as { status?: number })?.status ??
    (error as { response?: { status?: number } })?.response?.status
  if (status === 404) return false
  return failureCount < 2
}

// ---------- Cashier: ca hiện tại ----------

export const useCurrentWorkShift = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrent],
    queryFn: () => getCurrentWorkShift(),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptNotFound,
  })
}

export const useCurrentWorkShiftOrders = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrentOrders],
    queryFn: () => getCurrentWorkShiftOrders(),
    enabled,
    refetchInterval: 20_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptNotFound,
    placeholderData: keepPreviousData,
  })
}

export const useCurrentWorkShiftInvoices = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrentInvoices],
    queryFn: () => getCurrentWorkShiftInvoices(),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptNotFound,
    placeholderData: keepPreviousData,
  })
}

export const useCurrentWorkShiftStaff = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrentStaff],
    queryFn: () => getCurrentWorkShiftStaff(),
    enabled,
    refetchInterval: 60_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptNotFound,
  })
}

export const useCurrentWorkShiftSummary = (enabled: boolean = true) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftCurrentSummary],
    queryFn: () => getCurrentWorkShiftSummary(),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    retry: retryExceptNotFound,
  })
}

// ---------- Cashier: mutation ----------

/** Danh sách query cần invalidate sau khi mở/đóng ca. */
const CURRENT_SHIFT_KEYS = [
  QUERYKEY.workShiftCurrent,
  QUERYKEY.workShiftCurrentOrders,
  QUERYKEY.workShiftCurrentInvoices,
  QUERYKEY.workShiftCurrentStaff,
  QUERYKEY.workShiftCurrentSummary,
  QUERYKEY.workShiftsActive,
  QUERYKEY.workShifts,
]

export const useOpenWorkShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: IOpenWorkShiftRequest) => openWorkShift(data),
    meta: { ignoreGlobalError: true },
    onSuccess: () => {
      CURRENT_SHIFT_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [...key] }),
      )
    },
  })
}

export const useCloseWorkShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ICloseWorkShiftRequest) => closeWorkShift(data),
    meta: { ignoreGlobalError: true },
    onSuccess: () => {
      CURRENT_SHIFT_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [...key] }),
      )
    },
  })
}

export const useForceCloseWorkShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      slug,
      data,
    }: {
      slug: string
      data: IForceCloseWorkShiftRequest
    }) => forceCloseWorkShift(slug, data),
    meta: { ignoreGlobalError: true },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.workShiftsActive] })
      queryClient.invalidateQueries({ queryKey: [...QUERYKEY.workShifts] })
      queryClient.invalidateQueries({
        queryKey: [...QUERYKEY.workShiftBySlug, variables.slug],
      })
      queryClient.invalidateQueries({
        queryKey: [...QUERYKEY.workShiftSummary, variables.slug],
      })
    },
  })
}

// ---------- Manager / Admin ----------

export const useActiveWorkShifts = (
  branchSlug?: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftsActive, branchSlug ?? null],
    queryFn: () => getActiveWorkShifts(branchSlug),
    enabled,
    refetchInterval: 30_000,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

// ---------- Dùng chung ----------

export const useWorkShifts = (
  query: IWorkShiftListQuery,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShifts, query],
    queryFn: () => getWorkShifts(query),
    enabled,
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

export const useWorkShiftBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftBySlug, slug],
    queryFn: () => getWorkShiftBySlug(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

export const useWorkShiftOrders = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftOrders, slug],
    queryFn: () => getWorkShiftOrders(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    placeholderData: keepPreviousData,
  })
}

export const useWorkShiftInvoices = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftInvoices, slug],
    queryFn: () => getWorkShiftInvoices(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
    placeholderData: keepPreviousData,
  })
}

export const useWorkShiftStaff = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftStaff, slug],
    queryFn: () => getWorkShiftStaff(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}

export const useWorkShiftSummary = (slug: string | undefined) => {
  return useQuery({
    queryKey: [...QUERYKEY.workShiftSummary, slug],
    queryFn: () => getWorkShiftSummary(slug as string),
    enabled: !!slug,
    select: (data) => data.result,
    meta: { ignoreGlobalError: true },
  })
}
```

- [ ] **Step 3: Export từ barrel**

Trong `src/hooks/index.ts`, thêm ngay sau `export * from './use-staff-shift'`:

```ts
export * from './use-work-shift'
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/constants/query.ts src/hooks/use-work-shift.ts src/hooks/index.ts
git commit -m "feat(work-shift): add query keys and react-query hooks"
```

---

### Task 6: Zod schemas

**Files:**
- Create: `src/schemas/work-shift.schema.ts`
- Modify: `src/schemas/index.ts` (nếu có barrel — kiểm tra bằng `ls src/schemas/index.ts`; nếu không có thì bỏ qua step 2)

**Interfaces:**
- Produces: `openWorkShiftSchema` / `TOpenWorkShiftSchema`, `closeWorkShiftSchema` / `TCloseWorkShiftSchema`, `forceCloseWorkShiftSchema` / `TForceCloseWorkShiftSchema`

- [ ] **Step 1: Tạo schema**

Create `src/schemas/work-shift.schema.ts`:

```ts
import { z } from 'zod'

/** openingCash bắt buộc, >= 0, số nguyên (đơn vị VND). */
export const openWorkShiftSchema = z.object({
  openingCash: z
    .number({ invalid_type_error: 'workShift.validation.openingCashInvalid' })
    .int('workShift.validation.openingCashInvalid')
    .min(0, 'workShift.validation.openingCashNegative'),
})
export type TOpenWorkShiftSchema = z.infer<typeof openWorkShiftSchema>

/** closingCash và note đều tuỳ chọn khi cashier tự đóng ca. */
export const closeWorkShiftSchema = z.object({
  closingCash: z
    .number({ invalid_type_error: 'workShift.validation.closingCashInvalid' })
    .int('workShift.validation.closingCashInvalid')
    .min(0, 'workShift.validation.closingCashNegative')
    .optional(),
  note: z.string().max(500, 'workShift.validation.noteTooLong').optional(),
})
export type TCloseWorkShiftSchema = z.infer<typeof closeWorkShiftSchema>

/** note BẮT BUỘC khi manager force-close (spec §5.15). */
export const forceCloseWorkShiftSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, 'workShift.validation.forceCloseNoteRequired')
    .max(500, 'workShift.validation.noteTooLong'),
})
export type TForceCloseWorkShiftSchema = z.infer<
  typeof forceCloseWorkShiftSchema
>
```

- [ ] **Step 2: Export từ barrel nếu tồn tại**

Run: `ls src/schemas/index.ts`
Nếu file tồn tại, thêm:

```ts
export * from './work-shift.schema'
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -b --noEmit
git add src/schemas/work-shift.schema.ts src/schemas/index.ts
git commit -m "feat(work-shift): add zod schemas for open/close/force-close"
```

---

### Task 7: i18n namespace `workShift`

**Files:**
- Create: `src/locales/vi/work-shift.json`
- Create: `src/locales/en/work-shift.json`
- Modify: `src/i18n.ts` (import + đăng ký namespace cho cả `en` và `vi`)
- Modify: `src/locales/vi/sidebar.json`, `src/locales/en/sidebar.json`

**Interfaces:**
- Produces: namespace `workShift` với các key dùng ở Task 8–15; key `sidebar.workShiftManagement`

- [ ] **Step 1: Tạo file locale tiếng Việt**

Create `src/locales/vi/work-shift.json`:

```json
{
  "title": "Ca làm việc",
  "currentShift": "Ca hiện tại",
  "openShift": "Mở ca",
  "openShiftTitle": "Bắt đầu ca làm việc",
  "openShiftCta": "Bắt đầu ca",
  "opening": "Đang mở ca…",
  "openingCash": "Tiền mặt đầu ca",
  "openingCashHint": "Số tiền có sẵn ở quầy để đối soát cuối ca",
  "closeShift": "Đóng ca",
  "closeShiftTitle": "Đóng ca làm việc",
  "closing": "Đang đóng ca…",
  "closingCash": "Tiền mặt cuối ca",
  "note": "Ghi chú",
  "notePlaceholder": "Ghi chú cho ca này (tuỳ chọn)",
  "forceClose": "Đóng ép ca",
  "forceCloseTitle": "Đóng ép ca làm việc",
  "forceCloseNote": "Lý do đóng ép",
  "forceCloseNotePlaceholder": "Ví dụ: thu ngân quên đóng ca",
  "forceCloseWarning": "Ca này sẽ bị đóng ngay lập tức. Thao tác không thể hoàn tác.",
  "cashier": "Thu ngân",
  "branch": "Chi nhánh",
  "startTime": "Giờ mở ca",
  "endTime": "Giờ đóng ca",
  "duration": "Thời lượng",
  "status": "Trạng thái",
  "statusActive": "Đang mở",
  "statusClosed": "Đã đóng",
  "totalOrders": "Tổng đơn",
  "totalInvoicesPaid": "Hoá đơn đã thu",
  "totalRevenue": "Tổng doanh thu",
  "cashRevenue": "Tiền mặt thực thu",
  "cashDifference": "Chênh lệch tiền mặt",
  "cashDifferenceSurplus": "Thừa",
  "cashDifferenceShortage": "Thiếu",
  "cashDifferenceExact": "Khớp chính xác",
  "cashDifferencePending": "Chưa xác định (ca đang mở)",
  "paymentSummary": "Theo phương thức thanh toán",
  "invoiceCount": "Số hoá đơn",
  "staffSummary": "Nhân viên trong ca",
  "totalStaffWorked": "Số nhân viên",
  "ordersCreated": "Đơn đã tạo",
  "ordersRevenue": "Doanh thu đơn",
  "crossShiftOrders": "Đơn xuyên ca",
  "crossShiftBadge": "Xuyên ca",
  "preShiftLinked": "Đã gán {{count}} đơn tạo trước khi mở ca vào ca này",
  "tabOrders": "Đơn hàng",
  "tabInvoices": "Hoá đơn",
  "tabStaff": "Nhân viên",
  "tabSummary": "Tổng kết",
  "tabActive": "Ca đang mở",
  "tabHistory": "Lịch sử ca",
  "history": "Lịch sử ca",
  "shiftDetail": "Chi tiết ca",
  "noActiveShift": "Chưa có ca làm việc nào đang mở",
  "noActiveShiftForCashier": "Bạn chưa mở ca làm việc",
  "noActiveShiftForPayment": "Chi nhánh chưa có ca làm việc nào đang mở. Vui lòng liên hệ thu ngân để mở ca trước khi thanh toán.",
  "staffCannotPay": "Nhân viên không có quyền tạo thanh toán. Vui lòng chuyển cho thu ngân.",
  "requestPaymentCta": "BÁO THU NGÂN →",
  "paymentRequested": "Đã báo thu ngân. Bàn này đang chờ thanh toán.",
  "emptyOrders": "Chưa có đơn hàng nào trong ca",
  "emptyInvoices": "Chưa có hoá đơn nào trong ca",
  "emptyStaff": "Chưa có nhân viên nào tạo đơn trong ca",
  "emptyHistory": "Chưa có ca làm việc nào",
  "longShiftWarning": "Ca đã mở hơn 10 giờ",
  "openSuccess": "Đã mở ca làm việc",
  "closeSuccess": "Đã đóng ca làm việc",
  "forceCloseSuccess": "Đã đóng ép ca làm việc",
  "filterCashier": "Thu ngân",
  "filterBranch": "Chi nhánh",
  "filterStatus": "Trạng thái",
  "filterDateRange": "Khoảng ngày",
  "validation": {
    "openingCashInvalid": "Tiền mặt đầu ca không hợp lệ",
    "openingCashNegative": "Tiền mặt đầu ca không được âm",
    "closingCashInvalid": "Tiền mặt cuối ca không hợp lệ",
    "closingCashNegative": "Tiền mặt cuối ca không được âm",
    "noteTooLong": "Ghi chú tối đa 500 ký tự",
    "forceCloseNoteRequired": "Vui lòng nhập lý do đóng ép ca"
  }
}
```

- [ ] **Step 2: Tạo file locale tiếng Anh**

Create `src/locales/en/work-shift.json` với cùng bộ key, giá trị tiếng Anh:

```json
{
  "title": "Work shift",
  "currentShift": "Current shift",
  "openShift": "Open shift",
  "openShiftTitle": "Start your work shift",
  "openShiftCta": "Start shift",
  "opening": "Opening shift…",
  "openingCash": "Opening cash",
  "openingCashHint": "Cash in the drawer, used for end-of-shift reconciliation",
  "closeShift": "Close shift",
  "closeShiftTitle": "Close work shift",
  "closing": "Closing shift…",
  "closingCash": "Closing cash",
  "note": "Note",
  "notePlaceholder": "Note for this shift (optional)",
  "forceClose": "Force close",
  "forceCloseTitle": "Force close work shift",
  "forceCloseNote": "Reason",
  "forceCloseNotePlaceholder": "e.g. cashier forgot to close the shift",
  "forceCloseWarning": "This shift will be closed immediately. This cannot be undone.",
  "cashier": "Cashier",
  "branch": "Branch",
  "startTime": "Started at",
  "endTime": "Ended at",
  "duration": "Duration",
  "status": "Status",
  "statusActive": "Active",
  "statusClosed": "Closed",
  "totalOrders": "Total orders",
  "totalInvoicesPaid": "Invoices paid",
  "totalRevenue": "Total revenue",
  "cashRevenue": "Cash collected",
  "cashDifference": "Cash difference",
  "cashDifferenceSurplus": "Surplus",
  "cashDifferenceShortage": "Shortage",
  "cashDifferenceExact": "Exact match",
  "cashDifferencePending": "Not available (shift still active)",
  "paymentSummary": "By payment method",
  "invoiceCount": "Invoices",
  "staffSummary": "Staff in shift",
  "totalStaffWorked": "Staff count",
  "ordersCreated": "Orders created",
  "ordersRevenue": "Order revenue",
  "crossShiftOrders": "Cross-shift orders",
  "crossShiftBadge": "Cross-shift",
  "preShiftLinked": "Linked {{count}} pre-shift order(s) to this shift",
  "tabOrders": "Orders",
  "tabInvoices": "Invoices",
  "tabStaff": "Staff",
  "tabSummary": "Summary",
  "tabActive": "Active shifts",
  "tabHistory": "Shift history",
  "history": "Shift history",
  "shiftDetail": "Shift detail",
  "noActiveShift": "No active work shift",
  "noActiveShiftForCashier": "You have not opened a work shift",
  "noActiveShiftForPayment": "This branch has no active work shift. Please ask a cashier to open one before taking payment.",
  "staffCannotPay": "Staff cannot create payments. Please hand this over to a cashier.",
  "requestPaymentCta": "NOTIFY CASHIER →",
  "paymentRequested": "Cashier notified. This table is now awaiting payment.",
  "emptyOrders": "No orders in this shift yet",
  "emptyInvoices": "No invoices in this shift yet",
  "emptyStaff": "No staff has created an order in this shift yet",
  "emptyHistory": "No work shifts yet",
  "longShiftWarning": "This shift has been open for over 10 hours",
  "openSuccess": "Work shift opened",
  "closeSuccess": "Work shift closed",
  "forceCloseSuccess": "Work shift force-closed",
  "filterCashier": "Cashier",
  "filterBranch": "Branch",
  "filterStatus": "Status",
  "filterDateRange": "Date range",
  "validation": {
    "openingCashInvalid": "Opening cash is invalid",
    "openingCashNegative": "Opening cash cannot be negative",
    "closingCashInvalid": "Closing cash is invalid",
    "closingCashNegative": "Closing cash cannot be negative",
    "noteTooLong": "Note must be at most 500 characters",
    "forceCloseNoteRequired": "Please enter a reason for force-closing"
  }
}
```

- [ ] **Step 3: Đăng ký namespace trong i18n.ts**

Trong `src/i18n.ts`, thêm import cạnh các import khác:

```ts
import enWorkShift from '@/locales/en/work-shift.json'
import viWorkShift from '@/locales/vi/work-shift.json'
```

Trong object `resources` (bắt đầu tại `src/i18n.ts:92`), thêm một dòng vào nhánh `en` — đặt cuối danh sách namespace, ngay sau `auditLog: enAuditLog,`:

```ts
        workShift: enWorkShift,
```

Và dòng tương ứng vào nhánh `vi`, ngay sau `auditLog: viAuditLog,`:

```ts
        workShift: viWorkShift,
```

- [ ] **Step 4: Thêm key sidebar**

Trong `src/locales/vi/sidebar.json` thêm:

```json
  "workShiftManagement": "Quản lý ca làm việc"
```

Trong `src/locales/en/sidebar.json` thêm:

```json
  "workShiftManagement": "Work shift management"
```

- [ ] **Step 5: Kiểm tra namespace load được**

Run: `npm run dev` rồi mở console trình duyệt — không được có warning `i18next::translator: missingKey ... workShift`.
Hoặc chạy typecheck: `npx tsc -b --noEmit` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/locales/vi/work-shift.json src/locales/en/work-shift.json src/i18n.ts src/locales/vi/sidebar.json src/locales/en/sidebar.json
git commit -m "feat(work-shift): add workShift i18n namespace (vi/en)"
```

---

### Task 8: Payment gate — chặn thanh toán khi chi nhánh chưa có ca

**Files:**
- Create: `src/hooks/use-branch-shift-gate.ts`
- Modify: `src/hooks/index.ts`
- Create: `src/components/work-shift/shift-gate-banner.tsx`
- Modify: `src/components/staff/hooks/use-table-payment-session.ts:145-160`
- Test: `src/hooks/__tests__/use-branch-shift-gate.test.tsx`

**Interfaces:**
- Consumes: `useCurrentWorkShift`, `useActiveWorkShifts` (Task 5); `WORK_SHIFT_ERROR_CODE`, `getApiErrorCode` (Task 2)
- Produces:
  - `useBranchShiftGate(branchSlug?: string): { canPay: boolean; reason: TShiftGateReason; isLoading: boolean }`
  - `type TShiftGateReason = 'OK' | 'NO_ACTIVE_SHIFT' | 'STAFF_CANNOT_PAY' | 'UNKNOWN'`
  - `<ShiftGateBanner reason={...} />`

**Ghi chú thiết kế (quan trọng):** STAFF **không có quyền** gọi `/work-shifts/current` lẫn `/work-shifts/active` (spec §3), nên FE không thể pre-check cho STAFF. Với STAFF, gate trả `STAFF_CANNOT_PAY` ngay từ role, không gọi API. Với CASHIER dùng `/current`, với MANAGER/ADMIN/SUPER_ADMIN dùng `/active`.

- [ ] **Step 1: Viết test thất bại**

Create `src/hooks/__tests__/use-branch-shift-gate.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { Role } from '@/constants'
import { useBranchShiftGate } from '../use-branch-shift-gate'

const mockCurrent = vi.fn()
const mockActive = vi.fn()
const mockRole = vi.fn()

vi.mock('../use-work-shift', () => ({
  useCurrentWorkShift: (enabled: boolean) => mockCurrent(enabled),
  useActiveWorkShifts: (branchSlug?: string, enabled?: boolean) =>
    mockActive(branchSlug, enabled),
}))

vi.mock('@/stores', () => ({
  useUserStore: (selector: (s: unknown) => unknown) =>
    selector({ getUserInfo: () => ({ role: { name: mockRole() } }) }),
}))

beforeEach(() => {
  mockCurrent.mockReturnValue({ data: undefined, isLoading: false })
  mockActive.mockReturnValue({ data: undefined, isLoading: false })
})

describe('useBranchShiftGate', () => {
  it('blocks STAFF without calling any shift endpoint', () => {
    mockRole.mockReturnValue(Role.STAFF)
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(false)
    expect(result.current.reason).toBe('STAFF_CANNOT_PAY')
    expect(mockCurrent).toHaveBeenCalledWith(false)
    expect(mockActive).toHaveBeenCalledWith('branch-1', false)
  })

  it('allows CASHIER when they have an active shift', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockCurrent.mockReturnValue({ data: { slug: 'ws-1' }, isLoading: false })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(true)
    expect(result.current.reason).toBe('OK')
  })

  it('blocks CASHIER with no active shift', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockCurrent.mockReturnValue({ data: undefined, isLoading: false })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(false)
    expect(result.current.reason).toBe('NO_ACTIVE_SHIFT')
  })

  it('allows MANAGER when the branch has at least one active shift', () => {
    mockRole.mockReturnValue(Role.MANAGER)
    mockActive.mockReturnValue({ data: [{ slug: 'ws-1' }], isLoading: false })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(true)
    expect(result.current.reason).toBe('OK')
  })

  it('blocks MANAGER when the branch has no active shift', () => {
    mockRole.mockReturnValue(Role.MANAGER)
    mockActive.mockReturnValue({ data: [], isLoading: false })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.canPay).toBe(false)
    expect(result.current.reason).toBe('NO_ACTIVE_SHIFT')
  })

  it('does not block while still loading', () => {
    mockRole.mockReturnValue(Role.CASHIER)
    mockCurrent.mockReturnValue({ data: undefined, isLoading: true })
    const { result } = renderHook(() => useBranchShiftGate('branch-1'))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.canPay).toBe(false)
    expect(result.current.reason).toBe('UNKNOWN')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run src/hooks/__tests__/use-branch-shift-gate.test.tsx`
Expected: FAIL — `Failed to resolve import "../use-branch-shift-gate"`.

- [ ] **Step 3: Cài đặt hook gate**

Create `src/hooks/use-branch-shift-gate.ts`:

```ts
import { Role } from '@/constants'
import { useUserStore } from '@/stores'

import { useActiveWorkShifts, useCurrentWorkShift } from './use-work-shift'

export type TShiftGateReason =
  | 'OK'
  | 'NO_ACTIVE_SHIFT'
  | 'STAFF_CANNOT_PAY'
  | 'UNKNOWN'

export interface IBranchShiftGate {
  canPay: boolean
  reason: TShiftGateReason
  isLoading: boolean
}

/**
 * Quyết định người dùng hiện tại có được phép khởi tạo thanh toán không.
 *
 * STAFF không có quyền đọc /work-shifts/current lẫn /work-shifts/active
 * (spec §3) nên không thể pre-check — chặn ngay từ role, không gọi API.
 * Lỗi 161006 từ BE vẫn là chốt chặn cuối.
 */
export function useBranchShiftGate(branchSlug?: string): IBranchShiftGate {
  const role = useUserStore((s) => s.getUserInfo())?.role?.name
  const isStaff = role === Role.STAFF
  const isCashier = role === Role.CASHIER
  const isManagerOrAbove =
    role === Role.MANAGER || role === Role.ADMIN || role === Role.SUPER_ADMIN

  const { data: currentShift, isLoading: isLoadingCurrent } =
    useCurrentWorkShift(isCashier)
  const { data: activeShifts, isLoading: isLoadingActive } = useActiveWorkShifts(
    branchSlug,
    isManagerOrAbove,
  )

  if (isStaff) {
    return { canPay: false, reason: 'STAFF_CANNOT_PAY', isLoading: false }
  }

  if (isCashier) {
    if (isLoadingCurrent) {
      return { canPay: false, reason: 'UNKNOWN', isLoading: true }
    }
    return currentShift
      ? { canPay: true, reason: 'OK', isLoading: false }
      : { canPay: false, reason: 'NO_ACTIVE_SHIFT', isLoading: false }
  }

  if (isManagerOrAbove) {
    if (isLoadingActive) {
      return { canPay: false, reason: 'UNKNOWN', isLoading: true }
    }
    return (activeShifts?.length ?? 0) > 0
      ? { canPay: true, reason: 'OK', isLoading: false }
      : { canPay: false, reason: 'NO_ACTIVE_SHIFT', isLoading: false }
  }

  // Role không xác định — không chặn ở FE, để BE quyết định.
  return { canPay: true, reason: 'OK', isLoading: false }
}
```

- [ ] **Step 4: Export từ barrel**

Trong `src/hooks/index.ts`, thêm:

```ts
export * from './use-branch-shift-gate'
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `npx vitest run src/hooks/__tests__/use-branch-shift-gate.test.tsx`
Expected: PASS — 6 tests passed.

- [ ] **Step 6: Tạo banner hiển thị lý do bị chặn**

Create `src/components/work-shift/shift-gate-banner.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'

import type { TShiftGateReason } from '@/hooks'

interface Props {
  reason: TShiftGateReason
  className?: string
}

/** Banner giải thích vì sao nút thanh toán bị khoá. Không render khi reason = OK. */
export function ShiftGateBanner({ reason, className }: Props) {
  const { t } = useTranslation('workShift')

  if (reason === 'OK' || reason === 'UNKNOWN') return null

  const message =
    reason === 'STAFF_CANNOT_PAY'
      ? t('staffCannotPay')
      : t('noActiveShiftForPayment')

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive ${className ?? ''}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
```

- [ ] **Step 7: Bắt error code 161xxx tại call site thanh toán**

Trong `src/components/staff/hooks/use-table-payment-session.ts`, thêm import:

```ts
import { getApiErrorCode } from '@/lib/api-error'
import { WORK_SHIFT_ERROR_CODE } from '@/constants'
import { showErrorToast } from '@/utils'
```

Trong mỗi khối `catch (err)` bao quanh `initiatePaymentAsync` (hiện có tại các dòng ~275 và ~292, và khối xử lý lỗi quanh dòng 148), thêm nhánh xử lý **trước** logic xử lý lỗi hiện tại:

```ts
        const code = getApiErrorCode(err)
        if (
          code === WORK_SHIFT_ERROR_CODE.BRANCH_NO_ACTIVE ||
          code === WORK_SHIFT_ERROR_CODE.PAYMENT_FORBIDDEN_FOR_STAFF
        ) {
          showErrorToast(code)
          return
        }
```

Lý do cần làm thủ công: `useInitiatePayment` khai báo `meta: { ignoreGlobalError: true }` (`src/hooks/use-order.ts:135-142`) nên global `MutationCache` **không** tự bắn toast — chỉ thêm code vào map ở Task 2 là chưa đủ.

- [ ] **Step 8: Áp dụng cùng cách cho 2 call site còn lại**

Áp dụng đúng khối `catch` ở Step 7 vào:
- `src/app/system/payment/payment-page.tsx` — nơi gọi `useInitiatePayment`
- `src/app/client/payment/page.tsx` — nơi gọi `useInitiatePayment`

Ở `src/app/system/payment/payment-page.tsx`, ngoài ra thêm gate UI: gọi `useBranchShiftGate(branchSlug)` (lấy `branchSlug` từ order đang thanh toán), render `<ShiftGateBanner reason={reason} />` phía trên nút thanh toán, và thêm `|| !canPay` vào prop `disabled` của nút xác nhận thanh toán.

- [x] ~~**Step 9-10: Sửa nút THANH TOÁN của STAFF**~~ — **HUỶ BỎ (2026-07-23)**

Hai step này dựa trên một tiền đề **sai**. Plan cho rằng STAFF bấm `THANH TOÁN →`
sẽ rơi vào `/forbidden`. Thực tế [order-summary.tsx](../../../src/components/staff/order-summary.tsx)
đã có sẵn `canTakePayment = role !== Role.STAFF` ẩn hẳn nút với staff, kèm test
riêng `src/tests/components/staff/order-summary-role-gate.test.tsx`. Không có màn cụt.

Thêm nữa, `requestPayment` chỉ ghi vào `src/stores/table-sessions.store.ts` —
persist localStorage, không API, không sync cross-device — nên toast "đã báo thu
ngân" là lời hứa hệ thống không giữ được.

Đã revert: `order-summary.tsx` và `table-order-screen.tsx` trở về nguyên trạng,
và gỡ hai key i18n `requestPaymentCta` / `paymentRequested` khỏi cả hai locale.

Thay vào đó, phạm vi được mở rộng sang **luồng khách vãng lai**: `useInitiatePublicPayment`
trong `src/app/client/payment/page.tsx` cũng bắt 161003/161006. Không đặt
`useBranchShiftGate` ở đó — khách không có role nào đọc được endpoint ca, nên lỗi
từ BE là tín hiệu duy nhất.

- [ ] **Step 11: Chạy toàn bộ test + lint**

Run: `npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 12: Kiểm tra thủ công**

Run: `npm run dev`
- Đăng nhập STAFF → `/staff/table/<id>` → nút hiện `BÁO THU NGÂN →`; bấm vào **không** rời trang, hiện toast, bàn chuyển trạng thái chờ thanh toán.
- Đăng nhập CASHIER → cùng màn → nút vẫn là `THANH TOÁN →` và điều hướng bình thường.

- [ ] **Step 13: Commit**

```bash
git add src/hooks/use-branch-shift-gate.ts src/hooks/__tests__/use-branch-shift-gate.test.tsx src/hooks/index.ts src/components/work-shift/shift-gate-banner.tsx src/components/staff/hooks/use-table-payment-session.ts src/app/system/payment/payment-page.tsx src/app/client/payment/page.tsx src/components/staff/table-order-screen.tsx src/components/staff/order-summary.tsx
git commit -m "feat(work-shift): block payment without active shift; fix staff pay button dead-end"
```

---

### Task 9: Component dùng chung — ShiftSummaryPanel

**Files:**
- Create: `src/components/work-shift/shift-summary-panel.tsx`
- Test: `src/tests/components/shift-summary-panel.test.tsx`

**Interfaces:**
- Consumes: `IWorkShiftSummary` (Task 1), `formatShiftDuration` / `computeShiftDurationMinutes` (Task 3)
- Produces: `<ShiftSummaryPanel summary={IWorkShiftSummary} />` — dùng lại ở close dialog (Task 11), force-close result (Task 14) và trang chi tiết ca (Task 14)

- [ ] **Step 1: Viết test thất bại**

Create `src/tests/components/shift-summary-panel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Convention của repo: t() trả về chính key, không cần khởi tạo i18next.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { ShiftSummaryPanel } from '@/components/work-shift/shift-summary-panel'
import { WorkShiftStatus, type IWorkShiftSummary } from '@/types'

const baseSummary: IWorkShiftSummary = {
  workShift: {
    slug: 'ws-1',
    cashier: {
      slug: 'u-1',
      firstName: 'Nguyen',
      lastName: 'Van A',
      phonenumber: '0901234567',
    },
    branch: { slug: 'b-1', name: 'Chi nhánh Q1' },
    actualStartTime: '2026-06-29T08:00:00.000Z',
    actualEndTime: '2026-06-29T16:00:00.000Z',
    status: WorkShiftStatus.CLOSED,
    openingCash: 500_000,
    closingCash: 1_200_000,
    note: 'Ca sáng',
    createdAt: '2026-06-29T08:00:00.000Z',
  },
  openingCash: 500_000,
  closingCash: 1_200_000,
  cashRevenue: 650_000,
  cashDifference: 50_000,
  paymentSummary: [
    {
      paymentMethod: 'cash',
      displayName: 'Tiền mặt',
      totalAmount: 650_000,
      invoiceCount: 8,
    },
  ],
  totalRevenue: 970_000,
  totalOrders: 14,
  totalInvoicesPaid: 11,
  crossShiftOrdersCount: 2,
  staffSummary: [
    {
      staff: {
        slug: 'u-2',
        firstName: 'Tran',
        lastName: 'Thi B',
        phonenumber: '0912345678',
      },
      totalOrdersCreated: 9,
      totalOrdersRevenue: 580_000,
    },
  ],
  totalStaffWorked: 2,
}

describe('ShiftSummaryPanel', () => {
  it('renders headline counters', () => {
    render(<ShiftSummaryPanel summary={baseSummary} />)
    expect(screen.getByTestId('shift-total-orders')).toHaveTextContent('14')
    expect(screen.getByTestId('shift-total-invoices')).toHaveTextContent('11')
    expect(screen.getByTestId('shift-cross-shift-count')).toHaveTextContent('2')
  })

  it('renders one row per payment method', () => {
    render(<ShiftSummaryPanel summary={baseSummary} />)
    expect(screen.getAllByTestId('payment-summary-row')).toHaveLength(1)
    // Tên phương thức nằm trong span riêng để assert không bị vỡ bởi span lồng.
    expect(screen.getByTestId('payment-method-name')).toHaveTextContent(
      'Tiền mặt',
    )
  })

  it('renders one row per staff member', () => {
    render(<ShiftSummaryPanel summary={baseSummary} />)
    expect(screen.getAllByTestId('staff-summary-row')).toHaveLength(1)
    expect(screen.getByTestId('staff-name')).toHaveTextContent('Tran Thi B')
  })

  it('marks a positive cash difference as a surplus', () => {
    render(<ShiftSummaryPanel summary={baseSummary} />)
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'surplus',
    )
  })

  it('marks a negative cash difference as a shortage', () => {
    render(
      <ShiftSummaryPanel
        summary={{ ...baseSummary, cashDifference: -50_000 }}
      />,
    )
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'shortage',
    )
  })

  it('marks a null cash difference as pending (shift still active)', () => {
    render(
      <ShiftSummaryPanel
        summary={{ ...baseSummary, cashDifference: null, closingCash: null }}
      />,
    )
    expect(screen.getByTestId('cash-difference')).toHaveAttribute(
      'data-variant',
      'pending',
    )
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run src/tests/components/shift-summary-panel.test.tsx`
Expected: FAIL — không resolve được `@/components/work-shift/shift-summary-panel`.

- [ ] **Step 3: Cài đặt component**

Create `src/components/work-shift/shift-summary-panel.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

import type { IWorkShiftSummary } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
} from '@/lib/work-shift-helpers'

interface Props {
  summary: IWorkShiftSummary
}

type TCashVariant = 'surplus' | 'shortage' | 'exact' | 'pending'

function cashVariant(diff: number | null): TCashVariant {
  if (diff === null) return 'pending'
  if (diff > 0) return 'surplus'
  if (diff < 0) return 'shortage'
  return 'exact'
}

const CASH_VARIANT_CLASS: Record<TCashVariant, string> = {
  surplus: 'text-emerald-600 dark:text-emerald-400',
  shortage: 'text-destructive',
  exact: 'text-foreground',
  pending: 'text-muted-foreground',
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string
  value: string
  testId: string
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div data-testid={testId} className="mt-1 text-lg font-bold leading-tight">
        {value}
      </div>
    </div>
  )
}

/**
 * Hiển thị WorkShiftSummaryResponseDto. Dùng chung cho dialog đóng ca,
 * kết quả force-close và tab tổng kết ở trang chi tiết ca.
 */
export function ShiftSummaryPanel({ summary }: Props) {
  const { t } = useTranslation('workShift')

  const { workShift } = summary
  const endMs = workShift.actualEndTime
    ? new Date(workShift.actualEndTime).getTime()
    : undefined
  const durationMinutes = computeShiftDurationMinutes(
    workShift.actualStartTime,
    endMs,
  )

  const variant = cashVariant(summary.cashDifference)
  const cashLabel: Record<TCashVariant, string> = {
    surplus: t('cashDifferenceSurplus'),
    shortage: t('cashDifferenceShortage'),
    exact: t('cashDifferenceExact'),
    pending: t('cashDifferencePending'),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label={t('totalOrders')}
          value={String(summary.totalOrders)}
          testId="shift-total-orders"
        />
        <Stat
          label={t('totalInvoicesPaid')}
          value={String(summary.totalInvoicesPaid)}
          testId="shift-total-invoices"
        />
        <Stat
          label={t('crossShiftOrders')}
          value={String(summary.crossShiftOrdersCount)}
          testId="shift-cross-shift-count"
        />
        <Stat
          label={t('totalStaffWorked')}
          value={String(summary.totalStaffWorked)}
          testId="shift-total-staff"
        />
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('duration')}</span>
          <span className="font-medium">
            {formatShiftDuration(durationMinutes)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('totalRevenue')}</span>
          <span className="font-bold text-pos-gold">
            {formatCurrencyWithSymbol(summary.totalRevenue)}
          </span>
        </div>
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('cashDifference')}
        </div>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('openingCash')}</span>
            <span>{formatCurrencyWithSymbol(summary.openingCash)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('cashRevenue')}</span>
            <span>{formatCurrencyWithSymbol(summary.cashRevenue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('closingCash')}</span>
            <span>
              {summary.closingCash === null
                ? '—'
                : formatCurrencyWithSymbol(summary.closingCash)}
            </span>
          </div>
          <div
            data-testid="cash-difference"
            data-variant={variant}
            className={`flex items-center justify-between border-t pt-1 font-semibold ${CASH_VARIANT_CLASS[variant]}`}
          >
            <span>{cashLabel[variant]}</span>
            <span>
              {summary.cashDifference === null
                ? '—'
                : formatCurrencyWithSymbol(summary.cashDifference)}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('paymentSummary')}
        </div>
        <div className="mt-2 space-y-1">
          {summary.paymentSummary.map((row) => (
            <div
              key={row.paymentMethod}
              data-testid="payment-summary-row"
              className="flex items-center justify-between text-sm"
            >
              <span>
                <span data-testid="payment-method-name">{row.displayName}</span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({row.invoiceCount})
                </span>
              </span>
              <span className="font-medium">
                {formatCurrencyWithSymbol(row.totalAmount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-card p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('staffSummary')}
        </div>
        <div className="mt-2 space-y-1">
          {summary.staffSummary.map((row) => (
            <div
              key={row.staff.slug}
              data-testid="staff-summary-row"
              className="flex items-center justify-between text-sm"
            >
              <span>
                <span data-testid="staff-name">
                  {row.staff.firstName} {row.staff.lastName}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({row.totalOrdersCreated} {t('ordersCreated').toLowerCase()})
                </span>
              </span>
              <span className="font-medium">
                {formatCurrencyWithSymbol(row.totalOrdersRevenue)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/components/shift-summary-panel.test.tsx`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/work-shift/shift-summary-panel.tsx src/tests/components/shift-summary-panel.test.tsx
git commit -m "feat(work-shift): add shared ShiftSummaryPanel component"
```

---

### Task 10: Cashier — OpenShiftScreen

**Files:**
- Create: `src/components/work-shift/open-shift-screen.tsx`

**Interfaces:**
- Consumes: `useOpenWorkShift` (Task 5), `openWorkShiftSchema` (Task 6), `getApiErrorCode` + `WORK_SHIFT_ERROR_CODE` (Task 2)
- Produces: `<OpenShiftScreen onOpened?: (shift: IWorkShift) => void />`

- [ ] **Step 1: Tạo component**

Create `src/components/work-shift/open-shift-screen.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Loader2, PlayCircle, Wallet } from 'lucide-react'

import { Button, Card, CardContent, Input } from '@/components/ui'
import { WORK_SHIFT_ERROR_CODE } from '@/constants'
import { useOpenWorkShift } from '@/hooks'
import { getApiErrorCode } from '@/lib/api-error'
import { useUserStore } from '@/stores'
import type { IWorkShift } from '@/types'
import {
  formatCurrencyWithSymbol,
  showErrorToast,
  showErrorToastMessage,
  showToast,
} from '@/utils'

interface Props {
  onOpened?: (shift: IWorkShift) => void
}

/** Màn hình mở ca cho CASHIER. openingCash bắt buộc, >= 0. */
export function OpenShiftScreen({ onOpened }: Props) {
  const { t } = useTranslation('workShift')
  const [cash, setCash] = useState<string>('')
  const { mutate: openShift, isPending } = useOpenWorkShift()
  const userInfo = useUserStore((s) => s.getUserInfo())
  const fullName =
    `${userInfo?.firstName ?? ''} ${userInfo?.lastName ?? ''}`.trim()

  const handleSubmit = () => {
    // openingCash bắt buộc — chuỗi rỗng không hợp lệ (khác model staff-shift cũ).
    if (cash.trim() === '') {
      showErrorToastMessage('workShift.validation.openingCashInvalid')
      return
    }
    const openingCash = Number(cash)
    if (!Number.isInteger(openingCash) || openingCash < 0) {
      showErrorToastMessage('workShift.validation.openingCashInvalid')
      return
    }

    openShift(
      { openingCash },
      {
        onSuccess: (response) => {
          const shift = response.result
          showToast('workShift.openSuccess')
          if (shift.preShiftOrdersLinked > 0) {
            showToast(
              t('preShiftLinked', { count: shift.preShiftOrdersLinked }),
            )
          }
          onOpened?.(shift)
        },
        onError: (error: unknown) => {
          const code = getApiErrorCode(error)
          if (code === WORK_SHIFT_ERROR_CODE.BRANCH_HAS_ACTIVE) {
            showErrorToast(code)
            return
          }
          showErrorToastMessage('toast.requestFailed')
        },
      },
    )
  }

  return (
    <div className="flex h-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardContent className="space-y-5 p-6">
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pos-gold/10">
                <Clock className="h-6 w-6 text-pos-gold" />
              </div>
            </div>
            <h2 className="text-2xl font-bold leading-tight">
              {t('openShiftTitle')}
            </h2>
            {fullName && (
              <p className="mt-1 text-sm text-muted-foreground">{fullName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="opening-cash"
              className="mb-2 block text-sm font-medium"
            >
              {t('openingCash')}
            </label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="opening-cash"
                type="text"
                inputMode="numeric"
                value={cash ? formatCurrencyWithSymbol(Number(cash), false) : ''}
                onChange={(e) => setCash(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                disabled={isPending}
                className="pl-9 pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                đ
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('openingCashHint')}
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isPending}
            size="lg"
            className="w-full text-base font-semibold"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-5 w-5" />
            )}
            {isPending ? t('opening') : t('openShiftCta')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/work-shift/open-shift-screen.tsx
git commit -m "feat(work-shift): add cashier OpenShiftScreen"
```

---

### Task 11: Cashier — CloseShiftDialog

**Files:**
- Create: `src/components/work-shift/close-shift-dialog.tsx`

**Interfaces:**
- Consumes: `useCloseWorkShift`, `useCurrentWorkShiftSummary` (Task 5); `ShiftSummaryPanel` (Task 9); `computeCashDifference` (Task 3)
- Produces: `<CloseShiftDialog open onOpenChange onClosed?: (summary: IWorkShiftSummary) => void />`

- [ ] **Step 1: Tạo component**

Create `src/components/work-shift/close-shift-dialog.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@/components/ui'
import { useCloseWorkShift, useCurrentWorkShiftSummary } from '@/hooks'
import { computeCashDifference } from '@/lib/work-shift-helpers'
import type { IWorkShiftSummary } from '@/types'
import {
  formatCurrencyWithSymbol,
  showErrorToastMessage,
  showToast,
} from '@/utils'

import { ShiftSummaryPanel } from './shift-summary-panel'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClosed?: (summary: IWorkShiftSummary) => void
}

/**
 * Dialog đóng ca. Hiển thị tổng kết ca đang mở (từ /current/summary) và
 * preview chênh lệch tiền mặt tính tại client trước khi submit.
 */
export function CloseShiftDialog({ open, onOpenChange, onClosed }: Props) {
  const { t } = useTranslation('workShift')
  const [cash, setCash] = useState<string>('')
  const [note, setNote] = useState<string>('')

  const { data: summary, isLoading } = useCurrentWorkShiftSummary(open)
  const { mutate: closeShift, isPending } = useCloseWorkShift()

  const closingCash = cash.trim() === '' ? null : Number(cash)
  const previewDifference =
    summary && closingCash !== null
      ? computeCashDifference({
          openingCash: summary.openingCash,
          closingCash,
          cashRevenue: summary.cashRevenue,
        })
      : null

  const handleSubmit = () => {
    if (closingCash !== null && (!Number.isInteger(closingCash) || closingCash < 0)) {
      showErrorToastMessage('workShift.validation.closingCashInvalid')
      return
    }

    closeShift(
      {
        closingCash: closingCash ?? undefined,
        note: note.trim() === '' ? undefined : note.trim(),
      },
      {
        onSuccess: (response) => {
          showToast('workShift.closeSuccess')
          setCash('')
          setNote('')
          onOpenChange(false)
          onClosed?.(response.result)
        },
        onError: () => {
          showErrorToastMessage('toast.requestFailed')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('closeShiftTitle')}</DialogTitle>
          <DialogDescription>{t('tabSummary')}</DialogDescription>
        </DialogHeader>

        {isLoading && !summary ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : summary ? (
          <ShiftSummaryPanel summary={summary} />
        ) : null}

        <div className="space-y-3 border-t pt-4">
          <div>
            <label
              htmlFor="closing-cash"
              className="mb-2 block text-sm font-medium"
            >
              {t('closingCash')}
            </label>
            <Input
              id="closing-cash"
              type="text"
              inputMode="numeric"
              value={cash ? formatCurrencyWithSymbol(Number(cash), false) : ''}
              onChange={(e) => setCash(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              disabled={isPending}
            />
            {previewDifference !== null && (
              <p
                data-testid="close-preview-difference"
                className="mt-2 text-xs text-muted-foreground"
              >
                {t('cashDifference')}:{' '}
                <span className="font-semibold">
                  {formatCurrencyWithSymbol(previewDifference)}
                </span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="close-note" className="mb-2 block text-sm font-medium">
              {t('note')}
            </label>
            <Textarea
              id="close-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('notePlaceholder')}
              maxLength={500}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('cancel', { ns: 'common', defaultValue: 'Huỷ' })}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? t('closing') : t('closeShift')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Xác nhận `Textarea` được export từ `@/components/ui`**

Run: `grep -rn "textarea" src/components/ui/index.tsx`
Nếu không có, dùng `<textarea>` HTML thuần với `className="w-full rounded-md border bg-background px-3 py-2 text-sm"` thay cho `<Textarea>`.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/work-shift/close-shift-dialog.tsx
git commit -m "feat(work-shift): add CloseShiftDialog with summary and cash preview"
```

---

### Task 12: Cashier — CurrentShiftIndicator (AppHeader của SystemLayout)

**Files:**
- Create: `src/components/work-shift/current-shift-indicator.tsx`
- Modify: `src/app/layouts/system/components/app-header.tsx` (gắn indicator)
- Modify: `src/app/staff/layout.tsx` (gắn indicator vào header POS, gỡ `StaffShiftGate`)

**Vì sao gắn ở cả hai header:** CASHIER hoạt động trong **cả hai layout**. [staff/layout.tsx:22-29](../../../src/app/staff/layout.tsx) chỉ chặn ADMIN/SUPER_ADMIN, và `/staff/table/:id/payment` có `Role.CASHIER` trong `allowedRoles` ([index.tsx:1634-1644](../../../src/router/index.tsx)). Nếu chỉ gắn ở `AppHeader`, chỉ báo sẽ biến mất đúng lúc cashier đang ở màn thu tiền POS — chỗ họ cần biết trạng thái ca nhất. Component tự trả `null` khi role khác CASHIER nên STAFF không thấy gì.

**Interfaces:**
- Consumes: `useCurrentWorkShift` (Task 5), `CloseShiftDialog` (Task 11), `computeShiftDurationMinutes` / `formatShiftDuration` / `isLongShift` (Task 3)
- Produces: `<CurrentShiftIndicator onShiftClosed?: () => void />`

- [ ] **Step 1: Tạo component**

Create `src/components/work-shift/current-shift-indicator.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock } from 'lucide-react'

import { Button } from '@/components/ui'
import { Role } from '@/constants'
import { useCurrentWorkShift } from '@/hooks'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
  isLongShift,
} from '@/lib/work-shift-helpers'
import { useUserStore } from '@/stores'
import { formatCurrencyWithSymbol } from '@/utils'

import { CloseShiftDialog } from './close-shift-dialog'

interface Props {
  onShiftClosed?: () => void
}

/**
 * Chỉ báo ca hiện tại trong AppHeader của SystemLayout. Chỉ hiển thị cho CASHIER.
 * Tự tick mỗi 60s vì BE không trả durationMinutes.
 */
export function CurrentShiftIndicator({ onShiftClosed }: Props) {
  const { t } = useTranslation('workShift')
  const [closeOpen, setCloseOpen] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const role = useUserStore((s) => s.getUserInfo())?.role?.name
  const isCashier = role === Role.CASHIER
  const { data: shift } = useCurrentWorkShift(isCashier)

  useEffect(() => {
    if (!shift) return
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [shift])

  if (!isCashier || !shift) return null

  const minutes = computeShiftDurationMinutes(shift.actualStartTime, nowMs)
  const isLong = isLongShift(minutes)

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-pos-border bg-pos-surface px-2.5 py-1 text-xs">
          {isLong ? (
            <AlertTriangle
              className="h-3.5 w-3.5 text-amber-500"
              aria-label={t('longShiftWarning')}
            />
          ) : (
            <Clock className="h-3.5 w-3.5 text-pos-gold" />
          )}
          <span className="font-medium">{formatShiftDuration(minutes)}</span>
          <span className="text-pos-muted">·</span>
          <span className="font-semibold text-pos-gold">
            {formatCurrencyWithSymbol(shift.totalRevenue)}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
          {t('closeShift')}
        </Button>
      </div>

      <CloseShiftDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        onClosed={() => onShiftClosed?.()}
      />
    </>
  )
}
```

- [ ] **Step 2: Gắn indicator vào AppHeader của SystemLayout**

Trong `src/app/layouts/system/components/app-header.tsx`, thêm import:

```tsx
import { CurrentShiftIndicator } from '@/components/work-shift/current-shift-indicator'
```

Rồi chèn indicator vào đầu cụm control bên phải, ngay **trước** `<SystemNotificationPopover />`:

```tsx
        <div className="flex items-center gap-2">
          {/* Ca làm việc — chỉ render khi user là CASHIER và đang có ca ACTIVE */}
          <CurrentShiftIndicator />

          {/* Notifications */}
          <SystemNotificationPopover />
```

Component tự trả `null` khi role khác CASHIER hoặc chưa có ca, nên không cần điều kiện ở đây và không ảnh hưởng header của ADMIN/MANAGER.

- [ ] **Step 3: Cập nhật staff layout — giữ indicator, bỏ gate**

Trong `src/app/staff/layout.tsx`, thay hai dòng import (dòng 10-11) bằng một dòng:

```tsx
import { CurrentShiftIndicator } from '@/components/work-shift/current-shift-indicator'
```

Sửa `handleShiftClosed` (dòng 31-36) — route cũ `STAFF_MY_SHIFTS_HISTORY` bị xoá ở Task 18:

```tsx
  const handleShiftClosed = () => {
    // Đóng ca xong thì rời POS về trang ca ở SystemLayout — nơi cashier
    // xem tổng kết hoặc mở ca mới.
    navigate(ROUTE.SYSTEM_WORK_SHIFTS)
  }
```

Giữ nguyên `<CurrentShiftIndicator onShiftClosed={handleShiftClosed} />` ở dòng 54.

Bỏ `<StaffShiftGate>` wrapper (dòng 60-62), giữ nguyên `<Outlet />`:

```tsx
      <div className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
```

Gate bị xoá hẳn, không thay bằng gì: ở mô hình mới **staff không có ca** — họ tạo order tự do, chỉ bị chặn ở bước thanh toán (Task 8).

`ROUTE.SYSTEM_WORK_SHIFTS` được thêm ở Task 16 — nếu chạy Task 12 trước, tạm dùng `ROUTE.OVERVIEW` rồi sửa lại ở Task 16.

- [ ] **Step 4: Dọn comment lỗi thời trong SystemLayout**

Trong `src/app/layouts/system/SystemLayout.tsx:29`, xoá dòng comment:

```tsx
      // TEMP DISABLED — shift feature paused, restore STAFF_POS_MY_SHIFT once shifts re-enabled
```

Giữ nguyên `navigate(ROUTE.STAFF_POS_FLOOR_PLAN, { replace: true })` bên dưới — ở mô hình mới, đá STAFF về floor-plan là hành vi đúng vĩnh viễn chứ không còn là trạng thái tạm.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: PASS. `grep -rn "StaffShiftGate" src` → chỉ còn chính file `staff-shift-gate.tsx` (xoá ở Task 18).

- [ ] **Step 6: Commit**

```bash
git add src/components/work-shift/current-shift-indicator.tsx src/app/layouts/system/components/app-header.tsx src/app/layouts/system/SystemLayout.tsx src/app/staff/layout.tsx
git commit -m "feat(work-shift): mount shift indicator in AppHeader, strip shift logic from staff layout"
```

---

### Task 13: Lists — orders (badge xuyên ca), invoices, staff

**Files:**
- Create: `src/components/work-shift/shift-orders-list.tsx`
- Create: `src/components/work-shift/shift-invoices-list.tsx`
- Create: `src/components/work-shift/shift-staff-list.tsx`
- Test: `src/tests/components/shift-orders-list.test.tsx`

**Interfaces:**
- Consumes: `IOrder` (đã có `workShift` từ Task 1), `IWorkShiftInvoice`, `IWorkShiftStaffSummaryItem`, `isCrossShiftOrder` (Task 3)
- Produces:
  - `<ShiftOrdersList orders={IOrder[]} currentShiftSlug={string} isLoading?: boolean />`
  - `<ShiftInvoicesList invoices={IWorkShiftInvoice[]} isLoading?: boolean />`
  - `<ShiftStaffList staff={IWorkShiftStaffSummaryItem[]} isLoading?: boolean />`

- [ ] **Step 1: Viết test thất bại cho badge xuyên ca**

Create `src/tests/components/shift-orders-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { ShiftOrdersList } from '@/components/work-shift/shift-orders-list'
import { WorkShiftStatus, type IOrder } from '@/types'

function makeOrder(slug: string, shiftSlug: string | null): IOrder {
  return {
    slug,
    createdAt: '2026-06-29T09:30:00.000Z',
    referenceNumber: 1001,
    status: 'pending',
    subtotal: 150_000,
    workShift: shiftSlug
      ? { slug: shiftSlug, status: WorkShiftStatus.ACTIVE }
      : null,
  } as unknown as IOrder
}

describe('ShiftOrdersList', () => {
  it('marks orders belonging to another shift as cross-shift', () => {
    render(
      <ShiftOrdersList
        orders={[makeOrder('o-1', 'ws-a')]}
        currentShiftSlug="ws-b"
      />,
    )
    expect(screen.getByTestId('cross-shift-badge-o-1')).toBeInTheDocument()
  })

  it('does not mark orders belonging to the current shift', () => {
    render(
      <ShiftOrdersList
        orders={[makeOrder('o-2', 'ws-b')]}
        currentShiftSlug="ws-b"
      />,
    )
    expect(screen.queryByTestId('cross-shift-badge-o-2')).not.toBeInTheDocument()
  })

  it('does not mark orders with no shift assigned', () => {
    render(
      <ShiftOrdersList
        orders={[makeOrder('o-3', null)]}
        currentShiftSlug="ws-b"
      />,
    )
    expect(screen.queryByTestId('cross-shift-badge-o-3')).not.toBeInTheDocument()
  })

  it('renders an empty state when there are no orders', () => {
    render(<ShiftOrdersList orders={[]} currentShiftSlug="ws-b" />)
    expect(screen.getByTestId('shift-orders-empty')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run src/tests/components/shift-orders-list.test.tsx`
Expected: FAIL — không resolve được `@/components/work-shift/shift-orders-list`.

- [ ] **Step 3: Cài đặt ShiftOrdersList**

Create `src/components/work-shift/shift-orders-list.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { isCrossShiftOrder } from '@/lib/work-shift-helpers'
import type { IOrder } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

interface Props {
  orders: IOrder[]
  /** Slug của ca đang xem — dùng để phát hiện đơn xuyên ca. */
  currentShiftSlug: string
  isLoading?: boolean
}

function formatHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Danh sách đơn của một ca, đánh dấu đơn xuyên ca (spec §4 Luồng C). */
export function ShiftOrdersList({ orders, currentShiftSlug, isLoading }: Props) {
  const { t } = useTranslation('workShift')

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div
        data-testid="shift-orders-empty"
        className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {t('emptyOrders')}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {orders.map((order) => {
        const isCross = isCrossShiftOrder(
          order.workShift?.slug,
          currentShiftSlug,
        )
        return (
          <div
            key={order.slug}
            className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">#{order.referenceNumber}</span>
                {isCross && (
                  <span
                    data-testid={`cross-shift-badge-${order.slug}`}
                    className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                  >
                    {t('crossShiftBadge')}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatHHMM(order.createdAt)} · {order.status}
              </div>
            </div>
            <span className="font-medium">
              {formatCurrencyWithSymbol(order.subtotal)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/components/shift-orders-list.test.tsx`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Cài đặt ShiftInvoicesList**

Create `src/components/work-shift/shift-invoices-list.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import type { IWorkShiftInvoice } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

interface Props {
  invoices: IWorkShiftInvoice[]
  isLoading?: boolean
}

function formatHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Hoá đơn đã thanh toán trong ca (theo invoice.workShift). */
export function ShiftInvoicesList({ invoices, isLoading }: Props) {
  const { t } = useTranslation('workShift')

  if (isLoading && invoices.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div
        data-testid="shift-invoices-empty"
        className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {t('emptyInvoices')}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {invoices.map((invoice) => (
        <div
          key={invoice.slug}
          className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="font-semibold">#{invoice.referenceNumber}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatHHMM(invoice.createdAt)} · {invoice.paymentMethod} ·{' '}
              {invoice.cashier}
            </div>
          </div>
          <span className="font-medium">
            {formatCurrencyWithSymbol(invoice.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Cài đặt ShiftStaffList**

Create `src/components/work-shift/shift-staff-list.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import type { IWorkShiftStaffSummaryItem } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

interface Props {
  staff: IWorkShiftStaffSummaryItem[]
  isLoading?: boolean
}

/** Nhân viên đã tạo order trong ca, kèm số đơn và doanh thu. */
export function ShiftStaffList({ staff, isLoading }: Props) {
  const { t } = useTranslation('workShift')

  if (isLoading && staff.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (staff.length === 0) {
    return (
      <div
        data-testid="shift-staff-empty"
        className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {t('emptyStaff')}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {staff.map((row) => (
        <div
          key={row.staff.slug}
          className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="font-semibold">
              {row.staff.firstName} {row.staff.lastName}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {row.staff.phonenumber} · {row.totalOrdersCreated}{' '}
              {t('ordersCreated').toLowerCase()}
            </div>
          </div>
          <span className="font-medium">
            {formatCurrencyWithSymbol(row.totalOrdersRevenue)}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Lint + commit**

```bash
npm run lint
git add src/components/work-shift/shift-orders-list.tsx src/components/work-shift/shift-invoices-list.tsx src/components/work-shift/shift-staff-list.tsx src/tests/components/shift-orders-list.test.tsx
git commit -m "feat(work-shift): add orders/invoices/staff list components with cross-shift badge"
```

---

### Task 14: Cashier view — MyShiftTab (trong SystemLayout)

**Files:**
- Create: `src/app/system/work-shifts/components/my-shift-tab.tsx`

**Interfaces:**
- Consumes: `OpenShiftScreen` (Task 10), `ShiftOrdersList` / `ShiftInvoicesList` / `ShiftStaffList` (Task 13), `ShiftSummaryPanel` (Task 9), hooks `useCurrentWorkShift*` (Task 5)
- Produces: `<MyShiftTab />` — không nhận prop, tự đọc ca hiện tại của cashier đang đăng nhập

**Quyết định IA (đã chốt):** thu ngân và quản lý **dùng chung một route** `/system/work-shifts` dưới `SystemLayout`, một mục sidebar duy nhất. Trang gốc (Task 16) phân nhánh theo role: CASHIER thấy `MyShiftTab`, MANAGER+ thấy `ActiveTab` / `HistoryTab`. **Không** tạo route nào dưới `/staff/*` — staff không có ca.

- [ ] **Step 1: Tạo component**

Create `src/app/system/work-shifts/components/my-shift-tab.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { OpenShiftScreen } from '@/components/work-shift/open-shift-screen'
import { ShiftInvoicesList } from '@/components/work-shift/shift-invoices-list'
import { ShiftOrdersList } from '@/components/work-shift/shift-orders-list'
import { ShiftStaffList } from '@/components/work-shift/shift-staff-list'
import { ShiftSummaryPanel } from '@/components/work-shift/shift-summary-panel'
import {
  useCurrentWorkShift,
  useCurrentWorkShiftInvoices,
  useCurrentWorkShiftOrders,
  useCurrentWorkShiftStaff,
  useCurrentWorkShiftSummary,
} from '@/hooks'

/**
 * Khung ca làm việc của CASHIER đang đăng nhập.
 * Chưa có ca → OpenShiftScreen. Có ca → 4 tab: đơn / hoá đơn / nhân viên / tổng kết.
 * Render bên trong SystemLayout (đã có sidebar + AppHeader + breadcrumb).
 */
export function MyShiftTab() {
  const { t } = useTranslation('workShift')

  const { data: shift, isLoading: isLoadingShift } = useCurrentWorkShift()
  const hasShift = !!shift

  const { data: orders, isLoading: isLoadingOrders } =
    useCurrentWorkShiftOrders(hasShift)
  const { data: invoices, isLoading: isLoadingInvoices } =
    useCurrentWorkShiftInvoices(hasShift)
  const { data: staff, isLoading: isLoadingStaff } =
    useCurrentWorkShiftStaff(hasShift)
  const { data: summary } = useCurrentWorkShiftSummary(hasShift)

  if (isLoadingShift && !shift) return null
  if (!shift) return <OpenShiftScreen />

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{t('currentShift')}</h2>
        <p className="text-sm text-muted-foreground">
          {shift.branch.name} · {shift.cashier.firstName}{' '}
          {shift.cashier.lastName}
        </p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t('tabOrders')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('tabInvoices')}</TabsTrigger>
          <TabsTrigger value="staff">{t('tabStaff')}</TabsTrigger>
          <TabsTrigger value="summary">{t('tabSummary')}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-3">
          <ShiftOrdersList
            orders={orders ?? []}
            currentShiftSlug={shift.slug}
            isLoading={isLoadingOrders}
          />
        </TabsContent>
        <TabsContent value="invoices" className="mt-3">
          <ShiftInvoicesList
            invoices={invoices ?? []}
            isLoading={isLoadingInvoices}
          />
        </TabsContent>
        <TabsContent value="staff" className="mt-3">
          <ShiftStaffList staff={staff ?? []} isLoading={isLoadingStaff} />
        </TabsContent>
        <TabsContent value="summary" className="mt-3">
          {summary ? <ShiftSummaryPanel summary={summary} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Xác nhận Tabs được export từ `@/components/ui`**

Run: `grep -n "tabs" src/components/ui/index.tsx`
Expected: có dòng export tabs. Nếu không, import trực tiếp từ `@/components/ui/tabs`.

- [ ] **Step 3: Typecheck + lint + commit**

```bash
npx tsc -b --noEmit && npm run lint
git add src/app/system/work-shifts/components/my-shift-tab.tsx
git commit -m "feat(work-shift): add cashier MyShiftTab view"
```

---

### Task 15: Manager/Admin — ForceCloseDialog

**Files:**
- Create: `src/components/work-shift/force-close-dialog.tsx`
- Test: `src/tests/components/force-close-dialog.test.tsx`

**Interfaces:**
- Consumes: `useForceCloseWorkShift` (Task 5), `forceCloseWorkShiftSchema` (Task 6)
- Produces: `<ForceCloseDialog shiftSlug open onOpenChange onForceClosed?: (summary: IWorkShiftSummary) => void />`

- [ ] **Step 1: Viết test thất bại**

Create `src/tests/components/force-close-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockMutate = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks', () => ({
  useForceCloseWorkShift: () => ({ mutate: mockMutate, isPending: false }),
}))

import { ForceCloseDialog } from '@/components/work-shift/force-close-dialog'

beforeEach(() => {
  mockMutate.mockClear()
})

describe('ForceCloseDialog', () => {
  it('disables submit while the reason is empty', () => {
    render(
      <ForceCloseDialog shiftSlug="ws-1" open onOpenChange={() => {}} />,
    )
    expect(screen.getByTestId('force-close-submit')).toBeDisabled()
  })

  it('disables submit when the reason is only whitespace', async () => {
    const user = userEvent.setup()
    render(
      <ForceCloseDialog shiftSlug="ws-1" open onOpenChange={() => {}} />,
    )
    await user.type(screen.getByTestId('force-close-note'), '   ')
    expect(screen.getByTestId('force-close-submit')).toBeDisabled()
  })

  it('submits the trimmed reason with the shift slug', async () => {
    const user = userEvent.setup()
    render(
      <ForceCloseDialog shiftSlug="ws-1" open onOpenChange={() => {}} />,
    )
    await user.type(screen.getByTestId('force-close-note'), '  quen dong ca  ')
    await user.click(screen.getByTestId('force-close-submit'))
    expect(mockMutate).toHaveBeenCalledWith(
      { slug: 'ws-1', data: { note: 'quen dong ca' } },
      expect.anything(),
    )
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run src/tests/components/force-close-dialog.test.tsx`
Expected: FAIL — không resolve được `@/components/work-shift/force-close-dialog`.

- [ ] **Step 3: Cài đặt component**

Create `src/components/work-shift/force-close-dialog.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { useForceCloseWorkShift } from '@/hooks'
import type { IWorkShiftSummary } from '@/types'
import { showErrorToastMessage, showToast } from '@/utils'

interface Props {
  shiftSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onForceClosed?: (summary: IWorkShiftSummary) => void
}

/** Đóng ép ca — dành cho MANAGER/ADMIN. `note` bắt buộc (spec §5.15). */
export function ForceCloseDialog({
  shiftSlug,
  open,
  onOpenChange,
  onForceClosed,
}: Props) {
  const { t } = useTranslation('workShift')
  const [note, setNote] = useState('')
  const { mutate: forceClose, isPending } = useForceCloseWorkShift()

  const trimmedNote = note.trim()
  const canSubmit = trimmedNote.length > 0 && !isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    forceClose(
      { slug: shiftSlug, data: { note: trimmedNote } },
      {
        onSuccess: (response) => {
          showToast('workShift.forceCloseSuccess')
          setNote('')
          onOpenChange(false)
          onForceClosed?.(response.result)
        },
        onError: () => {
          showErrorToastMessage('toast.requestFailed')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('forceCloseTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{t('forceCloseWarning')}</span>
        </div>

        <div>
          <label
            htmlFor="force-close-note"
            className="mb-2 block text-sm font-medium"
          >
            {t('forceCloseNote')}
          </label>
          <textarea
            id="force-close-note"
            data-testid="force-close-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('forceCloseNotePlaceholder')}
            maxLength={500}
            disabled={isPending}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('cancel', { ns: 'common', defaultValue: 'Huỷ' })}
          </Button>
          <Button
            data-testid="force-close-submit"
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('forceClose')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run src/tests/components/force-close-dialog.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/work-shift/force-close-dialog.tsx src/tests/components/force-close-dialog.test.tsx
git commit -m "feat(work-shift): add manager force-close dialog"
```

---

### Task 16: Trang `/system/work-shifts` (phân nhánh theo role) + chi tiết ca

**Files:**
- Create: `src/app/system/work-shifts/page.tsx`
- Create: `src/app/system/work-shifts/components/active-tab.tsx`
- Create: `src/app/system/work-shifts/components/history-tab.tsx`
- Create: `src/app/system/work-shifts/[slug]/page.tsx`
- Modify: `src/constants/route.ts`

**Interfaces:**
- Consumes: `MyShiftTab` (Task 14); `useActiveWorkShifts`, `useWorkShifts`, `useWorkShiftBySlug`, `useWorkShiftOrders`, `useWorkShiftInvoices`, `useWorkShiftStaff`, `useWorkShiftSummary` (Task 5); `ForceCloseDialog` (Task 15); list components (Task 13); `ShiftSummaryPanel` (Task 9)
- Produces: default exports `SystemWorkShiftsPage`, `SystemWorkShiftDetailPage`; route constants `SYSTEM_WORK_SHIFTS`, `SYSTEM_WORK_SHIFT_DETAIL`

- [ ] **Step 1: Thêm route constants**

Trong `src/constants/route.ts`, thêm ngay sau dòng `SYSTEM_STAFF_SHIFT_DETAIL: '/system/staff-shifts/:slug',`:

```ts
  SYSTEM_WORK_SHIFTS: '/system/work-shifts',
  SYSTEM_WORK_SHIFT_DETAIL: '/system/work-shifts/:slug',
```

- [ ] **Step 2: Tạo tab ca đang mở**

Create `src/app/system/work-shifts/components/active-tab.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'
import { ForceCloseDialog } from '@/components/work-shift/force-close-dialog'
import { useActiveWorkShifts } from '@/hooks'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
  isLongShift,
} from '@/lib/work-shift-helpers'
import { formatCurrencyWithSymbol } from '@/utils'

interface Props {
  /** Chỉ ADMIN/SUPER_ADMIN truyền; MANAGER được BE tự lọc theo branch. */
  branchSlug?: string
}

export function ActiveTab({ branchSlug }: Props) {
  const { t } = useTranslation('workShift')
  const [forceCloseSlug, setForceCloseSlug] = useState<string | null>(null)
  const { data: shifts, isLoading } = useActiveWorkShifts(branchSlug)

  if (isLoading && !shifts) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!shifts || shifts.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {t('noActiveShift')}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {shifts.map((shift) => {
          const minutes = computeShiftDurationMinutes(shift.actualStartTime)
          return (
            <div
              key={shift.slug}
              className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {shift.cashier.firstName} {shift.cashier.lastName}
                  {isLongShift(minutes) && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                      {t('longShiftWarning')}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {shift.branch.name} · {formatShiftDuration(minutes)} ·{' '}
                  {shift.totalOrders} {t('totalOrders').toLowerCase()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-pos-gold">
                  {formatCurrencyWithSymbol(shift.totalRevenue)}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={ROUTE.SYSTEM_WORK_SHIFT_DETAIL.replace(
                      ':slug',
                      shift.slug,
                    )}
                  >
                    {t('shiftDetail')}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setForceCloseSlug(shift.slug)}
                >
                  {t('forceClose')}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {forceCloseSlug && (
        <ForceCloseDialog
          shiftSlug={forceCloseSlug}
          open={!!forceCloseSlug}
          onOpenChange={(open) => !open && setForceCloseSlug(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Tạo tab lịch sử**

Create `src/app/system/work-shifts/components/history-tab.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { Button, Input } from '@/components/ui'
import { Role, ROUTE } from '@/constants'
import { useWorkShifts } from '@/hooks'
import {
  computeShiftDurationMinutes,
  formatShiftDuration,
} from '@/lib/work-shift-helpers'
import { useUserStore } from '@/stores'
import { WorkShiftStatus } from '@/types'
import { formatCurrencyWithSymbol } from '@/utils'

const PAGE_SIZE = 10

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function HistoryTab() {
  const { t } = useTranslation('workShift')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<WorkShiftStatus | undefined>(undefined)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cashierSlug, setCashierSlug] = useState('')
  const [branchSlug, setBranchSlug] = useState('')

  const role = useUserStore((s) => s.getUserInfo())?.role?.name
  // MANAGER được BE tự lọc theo branch của mình — chỉ ADMIN+ mới lọc branch thủ công.
  const canFilterBranch = role === Role.ADMIN || role === Role.SUPER_ADMIN

  const { data, isLoading } = useWorkShifts({
    page,
    size: PAGE_SIZE,
    status,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    cashierSlug: cashierSlug.trim() || undefined,
    branchSlug: canFilterBranch ? branchSlug.trim() || undefined : undefined,
  })

  const shifts = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  /** Mọi thay đổi filter phải reset về trang 1, nếu không sẽ hiện trang rỗng. */
  const applyFilter = (fn: () => void) => {
    fn()
    setPage(1)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={status === undefined ? 'default' : 'outline'}
          onClick={() => applyFilter(() => setStatus(undefined))}
        >
          {t('filterStatus')}
        </Button>
        <Button
          size="sm"
          variant={status === WorkShiftStatus.ACTIVE ? 'default' : 'outline'}
          onClick={() => applyFilter(() => setStatus(WorkShiftStatus.ACTIVE))}
        >
          {t('statusActive')}
        </Button>
        <Button
          size="sm"
          variant={status === WorkShiftStatus.CLOSED ? 'default' : 'outline'}
          onClick={() => applyFilter(() => setStatus(WorkShiftStatus.CLOSED))}
        >
          {t('statusClosed')}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label
            htmlFor="filter-start-date"
            className="mb-1 block text-xs text-muted-foreground"
          >
            {t('filterDateRange')}
          </label>
          <Input
            id="filter-start-date"
            type="date"
            value={startDate}
            onChange={(e) => applyFilter(() => setStartDate(e.target.value))}
            className="w-40"
          />
        </div>
        <Input
          aria-label={t('filterDateRange')}
          type="date"
          value={endDate}
          onChange={(e) => applyFilter(() => setEndDate(e.target.value))}
          className="w-40"
        />
        <Input
          aria-label={t('filterCashier')}
          placeholder={t('filterCashier')}
          value={cashierSlug}
          onChange={(e) => applyFilter(() => setCashierSlug(e.target.value))}
          className="w-48"
        />
        {canFilterBranch && (
          <Input
            aria-label={t('filterBranch')}
            placeholder={t('filterBranch')}
            value={branchSlug}
            onChange={(e) => applyFilter(() => setBranchSlug(e.target.value))}
            className="w-48"
          />
        )}
      </div>

      {isLoading && shifts.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t('emptyHistory')}
        </div>
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => {
            const endMs = shift.actualEndTime
              ? new Date(shift.actualEndTime).getTime()
              : undefined
            const minutes = computeShiftDurationMinutes(
              shift.actualStartTime,
              endMs,
            )
            return (
              <Link
                key={shift.slug}
                to={ROUTE.SYSTEM_WORK_SHIFT_DETAIL.replace(':slug', shift.slug)}
                className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {shift.cashier.firstName} {shift.cashier.lastName}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(shift.actualStartTime)} →{' '}
                    {formatDateTime(shift.actualEndTime)} ·{' '}
                    {formatShiftDuration(minutes)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-pos-gold">
                    {formatCurrencyWithSymbol(shift.totalRevenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {shift.totalOrders} {t('totalOrders').toLowerCase()}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Tạo page gốc, phân nhánh theo role**

Create `src/app/system/work-shifts/page.tsx`:

```tsx
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { Role } from '@/constants'
import { useUserStore } from '@/stores'

import { ActiveTab } from './components/active-tab'
import { HistoryTab } from './components/history-tab'
import { MyShiftTab } from './components/my-shift-tab'

/**
 * Một route duy nhất cho cả hai vai trò, một mục sidebar duy nhất.
 *
 * CASHIER  → ca của chính mình (mở ca / 4 tab theo dõi).
 * MANAGER+ → giám sát: danh sách ca ACTIVE + lịch sử ca.
 *
 * Không gộp thành 3 tab cho cashier: theo spec §3, CASHIER không có quyền
 * gọi GET /work-shifts/active — tab đó sẽ luôn 403.
 */
export default function SystemWorkShiftsPage() {
  const { t } = useTranslation('workShift')
  const role = useUserStore((s) => s.getUserInfo())?.role?.name

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">{t('title')}</h1>

      {role === Role.CASHIER ? (
        <MyShiftTab />
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">{t('tabActive')}</TabsTrigger>
            <TabsTrigger value="history">{t('tabHistory')}</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-3">
            <ActiveTab />
          </TabsContent>
          <TabsContent value="history" className="mt-3">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
```

`SystemLayout` đã cấp padding ngang cho `<main>`, nên page chỉ đặt padding dọc — không dùng `p-4` để tránh cộng dồn.

- [ ] **Step 5: Tạo page chi tiết**

Create `src/app/system/work-shifts/[slug]/page.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { ShiftInvoicesList } from '@/components/work-shift/shift-invoices-list'
import { ShiftOrdersList } from '@/components/work-shift/shift-orders-list'
import { ShiftStaffList } from '@/components/work-shift/shift-staff-list'
import { ShiftSummaryPanel } from '@/components/work-shift/shift-summary-panel'
import {
  useWorkShiftBySlug,
  useWorkShiftInvoices,
  useWorkShiftOrders,
  useWorkShiftStaff,
  useWorkShiftSummary,
} from '@/hooks'

export default function SystemWorkShiftDetailPage() {
  const { t } = useTranslation('workShift')
  const { slug } = useParams<{ slug: string }>()

  const { data: shift, isLoading } = useWorkShiftBySlug(slug)
  const { data: orders, isLoading: isLoadingOrders } = useWorkShiftOrders(slug)
  const { data: invoices, isLoading: isLoadingInvoices } =
    useWorkShiftInvoices(slug)
  const { data: staff, isLoading: isLoadingStaff } = useWorkShiftStaff(slug)
  const { data: summary } = useWorkShiftSummary(slug)

  if (isLoading && !shift) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!shift) return null

  return (
    <div className="space-y-4 py-2">
      <div>
        <h1 className="text-xl font-bold">{t('shiftDetail')}</h1>
        <p className="text-sm text-muted-foreground">
          {shift.cashier.firstName} {shift.cashier.lastName} ·{' '}
          {shift.branch.name}
        </p>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">{t('tabSummary')}</TabsTrigger>
          <TabsTrigger value="orders">{t('tabOrders')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('tabInvoices')}</TabsTrigger>
          <TabsTrigger value="staff">{t('tabStaff')}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-3">
          {summary ? <ShiftSummaryPanel summary={summary} /> : null}
        </TabsContent>
        <TabsContent value="orders" className="mt-3">
          <ShiftOrdersList
            orders={orders ?? []}
            currentShiftSlug={shift.slug}
            isLoading={isLoadingOrders}
          />
        </TabsContent>
        <TabsContent value="invoices" className="mt-3">
          <ShiftInvoicesList
            invoices={invoices ?? []}
            isLoading={isLoadingInvoices}
          />
        </TabsContent>
        <TabsContent value="staff" className="mt-3">
          <ShiftStaffList staff={staff ?? []} isLoading={isLoadingStaff} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck + lint + commit**

```bash
npx tsc -b --noEmit && npm run lint
git add src/app/system/work-shifts src/constants/route.ts
git commit -m "feat(work-shift): add manager work-shift list and detail pages"
```

---

### Task 17: Wiring — loadable, router, sidebar

**Files:**
- Modify: `src/router/loadable.tsx`
- Modify: `src/router/index.tsx`
- Modify: `src/router/routes.ts`

**Interfaces:**
- Consumes: pages từ Task 16; `ROUTE.SYSTEM_WORK_SHIFTS`, `ROUTE.SYSTEM_WORK_SHIFT_DETAIL`
- Produces: lazy components `SystemWorkShiftsPage`, `SystemWorkShiftDetailPage`

**Không đăng ký bất kỳ route ca nào dưới `/staff/*`.** `StaffPosLayout` là layout của nhân viên chạy bàn — staff không có ca. Thu ngân và quản lý đều ở `SystemLayout`.

- [ ] **Step 1: Thêm lazy imports**

Trong `src/router/loadable.tsx`, thêm (đặt cạnh các export page khác, không nằm trong khối comment):

```tsx
export const SystemWorkShiftsPage = React.lazy(() =>
  import('@/app/system/work-shifts/page').then((module) => ({
    default: module.default,
  })),
)

export const SystemWorkShiftDetailPage = React.lazy(() =>
  import('@/app/system/work-shifts/[slug]/page').then((module) => ({
    default: module.default,
  })),
)
```

- [ ] **Step 2: Đăng ký route system**

Trong `src/router/index.tsx`, thêm `SystemWorkShiftsPage` và `SystemWorkShiftDetailPage` vào danh sách import từ `./loadable`, rồi thêm hai khối route ở cùng cấp với các nhánh `/system/*` khác (thay chỗ khối comment `SYSTEM_STAFF_SHIFTS_HISTORY` cũ):

```tsx
      {
        path: ROUTE.SYSTEM_WORK_SHIFTS,
        element: (
          <Suspense fallback={<SkeletonCart />}>
            <SuspenseElement component={SystemLayout} />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <ProtectedElement
                allowedRoles={[
                  Role.CASHIER,
                  Role.MANAGER,
                  Role.ADMIN,
                  Role.SUPER_ADMIN,
                ]}
                element={<SuspenseElement component={SystemWorkShiftsPage} />}
              />
            ),
          },
        ],
      },
      {
        path: ROUTE.SYSTEM_WORK_SHIFT_DETAIL,
        element: (
          <Suspense fallback={<SkeletonCart />}>
            <SuspenseElement component={SystemLayout} />
          </Suspense>
        ),
        children: [
          {
            index: true,
            element: (
              <ProtectedElement
                allowedRoles={[
                  Role.CASHIER,
                  Role.MANAGER,
                  Role.ADMIN,
                  Role.SUPER_ADMIN,
                ]}
                element={
                  <SuspenseElement component={SystemWorkShiftDetailPage} />
                }
              />
            ),
          },
        ],
      },
```

`Role.CASHIER` nằm trong `allowedRoles` của cả hai route — trang gốc tự phân nhánh sang `MyShiftTab` (Task 16), còn trang chi tiết chỉ mở được ca của chính họ (BE trả `403 WORK_SHIFT_FORBIDDEN` nếu cố xem ca người khác — TC-011).

- [ ] **Step 3: Xoá khối route `/staff` cũ**

Trong `src/router/index.tsx`, xoá khối comment `TEMP DISABLED — shift feature paused` trong mảng `children` của `StaffPosLayout` (dòng ~1663-1679) — gồm `STAFF_POS_MY_SHIFT`, `STAFF_MY_SHIFTS_HISTORY`, `STAFF_MY_SHIFT_DETAIL` và `/staff/preview/shifts`. Không thay bằng gì cả.

- [ ] **Step 4: Thêm mục sidebar**

Trong `src/router/routes.ts`, thay khối comment `TEMP DISABLED — shift feature paused` (dòng 122-131) bằng:

```ts
  {
    // Role-gated (no scope permission): BE chưa cấp Permission.STAFF_SHIFT,
    // và CASHIER cần thấy mục này để mở/đóng ca của mình.
    title: 'sidebar.workShiftManagement',
    path: ROUTE.SYSTEM_WORK_SHIFTS,
    icon: ClipboardList,
    allowedRoles: [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.MANAGER,
      Role.CASHIER,
    ],
  },
```

Dùng `allowedRoles` chứ không phải `permission` — cùng pattern với mục `sidebar.tableBooking` ở [routes.ts:84-96](../../../src/router/routes.ts). Interface `IRoute` hỗ trợ cả hai (`src/types/route.type.ts:10,13`). Nếu dùng `Permission.ORDER_MANAGEMENT` thì CASHIER có thể không thấy mục này tuỳ scope BE cấp.

Xác nhận `ClipboardList` và `Role` vẫn nằm trong danh sách import ở đầu file.

- [ ] **Step 5: Kiểm tra thủ công trong trình duyệt**

Run: `npm run dev`

Kiểm tra:
- **CASHIER** → sidebar có mục "Quản lý ca làm việc" → `/system/work-shifts` hiện màn mở ca. Mở ca xong: `AppHeader` hiện chỉ báo thời lượng + doanh thu + nút "Đóng ca", và chỉ báo đó **theo sang mọi trang khác** (Đơn hàng, Bàn, …).
- **MANAGER** → cùng route, nhưng thấy 2 tab "Ca đang mở" / "Lịch sử ca"; header **không** có chỉ báo ca.
- **STAFF** → vào thẳng `/system/work-shifts` phải bị `SystemLayout` đá về `/staff/floor-plan`; header POS không còn chỉ báo ca nào.
- Click một ca → `/system/work-shifts/<slug>` hiển thị 4 tab.

- [ ] **Step 6: Build + commit**

```bash
npm run build
git add src/router/loadable.tsx src/router/index.tsx src/router/routes.ts
git commit -m "feat(work-shift): wire routes, lazy imports and sidebar entry"
```

---

### Task 18: Xoá code staff-shift cũ

**Files:**
- Delete: `src/api/staff-shift.ts`, `src/types/staff-shift.type.ts`, `src/hooks/use-staff-shift.ts`, `src/lib/staff-shift-helpers.ts`, `src/lib/__tests__/staff-shift-helpers.test.ts`
- Delete: `src/app/staff/my-shift.tsx`, `src/app/staff/my-shifts/`, `src/app/system/staff-shifts/`, `src/app/staff/preview/`
- Delete: `src/components/staff/staff-shift-gate.tsx`, `src/components/staff/current-shift-indicator.tsx`, `src/components/staff/open-shift-screen.tsx`, `src/components/staff/close-shift-dialog.tsx`, `src/components/staff/shift-detail-summary.tsx`, `src/components/staff/shift-orders-list.tsx`
- Delete: `src/docs/feature-management-staff-shifts-FE-Tester.md`
- Modify: `src/types/index.ts`, `src/hooks/index.ts`, `src/constants/query.ts`, `src/constants/route.ts`, `src/router/loadable.tsx`, `src/router/index.tsx`, `src/router/routes.ts`, `src/app/layouts/system/SystemLayout.tsx`

- [ ] **Step 1: Xác nhận không còn nơi nào import code cũ**

Run:
```bash
grep -rn "staff-shift\|staffShift\|StaffShift\|staff/my-shift\|staff/preview" src --include="*.ts" --include="*.tsx" | grep -v "^src/docs/"
```

Mẫu grep cố tình **không** bắt `my-shift-tab` / `MyShiftTab` — đó là component mới ở `src/app/system/work-shifts/components/`, phải giữ lại.

Expected: chỉ còn các dòng nằm trong khối comment `TEMP DISABLED` và các dòng khai báo `QUERYKEY.*StaffShift*` / `ROUTE.STAFF_MY_SHIFT*`. Nếu xuất hiện import **đang hoạt động** ngoài danh sách trên, dừng lại và xử lý trước.

- [ ] **Step 2: Xoá file**

```bash
git rm src/api/staff-shift.ts src/types/staff-shift.type.ts src/hooks/use-staff-shift.ts
git rm src/lib/staff-shift-helpers.ts src/lib/__tests__/staff-shift-helpers.test.ts
git rm src/app/staff/my-shift.tsx
git rm -r src/app/staff/my-shifts src/app/system/staff-shifts src/app/staff/preview
git rm src/components/staff/staff-shift-gate.tsx src/components/staff/current-shift-indicator.tsx
git rm src/components/staff/open-shift-screen.tsx src/components/staff/close-shift-dialog.tsx
git rm src/components/staff/shift-detail-summary.tsx src/components/staff/shift-orders-list.tsx
git rm src/docs/feature-management-staff-shifts-FE-Tester.md
```

- [ ] **Step 3: Gỡ export khỏi barrel**

Trong `src/types/index.ts`, xoá dòng:
```ts
export * from './staff-shift.type'
```

Trong `src/hooks/index.ts`, xoá dòng:
```ts
export * from './use-staff-shift'
```

- [ ] **Step 4: Gỡ query key cũ**

Trong `src/constants/query.ts`, xoá 9 dòng:
```ts
  currentStaffShift: ['currentStaffShift'],
  myStaffShifts: ['myStaffShifts'],
  staffShiftBySlug: ['staffShiftBySlug'],
  staffShiftOrders: ['staffShiftOrders'],
  activeStaffShifts: ['activeStaffShifts'],
  activeStaffShiftOrders: ['activeStaffShiftOrders'],
  staffShiftStatsByStaff: ['staffShiftStatsByStaff'],
  staffShiftStatsByDate: ['staffShiftStatsByDate'],
  currentStaffShiftOrders: ['currentStaffShiftOrders'],
```

- [ ] **Step 5: Gỡ route constant cũ**

Trong `src/constants/route.ts`, xoá 5 dòng:
```ts
  STAFF_POS_MY_SHIFT: '/staff/my-shift',
  STAFF_MY_SHIFTS_HISTORY: '/staff/my-shifts',
  STAFF_MY_SHIFT_DETAIL: '/staff/my-shifts/:slug',
  SYSTEM_STAFF_SHIFTS_HISTORY: '/system/staff-shifts',
  SYSTEM_STAFF_SHIFT_DETAIL: '/system/staff-shifts/:slug',
```

- [ ] **Step 6: Xoá các khối comment TEMP DISABLED**

Xoá toàn bộ khối comment mang chú thích `TEMP DISABLED — shift feature paused` còn sót trong:
- `src/router/loadable.tsx` (6 khối)
- `src/router/index.tsx` (các khối Task 17 chưa đụng tới)
- `src/router/routes.ts` (nếu Task 17 chưa xoá hết)

`src/app/layouts/system/SystemLayout.tsx` và `src/components/staff/staff-shift-gate.tsx` đã xử lý ở Task 12 / xoá ở Step 2.

Run kiểm tra: `grep -rn "TEMP DISABLED" src` → Expected: không có kết quả.

- [ ] **Step 7: Typecheck, test, build**

```bash
npx tsc -b --noEmit
npm run test
npm run build
```
Expected: cả 3 lệnh PASS. `npm run test` không được giảm số test pass ngoài 12 test của `staff-shift-helpers.test.ts` đã xoá.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(work-shift): remove legacy staff-shift module"
```

---

## Ghi chú bàn giao cho QA

Ánh xạ test case trong spec sang thao tác FE:

| Spec TC | Kiểm ở đâu trên FE |
|---|---|
| TC-001, TC-013 | `/system/work-shifts` với tài khoản CASHIER — form mở ca (openingCash bắt buộc, chặn số âm ở client) |
| TC-002 | Mở ca lần 2 → toast `workShiftBranchHasActive` |
| TC-003 | Nút "Đóng ca" trên `AppHeader` (dùng được từ bất kỳ trang nào) → dialog tổng kết |
| TC-004 | Sau khi mở ca, toast `preShiftLinked` hiện khi `preShiftOrdersLinked > 0` |
| TC-005 | Trang thanh toán — banner `ShiftGateBanner` + nút thanh toán bị khoá |
| TC-006 | Đăng nhập STAFF → gate trả `STAFF_CANNOT_PAY` ngay, không gọi API. Trên màn order POS staff vốn không thấy nút thanh toán (gate có sẵn) |
| — (ngoài spec) | CASHIER mở ca rồi vào `/staff/table/<id>/payment` → chỉ báo ca vẫn hiện trên header POS, không biến mất |
| TC-007, TC-008 | Tab "Đơn hàng" — badge "Xuyên ca" |
| TC-009 | Đăng nhập MANAGER → `/system/work-shifts` chỉ hiện ca branch mình; ô lọc chi nhánh bị ẩn |
| TC-012 | Đăng nhập ADMIN → tab lịch sử có đủ bộ lọc: trạng thái, khoảng ngày, `cashierSlug`, `branchSlug` |
| TC-010 | Tab "Ca đang mở" → nút "Đóng ép ca" (submit bị khoá khi lý do rỗng) |
| TC-011 | Cashier mở `/system/work-shifts/<slug ca người khác>` → toast `workShiftForbidden` |

**Điểm cần BE xác nhận trước khi test end-to-end:**
1. Endpoint thanh toán: spec ghi `/payments/initiate`, codebase đang gọi `/payment/initiate`. Kế hoạch này **không đổi** đường dẫn — nếu BE thực sự đổi sang `/payments/initiate` thì cần một task riêng.
2. Shape phân trang của `GET /work-shifts`: spec ghi `{ data, total, page, size }`, khác `IPaginationResponse` mà phần còn lại của hệ thống dùng (`{ items, pageSize, ... }`).
3. `GET /work-shifts/current` trả `404` hay `200` với `result: null` khi chưa có ca — hook hiện xử lý cả hai (không retry 404, `data` undefined).
