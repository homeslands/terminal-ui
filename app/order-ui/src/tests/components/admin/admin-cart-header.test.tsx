import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminCartHeader } from '@/app/system/menu/components/admin-cart-header'

vi.mock('@/components/staff/transfer-table-dialog', () => ({
  TransferTableDialog: () => <div data-testid="transfer-dialog" />,
}))

describe('AdminCartHeader', () => {
  it('renders table name', () => {
    render(
      <AdminCartHeader
        tableName="Bàn 1"
        tableSlug="t1"
        tables={[]}
        sessions={{}}
        assistBannerVisible={false}
        assistOrderSlug={null}
        onTransfer={vi.fn()}
        onDismissAssistBanner={vi.fn()}
      />,
    )
    expect(screen.getByText('Bàn 1')).toBeTruthy()
  })

  it('renders assist banner when visible', () => {
    render(
      <AdminCartHeader
        tableName="Bàn 1"
        tableSlug="t1"
        tables={[]}
        sessions={{}}
        assistBannerVisible={true}
        assistOrderSlug="o1"
        onTransfer={vi.fn()}
        onDismissAssistBanner={vi.fn()}
      />,
    )
    expect(screen.getByText(/o1/i)).toBeTruthy()
  })
})
