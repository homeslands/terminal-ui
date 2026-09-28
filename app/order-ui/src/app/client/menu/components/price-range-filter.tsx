import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'

import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'

import { useBranchStore, useMenuFilterStore } from '@/stores'
import { DualRangeSlider } from './dual-range-slider'
import { formatCurrency, formatCurrencyWithSymbol } from '@/utils'
import { FILTER_VALUE } from '@/constants'
import { cn } from '@/lib'

export default function PriceRangeFilter() {
  const { t } = useTranslation(['menu'])
  const { branch } = useBranchStore()
  const { menuFilter, setMenuFilter } = useMenuFilterStore()
  const [minPriceInput, setMinPriceInput] = useState<string>(formatCurrencyWithSymbol(menuFilter.minPrice, false))
  const [maxPriceInput, setMaxPriceInput] = useState<string>(formatCurrencyWithSymbol(menuFilter.maxPrice, false))
  const [open, setOpen] = useState(false)

  const presets = [
    { label: '< 40K', min: FILTER_VALUE.MIN_PRICE, max: 40000 },
    { label: '40K – 60K', min: 40000, max: 60000 },
    { label: '60K – 80K', min: 60000, max: 80000 },
    { label: '> 80K', min: 80000, max: FILTER_VALUE.MAX_PRICE },
  ]

  const isPresetActive = (min: number, max: number) => {
    return menuFilter.minPrice === min && menuFilter.maxPrice === max
  }

  const handleMinPriceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\./g, '')
    const number = Number(raw)

    if (!isNaN(number)) {
      setMinPriceInput(formatCurrencyWithSymbol(number, false))
    } else {
      setMinPriceInput('')
    }
  }

  const handleMaxPriceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\./g, '')
    const number = Number(raw)

    if (!isNaN(number)) {
      setMaxPriceInput(formatCurrencyWithSymbol(number, false))
    } else {
      setMaxPriceInput('')
    }
  }


  const handlePresetClick = (min: number, max: number) => {
    setMenuFilter(prev => ({ ...prev, minPrice: min, maxPrice: max, branch: branch?.slug }))
    setMinPriceInput(formatCurrencyWithSymbol(min, false))
    setMaxPriceInput(formatCurrencyWithSymbol(max, false))
  }

  const handleReset = () => {
    setMenuFilter(prev => ({ ...prev, minPrice: FILTER_VALUE.MIN_PRICE, maxPrice: FILTER_VALUE.MAX_PRICE, branch: branch?.slug }))
    setMinPriceInput(formatCurrencyWithSymbol(FILTER_VALUE.MIN_PRICE, false))
    setMaxPriceInput(formatCurrencyWithSymbol(FILTER_VALUE.MAX_PRICE, false))
  }

  const handleApply = () => {
    const minValue = Number(minPriceInput.replace(/\./g, '')) || FILTER_VALUE.MIN_PRICE
    const maxValue = Number(maxPriceInput.replace(/\./g, '')) || FILTER_VALUE.MAX_PRICE

    // Nếu người dùng nhập lệch, hoán đổi trước khi lưu vào store
    const min = Math.min(minValue, maxValue)
    const max = Math.max(minValue, maxValue)

    setMenuFilter(prev => ({ ...prev, minPrice: min, maxPrice: max }))
    setOpen(false)
  }

  const handleSliderChange = (values: number[]) => {
    const [min, max] = values
    setMinPriceInput(formatCurrencyWithSymbol(min, false))
    setMaxPriceInput(formatCurrencyWithSymbol(max, false))
    setMenuFilter(prev => ({ ...prev, minPrice: min, maxPrice: max }))
  }

  useEffect(() => {
    setMinPriceInput(formatCurrencyWithSymbol(menuFilter.minPrice, false))
    setMaxPriceInput(formatCurrencyWithSymbol(menuFilter.maxPrice, false))
  }, [menuFilter.minPrice, menuFilter.maxPrice])

  const isActive =
    menuFilter.minPrice > FILTER_VALUE.MIN_PRICE || menuFilter.maxPrice < FILTER_VALUE.MAX_PRICE

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={t('menu.priceRangeFilter')}
          className={cn(
            'flex h-11 w-full items-center justify-center gap-2 border-landing-brass/40 bg-transparent text-sm uppercase tracking-[.16em] text-landing-brass-light hover:border-landing-brass hover:bg-landing-brass/10 hover:text-landing-brass-light',
            isActive && 'border-landing-brass bg-landing-brass/10',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="truncate">{t('menu.priceRangeFilter')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="modal-frame mt-3 w-[calc(100vw-2rem)] max-w-sm text-landing-quartz sm:w-80"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <DualRangeSlider
              min={FILTER_VALUE.MIN_PRICE}
              max={FILTER_VALUE.MAX_PRICE}
              step={1000}
              value={[menuFilter.minPrice, menuFilter.maxPrice]}
              onValueChange={handleSliderChange}
              formatValue={(value) => formatCurrency(value)}
              hideMinMaxLabels={true}
            />

            <div className="grid relative grid-cols-5 gap-1 items-center">
              <div className="relative col-span-2 w-full">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={minPriceInput || '0'}
                  onFocus={(e) => {
                    if (e.target.value === '0') e.target.value = ''
                  }}
                  onChange={handleMinPriceInputChange}
                  placeholder="0"
                  className="pr-6 w-full"
                />


                <span className="flex absolute inset-y-0 right-2 items-center text-landing-brass-light/80">
                  đ
                </span>
              </div>

              <span className='flex col-span-1 justify-center text-landing-brass-light'>→</span>
              <div className="relative col-span-2 w-full">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={maxPriceInput || '0'}
                  onFocus={(e) => {
                    if (e.target.value === '0') e.target.value = ''
                  }}
                  onChange={handleMaxPriceInputChange}
                  placeholder="0"
                  className="pr-6 w-full"
                />

                <span className="flex absolute inset-y-0 right-2 items-center text-landing-brass-light/80">
                  đ
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant="ghost"
                onClick={() => handlePresetClick(preset.min, preset.max)}
                className={cn(
                  'border border-landing-brass/30 text-xs text-landing-quartz/85 hover:bg-landing-brass/10 hover:text-landing-brass-light',
                  isPresetActive(preset.min, preset.max) &&
                    'border-landing-brass bg-landing-brass/10 text-landing-brass-light'
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-landing-brass/40 bg-transparent text-landing-quartz/85 hover:bg-landing-brass/10 hover:text-landing-brass-light"
            >
              {t('menu.reset')}
            </Button>
            <Button onClick={handleApply} className="btn-brass w-24 border-none">
              {t('menu.apply')}
            </Button>

          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
