export interface Table {
  id: string
  label: string
  seats: number
  /** Server-side occupancy status. `'reserved'` = bàn có khách / đơn pending. `'available'` = bàn trống. Undefined for mock/legacy data. */
  status?: 'available' | 'reserved'
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

export const formatVnd = (n: number): string =>
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
