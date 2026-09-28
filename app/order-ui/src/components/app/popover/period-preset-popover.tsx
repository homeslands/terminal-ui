import { useState } from 'react'
import moment from 'moment'
import { Settings2 } from 'lucide-react'

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'
import SimpleDatePicker from '@/components/app/picker/simple-date-picker'

interface Props {
  onApply: (startDate: string, endDate: string) => void
  label?: string
}

const PRESETS: { id: string; label: string; range: () => [string, string] }[] = [
  {
    id: '7d',
    label: '7 ngày qua',
    range: () => [
      moment().subtract(7, 'days').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
  {
    id: '30d',
    label: '30 ngày qua',
    range: () => [
      moment().subtract(30, 'days').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
  {
    id: 'thisMonth',
    label: 'Tháng này',
    range: () => [
      moment().startOf('month').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
  {
    id: 'lastMonth',
    label: 'Tháng trước',
    range: () => [
      moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
      moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
    ],
  },
  {
    id: 'thisQuarter',
    label: 'Quý này',
    range: () => [
      moment().startOf('quarter').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
  {
    id: 'thisYear',
    label: 'Năm nay',
    range: () => [
      moment().startOf('year').format('YYYY-MM-DD'),
      moment().format('YYYY-MM-DD'),
    ],
  },
]

export default function PeriodPresetPopover({ onApply, label = 'Khoảng thời gian' }: Props) {
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')

  const handlePreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    const [start, end] = preset.range()
    onApply(start, end)
    setOpen(false)
  }

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return
    onApply(customStart, customEnd)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Settings2 />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-3 w-72">
        <div className="space-y-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePreset(p.id)}
              className="px-2 py-1.5 w-full text-sm text-left rounded hover:bg-muted"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="pt-3 mt-3 border-t">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            Tuỳ chỉnh
          </div>
          <div className="flex flex-col gap-2">
            <SimpleDatePicker
              value={customStart}
              onChange={setCustomStart}
              allowEmpty
              disableFutureDates
              maxDate={customEnd || undefined}
            />
            <SimpleDatePicker
              value={customEnd}
              onChange={setCustomEnd}
              allowEmpty
              disableFutureDates
              minDate={customStart || undefined}
            />
            <Button
              size="sm"
              onClick={handleCustomApply}
              disabled={!customStart || !customEnd}
            >
              Áp dụng
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
