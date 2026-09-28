# Task: Bỏ tab "Phát hành HĐ" + dọn dead code liên quan

## Mục tiêu
Tab "Phát hành HĐ" trong VAT detail sheet (chỉ chứa input "Số hoá đơn" + nút Lưu) bị xoá hoàn toàn vì trùng chức năng với dialog "Hoàn thành" trong footer workflow. Kế toán muốn nhập invoice number → bấm "Hoàn thành" trong footer là đủ.

## Files PHẢI xoá
1. `src/components/app/sheet/vat-request-detail-sheet/accountant-info-section.tsx`
2. `src/tests/components/sheet/vat-request-detail-sheet/accountant-info-section.test.tsx`

## Files PHẢI sửa

### Components
3. `src/components/app/sheet/vat-request-detail-sheet/vat-request-detail-sheet.tsx`:
   - Xoá `import { AccountantInfoSection } from './accountant-info-section'`
   - Xoá `canEditAccountant` khỏi destructure `useHasVatPermission()` (line ~78)
   - Xoá biến `accountantLocked` (line ~91)
   - Xoá `<TabsTrigger value="accountant" data-testid="vat-tab-accountant">{t('tabs.accountant', ...)}</TabsTrigger>` (line ~150-156 — verify exact line)
   - Xoá `<TabsContent value="accountant">...<AccountantInfoSection ... /></TabsContent>` (block ~178-184)
   - Tab list giờ chỉ còn 2 tab: Tổng quan + Khách (overview + customer).
   - Update inline comment ở line 125-126 nếu còn nhắc "Kế toán (edit)".

### Hooks
4. `src/hooks/use-vat-admin.ts`:
   - Xoá function `useUpdateAccountantInfo` (block ~63-78)
   - Xoá `canEditAccountant: codes.includes(VAT_PERMISSIONS.EDIT_ACCOUNTANT)` khỏi return của `useHasVatPermission` (line ~128). Return giờ chỉ 3 field: canView, canEdit, canUpdateStatus.
   - **GIỮ** `VAT_PERMISSIONS` import (vẫn dùng cho 3 field còn lại).

### Schemas
5. `src/schemas/vat-admin.schema.ts`:
   - Xoá `vatUpdateAccountantSchema` + `TVatUpdateAccountant` type (lines 15-18 + 44).

### i18n
6. `src/locales/vi/vatAdmin.json`:
   - Trong block `accountantInfo`: xoá `title`, `save`, `confirmTitle`, `confirmDescription`. **GIỮ `invoiceNumber`** (vẫn dùng cho overview-tab Row label).
   - Xoá key `tabs.accountant`.
   - **GIỮ** `overview.accountant` ("PHÁT HÀNH HOÁ ĐƠN") — vẫn dùng làm group title trong overview-tab.
7. `src/locales/en/vatAdmin.json`: same pattern.
8. `src/locales/vi/toast.json`:
   - Xoá `vatAccountantUpdateSuccess` và `vatAccountantUpdateFailed` (lines 486-487).
9. `src/locales/en/toast.json`: same pattern.

### Tests
10. `src/tests/components/sheet/vat-request-detail-sheet/vat-request-detail-sheet.test.tsx`:
    - Bỏ test `'locks accountant section (hides save button) when status is COMPLETED'` (component đã xoá).
    - Update test khác có assert `vat-tab-accountant` testid → bỏ assertion đó.
11. `src/tests/schemas/vat-admin.test.ts`:
    - Bỏ tất cả test cho `vatUpdateAccountantSchema`.
12. `src/tests/hooks/use-vat-admin.test.tsx`:
    - Bỏ describe block test `useUpdateAccountantInfo`.
    - Nếu có test cho `useHasVatPermission` assert field `canEditAccountant`, bỏ field đó khỏi assertion.

## Files KHÔNG đổi (vẫn còn dùng)
- `src/constants/vat-permissions.ts` — **GIỮ** `EDIT_ACCOUNTANT: 'EDIT_ACCOUNTANT_INFO'` (constant lưu BE-contract code, có thể BE vẫn cấp permission này; chỉ stop derive ở hook).
- `src/tests/constants/vat-permissions.test.ts` — không sửa.
- `src/components/app/sheet/vat-request-detail-sheet/overview-tab.tsx` — không sửa (vẫn dùng `overview.accountant` + `accountantInfo.invoiceNumber` keys).
- `src/components/app/dialog/status-transition-confirm-dialog.tsx` — không sửa.
- `src/components/app/sheet/vat-request-detail-sheet/customer-info-section.tsx` — không sửa.

---

## Ràng buộc

### MUST
- KHÔNG commit. Working tree only.
- `npm run lint` pass.
- `npx tsc --noEmit` pass.
- `npm run test` pass.
- Tab list của VAT detail sheet còn lại 2 tab: "Tổng quan" + "Thông tin khách". Default tab có thể vẫn là "overview" (verify state initialization của Tabs).

### MUST NOT
- Không đổi `VAT_PERMISSIONS` constant.
- Không đụng `overview-tab.tsx`, `customer-info-section.tsx`, `status-transition-confirm-dialog.tsx`.
- Không đổi BE API endpoints / types.
- Không tạo file mới.

---

## Verification

```bash
npx eslint src/components/app/sheet/vat-request-detail-sheet/ src/hooks/use-vat-admin.ts src/schemas/vat-admin.schema.ts src/locales/
npx tsc --noEmit
npm run test
```

Verify grep:
```bash
grep -rn "AccountantInfoSection\|useUpdateAccountantInfo\|vatUpdateAccountantSchema\|TVatUpdateAccountant\|accountantLocked\|canEditAccountant\|vat-tab-accountant\|tabs.accountant\|vatAccountantUpdate" src/
```
→ Chỉ còn (acceptable): `VAT_PERMISSIONS.EDIT_ACCOUNTANT` constant + test cho constant.

## Report
`.superpowers/sdd/task-4-report.md` — status, files changed, test output, self-review.
