import { useMemo, useState } from 'react'
import { Gift } from 'lucide-react'
import { Button, Input, Skeleton } from '@/components/ui'
import StaffPromotionTag from '@/components/app/badge/staff-promotion-tag'
import type { OrderItem } from '@/types/session'
import type { IPromotion } from '@/types'
import { formatVnd } from '@/data/staff-data'
import { useSpecificMenu } from '@/hooks'
import { useUserStore } from '@/stores'
import { capitalizeFirstLetter } from '@/utils'
import { publicFileURL } from '@/constants'
import { CustomPriceDialog } from './custom-price-dialog'

interface Props {
  pendingItems: OrderItem[]
  onAdd: (item: Omit<OrderItem, 'note'>) => void
  onDecrement: (menuItemId: string) => void
}

export function MenuPanel({ pendingItems, onAdd, onDecrement }: Props) {
  const { userInfo } = useUserStore()
  const today = new Date().toISOString().slice(0, 10)
  const { data: menuData, isLoading, isError } = useSpecificMenu(
    { date: today, branch: userInfo?.branch?.slug },
    !!userInfo?.slug,
  )

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; name: string }[] = []
    for (const item of menuData?.result?.menuItems ?? []) {
      const cat = item.product.catalog
      if (!seen.has(cat.slug)) {
        seen.add(cat.slug)
        result.push({ id: cat.slug, name: cat.name })
      }
    }
    return result
  }, [menuData])

  const [activeCat, setActiveCat] = useState('')
  const effectiveCat = activeCat || categories[0]?.id || ''

  const [searchQuery, setSearchQuery] = useState('')

  const menuItems = useMemo(
    () =>
      (menuData?.result?.menuItems ?? []).map((item) => {
        const isCustomPrice = !!item.product.isCustomPrice
        const original = isCustomPrice ? 0 : (item.product.variants[0]?.price ?? 0)
        const promo = item.promotion ?? null
        const promoValue = promo?.value ?? 0
        // NOTE: Treats `promo.value` as a percentage (matches system /menu behavior).
        // If BE introduces other promotion types (e.g. fixed-amount), handle them here.
        const priceNum = promo && !isCustomPrice
          ? Math.max(0, Math.round(original * (1 - promoValue / 100)))
          : original
        return {
          id: item.slug,
          categoryId: item.product.catalog.slug,
          productSlug: item.product.slug,
          name: item.product.name,
          description: item.product.description,
          priceNum,
          originalPrice: original,
          price: isCustomPrice ? '' : formatVnd(priceNum),
          image: item.product.image,
          isCustomPrice,
          isGift: item.product.isGift ?? false,
          variantSlug: item.product.variants[0]?.slug ?? '',
          promotion: promo ? { slug: promo.slug, value: promoValue } : null,
          vatRate: item.product.vatRate ?? 0,
        }
      }),
    [menuData],
  )

  const items = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      return menuItems.filter((m) => m.name.toLowerCase().includes(q))
    }
    return menuItems.filter((m) => m.categoryId === effectiveCat)
  }, [menuItems, effectiveCat, searchQuery])

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0">
        {/* Category sidebar skeleton */}
        <div className="flex w-[160px] shrink-0 flex-col gap-1 border-r border-pos-border bg-pos-surface p-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded" />
          ))}
        </div>

        {/* Menu content skeleton */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Search bar skeleton */}
          <div className="border-b border-pos-border px-3 py-2">
            <Skeleton className="h-8 w-full rounded" />
          </div>

          {/* Grid skeleton */}
          <div className="grid auto-rows-max grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 overflow-y-auto p-3 content-start">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="relative flex overflow-hidden rounded-lg border border-muted-foreground/20 bg-muted-foreground/10 p-1.5"
              >
                <div className="h-[88px] w-[88px] shrink-0 p-1.5">
                  <Skeleton className="h-full w-full rounded-md" />
                </div>
                <div className="flex flex-1 flex-col justify-between p-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-4/5 rounded" />
                    <Skeleton className="h-2.5 w-full rounded" />
                    <Skeleton className="h-2.5 w-3/4 rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-12 rounded" />
                    <Skeleton className="h-7 w-12 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full min-h-0">
        <div className="flex w-[160px] shrink-0 border-r border-pos-border bg-pos-surface" />
        <div className="flex flex-1 items-center justify-center text-sm text-red-400">
          Không tải được thực đơn. Vui lòng thử lại.
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Category sidebar */}
      <div className="flex w-[160px] shrink-0 flex-col overflow-y-auto border-r border-pos-border bg-pos-surface p-1">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setActiveCat(c.id); setSearchQuery('') }}
            className={`px-2 py-3 text-left text-sm font-medium leading-tight transition ${
              effectiveCat === c.id ? 'text-pos-gold' : 'text-pos-dim hover:text-pos-muted'
            }`}
          >
            {capitalizeFirstLetter(c.name)}
          </button>
        ))}
      </div>

      {/* Menu content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Search */}
        <div className="px-3 py-2">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm món..."
            className="w-full rounded border border-pos-border bg-pos-card px-3 py-1.5 text-sm placeholder:text-pos-faint focus:outline-none"
          />
        </div>

        {/* Grid */}
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-pos-faint">
            Không tìm thấy món nào
          </div>
        ) : (
          <div className="grid auto-rows-max grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 overflow-y-auto p-3 content-start">
            {items.map((m) => {
              const count = m.isCustomPrice
                ? 0
                : (pendingItems.find((p) => p.menuItemId === m.id)?.quantity ?? 0)
              return (
                <div
                  key={m.id}
                  className="relative flex overflow-hidden rounded-lg border border-muted-foreground/20 bg-muted-foreground/10 p-1"
                >
                  {m.promotion && m.promotion.value > 0 && (
                    <StaffPromotionTag promotion={{ value: m.promotion.value } as IPromotion} />
                  )}
                  {m.isGift && (
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      <Gift className="w-2.5 h-2.5" />
                      Quà
                    </div>
                  )}
                  {m.image ? (
                    <div className="h-[88px] w-[88px] shrink-0 p-0.5">
                      <img src={`${publicFileURL}/${m.image}`} alt={m.name} className="h-full w-full rounded-md object-cover" />
                    </div>
                  ) : (
                    <div className="h-[88px] w-[88px] shrink-0 p-0.5">
                      <div className="h-full w-full rounded-md bg-pos-elevated" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col justify-between p-1">
                    <div>
                      <div className="text-xs font-semibold leading-tight text-pos-text">{m.name}</div>
                      {m.description && (
                        <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-pos-dim">
                          {m.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      {m.isCustomPrice ? (
                        <span className="text-xs font-semibold text-orange-400">Tuỳ chỉnh</span>
                      ) : m.promotion && m.originalPrice && m.originalPrice !== m.priceNum ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] text-pos-faint line-through">
                            {formatVnd(m.originalPrice)}
                          </span>
                          <span className="text-xs font-bold text-pos-gold">{m.price}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-pos-gold">{m.price}</span>
                      )}
                      {m.isCustomPrice ? (
                        // Custom-price items rely on adapter fallbacks for productSlug/originalPrice/promotion.
                        // Current product policy: custom-price never carries promotion. If that ever changes,
                        // CustomPriceDialog must accept promotion props (out of scope here).
                        <CustomPriceDialog
                          menuItemId={m.id}
                          name={m.name}
                          variantSlug={m.variantSlug}
                          productSlug={m.productSlug}
                          vatRate={m.vatRate}
                          onAdd={onAdd}
                          trigger={
                            <Button
                              size="sm"
                              aria-label={`Thêm ${m.name}`}
                              className="bg-pos-gold text-white hover:bg-pos-gold/80"
                            >
                              Thêm
                            </Button>
                          }
                        />
                      ) : count > 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Giảm ${m.name}`}
                            onClick={() => onDecrement(m.id)}
                            className="flex h-6 w-6 items-center justify-center rounded bg-pos-border text-sm hover:bg-pos-hover"
                          >
                            −
                          </button>
                          <span
                            data-testid={`badge-${m.id}`}
                            className="w-5 text-center text-xs font-semibold"
                          >
                            {count}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tăng ${m.name}`}
                            onClick={() =>
                              onAdd({
                                menuItemId: m.id,
                                name: m.name,
                                priceNum: m.priceNum,
                                price: m.price,
                                quantity: 1,
                                variantSlug: m.variantSlug,
                                productSlug: m.productSlug,
                                originalPrice: m.originalPrice,
                                promotion: m.promotion,
                                vatRate: m.vatRate,
                              })
                            }
                            className="flex h-6 w-6 items-center justify-center rounded bg-pos-border text-sm hover:bg-pos-hover"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            onAdd({
                              menuItemId: m.id,
                              name: m.name,
                              priceNum: m.priceNum,
                              price: m.price,
                              quantity: 1,
                              variantSlug: m.variantSlug,
                              productSlug: m.productSlug,
                              originalPrice: m.originalPrice,
                              promotion: m.promotion,
                              vatRate: m.vatRate,
                            })
                          }
                          className="bg-pos-gold text-white hover:bg-pos-gold/80"
                        >
                          Thêm
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
