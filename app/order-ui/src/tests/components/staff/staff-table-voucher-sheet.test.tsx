import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

import { StaffTableVoucherSheet } from '@/components/staff/staff-table-voucher-sheet'

// Mock hooks — sheet is fetch-on-open, so undefined data + isLoading false is fine
// for the trigger-only smoke render. We just need to confirm it mounts without crashing.
vi.mock('@/hooks', () => ({
  useVouchersForOrder: () => ({ data: undefined, isLoading: false }),
  useValidateVoucher: () => ({ mutate: vi.fn(), isPending: false }),
  useAutoRevalidateAppliedVoucher: () => undefined,
}))

vi.mock('@/stores', () => ({
  useUserStore: () => ({ userInfo: { slug: 'staff-1' } }),
}))

describe('StaffTableVoucherSheet', () => {
  it('mounts without crash with empty cart and no customer', () => {
    const { container } = render(
      <StaffTableVoucherSheet
        pendingItems={[]}
        customer={null}
        appliedVoucher={null}
        onApply={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(container).toBeTruthy()
    // Trigger renders (sheet content is portaled and only mounts when opened).
    expect(
      container.querySelector('[data-testid="staff-table-voucher-trigger"]'),
    ).toBeTruthy()
  })
})
