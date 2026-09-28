import { NavLink, useLocation } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

import {
  DropdownClientHeader,
  SelectBranchDropdown,
  SettingsDropdown,
} from '@/components/app/dropdown'
import { useAuthStore, useOrderFlowStore } from '@/stores'
import { ROUTE } from '@/constants'
import { Button } from '@/components/ui'
import { NavigationSheet } from '@/components/app/sheet'
import { useIsMobile } from '@/hooks'
import { ClientNotificationPopover } from '@/components/app/popover'
import { TerminalLogo } from '@/assets/images'
import { cn } from '@/lib'

// News & events nav entry hidden per request — kept; flip to true to restore.
const SHOW_NEWS_NAV = false

export function ClientHeader() {
  const { t } = useTranslation('sidebar')
  const isMobile = useIsMobile()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { getCartItems } = useOrderFlowStore()
  const cartItems = getCartItems()
  const [isScrolled, setIsScrolled] = useState(false)
  const location = useLocation()
  // The transparent bar only works over the home hero's dark brick wall.
  // Everywhere else it must stay solid so it never shows the white page.
  const isHome = location.pathname === ROUTE.HOME
  const solid = isScrolled || !isHome

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 w-full transition-all duration-300',
        isMobile && 'pt-[env(safe-area-inset-top)]',
        solid ? 'bg-landing-iron/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      )}
    >
      {/* Brass underline — fades in whenever the bar is solid */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-px transition-opacity duration-300',
          solid ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          background: 'linear-gradient(90deg, transparent, rgb(var(--landing-brass)), transparent)',
        }}
      />
      <div className="transition-all duration-300">
        <div className="container mx-auto px-4 md:px-6">
          <div
            className={cn(
              'flex items-center justify-between transition-all duration-300',
              isScrolled ? 'py-3 md:py-3.5' : 'py-5 md:py-6'
            )}
          >
            {/* Left content: Menu toggle + Wordmark */}
            <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
              <NavigationSheet />
              <NavLink to={ROUTE.HOME} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <img
                  src={TerminalLogo}
                  alt="THE TERMINAL"
                  className="h-8 w-8 object-cover rounded-full md:h-10 md:w-10"
                />
                <span className="flex flex-col leading-tight">
                  <span className="text-grad-accent font-bold tracking-[.28em] text-[13px]">
                    THE TERMINAL
                  </span>
                  <span className="hidden md:block text-landing-quartz/65 text-[10px] tracking-[.32em] uppercase">
                    CAFE · EUROPEAN KITCHEN
                  </span>
                </span>
              </NavLink>
            </div>

            {/* Center content: Desktop nav links */}
            <nav className="hidden xl:flex items-center justify-center gap-6 lg:gap-8 flex-1 px-6">
              <NavLink
                to={ROUTE.HOME}
                className={({ isActive }) =>
                  cn(
                    'nav-link text-[11px] md:text-[12px] uppercase font-medium tracking-[.22em] transition-colors duration-300',
                    'text-landing-quartz hover:text-landing-brass-light',
                    isActive && 'text-landing-brass-light'
                  )
                }
              >
                {t('header.home')}
              </NavLink>
              <NavLink
                to={ROUTE.ABOUT}
                className={({ isActive }) =>
                  cn(
                    'nav-link text-[11px] md:text-[12px] uppercase font-medium tracking-[.22em] transition-colors duration-300',
                    'text-landing-quartz hover:text-landing-brass-light',
                    isActive && 'text-landing-brass-light'
                  )
                }
              >
                {t('header.aboutUs')}
              </NavLink>
              <NavLink
                to={ROUTE.CLIENT_BOOKING}
                className={({ isActive }) =>
                  cn(
                    'nav-link text-[11px] md:text-[12px] uppercase font-medium tracking-[.22em] transition-colors duration-300',
                    'text-landing-quartz hover:text-landing-brass-light',
                    isActive && 'text-landing-brass-light'
                  )
                }
              >
                {t('header.booking')}
              </NavLink>
              <NavLink
                to={ROUTE.CLIENT_MENU}
                className={({ isActive }) =>
                  cn(
                    'nav-link text-[11px] md:text-[12px] uppercase font-medium tracking-[.22em] transition-colors duration-300',
                    'text-landing-quartz hover:text-landing-brass-light',
                    isActive && 'text-landing-brass-light'
                  )
                }
              >
                {t('header.menu')}
              </NavLink>
              <NavLink
                to={ROUTE.CLIENT_GIFT_CARD}
                className={({ isActive }) =>
                  cn(
                    'nav-link text-[11px] md:text-[12px] uppercase font-medium tracking-[.22em] transition-colors duration-300',
                    'text-landing-quartz hover:text-landing-brass-light hidden',
                    isActive && 'text-landing-brass-light'
                  )
                }
              >
                {t('header.giftCard')}
              </NavLink>
              {!isAuthenticated() && (
                <NavLink
                  to={ROUTE.CLIENT_ORDERS_PUBLIC}
                  className={({ isActive }) =>
                    cn(
                      'nav-link text-[11px] md:text-[12px] uppercase font-medium tracking-[.22em] transition-colors duration-300',
                      'text-landing-quartz hover:text-landing-brass-light hidden',
                      isActive && 'text-landing-brass-light'
                    )
                  }
                >
                  {t('header.myOrders')}
                </NavLink>
              )}
              {SHOW_NEWS_NAV && (
                <NavLink
                  to={ROUTE.CLIENT_NEWS}
                  className={({ isActive }) =>
                    cn(
                      'nav-link text-[11px] md:text-[12px] uppercase font-medium tracking-[.22em] transition-colors duration-300',
                      'text-landing-quartz hover:text-landing-brass-light',
                      isActive && 'text-landing-brass-light'
                    )
                  }
                >
                  {t('header.news')}
                </NavLink>
              )}
            </nav>

            {/* Right content: Actions */}
            <div className="flex items-center justify-end gap-1 md:gap-2 flex-shrink-0 text-white">
                {/* Cart - hidden on mobile */}
                {!isMobile && (
                  <NavLink
                    to={ROUTE.CLIENT_CART}
                    className="relative flex items-center hidden"
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        'relative transition-colors duration-200',
                        'hover:bg-primary/10 hover:text-primary',
                      )}
                      size="sm"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {cartItems?.orderItems?.length ? (
                        <span className="absolute flex items-center justify-center w-4 h-4 text-xs font-bold text-landing-iron transform translate-x-1/2 -translate-y-1/2 rounded-full top-1 right-1 bg-landing-brass-light">
                          {cartItems.orderItems.reduce((total, item) => total + item.quantity, 0)}
                        </span>
                      ) : null}
                    </Button>
                  </NavLink>
                )}
                {/* Notifications */}
                {
                <div className="hidden">
                  <ClientNotificationPopover />
                </div>}
                {/* Settings */}
                <SettingsDropdown />

                {/* Select branch */}
                <SelectBranchDropdown />

              {/* Login + Profile */}
              <DropdownClientHeader />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
