import { useEffect } from 'react'
import moment from 'moment';
import { CircleXIcon, MapPinIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Helmet } from "react-helmet";

import { useBranchStore, useMenuFilterStore, useUserStore } from '@/stores'
import { usePublicSpecificMenu, useSpecificMenu } from '@/hooks'
import { ClientMenus } from './components'
import ProductNameSearch from './components/product-name-search'
import PriceRangeFilter from './components/price-range-filter'
import { formatCurrency } from '@/utils';
import { FILTER_VALUE } from '@/constants';
import { IMenuFilter, ISpecificMenuRequest } from '@/types';

export default function ClientMenuPage() {
  const { t } = useTranslation(['menu'])
  const { t: tHelmet } = useTranslation('helmet')
  const { userInfo } = useUserStore()
  const { menuFilter, setMenuFilter } = useMenuFilterStore()
  const { branch } = useBranchStore()

  const mapMenuFilterToRequest = (filter: IMenuFilter): ISpecificMenuRequest => {
    return {
      date: filter.date,
      branch: filter.branch,
      catalog: filter.catalog,
      productName: filter.productName,
      minPrice: filter.minPrice,
      maxPrice: filter.maxPrice,
      // Chỉ gửi khi user chọn filter tương ứng — không gửi false để tránh query thừa
      ...(filter.isTopSell ? { isTopSell: true } : {}),
      ...(filter.isNewProduct ? { isNewProduct: true } : {}),
      slug: filter.menu,
    }
  }

  const hasUser = !!userInfo?.slug

  const { data: specificMenuData, isPending: specificMenuPending } =
    useSpecificMenu(mapMenuFilterToRequest(menuFilter), hasUser)

  const { data: publicSpecificMenuData, isPending: publicSpecificMenuPending } =
    usePublicSpecificMenu(mapMenuFilterToRequest(menuFilter), !hasUser)


  const specificMenu = userInfo?.slug ? specificMenuData : publicSpecificMenuData
  const isPending = userInfo?.slug ? specificMenuPending : publicSpecificMenuPending

  useEffect(() => {
    setMenuFilter(prev => {
      const next = { ...prev }
      let changed = false

      // sync branch
      if (branch?.slug && prev.branch !== branch.slug) {
        next.branch = branch.slug
        changed = true
      }

      // sync date
      const today = moment().format('YYYY-MM-DD')
      if (prev.date !== today) {
        next.date = today
        changed = true
      }

      return changed ? next : prev
    })
  }, [branch?.slug, setMenuFilter])

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuFilter(prev => ({ ...prev, minPrice: FILTER_VALUE.MIN_PRICE, maxPrice: FILTER_VALUE.MAX_PRICE, branch: branch?.slug }))
  }

  return (
    <section className="relative bg-landing-iron px-2 py-20 md:px-8 md:py-28">
      <Helmet>
        <meta charSet='utf-8' />
        <title>
          {tHelmet('helmet.menu.title')}
        </title>
        <meta name='description' content={tHelmet('helmet.menu.title')} />
      </Helmet>

      {/* Section header */}
      <header className="relative mx-auto mb-10 max-w-6xl text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="menu-rule-left h-px w-10 md:w-16" />
          <span className="text-grad-accent text-[11px] font-medium uppercase tracking-[.4em]">
            — {t('menu.billOfFare')} —
          </span>
          <span className="menu-rule-right h-px w-10 md:w-16" />
        </div>
        <h1 className="text-grad-primary font-display p-2 text-fluid-menu-title font-black uppercase leading-none tracking-tight">
          {t('menu.pageHeading')}
        </h1>
        <div className="brand-divider mx-auto mt-5 w-full max-w-menu-divider" />
        <p className="mx-auto mt-5 max-w-xl text-fluid-menu-subtitle font-italic italic text-landing-quartz/75">
          {t('menu.pageSubtitle')}
        </p>
        <div className="mt-4 flex items-center justify-center gap-1 text-xs text-landing-brass-light">
          <MapPinIcon className="h-4 w-4" />
          {branch ? `${branch.name} (${branch.address})` : t('menu.noData')}
        </div>
      </header>

      {/* Toolbar: search + price filter */}
      <div className="mx-auto mb-10 w-full max-w-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full flex-1">
            <ProductNameSearch />
          </div>
          <div className="w-full sm:w-48 sm:shrink-0">
            <PriceRangeFilter />
          </div>
        </div>
        {(menuFilter.minPrice > FILTER_VALUE.MIN_PRICE || menuFilter.maxPrice < FILTER_VALUE.MAX_PRICE) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="text-[11px] uppercase tracking-[.2em] text-landing-quartz/50">
              {t('menu.priceRangeFilter')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-landing-brass/40 bg-landing-brass/10 py-1 pl-3 pr-1.5 text-sm text-landing-brass-light">
              <span className="tabular-nums">
                {formatCurrency(menuFilter.minPrice)} - {formatCurrency(menuFilter.maxPrice)}
              </span>
              <button
                type="button"
                aria-label={t('menu.reset')}
                onClick={handleClear}
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-landing-brass/20 hover:text-landing-brass"
              >
                <CircleXIcon className="h-4 w-4" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Menus grouped by category with tabs */}
      <div className="relative mx-auto max-w-6xl">
        <ClientMenus menu={specificMenu?.result} isLoading={isPending} />
      </div>

      {/* Fine print */}
      <div className="relative mx-auto mt-12 flex max-w-6xl flex-col items-start justify-between gap-3 border-t border-landing-brass/15 pt-6 text-[12px] uppercase tracking-[.22em] text-landing-quartz/55 md:mt-16 md:flex-row md:items-center">
        <span>{t('menu.pricesInThousandVnd')}</span>
        <span className="text-landing-brass-light/80">{t('menu.serviceVatExclusive')}</span>
        <span>{t('menu.allergensAsk')}</span>
      </div>
    </section>
  )
}
