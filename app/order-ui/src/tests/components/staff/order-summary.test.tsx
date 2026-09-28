import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

// Mock hooks transitively consumed by the Info tab's
// StaffCustomerSearchInput + StaffTableVoucherSheet. These tests focus on the
// items tab + footer behaviour, but the Info tab still mounts in the DOM tree.
vi.mock('@/hooks', () => ({
  useUsers: () => ({ data: undefined, isFetching: false }),
  useDebouncedInput: () => ({
    inputValue: '',
    setInputValue: vi.fn(),
    debouncedInputValue: '',
  }),
  usePagination: () => ({
    pagination: { pageIndex: 1, pageSize: 10 },
    setPagination: vi.fn(),
  }),
  useVouchersForOrder: () => ({ data: undefined, isLoading: false }),
  useValidateVoucher: () => ({ mutate: vi.fn(), isPending: false }),
  useAutoRevalidateAppliedVoucher: () => undefined,
}))

vi.mock('@/components/staff/staff-customer-search-input', () => ({
  StaffCustomerSearchInput: ({ customer }: { customer: { phonenumber?: string } | null }) =>
    customer ? (
      <div data-testid="customer-chip">{customer.phonenumber}</div>
    ) : (
      <input placeholder="Tìm khách theo số điện thoại..." />
    ),
}))

vi.mock('@/components/staff/staff-table-voucher-sheet', () => ({
  StaffTableVoucherSheet: () => <div data-testid="voucher-sheet-mock" />,
}))

vi.mock('@/components/staff/submitted-orders-dialog', () => ({
  SubmittedOrdersDialog: () => <div data-testid="submitted-dialog-mock" />,
}))

vi.mock('@/stores', () => ({
  useUserStore: () => ({ userInfo: { slug: 'staff-1' } }),
}))

import { OrderSummary } from '@/components/staff/order-summary'
import type { OrderItem, SubmittedOrder } from '@/types/session'

const pending: OrderItem[] = [
  {
    menuItemId: 'm1',
    name: 'Cà phê đen',
    priceNum: 25_000,
    price: '25.000đ',
    quantity: 2,
    note: '',
  },
]
const submitted: SubmittedOrder[] = [
  {
    id: 'order-1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      {
        menuItemId: 'm2',
        name: 'Trà đào',
        priceNum: 45_000,
        price: '45.000đ',
        quantity: 1,
        note: '',
        orderItemSlug: 'oi-trada',
      },
    ],
  },
]

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof OrderSummary>> = {},
) {
  return {
    pendingItems: pending,
    submittedOrders: submitted,
    onUpdateItem: vi.fn(),
    onRemoveItem: vi.fn(),
    onClearAll: vi.fn(),
    onSubmitOrder: vi.fn(),
    onPay: vi.fn(),
    onDraftReceipt: vi.fn(),
    onConfirmChanges: vi.fn().mockResolvedValue(undefined),
    onCancelOrder: vi.fn().mockResolvedValue(undefined),
    description: '',
    onDescriptionChange: vi.fn(),
    customer: null,
    voucher: null,
    onCustomerSelect: vi.fn(),
    onCustomerClear: vi.fn(),
    onApplyVoucher: vi.fn(),
    onRemoveVoucher: vi.fn(),
    voucherDisabled: false,
    ...overrides,
  }
}

describe('OrderSummary', () => {
  it('renders pending and submitted totals separately and a grand total', () => {
    render(<OrderSummary {...defaultProps()} />)
    expect(screen.getByTestId('pending-total')).toHaveTextContent('50.000đ')
    expect(screen.getByTestId('submitted-total')).toHaveTextContent('45.000đ')
    // grand-total shows pending total (TỔNG CỘNG = items currently being selected)
    expect(screen.getByTestId('grand-total')).toHaveTextContent('50.000đ')
  })

  it('+/- buttons call onUpdateItem and 0 calls onRemoveItem', () => {
    const onUpdate = vi.fn()
    const onRemove = vi.fn()
    render(
      <OrderSummary
        {...defaultProps({ onUpdateItem: onUpdate, onRemoveItem: onRemove })}
      />,
    )
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

  it('typing in the note input forwards via onUpdateItem', () => {
    const onUpdate = vi.fn()
    render(<OrderSummary {...defaultProps({ onUpdateItem: onUpdate })} />)
    fireEvent.change(screen.getByPlaceholderText(/Thêm ghi chú/), {
      target: { value: 'ít đường' },
    })
    expect(onUpdate).toHaveBeenCalledWith('m1', { note: 'ít đường' })
  })

  it('ĐẶT MÓN button is disabled when there are no pending items', () => {
    render(<OrderSummary {...defaultProps({ pendingItems: [] })} />)
    expect(screen.getByRole('button', { name: /ĐẶT MÓN/ })).toBeDisabled()
  })

  it('THANH TOÁN disabled when no submitted orders', () => {
    render(<OrderSummary {...defaultProps({ submittedOrders: [] })} />)
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
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /HỦY/ }),
    )
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // Dialog interaction (Xem chi tiết → Tăng buttons) covered in
  // submitted-orders-dialog.test.tsx. Skipped here because SubmittedOrdersDialog
  // is stubbed at module level to prevent heap OOM in this test file.
  it.skip('passes onConfirmChanges to the dialog — + button is enabled for submitted items', () => {})
})

describe('OrderSummary — custom-price items', () => {
  const customPending: OrderItem[] = [
    {
      menuItemId: 'cp1',
      customPriceId: 'cp-uuid-1',
      name: 'Món đặc biệt',
      priceNum: 80_000,
      price: '80.000đ',
      quantity: 1,
      note: '',
      isCustomPrice: true,
    },
  ]

  it('shows Tuỳ chỉnh badge for custom-price pending items', () => {
    render(<OrderSummary {...defaultProps({ pendingItems: customPending })} />)
    expect(screen.getByText('Tuỳ chỉnh')).toBeInTheDocument()
  })

  it('hides +/- and shows × 1 for custom-price pending items', () => {
    render(<OrderSummary {...defaultProps({ pendingItems: customPending })} />)
    expect(screen.queryByLabelText('Tăng Món đặc biệt')).toBeNull()
    expect(screen.queryByLabelText('Giảm Món đặc biệt')).toBeNull()
    expect(screen.getByText('× 1')).toBeInTheDocument()
  })

  it('trash button is still present and calls onRemoveItem with customPriceId', () => {
    const onRemove = vi.fn()
    render(
      <OrderSummary
        {...defaultProps({
          pendingItems: customPending,
          onRemoveItem: onRemove,
        })}
      />,
    )
    fireEvent.click(screen.getByLabelText('Xóa Món đặc biệt'))
    expect(onRemove).toHaveBeenCalledWith('cp-uuid-1')
  })

  it('total is computed correctly from priceNum for custom-price items', () => {
    render(
      <OrderSummary
        {...defaultProps({ pendingItems: customPending, submittedOrders: [] })}
      />,
    )
    expect(screen.getByTestId('pending-total')).toHaveTextContent('80.000đ')
  })

  it('shows a pencil edit icon button for custom-price items', () => {
    render(
      <OrderSummary
        {...defaultProps({ pendingItems: customPending, submittedOrders: [] })}
      />,
    )
    expect(screen.getByLabelText('Sửa giá Món đặc biệt')).toBeInTheDocument()
  })

  it('clicking the edit icon opens a dialog pre-filled with current price and quantity', () => {
    render(
      <OrderSummary
        {...defaultProps({ pendingItems: customPending, submittedOrders: [] })}
      />,
    )
    fireEvent.click(screen.getByLabelText('Sửa giá Món đặc biệt'))
    expect(screen.getByLabelText('Giá món')).toHaveValue('80.000')
    expect(
      screen.getByRole('button', { name: /Lưu thay đổi/ }),
    ).toBeInTheDocument()
  })

  it('confirming edit calls onUpdateItem with new priceNum, price, and quantity', () => {
    const onUpdate = vi.fn()
    render(
      <OrderSummary
        {...defaultProps({
          pendingItems: customPending,
          submittedOrders: [],
          onUpdateItem: onUpdate,
        })}
      />,
    )
    fireEvent.click(screen.getByLabelText('Sửa giá Món đặc biệt'))
    fireEvent.change(screen.getByLabelText('Giá món'), {
      target: { value: '50000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(onUpdate).toHaveBeenCalledWith(
      'cp-uuid-1',
      expect.objectContaining({
        priceNum: 50_000,
        price: '50.000đ',
        quantity: 1,
      }),
    )
  })
})

describe('OrderSummary — promotion breakdown', () => {
  it('shows promotion discount in subtotal breakdown when items have promotion', () => {
    const items: OrderItem[] = [
      {
        menuItemId: 'm1',
        name: 'A',
        priceNum: 20_000,
        price: '20k',
        quantity: 2,
        note: '',
        variantSlug: 'v1',
        productSlug: 'p1',
        originalPrice: 25_000,
        promotion: { slug: 'pr1', value: 20 },
      },
    ]
    render(
      <OrderSummary
        {...defaultProps({ pendingItems: items, submittedOrders: [] })}
      />,
    )
    // subtotal gốc = 25k * 2 = 50k
    // promo discount = 5k * 2 = 10k
    // final = 40k
    expect(screen.getByTestId('grand-total').textContent).toMatch(/40[.,]?000/)
    // promotion discount row visible
    expect(screen.getByText(/giảm khuyến mãi/i)).toBeInTheDocument()
  })

  it('omits promotion discount row when no items have promotion', () => {
    const items: OrderItem[] = [
      {
        menuItemId: 'm1',
        name: 'A',
        priceNum: 20_000,
        price: '20k',
        quantity: 1,
        note: '',
        variantSlug: 'v1',
        productSlug: 'p1',
      },
    ]
    render(
      <OrderSummary
        {...defaultProps({ pendingItems: items, submittedOrders: [] })}
      />,
    )
    expect(screen.queryByText(/giảm khuyến mãi/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('grand-total').textContent).toMatch(/20[.,]?000/)
  })
})

describe('OrderSummary — tabs shell', () => {
  it('renders Món and Khách tabs', () => {
    render(<OrderSummary {...defaultProps({})} />)
    expect(screen.getByRole('tab', { name: /Món/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Khách' })).toBeInTheDocument()
  })

  it('shows items by default (Món tab active)', () => {
    render(
      <OrderSummary
        {...defaultProps({
          pendingItems: [
            {
              menuItemId: 'm1',
              name: 'Trà',
              priceNum: 10000,
              price: '10.000đ',
              quantity: 1,
              note: '',
            },
          ],
        })}
      />,
    )
    expect(screen.getByText('Trà')).toBeInTheDocument()
  })

  it('switches to info tab on click and shows placeholder', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<OrderSummary {...defaultProps({})} />)
    await user.click(screen.getByRole('tab', { name: 'Khách' }))
    expect(screen.getByTestId('info-tab-content')).toBeInTheDocument()
  })
})
