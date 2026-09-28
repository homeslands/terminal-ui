import { useTranslation } from 'react-i18next'

import { DINING_COURSES } from '@/constants'

interface IDiningCourseFilterProps {
  /** key của phần ăn đang chọn, hoặc null = tất cả */
  selected: string | null
  onSelect: (key: string | null) => void
  /** số catalog khớp với từng phần ăn, dùng để hiển thị badge & làm mờ phần rỗng */
  countByCourse: Record<string, number>
}

/**
 * Bộ lọc "phần ăn" (Catalog) cấp cao — 4 thẻ hình: Khai vị, Món chính,
 * Tráng miệng, Đồ uống. Nhấn vào một thẻ để lọc danh mục + món theo phần ăn đó;
 * nhấn lại thẻ đang chọn để bỏ lọc.
 */
export function DiningCourseFilter({ selected, onSelect, countByCourse }: IDiningCourseFilterProps) {
  const { t } = useTranslation('menu')

  return (
    <div className="mx-auto mb-10 w-full max-w-5xl">
      <div className="mb-5 flex items-center justify-center gap-3">
        <span className="menu-rule-left h-px w-8 md:w-12" />
        <span className="text-grad-accent text-[11px] font-medium uppercase tracking-[.3em]">
          {t('menu.diningCourse.choose')}
        </span>
        <span className="menu-rule-right h-px w-8 md:w-12" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
        {DINING_COURSES.map((course) => {
          const isActive = selected === course.key
          const count = countByCourse[course.key] ?? 0
          const isEmpty = count === 0
          return (
            <button
              key={course.key}
              type="button"
              aria-pressed={isActive}
              disabled={isEmpty}
              onClick={() => onSelect(isActive ? null : course.key)}
              className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-landing-brass ring-2 ring-landing-brass/60'
                  : 'border-landing-brass/25 hover:border-landing-brass/60'
              } ${isEmpty ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <div className="relative aspect-[4/3] w-full">
                <img
                  src={course.image}
                  alt={t(course.labelKey)}
                  loading="lazy"
                  className={`h-full w-full object-cover transition-transform duration-500 ${
                    isEmpty ? '' : 'group-hover:scale-105'
                  }`}
                />
                {/* Lớp phủ tối để chữ nổi */}
                <div
                  className={`absolute inset-0 ${isActive ? 'course-overlay-active' : 'course-overlay'}`}
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 py-2.5">
                  <span
                    className={`font-script line-clamp-1 text-2xl leading-none sm:text-3xl ${
                      isActive ? 'text-grad-accent' : 'text-landing-brass-light'
                    }`}
                  >
                    {t(course.labelKey)}
                  </span>
                  {!isEmpty && (
                    <span className="shrink-0 rounded-full border border-landing-brass/40 bg-landing-brass/15 px-2 py-0.5 text-[10px] tabular-nums text-landing-brass-light">
                      {count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
