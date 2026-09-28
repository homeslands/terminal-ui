# Staff Ordering (POS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained staff-facing POS area under `/staff` that lets servers open tables, add menu items, submit orders, take cash/transfer payments, and print a draft receipt or Vietnamese VAT invoice — all backed by `localStorage`.

**Architecture:** A new `src/app/staff/` page tree (FloorPlan → TableOrder → Payment → Invoice/Receipt) plus reusable `src/components/staff/*` UI parts. A `useTableSessions` hook owns the `terminal_staff_sessions` localStorage key and synchronises React state with storage on every mutation. Pure business logic lives in `src/lib/staff-orders.ts` (merge items) and `src/lib/staff-invoice.ts` (number-to-words + invoice builder). Static seed data and `generatePresets` live in `src/data/staff-data.ts`. Routes are wired through the existing `loadable.tsx` + `router/index.tsx` pattern, but they bypass `SystemLayout` and render directly on a full-screen dark canvas because the staff area is a kiosk-style UI.

**Tech Stack:** TypeScript strict, React 18 + react-router-dom v6, Tailwind v3 (custom hex palette), Zustand-free localStorage hook, Vitest + @testing-library/react, no Zod (spec uses plain state for forms).

---

### File Structure

| Action | Path |
|---|---|
| Create | `src/types/session.ts` |
| Create | `src/types/invoice.ts` |
| Create | `src/data/staff-data.ts` |
| Create | `src/tests/data/staff-data.test.ts` |
| Create | `src/lib/staff-orders.ts` |
| Create | `src/tests/lib/staff-orders.test.ts` |
| Create | `src/lib/staff-invoice.ts` |
| Create | `src/tests/lib/staff-invoice.test.ts` |
| Create | `src/hooks/useTableSessions.ts` |
| Create | `src/hooks/__tests__/useTableSessions.test.tsx` |
| Create | `src/components/staff/table-card.tsx` |
| Create | `src/tests/components/staff/table-card.test.tsx` |
| Create | `src/components/staff/floor-plan.tsx` |
| Create | `src/tests/components/staff/floor-plan.test.tsx` |
| Create | `src/components/staff/menu-panel.tsx` |
| Create | `src/tests/components/staff/menu-panel.test.tsx` |
| Create | `src/components/staff/order-summary.tsx` |
| Create | `src/tests/components/staff/order-summary.test.tsx` |
| Create | `src/components/staff/payment-panel.tsx` |
| Create | `src/tests/components/staff/payment-panel.test.tsx` |
| Create | `src/components/staff/invoice-form.tsx` |
| Create | `src/tests/components/staff/invoice-form.test.tsx` |
| Create | `src/components/staff/receipt-preview.tsx` |
| Create | `src/tests/components/staff/receipt-preview.test.tsx` |
| Create | `src/components/staff/invoice-preview.tsx` |
| Create | `src/tests/components/staff/invoice-preview.test.tsx` |
| Create | `src/components/staff/receipt-dialog.tsx` |
| Create | `src/tests/components/staff/receipt-dialog.test.tsx` |
| Create | `src/app/staff/index.ts` |
| Create | `src/app/staff/floor-plan.tsx` |
| Create | `src/app/staff/table-order.tsx` |
| Create | `src/app/staff/payment.tsx` |
| Create | `src/app/staff/invoice.tsx` |
| Create | `src/app/staff/receipt.tsx` |
| Modify | `src/constants/route.ts` |
| Modify | `src/router/loadable.tsx` |
| Modify | `src/router/index.tsx` |

---

### Task 1: Types

**Files:**
- Create: `src/types/session.ts`
- Create: `src/types/invoice.ts`

No tests — pure type declarations.

- [ ] **Step 1: Create `src/types/session.ts`**

```ts
import type { InvoiceRequest } from './invoice'

export interface OrderItem {
  menuItemId: string
  name: string
  priceNum: number
  price: string
  quantity: number
  note: string
}

export interface SubmittedOrder {
  id: string
  items: OrderItem[]
  submittedAt: string
}

export type TableSessionStatus = 'empty' | 'serving' | 'waiting_payment' | 'done'

export interface TableSession {
  tableId: string
  status: TableSessionStatus
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  openedAt: string
  invoiceRequest?: InvoiceRequest
}
```

- [ ] **Step 2: Create `src/types/invoice.ts`**

```ts
export interface InvoiceRequest {
  buyerName: string
  buyerTaxCode: string
  buyerAddress: string
  buyerEmail: string
  paymentMethod: 'cash' | 'transfer'
}

export interface SellerInfo {
  name: string
  address: string
  taxCode: string
  phone: string
}

export interface InvoiceLineItem {
  name: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface InvoiceData {
  number: string
  symbol: string
  issuedAt: string
  seller: SellerInfo
  buyer: InvoiceRequest
  items: InvoiceLineItem[]
  subtotal: number
  vatRate: number
  vatAmount: number
  total: number
  totalInWords: string
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "(session|invoice)\.ts" | head -20
```

Expected: no output (no errors in the new files).

- [ ] **Step 4: Commit**

```bash
git add src/types/session.ts src/types/invoice.ts
git commit -m "feat(staff): add session and invoice type definitions"
```

---

### Task 2: Static Data & `generatePresets`

**Files:**
- Create: `src/data/staff-data.ts`
- Create: `src/tests/data/staff-data.test.ts`

- [ ] **Step 1: Write failing test `src/tests/data/staff-data.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  STAFF_TABLES,
  STAFF_CATEGORIES,
  STAFF_MENU_ITEMS,
  STAFF_ADMIN_SETTINGS,
  generatePresets,
} from '@/data/staff-data'

describe('staff seed data', () => {
  it('exports exactly 12 tables labelled Bàn 01..Bàn 12', () => {
    expect(STAFF_TABLES).toHaveLength(12)
    expect(STAFF_TABLES[0].label).toBe('Bàn 01')
    expect(STAFF_TABLES[11].label).toBe('Bàn 12')
    STAFF_TABLES.forEach((t) => {
      expect(typeof t.id).toBe('string')
      expect(typeof t.seats).toBe('number')
    })
  })

  it('exports 10 categories with unique ids', () => {
    expect(STAFF_CATEGORIES).toHaveLength(10)
    const ids = new Set(STAFF_CATEGORIES.map((c) => c.id))
    expect(ids.size).toBe(10)
  })

  it('exports 45 menu items each referencing a known category', () => {
    expect(STAFF_MENU_ITEMS).toHaveLength(45)
    const catIds = new Set(STAFF_CATEGORIES.map((c) => c.id))
    STAFF_MENU_ITEMS.forEach((m) => {
      expect(catIds.has(m.categoryId)).toBe(true)
      expect(m.priceNum).toBeGreaterThan(0)
      expect(m.price).toMatch(/đ$/)
    })
  })

  it('admin settings expose pin, vatRate and restaurant info', () => {
    expect(STAFF_ADMIN_SETTINGS.pin).toMatch(/^\d{4,}$/)
    expect(STAFF_ADMIN_SETTINGS.vatRate).toBeGreaterThan(0)
    expect(STAFF_ADMIN_SETTINGS.vatRate).toBeLessThan(1)
    expect(STAFF_ADMIN_SETTINGS.restaurantName.length).toBeGreaterThan(0)
    expect(STAFF_ADMIN_SETTINGS.taxCode.length).toBeGreaterThan(0)
  })
})

describe('generatePresets', () => {
  it('returns 4 ascending presets starting with the total', () => {
    const presets = generatePresets(340_000)
    expect(presets).toHaveLength(4)
    expect(presets[0]).toBe(340_000)
    for (let i = 1; i < presets.length; i++) {
      expect(presets[i]).toBeGreaterThan(presets[i - 1])
    }
  })

  it('rounds 340000 to [340000, 350000, 400000, 500000]', () => {
    expect(generatePresets(340_000)).toEqual([340_000, 350_000, 400_000, 500_000])
  })

  it('rounds 185000 to [185000, 200000, 200000-replaced, 500000] uniqued and ascending', () => {
    const p = generatePresets(185_000)
    expect(p[0]).toBe(185_000)
    expect(p[p.length - 1]).toBe(500_000)
    expect(new Set(p).size).toBe(p.length)
  })

  it('handles exact 50k multiple (e.g. 250000)', () => {
    const p = generatePresets(250_000)
    expect(p[0]).toBe(250_000)
    expect(p).toHaveLength(4)
    expect(new Set(p).size).toBe(4)
  })

  it('handles totals already past 500k (e.g. 720000)', () => {
    const p = generatePresets(720_000)
    expect(p[0]).toBe(720_000)
    expect(p).toHaveLength(4)
    expect(p[p.length - 1]).toBeGreaterThanOrEqual(720_000)
    expect(new Set(p).size).toBe(4)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/data/staff-data.test.ts
```

Expected: `Cannot find module '@/data/staff-data'` (module does not exist yet).

- [ ] **Step 3: Implement `src/data/staff-data.ts`**

```ts
export interface Table {
  id: string
  label: string
  seats: number
}

export interface Category {
  id: string
  name: string
}

export interface MenuItem {
  id: string
  categoryId: string
  name: string
  price: string
  priceNum: number
  image?: string
}

export interface AdminSettings {
  pin: string
  vatRate: number
  restaurantName: string
  address: string
  phone: string
  taxCode: string
}

export const STORAGE_KEYS = {
  sessions: 'terminal_staff_sessions',
  menuItems: 'terminal_menu_items',
  categories: 'terminal_categories',
  tables: 'terminal_tables',
  settings: 'terminal_settings',
  invoiceCounter: 'terminal_invoice_counter',
} as const

const formatVnd = (n: number): string =>
  `${n.toLocaleString('vi-VN').replace(/,/g, '.')}đ`

export const STAFF_TABLES: Table[] = Array.from({ length: 12 }, (_, i) => ({
  id: `table-${String(i + 1).padStart(2, '0')}`,
  label: `Bàn ${String(i + 1).padStart(2, '0')}`,
  seats: i < 6 ? 4 : 6,
}))

export const STAFF_CATEGORIES: Category[] = [
  { id: 'cat-coffee', name: 'Cà phê' },
  { id: 'cat-tea', name: 'Trà' },
  { id: 'cat-juice', name: 'Nước ép' },
  { id: 'cat-smoothie', name: 'Sinh tố' },
  { id: 'cat-soda', name: 'Soda' },
  { id: 'cat-dessert', name: 'Tráng miệng' },
  { id: 'cat-snack', name: 'Ăn vặt' },
  { id: 'cat-meal', name: 'Cơm' },
  { id: 'cat-noodle', name: 'Mì - Bún' },
  { id: 'cat-extra', name: 'Topping' },
]

const itemSeed: Array<[string, string, number]> = [
  ['cat-coffee', 'Cà phê đen', 25_000],
  ['cat-coffee', 'Cà phê sữa', 30_000],
  ['cat-coffee', 'Bạc xỉu', 35_000],
  ['cat-coffee', 'Cà phê muối', 40_000],
  ['cat-coffee', 'Cold brew', 55_000],
  ['cat-tea', 'Trà đào cam sả', 45_000],
  ['cat-tea', 'Trà sen vàng', 45_000],
  ['cat-tea', 'Trà sữa truyền thống', 40_000],
  ['cat-tea', 'Trà sữa matcha', 50_000],
  ['cat-tea', 'Hồng trà sữa', 45_000],
  ['cat-juice', 'Ép cam', 45_000],
  ['cat-juice', 'Ép dưa hấu', 40_000],
  ['cat-juice', 'Ép táo', 45_000],
  ['cat-juice', 'Ép cà rốt', 40_000],
  ['cat-juice', 'Ép dứa', 40_000],
  ['cat-smoothie', 'Sinh tố bơ', 55_000],
  ['cat-smoothie', 'Sinh tố xoài', 50_000],
  ['cat-smoothie', 'Sinh tố dâu', 55_000],
  ['cat-smoothie', 'Sinh tố mãng cầu', 60_000],
  ['cat-smoothie', 'Sinh tố việt quất', 65_000],
  ['cat-soda', 'Soda chanh', 35_000],
  ['cat-soda', 'Soda dâu', 40_000],
  ['cat-soda', 'Soda bạc hà', 40_000],
  ['cat-soda', 'Soda blue ocean', 45_000],
  ['cat-soda', 'Soda Italia', 45_000],
  ['cat-dessert', 'Bánh flan', 25_000],
  ['cat-dessert', 'Tiramisu', 55_000],
  ['cat-dessert', 'Bánh mousse chocolate', 60_000],
  ['cat-dessert', 'Kem dừa', 35_000],
  ['cat-dessert', 'Chè khúc bạch', 30_000],
  ['cat-snack', 'Khoai tây chiên', 35_000],
  ['cat-snack', 'Gà rán', 65_000],
  ['cat-snack', 'Nem chua rán', 40_000],
  ['cat-snack', 'Bánh tráng trộn', 30_000],
  ['cat-snack', 'Xúc xích nướng', 35_000],
  ['cat-meal', 'Cơm gà xối mỡ', 65_000],
  ['cat-meal', 'Cơm sườn nướng', 70_000],
  ['cat-meal', 'Cơm tấm bì chả', 70_000],
  ['cat-noodle', 'Mì xào bò', 65_000],
  ['cat-noodle', 'Bún bò Huế', 60_000],
  ['cat-noodle', 'Phở gà', 60_000],
  ['cat-extra', 'Trân châu đen', 8_000],
  ['cat-extra', 'Thạch dừa', 8_000],
  ['cat-extra', 'Pudding trứng', 10_000],
  ['cat-extra', 'Kem cheese', 12_000],
]

export const STAFF_MENU_ITEMS: MenuItem[] = itemSeed.map(([categoryId, name, priceNum], idx) => ({
  id: `menu-${String(idx + 1).padStart(3, '0')}`,
  categoryId,
  name,
  priceNum,
  price: formatVnd(priceNum),
}))

export const STAFF_ADMIN_SETTINGS: AdminSettings = {
  pin: '1234',
  vatRate: 0.1,
  restaurantName: 'THE TERMINAL',
  address: '123 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
  phone: '0901 234 567',
  taxCode: '0312345678',
}

export function generatePresets(total: number): number[] {
  const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step
  const candidates = [
    total,
    ceilTo(total + 1, 50_000),
    ceilTo(total + 1, 100_000),
    ceilTo(total + 1, 500_000),
  ]
  const ascending: number[] = []
  let prev = -Infinity
  for (const v of candidates) {
    const next = v <= prev ? prev + 50_000 : v
    ascending.push(next)
    prev = next
  }
  return ascending
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/data/staff-data.test.ts
```

Expected: all assertions green, `Test Files 1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/data/staff-data.ts src/tests/data/staff-data.test.ts
git commit -m "feat(staff): seed tables, categories, menu items and generatePresets helper"
```

---

### Task 3: `mergeOrderItems`

**Files:**
- Create: `src/lib/staff-orders.ts`
- Create: `src/tests/lib/staff-orders.test.ts`

- [ ] **Step 1: Write failing test `src/tests/lib/staff-orders.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { mergeOrderItems } from '@/lib/staff-orders'
import type { SubmittedOrder } from '@/types/session'

const order = (id: string, items: SubmittedOrder['items']): SubmittedOrder => ({
  id,
  items,
  submittedAt: '2026-06-01T10:00:00Z',
})

describe('mergeOrderItems', () => {
  it('returns an empty array when there are no orders', () => {
    expect(mergeOrderItems([])).toEqual([])
  })

  it('returns a single item untouched when only one order has one item', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [{ menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' }]),
    ]
    expect(mergeOrderItems(orders)).toEqual([
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2 },
    ])
  })

  it('sums quantities for items with the same menuItemId across orders', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: 'note 1' },
      ]),
      order('o2', [
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 3, note: 'note 2' },
        { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 2, note: '' },
      ]),
    ]
    const merged = mergeOrderItems(orders)
    expect(merged).toHaveLength(2)
    expect(merged.find((m) => m.menuItemId === 'm1')?.quantity).toBe(4)
    expect(merged.find((m) => m.menuItemId === 'm2')?.quantity).toBe(2)
  })

  it('preserves the order in which menuItemIds are first encountered', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [
        { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 1, note: '' },
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
      ]),
      order('o2', [
        { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
      ]),
    ]
    expect(mergeOrderItems(orders).map((m) => m.menuItemId)).toEqual(['m2', 'm1'])
  })

  it('drops the note field in the merged result', () => {
    const orders: SubmittedOrder[] = [
      order('o1', [{ menuItemId: 'm1', name: 'X', priceNum: 1000, price: '1.000đ', quantity: 1, note: 'keep me?' }]),
    ]
    expect(mergeOrderItems(orders)[0]).not.toHaveProperty('note')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/lib/staff-orders.test.ts
```

Expected: `Cannot find module '@/lib/staff-orders'`.

- [ ] **Step 3: Implement `src/lib/staff-orders.ts`**

```ts
import type { SubmittedOrder } from '@/types/session'

export interface MergedItem {
  menuItemId: string
  name: string
  priceNum: number
  price: string
  quantity: number
}

export function mergeOrderItems(orders: SubmittedOrder[]): MergedItem[] {
  const map = new Map<string, MergedItem>()
  for (const order of orders) {
    for (const item of order.items) {
      const existing = map.get(item.menuItemId)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        map.set(item.menuItemId, {
          menuItemId: item.menuItemId,
          name: item.name,
          priceNum: item.priceNum,
          price: item.price,
          quantity: item.quantity,
        })
      }
    }
  }
  return Array.from(map.values())
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/lib/staff-orders.test.ts
```

Expected: `Test Files 1 passed`, 5 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staff-orders.ts src/tests/lib/staff-orders.test.ts
git commit -m "feat(staff): mergeOrderItems aggregates quantities across submitted orders"
```

---

### Task 4: `numberToWords` (Vietnamese)

**Files:**
- Create: `src/lib/staff-invoice.ts` (only `numberToWords` for now)
- Create: `src/tests/lib/staff-invoice.test.ts`

- [ ] **Step 1: Write failing test `src/tests/lib/staff-invoice.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { numberToWords } from '@/lib/staff-invoice'

describe('numberToWords', () => {
  it('returns "Không đồng" for zero', () => {
    expect(numberToWords(0)).toBe('Không đồng')
  })

  it('handles single digits 1..9', () => {
    expect(numberToWords(1)).toBe('Một đồng')
    expect(numberToWords(5)).toBe('Năm đồng')
    expect(numberToWords(9)).toBe('Chín đồng')
  })

  it('uses "mười" for 10 and "mười X" for 11..19 (lăm for 15)', () => {
    expect(numberToWords(10)).toBe('Mười đồng')
    expect(numberToWords(11)).toBe('Mười một đồng')
    expect(numberToWords(15)).toBe('Mười lăm đồng')
    expect(numberToWords(19)).toBe('Mười chín đồng')
  })

  it('uses "mốt" for trailing 1 in 21..91 and "lăm" for trailing 5 in 25..95', () => {
    expect(numberToWords(21)).toBe('Hai mươi mốt đồng')
    expect(numberToWords(25)).toBe('Hai mươi lăm đồng')
    expect(numberToWords(31)).toBe('Ba mươi mốt đồng')
    expect(numberToWords(95)).toBe('Chín mươi lăm đồng')
  })

  it('uses "linh" when tens is zero but units is non-zero inside a group', () => {
    expect(numberToWords(101)).toBe('Một trăm linh một đồng')
    expect(numberToWords(105)).toBe('Một trăm linh năm đồng')
  })

  it('handles full hundreds (no linh)', () => {
    expect(numberToWords(100)).toBe('Một trăm đồng')
    expect(numberToWords(200)).toBe('Hai trăm đồng')
  })

  it('handles thousands groupings', () => {
    expect(numberToWords(1_000)).toBe('Một nghìn đồng')
    expect(numberToWords(1_200)).toBe('Một nghìn hai trăm đồng')
    expect(numberToWords(1_205)).toBe('Một nghìn hai trăm linh năm đồng')
    expect(numberToWords(25_000)).toBe('Hai mươi lăm nghìn đồng')
    expect(numberToWords(340_000)).toBe('Ba trăm bốn mươi nghìn đồng')
  })

  it('handles millions', () => {
    expect(numberToWords(1_000_000)).toBe('Một triệu đồng')
    expect(numberToWords(1_200_000)).toBe('Một triệu hai trăm nghìn đồng')
    expect(numberToWords(2_345_000)).toBe('Hai triệu ba trăm bốn mươi lăm nghìn đồng')
  })

  it('handles billions ("tỷ")', () => {
    expect(numberToWords(1_000_000_000)).toBe('Một tỷ đồng')
    expect(numberToWords(1_234_567_890)).toMatch(/^Một tỷ/)
    expect(numberToWords(1_234_567_890)).toMatch(/đồng$/)
  })

  it('capitalizes the very first letter only', () => {
    const out = numberToWords(105)
    expect(out[0]).toBe(out[0].toUpperCase())
    expect(out.slice(1)).toBe(out.slice(1).toLowerCase().replace(/^./, out[1]))
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/lib/staff-invoice.test.ts
```

Expected: `Cannot find module '@/lib/staff-invoice'`.

- [ ] **Step 3: Implement `numberToWords` in `src/lib/staff-invoice.ts`**

```ts
const UNITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function readTriple(n: number, leading: boolean): string {
  // Reads a 0..999 group. `leading` means this is the highest non-zero group → suppress empty hundreds.
  const hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const units = n % 10
  const parts: string[] = []

  if (hundreds > 0) {
    parts.push(`${UNITS[hundreds]} trăm`)
  } else if (!leading && (tens > 0 || units > 0)) {
    parts.push('không trăm')
  }

  if (tens === 0 && units > 0) {
    if (hundreds > 0 || !leading) parts.push('linh')
    parts.push(UNITS[units])
  } else if (tens === 1) {
    parts.push('mười')
    if (units === 5) parts.push('lăm')
    else if (units > 0) parts.push(UNITS[units])
  } else if (tens > 1) {
    parts.push(`${UNITS[tens]} mươi`)
    if (units === 1) parts.push('mốt')
    else if (units === 5) parts.push('lăm')
    else if (units > 0) parts.push(UNITS[units])
  }

  return parts.join(' ').trim()
}

const SCALES = ['', 'nghìn', 'triệu', 'tỷ']

export function numberToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Không đồng'
  const n = Math.floor(amount)
  if (n === 0) return 'Không đồng'

  // Split into groups of three digits from the right.
  const groups: number[] = []
  let rest = n
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }
  // groups[0] = lowest 3 digits, groups[groups.length-1] = highest.

  const segments: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]
    const isLeading = segments.length === 0
    if (g === 0) {
      // skip the empty group entirely — its scale word only matters if any lower group is non-zero
      continue
    }
    const triple = readTriple(g, isLeading)
    const scale = SCALES[i]
    segments.push(scale ? `${triple} ${scale}` : triple)
  }

  const text = segments.join(' ').replace(/\s+/g, ' ').trim() + ' đồng'
  return text.charAt(0).toUpperCase() + text.slice(1)
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/lib/staff-invoice.test.ts
```

Expected: all assertions green. If `1_234_567_890` regex test fails, inspect the output and adjust the segment-join handling.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staff-invoice.ts src/tests/lib/staff-invoice.test.ts
git commit -m "feat(staff): numberToWords converts integer VND to Vietnamese words"
```

---

### Task 5: `buildInvoice`

**Files:**
- Modify: `src/lib/staff-invoice.ts` (append `buildInvoice`)
- Modify: `src/tests/lib/staff-invoice.test.ts` (append `describe('buildInvoice')`)

- [ ] **Step 1: Append failing test to `src/tests/lib/staff-invoice.test.ts`**

```ts
import { afterEach, beforeEach } from 'vitest'
import { buildInvoice } from '@/lib/staff-invoice'
import type { TableSession } from '@/types/session'
import type { InvoiceRequest, SellerInfo } from '@/types/invoice'

const seller: SellerInfo = {
  name: 'THE TERMINAL',
  address: '123 Lê Lợi, Q1',
  taxCode: '0312345678',
  phone: '0901234567',
}

const buyer: InvoiceRequest = {
  buyerName: 'Nguyễn Văn A',
  buyerTaxCode: '0301122334',
  buyerAddress: '456 Nguyễn Huệ',
  buyerEmail: 'a@example.com',
  paymentMethod: 'cash',
}

function makeSession(): TableSession {
  return {
    tableId: 'table-01',
    status: 'waiting_payment',
    pendingItems: [],
    openedAt: '2026-06-01T09:00:00Z',
    submittedOrders: [
      {
        id: 'order-1',
        submittedAt: '2026-06-01T09:30:00Z',
        items: [
          { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 33_000, price: '33.000đ', quantity: 2, note: '' },
        ],
      },
      {
        id: 'order-2',
        submittedAt: '2026-06-01T09:45:00Z',
        items: [
          { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 33_000, price: '33.000đ', quantity: 1, note: '' },
          { menuItemId: 'm2', name: 'Trà đào', priceNum: 44_000, price: '44.000đ', quantity: 2, note: '' },
        ],
      },
    ],
  }
}

describe('buildInvoice', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('uses symbol "AA/25E" and zero-padded 7-digit number', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(inv.symbol).toBe('AA/25E')
    expect(inv.number).toMatch(/^\d{7}$/)
  })

  it('auto-increments the invoice counter in localStorage', () => {
    const a = buildInvoice(makeSession(), buyer, seller, 0.1)
    const b = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(Number(b.number)).toBe(Number(a.number) + 1)
    expect(window.localStorage.getItem('terminal_invoice_counter')).toBe(String(Number(b.number)))
  })

  it('merges duplicate menu items across orders', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(inv.items).toHaveLength(2)
    const coffee = inv.items.find((i) => i.name === 'Cà phê đen')
    expect(coffee?.quantity).toBe(3)
  })

  it('reverse-calculates unitPrice from VAT-inclusive priceNum', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    const coffee = inv.items.find((i) => i.name === 'Cà phê đen')!
    expect(coffee.unitPrice).toBe(Math.round(33_000 / 1.1)) // 30000
    expect(coffee.amount).toBe(coffee.unitPrice * coffee.quantity)
  })

  it('computes subtotal, vatAmount and total consistently', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    const sumAmount = inv.items.reduce((s, i) => s + i.amount, 0)
    expect(inv.subtotal).toBe(sumAmount)
    expect(inv.vatAmount).toBe(Math.round(inv.subtotal * inv.vatRate))
    expect(inv.total).toBe(inv.subtotal + inv.vatAmount)
  })

  it('populates totalInWords using numberToWords on total', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(inv.totalInWords).toMatch(/đồng$/)
    expect(inv.totalInWords[0]).toBe(inv.totalInWords[0].toUpperCase())
  })

  it('copies seller and buyer info into the result', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(inv.seller).toEqual(seller)
    expect(inv.buyer).toEqual(buyer)
  })

  it('sets issuedAt to an ISO datetime string', () => {
    const inv = buildInvoice(makeSession(), buyer, seller, 0.1)
    expect(() => new Date(inv.issuedAt).toISOString()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/lib/staff-invoice.test.ts
```

Expected: import error for `buildInvoice` (not yet exported).

- [ ] **Step 3: Append `buildInvoice` to `src/lib/staff-invoice.ts`**

```ts
import type { TableSession } from '@/types/session'
import type { InvoiceData, InvoiceRequest, SellerInfo } from '@/types/invoice'
import { mergeOrderItems } from '@/lib/staff-orders'
import { STORAGE_KEYS } from '@/data/staff-data'

const INVOICE_SYMBOL = 'AA/25E'

function nextInvoiceNumber(): string {
  const raw = window.localStorage.getItem(STORAGE_KEYS.invoiceCounter)
  const current = raw ? Number.parseInt(raw, 10) : 0
  const next = Number.isFinite(current) ? current + 1 : 1
  window.localStorage.setItem(STORAGE_KEYS.invoiceCounter, String(next))
  return String(next).padStart(7, '0')
}

export function buildInvoice(
  session: TableSession,
  request: InvoiceRequest,
  seller: SellerInfo,
  vatRate: number,
): InvoiceData {
  const merged = mergeOrderItems(session.submittedOrders)
  const items = merged.map((m) => {
    const unitPrice = Math.round(m.priceNum / (1 + vatRate))
    return {
      name: m.name,
      unit: 'phần',
      quantity: m.quantity,
      unitPrice,
      amount: unitPrice * m.quantity,
    }
  })

  const subtotal = items.reduce((s, i) => s + i.amount, 0)
  const vatAmount = Math.round(subtotal * vatRate)
  const total = subtotal + vatAmount

  return {
    number: nextInvoiceNumber(),
    symbol: INVOICE_SYMBOL,
    issuedAt: new Date().toISOString(),
    seller,
    buyer: request,
    items,
    subtotal,
    vatRate,
    vatAmount,
    total,
    totalInWords: numberToWords(total),
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/lib/staff-invoice.test.ts
```

Expected: all assertions green, both `describe` blocks pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/staff-invoice.ts src/tests/lib/staff-invoice.test.ts
git commit -m "feat(staff): buildInvoice composes line items and auto-increments counter"
```

---

### Task 6: `useTableSessions` hook

**Files:**
- Create: `src/hooks/useTableSessions.ts`
- Create: `src/hooks/__tests__/useTableSessions.test.tsx`

- [ ] **Step 1: Write failing test `src/hooks/__tests__/useTableSessions.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTableSessions } from '../useTableSessions'
import { STORAGE_KEYS } from '@/data/staff-data'
import type { OrderItem } from '@/types/session'

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  menuItemId: 'm1',
  name: 'Cà phê đen',
  priceNum: 25_000,
  price: '25.000đ',
  quantity: 1,
  note: '',
  ...overrides,
})

describe('useTableSessions', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts with no sessions', () => {
    const { result } = renderHook(() => useTableSessions())
    expect(result.current.sessions).toEqual({})
  })

  it('openSession creates an empty serving session and persists it', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    expect(result.current.sessions.t1.status).toBe('serving')
    expect(result.current.sessions.t1.pendingItems).toEqual([])
    expect(result.current.sessions.t1.submittedOrders).toEqual([])
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.sessions) || '{}')
    expect(stored.t1.status).toBe('serving')
  })

  it('openSession does not overwrite an existing session', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() => result.current.addItem('t1', item()))
    act(() => result.current.openSession('t1'))
    expect(result.current.sessions.t1.pendingItems).toHaveLength(1)
  })

  it('addItem appends to pendingItems, merging same menuItemId', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() => result.current.addItem('t1', item({ quantity: 1 })))
    act(() => result.current.addItem('t1', item({ quantity: 2 })))
    expect(result.current.sessions.t1.pendingItems).toHaveLength(1)
    expect(result.current.sessions.t1.pendingItems[0].quantity).toBe(3)
  })

  it('updateItem patches quantity or note', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() => result.current.addItem('t1', item()))
    act(() => result.current.updateItem('t1', 'm1', { quantity: 5, note: 'ít đường' }))
    expect(result.current.sessions.t1.pendingItems[0].quantity).toBe(5)
    expect(result.current.sessions.t1.pendingItems[0].note).toBe('ít đường')
  })

  it('removeItem deletes the matching pending item', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() => result.current.addItem('t1', item()))
    act(() => result.current.removeItem('t1', 'm1'))
    expect(result.current.sessions.t1.pendingItems).toEqual([])
  })

  it('submitOrder moves pendingItems into a new SubmittedOrder and clears pending', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() => result.current.addItem('t1', item({ quantity: 2 })))
    act(() => result.current.submitOrder('t1'))
    expect(result.current.sessions.t1.pendingItems).toEqual([])
    expect(result.current.sessions.t1.submittedOrders).toHaveLength(1)
    expect(result.current.sessions.t1.submittedOrders[0].items[0].quantity).toBe(2)
    expect(result.current.sessions.t1.submittedOrders[0].id).toMatch(/^order-/)
  })

  it('submitOrder is a no-op when pendingItems is empty', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() => result.current.submitOrder('t1'))
    expect(result.current.sessions.t1.submittedOrders).toEqual([])
  })

  it('requestPayment flips serving → waiting_payment', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() => result.current.requestPayment('t1'))
    expect(result.current.sessions.t1.status).toBe('waiting_payment')
  })

  it('closeSession deletes the session', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() => result.current.closeSession('t1'))
    expect(result.current.sessions.t1).toBeUndefined()
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.sessions) || '{}')
    expect(stored.t1).toBeUndefined()
  })

  it('setInvoiceRequest attaches invoice metadata to the session', () => {
    const { result } = renderHook(() => useTableSessions())
    act(() => result.current.openSession('t1'))
    act(() =>
      result.current.setInvoiceRequest('t1', {
        buyerName: 'Nguyễn Văn A',
        buyerTaxCode: '03011',
        buyerAddress: 'addr',
        buyerEmail: 'a@b.com',
        paymentMethod: 'transfer',
      }),
    )
    expect(result.current.sessions.t1.invoiceRequest?.paymentMethod).toBe('transfer')
  })

  it('hydrates from localStorage on first render', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.sessions,
      JSON.stringify({
        t1: {
          tableId: 't1',
          status: 'serving',
          pendingItems: [],
          submittedOrders: [],
          openedAt: '2026-06-01T00:00:00Z',
        },
      }),
    )
    const { result } = renderHook(() => useTableSessions())
    expect(result.current.sessions.t1.status).toBe('serving')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/hooks/__tests__/useTableSessions.test.tsx
```

Expected: `Cannot find module '../useTableSessions'`.

- [ ] **Step 3: Implement `src/hooks/useTableSessions.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrderItem, SubmittedOrder, TableSession } from '@/types/session'
import type { InvoiceRequest } from '@/types/invoice'
import { STORAGE_KEYS } from '@/data/staff-data'

type Sessions = Record<string, TableSession>

function loadFromStorage(): Sessions {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sessions)
    return raw ? (JSON.parse(raw) as Sessions) : {}
  } catch {
    return {}
  }
}

function saveToStorage(sessions: Sessions) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions))
}

export interface UseTableSessions {
  sessions: Sessions
  openSession: (tableId: string) => void
  addItem: (tableId: string, item: OrderItem) => void
  updateItem: (tableId: string, menuItemId: string, patch: { quantity?: number; note?: string }) => void
  removeItem: (tableId: string, menuItemId: string) => void
  submitOrder: (tableId: string) => void
  requestPayment: (tableId: string) => void
  closeSession: (tableId: string) => void
  setInvoiceRequest: (tableId: string, request: InvoiceRequest) => void
}

export function useTableSessions(): UseTableSessions {
  const [sessions, setSessions] = useState<Sessions>(() => loadFromStorage())
  const hydrated = useRef(false)

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    saveToStorage(sessions)
  }, [sessions])

  const mutate = useCallback((mutator: (prev: Sessions) => Sessions) => {
    setSessions((prev) => {
      const next = mutator(prev)
      saveToStorage(next)
      return next
    })
  }, [])

  const openSession = useCallback((tableId: string) => {
    mutate((prev) => {
      if (prev[tableId]) return prev
      return {
        ...prev,
        [tableId]: {
          tableId,
          status: 'serving',
          pendingItems: [],
          submittedOrders: [],
          openedAt: new Date().toISOString(),
        },
      }
    })
  }, [mutate])

  const addItem = useCallback((tableId: string, item: OrderItem) => {
    mutate((prev) => {
      const session = prev[tableId]
      if (!session) return prev
      const existing = session.pendingItems.find((p) => p.menuItemId === item.menuItemId)
      const pendingItems = existing
        ? session.pendingItems.map((p) =>
            p.menuItemId === item.menuItemId ? { ...p, quantity: p.quantity + item.quantity } : p,
          )
        : [...session.pendingItems, item]
      return { ...prev, [tableId]: { ...session, pendingItems } }
    })
  }, [mutate])

  const updateItem = useCallback(
    (tableId: string, menuItemId: string, patch: { quantity?: number; note?: string }) => {
      mutate((prev) => {
        const session = prev[tableId]
        if (!session) return prev
        const pendingItems = session.pendingItems.map((p) =>
          p.menuItemId === menuItemId ? { ...p, ...patch } : p,
        )
        return { ...prev, [tableId]: { ...session, pendingItems } }
      })
    },
    [mutate],
  )

  const removeItem = useCallback((tableId: string, menuItemId: string) => {
    mutate((prev) => {
      const session = prev[tableId]
      if (!session) return prev
      return {
        ...prev,
        [tableId]: {
          ...session,
          pendingItems: session.pendingItems.filter((p) => p.menuItemId !== menuItemId),
        },
      }
    })
  }, [mutate])

  const submitOrder = useCallback((tableId: string) => {
    mutate((prev) => {
      const session = prev[tableId]
      if (!session || session.pendingItems.length === 0) return prev
      const newOrder: SubmittedOrder = {
        id: `order-${Date.now()}`,
        items: session.pendingItems,
        submittedAt: new Date().toISOString(),
      }
      return {
        ...prev,
        [tableId]: {
          ...session,
          pendingItems: [],
          submittedOrders: [...session.submittedOrders, newOrder],
        },
      }
    })
  }, [mutate])

  const requestPayment = useCallback((tableId: string) => {
    mutate((prev) => {
      const session = prev[tableId]
      if (!session) return prev
      return { ...prev, [tableId]: { ...session, status: 'waiting_payment' } }
    })
  }, [mutate])

  const closeSession = useCallback((tableId: string) => {
    mutate((prev) => {
      if (!prev[tableId]) return prev
      const next = { ...prev }
      delete next[tableId]
      return next
    })
  }, [mutate])

  const setInvoiceRequest = useCallback((tableId: string, request: InvoiceRequest) => {
    mutate((prev) => {
      const session = prev[tableId]
      if (!session) return prev
      return { ...prev, [tableId]: { ...session, invoiceRequest: request } }
    })
  }, [mutate])

  return {
    sessions,
    openSession,
    addItem,
    updateItem,
    removeItem,
    submitOrder,
    requestPayment,
    closeSession,
    setInvoiceRequest,
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/hooks/__tests__/useTableSessions.test.tsx
```

Expected: all 12 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTableSessions.ts src/hooks/__tests__/useTableSessions.test.tsx
git commit -m "feat(staff): useTableSessions hook syncs sessions with localStorage"
```

---

### Task 7: `TableCard` component

**Files:**
- Create: `src/components/staff/table-card.tsx`
- Create: `src/tests/components/staff/table-card.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/table-card.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableCard } from '@/components/staff/table-card'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'

const table: Table = { id: 't1', label: 'Bàn 01', seats: 4 }

const servingSession = (): TableSession => ({
  tableId: 't1',
  status: 'serving',
  openedAt: '',
  pendingItems: [
    { menuItemId: 'm1', name: 'A', priceNum: 10_000, price: '10.000đ', quantity: 2, note: '' },
  ],
  submittedOrders: [
    {
      id: 'order-1',
      submittedAt: '',
      items: [
        { menuItemId: 'm2', name: 'B', priceNum: 20_000, price: '20.000đ', quantity: 1, note: '' },
      ],
    },
  ],
})

describe('TableCard', () => {
  it('renders label and seats for an empty table', () => {
    render(<TableCard table={table} session={undefined} onClick={() => {}} />)
    expect(screen.getByText('Bàn 01')).toBeInTheDocument()
    expect(screen.getByText(/4/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<TableCard table={table} session={undefined} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows serving status with item count and combined total', () => {
    render(<TableCard table={table} session={servingSession()} onClick={() => {}} />)
    // 2 pending + 1 submitted = 3 items, 2*10000 + 1*20000 = 40000
    expect(screen.getByText(/3/)).toBeInTheDocument()
    expect(screen.getByText(/40\.000đ/)).toBeInTheDocument()
    expect(screen.getByTestId('table-card')).toHaveClass('border-yellow-500')
  })

  it('shows waiting_payment status with orange border', () => {
    const session: TableSession = { ...servingSession(), status: 'waiting_payment' }
    render(<TableCard table={table} session={session} onClick={() => {}} />)
    expect(screen.getByTestId('table-card')).toHaveClass('border-orange-500')
  })

  it('treats status "done" the same as empty', () => {
    const session: TableSession = { ...servingSession(), status: 'done' }
    render(<TableCard table={table} session={session} onClick={() => {}} />)
    expect(screen.getByTestId('table-card')).toHaveClass('border-[#2a2a2a]')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/table-card.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/table-card.tsx`**

```tsx
import { useMemo } from 'react'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'

interface Props {
  table: Table
  session: TableSession | undefined
  onClick: () => void
}

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN').replace(/,/g, '.')}đ`
}

export function TableCard({ table, session, onClick }: Props) {
  const isActive = session && session.status !== 'empty' && session.status !== 'done'
  const status = isActive ? session.status : 'empty'

  const { itemCount, total } = useMemo(() => {
    if (!session) return { itemCount: 0, total: 0 }
    const pendingCount = session.pendingItems.reduce((s, i) => s + i.quantity, 0)
    const submittedCount = session.submittedOrders.reduce(
      (s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0),
      0,
    )
    const pendingTotal = session.pendingItems.reduce((s, i) => s + i.priceNum * i.quantity, 0)
    const submittedTotal = session.submittedOrders.reduce(
      (s, o) => s + o.items.reduce((ss, i) => ss + i.priceNum * i.quantity, 0),
      0,
    )
    return { itemCount: pendingCount + submittedCount, total: pendingTotal + submittedTotal }
  }, [session])

  const borderClass =
    status === 'serving'
      ? 'border-yellow-500'
      : status === 'waiting_payment'
        ? 'border-orange-500'
        : 'border-[#2a2a2a]'

  const dotClass =
    status === 'serving'
      ? 'bg-yellow-400 animate-pulse'
      : status === 'waiting_payment'
        ? 'bg-orange-400 animate-pulse'
        : 'hidden'

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="table-card"
      className={`flex flex-col items-start gap-2 rounded-lg border-2 ${borderClass} bg-[#1a1a1a] p-4 text-left transition hover:bg-[#222] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-base font-semibold text-[#f5f0e8]">{table.label}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden />
      </div>
      {isActive ? (
        <div className="text-xs text-[#888]">
          <div>{itemCount} món</div>
          <div className="text-[#C9A84C]">{formatVnd(total)}</div>
        </div>
      ) : (
        <span className="text-xs text-[#555]">{table.seats} chỗ</span>
      )}
    </button>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/table-card.test.tsx
```

Expected: all 5 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/table-card.tsx src/tests/components/staff/table-card.test.tsx
git commit -m "feat(staff): TableCard renders status, count and total"
```

---

### Task 8: `FloorPlan` component

**Files:**
- Create: `src/components/staff/floor-plan.tsx`
- Create: `src/tests/components/staff/floor-plan.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/floor-plan.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloorPlan } from '@/components/staff/floor-plan'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'

const tables: Table[] = [
  { id: 't1', label: 'Bàn 01', seats: 4 },
  { id: 't2', label: 'Bàn 02', seats: 4 },
  { id: 't3', label: 'Bàn 03', seats: 4 },
]

const baseSession = (id: string, status: TableSession['status']): TableSession => ({
  tableId: id,
  status,
  pendingItems: [],
  submittedOrders: [],
  openedAt: '',
})

describe('FloorPlan', () => {
  it('renders one card per table', () => {
    render(<FloorPlan tables={tables} sessions={{}} onTableClick={() => {}} />)
    expect(screen.getAllByTestId('table-card')).toHaveLength(3)
  })

  it('shows 4 stat counters: total, serving, waiting, empty', () => {
    const sessions = {
      t1: baseSession('t1', 'serving'),
      t2: baseSession('t2', 'waiting_payment'),
    }
    render(<FloorPlan tables={tables} sessions={sessions} onTableClick={() => {}} />)
    expect(screen.getByTestId('stat-total')).toHaveTextContent('3')
    expect(screen.getByTestId('stat-serving')).toHaveTextContent('1')
    expect(screen.getByTestId('stat-waiting')).toHaveTextContent('1')
    expect(screen.getByTestId('stat-empty')).toHaveTextContent('1')
  })

  it('invokes onTableClick with the table id', () => {
    const onClick = vi.fn()
    render(<FloorPlan tables={tables} sessions={{}} onTableClick={onClick} />)
    fireEvent.click(screen.getAllByTestId('table-card')[1])
    expect(onClick).toHaveBeenCalledWith('t2')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/floor-plan.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/floor-plan.tsx`**

```tsx
import { TableCard } from './table-card'
import type { TableSession } from '@/types/session'
import type { Table } from '@/data/staff-data'

interface Props {
  tables: Table[]
  sessions: Record<string, TableSession>
  onTableClick: (tableId: string) => void
}

export function FloorPlan({ tables, sessions, onTableClick }: Props) {
  const total = tables.length
  let serving = 0
  let waiting = 0
  for (const t of tables) {
    const s = sessions[t.id]?.status
    if (s === 'serving') serving++
    else if (s === 'waiting_payment') waiting++
  }
  const empty = total - serving - waiting

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tổng số" value={total} testId="stat-total" />
        <Stat label="Đang phục vụ" value={serving} testId="stat-serving" accent="text-yellow-400" />
        <Stat label="Chờ thanh toán" value={waiting} testId="stat-waiting" accent="text-orange-400" />
        <Stat label="Trống" value={empty} testId="stat-empty" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => (
          <TableCard
            key={t.id}
            table={t}
            session={sessions[t.id]}
            onClick={() => onTableClick(t.id)}
          />
        ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  testId,
  accent,
}: {
  label: string
  value: number
  testId: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-4">
      <div className="text-xs uppercase tracking-wide text-[#888]">{label}</div>
      <div
        data-testid={testId}
        className={`mt-1 text-2xl font-bold ${accent ?? 'text-[#f5f0e8]'}`}
      >
        {value}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/floor-plan.test.tsx
```

Expected: 3 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/floor-plan.tsx src/tests/components/staff/floor-plan.test.tsx
git commit -m "feat(staff): FloorPlan grid with stats bar"
```

---

### Task 9: `MenuPanel` component

**Files:**
- Create: `src/components/staff/menu-panel.tsx`
- Create: `src/tests/components/staff/menu-panel.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/menu-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MenuPanel, parsePrice } from '@/components/staff/menu-panel'
import type { OrderItem } from '@/types/session'

describe('parsePrice', () => {
  it('strips non-digit characters', () => {
    expect(parsePrice('25.000đ')).toBe(25_000)
    expect(parsePrice('1,200,000 VND')).toBe(1_200_000)
    expect(parsePrice('')).toBe(0)
  })
})

describe('MenuPanel', () => {
  it('renders category buttons and the first category is active', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} />)
    const coffeeBtn = screen.getByRole('button', { name: /Cà phê/ })
    expect(coffeeBtn).toHaveClass('bg-[#C9A84C]')
  })

  it('filters items when a different category is selected', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Trà$/ }))
    expect(screen.getByText('Trà đào cam sả')).toBeInTheDocument()
    expect(screen.queryByText('Cà phê đen')).not.toBeInTheDocument()
  })

  it('calls onAdd with the menu item shape (no quantity, no note)', () => {
    const onAdd = vi.fn()
    render(<MenuPanel pendingItems={[]} onAdd={onAdd} />)
    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0])
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: expect.any(String),
        name: expect.any(String),
        priceNum: expect.any(Number),
        price: expect.any(String),
      }),
    )
    const arg = onAdd.mock.calls[0][0] as Partial<OrderItem>
    expect(arg).not.toHaveProperty('quantity')
    expect(arg).not.toHaveProperty('note')
  })

  it('shows a quantity badge for items already in pendingItems', () => {
    const pending: OrderItem[] = [
      { menuItemId: 'menu-001', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 3, note: '' },
    ]
    render(<MenuPanel pendingItems={pending} onAdd={() => {}} />)
    expect(screen.getByTestId('badge-menu-001')).toHaveTextContent('3')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/menu-panel.tsx`**

```tsx
import { useMemo, useState } from 'react'
import type { OrderItem } from '@/types/session'
import { STAFF_CATEGORIES, STAFF_MENU_ITEMS } from '@/data/staff-data'

interface Props {
  pendingItems: OrderItem[]
  onAdd: (item: Omit<OrderItem, 'quantity' | 'note'>) => void
}

export function parsePrice(price: string): number {
  const digits = price.replace(/\D+/g, '')
  return digits ? Number.parseInt(digits, 10) : 0
}

export function MenuPanel({ pendingItems, onAdd }: Props) {
  const [activeCat, setActiveCat] = useState<string>(STAFF_CATEGORIES[0].id)
  const items = useMemo(
    () => STAFF_MENU_ITEMS.filter((m) => m.categoryId === activeCat),
    [activeCat],
  )
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pendingItems) map.set(p.menuItemId, p.quantity)
    return map
  }, [pendingItems])

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-20 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#2a2a2a] bg-[#111] p-2 sm:w-28">
        {STAFF_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id)}
            className={`rounded-md px-2 py-3 text-xs font-medium transition ${
              activeCat === c.id
                ? 'bg-[#C9A84C] text-black'
                : 'bg-[#1a1a1a] text-[#f5f0e8] hover:bg-[#222]'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3">
        {items.map((m) => {
          const count = counts.get(m.id) ?? 0
          return (
            <div
              key={m.id}
              className="relative flex flex-col gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-3"
            >
              {m.image && (
                <img src={m.image} alt={m.name} className="h-20 w-full rounded object-cover" />
              )}
              <div className="text-sm font-semibold text-[#f5f0e8]">{m.name}</div>
              <div className="text-xs text-[#C9A84C]">{m.price}</div>
              <button
                type="button"
                aria-label={`Thêm ${m.name}`}
                onClick={() =>
                  onAdd({
                    menuItemId: m.id,
                    name: m.name,
                    priceNum: m.priceNum,
                    price: m.price,
                  })
                }
                className="self-end rounded-full bg-[#C9A84C] px-3 py-1 text-sm font-bold text-black hover:bg-[#d6b65a]"
              >
                +
              </button>
              {count > 0 && (
                <span
                  data-testid={`badge-${m.id}`}
                  className="absolute right-2 top-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-emerald-100"
                >
                  {count}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/menu-panel.test.tsx
```

Expected: 5 assertions pass (1 in `parsePrice` + 4 in `MenuPanel`).

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/menu-panel.tsx src/tests/components/staff/menu-panel.test.tsx
git commit -m "feat(staff): MenuPanel with category filter and quantity badges"
```

---

### Task 10: `OrderSummary` component

**Files:**
- Create: `src/components/staff/order-summary.tsx`
- Create: `src/tests/components/staff/order-summary.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/order-summary.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { OrderSummary } from '@/components/staff/order-summary'
import type { OrderItem, SubmittedOrder } from '@/types/session'

const pending: OrderItem[] = [
  { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
]
const submitted: SubmittedOrder[] = [
  {
    id: 'order-1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 1, note: '' },
    ],
  },
]

function defaultProps(overrides: Partial<React.ComponentProps<typeof OrderSummary>> = {}) {
  return {
    pendingItems: pending,
    submittedOrders: submitted,
    onUpdateItem: vi.fn(),
    onRemoveItem: vi.fn(),
    onSubmitOrder: vi.fn(),
    onPay: vi.fn(),
    onDraftReceipt: vi.fn(),
    ...overrides,
  }
}

describe('OrderSummary', () => {
  it('renders pending and submitted totals separately and a grand total', () => {
    render(<OrderSummary {...defaultProps()} />)
    expect(screen.getByTestId('pending-total')).toHaveTextContent('50.000đ')
    expect(screen.getByTestId('submitted-total')).toHaveTextContent('45.000đ')
    expect(screen.getByTestId('grand-total')).toHaveTextContent('95.000đ')
  })

  it('+/- buttons call onUpdateItem and 0 calls onRemoveItem', () => {
    const onUpdate = vi.fn()
    const onRemove = vi.fn()
    render(<OrderSummary {...defaultProps({ onUpdateItem: onUpdate, onRemoveItem: onRemove })} />)
    fireEvent.click(screen.getByLabelText('Tăng Cà phê đen'))
    expect(onUpdate).toHaveBeenCalledWith('m1', { quantity: 3 })

    fireEvent.click(screen.getByLabelText('Giảm Cà phê đen'))
    expect(onUpdate).toHaveBeenLastCalledWith('m1', { quantity: 1 })

    // simulate "giảm" from quantity=1 → 0 by using a pending of 1
    onUpdate.mockClear()
    onRemove.mockClear()
    render(
      <OrderSummary
        {...defaultProps({
          pendingItems: [{ ...pending[0], quantity: 1 }],
          onUpdateItem: onUpdate,
          onRemoveItem: onRemove,
        })}
      />,
    )
    fireEvent.click(screen.getAllByLabelText('Giảm Cà phê đen')[1])
    expect(onRemove).toHaveBeenCalledWith('m1')
  })

  it('× button removes the item directly', () => {
    const onRemove = vi.fn()
    render(<OrderSummary {...defaultProps({ onRemoveItem: onRemove })} />)
    fireEvent.click(screen.getByLabelText('Xoá Cà phê đen'))
    expect(onRemove).toHaveBeenCalledWith('m1')
  })

  it('typing in the note input forwards via onUpdateItem', () => {
    const onUpdate = vi.fn()
    render(<OrderSummary {...defaultProps({ onUpdateItem: onUpdate })} />)
    fireEvent.change(screen.getByPlaceholderText(/Ghi chú/), { target: { value: 'ít đường' } })
    expect(onUpdate).toHaveBeenCalledWith('m1', { note: 'ít đường' })
  })

  it('ĐẶT MÓN button is disabled when there are no pending items', () => {
    render(<OrderSummary {...defaultProps({ pendingItems: [] })} />)
    expect(screen.getByRole('button', { name: /ĐẶT MÓN/ })).toBeDisabled()
  })

  it('HĐ tạm and THANH TOÁN disabled when no submitted orders', () => {
    render(<OrderSummary {...defaultProps({ submittedOrders: [] })} />)
    expect(screen.getByRole('button', { name: /HĐ tạm/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /THANH TOÁN/ })).toBeDisabled()
  })

  it('ĐẶT MÓN opens a confirm dialog and only fires onSubmitOrder on XÁC NHẬN', () => {
    const onSubmit = vi.fn()
    render(<OrderSummary {...defaultProps({ onSubmitOrder: onSubmit })} />)
    fireEvent.click(screen.getByRole('button', { name: /ĐẶT MÓN/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Cà phê đen/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /XÁC NHẬN/ }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('HỦY closes the dialog without calling onSubmitOrder', () => {
    const onSubmit = vi.fn()
    render(<OrderSummary {...defaultProps({ onSubmitOrder: onSubmit })} />)
    fireEvent.click(screen.getByRole('button', { name: /ĐẶT MÓN/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /HỦY/ }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/order-summary.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/order-summary.tsx`**

```tsx
import { useMemo, useState } from 'react'
import type { OrderItem, SubmittedOrder } from '@/types/session'

interface Props {
  pendingItems: OrderItem[]
  submittedOrders: SubmittedOrder[]
  onUpdateItem: (menuItemId: string, patch: { quantity?: number; note?: string }) => void
  onRemoveItem: (menuItemId: string) => void
  onSubmitOrder: () => void
  onPay: () => void
  onDraftReceipt: () => void
}

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN').replace(/,/g, '.')}đ`
}

function sumItems(items: OrderItem[]): number {
  return items.reduce((s, i) => s + i.priceNum * i.quantity, 0)
}

export function OrderSummary({
  pendingItems,
  submittedOrders,
  onUpdateItem,
  onRemoveItem,
  onSubmitOrder,
  onPay,
  onDraftReceipt,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const pendingTotal = useMemo(() => sumItems(pendingItems), [pendingItems])
  const submittedTotal = useMemo(
    () => submittedOrders.reduce((s, o) => s + sumItems(o.items), 0),
    [submittedOrders],
  )
  const grand = pendingTotal + submittedTotal

  const canSubmit = pendingItems.length > 0
  const hasSubmitted = submittedOrders.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0e0e0e] text-[#f5f0e8]">
      {submittedOrders.length > 0 && (
        <details className="border-b border-[#2a2a2a] px-4 py-3 text-sm">
          <summary className="cursor-pointer text-[#888]">
            Đơn đã đặt ({submittedOrders.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {submittedOrders.map((o, idx) => (
              <li key={o.id} className="flex justify-between text-xs text-[#aaa]">
                <span>#{idx + 1} {new Date(o.submittedAt).toLocaleTimeString('vi-VN')}</span>
                <span>{formatVnd(sumItems(o.items))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ul className="flex-1 overflow-y-auto px-4 py-3">
        {pendingItems.length === 0 ? (
          <li className="text-center text-sm text-[#555]">Chưa có món nào trong giỏ</li>
        ) : (
          pendingItems.map((p) => (
            <li
              key={p.menuItemId}
              className="mb-3 rounded-lg border border-[#2a2a2a] bg-[#111] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-[#C9A84C]">{p.price}</div>
                </div>
                <button
                  type="button"
                  aria-label={`Xoá ${p.name}`}
                  onClick={() => onRemoveItem(p.menuItemId)}
                  className="text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Giảm ${p.name}`}
                  onClick={() => {
                    if (p.quantity <= 1) onRemoveItem(p.menuItemId)
                    else onUpdateItem(p.menuItemId, { quantity: p.quantity - 1 })
                  }}
                  className="h-7 w-7 rounded bg-[#2a2a2a]"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{p.quantity}</span>
                <button
                  type="button"
                  aria-label={`Tăng ${p.name}`}
                  onClick={() => onUpdateItem(p.menuItemId, { quantity: p.quantity + 1 })}
                  className="h-7 w-7 rounded bg-[#2a2a2a]"
                >
                  +
                </button>
              </div>
              <input
                type="text"
                value={p.note}
                placeholder="Ghi chú"
                onChange={(e) => onUpdateItem(p.menuItemId, { note: e.target.value })}
                className="mt-2 w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1 text-xs"
              />
            </li>
          ))
        )}
      </ul>

      <div className="border-t border-[#2a2a2a] bg-[#111] p-4">
        <Row label="Tạm tính (đang chọn)" value={pendingTotal} testId="pending-total" />
        <Row label="Đã đặt" value={submittedTotal} testId="submitted-total" />
        <Row label="Tổng cộng" value={grand} testId="grand-total" bold />

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => setConfirmOpen(true)}
            className="rounded bg-emerald-800 px-3 py-2 text-xs font-bold text-emerald-200 disabled:opacity-40"
          >
            ĐẶT MÓN
          </button>
          <button
            type="button"
            disabled={!hasSubmitted}
            onClick={onDraftReceipt}
            className="rounded border border-[#C9A84C] px-3 py-2 text-xs font-bold text-[#C9A84C] disabled:opacity-40"
          >
            HĐ tạm
          </button>
          <button
            type="button"
            disabled={!hasSubmitted}
            onClick={onPay}
            className="rounded bg-[#C9A84C] px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
          >
            THANH TOÁN
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-[#2a2a2a] bg-[#111] p-4">
            <h2 className="text-base font-semibold">Xác nhận đặt món</h2>
            <ul className="my-3 space-y-1 text-sm">
              {pendingItems.map((p) => (
                <li key={p.menuItemId} className="flex justify-between">
                  <span>{p.name} × {p.quantity}</span>
                  <span>{formatVnd(p.priceNum * p.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mb-3 flex justify-between text-sm font-semibold text-[#C9A84C]">
              <span>Tổng</span>
              <span>{formatVnd(pendingTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded border border-[#2a2a2a] px-3 py-2 text-sm"
              >
                HỦY
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false)
                  onSubmitOrder()
                }}
                className="rounded bg-emerald-800 px-3 py-2 text-sm font-bold text-emerald-200"
              >
                XÁC NHẬN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  testId,
  bold = false,
}: {
  label: string
  value: number
  testId: string
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold text-[#C9A84C]' : 'text-[#888]'}`}>
      <span>{label}</span>
      <span data-testid={testId}>{formatVnd(value)}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/order-summary.test.tsx
```

Expected: 8 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/order-summary.tsx src/tests/components/staff/order-summary.test.tsx
git commit -m "feat(staff): OrderSummary with totals, qty editor and confirm dialog"
```

---

### Task 11: `PaymentPanel` component

**Files:**
- Create: `src/components/staff/payment-panel.tsx`
- Create: `src/tests/components/staff/payment-panel.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/payment-panel.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PaymentPanel } from '@/components/staff/payment-panel'

describe('PaymentPanel', () => {
  it('shows total and 4 preset buttons in cash tab by default', () => {
    render(<PaymentPanel total={340_000} onConfirm={() => {}} />)
    expect(screen.getByTestId('payment-total')).toHaveTextContent('340.000đ')
    expect(screen.getAllByTestId('preset-button')).toHaveLength(4)
  })

  it('clicking a preset prefills the amount and computes change', () => {
    render(<PaymentPanel total={340_000} onConfirm={() => {}} />)
    fireEvent.click(screen.getAllByTestId('preset-button')[2]) // 400000
    expect((screen.getByTestId('amount-input') as HTMLInputElement).value).toBe('400000')
    expect(screen.getByTestId('change')).toHaveTextContent('60.000đ')
  })

  it('typing a custom amount updates change', () => {
    render(<PaymentPanel total={340_000} onConfirm={() => {}} />)
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '500000' } })
    expect(screen.getByTestId('change')).toHaveTextContent('160.000đ')
  })

  it('confirm button is disabled when received < total', () => {
    render(<PaymentPanel total={340_000} onConfirm={() => {}} />)
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '100000' } })
    expect(screen.getByRole('button', { name: /XÁC NHẬN/ })).toBeDisabled()
  })

  it('confirm fires onConfirm when received >= total', () => {
    const onConfirm = vi.fn()
    render(<PaymentPanel total={340_000} onConfirm={onConfirm} />)
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '400000' } })
    fireEvent.click(screen.getByRole('button', { name: /XÁC NHẬN/ }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('switches to transfer tab and shows QR placeholder + bank info', () => {
    render(<PaymentPanel total={340_000} onConfirm={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /CHUYỂN KHOẢN/ }))
    expect(screen.getByTestId('qr-placeholder')).toBeInTheDocument()
    expect(screen.getByText(/1234 5678 90/)).toBeInTheDocument()
    expect(screen.getByText(/ACB/)).toBeInTheDocument()
  })

  it('transfer confirm fires without amount check', () => {
    const onConfirm = vi.fn()
    render(<PaymentPanel total={340_000} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: /CHUYỂN KHOẢN/ }))
    fireEvent.click(screen.getByRole('button', { name: /XÁC NHẬN/ }))
    expect(onConfirm).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/payment-panel.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/payment-panel.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { generatePresets } from '@/data/staff-data'

interface Props {
  total: number
  onConfirm: () => void
}

type Tab = 'cash' | 'transfer'

function formatVnd(n: number): string {
  return `${Math.max(0, n).toLocaleString('vi-VN').replace(/,/g, '.')}đ`
}

export function PaymentPanel({ total, onConfirm }: Props) {
  const [tab, setTab] = useState<Tab>('cash')
  const [amount, setAmount] = useState<number>(0)
  const presets = useMemo(() => generatePresets(total), [total])
  const change = amount - total
  const canConfirmCash = amount >= total && total > 0

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-[#2a2a2a] bg-[#111] p-4 text-[#f5f0e8]">
      <div className="grid grid-cols-2 overflow-hidden rounded border border-[#2a2a2a]">
        <button
          type="button"
          onClick={() => setTab('cash')}
          className={`py-2 text-sm font-semibold ${tab === 'cash' ? 'bg-[#C9A84C] text-black' : 'bg-[#1a1a1a]'}`}
        >
          TIỀN MẶT
        </button>
        <button
          type="button"
          onClick={() => setTab('transfer')}
          className={`py-2 text-sm font-semibold ${tab === 'transfer' ? 'bg-[#C9A84C] text-black' : 'bg-[#1a1a1a]'}`}
        >
          CHUYỂN KHOẢN
        </button>
      </div>

      <div className="rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3">
        <div className="text-xs uppercase tracking-wide text-[#888]">Cần thu</div>
        <div data-testid="payment-total" className="text-2xl font-bold text-[#C9A84C]">
          {formatVnd(total)}
        </div>
      </div>

      {tab === 'cash' ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p, i) => (
              <button
                key={`${p}-${i}`}
                data-testid="preset-button"
                type="button"
                onClick={() => setAmount(p)}
                className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-2 text-xs font-medium hover:bg-[#222]"
              >
                {formatVnd(p)}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[#888]">Số tiền nhận</span>
            <input
              data-testid="amount-input"
              type="number"
              value={amount || ''}
              min={0}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-base"
            />
          </label>
          <div className="rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3 text-sm">
            <div className="text-[#888]">Tiền thừa</div>
            <div data-testid="change" className="text-lg font-bold">
              {formatVnd(change)}
            </div>
          </div>
          <button
            type="button"
            disabled={!canConfirmCash}
            onClick={onConfirm}
            className="rounded bg-[#C9A84C] py-3 text-sm font-bold text-black disabled:opacity-40"
          >
            XÁC NHẬN
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2">
            <svg
              data-testid="qr-placeholder"
              width="160"
              height="160"
              viewBox="0 0 160 160"
              className="rounded bg-white p-2"
            >
              <rect x="0" y="0" width="160" height="160" fill="white" />
              <rect x="10" y="10" width="30" height="30" fill="black" />
              <rect x="120" y="10" width="30" height="30" fill="black" />
              <rect x="10" y="120" width="30" height="30" fill="black" />
              <rect x="60" y="60" width="40" height="40" fill="black" />
            </svg>
            <div className="text-center text-sm">
              <div className="font-semibold">1234 5678 90 — ACB</div>
              <div className="text-[#888]">The Terminal</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-[#C9A84C] py-3 text-sm font-bold text-black"
          >
            XÁC NHẬN
          </button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/payment-panel.test.tsx
```

Expected: 7 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/payment-panel.tsx src/tests/components/staff/payment-panel.test.tsx
git commit -m "feat(staff): PaymentPanel with cash/transfer tabs and presets"
```

---

### Task 12: `InvoiceForm` component

**Files:**
- Create: `src/components/staff/invoice-form.tsx`
- Create: `src/tests/components/staff/invoice-form.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/invoice-form.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InvoiceForm } from '@/components/staff/invoice-form'

describe('InvoiceForm', () => {
  it('renders 4 buyer inputs and two payment method tabs', () => {
    render(<InvoiceForm onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByLabelText('Tên người mua')).toBeInTheDocument()
    expect(screen.getByLabelText('Mã số thuế')).toBeInTheDocument()
    expect(screen.getByLabelText('Địa chỉ')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /TIỀN MẶT/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /CHUYỂN KHOẢN/ })).toBeInTheDocument()
  })

  it('XUẤT HOÁ ĐƠN button is disabled until all 4 fields have non-whitespace values', () => {
    render(<InvoiceForm onSubmit={() => {}} onCancel={() => {}} />)
    const submit = screen.getByRole('button', { name: /XUẤT HOÁ ĐƠN/ })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Tên người mua'), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText('Mã số thuế'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: 'addr' } })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '   ' } })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    expect(submit).toBeEnabled()
  })

  it('XUẤT HOÁ ĐƠN forwards the trimmed request', () => {
    const onSubmit = vi.fn()
    render(<InvoiceForm onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText('Tên người mua'), { target: { value: '  A  ' } })
    fireEvent.change(screen.getByLabelText('Mã số thuế'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: 'addr' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /CHUYỂN KHOẢN/ }))
    fireEvent.click(screen.getByRole('button', { name: /XUẤT HOÁ ĐƠN/ }))
    expect(onSubmit).toHaveBeenCalledWith({
      buyerName: 'A',
      buyerTaxCode: '123',
      buyerAddress: 'addr',
      buyerEmail: 'a@b.com',
      paymentMethod: 'transfer',
    })
  })

  it('HỦY fires onCancel', () => {
    const onCancel = vi.fn()
    render(<InvoiceForm onSubmit={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /HỦY/ }))
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/invoice-form.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/invoice-form.tsx`**

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
      <div className="w-full max-w-md rounded-lg border border-[#2a2a2a] bg-[#111] p-6 text-[#f5f0e8]">
        <h2 className="text-lg font-semibold">Thông tin xuất hoá đơn</h2>
        <div className="mt-4 space-y-3">
          <Field label="Tên người mua" value={buyerName} onChange={setBuyerName} />
          <Field label="Mã số thuế" value={buyerTaxCode} onChange={setBuyerTaxCode} />
          <Field label="Địa chỉ" value={buyerAddress} onChange={setBuyerAddress} />
          <Field label="Email" type="email" value={buyerEmail} onChange={setBuyerEmail} />

          <div>
            <span className="mb-1 block text-xs text-[#888]">Phương thức thanh toán</span>
            <div className="grid grid-cols-2 overflow-hidden rounded border border-[#2a2a2a]">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 text-sm font-semibold ${paymentMethod === 'cash' ? 'bg-[#C9A84C] text-black' : 'bg-[#1a1a1a]'}`}
              >
                TIỀN MẶT
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`py-2 text-sm font-semibold ${paymentMethod === 'transfer' ? 'bg-[#C9A84C] text-black' : 'bg-[#1a1a1a]'}`}
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
            className="rounded border border-[#2a2a2a] py-2 text-sm font-semibold"
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
            className="rounded bg-[#C9A84C] py-2 text-sm font-bold text-black disabled:opacity-40"
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
      <span className="text-[#888]">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-[#f5f0e8]"
      />
    </label>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/invoice-form.test.tsx
```

Expected: 4 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/invoice-form.tsx src/tests/components/staff/invoice-form.test.tsx
git commit -m "feat(staff): InvoiceForm with buyer fields and payment method tabs"
```

---

### Task 13: `ReceiptPreview` component

**Files:**
- Create: `src/components/staff/receipt-preview.tsx`
- Create: `src/tests/components/staff/receipt-preview.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/receipt-preview.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReceiptPreview } from '@/components/staff/receipt-preview'
import type { SubmittedOrder } from '@/types/session'

const orders: SubmittedOrder[] = [
  {
    id: 'o1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
    ],
  },
  {
    id: 'o2',
    submittedAt: '2026-06-01T10:30:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
      { menuItemId: 'm2', name: 'Trà đào', priceNum: 45_000, price: '45.000đ', quantity: 1, note: '' },
    ],
  },
]

describe('ReceiptPreview', () => {
  it('renders restaurant header and table label', () => {
    render(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={false} issuedAt="2026-06-01T10:30:00Z" />,
    )
    expect(screen.getByText(/THE TERMINAL/i)).toBeInTheDocument()
    expect(screen.getByText(/Bàn 01/)).toBeInTheDocument()
  })

  it('merges duplicate menu items', () => {
    render(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={false} issuedAt="2026-06-01T10:30:00Z" />,
    )
    expect(screen.getAllByText('Cà phê đen')).toHaveLength(1)
    expect(screen.getByTestId('row-qty-m1')).toHaveTextContent('3')
  })

  it('computes the receipt total over merged items', () => {
    render(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={false} issuedAt="2026-06-01T10:30:00Z" />,
    )
    // 3*25000 + 1*45000 = 120000
    expect(screen.getByTestId('receipt-total')).toHaveTextContent('120.000đ')
  })

  it('shows "BẢN TẠM" watermark only when isDraft is true', () => {
    const { rerender } = render(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={false} issuedAt="2026-06-01T10:30:00Z" />,
    )
    expect(screen.queryByTestId('watermark')).not.toBeInTheDocument()

    rerender(
      <ReceiptPreview tableLabel="Bàn 01" orders={orders} isDraft={true} issuedAt="2026-06-01T10:30:00Z" />,
    )
    expect(screen.getByTestId('watermark')).toHaveTextContent('BẢN TẠM')
    expect(screen.getByTestId('watermark').className).toMatch(/print:hidden/)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/receipt-preview.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/receipt-preview.tsx`**

```tsx
import { useMemo } from 'react'
import type { SubmittedOrder } from '@/types/session'
import { mergeOrderItems } from '@/lib/staff-orders'
import { STAFF_ADMIN_SETTINGS } from '@/data/staff-data'

interface Props {
  tableLabel: string
  orders: SubmittedOrder[]
  isDraft: boolean
  issuedAt: string
}

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN').replace(/,/g, '.')}đ`
}

export function ReceiptPreview({ tableLabel, orders, isDraft, issuedAt }: Props) {
  const merged = useMemo(() => mergeOrderItems(orders), [orders])
  const total = merged.reduce((s, m) => s + m.priceNum * m.quantity, 0)
  const date = new Date(issuedAt)

  return (
    <div className="relative mx-auto max-w-sm bg-white p-4 text-xs text-black">
      {isDraft && (
        <div
          data-testid="watermark"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-5xl font-extrabold tracking-widest text-gray-300 print:hidden"
          style={{ transform: 'rotate(-25deg)' }}
        >
          BẢN TẠM
        </div>
      )}

      <header className="text-center">
        <h1 className="text-base font-bold">{STAFF_ADMIN_SETTINGS.restaurantName}</h1>
        <p className="text-[10px]">{STAFF_ADMIN_SETTINGS.address}</p>
        <p className="text-[10px]">ĐT: {STAFF_ADMIN_SETTINGS.phone}</p>
      </header>

      <h2 className="my-2 text-center text-sm font-bold uppercase">
        {isDraft ? 'Hoá đơn tạm' : 'Hoá đơn'}
      </h2>

      <div className="flex justify-between">
        <span>{tableLabel}</span>
        <span>{date.toLocaleString('vi-VN')}</span>
      </div>

      <hr className="my-2 border-dashed border-black" />

      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th className="py-0.5">Món</th>
            <th className="py-0.5 text-center">SL</th>
            <th className="py-0.5 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {merged.map((m) => (
            <tr key={m.menuItemId}>
              <td className="py-0.5">{m.name}</td>
              <td data-testid={`row-qty-${m.menuItemId}`} className="py-0.5 text-center">
                {m.quantity}
              </td>
              <td className="py-0.5 text-right">{formatVnd(m.priceNum * m.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="my-2 border-dashed border-black" />

      <div className="flex justify-between text-sm font-bold">
        <span>Tổng cộng</span>
        <span data-testid="receipt-total">{formatVnd(total)}</span>
      </div>

      <p className="mt-1 text-[10px] italic">Giá đã bao gồm VAT</p>
      <p className="mt-3 text-center text-[10px]">Cảm ơn quý khách. Hẹn gặp lại!</p>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/receipt-preview.test.tsx
```

Expected: 4 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/receipt-preview.tsx src/tests/components/staff/receipt-preview.test.tsx
git commit -m "feat(staff): ReceiptPreview thermal layout with optional draft watermark"
```

---

### Task 14: `InvoicePreview` component

**Files:**
- Create: `src/components/staff/invoice-preview.tsx`
- Create: `src/tests/components/staff/invoice-preview.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/invoice-preview.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InvoicePreview } from '@/components/staff/invoice-preview'
import type { InvoiceData } from '@/types/invoice'

const invoice: InvoiceData = {
  number: '0000123',
  symbol: 'AA/25E',
  issuedAt: '2026-06-01T10:00:00Z',
  seller: {
    name: 'THE TERMINAL',
    address: '123 Lê Lợi',
    taxCode: '0312345678',
    phone: '0901234567',
  },
  buyer: {
    buyerName: 'Nguyễn Văn A',
    buyerTaxCode: '0301122334',
    buyerAddress: '456 Nguyễn Huệ',
    buyerEmail: 'a@example.com',
    paymentMethod: 'cash',
  },
  items: [
    { name: 'Cà phê đen', unit: 'phần', quantity: 2, unitPrice: 22_727, amount: 45_454 },
    { name: 'Trà đào', unit: 'phần', quantity: 1, unitPrice: 40_909, amount: 40_909 },
  ],
  subtotal: 86_363,
  vatRate: 0.1,
  vatAmount: 8_636,
  total: 94_999,
  totalInWords: 'Chín mươi bốn nghìn chín trăm chín mươi chín đồng',
}

describe('InvoicePreview', () => {
  it('renders the invoice number and symbol in the header area', () => {
    render(<InvoicePreview invoice={invoice} />)
    expect(screen.getByText(/0000123/)).toBeInTheDocument()
    expect(screen.getByText(/AA\/25E/)).toBeInTheDocument()
  })

  it('renders seller and buyer blocks', () => {
    render(<InvoicePreview invoice={invoice} />)
    expect(screen.getByText('THE TERMINAL')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText(/0312345678/)).toBeInTheDocument()
    expect(screen.getByText(/0301122334/)).toBeInTheDocument()
  })

  it('renders all line items', () => {
    render(<InvoicePreview invoice={invoice} />)
    expect(screen.getByText('Cà phê đen')).toBeInTheDocument()
    expect(screen.getByText('Trà đào')).toBeInTheDocument()
  })

  it('renders totals and the words representation', () => {
    render(<InvoicePreview invoice={invoice} />)
    expect(screen.getByTestId('invoice-subtotal')).toHaveTextContent('86.363')
    expect(screen.getByTestId('invoice-vat')).toHaveTextContent('8.636')
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('94.999')
    expect(screen.getByText(invoice.totalInWords)).toBeInTheDocument()
  })

  it('shows BẢN MẪU watermark that is hidden when printing', () => {
    render(<InvoicePreview invoice={invoice} />)
    const wm = screen.getByTestId('watermark')
    expect(wm).toHaveTextContent('BẢN MẪU')
    expect(wm.className).toMatch(/print:hidden/)
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/invoice-preview.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/invoice-preview.tsx`**

```tsx
import type { InvoiceData } from '@/types/invoice'

interface Props {
  invoice: InvoiceData
}

function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN').replace(/,/g, '.')
}

export function InvoicePreview({ invoice }: Props) {
  const date = new Date(invoice.issuedAt)
  return (
    <div className="relative mx-auto max-w-[210mm] bg-white p-10 text-sm text-black print:p-6">
      <div
        data-testid="watermark"
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-7xl font-extrabold tracking-widest text-gray-200 print:hidden"
        style={{ transform: 'rotate(-30deg)' }}
      >
        BẢN MẪU
      </div>

      <header className="mb-6 grid grid-cols-2 gap-4 border-b border-black pb-4">
        <div>
          <div className="text-xs">Mẫu số: 1/001</div>
          <div className="text-xs">Ký hiệu: {invoice.symbol}</div>
          <div className="text-xs">Số: {invoice.number}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold uppercase">Hoá đơn giá trị gia tăng</div>
          <div className="text-xs">
            Ngày {date.getDate()} tháng {date.getMonth() + 1} năm {date.getFullYear()}
          </div>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-6 text-xs">
        <div>
          <div className="font-semibold">Đơn vị bán</div>
          <div>{invoice.seller.name}</div>
          <div>Địa chỉ: {invoice.seller.address}</div>
          <div>MST: {invoice.seller.taxCode}</div>
          <div>ĐT: {invoice.seller.phone}</div>
        </div>
        <div>
          <div className="font-semibold">Đơn vị mua</div>
          <div>{invoice.buyer.buyerName}</div>
          <div>Địa chỉ: {invoice.buyer.buyerAddress}</div>
          <div>MST: {invoice.buyer.buyerTaxCode}</div>
          <div>Email: {invoice.buyer.buyerEmail}</div>
          <div>
            Hình thức thanh toán: {invoice.buyer.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
          </div>
        </div>
      </section>

      <table className="mb-4 w-full border-collapse border border-black text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-1">STT</th>
            <th className="border border-black p-1 text-left">Tên hàng hoá, dịch vụ</th>
            <th className="border border-black p-1">ĐVT</th>
            <th className="border border-black p-1">SL</th>
            <th className="border border-black p-1 text-right">Đơn giá</th>
            <th className="border border-black p-1 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, idx) => (
            <tr key={`${it.name}-${idx}`}>
              <td className="border border-black p-1 text-center">{idx + 1}</td>
              <td className="border border-black p-1">{it.name}</td>
              <td className="border border-black p-1 text-center">{it.unit}</td>
              <td className="border border-black p-1 text-center">{it.quantity}</td>
              <td className="border border-black p-1 text-right">{formatVnd(it.unitPrice)}</td>
              <td className="border border-black p-1 text-right">{formatVnd(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mb-4 space-y-1 text-sm">
        <Row label="Cộng tiền hàng" value={invoice.subtotal} testId="invoice-subtotal" />
        <Row label={`Thuế suất GTGT (${Math.round(invoice.vatRate * 100)}%)`} value={invoice.vatAmount} testId="invoice-vat" />
        <Row label="Tổng cộng thanh toán" value={invoice.total} testId="invoice-total" bold />
      </section>

      <p className="mb-6 text-xs italic">Số tiền viết bằng chữ: {invoice.totalInWords}</p>

      <section className="grid grid-cols-2 gap-6 text-center text-xs">
        <div>
          <div className="font-semibold">Người mua hàng</div>
          <div className="mt-12 italic">(Ký, ghi rõ họ tên)</div>
        </div>
        <div>
          <div className="font-semibold">Người bán hàng</div>
          <div className="mt-12 italic">(Ký, đóng dấu, ghi rõ họ tên)</div>
        </div>
      </section>
    </div>
  )
}

function Row({
  label,
  value,
  testId,
  bold = false,
}: {
  label: string
  value: number
  testId: string
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-black pt-1 font-bold' : ''}`}>
      <span>{label}</span>
      <span data-testid={testId}>{formatVnd(value)}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/invoice-preview.test.tsx
```

Expected: 5 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/invoice-preview.tsx src/tests/components/staff/invoice-preview.test.tsx
git commit -m "feat(staff): InvoicePreview Vietnamese VAT invoice layout"
```

---

### Task 15: `ReceiptDialog` component

**Files:**
- Create: `src/components/staff/receipt-dialog.tsx`
- Create: `src/tests/components/staff/receipt-dialog.test.tsx`

- [ ] **Step 1: Write failing test `src/tests/components/staff/receipt-dialog.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReceiptDialog } from '@/components/staff/receipt-dialog'
import type { SubmittedOrder } from '@/types/session'

const orders: SubmittedOrder[] = [
  {
    id: 'o1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      { menuItemId: 'm1', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 1, note: '' },
    ],
  },
]

describe('ReceiptDialog', () => {
  const originalOpen = window.open
  beforeEach(() => {
    window.open = vi.fn() as unknown as typeof window.open
  })
  afterEach(() => {
    window.open = originalOpen
  })

  it('renders embedded ReceiptPreview content', () => {
    render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Cà phê đen')).toBeInTheDocument()
  })

  it('print button opens a popup with the correct staff receipt url', () => {
    render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft={true}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /IN/ }))
    expect(window.open).toHaveBeenCalledWith('/staff/table/t1/receipt?draft=true', '_blank')
  })

  it('print uses draft=false when isDraft prop is false', () => {
    render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft={false}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /IN/ }))
    expect(window.open).toHaveBeenCalledWith('/staff/table/t1/receipt?draft=false', '_blank')
  })

  it('shows HOÀN TẤT only when onDone is provided', () => {
    const { rerender } = render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft
        onClose={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /HOÀN TẤT/ })).not.toBeInTheDocument()

    const onDone = vi.fn()
    rerender(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft={false}
        onClose={() => {}}
        onDone={onDone}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HOÀN TẤT/ }))
    expect(onDone).toHaveBeenCalled()
  })

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn()
    render(
      <ReceiptDialog
        tableId="t1"
        tableLabel="Bàn 01"
        orders={orders}
        isDraft
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByTestId('receipt-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/tests/components/staff/receipt-dialog.test.tsx
```

Expected: cannot find module.

- [ ] **Step 3: Implement `src/components/staff/receipt-dialog.tsx`**

```tsx
import type { SubmittedOrder } from '@/types/session'
import { ReceiptPreview } from './receipt-preview'

interface Props {
  tableId: string
  tableLabel: string
  orders: SubmittedOrder[]
  isDraft: boolean
  onClose: () => void
  onDone?: () => void
}

export function ReceiptDialog({ tableId, tableLabel, orders, isDraft, onClose, onDone }: Props) {
  const handlePrint = () => {
    window.open(`/staff/table/${tableId}/receipt?draft=${isDraft}`, '_blank')
  }

  const issuedAt = new Date().toISOString()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div
        data-testid="receipt-backdrop"
        onClick={onClose}
        className="absolute inset-0"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-t-lg bg-[#111] sm:rounded-lg">
        <div className="max-h-[70vh] overflow-y-auto">
          <ReceiptPreview
            tableLabel={tableLabel}
            orders={orders}
            isDraft={isDraft}
            issuedAt={issuedAt}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-[#2a2a2a] p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#2a2a2a] py-2 text-sm font-semibold text-[#f5f0e8]"
          >
            ĐÓNG
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded bg-[#C9A84C] py-2 text-sm font-bold text-black"
          >
            IN
          </button>
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="col-span-2 rounded bg-emerald-800 py-2 text-sm font-bold text-emerald-200"
            >
              HOÀN TẤT
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/tests/components/staff/receipt-dialog.test.tsx
```

Expected: 5 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/receipt-dialog.tsx src/tests/components/staff/receipt-dialog.test.tsx
git commit -m "feat(staff): ReceiptDialog modal wrapper with print and done actions"
```

---

### Task 16: `StaffFloorPlan` page + routing

**Files:**
- Create: `src/app/staff/floor-plan.tsx`
- Create: `src/app/staff/index.ts`
- Modify: `src/constants/route.ts`
- Modify: `src/router/loadable.tsx`
- Modify: `src/router/index.tsx`

- [ ] **Step 1: Add route constants to `src/constants/route.ts`**

Insert just after the `STAFF_COIN_POLICY` line (around line 63), before the `STAFF_CAMPAIGN` block:

```ts
  // Staff POS (kiosk)
  STAFF_POS_FLOOR_PLAN: '/staff',
  STAFF_POS_TABLE_ORDER: '/staff/table/:id',
  STAFF_POS_TABLE_PAYMENT: '/staff/table/:id/payment',
  STAFF_POS_TABLE_INVOICE: '/staff/table/:id/invoice',
  STAFF_POS_TABLE_RECEIPT: '/staff/table/:id/receipt',
```

- [ ] **Step 2: Create `src/app/staff/floor-plan.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FloorPlan } from '@/components/staff/floor-plan'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_TABLES } from '@/data/staff-data'

export default function StaffFloorPlanPage() {
  const navigate = useNavigate()
  const { sessions, openSession } = useTableSessions()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const formattedNow = useMemo(() => {
    const d = now
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }, [now])

  const handleTableClick = (tableId: string) => {
    const s = sessions[tableId]
    if (!s || s.status === 'empty' || s.status === 'done') {
      openSession(tableId)
      navigate(`/staff/table/${tableId}`)
    } else if (s.status === 'waiting_payment') {
      navigate(`/staff/table/${tableId}/payment`)
    } else {
      navigate(`/staff/table/${tableId}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f5f0e8]">
      <header className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-[#C9A84C]">THE TERMINAL</span>
          <span className="rounded bg-[#C9A84C]/15 px-2 py-0.5 text-xs font-medium text-[#C9A84C]">
            NHÂN VIÊN
          </span>
        </div>
        <div className="font-mono text-sm text-[#888]">{formattedNow}</div>
        <Link to="/admin" className="text-xs text-[#888] hover:text-[#C9A84C]">
          QUẢN LÝ
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <FloorPlan tables={STAFF_TABLES} sessions={sessions} onTableClick={handleTableClick} />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create barrel `src/app/staff/index.ts`**

```ts
export { default as StaffFloorPlanPage } from './floor-plan'
export { default as StaffTableOrderPage } from './table-order'
export { default as StaffPaymentPage } from './payment'
export { default as StaffInvoicePage } from './invoice'
export { default as StaffReceiptPage } from './receipt'
```

> The barrel re-exports all 5 pages up front so that adding loadable entries below does not require touching this file again.

- [ ] **Step 4: Add lazy loadables to `src/router/loadable.tsx`**

Append at the end of the file (after the `DownloadPage` block):

```tsx
//Staff POS (kiosk)
export const StaffFloorPlanPage = React.lazy(() =>
  import('@/app/staff').then((module) => ({
    default: module.StaffFloorPlanPage,
  })),
)

export const StaffTableOrderPage = React.lazy(() =>
  import('@/app/staff').then((module) => ({
    default: module.StaffTableOrderPage,
  })),
)

export const StaffPaymentPage = React.lazy(() =>
  import('@/app/staff').then((module) => ({
    default: module.StaffPaymentPage,
  })),
)

export const StaffInvoicePage = React.lazy(() =>
  import('@/app/staff').then((module) => ({
    default: module.StaffInvoicePage,
  })),
)

export const StaffReceiptPage = React.lazy(() =>
  import('@/app/staff').then((module) => ({
    default: module.StaffReceiptPage,
  })),
)
```

- [ ] **Step 5: Wire routes in `src/router/index.tsx`**

Add to the import block at the top (alongside other loadables):

```tsx
  StaffFloorPlanPage,
  StaffTableOrderPage,
  StaffPaymentPage,
  StaffInvoicePage,
  StaffReceiptPage,
```

Add to the `children: [...]` array of the `RootLayout` route, just before the `path: '*'` fallback (lines ~1418-1426 of the current file):

```tsx
{
  path: ROUTE.STAFF_POS_FLOOR_PLAN,
  element: <SuspenseElement component={StaffFloorPlanPage} />,
},
{
  path: ROUTE.STAFF_POS_TABLE_ORDER,
  element: <SuspenseElement component={StaffTableOrderPage} />,
},
{
  path: ROUTE.STAFF_POS_TABLE_PAYMENT,
  element: <SuspenseElement component={StaffPaymentPage} />,
},
{
  path: ROUTE.STAFF_POS_TABLE_INVOICE,
  element: <SuspenseElement component={StaffInvoicePage} />,
},
{
  path: ROUTE.STAFF_POS_TABLE_RECEIPT,
  element: <SuspenseElement component={StaffReceiptPage} />,
},
```

> Note: the four child pages do not exist yet — they are created in tasks 17–20. To keep the build green during this task, create minimal placeholder files now (deleted/overwritten in their respective tasks):

```tsx
// src/app/staff/table-order.tsx
export default function StaffTableOrderPage() { return null }
```

```tsx
// src/app/staff/payment.tsx
export default function StaffPaymentPage() { return null }
```

```tsx
// src/app/staff/invoice.tsx
export default function StaffInvoicePage() { return null }
```

```tsx
// src/app/staff/receipt.tsx
export default function StaffReceiptPage() { return null }
```

- [ ] **Step 6: Run a sanity build**

```bash
npx tsc --noEmit 2>&1 | tail -20
```

Expected: no TypeScript errors. Then:

```bash
npm run lint 2>&1 | tail -20
```

Expected: no new lint errors in `src/app/staff/**` or `src/router/**`.

- [ ] **Step 7: Smoke-render test (optional manual)**

```bash
npx vitest run src/tests/components/staff/floor-plan.test.tsx
```

Expected: still passes (no regressions).

- [ ] **Step 8: Commit**

```bash
git add src/app/staff src/constants/route.ts src/router/loadable.tsx src/router/index.tsx
git commit -m "feat(staff): add /staff floor-plan page and wire POS routes"
```

---

### Task 17: `StaffTableOrder` page

**Files:**
- Overwrite: `src/app/staff/table-order.tsx`

- [ ] **Step 1: Implement `src/app/staff/table-order.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MenuPanel } from '@/components/staff/menu-panel'
import { OrderSummary } from '@/components/staff/order-summary'
import { ReceiptDialog } from '@/components/staff/receipt-dialog'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_TABLES } from '@/data/staff-data'
import type { OrderItem } from '@/types/session'

export default function StaffTableOrderPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    sessions,
    addItem,
    updateItem,
    removeItem,
    submitOrder,
    requestPayment,
  } = useTableSessions()

  const [mobilePane, setMobilePane] = useState<'menu' | 'order'>('menu')
  const [showDraft, setShowDraft] = useState(false)

  const table = useMemo(() => STAFF_TABLES.find((t) => t.id === id), [id])
  const session = sessions[id]

  if (!table || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e0e] text-[#f5f0e8]">
        <div className="text-center">
          <p>Không tìm thấy bàn hoặc phiên đã đóng.</p>
          <Link to="/staff" className="mt-3 inline-block text-[#C9A84C] underline">
            ← Về sơ đồ
          </Link>
        </div>
      </div>
    )
  }

  const handleAdd = (item: Omit<OrderItem, 'quantity' | 'note'>) => {
    addItem(id, { ...item, quantity: 1, note: '' })
  }

  const handlePay = () => {
    requestPayment(id)
    navigate(`/staff/table/${id}/payment`)
  }

  const statusLabel =
    session.status === 'waiting_payment' ? 'CHỜ THANH TOÁN' : 'ĐANG PHỤC VỤ'

  return (
    <div className="flex h-screen flex-col bg-[#0e0e0e] text-[#f5f0e8]">
      <header className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111] px-4 py-3">
        <Link to="/staff" className="text-sm text-[#888] hover:text-[#C9A84C]">
          ← Sơ đồ
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">{table.label}</span>
          <span className="rounded bg-[#C9A84C]/15 px-2 py-0.5 text-xs text-[#C9A84C]">
            {statusLabel}
          </span>
        </div>
        {session.submittedOrders.length > 0 ? (
          <button
            type="button"
            onClick={handlePay}
            className="rounded bg-[#C9A84C] px-3 py-1 text-xs font-bold text-black"
          >
            THANH TOÁN
          </button>
        ) : (
          <span />
        )}
      </header>

      <div className="flex border-b border-[#2a2a2a] bg-[#111] lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePane('menu')}
          className={`flex-1 py-2 text-sm ${mobilePane === 'menu' ? 'text-[#C9A84C]' : 'text-[#888]'}`}
        >
          Thực đơn
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('order')}
          className={`flex-1 py-2 text-sm ${mobilePane === 'order' ? 'text-[#C9A84C]' : 'text-[#888]'}`}
        >
          Đơn ({session.pendingItems.length})
        </button>
      </div>

      <main className="grid min-h-0 flex-1 lg:grid-cols-[1fr_360px]">
        <div className={`min-h-0 ${mobilePane === 'menu' ? 'block' : 'hidden'} lg:block`}>
          <MenuPanel pendingItems={session.pendingItems} onAdd={handleAdd} />
        </div>
        <div
          className={`min-h-0 border-l border-[#2a2a2a] ${
            mobilePane === 'order' ? 'block' : 'hidden'
          } lg:block`}
        >
          <OrderSummary
            pendingItems={session.pendingItems}
            submittedOrders={session.submittedOrders}
            onUpdateItem={(menuItemId, patch) => updateItem(id, menuItemId, patch)}
            onRemoveItem={(menuItemId) => removeItem(id, menuItemId)}
            onSubmitOrder={() => submitOrder(id)}
            onPay={handlePay}
            onDraftReceipt={() => setShowDraft(true)}
          />
        </div>
      </main>

      {showDraft && (
        <ReceiptDialog
          tableId={id}
          tableLabel={table.label}
          orders={session.submittedOrders}
          isDraft
          onClose={() => setShowDraft(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript sanity check**

```bash
npx tsc --noEmit 2>&1 | grep "src/app/staff" | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/table-order.tsx
git commit -m "feat(staff): StaffTableOrder page with menu, order summary and draft receipt"
```

---

### Task 18: `StaffPayment` page

**Files:**
- Overwrite: `src/app/staff/payment.tsx`

- [ ] **Step 1: Implement `src/app/staff/payment.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PaymentPanel } from '@/components/staff/payment-panel'
import { InvoiceForm } from '@/components/staff/invoice-form'
import { ReceiptDialog } from '@/components/staff/receipt-dialog'
import { useTableSessions } from '@/hooks/useTableSessions'
import { STAFF_TABLES } from '@/data/staff-data'
import type { InvoiceRequest } from '@/types/invoice'

function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN').replace(/,/g, '.')}đ`
}

export default function StaffPaymentPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessions, closeSession, setInvoiceRequest } = useTableSessions()
  const [showReceipt, setShowReceipt] = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)

  const table = useMemo(() => STAFF_TABLES.find((t) => t.id === id), [id])
  const session = sessions[id]

  if (!table || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e0e] text-[#f5f0e8]">
        <p>
          Không tìm thấy phiên thanh toán.{' '}
          <Link to="/staff" className="text-[#C9A84C] underline">← Sơ đồ</Link>
        </p>
      </div>
    )
  }

  const total = useMemo(
    () =>
      session.submittedOrders.reduce(
        (s, o) => s + o.items.reduce((ss, i) => ss + i.priceNum * i.quantity, 0),
        0,
      ),
    [session.submittedOrders],
  )

  const handleConfirm = () => {
    toast.success('Đã thanh toán')
    closeSession(id)
    navigate('/staff')
  }

  const handleInvoiceSubmit = (req: InvoiceRequest) => {
    setInvoiceRequest(id, req)
    setShowInvoiceForm(false)
    navigate(`/staff/table/${id}/invoice`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0e0e0e] text-[#f5f0e8]">
      <header className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111] px-4 py-3">
        <Link to={`/staff/table/${id}`} className="text-sm text-[#888] hover:text-[#C9A84C]">
          ← Quay lại
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">{table.label}</span>
          <span className="rounded bg-orange-500/15 px-2 py-0.5 text-xs text-orange-400">
            CHỜ THANH TOÁN
          </span>
        </div>
        <span />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-[#2a2a2a] bg-[#111] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#888]">Chi tiết đơn</h2>
          <ul className="space-y-2">
            {session.submittedOrders.flatMap((o) =>
              o.items.map((i) => (
                <li key={`${o.id}-${i.menuItemId}`} className="flex justify-between text-sm">
                  <span>{i.name} × {i.quantity}</span>
                  <span className="text-[#C9A84C]">
                    {formatVnd(i.priceNum * i.quantity)}
                  </span>
                </li>
              )),
            )}
          </ul>
          <div className="mt-4 flex justify-between border-t border-[#2a2a2a] pt-3 text-base font-bold">
            <span>Tổng cộng</span>
            <span className="text-[#C9A84C]">{formatVnd(total)}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setShowReceipt(true)}
              className="rounded border border-[#C9A84C] py-2 text-xs font-bold text-[#C9A84C]"
            >
              HOÁ ĐƠN TẠM
            </button>
            <button
              type="button"
              onClick={() => setShowInvoiceForm(true)}
              className="rounded border border-[#2a2a2a] py-2 text-xs font-bold text-[#f5f0e8]"
            >
              XUẤT HOÁ ĐƠN
            </button>
            <button
              type="button"
              onClick={() => navigate('/staff')}
              className="rounded border border-[#2a2a2a] py-2 text-xs font-bold text-[#f5f0e8]"
            >
              HỦY
            </button>
          </div>
        </section>

        <PaymentPanel total={total} onConfirm={handleConfirm} />
      </main>

      {showReceipt && (
        <ReceiptDialog
          tableId={id}
          tableLabel={table.label}
          orders={session.submittedOrders}
          isDraft
          onClose={() => setShowReceipt(false)}
        />
      )}

      {showInvoiceForm && (
        <InvoiceForm onSubmit={handleInvoiceSubmit} onCancel={() => setShowInvoiceForm(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript sanity check**

```bash
npx tsc --noEmit 2>&1 | grep "src/app/staff/payment" | head -20
```

Expected: no output.

> If `react-hot-toast` is not yet resolvable (e.g. a fresh transitive setup), confirm it's available:
>
> ```bash
> node -e "require.resolve('react-hot-toast')" 2>&1
> ```
> Expected: prints a resolved path (it is already a dev dependency per `package.json`).

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/payment.tsx
git commit -m "feat(staff): StaffPayment page with cash, transfer and invoice trigger"
```

---

### Task 19: `StaffInvoice` page

**Files:**
- Overwrite: `src/app/staff/invoice.tsx`

- [ ] **Step 1: Implement `src/app/staff/invoice.tsx`**

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
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e0e] text-[#f5f0e8]">
        <p>
          Thiếu dữ liệu hoá đơn.{' '}
          <Link to="/staff" className="text-[#C9A84C] underline">← Sơ đồ</Link>
        </p>
      </div>
    )
  }

  const handleDone = () => {
    closeSession(id)
    navigate('/staff')
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f5f0e8]">
      <header className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111] px-4 py-3 print:hidden">
        <Link to={`/staff/table/${id}/payment`} className="text-sm text-[#888] hover:text-[#C9A84C]">
          ← Quay lại
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-[#C9A84C] px-3 py-1 text-xs font-bold text-[#C9A84C]"
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

- [ ] **Step 2: TypeScript sanity check**

```bash
npx tsc --noEmit 2>&1 | grep "src/app/staff/invoice" | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/invoice.tsx
git commit -m "feat(staff): StaffInvoice page renders built invoice and supports print"
```

---

### Task 20: `StaffReceipt` page

**Files:**
- Overwrite: `src/app/staff/receipt.tsx`

- [ ] **Step 1: Implement `src/app/staff/receipt.tsx`**

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

  // Lock issuedAt for the lifetime of the page so reload of the receipt window keeps timestamp stable
  const [issuedAt] = useState(() => new Date().toISOString())

  const table = useMemo(() => STAFF_TABLES.find((t) => t.id === id), [id])
  const session = sessions[id]

  if (!table || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e0e] text-[#f5f0e8]">
        <p>
          Không tìm thấy phiên.{' '}
          <Link to="/staff" className="text-[#C9A84C] underline">← Sơ đồ</Link>
        </p>
      </div>
    )
  }

  const handleDone = () => {
    closeSession(id)
    navigate('/staff')
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f5f0e8]">
      <header className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111] px-4 py-3 print:hidden">
        <Link to={`/staff/table/${id}`} className="text-sm text-[#888] hover:text-[#C9A84C]">
          ← Quay lại
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-[#C9A84C] px-3 py-1 text-xs font-bold text-[#C9A84C]"
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

- [ ] **Step 2: TypeScript sanity check**

```bash
npx tsc --noEmit 2>&1 | grep "src/app/staff/receipt" | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/staff/receipt.tsx
git commit -m "feat(staff): StaffReceipt page with draft query support and print toolbar"
```

---

### Task 21: Final build verification

- [ ] **Step 1: Run the full vitest suite for new files**

```bash
npx vitest run \
  src/tests/data/staff-data.test.ts \
  src/tests/lib/staff-orders.test.ts \
  src/tests/lib/staff-invoice.test.ts \
  src/hooks/__tests__/useTableSessions.test.tsx \
  src/tests/components/staff
```

Expected: every test file reports green, no failures.

- [ ] **Step 2: Run the full project test suite to catch regressions**

```bash
npm run test 2>&1 | tail -30
```

Expected: `Test Files  N passed`, `Tests  M passed` — same totals as before plus the new staff tests.

- [ ] **Step 3: Run the full build**

```bash
npm run build 2>&1 | tail -40
```

Expected:
- `eslint` finishes with no errors.
- `tsc -b` finishes with no errors.
- `vite build` writes assets to `dist/`.

- [ ] **Step 4: Spot-check the dev server (manual)**

```bash
npm run dev
```

Open `http://localhost:5173/staff` and verify:
- Clock ticks once per second.
- Clicking an empty table navigates to `/staff/table/<id>` and shows the menu panel.
- Adding an item, then ĐẶT MÓN, then HĐ tạm opens the draft receipt dialog.
- THANH TOÁN navigates to `/staff/table/<id>/payment`, presets work, XÁC NHẬN clears the session and returns to `/staff`.
- XUẤT HOÁ ĐƠN opens the form; submitting it navigates to `/staff/table/<id>/invoice` and HOÀN TẤT clears the session.

- [ ] **Step 5: Final commit if any minor adjustments were needed**

```bash
git status
# if anything was tweaked during verification:
git add -A
git commit -m "chore(staff): post-verification polish"
```

> If everything was already green after task 20, skip this commit — do not create an empty commit.
