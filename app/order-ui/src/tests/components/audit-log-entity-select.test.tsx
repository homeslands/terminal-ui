import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef } from 'react'

// Radix UI Select relies on pointer-capture and scrollIntoView APIs not
// available in jsdom. We replace it with a lightweight HTML <select> shim so
// we can exercise the EntitySelect logic without fighting jsdom limitations.
vi.mock('@/components/ui/select', () => {
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    children?: React.ReactNode
  }) => {
    return (
      <select
        role="combobox"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {children}
      </select>
    )
  }

  const SelectTrigger = forwardRef(
    ({ children }: { children?: React.ReactNode }, _ref: unknown) => (
      <>{children}</>
    ),
  )
  SelectTrigger.displayName = 'SelectTrigger'

  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  )

  const SelectContent = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  )

  const SelectItem = ({
    value,
    children,
  }: {
    value: string
    children?: React.ReactNode
  }) => <option value={value}>{children}</option>

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

vi.mock('@/hooks', () => ({
  useAuditLogConfigs: () => ({
    data: {
      result: [
        { slug: 's1', entity: 'Order', enabled: true, createdAt: '' },
        { slug: 's2', entity: 'User', enabled: false, createdAt: '' },
      ],
    },
  }),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { EntitySelect } from '@/app/system/audit-log/viewer/filters/entity-select'

describe('EntitySelect', () => {
  it('renders disabled badge for configs with enabled=false', async () => {
    const onChange = vi.fn()
    render(<EntitySelect value={undefined} onChange={onChange} />)
    expect(screen.getByText('Order')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(
      screen.getByText('auditLog.filter.entityDisabled'),
    ).toBeInTheDocument()
  })

  it('calls onChange with undefined when picking "all"', async () => {
    const onChange = vi.fn()
    render(<EntitySelect value="Order" onChange={onChange} />)
    await userEvent.selectOptions(
      screen.getByRole('combobox'),
      'auditLog.filter.entityAll',
    )
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})
