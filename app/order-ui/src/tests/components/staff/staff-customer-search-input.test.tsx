import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StaffCustomerSearchInput } from '@/components/staff/staff-customer-search-input'
import type { TableCustomer } from '@/types/session'

// Mock the hooks used by StaffCustomerSearchInput so the test doesn't hit the
// network or require a Router context. Returned objects are stable references
// to avoid effect-driven re-render loops (the component depends on the query
// result identity in useEffect deps).
vi.mock('@/hooks', () => {
  const usersResult = {
    data: {
      result: {
        items: [
          {
            slug: 'cus-1',
            firstName: 'An',
            lastName: 'Nguyễn',
            phonenumber: '0901234567',
            dob: '',
            email: '',
            address: '',
            language: 'vi',
          },
        ],
      },
    },
    isFetching: false,
  }
  const debounced = {
    inputValue: '',
    setInputValue: () => {},
    debouncedInputValue: '',
  }
  const paginationResult = {
    pagination: { pageIndex: 1, pageSize: 10 },
    setPagination: () => {},
    handlePageChange: () => {},
    handlePageSizeChange: () => {},
  }
  return {
    useUsers: () => usersResult,
    useDebouncedInput: () => debounced,
    usePagination: () => paginationResult,
  }
})

// Mock RFID dialog to avoid pulling in heavy dependencies (RFID listener, etc.)
vi.mock('@/components/app/dialog', () => ({
  ScanRFIDCustomerDialog: () => null,
}))

const customer: TableCustomer = {
  slug: 'cus-1',
  firstName: 'An',
  lastName: 'Nguyễn',
  phonenumber: '0901234567',
}

describe('StaffCustomerSearchInput', () => {
  it('renders placeholder input when no customer is selected', () => {
    render(
      <StaffCustomerSearchInput
        customer={null}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(
      screen.getByPlaceholderText(/Tìm khách theo số điện thoại/),
    ).toBeInTheDocument()
  })

  it('renders customer name + phone when customer is selected', () => {
    render(
      <StaffCustomerSearchInput
        customer={customer}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByText('Nguyễn An')).toBeInTheDocument()
    expect(screen.getByText('0901234567')).toBeInTheDocument()
  })

  it('calls onClear when clicking the clear button', () => {
    const onClear = vi.fn()
    render(
      <StaffCustomerSearchInput
        customer={customer}
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    )
    fireEvent.click(screen.getByLabelText('Bỏ chọn khách'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('hides the clear button when disabled', () => {
    render(
      <StaffCustomerSearchInput
        customer={customer}
        onSelect={vi.fn()}
        onClear={vi.fn()}
        disabled
      />,
    )
    expect(screen.queryByLabelText('Bỏ chọn khách')).not.toBeInTheDocument()
  })
})
