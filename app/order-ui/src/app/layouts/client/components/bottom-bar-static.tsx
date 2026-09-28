import { memo, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarCheck, Gift, Home, ShoppingCart, SquareMenu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib'
import { ROUTE } from '@/constants'
import { useOrderFlowStore } from '@/stores'

// TODO: set back to true to unhide the Cart and Gift tabs once their flows are complete.
const SHOW_CART_AND_GIFT = false

export const BottomBarStatic = memo(function BottomBarStatic() {
    const { t } = useTranslation('sidebar')
    const orderingItems = useOrderFlowStore((state) => state.orderingData?.orderItems)

    const cartItemCount = useMemo(
        () => orderingItems?.reduce((total, item) => total + item.quantity, 0) || 0,
        [orderingItems],
    )

    const tabBase =
        'inline-flex flex-col items-center justify-center gap-2 whitespace-nowrap rounded-full py-2 px-4 transition-all duration-300'
    const iconBase =
        'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300'
    const iconActive = 'text-landing-brass-light'
    const textActive = 'text-landing-brass-light font-bold'
    const iconInactive = 'text-landing-quartz/55'
    const textInactive = 'text-landing-quartz/70'

    return (
        <div
            className={cn(
                'fixed bottom-0 left-0 right-0 z-20',
                'w-full border-t border-landing-brass/30 bg-landing-iron shadow-inner shadow-black/30',
                'pb-[env(safe-area-inset-bottom)]',
            )}
        >
            <div
                className={cn(
                    'grid items-center justify-items-center h-20',
                    SHOW_CART_AND_GIFT ? 'grid-cols-5' : 'grid-cols-3',
                )}
            >
                {/* Home */}
                <NavLink
                    to={ROUTE.HOME}
                    className={({ isActive }) => cn(tabBase, isActive && textActive)}
                >
                    {({ isActive }) => (
                        <>
                            <div className={cn(iconBase, isActive ? iconActive : iconInactive)}>
                                <Home className="w-5 h-5" />
                            </div>
                            <span
                                className={cn('text-[0.7rem] leading-none', isActive ? textActive : textInactive)}
                            >
                                {t('bottombar.home')}
                            </span>
                        </>
                    )}
                </NavLink>

                {/* Menu */}
                <NavLink
                    to={ROUTE.CLIENT_MENU}
                    className={({ isActive }) => cn(tabBase, isActive && textActive)}
                >
                    {({ isActive }) => (
                        <>
                            <div className={cn(iconBase, isActive ? iconActive : iconInactive)}>
                                <SquareMenu className="w-5 h-5" />
                            </div>
                            <span
                                className={cn('text-[0.7rem] leading-none', isActive ? textActive : textInactive)}
                            >
                                {t('bottombar.menu')}
                            </span>
                        </>
                    )}
                </NavLink>

                {/* Booking */}
                <NavLink
                    to={ROUTE.CLIENT_BOOKING}
                    className={({ isActive }) => cn(tabBase, isActive && textActive)}
                >
                    {({ isActive }) => (
                        <>
                            <div className={cn(iconBase, isActive ? iconActive : iconInactive)}>
                                <CalendarCheck className="w-5 h-5" />
                            </div>
                            <span
                                className={cn('text-[0.7rem] leading-none', isActive ? textActive : textInactive)}
                            >
                                {t('bottombar.booking')}
                            </span>
                        </>
                    )}
                </NavLink>

                {/* Cart */}
                {SHOW_CART_AND_GIFT && (
                <NavLink
                    to={ROUTE.CLIENT_CART}
                    className={({ isActive }) => cn('relative', tabBase, isActive && textActive)}
                >
                    {({ isActive }) => (
                        <>
                            <div className={cn(iconBase, isActive ? iconActive : iconInactive)}>
                                <ShoppingCart className="w-5 h-5" />
                            </div>
                            <span
                                className={cn('text-[0.7rem] leading-none', isActive ? textActive : textInactive)}
                            >
                                {t('bottombar.cart')}
                            </span>

                            {cartItemCount > 0 && (
                                <span className="absolute top-1 -right-1 flex justify-center items-center w-6 h-6 text-xs font-semibold text-landing-iron rounded-full bg-landing-brass-light shadow-sm shadow-black/40">
                                    {cartItemCount}
                                </span>
                            )}
                        </>
                    )}
                </NavLink>
                )}

                {/* Gift */}
                {SHOW_CART_AND_GIFT && (
                <NavLink
                    to={ROUTE.CLIENT_GIFT_CARD}
                    className={({ isActive }) => cn(tabBase, isActive && textActive)}
                >
                    {({ isActive }) => (
                        <>
                            <div className={cn(iconBase, isActive ? iconActive : iconInactive)}>
                                <Gift className="w-5 h-5" />
                            </div>
                            <span
                                className={cn('text-[0.7rem] leading-none', isActive ? textActive : textInactive)}
                            >
                                {t('bottombar.giftCard')}
                            </span>
                        </>
                    )}
                </NavLink>
                )}
            </div>
        </div>
    )
})
