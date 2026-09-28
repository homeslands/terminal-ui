import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { SidebarProvider, ScrollArea } from '@/components/ui'
import { SystemBreadcrumb } from '@/components/app/breadcrumb'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib'
import { DownloadProgress } from '@/components/app/progress'
import { useDownloadStore, useUserStore } from '@/stores'
import { Role, ROUTE } from '@/constants'
import { AppHeader, AppSidebar } from './components'
import StoreHydrationProvider from './store-hydration-provider'

export default function SystemLayout() {
  const isMobile = useIsMobile()
  const { progress, fileName, isDownloading } = useDownloadStore()
  const navigate = useNavigate()
  const location = useLocation()
  const userInfo = useUserStore((s) => s.getUserInfo())
  const role = userInfo?.role?.name
  // Routes that manage their own horizontal padding (full-bleed split layouts)
  const isFullBleedRoute =
    location.pathname === ROUTE.STAFF_MENU ||
    /^\/system\/table\/[^/]+\/payment$/.test(location.pathname)

  // Hard block: STAFF role should only access /staff routes — bounce back if landed here
  useEffect(() => {
    if (role === Role.STAFF) {
      navigate(ROUTE.STAFF_POS_FLOOR_PLAN, { replace: true })
    }
  }, [role, navigate])

  if (role === Role.STAFF) return null

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="box-border flex min-h-screen flex-1">
        <StoreHydrationProvider />
        <AppSidebar />

        {/* Main content */}
        <div className="relative flex h-[100dvh] flex-1 flex-col overflow-hidden">
          {/* Header - Fixed on mobile - Safe area padding được xử lý trong AppHeader component */}
          <AppHeader />

          {/* Breadcrumb - Responsive padding */}
          <div className={cn('sticky z-20', isMobile ? 'px-3 py-2' : 'p-4')}>
            <SystemBreadcrumb />
          </div>

          {/* Main scrollable area */}
          <ScrollArea className="flex-1">
            <main
              className={cn(
                'bg- min-h-full',
                isMobile
                  ? 'px-2 pb-[env(safe-area-inset-bottom)]'
                  : isFullBleedRoute
                    ? 'pl-4'
                    : 'px-4',
              )}
            >
              <Outlet />
              {isDownloading && (
                <DownloadProgress progress={progress} fileName={fileName} />
              )}
            </main>
          </ScrollArea>
        </div>
      </div>
    </SidebarProvider>
  )
}
