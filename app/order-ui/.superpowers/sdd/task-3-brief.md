# Task: COMPLETED hard-lock + accountant lock-on-terminal + rename "Kế toán info" → "Phát hành hoá đơn"

## 3 mục tiêu (user requirements)

**A.** COMPLETED là **hard terminal** — không cho transition đi đâu nữa. (REJECTED giữ nguyên free transition như task trước, user không nhắc REJECTED.)

**B.** Section "Phát hành hoá đơn" (accountant info) lock khi status là terminal (COMPLETED hoặc REJECTED). Áp pattern giống `customerLocked`: `accountantLocked = isTerminal || !canEditAccountant`.

**C.** Đổi tên user-facing string từ "Kế toán" / "KẾ TOÁN INFO" / "Accountant info" sang tên chuẩn ngành kế toán hơn:
- **Tiếng Việt:** "PHÁT HÀNH HOÁ ĐƠN" / "Phát hành hoá đơn" / "Phát hành HĐ" (tab name)
- **Tiếng Anh:** "INVOICE ISSUANCE" / "Invoice Issuance" / "Issuance" (tab name)

**Giữ nguyên (KHÔNG rename):**
- Tên file: `accountant-info-section.tsx`
- Tên component: `AccountantInfoSection`
- Tên hook: `useUpdateAccountantInfo`
- Tên permission code: `EDIT_ACCOUNTANT` / `VAT_PERMISSIONS.EDIT_ACCOUNTANT`
- Tên biến: `canEditAccountant`, `accountantLocked`
- Tên `data-testid`: `vat-accountant-*`
- Tên i18n key: `accountantInfo.*`, `tabs.accountant`, `overview.accountant` (chỉ đổi VALUE, không đổi KEY)
- Tên toast key: `vatAccountantUpdateSuccess/Failed` (chỉ đổi value)

→ Lý do: rename internal sẽ cascade tới permissions BE, tests, RBAC config; còn UI label chỉ đổi value là đủ.

---

## Files PHẢI sửa

### A. COMPLETED hard-lock
1. `src/lib/vat-status-transitions.ts` — `canTransition`:
   ```ts
   if (current === VatRequestStatus.COMPLETED) return false
   return current !== target
   ```
   Update doc comment.

### B. Accountant lock on terminal
2. `src/components/app/sheet/vat-request-detail-sheet/vat-request-detail-sheet.tsx` line 91:
   ```ts
   const accountantLocked = isTerminal || !canEditAccountant
   ```
   (Hiện tại: `const accountantLocked = !canEditAccountant`)

### C. Rename labels
3. `src/locales/vi/vatAdmin.json`:
   - `accountantInfo.title`: "KẾ TOÁN INFO" → **"PHÁT HÀNH HOÁ ĐƠN"**
   - `accountantInfo.confirmTitle`: "Cập nhật thông tin kế toán" → **"Cập nhật số hoá đơn phát hành"**
   - `accountantInfo.confirmDescription`: "Xác nhận cập nhật số hoá đơn cho yêu cầu này?" → giữ nguyên (đã ok)
   - `tabs.accountant`: "Kế toán" → **"Phát hành HĐ"**
   - `overview.accountant`: "KẾ TOÁN" → **"PHÁT HÀNH HOÁ ĐƠN"**
   - `transition.invoiceHint`: replace cụm `"Kế toán"` (trong dấu nháy) → `"Phát hành HĐ"`. Full string mới: `"Nếu đã lưu sẵn ở tab \"Phát hành HĐ\" thì hệ thống tự điền — chỉ cần kiểm tra rồi xác nhận."`
   - `transition.description.REJECTED`: cụm "kế toán dùng để giải thích" → giữ nguyên (là noun chỉ vai trò người, không phải tên section).

4. `src/locales/en/vatAdmin.json`:
   - `accountantInfo.title`: "ACCOUNTANT INFO" → **"INVOICE ISSUANCE"**
   - `accountantInfo.confirmTitle`: "Update accountant info" → **"Update issued invoice number"**
   - `accountantInfo.confirmDescription`: similar mapping (nếu có)
   - `tabs.accountant`: "Accountant" → **"Issuance"**
   - `overview.accountant`: "ACCOUNTANT" → **"INVOICE ISSUANCE"**
   - `transition.invoiceHint`: replace cụm `"Accountant"` → `"Issuance"`
   - `transition.description.REJECTED`: cụm "accountant uses it" → giữ nguyên (noun chỉ vai trò).

5. `src/locales/vi/toast.json` lines 486-487:
   - `vatAccountantUpdateSuccess`: "Cập nhật thông tin kế toán thành công." → **"Cập nhật số hoá đơn phát hành thành công."**
   - `vatAccountantUpdateFailed`: "Cập nhật thông tin kế toán thất bại." → **"Cập nhật số hoá đơn phát hành thất bại."**

6. `src/locales/en/toast.json` lines 486-487:
   - `vatAccountantUpdateSuccess`: "Accountant info updated successfully." → **"Issued invoice number updated successfully."**
   - `vatAccountantUpdateFailed`: "Failed to update accountant info." → **"Failed to update issued invoice number."**

### Tests cần update
7. `src/tests/components/sheet/vat-request-detail-sheet/accountant-info-section.test.tsx`:
   - Thêm test verify: khi `isLocked` true → save button hidden (đã có pattern), inputs `disabled`. (Có thể đã có test này — verify hoặc augment.)
8. `src/tests/components/sheet/vat-request-detail-sheet/vat-request-detail-sheet.test.tsx`:
   - Test mới: `'hides all transition buttons when status is COMPLETED (hard terminal)'` — render với `status: COMPLETED`, assert `vat-status-workflow-section` không có button nào (queryAllBy returns []).
   - Test cũ `'renders transition buttons even from COMPLETED (terminal, free transitions)'` (nếu được thêm trong task-2) — **cần update hoặc xoá** vì behavior đã đảo ngược. COMPLETED không còn show transition buttons.
   - Test mới: `'shows transition buttons from REJECTED (still allowed)'` — render với `status: REJECTED`, verify PENDING+PROCESSING+COMPLETED buttons hiện (REJECTED bị hide vì same status).
   - Test mới hoặc cập nhật: verify accountant section locked khi terminal (chuyển props/snapshot status sang COMPLETED, assert save button hidden).
9. `src/tests/schemas/vat-admin.test.ts` — không cần đổi vì schema không phụ thuộc canTransition.

### Files tham chiếu (không sửa)
- `src/components/app/dialog/status-transition-confirm-dialog.tsx` — không cần đổi (dialog hiển thị theo target status, không quan tâm current).
- `src/hooks/use-vat-admin.ts` — không cần đổi.
- `src/types/vat.type.ts` — không cần đổi.

---

## Ràng buộc

### MUST
- KHÔNG commit. Working tree only.
- `npm run lint` pass.
- `npm run test` pass.
- `npx tsc --noEmit` pass.
- Giữ tất cả internal names (file, component, hook, permission, variable, testid, i18n key).
- Chỉ đổi user-facing VALUE trong file locale.
- REJECTED vẫn cho transition tự do (chỉ COMPLETED là hard lock).

### MUST NOT
- Không rename file `accountant-info-section.tsx`.
- Không rename component `AccountantInfoSection`.
- Không đổi `IUpdateVatStatusBody` shape.
- Không đụng public VAT page, landing.
- Không đổi tên permission code.

---

## Verification

```bash
npx eslint src/lib/vat-status-transitions.ts src/components/app/sheet/vat-request-detail-sheet/ src/locales/
npx tsc --noEmit
npm run test
```

Verify thủ công bằng grep:
```bash
grep -n "kế toán\|Kế toán\|KẾ TOÁN\|accountant info\|Accountant info\|ACCOUNTANT INFO" src/locales/
```
→ Còn lại chỉ những chỗ chỉ vai trò người, không phải tên section.

---

## Report

`.superpowers/sdd/task-3-report.md`:
- Status
- Files modified (expect ~6-8 files)
- Test output (lint, tsc, npm run test)
- Self-review checklist
- Concerns nếu có
