import * as React from 'react'
import { Clock, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  buildMinuteValues,
  clampToRange,
  formatTimeString,
  isHourSelectable,
  isWithinRange,
  nearestSelectableMinute,
  pad2,
  parseTimeString,
} from '@/lib/clock-time'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface TimeOnlyPickerProps {
  value?: string | null
  onSelect: (value: string | null) => void
  disabled?: boolean
  clearable?: boolean
  placeholder?: string
  className?: string
  /**
   * Inclusive bounds as "HH:mm". Hours with no selectable minute, and
   * minutes outside the range for the chosen hour, are offered but
   * disabled — an out-of-range time cannot be picked.
   */
  minTime?: string | null
  maxTime?: string | null
  /** Minute granularity, e.g. 15 -> 00, 15, 30, 45. Defaults to every minute. */
  minuteStep?: number
}

export default function TimeOnlyPicker({
  value,
  onSelect,
  disabled = false,
  clearable = false,
  placeholder,
  className,
  minTime,
  maxTime,
  minuteStep = 1,
}: TimeOnlyPickerProps) {
  const { t } = useTranslation(['voucher'])

  const parsed = React.useMemo(() => parseTimeString(value), [value])
  const min = React.useMemo(() => parseTimeString(minTime), [minTime])
  const max = React.useMemo(() => parseTimeString(maxTime), [maxTime])
  const step = minuteStep > 0 ? Math.floor(minuteStep) : 1

  const [hour, setHour] = React.useState<number>(parsed?.hour ?? 8)
  const [minute, setMinute] = React.useState<number>(parsed?.minute ?? 0)

  React.useEffect(() => {
    if (parsed) {
      setHour(parsed.hour)
      setMinute(parsed.minute)
    }
  }, [parsed])

  // With nothing picked yet, open on a time that is actually selectable
  // instead of a disabled default (08:00 under a 10:30 lower bound). A value
  // the caller did supply is shown as-is, out of range or not.
  React.useEffect(() => {
    if (parsed) return
    const next = clampToRange({ hour, minute }, step, min, max)
    if (next.hour !== hour) setHour(next.hour)
    if (next.minute !== minute) setMinute(next.minute)
  }, [parsed, hour, minute, step, min, max])

  const minuteValues = React.useMemo(() => buildMinuteValues(step), [step])

  const handleHourChange = (val: string) => {
    const h = parseInt(val)
    // The minute that was fine for the old hour may fall outside the range
    // for the new one (08:30 lower bound, hour moved to 08) — pull it in.
    const m = nearestSelectableMinute(h, minute, step, min, max) ?? minute
    setHour(h)
    setMinute(m)
    onSelect(formatTimeString({ hour: h, minute: m }))
  }

  const handleMinuteChange = (val: string) => {
    const m = parseInt(val)
    setMinute(m)
    onSelect(formatTimeString({ hour, minute: m }))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal dark:border-gray-300',
            !value && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1">
            {parsed ? formatTimeString(parsed) : (placeholder ?? 'HH:MM')}
          </span>
          {clearable && value && !disabled && (
            <span
              role="button"
              className="ml-2 rounded p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(null)
              }}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-4" align="start">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              {t('voucher.hour')}
            </span>
            <Select value={hour.toString()} onValueChange={handleHourChange}>
              <SelectTrigger>
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem
                    key={h}
                    value={h.toString()}
                    disabled={!isHourSelectable(h, step, min, max)}
                  >
                    {pad2(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              {t('common.minute', { ns: 'common' })}
            </span>
            <Select value={minute.toString()} onValueChange={handleMinuteChange}>
              <SelectTrigger>
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {minuteValues.map((m) => (
                  <SelectItem
                    key={m}
                    value={m.toString()}
                    disabled={!isWithinRange({ hour, minute: m }, min, max)}
                  >
                    {pad2(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
