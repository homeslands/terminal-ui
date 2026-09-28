# Staff Payment Screen UX Refactor (Phase 1+2+3)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> **DO NOT git commit per task** — leave changes in working tree for user.

**Goal:** Clean up visual clutter + improve hierarchy của staff payment screen theo chuẩn POS ngành (Square / Toast / Stripe Terminal).

**Risk:** Medium. UI-only refactor, no logic change. Each task is self-contained.

---

## File scope

Primary: `src/app/staff/payment.tsx`
Secondary (may need): `src/components/staff/payment-panel.tsx`

---

## Phase 1 — Visual cleanup

### Task UX-1: Remove redundant labels + counter

- Remove "CHI TIẾT ĐƠN" header label (UPPERCASE tracking-widest)
- Remove "X món" counter
- Remove "KHÁCH HÀNG" label above customer input (input self-descriptive)
- Remove "TỔNG CỘNG" UPPERCASE label (replace with subtle "Tổng tiền")

After:
```tsx
{/* Top of left column — no header section */}
<ul className="flex-1 overflow-y-auto px-4 py-3">
  {/* items */}
</ul>

{/* Customer + voucher — no labels */}
<div className="border-t px-4 py-3 space-y-2">
  <StaffCustomerSearchInput ... />
  <StaffTableVoucherSheet ... />
</div>

{/* Total — no UPPERCASE label */}
<div className="border-t px-4 py-3">
  <div className="flex items-baseline justify-between mb-1">
    <span className="text-sm text-pos-muted">Tổng tiền</span>
    <span className="text-3xl font-bold text-pos-gold">{formatVnd(...)}</span>
  </div>
  ...
</div>
```

### Task UX-2: Total visual upgrade

- `text-xl` → `text-3xl` (24px → 32px)
- Add VAT subtitle: `(Trong đó VAT: X.XXXđ)` italic muted nếu có VAT
- VAT calc: reuse `orderData.invoice.invoiceItems[].vatValue` sum, OR fallback compute from `orderData.orderItems[].variant.product.vatRate`

```tsx
<div className="flex items-baseline justify-between mb-1">
  <span className="text-sm text-pos-muted">Tổng tiền</span>
  <span className="text-3xl font-bold text-pos-gold">{formatVnd(totalWithDiscount)}</span>
</div>
{totalVatAmount > 0 && (
  <p className="text-right text-xs italic text-pos-muted">
    (Trong đó VAT: {formatVnd(totalVatAmount)})
  </p>
)}
```

### Task UX-3: Reduce dividers

Current: 5 `border-b/border-t` separators.
After: 2 max.
- Keep divider between items + customer/voucher section
- Keep divider between customer/voucher + total/actions
- Remove header `border-b` (no header anymore)
- Remove divider within total block

### Task UX-4: Huỷ đơn destructive style

Currently `<Button variant="outline">` cùng style. Change to destructive:

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => setConfirmCancel(true)}
  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
>
  Huỷ đơn
</Button>
```

Subtle red — không scream nhưng visually destructive.

---

## Phase 2 — Consolidation

### Task UX-5: Secondary actions → dropdown

3 buttons "Hoá đơn tạm | Xuất hoá đơn | Huỷ đơn" → reduce visual count.

Approach:
- "Hoá đơn tạm" KEEP inline (frequent action, preview)
- "Xuất hoá đơn" + "Huỷ đơn" → DropdownMenu with 3-dots icon

```tsx
<div className="flex gap-2">
  <Button variant="outline" size="sm" onClick={() => setShowReceipt(true)} className="flex-1">
    Hoá đơn tạm
  </Button>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => setShowInvoiceForm(true)}>
        <FileText className="w-4 h-4 mr-2" />
        Xuất hoá đơn
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setConfirmCancel(true)} className="text-destructive">
        <Trash2 className="w-4 h-4 mr-2" />
        Huỷ đơn
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

> Verify shadcn DropdownMenu is in `@/components/ui` — likely yes. Icons from lucide-react.

### Task UX-6: Compact customer + voucher

Currently mỗi cái 1 row riêng + `space-y-2`. Try inline layout (2-col grid trên desktop):

```tsx
<div className="border-t px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
  <StaffCustomerSearchInput ... />
  <StaffTableVoucherSheet ... />
</div>
```

Or stacked nếu width không đủ. Test responsive — nếu UI quá chật thì revert sang stack.

---

## Phase 3 — Hierarchy boost

### Task UX-7: Right column distinct background

Right column (PaymentPanel) là HERO action area — cần stand out.

```tsx
{/* Right: payment panel */}
<div className="min-h-0 overflow-y-auto bg-pos-card p-6 border-l-2 border-pos-gold/20">
  <PaymentPanel ... />
</div>
```

Changes:
- `bg-pos-surface` → `bg-pos-card` (slightly different tone)
- `p-4` → `p-6` (more breathing room)
- Add `border-l-2 border-pos-gold/20` accent

### Task UX-8: Total + Payment Confirm gold accent

Visual connection: total (gold) + confirm button (gold) should feel connected as the "payment flow path".

In PaymentPanel.tsx, ensure final "Xác nhận thanh toán" button uses `bg-pos-gold text-white` (consistent with total color). Should already be gold from earlier work — verify.

### Task UX-9: Header polish

- Remove "← Quay lại" text — keep only icon arrow
- `TableStatusBadge waiting_payment` may show "Chờ thanh toán" — simplify or remove (status implicit from being on payment screen)

---

## Verification per task

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -3
npx eslint src/app/staff/payment.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

Expect 550/550 throughout (UI-only changes).

## Final smoke test

After all 9 tasks:
1. Reload payment screen
2. Visual compare with before — should feel cleaner, more focused
3. Test responsive: mobile vs desktop
4. Verify all actions still work (Hoá đơn tạm dialog, Xuất hoá đơn, Huỷ đơn, customer select/clear, voucher apply/remove)
5. Confirm dark mode (if app supports) — gold accents should still pop

## Design Decisions

1. **Why no labels**: Industry chuẩn POS (Square, Toast) bỏ labels khi input/section self-descriptive. Less cognitive load.
2. **Why dropdown for secondary**: Reduce visual options without hiding functionality. Match Stripe Terminal pattern.
3. **Why gold accent right column**: Visual cue "this is where payment happens" — guide eye flow naturally.
4. **Why keep "Hoá đơn tạm" inline**: Frequent preview action — stay 1-click.
