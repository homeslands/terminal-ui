import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SubmittedOrdersDialog } from '@/components/staff/submitted-orders-dialog'
import type { SubmittedOrder } from '@/types/session'

const multiItem: SubmittedOrder[] = [
  {
    id: 'o1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      {
        menuItemId: 'm1',
        name: 'Cà phê đen',
        priceNum: 25_000,
        price: '25.000đ',
        quantity: 2,
        note: '',
        orderItemSlug: 'oi-a',
      },
    ],
  },
  {
    id: 'o2',
    submittedAt: '2026-06-01T10:05:00Z',
    items: [
      {
        menuItemId: 'm1',
        name: 'Cà phê đen',
        priceNum: 25_000,
        price: '25.000đ',
        quantity: 1,
        note: '',
        orderItemSlug: 'oi-b',
      },
      {
        menuItemId: 'm2',
        name: 'Trà đào',
        priceNum: 45_000,
        price: '45.000đ',
        quantity: 1,
        note: '',
        orderItemSlug: 'oi-c',
      },
    ],
  },
]

const singleItem: SubmittedOrder[] = [
  {
    id: 'o1',
    submittedAt: '2026-06-01T10:00:00Z',
    items: [
      {
        menuItemId: 'm1',
        name: 'Cà phê đen',
        priceNum: 25_000,
        price: '25.000đ',
        quantity: 1,
        note: '',
        orderItemSlug: 'oi-a',
      },
    ],
  },
]

function openDialog({
  submittedOrders = multiItem,
  onConfirmChanges = vi.fn().mockResolvedValue(undefined),
  onCancelOrder = vi.fn().mockResolvedValue(undefined),
}: {
  submittedOrders?: SubmittedOrder[]
  onConfirmChanges?: ReturnType<typeof vi.fn>
  onCancelOrder?: ReturnType<typeof vi.fn>
} = {}) {
  render(
    <SubmittedOrdersDialog
      submittedOrders={submittedOrders}
      submittedTotal={120_000}
      onConfirmChanges={onConfirmChanges}
      onCancelOrder={onCancelOrder}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /xem chi tiết/i }))
}

describe('SubmittedOrdersDialog', () => {
  it('shows each submitted row separately with its own quantity', () => {
    openDialog()
    // Two rows for "Cà phê đen" (oi-a qty=2, oi-b qty=1) + one for "Trà đào"
    expect(screen.getByTestId('qty-oi-a')).toHaveTextContent('2')
    expect(screen.getByTestId('qty-oi-b')).toHaveTextContent('1')
    expect(screen.getByTestId('qty-oi-c')).toHaveTextContent('1')
    expect(screen.getAllByText('Cà phê đen')).toHaveLength(2)
    expect(screen.getByText('Trà đào')).toBeInTheDocument()
  })

  it('does not call onConfirmChanges until Xác nhận is clicked', () => {
    const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
    openDialog({ onConfirmChanges })
    fireEvent.click(screen.getAllByLabelText('Giảm Cà phê đen')[0])
    expect(onConfirmChanges).not.toHaveBeenCalled()
  })

  it('calls onConfirmChanges with correct diff on Xác nhận', async () => {
    const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
    openDialog({ onConfirmChanges })
    // Decrement the first "Cà phê đen" row (oi-a, qty=2 → 1)
    fireEvent.click(screen.getAllByLabelText('Giảm Cà phê đen')[0])
    fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
    await waitFor(() =>
      expect(onConfirmChanges).toHaveBeenCalledWith([
        { orderItemSlug: 'oi-a', newQty: 1 },
      ]),
    )
  })

  it('calls onConfirmChanges with qty=0 when trash is clicked on non-last item', async () => {
    const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
    openDialog({ onConfirmChanges })
    fireEvent.click(screen.getByLabelText('Xóa Trà đào'))
    fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
    await waitFor(() =>
      expect(onConfirmChanges).toHaveBeenCalledWith([
        { orderItemSlug: 'oi-c', newQty: 0 },
      ]),
    )
  })

  it('Huỷ button closes without calling onConfirmChanges', () => {
    const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
    openDialog({ onConfirmChanges })
    fireEvent.click(screen.getAllByLabelText('Giảm Cà phê đen')[0])
    fireEvent.click(screen.getByRole('button', { name: /^huỷ$/i }))
    expect(onConfirmChanges).not.toHaveBeenCalled()
  })

  it('Xác nhận button is disabled when no changes', () => {
    openDialog()
    expect(screen.getByRole('button', { name: /xác nhận/i })).toBeDisabled()
  })

  it('− button is disabled when draft quantity is 1', () => {
    openDialog()
    expect(screen.getByLabelText('Giảm Trà đào')).toBeDisabled()
  })

  it('calls onCancelOrder instead of onConfirmChanges when all items are deleted', async () => {
    const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
    const onCancelOrder = vi.fn().mockResolvedValue(undefined)
    openDialog({ onConfirmChanges, onCancelOrder })
    // Trash all three rows (two "Cà phê đen" rows + one "Trà đào")
    screen
      .getAllByLabelText('Xóa Cà phê đen')
      .forEach((btn) => fireEvent.click(btn))
    fireEvent.click(screen.getByLabelText('Xóa Trà đào'))
    fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
    await waitFor(() => expect(onCancelOrder).toHaveBeenCalledTimes(1))
    expect(onConfirmChanges).not.toHaveBeenCalled()
  })

  it('shows item note when present', () => {
    const withNote: SubmittedOrder[] = [
      {
        id: 'o1',
        submittedAt: '2026-06-01T10:00:00Z',
        items: [
          {
            menuItemId: 'm1',
            name: 'Cà phê đen',
            priceNum: 25_000,
            price: '25.000đ',
            quantity: 1,
            note: 'ít đường',
            orderItemSlug: 'oi-a',
          },
        ],
      },
    ]
    render(
      <SubmittedOrdersDialog
        submittedOrders={withNote}
        submittedTotal={25_000}
        onConfirmChanges={vi.fn().mockResolvedValue(undefined)}
        onCancelOrder={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /xem chi tiết/i }))
    expect(screen.getByText('(ít đường)')).toBeInTheDocument()
  })

  // Last-item guard tests
  it('shows last-item warning instead of staging removal when only one merged item remains', () => {
    const onCancelOrder = vi.fn().mockResolvedValue(undefined)
    openDialog({ submittedOrders: singleItem, onCancelOrder })
    fireEvent.click(screen.getByLabelText('Xóa Cà phê đen'))
    expect(screen.getByText(/hủy toàn bộ đơn/i)).toBeInTheDocument()
    expect(onCancelOrder).not.toHaveBeenCalled()
  })

  it('calls onCancelOrder when user confirms the last-item warning', async () => {
    const onCancelOrder = vi.fn().mockResolvedValue(undefined)
    openDialog({ submittedOrders: singleItem, onCancelOrder })
    fireEvent.click(screen.getByLabelText('Xóa Cà phê đen'))
    fireEvent.click(screen.getByRole('button', { name: /hủy đơn/i }))
    await waitFor(() => expect(onCancelOrder).toHaveBeenCalledTimes(1))
  })

  it('shows note input per item pre-filled with current note', () => {
    openDialog()
    const inputs = screen.getAllByPlaceholderText('Ghi chú...')
    // One per submitted row: oi-a, oi-b, oi-c
    expect(inputs).toHaveLength(3)
    expect((inputs[0] as HTMLInputElement).value).toBe('') // Cà phê đen has no note
  })

  it('editing a note stages the change but does not call onConfirmChanges immediately', () => {
    const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
    openDialog({ onConfirmChanges })
    fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], {
      target: { value: 'ít đường' },
    })
    expect(onConfirmChanges).not.toHaveBeenCalled()
  })

  it('calls onConfirmChanges with newNote when note is changed and Xác nhận is clicked', async () => {
    const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
    openDialog({ onConfirmChanges })
    // First note input belongs to oi-a (Cà phê đen qty=2)
    fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], {
      target: { value: 'ít đường' },
    })
    fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
    await waitFor(() =>
      expect(onConfirmChanges).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            orderItemSlug: 'oi-a',
            newQty: 2,
            newNote: 'ít đường',
          }),
        ]),
      ),
    )
  })

  it('Xác nhận is enabled when only the note changes', () => {
    openDialog()
    fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], {
      target: { value: 'thêm đá' },
    })
    expect(screen.getByRole('button', { name: /xác nhận/i })).not.toBeDisabled()
  })

  it('resetting note to original disables Xác nhận', () => {
    openDialog()
    fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], {
      target: { value: 'thêm đá' },
    })
    fireEvent.change(screen.getAllByPlaceholderText('Ghi chú...')[0], {
      target: { value: '' },
    })
    expect(screen.getByRole('button', { name: /xác nhận/i })).toBeDisabled()
  })

  it('+ button is enabled for submitted items', () => {
    openDialog()
    const plusButtons = screen.getAllByLabelText(/^Tăng/)
    plusButtons.forEach((btn) => expect(btn).not.toBeDisabled())
  })

  it('clicking + increments the draft quantity', () => {
    openDialog()
    fireEvent.click(screen.getByLabelText('Tăng Trà đào'))
    expect(screen.getByTestId('qty-oi-c')).toHaveTextContent('2')
  })

  it('calls onConfirmChanges with newQty > original when + is clicked and confirmed', async () => {
    const onConfirmChanges = vi.fn().mockResolvedValue(undefined)
    openDialog({ onConfirmChanges })
    fireEvent.click(screen.getByLabelText('Tăng Trà đào'))
    fireEvent.click(screen.getByRole('button', { name: /xác nhận/i }))
    await waitFor(() =>
      expect(onConfirmChanges).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ orderItemSlug: 'oi-c', newQty: 2 }),
        ]),
      ),
    )
  })

  // Readonly mode (STAFF view-only)
  describe('readonly mode', () => {
    function openReadonlyDialog(submittedOrders: SubmittedOrder[] = multiItem) {
      render(
        <SubmittedOrdersDialog
          submittedOrders={submittedOrders}
          submittedTotal={120_000}
          onConfirmChanges={vi.fn().mockResolvedValue(undefined)}
          onCancelOrder={vi.fn().mockResolvedValue(undefined)}
          readonly
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /xem chi tiết/i }))
    }

    it('hides +/- buttons in readonly mode', () => {
      openReadonlyDialog()
      expect(screen.queryByLabelText(/^Giảm /)).toBeNull()
      expect(screen.queryByLabelText(/^Tăng /)).toBeNull()
    })

    it('hides trash buttons in readonly mode', () => {
      openReadonlyDialog()
      expect(screen.queryByLabelText(/^Xóa /)).toBeNull()
    })

    it('hides note input and shows only Đóng button in readonly mode', () => {
      openReadonlyDialog()
      expect(screen.queryByPlaceholderText('Ghi chú...')).toBeNull()
      expect(screen.queryByRole('button', { name: /xác nhận/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /^huỷ$/i })).toBeNull()
      expect(
        screen.getByRole('button', { name: /^đóng$/i }),
      ).toBeInTheDocument()
    })

    it('shows each submitted row quantity as static text in readonly mode', () => {
      openReadonlyDialog()
      expect(screen.getByTestId('qty-oi-a')).toHaveTextContent('2')
      expect(screen.getByTestId('qty-oi-b')).toHaveTextContent('1')
      expect(screen.getByTestId('qty-oi-c')).toHaveTextContent('1')
    })

    it('shows item note as static text in readonly mode', () => {
      const withNote: SubmittedOrder[] = [
        {
          id: 'o1',
          submittedAt: '2026-06-01T10:00:00Z',
          items: [
            {
              menuItemId: 'm1',
              name: 'Cà phê đen',
              priceNum: 25_000,
              price: '25.000đ',
              quantity: 1,
              note: 'ít đường',
              orderItemSlug: 'oi-a',
            },
          ],
        },
      ]
      openReadonlyDialog(withNote)
      expect(screen.getByText(/Ghi chú: ít đường/)).toBeInTheDocument()
    })
  })
})
