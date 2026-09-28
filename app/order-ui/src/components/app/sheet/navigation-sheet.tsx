import { Sheet, SheetContent, SheetTrigger } from '@/components/ui'
import { ROUTE } from '@/constants'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/stores'
import { TerminalLogo } from '@/assets/images'
import { cn } from '@/lib'

export default function NavigationSheet() {
  const { t } = useTranslation('sidebar')
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Menu className="w-6 h-6 md:w-7 md:h-7 cursor-pointer transition-colors text-landing-brass-light hover:text-landing-brass-light/80 hidden sm:block xl:hidden" />
      </SheetTrigger>
      <SheetContent
        className={cn(
          'w-[65%] sm:w-[50%] py-6 px-0',
          'brick-wall border-landing-brass/20',
          'backdrop-blur-sm'
        )}
        side="left"
      >
        {/* Dark gradient overlay over the brick wall */}
        <div
          className="absolute inset-0 -z-0 pointer-events-none backdrop-blur-[8px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(20,12,4,.9) 0%, rgba(15,10,4,.93) 60%, rgba(8,5,2,.98) 100%)',
          }}
        />
        <div className="relative z-10 flex flex-col h-full">
          {/* Header section */}
          <div className="px-6 pb-6">
            <div className="flex flex-col gap-2 leading-tight">
              <img
                src={TerminalLogo}
                alt="THE TERMINAL"
                className="h-9 w-9 self-start object-cover rounded-full"
              />
              <span className="text-grad-accent font-bold tracking-[.28em] text-[13px]">
                THE TERMINAL
              </span>
              <span className="text-landing-quartz/65 text-[9px] tracking-[.32em] uppercase">
                CAFE · EUROPEAN KITCHEN
              </span>
            </div>
            <div className="brand-divider mt-6" style={{ opacity: 0.3 }} />
          </div>

          {/* Navigation links */}
          <nav className="flex-1 flex flex-col gap-4 px-6 py-2">
            <NavLink
              to={ROUTE.HOME}
              className={({ isActive }) =>
                cn(
                  'text-landing-quartz font-display tracking-[.22em] uppercase transition-colors duration-300 py-2 border-b border-landing-brass/5',
                  'text-[14px] md:text-[16px] hover:text-landing-brass-light',
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
                  'text-landing-quartz font-display tracking-[.22em] uppercase transition-colors duration-300 py-2 border-b border-landing-brass/5',
                  'text-[14px] md:text-[16px] hover:text-landing-brass-light',
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
                  'text-landing-quartz font-display tracking-[.22em] uppercase transition-colors duration-300 py-2 border-b border-landing-brass/5',
                  'text-[14px] md:text-[16px] hover:text-landing-brass-light',
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
                  'text-landing-quartz font-display tracking-[.22em] uppercase transition-colors duration-300 py-2 border-b border-landing-brass/5',
                  'text-[14px] md:text-[16px] hover:text-landing-brass-light',
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
                  'text-landing-quartz font-display tracking-[.22em] uppercase transition-colors duration-300 py-2 border-b border-landing-brass/5',
                  'text-[14px] md:text-[16px] hover:text-landing-brass-light hidden',
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
                    'text-landing-quartz font-display tracking-[.22em] uppercase transition-colors duration-300 py-2 border-b border-landing-brass/5',
                    'text-[14px] md:text-[16px] hover:text-landing-brass-light hidden',
                    isActive && 'text-landing-brass-light'
                  )
                }
              >
                {t('header.myOrders')}
              </NavLink>
            )}
            <NavLink
              to={ROUTE.POLICY}
              className={({ isActive }) =>
                cn(
                  'text-landing-quartz font-display tracking-[.22em] uppercase transition-colors duration-300 py-2 border-b border-landing-brass/5',
                  'text-[14px] md:text-[16px] hover:text-landing-brass-light hidden',
                  isActive && 'text-landing-brass-light'
                )
              }
            >
              {t('header.policy')}
            </NavLink>
          </nav>

          {/* Reserve CTA */}
          {/* <div className="px-6 pb-2 mt-auto">
            <NavLink
              to={ROUTE.CLIENT_BOOKING}
              className="btn-brass w-full py-4 text-[12px] uppercase tracking-[.2em] font-semibold"
            >
              {t('header.booking')}
            </NavLink>
          </div> */}
        </div>
      </SheetContent>
    </Sheet>
  )
}
