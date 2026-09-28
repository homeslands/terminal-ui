import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { capitalizeFirstLetter } from '@/utils'

export interface ICategoryTab {
  slug: string
  name: string
}

interface ICategoryTabsProps {
  tabs: ICategoryTab[]
  selected: string
  onSelect: (slug: string) => void
  ariaLabel: string
}

/**
 * Thanh chọn danh mục dạng "chip" cuộn ngang trên 1 hàng — co giãn tốt khi có
 * hàng chục danh mục: không xuống dòng, có fade + nút mũi tên 2 mép (desktop),
 * và tự cuộn chip đang chọn vào tầm nhìn.
 */
export function CategoryTabs({ tabs, selected, onSelect, ariaLabel }: ICategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  // Cập nhật trạng thái mũi tên theo scroll + resize và khi số tab thay đổi
  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, tabs.length])

  // Cuộn chip đang chọn vào giữa tầm nhìn (không kéo trang theo chiều dọc)
  useEffect(() => {
    const active = scrollRef.current?.querySelector<HTMLElement>(`[data-slug="${selected}"]`)
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const scrollByDir = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })
  }

  return (
    <div className="relative min-w-0 flex-1">
      {/* Mép trái: fade + nút cuộn (chỉ hiện khi cuộn được sang trái) */}
      {canScrollLeft && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#3a3a3a] to-transparent" />
          <button
            type="button"
            aria-label="Previous categories"
            onClick={() => scrollByDir(-1)}
            className="absolute left-0 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#262626] text-landing-brass-light ring-1 ring-landing-brass/30 transition-colors hover:bg-[#303030] sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        role="tablist"
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isActive = selected === tab.slug
          return (
            <button
              key={tab.slug}
              data-slug={tab.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.slug)}
              className={`snap-start shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[12px] uppercase tracking-[.12em] transition-colors ${
                isActive
                  ? 'border-landing-brass bg-landing-brass/20 text-grad-accent font-semibold'
                  : 'border-landing-brass/25 text-muted-gold hover:border-landing-brass/50 hover:text-landing-brass-light'
              }`}
            >
              {capitalizeFirstLetter(tab.name)}
            </button>
          )
        })}
      </div>

      {/* Mép phải: fade + nút cuộn (chỉ hiện khi còn cuộn được sang phải) */}
      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#3a3a3a] to-transparent" />
          <button
            type="button"
            aria-label="Next categories"
            onClick={() => scrollByDir(1)}
            className="absolute right-0 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#262626] text-landing-brass-light ring-1 ring-landing-brass/30 transition-colors hover:bg-[#303030] sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
