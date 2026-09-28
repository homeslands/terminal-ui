import { useSearchParams } from 'react-router-dom'

import { useIsMobile } from '@/hooks'
import { SystemMenuTabs } from '@/components/app/tabs'
import { AdminCartContent } from './components/admin-cart-content'

export default function SystemMenuPage() {
  const isMobile = useIsMobile()
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'table'
  // Hide cart panel on table tab — gives full width to FloorPlan grid.
  const showCart = !isMobile && activeTab !== 'table'

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] w-full flex-col">
      <main
        className={`grid min-h-0 flex-1 ${
          showCart ? 'grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px]' : ''
        }`}
      >
        <div className="min-h-0 overflow-y-auto scrollbar-hide pr-2">
          <SystemMenuTabs />
        </div>
        {showCart && (
          <div className="min-h-0 border-l border-pos-border bg-pos-card">
            <AdminCartContent />
          </div>
        )}
      </main>
    </div>
  )
}
