import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomPriceDialog } from '@/components/staff/custom-price-dialog'

describe('CustomPriceDialog — add mode', () => {
  it('calls onAdd with full payload including variantSlug, productSlug, vatRate', async () => {
    const mockOnAdd = vi.fn()
    render(
      <CustomPriceDialog
        mode="add"
        menuItemId="m-1"
        name="Custom Pho"
        variantSlug="v-1"
        productSlug="p-1"
        vatRate={10}
        onAdd={mockOnAdd}
        trigger={<button>Thêm</button>}
      />,
    )

    // Open the dialog
    fireEvent.click(screen.getByRole('button', { name: 'Thêm' }))

    // Type price
    const priceInput = screen.getByLabelText('Giá món')
    await userEvent.clear(priceInput)
    await userEvent.type(priceInput, '50000')

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: /Thêm vào đơn/ }))

    expect(mockOnAdd).toHaveBeenCalledOnce()
    expect(mockOnAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        menuItemId: 'm-1',
        name: 'Custom Pho',
        priceNum: 50000,
        quantity: 1,
        isCustomPrice: true,
        variantSlug: 'v-1',
        productSlug: 'p-1',
        vatRate: 10,
        originalPrice: 50000,
        promotion: null,
        customPriceId: expect.any(String),
      }),
    )
  })
})
