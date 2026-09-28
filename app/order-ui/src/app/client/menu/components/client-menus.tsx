import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, StretchHorizontal } from 'lucide-react'

import { SkeletonMenuList } from '@/components/app/skeleton'
import { ISpecificMenu } from '@/types'
import { ClientMenuItem } from './client-menu-item'
import { CategoryTabs } from './category-tabs'
import { DiningCourseFilter } from './dining-course-filter'
import { useCatalogs, useSwipe } from '@/hooks'
import { capitalizeFirstLetter } from '@/utils'
import { DINING_COURSES, getDiningCourse, getDiningCourseIndex } from '@/constants'
import { cn } from '@/lib/utils'

interface IClientMenuProps {
  menu: ISpecificMenu | undefined
  isLoading: boolean
}

export function ClientMenus({ menu, isLoading }: IClientMenuProps) {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { data: catalogs, isLoading: isLoadingCatalog } = useCatalogs()
  const [selectedTab, setSelectedTab] = useState<string>('all')
  // 'phần ăn' (Catalog) cấp cao đang chọn — null = tất cả phần ăn.
  // Mặc định mở trang menu ở phần "Khai vị" (starters) theo thứ tự thực đơn.
  const [selectedCourse, setSelectedCourse] = useState<string | null>(DINING_COURSES[0].key)
  // 'card' = lưới thẻ, 'classic' = thẻ ngang 2 cột
  const [viewMode, setViewMode] = useState<'card' | 'classic'>('classic')

  // Cuộn lên đầu khu vực menu mỗi khi đổi phần ăn hoặc danh mục.
  const menuTopRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Bỏ qua lần render đầu để không tự cuộn khi vừa mở trang.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    menuTopRef.current?.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [selectedTab, selectedCourse])

  const menuItems = useMemo(
    () =>
      menu?.menuItems?.slice().sort((a, b) => {
        // Đưa các mục không bị khóa lên trước
        if (a.isLocked !== b.isLocked) {
          return Number(a.isLocked) - Number(b.isLocked)
        }

        // Coi mục với currentStock = null là "còn hàng" khi isLimit = false
        const aInStock = (a.currentStock !== 0 && a.currentStock !== null) || !a.product.isLimit
        const bInStock = (b.currentStock !== 0 && b.currentStock !== null) || !b.product.isLimit

        // Đưa các mục còn hàng lên trước
        if (aInStock !== bInStock) {
          return Number(bInStock) - Number(aInStock)
        }

        return 0
      }) ?? [],
    [menu?.menuItems],
  )

  // Group items by catalog — load TOÀN BỘ catalog từ useCatalogs (kể cả catalog
  // chưa có món). Sắp xếp theo độ ưu tiên phần ăn: Khai vị → Món chính →
  // Tráng miệng → Đồ uống (theo thứ tự DINING_COURSES). Catalog không thuộc phần
  // ăn nào xếp xuống cuối. Cùng một phần ăn thì catalog nhiều món hơn lên trước,
  // catalog rỗng xuống cuối nhóm.
  const groupedItems = useMemo(() => {
    const groups =
      catalogs?.result?.map((catalog) => ({
        catalog,
        items: menuItems.filter((item) => item.product.catalog.slug === catalog.slug),
      })) ?? []
    return groups.sort((a, b) => {
      const courseDiff = getDiningCourseIndex(a.catalog.name) - getDiningCourseIndex(b.catalog.name)
      if (courseDiff !== 0) return courseDiff
      return b.items.length - a.items.length
    })
  }, [catalogs?.result, menuItems])

  // Số danh mục (có món) thuộc từng phần ăn — dùng cho badge & làm mờ thẻ rỗng.
  // Mỗi catalog chỉ tính vào đúng MỘT phần ăn (phần ăn đầu tiên khớp).
  const countByCourse = useMemo(() => {
    return DINING_COURSES.reduce<Record<string, number>>((acc, course) => {
      acc[course.key] = groupedItems.filter(
        (g) => getDiningCourse(g.catalog.name)?.key === course.key,
      ).length
      return acc
    }, {})
  }, [groupedItems])

  // Lọc danh mục theo phần ăn đang chọn (mỗi catalog thuộc đúng một phần ăn);
  // null = tất cả
  const courseGroupedItems = useMemo(() => {
    if (!selectedCourse) return groupedItems
    return groupedItems.filter((g) => getDiningCourse(g.catalog.name)?.key === selectedCourse)
  }, [groupedItems, selectedCourse])

  // Điều hướng phần ăn bằng cách lướt (tablet/mobile). Chỉ tính các phần ăn còn
  // món (count > 0) theo thứ tự thực đơn. Khi đang xem toàn bộ menu
  // (selectedCourse = null) coi như đứng trước phần ăn đầu tiên.
  // delta = +1 (lướt sang phải → phần ăn kế tiếp), -1 (lướt sang trái → phần ăn trước).
  const navigateCourse = (delta: number) => {
    const availableCourses = DINING_COURSES.filter(
      (c) => (countByCourse[c.key] ?? 0) > 0,
    ).map((c) => c.key)
    const currentIndex = selectedCourse ? availableCourses.indexOf(selectedCourse) : -1
    const nextIndex = currentIndex - delta
    if (nextIndex < 0 || nextIndex >= availableCourses.length) return
    setSelectedCourse(availableCourses[nextIndex])
    setSelectedTab('all')
  }

  // Lướt sang phải → phần ăn kế tiếp; lướt sang trái → phần ăn trước đó.
  const swipeHandlers = useSwipe({
    onSwipeRight: () => navigateCourse(1),
    onSwipeLeft: () => navigateCourse(-1),
  })

  if (isLoading || isLoadingCatalog) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
        {[...Array(8)].map((_, index) => (
          <SkeletonMenuList key={index} />
        ))}
      </div>
    )
  }

  if (!menuItems || menuItems.length === 0) {
    return <p className="text-center text-landing-quartz/70">{t('menu.noData')}</p>
  }

  if (groupedItems.length === 0) {
    return <p className="text-center text-landing-quartz/70">{tCommon('common.noData')}</p>
  }

  // Khi đổi phần ăn, danh mục đang chọn có thể không còn thuộc phần ăn mới
  const tabExistsInCourse =
    selectedTab === 'all' || courseGroupedItems.some((g) => g.catalog.slug === selectedTab)
  const activeTab = tabExistsInCourse ? selectedTab : 'all'

  // Tab "tất cả" đầu danh sách đổi theo ngữ cảnh:
  // - Đang trong một phần ăn (Khai vị/Món chính/…) → nhãn = tên phần ăn đó
  //   (vd "Khai vị"), bấm vào = xem mọi danh mục trong phần ăn.
  // - Xem toàn bộ menu (không chọn phần ăn) → bỏ tab này, dùng nút "Tất cả"
  //   riêng bên phải để bật/tắt.
  const currentCourse = DINING_COURSES.find((c) => c.key === selectedCourse)
  const tabs = currentCourse
    ? [{ slug: 'all', name: t(currentCourse.labelKey) }, ...courseGroupedItems.map((g) => g.catalog)]
    : courseGroupedItems.map((g) => g.catalog)
  // Nút "Tất cả" (toàn bộ menu) đang bật khi không lọc theo phần ăn nào và đang
  // hiển thị mọi danh mục.
  const isAllActive = selectedCourse === null && activeTab === 'all'
  const visibleGroups =
    activeTab === 'all'
      ? courseGroupedItems
      : courseGroupedItems.filter((g) => g.catalog.slug === activeTab)

  const handleSelectCourse = (key: string | null) => {
    setSelectedCourse(key)
    setSelectedTab('all')
  }

  // Nút "Tất cả" bên phải: bỏ lọc phần ăn để hiển thị toàn bộ menu.
  const handleSelectAll = () => {
    setSelectedCourse(null)
    setSelectedTab('all')
  }

  return (
    <div ref={menuTopRef} className="flex flex-col sm:gap-8 lg:gap-16 scroll-mt-16 lg:scroll-mt-20">
      {/* Phần ăn (Catalog) cấp cao — Khai vị / Món chính / Tráng miệng / Đồ uống */}
      <DiningCourseFilter
        selected={selectedCourse}
        onSelect={handleSelectCourse}
        countByCourse={countByCourse}
      />

      {/* Category tabs — sticky bám theo khi cuộn */}
      <div className="menu-sticky-fade sticky top-14 z-20 lg:top-16 z-10 -mx-2 px-2 py-3 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-menu-bar items-center gap-2">
          {/* Nút "Tất cả" — bỏ lọc phần ăn, hiển thị toàn bộ menu */}
          <button
            type="button"
            onClick={handleSelectAll}
            aria-pressed={isAllActive}
            className={cn('shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[12px] uppercase tracking-[.12em] transition-colors', {
              'border-landing-brass bg-landing-brass/20 text-grad-accent font-semibold': isAllActive,
              'border-landing-brass/25 text-muted-gold hover:border-landing-brass/50 hover:text-landing-brass-light': !isAllActive
            })}
          >
            {t('menu.all')}
          </button>

          <CategoryTabs
            tabs={tabs}
            selected={activeTab}
            onSelect={setSelectedTab}
            ariaLabel={t('menu.chooseDishCategory')}
          />

          {/* Nút đổi kiểu hiển thị menu: hiện icon của kiểu sẽ chuyển sang */}
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === 'card' ? 'classic' : 'card'))}
            title={viewMode === 'card' ? t('menu.viewMode.classic') : t('menu.viewMode.modern')}
            aria-label={viewMode === 'card' ? t('menu.viewMode.classic') : t('menu.viewMode.modern')}
            className="menu-icon-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-gold transition-colors hover:text-landing-brass-light"
          >
            {viewMode === 'card' ? (
              <StretchHorizontal className="h-5 w-5" />
            ) : (
              <LayoutGrid className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Category sections — vùng nhận thao tác lướt ngang để đổi phần ăn */}
      <div
        className="flex flex-col gap-16"
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchEnd={swipeHandlers.onTouchEnd}
      >
        {visibleGroups.length === 0 ? (
          <p className="text-center text-landing-quartz/70">
            {selectedCourse ? t('menu.diningCourse.noDishes') : tCommon('common.noData')}
          </p>
        ) : (
          visibleGroups.map((group) => (
            <section key={group.catalog.slug} className="w-full">
              {/* Cursive section header (railway menu style) */}
              <div className="mb-7 flex items-center gap-5">
                <span className="menu-section-rule-left h-px flex-1" />
                <span className="menu-section-title px-4 font-script text-fluid-menu-section leading-none text-landing-brass-light">
                  {capitalizeFirstLetter(group.catalog.name)}
                </span>
                <span className="menu-section-rule-right h-px flex-1" />
              </div>

              {group.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-landing-brass/20 py-8 text-center text-sm italic text-landing-quartz/50">
                  {t('menu.diningCourse.noDishes')}
                </p>
              ) : (
                <div
                  className={
                    viewMode === 'classic'
                      ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4'
                      : 'grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4'
                  }
                >
                  {group.items.map((item) => (
                    <ClientMenuItem item={item} key={item.slug} variant={viewMode} />
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  )
}