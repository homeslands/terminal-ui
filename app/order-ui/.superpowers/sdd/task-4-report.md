# Task 4 Report: Remove "Phát hành HĐ" Tab + Dead Code Cleanup

**Status: COMPLETED**

---

## Summary

Removed the "Phát hành HĐ" (accountant) tab from the VAT detail sheet and cleaned all related dead code. All verification checks pass.

---

## Files Changed

### Deleted (2 files)
- `src/components/app/sheet/vat-request-detail-sheet/accountant-info-section.tsx`
- `src/tests/components/sheet/vat-request-detail-sheet/accountant-info-section.test.tsx`

### Modified (10 files)

**Components:**
- `src/components/app/sheet/vat-request-detail-sheet/vat-request-detail-sheet.tsx`
  - Removed `import { AccountantInfoSection }` 
  - Removed `canEditAccountant` from `useHasVatPermission()` destructure
  - Removed `accountantLocked` variable
  - Removed `<TabsTrigger value="accountant" ...>` and its `<TabsContent>` block
  - Updated inline comment (removed reference to "Kế toán (edit)")
  - Tab list now has 2 tabs: overview + customer

**Hooks:**
- `src/hooks/use-vat-admin.ts`
  - Removed `useUpdateAccountantInfo` function
  - Removed `canEditAccountant` field from `useHasVatPermission` return
  - Removed `VatRequestStatus` import (no longer needed after removing `useUpdateAccountantInfo`)

**Schemas:**
- `src/schemas/vat-admin.schema.ts`
  - Removed `vatUpdateAccountantSchema` export
  - Removed `TVatUpdateAccountant` type export

**i18n:**
- `src/locales/vi/vatAdmin.json`: removed `accountantInfo.{title, save, confirmTitle, confirmDescription}`, removed `tabs.accountant`. Kept `accountantInfo.invoiceNumber`, `overview.accountant`.
- `src/locales/en/vatAdmin.json`: same pattern.
- `src/locales/vi/toast.json`: removed `vatAccountantUpdateSuccess`, `vatAccountantUpdateFailed`.
- `src/locales/en/toast.json`: same pattern.

**Tests:**
- `src/tests/components/sheet/vat-request-detail-sheet/vat-request-detail-sheet.test.tsx`
  - Removed `useUpdateAccountantInfo` and `canEditAccountant` from mock
  - Updated "renders 3 tabs" → "renders 2 tabs" (now asserts accountant tab absent)
  - Removed "locks accountant section" test
- `src/tests/schemas/vat-admin.test.ts`
  - Removed `vatUpdateAccountantSchema` import
  - Removed entire `describe('vatUpdateAccountantSchema', ...)` block (3 tests)
- `src/tests/hooks/use-vat-admin.test.tsx`
  - Removed `useUpdateAccountantInfo` import and `VatRequestStatus` import
  - Removed `describe('useUpdateAccountantInfo', ...)` block (2 tests)
  - Removed `canEditAccountant` field from `useHasVatPermission` assertions
- `src/tests/app/system/vat-request/page.test.tsx`
  - Removed `canEditAccountant: true` from `useHasVatPermission` mock

---

## Verification Results

### ESLint
```
npx eslint src/components/app/sheet/vat-request-detail-sheet/ src/hooks/use-vat-admin.ts src/schemas/vat-admin.schema.ts
```
→ No output (zero errors)

### TypeScript
```
npx tsc --noEmit
```
→ No output (zero errors)

### Tests
```
npm run test
```
→ Test Files: 98 passed (98)
→ Tests: 778 passed | 1 skipped (779)
→ All pass (skipped test is pre-existing, unrelated to this task)

### Dead Reference Grep
```
grep -rn "AccountantInfoSection|useUpdateAccountantInfo|vatUpdateAccountantSchema|TVatUpdateAccountant|accountantLocked|canEditAccountant|vat-tab-accountant|tabs.accountant|vatAccountantUpdate" src/
```
→ Only 1 remaining hit:
  `vat-request-detail-sheet.test.tsx:63: expect(screen.queryByTestId('vat-tab-accountant')).not.toBeInTheDocument()`
  This is **intentional** — the test explicitly asserts the accountant tab is absent.

---

## Constants Preserved

- `src/constants/vat-permissions.ts` — `EDIT_ACCOUNTANT: 'EDIT_ACCOUNTANT_INFO'` unchanged. Not modified.
- `src/tests/constants/vat-permissions.test.ts` — not modified.
- `src/components/app/sheet/vat-request-detail-sheet/overview-tab.tsx` — not modified.
- `src/components/app/sheet/vat-request-detail-sheet/customer-info-section.tsx` — not modified.
- `src/components/app/dialog/status-transition-confirm-dialog.tsx` — not modified.

---

## Self-Review

- No new files created.
- No commits made.
- `VAT_PERMISSIONS.EDIT_ACCOUNTANT` constant preserved in `vat-permissions.ts`.
- `accountantInfo.invoiceNumber` i18n key preserved (used in overview-tab.tsx).
- `overview.accountant` i18n key preserved (used in overview-tab.tsx as group header).
- BE API types/endpoints untouched.
- Working tree only, no git add/commit.
