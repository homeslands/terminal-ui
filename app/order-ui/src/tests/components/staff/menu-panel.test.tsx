import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MenuPanel } from '@/components/staff/menu-panel'
import { parsePrice } from '@/lib/staff-orders'
import type { OrderItem } from '@/types/session'

const promoMenuItem = {
  slug: 'menu-004',
  createdAt: '2024-01-01',
  currentStock: 8,
  defaultStock: 8,
  isLocked: false,
  promotion: {
    slug: 'p1',
    value: 20,
    title: 'Khuyến mãi 20%',
    description: '',
    branchSlug: 'branch-1',
    startDate: '2024-01-01',
    endDate: '2099-01-01',
    type: 'percent',
    createdAt: '2024-01-01',
  },
  product: {
    name: 'Cà phê khuyến mãi',
    slug: 'prod-a',
    image: '',
    description: '',
    isActive: true,
    isLimit: false,
    isTopSell: false,
    isNew: false,
    isCombo: false,
    isGift: false,
    images: [],
    rating: 0,
    saleQuantityHistory: 0,
    productChefArea: '',
    createdAt: '2024-01-01',
    vatRate: 0.1,
    catalog: { slug: 'cat-promo', name: 'Khuyến mãi', description: '', createdAt: '2024-01-01' },
    variants: [{ price: 25000, slug: 'v4', costPrice: 0, product: {} as never, size: { name: 'M', description: '', slug: 's1' } }],
  },
}

const giftMenuItem = {
  slug: 'menu-005',
  createdAt: '2024-01-01',
  currentStock: 5,
  defaultStock: 5,
  isLocked: false,
  promotion: null,
  product: {
    name: 'Nước suối tặng kèm',
    slug: 'prod-gift',
    image: '',
    description: '',
    isActive: true,
    isLimit: false,
    isTopSell: false,
    isNew: false,
    isCombo: false,
    isGift: true,
    images: [],
    rating: 0,
    saleQuantityHistory: 0,
    productChefArea: '',
    createdAt: '2024-01-01',
    vatRate: 0,
    catalog: { slug: 'cat-gift', name: 'Quà tặng', description: '', createdAt: '2024-01-01' },
    variants: [{ price: 0, slug: 'v5', costPrice: 0, product: {} as never, size: { name: 'M', description: '', slug: 's1' } }],
  },
}

const mockMenuItems = [
  {
    slug: 'menu-003',
    createdAt: '2024-01-01',
    currentStock: 5,
    defaultStock: 5,
    isLocked: false,
    promotion: null,
    product: {
      name: 'Bánh đặc biệt',
      slug: 'banh-dac-biet',
      image: '',
      description: '',
      isActive: true,
      isLimit: false,
      isTopSell: false,
      isNew: false,
      isCombo: false,
      isGift: false,
      images: [],
      rating: 0,
      saleQuantityHistory: 0,
      productChefArea: '',
      createdAt: '2024-01-01',
      isCustomPrice: true,
      catalog: { slug: 'cat-coffee', name: 'Cà phê', description: '', createdAt: '2024-01-01' },
      variants: [{ price: 0, slug: 'v3', costPrice: 0, product: {} as never, size: { name: 'M', description: '', slug: 's1' } }],
    },
  },
  {
    slug: 'menu-001',
    createdAt: '2024-01-01',
    currentStock: 10,
    defaultStock: 10,
    isLocked: false,
    promotion: null,
    product: {
      name: 'Cà phê đen',
      slug: 'ca-phe-den',
      image: '',
      description: '',
      isActive: true,
      isLimit: false,
      isTopSell: false,
      isNew: false,
      isCombo: false,
      isGift: false,
      images: [],
      rating: 0,
      saleQuantityHistory: 0,
      productChefArea: '',
      createdAt: '2024-01-01',
      catalog: { slug: 'cat-coffee', name: 'Cà phê', description: '', createdAt: '2024-01-01' },
      variants: [{ price: 25000, slug: 'v1', costPrice: 0, product: {} as never, size: { name: 'M', description: '', slug: 's1' } }],
    },
  },
  {
    slug: 'menu-002',
    createdAt: '2024-01-01',
    currentStock: 10,
    defaultStock: 10,
    isLocked: false,
    promotion: null,
    product: {
      name: 'Trà đào cam sả',
      slug: 'tra-dao-cam-sa',
      image: '',
      description: '',
      isActive: true,
      isLimit: false,
      isTopSell: false,
      isNew: false,
      isCombo: false,
      isGift: false,
      images: [],
      rating: 0,
      saleQuantityHistory: 0,
      productChefArea: '',
      createdAt: '2024-01-01',
      catalog: { slug: 'cat-tea', name: 'Trà', description: '', createdAt: '2024-01-01' },
      variants: [{ price: 45000, slug: 'v2', costPrice: 0, product: {} as never, size: { name: 'M', description: '', slug: 's1' } }],
    },
  },
  promoMenuItem,
  giftMenuItem,
]

vi.mock('@/hooks', () => ({
  useSpecificMenu: () => ({ data: { result: { menuItems: mockMenuItems } } }),
}))

vi.mock('@/stores', () => ({
  useUserStore: () => ({ userInfo: { slug: 'user-1', branch: { slug: 'branch-1' } } }),
}))

describe('parsePrice', () => {
  it('strips non-digit characters', () => {
    expect(parsePrice('25.000đ')).toBe(25_000)
    expect(parsePrice('1,200,000 VND')).toBe(1_200_000)
    expect(parsePrice('')).toBe(0)
  })
})

describe('MenuPanel', () => {
  it('renders category buttons and the first category is active', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    const coffeeBtn = screen.getByRole('button', { name: /Cà phê/ })
    expect(coffeeBtn).toHaveClass('text-pos-gold')
  })

  it('filters items when a different category is selected', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Trà$/ }))
    expect(screen.getByText('Trà đào cam sả')).toBeInTheDocument()
    expect(screen.queryByText('Cà phê đen')).not.toBeInTheDocument()
  })

  it('calls onAdd with the menu item shape (quantity: 1, no note)', () => {
    const onAdd = vi.fn()
    render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: expect.any(String),
        name: expect.any(String),
        priceNum: expect.any(Number),
        price: expect.any(String),
        quantity: 1,
      }),
    )
    const arg = onAdd.mock.calls[0][0] as Partial<OrderItem>
    expect(arg).not.toHaveProperty('note')
  })

  it('shows a quantity badge for items already in pendingItems', () => {
    const pending: OrderItem[] = [
      { menuItemId: 'menu-001', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 3, note: '' },
    ]
    render(<MenuPanel pendingItems={pending} onAdd={() => {}} onDecrement={() => {}} />)
    expect(screen.getByTestId('badge-menu-001')).toHaveTextContent('3')
  })

  it('search input filters items by name (case-insensitive)', async () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    const searchInput = screen.getByPlaceholderText(/Tìm món/)
    fireEvent.change(searchInput, { target: { value: 'cà phê' } })
    expect(screen.getByText('Cà phê đen')).toBeInTheDocument()
  })

  it('shows empty message when search matches nothing', async () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/Tìm món/), { target: { value: 'xyzxyz' } })
    expect(screen.getByText(/Không tìm thấy món/)).toBeInTheDocument()
  })

  it('passes promotion + productSlug when adding item to cart', () => {
    const onAdd = vi.fn()
    render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={() => {}} />)
    // Promo item lives in its own category; navigate via search instead.
    fireEvent.change(screen.getByPlaceholderText(/Tìm món/), { target: { value: 'khuyến mãi' } })
    // Find the card containing the promo item, then click its "Thêm" button
    const promoCard = screen.getByText(/Cà phê khuyến mãi/i).closest('[class*="rounded-lg"]')!
    const addBtn = within(promoCard as HTMLElement).getByRole('button', { name: /thêm/i })
    fireEvent.click(addBtn)
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: 'menu-004',
        productSlug: 'prod-a',
        originalPrice: 25000,
        promotion: { slug: 'p1', value: 20 },
      }),
    )
  })

  it('passes null promotion when item has no promotion', () => {
    const onAdd = vi.fn()
    render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={() => {}} />)
    // Cà phê đen has no promotion; scope the click to its card to avoid render-order fragility.
    const card = screen.getByText(/Cà phê đen/i).closest('[class*="rounded-lg"]')!
    const addBtn = within(card as HTMLElement).getByRole('button', { name: /thêm/i })
    fireEvent.click(addBtn)
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: 'menu-001',
        productSlug: 'ca-phe-den',
        originalPrice: 25000,
        promotion: null,
      }),
    )
  })

  it('passes vatRate when adding item to cart', () => {
    const onAdd = vi.fn()
    render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={() => {}} />)
    // promoMenuItem has vatRate: 0.1; navigate via search.
    fireEvent.change(screen.getByPlaceholderText(/Tìm món/), { target: { value: 'khuyến mãi' } })
    const promoCard = screen.getByText(/Cà phê khuyến mãi/i).closest('[class*="rounded-lg"]')!
    const addBtn = within(promoCard as HTMLElement).getByRole('button', { name: /thêm/i })
    fireEvent.click(addBtn)
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ vatRate: 0.1 }))
  })

  it('defaults vatRate to 0 when product has no vatRate', () => {
    const onAdd = vi.fn()
    render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={() => {}} />)
    // Cà phê đen has no vatRate on its product mock.
    const card = screen.getByText(/Cà phê đen/i).closest('[class*="rounded-lg"]')!
    const addBtn = within(card as HTMLElement).getByRole('button', { name: /thêm/i })
    fireEvent.click(addBtn)
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ vatRate: 0 }))
  })

  it('renders gift badge when product is a gift', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    // Gift item lives in its own category; navigate via search.
    fireEvent.change(screen.getByPlaceholderText(/Tìm món/), { target: { value: 'tặng' } })
    const card = screen.getByText(/Nước suối tặng kèm/i).closest('[class*="rounded-lg"]')!
    expect(within(card as HTMLElement).getByText('Quà')).toBeInTheDocument()
  })

  it('does not render gift badge for non-gift products', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    const card = screen.getByText(/Cà phê đen/i).closest('[class*="rounded-lg"]')!
    expect(within(card as HTMLElement).queryByText('Quà')).not.toBeInTheDocument()
  })

  it('shows inline stepper instead of Thêm button when item already in pending', () => {
    const pending: OrderItem[] = [
      { menuItemId: 'menu-001', name: 'Cà phê đen', priceNum: 25_000, price: '25.000đ', quantity: 2, note: '' },
    ]
    const onDecrement = vi.fn()
    render(<MenuPanel pendingItems={pending} onAdd={() => {}} onDecrement={onDecrement} />)
    expect(screen.queryByRole('button', { name: 'Thêm' })).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Giảm Cà phê đen'))
    expect(onDecrement).toHaveBeenCalledWith('menu-001')
  })
})

describe('MenuPanel — custom-price items', () => {
  const openDialog = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Thêm Bánh đặc biệt' }))

  it('shows "Tuỳ chỉnh" label and a "Thêm" button for custom-price items', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    expect(screen.getByText('Tuỳ chỉnh')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm Bánh đặc biệt' })).toBeInTheDocument()
  })

  it('trigger button always shows "Thêm" even when item is already in pending', () => {
    const pending: OrderItem[] = [
      { menuItemId: 'menu-003', customPriceId: 'cp-uuid-1', name: 'Bánh đặc biệt', priceNum: 80_000, price: '80.000đ', quantity: 2, note: '', isCustomPrice: true },
    ]
    render(<MenuPanel pendingItems={pending} onAdd={() => {}} onDecrement={() => {}} />)
    expect(screen.getByRole('button', { name: 'Thêm Bánh đặc biệt' })).toHaveTextContent('Thêm')
  })

  it('clicking Thêm opens dialog with price input and disabled confirm button', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    openDialog()
    expect(screen.getByLabelText('Giá món')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thêm vào đơn/ })).toBeDisabled()
  })

  it('confirm button enables once a positive price is entered', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    openDialog()
    fireEvent.change(screen.getByLabelText('Giá món'), { target: { value: '80000' } })
    expect(screen.getByRole('button', { name: /Thêm vào đơn/ })).not.toBeDisabled()
  })

  it('confirming calls onAdd with isCustomPrice:true, priceNum, and a customPriceId', () => {
    const onAdd = vi.fn()
    render(<MenuPanel pendingItems={[]} onAdd={onAdd} onDecrement={() => {}} />)
    openDialog()
    fireEvent.change(screen.getByLabelText('Giá món'), { target: { value: '80000' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm vào đơn/ }))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: 'menu-003',
        name: 'Bánh đặc biệt',
        priceNum: 80_000,
        isCustomPrice: true,
        customPriceId: expect.any(String),
      }),
    )
  })

  it('price input formats entered digits with dot separators', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    openDialog()
    fireEvent.change(screen.getByLabelText('Giá món'), { target: { value: '80000' } })
    expect(screen.getByLabelText('Giá món')).toHaveValue('80.000')
  })

  it('shows thành tiền line when price and quantity are set', () => {
    render(<MenuPanel pendingItems={[]} onAdd={() => {}} onDecrement={() => {}} />)
    openDialog()
    fireEvent.change(screen.getByLabelText('Giá món'), { target: { value: '80000' } })
    expect(screen.getByText('Thành tiền')).toBeInTheDocument()
    expect(screen.getByText('80.000đ')).toBeInTheDocument()
  })
})
