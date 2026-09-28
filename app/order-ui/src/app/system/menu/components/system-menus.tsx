import { useTranslation } from 'react-i18next'
import { Gift } from 'lucide-react'

import { SkeletonMenuList } from '@/components/app/skeleton'
import { IMenuItem, IProduct, ISpecificMenu } from '@/types'
import { publicFileURL } from '@/constants'
import { Button, useSidebar } from '@/components/ui'
import { ProductImage } from '@/assets/images'
import { formatCurrency, showErrorToastMessage, showToast } from '@/utils'
import { useCatalogs, useIsMobile } from '@/hooks'
import { useTableSessions } from '@/hooks/useTableSessions'
// TODO: SystemAddToCartDrawer still uses useOrderFlowStore — needs migration if drawer flow is exercised.
import { SystemAddToCartDrawer } from '@/components/app/drawer'
import { StaffPromotionTag } from '@/components/app/badge'
import { formatVnd } from '@/data/staff-data'
import type { OrderItem } from '@/types/session'
import { CustomPriceDialog } from '@/components/staff/custom-price-dialog'

interface IMenuProps {
  menu?: ISpecificMenu
  isLoading?: boolean
  activeTableSlug: string | null
}

export default function SystemMenus({ menu, isLoading, activeTableSlug }: IMenuProps) {
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const isMobile = useIsMobile()
  const { state } = useSidebar()
  const { data: catalogs, isLoading: isLoadingCatalog } = useCatalogs()
  const { addItem } = useTableSessions()

  const menuItems = menu?.menuItems?.sort((a, b) => {
    // Đưa các mục không bị khóa lên trước
    if (a.isLocked !== b.isLocked) {
      return Number(a.isLocked) - Number(b.isLocked);
    }

    // Coi mục với currentStock = null là "còn hàng" khi isLimit = false
    const aInStock = (a.currentStock !== 0 && a.currentStock !== null) || !a.product.isLimit;
    const bInStock = (b.currentStock !== 0 && b.currentStock !== null) || !b.product.isLimit;

    // Đưa các mục còn hàng lên trước
    if (aInStock !== bInStock) {
      return Number(bInStock) - Number(aInStock); // Còn hàng trước hết hàng
    }
    if (a.product.catalog.name !== b.product.catalog.name) {
      return a.product.catalog.name.localeCompare(b.product.catalog.name)
    }
    return 0;
  });

  const handleAddToCart = (product: IMenuItem) => {
    if (!activeTableSlug) {
      // No table selected — surface a localized error and bail.
      showErrorToastMessage(t('menu.noSelectedTable'))
      return
    }
    // Mirror staff guard: skip products without variants and without custom-price support.
    if (!product?.product?.isCustomPrice && (!product?.product?.variants || product?.product?.variants.length === 0)) {
      return
    }

    // TODO: Default to first variant + skip SystemAddToCartDrawer for now.
    // If the drawer (variant picker) flow needs to be re-enabled, it must be
    // migrated off useOrderFlowStore and onto useTableSessions.addItem first.
    const firstVariant = product?.product?.variants?.[0]
    const isCustomPrice = !!product?.product?.isCustomPrice
    const original = isCustomPrice ? 0 : (firstVariant?.price ?? 0)
    const promo = product?.promotion ?? null
    const promoValue = promo?.value ?? 0
    // Match MenuPanel: treat promotion.value as a percentage discount.
    const priceNum = promo && !isCustomPrice
      ? Math.max(0, Math.round(original * (1 - promoValue / 100)))
      : original

    const orderItem: OrderItem = {
      menuItemId: product.slug,
      name: product.product.name,
      priceNum,
      price: isCustomPrice ? '' : formatVnd(priceNum),
      quantity: 1,
      note: '',
      variantSlug: firstVariant?.slug ?? '',
      productSlug: product.product.slug,
      originalPrice: original,
      promotion: promo ? { slug: promo.slug, value: promoValue } : null,
      vatRate: product.product.vatRate ?? 0,
      isCustomPrice,
    }

    const added = addItem(activeTableSlug, orderItem)
    if (added) showToast(tToast('toast.addSuccess'))
  };

  const getPriceRange = (variants: IProduct['variants']) => {
    if (!variants || variants.length === 0) return null

    const prices = variants.map((v) => v.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    return {
      min: minPrice,
      max: maxPrice,
      isSinglePrice: minPrice === maxPrice,
    }
  }

  if (isLoading || isLoadingCatalog) {
    return (
      <div className={`grid grid-cols-2 w-full sm:w-[90%] xl:w-full gap-3 lg:grid-cols-3 xl:grid-cols-4`}>
        {[...Array(8)].map((_, index) => (
          <SkeletonMenuList key={index} />
        ))}
      </div>
    )
  }

  if (!menuItems || menuItems.length === 0) {
    return <p className="text-center">{t('menu.noData')}</p>
  }

  const groupedItems = catalogs?.result?.map(catalog => ({
    catalog,
    items: menuItems.filter(item => item.product.catalog.slug === catalog.slug),
  })) || [];
  groupedItems.sort((a, b) => b.items.length - a.items.length)

  return (
    <div className={`flex flex-col gap-4 pr-2`}>
      {groupedItems.map((group, index) => (
        group.items.length > 0 &&
        <div className='flex flex-col mt-4' key={index}>
          <div className='text-lg font-extrabold uppercase primary-highlight'>{group.catalog.name}</div>
          <div className={`grid gap-2 pb-8 mt-2 w-full ${state === 'collapsed' ? 'grid-cols-3 md:grid-cols-3 gap-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 pr-0 sm:pr-9 xl:pr-0'}`} key={index}>
            {group.items.map((item) => (
              <div
                key={item.slug}
                className="flex flex-col justify-between rounded-xl border min-h-[10rem] xl:min-h-[15rem] hover:border-pos-gold/40 transition-colors duration-200"
              >
                {/* Image Section with Discount Tag */}
                <div className="flex flex-col gap-0">
                  <div className='relative'>
                    {item.product.image ? (
                      <>
                        <img
                          src={`${publicFileURL}/${item.product.image}`}
                          alt={item.product.name}
                          className="object-cover w-full h-[6rem] xl:h-[8rem] rounded-xl p-1.5"
                        />
                        {item.promotion && item.promotion.value > 0 && (
                          <StaffPromotionTag promotion={item.promotion} />
                        )}
                      </>
                    ) : (
                      <div className="relative">
                        <img
                          src={ProductImage}
                          alt="Product Image"
                          className="object-cover w-full h-[6rem] xl:h-[8rem] rounded-xl p-1.5"
                        />
                        {item.promotion && item.promotion.value > 0 && (
                          <StaffPromotionTag promotion={item.promotion} />
                        )}
                      </div>
                    )}
                    {item?.product?.isGift && (
                      <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        <Gift className="w-2.5 h-2.5" />
                        Quà
                      </div>
                    )}
                  </div>
                  <div className='flex flex-col px-2'>
                    <span className="text-sm font-bold xl:text-[18px] truncate line-clamp-1">
                      {item.product.name}
                    </span>
                    {/* <p className="text-xs text-gray-500 line-clamp-2">
                      {item.product.description}
                    </p> */}
                    <div className="flex gap-1 items-center">
                      <div className="flex flex-col w-full">
                        {item.product.isCustomPrice ? (
                          <span className="text-sm font-bold text-orange-500">
                            {t('menu.customPrice')}
                          </span>
                        ) : item.product.variants.length > 0 ? (
                          <div className="flex flex-col gap-1 justify-start items-start w-full">
                            <div className='flex flex-row gap-1 items-center w-full'>
                              {item?.promotion?.value > 0 ? (
                                <div className='flex flex-col justify-start items-start w-full'>
                                  <span className="text-[0.5rem] xl:text-xs line-through text-muted-foreground/70">
                                    {(() => {
                                      const range = getPriceRange(item.product.variants)
                                      if (!range) return formatCurrency(0)
                                      return range.isSinglePrice
                                        ? `${formatCurrency((range.min))}` : `${formatCurrency(range.min)}`
                                    })()}
                                  </span>
                                  <span className="text-sm font-bold sm:text-[0.8rem] xl:text-base text-primary">
                                    {(() => {
                                      const range = getPriceRange(item.product.variants)
                                      if (!range) return formatCurrency(0)
                                      return range.isSinglePrice
                                        ? `${formatCurrency((range.min) * (1 - item?.promotion?.value / 100))}` : `${formatCurrency(range.min * (1 - item?.promotion?.value / 100))}`
                                    })()}
                                  </span>
                                </div>) : (
                                <span className="text-sm font-bold sm:text-sm text-primary">
                                  {(() => {
                                    const range = getPriceRange(item.product.variants)
                                    if (!range) return formatCurrency(0)
                                    return range.isSinglePrice
                                      ? `${formatCurrency(range.min)}`
                                      : `${formatCurrency(range.min)}`
                                  })()}
                                </span>
                              )}
                            </div>
                            {item?.product?.isLimit && <span className="text-[0.5rem] text-muted-foreground">
                              {t('menu.amount')}
                              {item.currentStock}/{item.defaultStock}
                            </span>}
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-primary">
                            {t('menu.contactForPrice')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Section - More compact */}
                <div className="flex flex-1 flex-col justify-end space-y-1.5 p-2">
                  {!item.isLocked && (item.currentStock > 0 || !item?.product?.isLimit) ? (
                    <div>
                      {item.product.isCustomPrice ? (
                        // Custom-price items must prompt for a price — mirrors
                        // the staff MenuPanel behaviour. Without this the admin
                        // flow used to silently add the item at 0đ.
                        activeTableSlug ? (
                          <CustomPriceDialog
                            menuItemId={item.slug}
                            name={item.product.name}
                            variantSlug={item.product.variants?.[0]?.slug}
                            productSlug={item.product.slug}
                            vatRate={item.product.vatRate ?? 0}
                            onAdd={(payload) => {
                              const added = addItem(activeTableSlug, {
                                ...payload,
                                note: '',
                              } as OrderItem)
                              if (added) showToast(tToast('toast.addSuccess'))
                            }}
                            trigger={
                              <Button className="flex gap-1 justify-center items-center w-full text-xs text-white rounded-full shadow-none xl:text-sm">
                                {t('menu.addToCart')}
                              </Button>
                            }
                          />
                        ) : (
                          <Button
                            className="flex gap-1 justify-center items-center w-full text-xs text-white rounded-full shadow-none xl:text-sm"
                            onClick={() => showErrorToastMessage(t('menu.noSelectedTable'))}
                          >
                            {t('menu.addToCart')}
                          </Button>
                        )
                      ) : isMobile ? (
                        <SystemAddToCartDrawer product={item} />
                      ) : (
                        <Button
                          className="flex gap-1 justify-center items-center w-full text-xs text-white rounded-full shadow-none xl:text-sm"
                          onClick={() => handleAddToCart(item)}
                          disabled={!item.product?.variants || item.product.variants.length === 0}
                        >
                          {t('menu.addToCart')}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      className="flex justify-center items-center py-2 w-full text-sm font-semibold text-white bg-red-500 rounded-full"
                      disabled
                    >
                      {t('menu.outOfStock')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
