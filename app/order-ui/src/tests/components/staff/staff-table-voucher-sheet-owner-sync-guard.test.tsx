import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { StaffTableVoucherSheet } from '@/components/staff/staff-table-voucher-sheet'
import { useTableSessionsStore } from '@/stores/table-sessions.store'

const validateVoucherMock = vi.fn((_payload, opts) => opts?.onSuccess?.())

vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/hooks')>('@/hooks')
  return {
    ...actual,
    useValidateVoucher: () => ({ mutate: validateVoucherMock, isPending: false }),
    useVouchersForOrder: () => ({
      data: {
        result: {
          items: [
            {
              slug: 'v1',
              code: 'CODE1',
              title: 'Voucher 1',
              value: 10,
              isActive: true,
              isVerificationIdentity: false,
              maxUsage: 10,
              remainingUsage: 5,
              minOrderValue: 0,
              // endDate far in future so not expired and 7AM validDate check passes
              endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
              voucherProducts: [],
              voucherPaymentMethods: [],
              // no activeStartTime / activeEndTime → inWindow = true
            },
          ],
        },
      },
      isLoading: false,
      refetch: vi.fn(),
    }),
    useAutoRevalidateAppliedVoucher: () => undefined,
  }
})

vi.mock('@/stores', async () => {
  const actual = await vi.importActual<typeof import('@/stores')>('@/stores')
  return {
    ...actual,
    useUserStore: () => ({ userInfo: { slug: 'staff-1' } }),
  }
})

function renderSheet(props?: Partial<React.ComponentProps<typeof StaffTableVoucherSheet>>) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <StaffTableVoucherSheet
        pendingItems={[]}
        submittedItems={[]}
        customer={{ slug: 'c1', firstName: 'A', lastName: 'B', phonenumber: '0900' }}
        appliedVoucher={null}
        onApply={vi.fn()}
        onRemove={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('StaffTableVoucherSheet — owner-sync guard', () => {
  beforeEach(() => {
    useTableSessionsStore.setState({ pendingOwnerSync: null })
    validateVoucherMock.mockClear()
  })

  it('does not call validateVoucher while pendingOwnerSync is unresolved', async () => {
    let resolveOwner!: () => void
    const ownerPromise = new Promise<void>((r) => {
      resolveOwner = r
    })
    useTableSessionsStore.getState().setPendingOwnerSync(ownerPromise)

    renderSheet()

    // Open the sheet via the trigger button (has data-testid)
    fireEvent.click(screen.getByTestId('staff-table-voucher-trigger'))

    // Click the apply button — i18n key "voucher.use" is the button text (no locale loaded in tests)
    const applyBtn = await screen.findByRole('button', { name: 'voucher.use' })
    fireEvent.click(applyBtn)

    // Guard is active — validateVoucher must NOT be called yet (owner sync pending)
    expect(validateVoucherMock).not.toHaveBeenCalled()

    resolveOwner()
    await waitFor(() => expect(validateVoucherMock).toHaveBeenCalled())
  })

  it('skips validateVoucher when pendingOwnerSync rejects', async () => {
    const ownerPromise = Promise.reject(new Error('owner sync failed'))
    // Suppress unhandled rejection noise in test output
    ownerPromise.catch(() => undefined)
    useTableSessionsStore.getState().setPendingOwnerSync(ownerPromise)

    renderSheet()

    fireEvent.click(screen.getByTestId('staff-table-voucher-trigger'))
    const applyBtn = await screen.findByRole('button', { name: 'voucher.use' })
    fireEvent.click(applyBtn)

    // Flush microtasks — rejection propagates synchronously via event loop
    await new Promise((r) => setTimeout(r, 0))
    expect(validateVoucherMock).not.toHaveBeenCalled()
  })
})
