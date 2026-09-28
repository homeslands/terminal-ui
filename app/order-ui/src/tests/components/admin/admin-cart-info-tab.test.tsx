import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Tabs } from '@/components/ui'
import { AdminCartInfoTab } from '@/app/system/menu/components/admin-cart-info-tab'

vi.mock('@/components/staff/staff-customer-search-input', () => ({
  StaffCustomerSearchInput: ({ customer }: { customer: { phonenumber?: string } | null }) =>
    <div data-testid="customer-search">{customer?.phonenumber ?? 'empty'}</div>,
}))
vi.mock('@/components/staff/staff-table-voucher-sheet', () => ({
  StaffTableVoucherSheet: () => <div data-testid="voucher-sheet" />,
}))

describe('AdminCartInfoTab', () => {
  it('renders both customer search and voucher sheet', () => {
    const { getByTestId } = render(
      <Tabs value="info">
        <AdminCartInfoTab
          sessionCustomer={null}
          sessionVoucher={null}
          pendingItems={[]}
          submittedItems={[]}
          onSelectCustomer={vi.fn()}
          onClearCustomer={vi.fn()}
          onApplyVoucher={vi.fn()}
          onRemoveVoucher={vi.fn()}
        />
      </Tabs>,
    )
    expect(getByTestId('customer-search')).toBeTruthy()
    expect(getByTestId('voucher-sheet')).toBeTruthy()
  })
})
