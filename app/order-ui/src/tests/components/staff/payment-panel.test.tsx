import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { PaymentPanel } from '@/components/staff/payment-panel'

// Stateful wrapper so controlled props (tab, amount) actually change on interaction
function Wrapper({
  total = 340_000,
  onConfirm = () => {},
  qrCode,
  onPrintProvisional,
  isPrinting,
}: {
  total?: number
  onConfirm?: () => void
  qrCode?: string
  onPrintProvisional?: () => void
  isPrinting?: boolean
}) {
  const [tab, setTab] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [amount, setAmount] = useState(0)
  return (
    <PaymentPanel
      total={total}
      tab={tab}
      onTabChange={setTab}
      onConfirm={onConfirm}
      amount={amount}
      onAmountChange={setAmount}
      qrCode={qrCode}
      onPrintProvisional={onPrintProvisional}
      isPrinting={isPrinting}
    />
  )
}

describe('PaymentPanel', () => {
  it('shows total and 4 preset buttons in cash tab by default', () => {
    render(<Wrapper />)
    expect(screen.getByTestId('payment-total')).toHaveTextContent('340.000đ')
    expect(screen.getAllByTestId('preset-button')).toHaveLength(4)
  })

  it('clicking a preset prefills the amount and computes change', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getAllByTestId('preset-button')[2]) // 400000
    expect((screen.getByTestId('amount-input') as HTMLInputElement).value).toBe(
      '400000',
    )
    expect(screen.getByTestId('change')).toHaveTextContent('60.000đ')
  })

  it('typing a custom amount updates change', () => {
    render(<Wrapper />)
    fireEvent.change(screen.getByTestId('amount-input'), {
      target: { value: '500000' },
    })
    expect(screen.getByTestId('change')).toHaveTextContent('160.000đ')
  })

  it('confirm button is disabled when received < total', () => {
    render(<Wrapper />)
    fireEvent.change(screen.getByTestId('amount-input'), {
      target: { value: '100000' },
    })
    expect(screen.getByRole('button', { name: /XÁC NHẬN/ })).toBeDisabled()
  })

  it('confirm fires onConfirm after cash confirmation modal when received >= total', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Wrapper onConfirm={onConfirm} />)
    fireEvent.change(screen.getByTestId('amount-input'), {
      target: { value: '400000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /XÁC NHẬN/ }))
    // Modal opens — onConfirm not called yet
    expect(onConfirm).not.toHaveBeenCalled()
    // Click "Hoàn tất" inside the modal to confirm
    await user.click(screen.getByRole('button', { name: /Hoàn tất/ }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('switches to transfer tab and shows QR placeholder', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)
    await user.click(screen.getByRole('tab', { name: /CHUYỂN KHOẢN/i }))
    expect(screen.getByTestId('qr-placeholder')).toBeInTheDocument()
  })

  it('transfer tab allows printing provisional bill even without qrCode (print is independent of QR)', async () => {
    const user = userEvent.setup()
    const onPrintProvisional = vi.fn()
    render(<Wrapper onPrintProvisional={onPrintProvisional} />)
    await user.click(screen.getByRole('tab', { name: /CHUYỂN KHOẢN/i }))
    const stickyButton = screen.getByRole('button', {
      name: /IN HOÁ ĐƠN TẠM/i,
    })
    expect(stickyButton).toBeEnabled()
    await user.click(stickyButton)
    expect(onPrintProvisional).toHaveBeenCalledTimes(1)
  })

  it('transfer tab with qrCode shows "IN HOÁ ĐƠN TẠM" and click fires onPrintProvisional', async () => {
    const user = userEvent.setup()
    const onPrintProvisional = vi.fn()
    const onConfirm = vi.fn()
    render(
      <Wrapper
        qrCode="data:image/png;base64,fake-qr"
        onPrintProvisional={onPrintProvisional}
        onConfirm={onConfirm}
      />,
    )
    await user.click(screen.getByRole('tab', { name: /CHUYỂN KHOẢN/i }))
    const stickyButton = screen.getByRole('button', {
      name: /IN HOÁ ĐƠN TẠM/i,
    })
    expect(stickyButton).toBeEnabled()
    await user.click(stickyButton)
    expect(onPrintProvisional).toHaveBeenCalledTimes(1)
    // onConfirm must NOT be called for transfer tab — that's cash-only semantic
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('transfer tab shows "Đang in..." and disables the sticky button when isPrinting', async () => {
    const user = userEvent.setup()
    const onPrintProvisional = vi.fn()
    render(
      <Wrapper
        qrCode="data:image/png;base64,fake-qr"
        onPrintProvisional={onPrintProvisional}
        isPrinting
      />,
    )
    await user.click(screen.getByRole('tab', { name: /CHUYỂN KHOẢN/i }))
    const stickyButton = screen.getByRole('button', { name: /Đang in/i })
    expect(stickyButton).toBeDisabled()
    await user.click(stickyButton)
    expect(onPrintProvisional).not.toHaveBeenCalled()
  })

  it('card tab shows POS swipe instructions', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)
    await user.click(screen.getByRole('tab', { name: /THẺ TÍN DỤNG/i }))
    expect(
      screen.getByText(/Vui lòng quẹt thẻ khách trên máy POS/),
    ).toBeInTheDocument()
  })

  it('card tab sticky button shows "XÁC NHẬN ĐÃ QUẸT THẺ" and is enabled when total > 0', async () => {
    const user = userEvent.setup()
    render(<Wrapper />)
    await user.click(screen.getByRole('tab', { name: /THẺ TÍN DỤNG/i }))
    const sticky = screen.getByRole('button', {
      name: /XÁC NHẬN ĐÃ QUẸT THẺ/i,
    })
    expect(sticky).toBeEnabled()
  })

  it('card tab: click sticky → modal confirm → confirm fires onConfirm once', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Wrapper onConfirm={onConfirm} />)
    await user.click(screen.getByRole('tab', { name: /THẺ TÍN DỤNG/i }))
    const sticky = screen.getByRole('button', {
      name: /XÁC NHẬN ĐÃ QUẸT THẺ/i,
    })
    await user.click(sticky)
    // Modal open — click confirm
    const confirmBtn = screen.getByRole('button', { name: /^Xác nhận$/ })
    await user.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows deficit amount when received > 0 but < total', () => {
    render(<Wrapper />)
    fireEvent.change(screen.getByTestId('amount-input'), {
      target: { value: '200000' },
    })
    expect(screen.getByTestId('deficit')).toHaveTextContent('140.000đ')
  })

  it('does not show deficit when amount is 0', () => {
    render(<Wrapper />)
    expect(screen.queryByTestId('deficit')).not.toBeInTheDocument()
  })

  it('does not show deficit when amount >= total', () => {
    render(<Wrapper />)
    fireEvent.change(screen.getByTestId('amount-input'), {
      target: { value: '400000' },
    })
    expect(screen.queryByTestId('deficit')).not.toBeInTheDocument()
  })
})
