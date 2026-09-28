import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminCartPendingItemsList } from '@/app/system/menu/components/admin-cart-pending-items-list'
import { Tabs } from '@/components/ui'
import type { OrderItem } from '@/types/session'

vi.mock('@/components/staff/submitted-orders-dialog', () => ({
  SubmittedOrdersDialog: () => <div data-testid="submitted-dialog" />,
}))

const item: OrderItem = {
  menuItemId: 'p1',
  productSlug: 'p1',
  name: 'BBQ',
  priceNum: 50000,
  originalPrice: 50000,
  price: '50,000đ',
  quantity: 2,
  variantSlug: 'v1',
  note: '',
  promotion: null,
} as OrderItem

describe('AdminCartPendingItemsList', () => {
  it('renders pending item name', () => {
    render(
      <Tabs defaultValue="items">
        <AdminCartPendingItemsList
          pending={[item]}
          submitted={[]}
          submittedTotal={0}
          sessionVoucher={null}
          serverActiveOrder={null}
          onUpdateItem={vi.fn()}
          onUpdateNote={vi.fn()}
          onRemoveItem={vi.fn()}
          onSubmittedChanges={vi.fn()}
          onCancelOrder={vi.fn()}
        />
      </Tabs>,
    )
    expect(screen.getByText('BBQ')).toBeTruthy()
  })

  it('renders empty-state when both lists empty', () => {
    render(
      <Tabs defaultValue="items">
        <AdminCartPendingItemsList
          pending={[]}
          submitted={[]}
          submittedTotal={0}
          sessionVoucher={null}
          serverActiveOrder={null}
          onUpdateItem={vi.fn()}
          onUpdateNote={vi.fn()}
          onRemoveItem={vi.fn()}
          onSubmittedChanges={vi.fn()}
          onCancelOrder={vi.fn()}
        />
      </Tabs>,
    )
    expect(screen.queryByText('BBQ')).toBeNull()
  })
})
