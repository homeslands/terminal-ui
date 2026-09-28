import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "react-i18next"
import { useCatalogs } from "@/hooks"

interface SelectCatalogProps {
  defaultValue?: string
  value?: string | null | undefined
  onChange: (value: string | undefined) => void
}

export default function CatalogSelect({ value, defaultValue, onChange }: SelectCatalogProps) {
  const { t } = useTranslation(['product'])
  const { data, isLoading, isError } = useCatalogs()

  const allCatalogs = (data?.result ?? []).map((item) => ({
    value: item.slug || '',
    label: (item.name?.[0]?.toUpperCase() + item.name?.slice(1)) || '',
  }))

  const placeholder = isLoading
    ? 'Đang tải danh mục...'
    : isError
    ? 'Không tải được danh mục'
    : allCatalogs.length === 0
    ? 'Chưa có danh mục'
    : t('product.selectProductCatalog')

  return (
    <Select onValueChange={onChange} defaultValue={defaultValue} value={value || ''} disabled={isLoading}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {allCatalogs.map((catalog) => (
            <SelectItem key={catalog.value} value={catalog.value}>
              {catalog.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
