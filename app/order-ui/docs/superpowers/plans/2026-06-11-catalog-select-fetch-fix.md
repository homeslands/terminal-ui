# Fix CatalogSelect — Load Categories Properly

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Each task: NO commit. Leave changes in working tree for user to commit.

**Goal:** Fix dropdown danh mục rỗng trong create/update product form. Root cause: query key mismatch + anti-pattern (read cache instead of fetch).

## Root cause

| Layer | Key | Issue |
|---|---|---|
| `useCatalogs()` hook (`hooks/use-catalog.ts:9`) | `QUERYKEY.catalog = ['catalog']` (số ít) | Writes here |
| `CatalogSelect` (`select/catalog-select.tsx:26`) | `['catalogs']` (số nhiều) | Reads here — MISS |

→ Cache lookup luôn fail. Dropdown rỗng trừ khi parent component seed cache trước.

## Strategy

Convert `CatalogSelect` từ "read cache" sang "self-fetch" pattern. Component tự fetch khi mount, có loading/error/empty UI state. Không phụ thuộc parent đã pre-fetch hay chưa.

---

## Task CAT-1: Refactor CatalogSelect to self-fetch

**File:** `/Users/phanquyetthang/terminal/app/order-ui/src/components/app/select/catalog-select.tsx`

### Current (broken)

```tsx
const [allCatalogs, setAllCatalogs] = useState<...>([])
const queryClient = useQueryClient()

useEffect(() => {
  const data = queryClient.getQueryData<{ result: ICatalog[] }>(['catalogs'])
  if (data?.result) {
    setAllCatalogs(data.result.map(...))
  }
}, [])
```

### Replace with

```tsx
import { useCatalogs } from '@/hooks'

// Remove: useState, useEffect, useQueryClient imports if only used above

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
```

### Verify

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -3
npx eslint src/components/app/select/catalog-select.tsx 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

### Smoke test

1. Vào `/system/products` → "Tạo sản phẩm" → mở dialog
2. Dropdown "Danh mục" → confirm hiện loading rồi list danh mục
3. Chọn danh mục → submit OK

---

## Task CAT-2: Audit other Select components for same pattern

**Goal:** Tìm xem có Select nào khác cùng bug (read cache với key sai).

```bash
grep -rn "queryClient.getQueryData" /Users/phanquyetthang/terminal/app/order-ui/src/components/app/select/
```

Nếu có Select khác dùng pattern này → audit query key có match hook nào không. Nếu mismatch → apply same fix (self-fetch via hook).

### Action per Select found

For each problematic select:
1. Identify the matching `useXxx` hook
2. Replace `useQueryClient + getQueryData` with the hook
3. Add loading/error/empty placeholder
4. Verify tsc + tests

## Verify

```bash
cd /Users/phanquyetthang/terminal/app/order-ui
npx tsc -b 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```

## Report

- Audit result: how many Select files have this pattern
- For each: fixed or no-action-needed (with reason)
- Test count

---

## Notes / Design Decisions

1. **Self-fetch over cache-read**: Component nên độc lập, không assume parent đã prefetch. TanStack Query dedupes concurrent fetches anyway — no perf concern.

2. **Loading state explicit**: User cần biết dropdown đang load vs empty thật. Placeholder dynamic theo state là chuẩn UX.

3. **i18n**: Strings hardcoded Vietnamese trong fix này — nếu có key i18n cho "Đang tải...", "Không tải được", có thể swap. Optional polish.

4. **`useCatalogs` đã có `keepPreviousData`**: Refetch trong background giữ data cũ visible — không có flash loading state khi navigate giữa pages.
