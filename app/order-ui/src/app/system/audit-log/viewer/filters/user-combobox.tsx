import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsUpDown, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useDebouncedValue, useUsers } from '@/hooks'

export interface UserOption {
  slug: string
  label: string
}

interface IProps {
  value?: UserOption
  onChange: (v?: UserOption) => void
}

function formatPhoneVN(phone: string | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  if (digits.length === 11) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  return phone
}

function HighlightMatch({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700/60 text-foreground px-0.5 rounded-sm"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

export function UserCombobox({ value, onChange }: IProps) {
  const { t } = useTranslation('auditLog')
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const debounced = useDebouncedValue(keyword, 300)

  const { data, isFetching } = useUsers(
    open
      ? {
          phonenumber: debounced,
          order: 'DESC',
          hasPaging: true,
          page: 1,
          size: 20,
        }
      : null,
    open,
  )

  const items = (data?.result?.items ?? []) as Array<{
    slug: string
    firstName?: string
    lastName?: string
    phonenumber?: string
  }>

  const labelOf = (u: typeof items[number]) => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || '—'
    const phone = formatPhoneVN(u.phonenumber)
    return phone ? `${name} — ${phone}` : name
  }

  useEffect(() => {
    if (!open) setKeyword('')
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-60 min-w-[192px] justify-between"
        >
          <span className="truncate">
            {value?.label ?? t('auditLog.filter.userPlaceholder')}
          </span>
          {value ? (
            <X
              className="ml-2 h-4 w-4 opacity-60"
              onClick={(e) => {
                e.stopPropagation()
                onChange(undefined)
              }}
            />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[20rem] p-0">
        <div className="p-2 border-b">
          <Input
            placeholder={t('auditLog.filter.userPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoFocus
          />
        </div>
        <div
          className="max-h-64 overflow-y-auto"
          role="listbox"
          aria-label={t('auditLog.filter.user')}
        >
          {isFetching && items.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('auditLog.filter.userLoading')}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              {t('auditLog.filter.userEmpty')}
            </div>
          ) : (
            items.map((u) => {
              const opt: UserOption = { slug: u.slug, label: labelOf(u) }
              const selected = value?.slug === u.slug
              return (
                <button
                  type="button"
                  key={u.slug}
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                    selected ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">
                    <HighlightMatch text={opt.label} keyword={debounced} />
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
