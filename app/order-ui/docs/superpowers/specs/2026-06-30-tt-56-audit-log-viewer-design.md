# TT-56 — Audit Log Viewer + Config Screen (FE)

- **Branch:** `feature/TT-56-FE-Implement-Audit-Log-Viewer-Screen`
- **API doc:** `src/docs/audit-logs-api.md`
- **Pattern reference:** `src/app/system/logger/`
- **Date:** 2026-06-30

## 1. Mục tiêu

Cung cấp cho Admin/SuperAdmin/Manager 2 chức năng trong cùng một màn hình:

1. **Viewer** — tra cứu lịch sử thay đổi dữ liệu (`GET /audit-logs`).
2. **Config** — bật/tắt audit theo entity (`GET /audit-logs-config`, `PATCH /audit-logs-config`).

## 2. Permissions

Tab visibility is gated at the page level by granular permissions (not role enum). The two permissions and their role assignments are:

| Permission | Tab controlled | Granted to |
|---|---|---|
| `VIEW_AUDIT_LOG` | Viewer | Admin, SuperAdmin |
| `MANAGE_AUDIT_CONFIG` | Config | Manager, Admin, SuperAdmin |

The sidebar entry uses `MANAGE_AUDIT_CONFIG` (widest set) so that all three roles see the nav item. A coarser `ProtectedElement allowedRoles={[MANAGER, ADMIN, SUPER_ADMIN]}` gate remains at the route level as a perimeter check.

## 3. Routing & Navigation

- Một route duy nhất: `ROUTE.STAFF_AUDIT_LOG = '/system/audit-log'`.
- Tab state qua URL search param `?tab=viewer|config`.
- Sidebar: 1 mục `MANAGE_AUDIT_CONFIG` (icon lucide `History`), gate qua `sidebar-permission.ts`.
- `ProtectedElement allowedRoles={[MANAGER, ADMIN, SUPER_ADMIN]}` tại level route (coarser perimeter check).
- User không có `VIEW_AUDIT_LOG` mở `?tab=viewer` → page tự `navigate(replace)` về `?tab=config` và không render trigger Viewer trong `<TabsList>`.
- Default tab: `viewer` nếu có `VIEW_AUDIT_LOG`, ngược lại `config`.

## 4. Cấu trúc thư mục

```
src/app/system/audit-log/
├── index.ts
├── audit-log-page.tsx               # Tabs container, role guard, URL sync
├── viewer/
│   ├── viewer-tab.tsx               # Filter bar + DataTable
│   ├── DataTable/
│   │   └── columns.tsx
│   ├── filters/
│   │   ├── user-combobox.tsx        # debounced search /users → trả slug
│   │   ├── entity-select.tsx        # source useAuditLogConfigs(), all + badge "(đã tắt)"
│   │   ├── event-select.tsx         # Create/Update/Delete (case-sensitive)
│   │   └── date-range-picker.tsx
│   ├── detail-sheet.tsx             # Side sheet diff key-by-key + raw JSON
│   └── helpers/
│       ├── summarize-diff.ts        # pure, dùng cho cột summary
│       └── compute-field-diff.ts    # pure, dùng cho sheet
└── config/
    ├── config-tab.tsx               # DataTable 2 cột (Entity, Switch)
    └── disable-confirm-dialog.tsx   # AlertDialog destructive
```

Component dùng chung:
- `src/components/app/badge/audit-event-badge.tsx` — badge cho Event (Create/Update/Delete).

## 5. Data layer

### 5.1 Types (`src/types/audit-log.type.ts`)

```ts
export type TAuditEvent = 'Create' | 'Update' | 'Delete'

export interface IAuditLog {
  slug: string
  createdAt: string
  userSlug: string
  user: string
  event: TAuditEvent
  entity: string
  from: Record<string, unknown> | null
  to: Record<string, unknown> | null
}

export interface IAuditLogQuery extends IQuery {
  user?: string         // user slug
  entity?: string
  event?: TAuditEvent
  fromDate?: string     // ISO; tên param sẽ confirm BE
  toDate?: string
}

export interface IAuditLogConfig {
  slug: string
  entity: string
  enabled: boolean
  createdAt: string
  updatedAt?: string
}

export interface IUpdateAuditLogConfigRequest {
  slug: string
  enabled: boolean
}
```

Re-export trong `src/types/index.ts`.

### 5.2 API (`src/api/audit-log.ts`)

```ts
export async function getAuditLogs(params: IAuditLogQuery)
  : Promise<IApiResponse<IPaginationResponse<IAuditLog>>>

export async function getAuditLogConfigs()
  : Promise<IApiResponse<IAuditLogConfig[]>>

export async function updateAuditLogConfig(body: IUpdateAuditLogConfigRequest)
  : Promise<IApiResponse<IAuditLogConfig>>
```

- Dùng `http` từ `src/utils/http.ts`.
- `getAuditLogs` đặt `doNotShowLoading: true` để tránh nhấp nháy NProgress khi user gõ filter.
- Re-export trong `src/api/index.ts`.

### 5.3 Hooks (`src/hooks/use-audit-log.ts`)

```ts
useAuditLogs(q)            // keepPreviousData, staleTime 10s
useAuditLogConfigs()       // staleTime mặc định (0)
useUpdateAuditLogConfig()  // optimistic flip + rollback on error
```

`useUpdateAuditLogConfig`:
- `onMutate`: cancel queries, snapshot prev cache, flip `enabled` của slug tương ứng.
- `onError`: rollback bằng snapshot.
- `onSettled`: invalidate `QUERYKEY.auditLogConfigs`.

Re-export trong `src/hooks/index.ts`.

### 5.4 Query keys (`src/constants/query.ts`)

```ts
auditLogs: ['audit-logs'],
auditLogConfigs: ['audit-log-configs'],
```

## 6. UI — Viewer tab

### 6.1 Filter bar

Layout 1 hàng (wrap trên mobile):
```
[UserCombobox] [EntitySelect] [EventSelect] [DateRangePicker] [Reset]
```

- State filter `useState` cục bộ + sync URL search params (giống pattern voucher search).
- Mọi thay đổi filter → reset `page` về 1.
- Nút "Reset" xoá toàn bộ filter, không xoá `tab` param.

### 6.2 Columns

| accessorKey | Title (i18n) | Render |
|---|---|---|
| `createdAt` | `auditLog.col.createdAt` | `moment(value).format('HH:mm DD/MM/YYYY')` |
| `user` | `auditLog.col.user` | `value` + tooltip `userSlug` |
| `event` | `auditLog.col.event` | `<AuditEventBadge event={value} />` |
| `entity` | `auditLog.col.entity` | text + badge `(đã tắt)` nếu cache `auditLogConfigs` có entry `enabled=false` |
| (computed) | `auditLog.col.summary` | `summarizeDiff(from, to)` — tối đa 2 field + `+N` |
| (actions) | `auditLog.col.action` | Button "Chi tiết" mở `DetailSheet` |

### 6.3 Detail Sheet

`Sheet` (right side), `SheetContent` rộng `sm:max-w-xl`:
- Header: badge Event + entity + thời gian + người thực hiện.
- Body:
  1. **Diff key-by-key**: 2 cột "Trước" / "Sau", chỉ render field có thay đổi. Primitive in trực tiếp; object/array → `<pre>` collapsible.
  2. **Raw JSON** (default collapsed): full `from`, `to` trong `<pre>` + `ScrollArea`.
- Footer: button "Copy raw JSON" (writeToClipboard).

### 6.4 Helpers pure

```ts
// summarize-diff.ts — không phụ thuộc i18n; cell tự render text từ structured result
type DiffSummary =
  | { kind: 'create' }
  | { kind: 'delete' }
  | { kind: 'noChange' }
  | { kind: 'update'; changes: Array<{ key: string; from: unknown; to: unknown }>; extra: number }

summarizeDiff(from, to): DiffSummary
  // Create: { kind: 'create' }
  // Delete: { kind: 'delete' }
  // Update có thay đổi: { kind: 'update', changes: 2 cái đầu, extra: số field thay đổi còn lại }
  // Update không có field nào khác nhau: { kind: 'noChange' }

// compute-field-diff.ts
computeFieldDiff(from, to): Array<{
  key: string
  from: unknown
  to: unknown
  kind: 'added' | 'removed' | 'changed'
}>
```

Cả 2 thuần, không phụ thuộc React/i18n → dễ unit test. Cell trong Viewer dùng `useTranslation` để render `DiffSummary` thành string hiển thị.

### 6.5 Filter components

- **UserCombobox**: shadcn `Popover + Command`. Hook `useUsers({ phonenumber: keyword, hasPaging: true, page: 1, size: 20 })` debounced 300ms qua `useDebouncedValue`. Item label `"FullName — PhoneNumber"`, submit value = `slug`. Khi mở chưa gõ → load page mặc định để có gợi ý ban đầu.
- **EntitySelect**: `useAuditLogConfigs()` → `Select`, option "Tất cả" + từng entity. Mỗi entity có `enabled=false` hiển thị suffix `(đã tắt)`.
- **EventSelect**: enum cứng `[Create, Update, Delete]` + option "Tất cả". Param gửi đúng casing.
- **DateRangePicker**: dùng component có sẵn (hoặc build từ `react-day-picker` đã có patches). Output ISO chuẩn `YYYY-MM-DDTHH:mm:ssZ`. Tên param BE: **cần confirm trước khi merge**.

## 7. UI — Config tab

- `useAuditLogConfigs()` → `DataTable` 2 cột:
  | accessorKey | Title (i18n) | Render |
  |---|---|---|
  | `entity` | `auditLog.config.colEntity` | text |
  | `enabled` | `auditLog.config.colEnabled` | `<Switch>` |

- Handler:
  ```ts
  const onToggle = (row, newValue) => {
    if (!newValue) openConfirmDialog(row)
    else mutate({ slug: row.slug, enabled: true })
  }
  ```
- **Disable confirm dialog** (`AlertDialog`):
  - Title: `auditLog.config.disableTitle`
  - Body: `auditLog.config.disableBody` với `{{entity}}` substitution.
  - Buttons: "Huỷ" / "Tắt audit" (destructive).
- Khi mutation đang in-flight cho slug nào đó → disable Switch dòng đó để chặn double-click.

## 8. Edge cases

- `from`/`to` rỗng `{}` → summary "Không có thay đổi".
- `from`/`to` thiếu key → `computeFieldDiff` xếp vào `added`/`removed`.
- Value rất dài → truncate cột summary (`max-w-[12rem] text-ellipsis`); full ở Sheet.
- `auditLogConfigs` chưa load khi cần badge "(đã tắt)" trong Viewer → không hiển thị badge thay vì hiển thị nhầm.
- Manager mở URL có `?tab=viewer` → `navigate(?tab=config, { replace: true })`.
- Filter combobox user mở khi chưa gõ → load 20 user gần đây để có gợi ý ban đầu.
- Toggle 2 lần liên tiếp rất nhanh → disable Switch row đang in-flight (`isPending` theo slug).
- BE chưa hỗ trợ date param → API 400, toast generic, dev console warn. Spec dự kiến confirm BE trước khi merge.
- Empty state:
  - Viewer rỗng: "Chưa có log nào khớp bộ lọc."
  - Config rỗng: "Chưa có cấu hình. Hãy thử tải lại."

## 9. i18n (`src/locales/{en,vi}/auditLog.json`)

```
auditLog.title
auditLog.tab.viewer
auditLog.tab.config

auditLog.col.createdAt
auditLog.col.user
auditLog.col.event
auditLog.col.entity
auditLog.col.summary
auditLog.col.action

auditLog.event.Create
auditLog.event.Update
auditLog.event.Delete

auditLog.filter.user
auditLog.filter.userPlaceholder
auditLog.filter.entity
auditLog.filter.entityAll
auditLog.filter.entityDisabled
auditLog.filter.event
auditLog.filter.date
auditLog.filter.reset

auditLog.sheet.title
auditLog.sheet.before
auditLog.sheet.after
auditLog.sheet.rawJson
auditLog.sheet.copyRaw
auditLog.sheet.noChange

auditLog.config.colEntity
auditLog.config.colEnabled
auditLog.config.disableTitle
auditLog.config.disableBody
auditLog.config.disableConfirm
auditLog.config.cancel

auditLog.empty.viewer
auditLog.empty.config
```

Bổ sung `helmet.auditLog.title` và `sidebar.auditLog` trong namespace tương ứng.

## 10. Error handling

- Global `QueryCache`/`MutationCache` trong `App.tsx` đã handle toast lỗi. Không cần custom riêng.
- PATCH thất bại: `onError` rollback → Switch tự revert.
- Combobox user fetch fail: dropdown hiện item "Không tải được danh sách", không crash filter.

## 11. Testing (vitest)

- `summarize-diff.test.ts` — Create/Update/Delete/empty/nhiều field.
- `compute-field-diff.test.ts` — added/removed/changed/nested.
- `use-audit-log.test.ts` — `useUpdateAuditLogConfig` optimistic + rollback (mock `qc` + `http`).
- `audit-log-page.test.tsx` — Manager không thấy tab Viewer + URL ép `?tab=config`; Admin thấy cả 2.
- `entity-select.test.tsx` — badge "(đã tắt)" hiển thị đúng.
- `disable-confirm-dialog.test.tsx` — chỉ mở khi `enabled=true`; confirm gọi `mutate`.

Tránh snapshot UI để khỏi fragile.

## 12. Phụ thuộc cần xác nhận với BE trước khi merge

1. **Param name date range** trong `GET /audit-logs` (`fromDate`/`toDate` hay khác). Liên quan đến TT-55-BE đã thêm "search by time".
2. **`hasPrevios` typo** trong response — fix BE hay FE đọc nguyên?
3. **`/users` API** có hỗ trợ search bằng `phonenumber` + tên với page size nhỏ phục vụ combobox không (nếu chưa có thì cần BE bổ sung hoặc dùng endpoint hiện có).

## 13. Out of scope

- Export audit logs ra file (CSV/Excel).
- Filter theo nhiều entity cùng lúc.
- Sort do user chọn (BE hiện luôn `createdAt DESC`).
- Real-time push log mới (chưa có push channel).
- Audit cho chính bảng `audit-logs-config` (BE tự quyết).
