# POS Light/Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all staff POS (đặt hộ) screens respond correctly to the global light/dark theme toggle, matching the pattern already used by the rest of the app.

**Architecture:** The codebase maps Tailwind classes (`bg-pos-bg`, `text-pos-text`, etc.) to CSS custom properties (`--pos-*`). Tailwind's `darkMode: ['class']` strategy means that adding a `.dark { --pos-* }` override block to `index.css` is the only change required for all token-based components. Four files bypass the token system with hardcoded hex values — they need a one-time class replacement. No Tailwind config changes are needed.

**Tech Stack:** Tailwind CSS (class-based dark mode), CSS custom properties, Vitest, React Testing Library, React Router v6

---

## Context: How the main app does it

`tailwind.config.js` line 3: `darkMode: ['class']`

`src/index.css` lines 131–190: The main app defines HSL design tokens in `:root` (light values) and overrides them in `.dark { ... }` (dark values). The `ThemeProvider` component (`src/components/app/theme-provider.tsx`) adds or removes the `dark` class on `<html>` based on the stored theme preference.

**The same pattern applies to POS tokens.** Currently all `pos-*` vars live in `:root` with dark-only hex values. Moving them to `.dark` and adding light values to `:root` is all that is needed for the ~150 token-based class usages across POS components.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/index.css:112-128` | Split `pos-*` into `:root` (light) and `.dark` (dark) |
| Modify | `src/app/staff/receipt.tsx` | 8 hardcoded hex → `pos-*` tokens |
| Modify | `src/app/staff/invoice.tsx` | 8 hardcoded hex → `pos-*` tokens |
| Modify | `src/components/staff/invoice-form.tsx` | 10 hardcoded hex → `pos-*` tokens |
| Modify | `src/components/staff/payment-panel.tsx:122` | 1 `text-[#888]` → `text-pos-muted` |
| Create | `src/tests/components/staff/invoice-form.test.tsx` | Token usage tests |
| Create | `src/tests/components/staff/receipt-page.test.tsx` | Token usage tests |
| Create | `src/tests/components/staff/invoice-page.test.tsx` | Token usage tests |

---

## Hex → Token Reference

Every hardcoded hex in POS files maps 1:1 to an existing `pos-*` token:

| Hardcoded | Token class | Token |
|-----------|-------------|-------|
| `#0e0e0e` | `bg-pos-bg` | `--pos-bg` |
| `#111`, `#111111` | `bg-pos-surface` | `--pos-surface` |
| `#1a1a1a` | `bg-pos-card` | `--pos-card` |
| `#2a2a2a` | `border-pos-border` / `bg-pos-border` | `--pos-border` |
| `#888`, `#888888` | `text-pos-muted` | `--pos-muted` |
| `#f5f0e8` | `text-pos-text` | `--pos-text` |
| `#C9A84C` | `text-pos-gold` / `bg-pos-gold` / `border-pos-gold` | `--pos-gold` |

---

## Task 1: Define light/dark `pos-*` CSS variables

**Files:**
- Modify: `src/index.css:112-128`

- [ ] **Step 1: Replace the `pos-*` token block in `src/index.css`**

Find and replace the existing block (lines 112–128):

```css
/* ─── Staff POS design tokens ───────────────────────────────────────────────
   Always dark-only. Reference via Tailwind: bg-pos-surface, text-pos-gold, etc.
   ─────────────────────────────────────────────────────────────────────────── */
:root {
  --pos-bg:      #0e0e0e; /* page background                */
  --pos-surface: #111111; /* panel / header background      */
  --pos-card:    #1a1a1a; /* card / dialog background       */
  --pos-input:   #141414; /* text input background          */
  --pos-elevated:#222222; /* slightly elevated surface      */
  --pos-border:  #2a2a2a; /* dividers / borders             */
  --pos-hover:   #333333; /* hover state background         */
  --pos-faint:   #444444; /* placeholder / very dim text    */
  --pos-dim:     #555555; /* dim secondary text             */
  --pos-muted:   #888888; /* muted labels / captions        */
  --pos-text:    #f5f0e8; /* primary warm-white text        */
  --pos-gold:    #C9A84C; /* brand gold accent              */
}
```

With this new block:

```css
/* ─── Staff POS design tokens ───────────────────────────────────────────────
   Light values in :root; dark overrides in .dark.
   Reference via Tailwind: bg-pos-surface, text-pos-gold, border-pos-border.
   ─────────────────────────────────────────────────────────────────────────── */
:root {
  --pos-bg:      #f7f4ef; /* warm cream page background     */
  --pos-surface: #eeebe4; /* warm off-white panel/header    */
  --pos-card:    #ffffff; /* card / dialog background       */
  --pos-input:   #f9f7f4; /* text input background          */
  --pos-elevated:#e8e4dc; /* slightly elevated surface      */
  --pos-border:  #d4cfc7; /* warm light border              */
  --pos-hover:   #dedad3; /* hover state background         */
  --pos-faint:   #b8b4ae; /* placeholder / very dim text    */
  --pos-dim:     #8a8680; /* dim secondary text             */
  --pos-muted:   #6b6762; /* muted labels / captions        */
  --pos-text:    #1a1814; /* near-black warm text           */
  --pos-gold:    #C9A84C; /* brand gold accent (unchanged)  */
}

.dark {
  --pos-bg:      #0e0e0e;
  --pos-surface: #111111;
  --pos-card:    #1a1a1a;
  --pos-input:   #141414;
  --pos-elevated:#222222;
  --pos-border:  #2a2a2a;
  --pos-hover:   #333333;
  --pos-faint:   #444444;
  --pos-dim:     #555555;
  --pos-muted:   #888888;
  --pos-text:    #f5f0e8;
  --pos-gold:    #C9A84C;
}
```

- [ ] **Step 2: Verify visually in the browser**

```bash
npm run dev
```

Open `http://localhost:5173/staff`. Use the SettingsDropdown (top-right of the POS header that was added in the previous session) to toggle between dark and light.

Check on each screen that responds to the toggle immediately:
- **Floor plan** `/staff` — table cards, background, borders
- **Table order** `/staff/table/<any-id>` — menu panel, category sidebar, order summary
- **Payment** `/staff/table/<id>/payment`

Expected dark mode: near-black backgrounds (`#0e0e0e`), warm-white text (`#f5f0e8`), gold accents.  
Expected light mode: cream backgrounds (`#f7f4ef`), near-black text (`#1a1814`), same gold accents.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(pos): add light-mode palette for pos-* CSS tokens"
```

---

## Task 2: Tokenize `invoice-form.tsx`

`InvoiceForm` is a self-contained component (no router hooks, no Zustand) — easiest to test.

**Files:**
- Modify: `src/components/staff/invoice-form.tsx`
- Create: `src/tests/components/staff/invoice-form.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/tests/components/staff/invoice-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InvoiceForm } from '@/components/staff/invoice-form'

const noop = vi.fn()

describe('InvoiceForm — token classes', () => {
  it('modal container uses bg-pos-surface, border-pos-border, text-pos-text', () => {
    const { container } = render(<InvoiceForm onSubmit={noop} onCancel={noop} />)
    const modal = container.querySelector('.max-w-md') as HTMLElement
    expect(modal).toHaveClass('bg-pos-surface')
    expect(modal).toHaveClass('border-pos-border')
    expect(modal).toHaveClass('text-pos-text')
  })

  it('submit button uses bg-pos-gold', () => {
    render(<InvoiceForm onSubmit={noop} onCancel={noop} />)
    expect(screen.getByRole('button', { name: /xuất hoá đơn/i })).toHaveClass('bg-pos-gold')
  })

  it('cancel button uses border-pos-border', () => {
    render(<InvoiceForm onSubmit={noop} onCancel={noop} />)
    expect(screen.getByRole('button', { name: /hủy/i })).toHaveClass('border-pos-border')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/components/staff/invoice-form.test.tsx
```

Expected: FAIL — `bg-pos-surface` not present (current class is `bg-[#111]`)

- [ ] **Step 3: Replace all hardcoded hex in `invoice-form.tsx`**

Full updated `src/components/staff/invoice-form.tsx`:

```tsx
import { useState } from 'react'
import type { InvoiceRequest } from '@/types/invoice'

interface Props {
  onSubmit: (req: InvoiceRequest) => void
  onCancel: () => void
}

export function InvoiceForm({ onSubmit, onCancel }: Props) {
  const [buyerName, setBuyerName] = useState('')
  const [buyerTaxCode, setBuyerTaxCode] = useState('')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')

  const canSubmit =
    buyerName.trim().length > 0 &&
    buyerTaxCode.trim().length > 0 &&
    buyerAddress.trim().length > 0 &&
    buyerEmail.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-lg border border-pos-border bg-pos-surface p-6 text-pos-text">
        <h2 className="text-lg font-semibold">Thông tin xuất hoá đơn</h2>
        <div className="mt-4 space-y-3">
          <Field label="Tên người mua" value={buyerName} onChange={setBuyerName} />
          <Field label="Mã số thuế" value={buyerTaxCode} onChange={setBuyerTaxCode} />
          <Field label="Địa chỉ" value={buyerAddress} onChange={setBuyerAddress} />
          <Field label="Email" type="email" value={buyerEmail} onChange={setBuyerEmail} />

          <div>
            <span className="mb-1 block text-xs text-pos-muted">Phương thức thanh toán</span>
            <div className="grid grid-cols-2 overflow-hidden rounded border border-pos-border">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 text-sm font-semibold ${paymentMethod === 'cash' ? 'bg-pos-gold text-black' : 'bg-pos-card'}`}
              >
                TIỀN MẶT
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`py-2 text-sm font-semibold ${paymentMethod === 'transfer' ? 'bg-pos-gold text-black' : 'bg-pos-card'}`}
              >
                CHUYỂN KHOẢN
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-pos-border py-2 text-sm font-semibold"
          >
            HỦY
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                buyerName: buyerName.trim(),
                buyerTaxCode: buyerTaxCode.trim(),
                buyerAddress: buyerAddress.trim(),
                buyerEmail: buyerEmail.trim(),
                paymentMethod,
              })
            }
            className="rounded bg-pos-gold py-2 text-sm font-bold text-black disabled:opacity-40"
          >
            XUẤT HOÁ ĐƠN
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-pos-muted">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-pos-border bg-pos-card px-3 py-2 text-sm text-pos-text"
      />
    </label>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/tests/components/staff/invoice-form.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/invoice-form.tsx src/tests/components/staff/invoice-form.test.tsx
git commit -m "feat(pos): tokenize invoice-form hardcoded hex colors"
```

---

## Task 3: Tokenize `receipt.tsx`

**Files:**
- Modify: `src/app/staff/receipt.tsx`
- Create: `src/tests/components/staff/receipt-page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/tests/components/staff/receipt-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StaffReceiptPage from '@/app/staff/receipt'

vi.mock('@/hooks/useTableSessions', () => ({
  useTableSessions: () => ({ sessions: {}, closeSession: vi.fn() }),
}))

function renderPage(id = 'no-such-table') {
  render(
    <MemoryRouter initialEntries={[`/staff/table/${id}`]}>
      <Routes>
        <Route path="/staff/table/:id" element={<StaffReceiptPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StaffReceiptPage — token classes', () => {
  it('not-found wrapper uses bg-pos-bg and text-pos-text', () => {
    renderPage()
    const wrapper = screen.getByText(/không tìm thấy phiên/i).closest('div')!
    expect(wrapper).toHaveClass('bg-pos-bg')
    expect(wrapper).toHaveClass('text-pos-text')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/components/staff/receipt-page.test.tsx
```

Expected: FAIL — `bg-pos-bg` not present (current class is `bg-[#0e0e0e]`)

- [ ] **Step 3: Replace all hardcoded hex in `receipt.tsx`**

Full updated `src/app/staff/receipt.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ReceiptPreview } from '@/components/staff/receipt-preview'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_TABLES } from '@/data/staff-data'

export default function StaffReceiptPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { sessions, closeSession } = useTableSessions()
  const isDraft = params.get('draft') !== 'false'

  const [issuedAt] = useState(() => new Date().toISOString())

  const table = useMemo(() => STAFF_TABLES.find((t) => t.id === id), [id])
  const session = sessions[id]

  if (!table || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pos-bg text-pos-text">
        <p>
          Không tìm thấy phiên.{' '}
          <Link to="/staff" className="text-pos-gold underline">← Sơ đồ</Link>
        </p>
      </div>
    )
  }

  const handleDone = () => {
    closeSession(id)
    navigate('/staff')
  }

  return (
    <div className="min-h-screen bg-pos-bg text-pos-text">
      <header className="flex items-center justify-between border-b border-pos-border bg-pos-surface px-4 py-3 print:hidden">
        <Link to={`/staff/table/${id}`} className="text-sm text-pos-muted hover:text-pos-gold">
          ← Quay lại
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-pos-gold px-3 py-1 text-xs font-bold text-pos-gold"
          >
            IN
          </button>
          {!isDraft && (
            <button
              type="button"
              onClick={handleDone}
              className="rounded bg-emerald-800 px-3 py-1 text-xs font-bold text-emerald-200"
            >
              HOÀN TẤT
            </button>
          )}
        </div>
      </header>

      <main className="bg-white py-4 print:bg-white print:py-0">
        <ReceiptPreview
          tableLabel={table.label}
          orders={session.submittedOrders}
          isDraft={isDraft}
          issuedAt={issuedAt}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/components/staff/receipt-page.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/staff/receipt.tsx src/tests/components/staff/receipt-page.test.tsx
git commit -m "feat(pos): tokenize receipt page hardcoded hex colors"
```

---

## Task 4: Tokenize `invoice.tsx`

**Files:**
- Modify: `src/app/staff/invoice.tsx`
- Create: `src/tests/components/staff/invoice-page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/tests/components/staff/invoice-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import StaffInvoicePage from '@/app/staff/invoice'

vi.mock('@/hooks/useTableSessions', () => ({
  useTableSessions: () => ({ sessions: {}, closeSession: vi.fn() }),
}))

function renderPage(id = 'no-such-table') {
  render(
    <MemoryRouter initialEntries={[`/staff/table/${id}/invoice`]}>
      <Routes>
        <Route path="/staff/table/:id/invoice" element={<StaffInvoicePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StaffInvoicePage — token classes', () => {
  it('not-found wrapper uses bg-pos-bg and text-pos-text', () => {
    renderPage()
    const wrapper = screen.getByText(/thiếu dữ liệu hoá đơn/i).closest('div')!
    expect(wrapper).toHaveClass('bg-pos-bg')
    expect(wrapper).toHaveClass('text-pos-text')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/tests/components/staff/invoice-page.test.tsx
```

Expected: FAIL — `bg-pos-bg` not present (current class is `bg-[#0e0e0e]`)

- [ ] **Step 3: Replace all hardcoded hex in `invoice.tsx`**

Full updated `src/app/staff/invoice.tsx`:

```tsx
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { InvoicePreview } from '@/components/staff/invoice-preview'
import { buildInvoice } from '@/lib/staff-invoice'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_ADMIN_SETTINGS } from '@/data/staff-data'

export default function StaffInvoicePage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessions, closeSession } = useTableSessions()
  const session = sessions[id]

  const invoice = useMemo(() => {
    if (!session || !session.invoiceRequest) return null
    return buildInvoice(
      session,
      session.invoiceRequest,
      {
        name: STAFF_ADMIN_SETTINGS.restaurantName,
        address: STAFF_ADMIN_SETTINGS.address,
        taxCode: STAFF_ADMIN_SETTINGS.taxCode,
        phone: STAFF_ADMIN_SETTINGS.phone,
      },
      STAFF_ADMIN_SETTINGS.vatRate,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!session || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pos-bg text-pos-text">
        <p>
          Thiếu dữ liệu hoá đơn.{' '}
          <Link to="/staff" className="text-pos-gold underline">← Sơ đồ</Link>
        </p>
      </div>
    )
  }

  const handleDone = () => {
    closeSession(id)
    navigate('/staff')
  }

  return (
    <div className="min-h-screen bg-pos-bg text-pos-text">
      <header className="flex items-center justify-between border-b border-pos-border bg-pos-surface px-4 py-3 print:hidden">
        <Link to={`/staff/table/${id}/payment`} className="text-sm text-pos-muted hover:text-pos-gold">
          ← Quay lại
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-pos-gold px-3 py-1 text-xs font-bold text-pos-gold"
          >
            IN
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="rounded bg-emerald-800 px-3 py-1 text-xs font-bold text-emerald-200"
          >
            HOÀN TẤT
          </button>
        </div>
      </header>

      <main className="bg-white print:bg-white">
        <InvoicePreview invoice={invoice} />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/tests/components/staff/invoice-page.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/staff/invoice.tsx src/tests/components/staff/invoice-page.test.tsx
git commit -m "feat(pos): tokenize invoice page hardcoded hex colors"
```

---

## Task 5: Tokenize `payment-panel.tsx`

One occurrence: `text-[#888]` at line 122.

**Files:**
- Modify: `src/components/staff/payment-panel.tsx:122`

- [ ] **Step 1: Apply the change**

In `src/components/staff/payment-panel.tsx`, find line 122:
```tsx
<div className="text-[#888]">The Terminal</div>
```
Change to:
```tsx
<div className="text-pos-muted">The Terminal</div>
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/staff/payment-panel.tsx
git commit -m "feat(pos): tokenize payment-panel hardcoded hex color"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full build**

```bash
npm run build
```

Expected: zero TypeScript errors, zero lint errors, build succeeds.

- [ ] **Step 2: Walk through the full flow in both modes**

```bash
npm run dev
```

Open `http://localhost:5173/staff`. Toggle dark/light with the SettingsDropdown in the POS header.

| Screen | URL pattern | What to confirm |
|--------|-------------|-----------------|
| Floor plan | `/staff` | Table cards, background, gold brand title |
| Table order | `/staff/table/<id>` | Category sidebar, menu grid cards, order summary panel |
| Payment | `/staff/table/<id>/payment` | Payment panel, totals row, The Terminal label (muted) |
| Receipt | `/staff/table/<id>` (via table click) | Header back-link, IN button border in gold |
| Invoice form | Open from payment screen | Modal background, field labels, payment method toggle |
| Invoice page | `/staff/table/<id>/invoice` | Header, back-link, IN button |

Both modes should have consistent contrast. The gold accent (`#C9A84C`) is the same in both modes. Print areas (`main.bg-white`) stay white in both modes — that is correct, since printed receipts/invoices should always be on white.
