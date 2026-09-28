import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { useVatRequestColumns } from '@/app/system/vat-request/DataTable/columns'
import { VatRequestStatus, type IVatRequestListItem } from '@/types'

const sample: IVatRequestListItem[] = [
  {
    slug: 'VAT-1',
    customerName: 'Co A',
    taxCode: '0123456789',
    email: 'a@x.com',
    status: VatRequestStatus.PENDING,
    invoiceNumber: undefined,
    createdAt: '2026-06-26T10:00:00.000Z',
    invoice: {
      slug: 'INV-1',
      referenceNumber: 544,
      amount: 109950,
      totalVatValue: 1700,
    },
  },
  {
    slug: 'VAT-2',
    customerName: 'Co B',
    companyName: 'Cty TNHH B',
    taxCode: '0987654321',
    email: 'b@x.com',
    status: VatRequestStatus.COMPLETED,
    invoiceNumber: 'HD-001',
    createdAt: '2026-06-25T10:00:00.000Z',
    invoice: {
      slug: 'INV-2',
      referenceNumber: 545,
      amount: 220000,
      totalVatValue: 22000,
    },
  },
]

function TestTable({ data }: { data: typeof sample }) {
  const columns = useVatRequestColumns()
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} data-testid={`vat-row-${row.original.slug}`}>
            {row.getVisibleCells().map((c) => (
              <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

describe('VAT request table columns', () => {
  it('renders rows with key columns: reference #, customer/company, tax code', () => {
    render(<TestTable data={sample} />)
    expect(screen.getByTestId('vat-row-VAT-1')).toBeInTheDocument()
    expect(screen.getByTestId('vat-row-VAT-2')).toBeInTheDocument()
    expect(screen.getByText('#544')).toBeInTheDocument()
    expect(screen.getByText('#545')).toBeInTheDocument()
    expect(screen.getByText('0123456789')).toBeInTheDocument()
    // Row 2: companyName takes priority, customerName shown as sub-label.
    expect(screen.getByText('Cty TNHH B')).toBeInTheDocument()
  })

  it('renders status badge with correct label per row', () => {
    render(<TestTable data={sample} />)
    expect(screen.getByTestId('vat-status-badge-PENDING')).toBeInTheDocument()
    expect(screen.getByTestId('vat-status-badge-COMPLETED')).toBeInTheDocument()
  })
})
