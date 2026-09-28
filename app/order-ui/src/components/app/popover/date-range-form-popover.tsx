import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import moment from 'moment'

import {
  Button,
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
import SimpleDatePicker from '@/components/app/picker/simple-date-picker'

interface Props {
  startDate: string
  endDate: string
  onApply: (startDate: string, endDate: string) => void
  triggerLabel?: string
  title?: string
}

type PresetId =
  | 'custom'
  | '7d'
  | '30d'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'thisYear'

const PRESETS: { id: Exclude<PresetId, 'custom'>; label: string; range: () => [string, string] }[] = [
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

export default function DateRangeFormPopover({
  startDate,
  endDate,
  onApply,
  triggerLabel = 'Khoảng thời gian',
  title = 'Khoảng thời gian',
}: Props) {
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<PresetId>('custom')
  const [localStart, setLocalStart] = useState<string>(startDate)
  const [localEnd, setLocalEnd] = useState<string>(endDate)

  useEffect(() => {
    if (open) {
      setLocalStart(startDate)
      setLocalEnd(endDate)
      setPreset('custom')
    }
  }, [open, startDate, endDate])

  const handlePresetChange = (id: string) => {
    setPreset(id as PresetId)
    if (id === 'custom') return
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    const [s, e] = p.range()
    setLocalStart(s)
    setLocalEnd(e)
  }

  const handleApply = () => {
    if (!localStart && !localEnd) return
    onApply(localStart, localEnd)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Settings2 />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[32rem]">
        <div className="flex flex-col gap-1 w-full">
          <div className="space-y-2">
            <span className="font-bold leading-none text-md">{title}</span>
          </div>
          <div className="mt-3">
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn khoảng thời gian" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Khoảng thời gian</SelectLabel>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Tuỳ chỉnh</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Từ ngày</label>
                <SimpleDatePicker
                  value={localStart}
                  onChange={(v) => {
                    setLocalStart(v)
                    setPreset('custom')
                  }}
                  disableFutureDates
                  maxDate={localEnd || undefined}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold">Đến ngày</label>
                <SimpleDatePicker
                  value={localEnd}
                  onChange={(v) => {
                    setLocalEnd(v)
                    setPreset('custom')
                  }}
                  disableFutureDates
                  minDate={localStart || undefined}
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleApply} disabled={!localStart && !localEnd}>
                Áp dụng
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
