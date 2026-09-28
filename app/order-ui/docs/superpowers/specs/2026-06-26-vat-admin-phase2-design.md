# VAT Admin Dashboard (Phase 2) — Design Spec

**Status:** Draft for plan-writing
**Date:** 2026-06-26
**Phase 1 (cashier flow):** completed on branch `feature/TT-30-...`. This document specifies Phase 2.

## Goal

Build an admin/accountant dashboard at `/system/vat-request` so authorized staff can list, view, edit, and update status of VAT invoice requests submitted by customers via the Phase 1 public flow. The dashboard becomes the operational tool for accountants to issue real invoice numbers and close out requests.

## Out of scope

The following are explicitly deferred to a later phase:

- Audit log / activity history (depends on BE support)
- Bulk actions (mark many requests at once)
- Email preview before status transition
- BE-side push notification for new VAT requests (FE uses manual refresh button instead)
- Customer-side edits (customers cannot edit; only admin via Step 4)

## Decisions log

| # | Decision | Rationale |
|---|---|---|
| D1 | **Permission-based gating** (4 codes) — not role-based | Lets SuperAdmin reconfigure who can do what without FE redeploy; future-proof if "accountant" becomes a distinct role |
| D2 | **Right Sheet** for detail/edit surface (not modal, not separate page) | Reuses `OrderHistoryDetailSheet` pattern; keeps list context for bulk-style workflow |
| D3 | **Mid status workflow** — skip PROCESSING allowed; COMPLETED/REJECTED terminal; `invoiceNumber` required on → COMPLETED; `note` required on → REJECTED | Matches real accountant workflow (often skip PROCESSING) while preventing data quality issues |
| D4 | **Customer info locked when terminal status**; **accountant info always editable** (subject to permission) | Prevents data mismatch after invoice issuance; allows late entry of real invoice numbers |
| D5 | **Default columns + BE-side filters** (status, date range, search); FE filter client-side as fallback if BE blocks | BE confirmed dateRange + search supported (Q3 of BE confirmation) |
| D6 | **Conditional integration with order-management** — cashier → Phase 1 dialog; admin clicking already-submitted → Phase 2 sheet | Single entry point; preserves cashier UX |
| D7 | **Manual refresh button** (not polling) with `lastUpdatedAt` indicator | Less server load; gives admin control |
| D8 | **MVP includes Export Excel only**; defer audit/bulk/email preview to Phase 3 | Highest-value/lowest-effort auxiliary feature |

## BE dependency status (confirmed during brainstorming)

| # | BE item | Status | FE mitigation |
|---|---|---|---|
| 1 | 4 permission codes (`VIEW_VAT_REQUEST`, `EDIT_VAT_REQUEST`, `EDIT_ACCOUNTANT_INFO`, `UPDATE_VAT_STATUS`) | NOT READY | FE codes the gate with hard-coded code strings; BE must create + assign to authority group before production deploy. Pre-deploy: gate returns `false` for everyone → menu hidden. Safe degradation. |
| 2 | `GET /vat-request/:slug` (detail endpoint) | NOT READY | Sheet snapshots the list-row record into local state on click. Mutations merge response back into snapshot. Trade-off: if another admin edits, current sheet shows stale data until manual refresh. Acceptable until BE ships detail endpoint — then swap to `useVatRequestDetail(slug)`. |
| 3 | `dateRange` + `searchText` filters on `GET /vat-request` | READY | Use BE filtering; no client-side fallback needed. Confirm exact param names with BE during implementation. |
| 4 | Auto-email to customer on status → COMPLETED / REJECTED | NOT READY | Confirm dialog displays warning: "System does not auto-send email yet; contact customer directly." When BE ships auto-email, change i18n string only. |

Risk owners: BE blockers (1) and (4) must be resolved before production. Blocker (2) is a UX-degradation risk only (single admin acting on a request at a time is typical).

## Architecture

### High-level diagram

```
[Sidebar nav] ──→ /system/vat-request ──→ VatRequestListPage
                                              │
                                              ├── FilterBar (status, dateRange, search)
                                              ├── RefreshButton + LastUpdatedAt
                                              ├── ExportExcelButton
                                              ├── VatRequestTable (7 columns)
                                              └── Pagination
                                              │
                                              ▼ click row
                                          setSheetRecord(row.original)
                                              │
                                              ▼
                                          VatRequestDetailSheet
                                              ├── HeaderSection
                                              ├── CustomerInfoSection (form, locked if terminal)
                                              ├── AccountantInfoSection (form, always editable)
                                              └── StatusWorkflowSection
                                                    └── StatusTransitionConfirmDialog
```

### Integration with Phase 1 (order-management)

`order-history-columns.tsx` cell for the "VAT" column:

```
on click:
  if (hasPermission('VIEW_VAT_REQUEST') && order.vatStatus === 'SUBMITTED'):
    open VatRequestDetailSheet (Phase 2)
  else:
    open VatRequestDialog (Phase 1 cashier flow)
```

Cashier user experience unchanged. Admin user gains shortcut to manage from list.

## File structure

### New files (~30 files, ~2400 LOC)

```
src/
├── types/vat.type.ts                          [MOD]
├── schemas/vat-admin.schema.ts                [NEW ~50]
├── api/vat-admin.ts                           [NEW ~60]
├── hooks/use-vat-admin.ts                     [NEW ~100]
├── constants/
│   ├── query.ts                               [MOD: +vatRequestsList key]
│   ├── permissions.ts                         [MOD: +4 codes constants]
│   └── route.ts                               [MOD: +STAFF_VAT_REQUEST]
├── router/
│   ├── loadable.tsx                           [MOD: lazy VatRequestListPage]
│   └── index.tsx                              [MOD: route entry + sidebarRoutes]
├── app/system/vat-request/
│   ├── page.tsx                               [NEW ~150]
│   ├── components/
│   │   ├── filter-bar.tsx                     [NEW ~80]
│   │   ├── refresh-button.tsx                 [NEW ~30]
│   │   ├── export-excel-button.tsx            [NEW ~60]
│   │   └── vat-request-table.tsx              [NEW ~120]
│   └── DataTable/columns.tsx                  [NEW ~120]
├── components/app/sheet/vat-request-detail-sheet/
│   ├── index.ts
│   ├── vat-request-detail-sheet.tsx           [NEW ~180]
│   ├── header-section.tsx                     [NEW ~50]
│   ├── customer-info-section.tsx              [NEW ~150]
│   ├── accountant-info-section.tsx            [NEW ~120]
│   └── status-workflow-section.tsx            [NEW ~140]
├── components/app/dialog/
│   └── status-transition-confirm-dialog.tsx   [NEW ~150]
└── locales/{vi,en}/vatAdmin.json              [NEW ~40 keys each]
```

### Modified Phase 1 files

```
src/app/system/order-management/
├── DataTable/columns/order-history-columns.tsx   [MOD: cell VAT permission branching]
└── page.tsx                                      [MOD: mount VatRequestDetailSheet]
```

### Tests (~32 new tests across 12 files)

```
src/tests/
├── api/vat-admin.test.ts                              [3 tests]
├── hooks/use-vat-admin.test.ts                        [5 tests]
├── schemas/vat-admin.test.ts                          [12 tests]
├── app/system/vat-request/
│   ├── filter-bar.test.tsx                            [3 tests]
│   ├── vat-request-table.test.tsx                     [2 tests]
│   ├── export-excel-button.test.tsx                   [2 tests]
│   └── page.test.tsx                                  [3 tests]
└── components/sheet/vat-request-detail-sheet/
    ├── customer-info-section.test.tsx                 [3 tests]
    ├── accountant-info-section.test.tsx               [2 tests]
    ├── status-workflow-section.test.tsx               [4 tests]
    └── vat-request-detail-sheet.test.tsx              [3 tests]
```

## Data contracts

### Types (extend `vat.type.ts` from Phase 1)

```ts
export enum VatRequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export interface IVatRequestListItem {
  slug: string
  invoiceSlug: string
  customerName: string
  taxCode: string
  email: string
  address?: string
  companyName?: string
  note?: string
  invoiceNumber?: string
  accountantNote?: string
  status: VatRequestStatus
  createdAt: string
  updatedAt?: string
  // Optional order linkage if BE provides
  orderSlug?: string
  orderReferenceNumber?: string
}

export interface IVatRequestListParams {
  status?: VatRequestStatus[]
  fromDate?: string  // ISO date
  toDate?: string    // ISO date
  search?: string
  page: number
  size: number
}

export interface IUpdateVatRequestBody {
  customerName?: string
  taxCode?: string
  address?: string
  email?: string
  companyName?: string
  note?: string
}

export interface IUpdateAccountantInfoBody {
  invoiceNumber?: string
  accountantNote?: string
}

export interface IUpdateVatStatusBody {
  status: VatRequestStatus
  invoiceNumber?: string  // required on FE when status=COMPLETED
  note?: string           // required on FE when status=REJECTED
}
```

### Permission codes (constants)

```ts
export const VAT_PERMISSIONS = {
  VIEW: 'VIEW_VAT_REQUEST',
  EDIT: 'EDIT_VAT_REQUEST',
  EDIT_ACCOUNTANT: 'EDIT_ACCOUNTANT_INFO',
  UPDATE_STATUS: 'UPDATE_VAT_STATUS',
} as const
```

### Zod schemas (`vat-admin.schema.ts`)

```ts
// All fields optional; if provided, must match Phase 1 validation
export const vatUpdateCustomerSchema = z.object({
  customerName: z.string().optional(),
  taxCode: z.string().regex(/^(\d{10}|\d{13})$/).optional(),
  address: z.string().optional(),
  email: z.string().email().optional(),
  companyName: z.string().optional(),
  note: z.string().optional(),
})

export const vatUpdateAccountantSchema = z.object({
  invoiceNumber: z.string().optional(),
  accountantNote: z.string().optional(),
})

// Discriminated union by target status
export const vatStatusTransitionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal(VatRequestStatus.PROCESSING),
    invoiceNumber: z.string().optional(),
    note: z.string().optional(),
  }),
  z.object({
    status: z.literal(VatRequestStatus.COMPLETED),
    invoiceNumber: z.string().min(1),  // REQUIRED
    note: z.string().optional(),
  }),
  z.object({
    status: z.literal(VatRequestStatus.REJECTED),
    invoiceNumber: z.string().optional(),
    note: z.string().min(3),  // REQUIRED, min 3 chars (reason)
  }),
])
```

### Transition rules (client-side enforced)

```
canTransition(current, target):
  if current ∈ {COMPLETED, REJECTED}: return false   // terminal
  if target === PENDING: return false                // no revert
  if current === target: return false
  return true
```

## State management

### List page

- Filter state (status[], fromDate, toDate, search, page, size) — `useState` local in `VatRequestListPage`. Resets on unmount.
- TanStack Query `useVatRequests(params)` with `queryKey: [...QUERYKEY.vatRequestsList, ...params]`, `staleTime: 30s`, `refetchOnMount: 'always'`.
- Refresh button → `queryClient.refetchQueries({ queryKey: [...QUERYKEY.vatRequestsList] })`.
- `dataUpdatedAt` from TanStack drives "Cập nhật lúc HH:mm" label.
- Selected row → `setSheetRecord(row.original)` → drives sheet open/close.

### Sheet detail

- Receives `vatRequest: IVatRequest | null` prop. Mounted when non-null.
- Each section uses `react-hook-form` with `defaultValues` from snapshot.
- Mutation `onSuccess` → `setSheetRecord((prev) => ({ ...prev, ...response.result }))` + `invalidateQueries`.
- Status transition opens local-state confirm dialog. Snapshot payload at dialog open; refuse submit if drifted.

### Cache invalidation matrix

| Mutation | Invalidates |
|---|---|
| `useUpdateVatRequest` | `[QUERYKEY.vatRequestsList]` (any params) |
| `useUpdateAccountantInfo` | `[QUERYKEY.vatRequestsList]` |
| `useUpdateVatStatus` | `[QUERYKEY.vatRequestsList]` + close sheet + close confirm |
| Manual refresh | `refetchQueries [QUERYKEY.vatRequestsList]` |

No optimistic updates (paginated + filtered cache is hard to update locally). Accept ~200-500ms latency.

## Error handling

### HTTP error matrix

| Endpoint | Status | Handling |
|---|---|---|
| All | 403 | Global toast (rare — gates should prevent); permission-stale defense |
| All | 5xx | Global toast + retry button on list; sheet shows toast and stays open with snapshot |
| `PATCH /:slug` (Step 4) | 400 | Inline error per field if BE returns `errors[]`; else generic toast |
| `PATCH /:slug` | 404 | Toast "Request no longer exists" + close sheet + invalidate list |
| `PATCH /accountant-info` | 400/404 | Same as Step 4 |
| `PATCH /status` | 400 | Inline error in confirm dialog |
| `PATCH /status` | 409 (assumed) | Toast "Status changed by another user" + close confirm + invalidate |

### Concurrent edit protection

When the status transition confirm dialog opens, snapshot the intended payload. Before submitting:
- Compare against current sheet snapshot.
- If `snapshot.status !== currentSnapshot.status`, refuse submit with reason `vatAdmin.confirmDriftRetry`.

Pattern matches the admin voucher confirm dialog already in the codebase.

### Unsaved form changes

If `react-hook-form.formState.isDirty` and user attempts to close sheet → confirmation prompt "Có thay đổi chưa lưu. Đóng?". Cancel keeps sheet open.

### Email-not-sent warning

Status transition confirm dialog displays a warning banner for COMPLETED/REJECTED targets:

> ⚠️ Hệ thống tạm thời chưa tự gửi email cho khách. Vui lòng liên hệ trực tiếp nếu cần.

Hard-coded via i18n key `vatAdmin.statusConfirm.emailNotice`. When BE ships auto-email, change the i18n value (single string).

### Edge cases

| Edge case | Handling |
|---|---|
| Empty list with filter | Empty state component with "Xoá filter" button |
| Loading + empty conflict | Empty state only after `!isLoading && data.length === 0` |
| Permission codes missing at deploy time | All gates return `false` → menu hidden, route 403. Safe degradation. |
| Sheet open while list refetches | Sheet uses snapshot; mutations merge response. Stale read accepted until BE ships detail endpoint. |
| `fromDate > toDate` filter | Disable submit + inline error |
| Export Excel with 0 records | Disabled button + tooltip "Không có dữ liệu" |
| Search text < 2 chars | Debounce 400ms + skip BE call |
| Timestamp comparison | Use `serverNow()` from Phase 1 |

## Permission gating (3 tiers)

| Tier | Where | Code |
|---|---|---|
| 1 | Sidebar menu visibility | `VIEW_VAT_REQUEST` |
| 2 | Route guard (ProtectedElement) | `VIEW_VAT_REQUEST` |
| 3 | Per-section button enable/disable | `EDIT_VAT_REQUEST`, `EDIT_ACCOUNTANT_INFO`, `UPDATE_VAT_STATUS` |

Implementation: `useHasVatPermission()` hook reads JWT scope once (memoized), returns `{ canView, canEdit, canEditAccountant, canUpdateStatus }`.

BE remains the ultimate authority via 403 responses.

## Testing strategy

### Pyramid

- ~20 hook/schema/API tests (fast, pure logic)
- ~14 component tests (RTL render + interact)
- 0 E2E automated; 1 manual smoke checklist run at end of plan execution

### Coverage map

Documented in detail in earlier brainstorming session. Test counts per file:

```
api: 3 | hooks: 5 | schemas: 12
filter-bar: 3 | table: 2 | export-button: 2 | page (smoke): 3
customer-info: 3 | accountant-info: 2 | status-workflow: 4 | sheet (smoke): 3
```

Total: ~32 tests (parity with Phase 1).

### Conventions

- 1 source file = 1 test file
- Mock `http`, TanStack via wrapper, `useAuthStore`, `xlsx`
- i18n: 2-arg `t(key, fallback)` pattern + assert fallback text
- RTL queries from user perspective; no internal-state assertions

### Manual smoke checklist (final task)

```
[ ] Login Admin → sidebar shows "Quản lý VAT" → trang loads
[ ] Login Cashier → no menu + manual URL → /forbidden
[ ] Filter status PENDING → table shows correct rows + dataUpdatedAt updates
[ ] Filter date range > 30 days → BE query correct
[ ] Search "MST 0123" → BE query correct
[ ] Click row → Sheet opens with snapshot data, 3 sections rendered
[ ] Edit Section 1 email → Save → toast success + list refresh shows new value
[ ] Status=COMPLETED → all transition buttons disabled (terminal)
[ ] Status=PENDING → click "→ COMPLETED" → confirm dialog requires invoiceNumber
[ ] Confirm submit → status updates → list refresh + sheet closes
[ ] Export Excel → file downloaded with 7 columns + N rows
[ ] On order-management (Phase 1), order paid + SUBMITTED, logged in admin → click VAT → opens Phase 2 sheet (not cashier dialog)
[ ] Login cashier → click VAT same order → opens Phase 1 dialog as before
[ ] Confirm dialog shows email-not-sent warning
[ ] Section 1 dirty + close sheet → unsaved-changes confirm prompt
```

## Effort estimate

| Layer | Tasks | Time |
|---|---:|---:|
| Hooks + API + types + schemas | 3 | ~1h |
| List page + filter + refresh + export | 4 | ~2h |
| Sheet + 3 sections | 4 | ~2h |
| Confirm dialog + status workflow | 2 | ~1h |
| Phase 1 integration (cell branching) | 1 | ~30m |
| Sidebar + route + 3-tier gate | 1 | ~30m |
| i18n + final validation | 2 | ~1h |
| **Total** | **~17 tasks** | **~8h** |

## Open follow-ups (not blocking design)

1. BE confirms exact param names for `dateRange` + `search` filters during implementation.
2. BE confirms 4 permission code names exactly as listed; coordinates authority-group assignment.
3. When BE adds `GET /vat-request/:slug`, swap snapshot strategy to detail query (single-line code change in sheet).
4. When BE adds auto-email, change `vatAdmin.statusConfirm.emailNotice` i18n string.
5. When BE adds `vatStatus` field on `IOrder`, upgrade Phase 1 column branching from "fetch status on click" to "read from row data" (eliminates extra request per click).

## Acceptance criteria

This phase is considered complete when:

1. Any user whose JWT scope contains `VIEW_VAT_REQUEST` can navigate to `/system/vat-request` and view a paginated, filterable list of all VAT requests. (Initially expected roles: Manager, Admin, SuperAdmin — but assignment lives in BE authority groups, not FE code.)
2. Users without `VIEW_VAT_REQUEST` permission cannot see the menu item, cannot access the route, and receive 403 on direct BE calls.
3. Clicking a row opens a right sheet showing the request's customer info, accountant info, and status workflow controls — gated per permission.
4. Status transitions enforce: terminal lock at COMPLETED/REJECTED, `invoiceNumber` required for COMPLETED, `note` (≥3 chars) required for REJECTED.
5. Customer info edits are locked when status is COMPLETED or REJECTED.
6. Accountant info edits are always available to users with `EDIT_ACCOUNTANT_INFO`.
7. Manual refresh button updates list with `lastUpdatedAt` timestamp.
8. Export Excel downloads current filtered view as `.xlsx`.
9. Phase 1 cashier flow on order-management remains unchanged for cashier users; admin users with `VIEW_VAT_REQUEST` clicking a SUBMITTED order open the Phase 2 sheet instead.
10. Test suite passes (~32 new tests + no regression of Phase 1 ~32 tests).
11. Build green, lint clean (no new warnings).
12. Manual smoke checklist all passes.
