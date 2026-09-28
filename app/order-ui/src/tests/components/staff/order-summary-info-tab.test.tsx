import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock hooks consumed transitively by StaffCustomerSearchInput (useUsers,
// useDebouncedInput, usePagination) and StaffTableVoucherSheet
// (useVouchersForOrder, useValidateVoucher, useAutoRevalidateAppliedVoucher).
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

vi.mock('@/stores', () => ({
  useUserStore: () => ({ userInfo: { slug: 'staff-1' } }),
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

describe('OrderSummary — Info tab', () => {
  it('shows customer placeholder when no customer set', async () => {
    const user = userEvent.setup()
    render(<OrderSummary {...baseProps} />)
    await user.click(screen.getByRole('tab', { name: 'Khách' }))
    expect(screen.getByPlaceholderText(/Tìm khách/i)).toBeInTheDocument()
  })

  it('shows selected customer when customer set', async () => {
    const user = userEvent.setup()
    render(
      <OrderSummary
        {...baseProps}
        customer={{
          slug: 'c1',
          firstName: 'A',
          lastName: 'Nguyễn',
          phonenumber: '0901234567',
        }}
      />,
    )
    await user.click(screen.getByRole('tab', { name: 'Khách' }))
    expect(screen.getByText(/0901234567/)).toBeInTheDocument()
  })
})
