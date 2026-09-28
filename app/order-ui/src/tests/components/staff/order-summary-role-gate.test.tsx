import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock hooks consumed transitively by StaffCustomerSearchInput and
// StaffTableVoucherSheet. We deliberately do NOT mock '@/stores' here so the
// real Zustand useUserStore is available and setState() works for driving the
// role under test.
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

import { OrderSummary } from '@/components/staff/order-summary'
import { useUserStore } from '@/stores'

const baseProps = {
  pendingItems: [],
  submittedOrders: [],
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
}

describe('OrderSummary — payment button role gate', () => {
  beforeEach(() => {
    useUserStore.setState({ userInfo: null } as never)
  })

  it('shows THANH TOÁN for ADMIN role', () => {
    useUserStore.setState({ userInfo: { role: { name: 'ADMIN' } } } as never)
    render(<OrderSummary {...baseProps} />)
    expect(screen.getByText('THANH TOÁN →')).toBeInTheDocument()
  })

  it('shows THANH TOÁN for CASHIER role', () => {
    useUserStore.setState({ userInfo: { role: { name: 'CASHIER' } } } as never)
    render(<OrderSummary {...baseProps} />)
    expect(screen.getByText('THANH TOÁN →')).toBeInTheDocument()
  })

  it('hides THANH TOÁN for STAFF role', () => {
    useUserStore.setState({ userInfo: { role: { name: 'STAFF' } } } as never)
    render(<OrderSummary {...baseProps} />)
    expect(screen.queryByText('THANH TOÁN →')).toBeNull()
  })

  it('CASHIER sees the Info tab and THANH TOÁN', async () => {
    useUserStore.setState({ userInfo: { role: { name: 'CASHIER' } } } as never)
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<OrderSummary {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: 'Khách' }))
    expect(screen.getByTestId('info-tab-content')).toBeInTheDocument()
    expect(screen.getByText('THANH TOÁN →')).toBeInTheDocument()
  })

  it('STAFF sees the Info tab but no THANH TOÁN', async () => {
    useUserStore.setState({ userInfo: { role: { name: 'STAFF' } } } as never)
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<OrderSummary {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: 'Khách' }))
    expect(screen.getByTestId('info-tab-content')).toBeInTheDocument()
    expect(screen.queryByText('THANH TOÁN →')).toBeNull()
  })
})
