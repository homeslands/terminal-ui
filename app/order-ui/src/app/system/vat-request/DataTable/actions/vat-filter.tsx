import { useEffect, useState } from 'react'
import { ColumnFiltersState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { Filter, X } from 'lucide-react'

import {
  Button,
  DataTableFilterOptionsProps,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { IVatRequestListItem } from '@/types'

export interface VatAdvancedFilterValues {
  customerName: string
  email: string
  invoiceNumber: string
  referenceNumber: string
}

const EMPTY: VatAdvancedFilterValues = {
  customerName: '',
  email: '',
  invoiceNumber: '',
  referenceNumber: '',
}

/**
 * Status filter (dropdown) only. Advanced filter popover render riêng ngoài
 * DataTable (xem page.tsx) để tránh unmount/remount khi state đổi.
 */
export default function VatFilter({
  setFilterOption,
  filterConfig,
  onFilterChange,
}: DataTableFilterOptionsProps<IVatRequestListItem>) {
  const { t } = useTranslation(['common', 'vatAdmin'])
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})

  const handleStatusFilterChange = (filterId: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [filterId]: value }))
    onFilterChange?.(filterId, value)

    const filterConditions: ColumnFiltersState = Object.entries({
      ...filterValues,
      [filterId]: value,
    })
      .filter(([, v]) => v !== 'all')
      .map(([id, v]) => ({ id, value: v }))

    setFilterOption(filterConditions)
  }

  return (
    <div className="flex items-center gap-2">
      {filterConfig?.map((filter) => (
        <Select
          key={filter.id}
          value={filterValues[filter.id] || 'all'}
          onValueChange={(value) => handleStatusFilterChange(filter.id, value)}
        >
          <SelectTrigger className="w-fit text-xs">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectGroup>
              <SelectLabel className="text-xs">{t('dataTable.filter')}</SelectLabel>
              {filter.options.map((option) => (
                <SelectItem
                  key={String(option.value)}
                  value={String(option.value)}
                  className="text-xs"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ))}
    </div>
  )
}

interface AdvancedFilterPopoverProps {
  value: VatAdvancedFilterValues
  onApply: (next: VatAdvancedFilterValues) => void
}

export function VatAdvancedFilterPopover({ value, onApply }: AdvancedFilterPopoverProps) {
  const { t } = useTranslation('vatAdmin')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<VatAdvancedFilterValues>(value)

  // Sync khi parent reset (vd Clear filter từ ngoài) hoặc khi popover mở lại.
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const activeCount = Object.values(value).filter((v) => v.trim() !== '').length

  const handleApply = () => {
    const normalized: VatAdvancedFilterValues = {
      customerName: draft.customerName.trim(),
      email: draft.email.trim(),
      invoiceNumber: draft.invoiceNumber.trim(),
      referenceNumber: draft.referenceNumber.trim(),
    }
    onApply(normalized)
    setOpen(false)
  }

  const handleClear = () => {
    setDraft(EMPTY)
    onApply(EMPTY)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs">
          <Filter className="h-3.5 w-3.5" />
          {t('filter.advancedTitle', 'Bộ lọc nâng cao')}
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              {t('filter.advancedTitle', 'Bộ lọc nâng cao')}
            </h4>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                {t('filter.clear', 'Xoá lọc')}
              </button>
            )}
          </div>

          <FilterInput
            label={t('filter.customerName', 'Tên khách hàng')}
            value={draft.customerName}
            onChange={(v) => setDraft((d) => ({ ...d, customerName: v }))}
            testId="vat-filter-customer-name"
          />
          <FilterInput
            label={t('filter.email', 'Email')}
            value={draft.email}
            onChange={(v) => setDraft((d) => ({ ...d, email: v }))}
            testId="vat-filter-email"
            type="email"
          />
          <FilterInput
            label={t('filter.invoiceNumber', 'Số hoá đơn')}
            value={draft.invoiceNumber}
            onChange={(v) => setDraft((d) => ({ ...d, invoiceNumber: v }))}
            testId="vat-filter-invoice-number"
          />
          <FilterInput
            label={t('filter.referenceNumber', 'Số đơn (reference)')}
            value={draft.referenceNumber}
            onChange={(v) =>
              setDraft((d) => ({ ...d, referenceNumber: v.replace(/\D/g, '') }))
            }
            testId="vat-filter-reference-number"
            inputMode="numeric"
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {t('filter.cancel', 'Huỷ')}
            </Button>
            <Button size="sm" onClick={handleApply} data-testid="vat-filter-apply">
              {t('filter.apply', 'Áp dụng')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface FilterInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  testId: string
  type?: string
  inputMode?: 'text' | 'numeric'
}

function FilterInput({
  label,
  value,
  onChange,
  testId,
  type = 'text',
  inputMode,
}: FilterInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
