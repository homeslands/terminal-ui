# Task 3 Report — COMPLETED hard-lock + accountant lock-on-terminal + rename labels

## Status

**COMPLETED** — all 3 objectives implemented, lint/tsc/tests pass.

---

## Files Modified (8 files)

### Logic / Component

1. **`src/lib/vat-status-transitions.ts`**
   - `canTransition`: added `if (current === VatRequestStatus.COMPLETED) return false` before the same-status check.
   - Updated doc comment to document COMPLETED hard-terminal rule and that REJECTED remains free-transition.

2. **`src/components/app/sheet/vat-request-detail-sheet/vat-request-detail-sheet.tsx`**
   - Line ~91: `const accountantLocked = !canEditAccountant` → `const accountantLocked = isTerminal || !canEditAccountant`
   - Now matches `customerLocked` pattern exactly.

### Locale — value changes only (keys unchanged)

3. **`src/locales/vi/vatAdmin.json`**
   - `accountantInfo.title`: "KẾ TOÁN INFO" → "PHÁT HÀNH HOÁ ĐƠN"
   - `accountantInfo.confirmTitle`: "Cập nhật thông tin kế toán" → "Cập nhật số hoá đơn phát hành"
   - `tabs.accountant`: "Kế toán" → "Phát hành HĐ"
   - `overview.accountant`: "KẾ TOÁN" → "PHÁT HÀNH HOÁ ĐƠN"
   - `transition.invoiceHint`: "Kế toán" (in quotes) → "Phát hành HĐ"

4. **`src/locales/en/vatAdmin.json`**
   - `accountantInfo.title`: "ACCOUNTANT INFO" → "INVOICE ISSUANCE"
   - `accountantInfo.confirmTitle`: "Update accountant info" → "Update issued invoice number"
   - `tabs.accountant`: "Accountant" → "Issuance"
   - `overview.accountant`: "ACCOUNTANT" → "INVOICE ISSUANCE"
   - `transition.invoiceHint`: "Accountant" (in quotes) → "Issuance"

5. **`src/locales/vi/toast.json`**
   - `vatAccountantUpdateSuccess`: "Cập nhật thông tin kế toán thành công." → "Cập nhật số hoá đơn phát hành thành công."
   - `vatAccountantUpdateFailed`: "Cập nhật thông tin kế toán thất bại." → "Cập nhật số hoá đơn phát hành thất bại."
   - (Used Python for replacement due to mixed-tab indentation encoding.)

6. **`src/locales/en/toast.json`**
   - `vatAccountantUpdateSuccess`: "Accountant info updated successfully." → "Issued invoice number updated successfully."
   - `vatAccountantUpdateFailed`: "Failed to update accountant info." → "Failed to update issued invoice number."

### Tests

7. **`src/tests/components/sheet/vat-request-detail-sheet/vat-request-detail-sheet.test.tsx`**
   - Replaced `'renders transition buttons even from COMPLETED (terminal, free transitions)'` with `'hides all transition buttons when status is COMPLETED (hard terminal)'` — asserts workflow section has 0 buttons and all vat-transition-* are absent.
   - Added `'shows transition buttons from REJECTED (still allowed)'` — verifies PENDING/PROCESSING/COMPLETED show, REJECTED hidden (same-status).
   - Added `'locks accountant section (hides save button) when status is COMPLETED'` — verifies `vat-accountant-save` not present.

8. **`src/tests/components/sheet/vat-request-detail-sheet/accountant-info-section.test.tsx`**
   - Updated stale comment on sample (removed "should still be editable via accountantLocked gate (not isTerminal)" — behavior inverted).
   - Renamed `'is editable even when status is COMPLETED (terminal)'` → `'is editable when isLocked is false (regardless of status)'`.
   - Added `'hides save button and disables inputs when isLocked is true'`.

---

## Verification Output

### ESLint
```
npx eslint src/lib/vat-status-transitions.ts src/components/app/sheet/vat-request-detail-sheet/ src/tests/components/sheet/vat-request-detail-sheet/
# Exit 0 — no output
```

### TypeScript
```
npx tsc --noEmit
# Exit 0 — no output
```

### Tests
```
Test Files  99 passed (99)
      Tests  787 passed | 1 skipped (788)
   Duration  16.99s
```

### Grep verification
```bash
grep -rn "kế toán|Kế toán|KẾ TOÁN|accountant info|Accountant info|ACCOUNTANT INFO" src/locales/
```
Only remaining match:
- `vi/vatAdmin.json:92` — "kế toán dùng để giải thích với khách" in `transition.description.REJECTED`
  → Correct: refers to the accountant role (a person), not the section name. Brief says keep this.

---

## Self-Review Checklist

- [x] COMPLETED → `canTransition` returns false for any target
- [x] REJECTED → `canTransition` still allows free transition (only same-status blocked)
- [x] `accountantLocked = isTerminal || !canEditAccountant` — matches customerLocked pattern
- [x] All locale key names unchanged; only values changed
- [x] File `accountant-info-section.tsx` not renamed
- [x] Component `AccountantInfoSection` not renamed
- [x] Hook `useUpdateAccountantInfo` not renamed
- [x] Permission code `EDIT_ACCOUNTANT` / `VAT_PERMISSIONS.EDIT_ACCOUNTANT` not touched
- [x] Variable names `canEditAccountant`, `accountantLocked` not renamed
- [x] `data-testid` `vat-accountant-*` not changed
- [x] i18n keys `accountantInfo.*`, `tabs.accountant`, `overview.accountant` not changed
- [x] Toast keys `vatAccountantUpdateSuccess/Failed` not changed
- [x] Old task-2 test that asserted COMPLETED shows transition buttons — replaced with correct inverse assertion
- [x] No public VAT page touched
- [x] No `IUpdateVatStatusBody` shape changes
- [x] No commit made

## Concerns

None. All changes are isolated to the 8 files above. The `accountant-info-section.tsx` component already correctly hides the save button and disables the input when `isLocked` is true — no component logic change needed beyond the gate in the parent sheet.

---

## Fix: stale i18n fallback strings

Updated 6 stale fallback strings (second arg of `t()` calls) from old label names to new "Phát hành HĐ" terminology across 4 files.

**Files Updated:**
1. `src/components/app/sheet/vat-request-detail-sheet/accountant-info-section.tsx` — 4 fallback strings
2. `src/components/app/sheet/vat-request-detail-sheet/overview-tab.tsx` — 1 fallback string
3. `src/components/app/sheet/vat-request-detail-sheet/vat-request-detail-sheet.tsx` — 1 fallback string
4. `src/components/app/dialog/status-transition-confirm-dialog.tsx` — 1 fallback string (tab reference in hint)

**ESLint Output:**
```
npx eslint src/components/app/sheet/vat-request-detail-sheet/ src/components/app/dialog/status-transition-confirm-dialog.tsx
# Exit 0 — no output
```

**npm test tail:**
```
Test Files  99 passed (99)
      Tests  787 passed | 1 skipped (788)
   Duration  16.67s
```
