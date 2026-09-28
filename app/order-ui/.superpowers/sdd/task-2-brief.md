# Task: Consolidate accountant endpoint vào /status + cho phép chuyển trạng thái tự do

## Mục tiêu (user requirement)

**A.** Bỏ endpoint `/vat-request/:slug/accountant-info`. Khi kế toán update **mã hoá đơn**, gọi `/vat-request/:slug/status` với `status = current status` (giữ nguyên status, chỉ update invoiceNumber).

**B.** Bỏ field "Ghi chú nội bộ" (`accountantNote`) khỏi UI vì BE `/status` body không support field này. Loại bỏ luôn khỏi schema, types, hooks, list/detail rendering.

**C.** Các nút đổi trạng thái VAT request **cho phép bấm tự do** — không còn ràng buộc state machine. Ví dụ: đang PROCESSING → có thể quay về PENDING. Đang COMPLETED → có thể chuyển về PROCESSING/PENDING/REJECTED. Chỉ block bấm chính nó (same status).

Lưu ý từ user về scope C: **không** yêu cầu mở khoá form chỉnh sửa khách (`customerLocked` khi terminal) — chỉ relax transition buttons. Giữ nguyên gate `customerLocked = isTerminal || !canEdit` ở `vat-request-detail-sheet.tsx:87`. Note ở report nếu thấy bất cập.

---

## Files PHẢI sửa

### Goal A — endpoint consolidation
1. `src/api/vat-admin.ts` — xoá function `updateAccountantInfo` (lines 47-57). Xoá import `IUpdateAccountantInfoBody` không còn dùng.
2. `src/hooks/use-vat-admin.ts` — refactor `useUpdateAccountantInfo`:
   - Đổi mutationFn → gọi `updateVatStatus`.
   - Đổi mutation input shape thành `{ slug, currentStatus, invoiceNumber }`. Body gửi BE: `{ status: currentStatus, invoiceNumber: invoiceNumber?.trim() || null, note: null }`. (note: null vì không thay đổi note workflow, BE chuẩn body /status đã có sẵn nullable note.)
   - Giữ tên hook `useUpdateAccountantInfo` (để giảm cascade rename) hoặc rename `useUpdateInvoiceNumber` — lựa **giữ tên cũ** để minimal change.
   - Xoá import `updateAccountantInfo` + `IUpdateAccountantInfoBody`.
3. `src/types/vat.type.ts`:
   - Xoá interface `IUpdateAccountantInfoBody` (lines 104-107).
   - Xoá field `accountantNote` trong `IVatRequest` (line 70) và `IVatRequestListItem` (line 106 — nếu trùng).
4. `src/schemas/vat-admin.schema.ts`:
   - Đổi `vatUpdateAccountantSchema` → chỉ còn `{ invoiceNumber: z.string().optional() }`.
   - Thêm case PENDING vào `vatStatusTransitionSchema` discriminatedUnion: `z.object({ status: z.literal(VatRequestStatus.PENDING), invoiceNumber: z.string().optional(), note: z.string().optional() })`. (Rollback không bắt buộc field nào.)
5. `src/components/app/sheet/vat-request-detail-sheet/accountant-info-section.tsx`:
   - Bỏ field `accountantNote` khỏi form (xoá div textarea + register).
   - Cập nhật `defaultValues` chỉ còn `invoiceNumber`.
   - Cập nhật `onSubmit` → set pendingPayload chỉ `{ invoiceNumber }`.
   - Cập nhật `handleConfirm` → gọi mutate với `{ slug, currentStatus: vatRequest.status, invoiceNumber }`.
   - Đổi i18n description: bỏ phần "/ ghi chú nội bộ" cho khớp.
6. `src/components/app/sheet/vat-request-detail-sheet/overview-tab.tsx` line 73 — bỏ row hiển thị `accountantNote`. Nếu row đó là 1 hàng standalone trong section "KẾ TOÁN", xoá luôn label "Ghi chú nội bộ" tương ứng.

### Goal B — free transitions
7. `src/lib/vat-status-transitions.ts`:
   - Đổi `canTransition` thành chỉ chặn `current === target`. Return true cho mọi trường hợp khác (kể cả target PENDING, kể cả từ terminal).
   - Xoá `TERMINAL` set nếu không còn dùng.
   - Update doc comment.
8. `src/components/app/sheet/vat-request-detail-sheet/vat-request-detail-sheet.tsx`:
   - Đổi `FORWARD_TARGETS` → include cả 4 status hoặc tách thành 2 groups (LEFT: PENDING + PROCESSING + COMPLETED; RIGHT: REJECTED) — giữ pattern hiện tại (REJECTED tách riêng phía bên phải).
   - Thêm entry `[VatRequestStatus.PENDING]` vào `TRANSITION_META` với `{ variant: 'outline', Icon: RotateCcw }` (import từ lucide-react).
   - **KHÔNG** thay đổi `isTerminal` / `customerLocked` logic — giữ nguyên.
   - Filter rendering buttons chỉ qua `canTransition(snapshot.status, target)` + `canUpdateStatus`. Với canTransition mới (allow free), tất cả button khác current sẽ show.
9. `src/locales/vi/vatAdmin.json`:
   - Thêm key `workflow.transitionTo.PENDING`: "Quay về chờ"
   - Thêm key `transition.title.PENDING`: "Quay về Đang chờ?"
   - Thêm key `transition.description.PENDING`: "Đưa yêu cầu này về trạng thái chờ xử lý. Dùng khi cần làm lại từ đầu."
   - Đổi `accountantInfo.confirmDescription`: "Xác nhận cập nhật số hoá đơn cho yêu cầu này?" (bỏ "/ ghi chú nội bộ").
   - Optionally xoá key `accountantInfo.note` (nếu UI không còn render textarea note).

### Tests
10. `src/tests/schemas/vat-admin.test.ts` — bỏ accountantNote-related assertions; thêm test cho PENDING case của `vatStatusTransitionSchema`.
11. `src/tests/hooks/use-vat-admin.test.tsx` — update `useUpdateAccountantInfo` test để gọi với shape mới `{ slug, currentStatus, invoiceNumber }`. Verify mutation gọi `updateVatStatus` (mock module) thay vì `updateAccountantInfo`.
12. `src/tests/components/sheet/vat-request-detail-sheet/accountant-info-section.test.tsx` — không còn assert textarea note; assert mutation gọi với currentStatus.
13. `src/tests/components/sheet/vat-request-detail-sheet/vat-request-detail-sheet.test.tsx` — nếu có test assert terminal hide transition buttons → update để verify terminal cũng show buttons.
14. `src/tests/components/dialog/status-transition-confirm-dialog.test.tsx` — verify PENDING target render dialog đúng (không require invoice/note).

### Có thể cần đụng (nếu test break)
- `src/tests/router/vat-route-config.test.ts` — chắc không ảnh hưởng.
- File nào khác fail sau `npm run test` → fix theo direction trên.

---

## Ràng buộc

### MUST
- KHÔNG commit. Để working tree.
- `npm run lint` pass.
- `npm run test` pass tất cả test files.
- `npx tsc --noEmit` pass.
- Giữ nguyên error handling pattern (`ignoreGlobalError`, console.error BE message, Vietnamese toast).
- Giữ nguyên `customerLocked` / `accountantLocked` gate ở detail sheet — chỉ relax status transitions, không relax form edit gate.
- Giữ tên hook `useUpdateAccountantInfo` (không rename).

### MUST NOT
- Không sửa file ngoài scope đã liệt kê (trừ khi test break bắt buộc).
- Không tạo file mới.
- Không động vào `src/app/public-vat-request/`, `src/components/app/dialog/vat-request/`, landing files, etc.
- Không tự bịa BE field — nếu cần field không có trong `IUpdateVatStatusBody`, dừng và escalate.

---

## Verification (chạy trong report)

```bash
npx eslint src/api/vat-admin.ts src/hooks/use-vat-admin.ts src/types/vat.type.ts src/schemas/vat-admin.schema.ts src/lib/vat-status-transitions.ts src/components/app/sheet/vat-request-detail-sheet/ src/components/app/dialog/status-transition-confirm-dialog.tsx src/locales/vi/vatAdmin.json
npx tsc --noEmit
npm run test
```

Tất cả phải pass.

---

## Report

Ghi vào `.superpowers/sdd/task-2-report.md`:
- Status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED)
- List files modified
- Decisions taken cho từng file (rename, removal scope, i18n key changes)
- Test output (lint, tsc, npm run test)
- Self-review checklist: 14 mục requirement đã đạt chưa
- Concerns nếu có (vd: customerLocked logic now feels inconsistent với free transitions — flag để user quyết)
