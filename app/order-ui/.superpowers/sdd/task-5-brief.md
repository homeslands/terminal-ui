# Task: Refactor `table-payment-screen.tsx` (955 dòng → tách thành 4 file ≤ 350 dòng/file)

## Mục tiêu
Tách `src/components/staff/table-payment-screen.tsx` thành các module ngắn gọn, dễ maintain. **Hành vi runtime giữ NGUYÊN 100%** — đây là refactor, không phải feature change. Mọi state, effect, mutation, navigation, toast, conditional render… phải khớp bit-for-bit.

## Output files

### 1. `src/components/staff/hooks/use-table-payment-session.ts` (NEW HOOK)
Pure logic hook chứa toàn bộ state + side-effect của payment flow.

**State/refs cần lift vào hook:**
- `tab` (Tab) + `setTab`
- `amount` + `setAmount`
- `qrCode` + `setQrCode`
- `isLoading` + `setIsLoading`
- `isPolling` + `setIsPolling`
- `isPaid` + `setIsPaid`
- `initError` + `setInitError`
- `pollingRef`, `hasTriggeredAutoInit`, `initAttemptRef`

**Functions extract:**
- `stopPolling` (useCallback)
- `triggerInitiateTransfer` (useCallback)
- `handleConfirm` — full payment confirm flow (tab cash/transfer/card)
- `handleTabChange` (useCallback)
- `handlePaymentSuccess` (useCallback)

**Effects extract:**
- useEffect lifecycle stopPolling cleanup
- useEffect auto-init transfer khi `tab === 'transfer' && !qrCode && !initError && !hasTriggeredAutoInit`
- useEffect khi `isPaid === true` → navigate hoặc onPaymentSuccess

**Mutations hook nội tại** (giữ trong hook):
- `initiatePaymentAsync` (useInitiatePayment)
- `getOrderProvisionalBill` (useGetOrderProvisionalBill) — return `isPrinting` cho UI

**Hook signature:**
```ts
interface UseTablePaymentSessionInput {
  id: string
  orderSlug: string | undefined
  total: number
  isOrderEditable: boolean
  onPaymentSuccess?: () => void
  closeSession: (id: string) => void
  refetchOrder: () => void
}

interface UseTablePaymentSessionReturn {
  tab: Tab
  amount: number
  qrCode: string
  isLoading: boolean
  initError: string | null
  isPrinting: boolean
  setAmount: (v: number) => void
  handleTabChange: (next: Tab) => void
  handleConfirm: () => Promise<void>
  triggerInitiateTransfer: () => Promise<void>
  onPrintProvisional: () => void
}
```

### 2. `src/components/staff/table-payment-header.tsx` (NEW COMPONENT)
Sticky header — PosPageHeader composition. Hiện chỉ render khi `!hideHeader`.

**Extract:** lines ~591-633 (toàn bộ `{!hideHeader && <PosPageHeader ... />}`)

**Props:**
```ts
interface TablePaymentHeaderProps {
  hideHeader: boolean
  id: string
  session: TableSession
  orderData: IOrder | undefined  // type chính xác lấy từ file gốc
  onBack?: () => void
}
```

Note: backTo path là `tableOrderPath(id)` — import tương ứng.

### 3. `src/components/staff/table-payment-summary.tsx` (NEW COMPONENT)
Left column — danh sách items, breakdown giá, nút Huỷ đơn.

**Extract:** lines ~637-855 (toàn bộ block `<div className="flex min-h-0 flex-col px-2">`)
- Bao gồm: alternate back button khi `hideHeader && onBack` (lines 638-660)
- Items list `merged.map(...)` (lines 662-712)
- Price breakdown (subTotal / promotion / voucher / VAT / total) (lines 747-862)
- Inline "Huỷ đơn" button (đã thay vào ở patch trước, line ~840-852)

**Props:**
```ts
interface TablePaymentSummaryProps {
  // Layout
  hideHeader: boolean
  onBack?: () => void
  id: string
  session: TableSession
  orderData: IOrder | undefined

  // Items + voucher
  merged: MergedItem[]  // type lấy từ file gốc
  selectedVoucher: IVoucher | null

  // Price breakdown
  subTotalBeforeDiscount: number
  promotionDiscount: number
  voucherDiscount: number
  preVatTotal: number
  totalVatAmount: number
  totalWithDiscount: number

  // Action
  onCancel: () => void
}
```

### 4. `src/components/staff/table-payment-screen.tsx` (REWRITTEN, RÚT GỌN)
Composition layer. Giữ lại:
- Top-level state: `confirmCancel`, `clearCustomerOpen`
- Voucher/customer logic: `selectedCustomer`, `effectiveCustomer`, `merged`, `orderItemsForVoucher`, `selectedVoucher`, `handleApplyVoucher`, `handleRemoveVoucher`, `useApplyVoucher/useRemoveAppliedVoucher`
- All derivations: `feTotal`, `feSubTotalBeforeDiscount`, `totalVatAmount`, `subTotalBeforeDiscount`, `promotionDiscount`, `voucherDiscount`, `totalWithDiscount`, `isOrderEditable`, `preVatTotal`
- `useOwnerSync`, `useOrderBySlug`, `useDeletePublicOrder` (cho ConfirmCancelDialog), `useTableSessions`
- Early returns (not-found, payment-success)
- Render: `<TablePaymentHeader>` + main grid 2 cols (`<TablePaymentSummary>` left + `<PaymentPanel customerSlot>` right) + dialogs (ConfirmCancelDialog, ConfirmClearCustomerDialog)
- Wire hook: pass `id, orderSlug, total=totalWithDiscount, isOrderEditable, onPaymentSuccess, closeSession, refetchOrder` → spread results vào PaymentPanel + handleTabChange

**Expected size:** ~350-450 dòng (tuỳ structure).

---

## Files PHẢI KHÔNG đổi
- `payment-panel.tsx`, `confirm-cancel-dialog.tsx`, `confirm-clear-customer-dialog.tsx`, `staff-table-voucher-sheet.tsx`, `staff-customer-search-input.tsx`, `pos-page-header.tsx`, `pos-not-found.tsx`, `payment-success-screen.tsx` — không touch.
- Hooks `useInitiatePayment`, `useGetOrderProvisionalBill`, `useOrderBySlug`, `useDeletePublicOrder`, `useTableSessions`, `useOwnerSync`, `useApplyVoucher`, `useRemoveAppliedVoucher` — không touch.

## Ràng buộc

### MUST
- **KHÔNG đổi behavior runtime.** Mọi flow phải work y như trước:
  - Tab cash: nhập tiền, xác nhận, dialog confirm, mutation
  - Tab transfer: auto-init khi vào tab, polling, payment success → navigate
  - Tab card: confirm dialog
  - Polling interval, retry logic, error handling không đổi
  - Toast messages: VI fallback, BE message console.error
- Giữ TẤT CẢ `data-testid` ở vị trí cũ trên DOM tương ứng.
- Type-safe: dùng types chính xác từ file gốc (vd `IOrder`, `TableSession`, `IVoucher`, `Tab`).
- `npm run lint` pass.
- `npx tsc --noEmit` pass.
- `npm run test` pass (778 tests). Có test nào assert structure đặc biệt cần verify.

### MUST NOT
- KHÔNG commit, KHÔNG git add.
- KHÔNG thêm feature mới, refactor logic sâu hơn scope.
- KHÔNG move types ra file riêng (giữ chỗ cũ cho dễ trace).
- KHÔNG đổi i18n key, route, store action.
- KHÔNG xoá comment giải thích nghiệp vụ (vd "Override session.orderSlug khi URL có ?order=...", "tránh race với session stale...").

---

## Workflow cho implementer

1. **Đọc** `src/components/staff/table-payment-screen.tsx` (955 lines) — full file, hiểu structure.
2. **Đọc** các sub-component đang dùng (`payment-panel.tsx`, `confirm-cancel-dialog.tsx`, etc.) — chỉ skim cho biết props, không sửa.
3. **Tạo 3 file mới** (hook + 2 component) theo spec ở trên.
4. **Rewrite** `table-payment-screen.tsx` thành composition layer.
5. **Verification:**
   ```bash
   npx eslint src/components/staff/
   npx tsc --noEmit
   npm run test
   ```
   Tất cả phải pass. Test fail (nếu có) phải fix bằng cách điều chỉnh extraction để giữ behavior, KHÔNG sửa test assertions.
6. **Tự re-read diff** sau khi xong — confirm:
   - Tab cash flow ổn (state tab, amount, dialog confirm)
   - Tab transfer flow ổn (auto-init, polling, success)
   - Tab card flow ổn
   - Voucher apply/remove ổn
   - Customer select/clear ổn
   - Huỷ đơn ổn
   - Print provisional ổn
7. **Báo cáo** vào `.superpowers/sdd/task-5-report.md` theo format chuẩn (Status, Files changed, LOC trước/sau, Verification output, Self-review checklist, Concerns).

## Report format
```
# Task-5 Report — Refactor table-payment-screen

## Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
NOT committed per user instruction — left in working tree.

## Files created
- src/components/staff/hooks/use-table-payment-session.ts (N lines)
- src/components/staff/table-payment-header.tsx (N lines)
- src/components/staff/table-payment-summary.tsx (N lines)

## Files modified
- src/components/staff/table-payment-screen.tsx (955 → N lines)

## Verification
- npx eslint src/components/staff/ → (output)
- npx tsc --noEmit → (output)
- npm run test → (tail)

## Self-review checklist
- [ ] Hành vi 3 tab payment giữ nguyên
- [ ] Voucher apply/remove giữ nguyên
- [ ] Polling lifecycle giữ nguyên
- [ ] Tất cả data-testid giữ vị trí
- [ ] Comments nghiệp vụ giữ nguyên
- [ ] Không sửa file ngoài scope

## Concerns
(any tradeoffs)
```
