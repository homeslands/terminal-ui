import { CircleXIcon, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { Input } from '@/components/ui'
import { useMenuFilterStore } from '@/stores'
import { useDebouncedInput } from '@/hooks'

export default function ProductNameSearch() {
  const { menuFilter, setMenuFilter } = useMenuFilterStore()
  const { t } = useTranslation('menu')

  const {
    inputValue,
    setInputValue,
    debouncedInputValue
  } = useDebouncedInput({
    defaultValue: menuFilter.productName || '',
    delay: 500
  })

  // Sau khi debounce xong thì mới lưu vào store
  useEffect(() => {
    setMenuFilter(prev => ({
      ...prev,
      productName: debouncedInputValue || undefined
    }))
  }, [debouncedInputValue, setMenuFilter])

  return (
    <div className="field relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-landing-rust-label" />
      <Input
        type="text"
        placeholder={t('menu.searchProduct')}
        className="!h-auto w-full !pl-10 !pr-10"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      {inputValue && (
        <CircleXIcon
          className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 cursor-pointer text-landing-rust-label hover:text-landing-iron"
          onClick={() => setInputValue('')}
        />
      )}
    </div>
  )
}
