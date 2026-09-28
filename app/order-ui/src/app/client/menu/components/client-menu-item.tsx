import moment from 'moment'
import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { IMenuItem, IOrderItem, IProduct } from '@/types'
import { publicFileURL, ROUTE } from '@/constants'
import { Button } from '@/components/ui'
import { ProductImage } from '@/assets/images'
import { formatCurrency, showToast } from '@/utils'
import { ClientAddToCartDialog } from '@/components/app/dialog'
import { useIsMobile } from '@/hooks'
import { PromotionTag } from '@/components/app/badge'
import { OrderFlowStep, useOrderFlowStore, useUserStore } from '@/stores'

interface IClientMenuItemProps {
  item: IMenuItem
  /** 'card' = lưới thẻ dọc, 'classic' = thẻ ngang, ảnh nền */
  variant?: 'card' | 'classic'
}

export function ClientMenuItem({ item, variant = 'card' }: IClientMenuItemProps) {
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const isMobile = useIsMobile()
  // 🔥 Sử dụng Order Flow Store
  const {
    currentStep,
    isHydrated,
    orderingData,
    initializeOrdering,
    addOrderingItem,
    setCurrentStep,
  } = useOrderFlowStore()
  const { userInfo } = useUserStore()

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

  // 🚀 Đảm bảo đang ở ORDERING phase khi component mount
  useEffect(() => {
    if (isHydrated) {
      if (currentStep !== OrderFlowStep.ORDERING) {
        setCurrentStep(OrderFlowStep.ORDERING)
      }

      if (!orderingData) {
        initializeOrdering()
        return
      }

      if (userInfo?.slug && !orderingData.owner?.trim()) {
        initializeOrdering()
      }
    }
  }, [isHydrated, currentStep, orderingData, userInfo?.slug, setCurrentStep, initializeOrdering])

  const handleAddToCart = (product: IMenuItem) => {
    if (!product?.product?.variants || product?.product?.variants.length === 0 || !isHydrated) return

    if (currentStep !== OrderFlowStep.ORDERING) {
      setCurrentStep(OrderFlowStep.ORDERING)
    }

    if (!orderingData) {
      initializeOrdering()
      return
    }

    if (userInfo?.slug && !orderingData.owner?.trim()) {
      initializeOrdering()
    }

    const orderItem: IOrderItem = {
      id: `item_${moment().valueOf()}_${Math.random().toString(36).substr(2, 9)}`,
      slug: product?.product?.slug,
      image: product?.product?.image,
      name: product?.product?.name,
      quantity: 1,
      size: product?.product?.variants[0]?.size?.name,
      allVariants: product?.product?.variants,
      variant: product?.product?.variants[0],
      originalPrice: product?.product?.variants[0]?.price,
      productSlug: product?.product?.slug,
      description: product?.product?.description,
      isLimit: product?.product?.isLimit,
      isGift: product?.product?.isGift,
      promotion: product?.promotion ? product?.promotion : null,
      promotionValue: product?.promotion ? product?.promotion?.value : 0,
      note: '',
    }

    try {
      addOrderingItem(orderItem)
      showToast(tToast('toast.addSuccess'))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Error adding item to cart:', error)
    }
  }

  const range = getPriceRange(item.product.variants)
  const hasPrice = item.product.variants.length > 0 && !!range
  const isAvailable = !item.isLocked && (item.currentStock > 0 || !item.product.isLimit)
  const imageUrl = item.product.image ? `${publicFileURL}/${item.product.image}` : ProductImage

  // ───────────────────── Kiểu cũ: thẻ ngang, ảnh nền phủ kín ─────────────────────
  if (variant === 'classic') {
    return (
      <div className="group relative flex h-28 flex-row overflow-hidden rounded-xl ring-1 ring-inset ring-landing-brass/15 transition-all duration-300 hover:ring-landing-brass/35 active:scale-[.99]">
        {/* Ảnh nền */}
        <NavLink to={`${ROUTE.CLIENT_MENU_ITEM}?slug=${item.slug}`} className="absolute inset-0 z-0">
          <img
            src={imageUrl}
            alt={item.product.name}
            className="menu-item-img-classic h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </NavLink>
        {/* Lớp phủ tối dần sang phải để chữ + giá nổi bật */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-black/35 via-black/55 to-black/65 transition-colors duration-300 group-hover:to-black/55" />

        {item.promotion && item.promotion.value > 0 && (
          <div className="absolute left-2 top-2 z-10">
            <PromotionTag promotion={item.promotion} />
          </div>
        )}

        {/* Tên + mô tả */}
        <NavLink
          // to={`${ROUTE.CLIENT_MENU_ITEM}?slug=${item.slug}`}
          to={'#'}
          className="relative z-10 flex min-w-0 flex-1 flex-col justify-center px-4 py-4 md:px-6 md:py-5"
        >
          <h3 className="text-grad-primary font-display text-fluid-menu-item font-bold uppercase leading-tight tracking-[.05em] line-clamp-2">
            {item.product.name}
          </h3>
          {item.product.description && (
            <p className="mt-1 text-fluid-menu-item-desc leading-snug text-landing-copper/85 line-clamp-2">
              {item.product.description}
            </p>
          )}
          {item.product.isLimit && (
            <span className="mt-1 text-[11px] text-landing-brass/90">
              {t('menu.amount')} {item.currentStock}/{item.defaultStock}
            </span>
          )}
        </NavLink>

        {/* Giá + thêm vào giỏ */}
        <div className="relative z-10 flex shrink-0 flex-col items-end justify-center gap-2 px-3 py-4 md:px-5">
          {isAvailable ? (
            <>
              {hasPrice ? (
                item?.promotion?.value > 0 ? (
                  <div className="flex flex-col items-end leading-none">
                    <span className="text-[11px] text-landing-quartz/50 line-through">
                      {formatCurrency(range.min)}
                    </span>
                    <span className="text-grad-primary text-fluid-menu-item font-black tabular-nums leading-none">
                      {formatCurrency(range.min * (1 - item.promotion.value / 100))}
                    </span>
                  </div>
                ) : (
                  <span className="text-grad-primary text-fluid-menu-item font-black tabular-nums tracking-wide leading-none">
                    {formatCurrency(range.min)}
                  </span>
                )
              ) : (
                <span className="text-xs font-semibold text-landing-brass">
                  {t('menu.contactForPrice')}
                </span>
              )}

              {isMobile ? (
                <Button
                  onClick={() => handleAddToCart(item)}
                  className="h-9 w-full whitespace-nowrap rounded-full px-4 text-sm hidden"
                >
                  {t('menu.addToCart')}
                </Button>
              ) : (
                <ClientAddToCartDialog
                  product={item}
                  trigger={
                    <Button className="h-9 w-full whitespace-nowrap rounded-full px-4 text-sm hidden">
                      {t('menu.addToCart')}
                    </Button>
                  }
                />
              )}
            </>
          ) : (
            <span className="text-xs font-semibold text-landing-quartz/70">
              {t('menu.outOfStock')}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="group flex flex-row overflow-hidden rounded-xl bg-landing-iron-2/40 ring-1 ring-inset ring-landing-brass/15
                 backdrop-blur-sm sm transition-all duration-300 hover:ring-landing-brass/35 active:scale-[.99] sm:flex-col"
    >
      {/* Image — left on mobile, top on larger screens */}
      {/* Gradient nền (fallback khi ảnh lỗi) qua class .menu-item-img-bg */}
      <NavLink
        // to={`${ROUTE.CLIENT_MENU_ITEM}?slug=${item.slug}`}
        to={'#'}
        className="menu-item-img-bg relative w-28 h-28 shrink-0 overflow-hidden sm:h-40 lg:h-48 sm:w-full"
      >

        <img
          src={imageUrl}
          alt={item.product.name}
          className="menu-item-img relative h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
        />
        {item.promotion && item.promotion.value > 0 && (
          <div className="absolute left-2 top-2 z-10">
            <PromotionTag promotion={item.promotion} />
          </div>
        )}
      </NavLink>

      {/* Content — name on top, price + add to cart on bottom */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3">
        <NavLink 
          // to={`${ROUTE.CLIENT_MENU_ITEM}?slug=${item.slug}`} 
          to={'#'}
          className="min-w-0"
        >
          <h3 className="font-display text-sm font-semibold leading-snug tracking-[.02em] text-landing-quartz line-clamp-1">
            {item.product.name}
          </h3>
          {item.product.description && (
            <p className="mt-1 text-xs leading-snug text-landing-copper/80 line-clamp-1">
              {item.product.description}
            </p>
          )}
          {item.product.isLimit && (
            <span className="mt-1 inline-block text-[11px] text-landing-brass/80">
              {t('menu.amount')} {item.currentStock}/{item.defaultStock}
            </span>
          )}
        </NavLink>

        {/* Price + add to cart */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-24">
            {isAvailable ? (
              hasPrice ? (
                item?.promotion?.value > 0 ? (
                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] text-landing-quartz/40 line-through">
                      {formatCurrency(range.min)}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-landing-brass-light">
                      {formatCurrency(range.min * (1 - item.promotion.value / 100))}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-bold tabular-nums text-landing-brass-light">
                    {formatCurrency(range.min)}
                  </span>
                )
              ) : (
                <span className="text-xs font-semibold text-landing-brass">
                  {t('menu.contactForPrice')}
                </span>
              )
            ) : (
              <span className="text-xs font-semibold text-landing-quartz/55">
                {t('menu.outOfStock')}
              </span>
            )}
          </div>

          {isAvailable &&
            (isMobile ? (
              <Button
                onClick={() => handleAddToCart(item)}
                aria-label={t('menu.addToCart')}
                className="h-8 w-8 shrink-0 rounded-full p-0 [&_svg]:size-4 hidden"
              >
                <Plus />
              </Button>
            ) : (
              <ClientAddToCartDialog
                  product={item}
                  trigger={
                    <Button className="h-9 w-full whitespace-nowrap rounded-full px-4 text-sm hidden">
                      {t('menu.addToCart')}
                    </Button>
                  }
                />
            ))}
        </div>
      </div>
    </div>
  )
}
