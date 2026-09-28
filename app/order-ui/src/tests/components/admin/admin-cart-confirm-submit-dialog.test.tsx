import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminCartConfirmSubmitDialog } from '@/app/system/menu/components/admin-cart-confirm-submit-dialog'
import type { OrderItem } from '@/types/session'

const item: OrderItem = {
  menuItemId: 'p1',
  name: 'BBQ',
  priceNum: 50000,
  quantity: 2,
} as OrderItem

describe('AdminCartConfirmSubmitDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AdminCartConfirmSubmitDialog
        open={false}
        onOpenChange={vi.fn()}
        pendingItems={[item]}
        pendingTotalFinal={100000}
        isSubmitting={false}
        onConfirm={vi.fn()}
      />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders item name and quantity when open', () => {
    render(
      <AdminCartConfirmSubmitDialog
        open={true}
        onOpenChange={vi.fn()}
        pendingItems={[item]}
        pendingTotalFinal={100000}
        isSubmitting={false}
        onConfirm={vi.fn()}
      />,
    )
    // Text is split across elements by whitespace, so use a flexible matcher
    expect(
      screen.getByText(
        (content) => content.includes('BBQ') && content.includes('2'),
      ),
    ).toBeTruthy()
  })
})
