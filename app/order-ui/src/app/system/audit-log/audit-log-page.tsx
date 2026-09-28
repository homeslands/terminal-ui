import { useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { SquareMenu } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Permission } from '@/constants/sidebar-permission'
import { useHasPermission } from '@/hooks/use-permissions'

import ViewerTab from './viewer/viewer-tab'
import ConfigTab from './config/config-tab'

type TabValue = 'viewer' | 'config'

export function AuditLogPage() {
  const { t } = useTranslation('auditLog')
  const { t: tHelmet } = useTranslation('helmet')
  const canAccess = useHasPermission(Permission.AUDIT_LOG_MANAGEMENT)

  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = (searchParams.get('tab') as TabValue) || 'viewer'
  const effectiveTab: TabValue = rawTab === 'config' ? 'config' : 'viewer'

  useEffect(() => {
    if (searchParams.get('tab') !== effectiveTab) {
      const np = new URLSearchParams(searchParams)
      np.set('tab', effectiveTab)
      setSearchParams(np, { replace: true })
    }
  }, [effectiveTab, searchParams, setSearchParams])

  const onTabChange = (value: string) => {
    const np = new URLSearchParams(searchParams)
    np.set('tab', value)
    setSearchParams(np, { replace: true })
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.auditLog.title')}</title>
        <meta
          name="description"
          content={tHelmet('helmet.auditLog.title')}
        />
      </Helmet>
      {!canAccess ? (
        <>
          <span className="flex gap-1 items-center text-lg">
            <SquareMenu />
            {t('auditLog.title')}
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            {t('auditLog.noPermission')}
          </p>
        </>
      ) : (
        <Tabs
          value={effectiveTab}
          onValueChange={onTabChange}
          className="flex flex-col flex-1"
        >
          <div className="sticky top-0 z-10 bg-background pt-2 pb-0">
            <span className="flex gap-1 items-center text-lg">
              <SquareMenu />
              {t('auditLog.title')}
            </span>
            <TabsList variant="line" className="w-full justify-start border-b mt-2">
              <TabsTrigger value="viewer">{t('auditLog.tab.viewer')}</TabsTrigger>
              <TabsTrigger value="config">{t('auditLog.tab.config')}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="viewer" className="flex-1">
            <ViewerTab />
          </TabsContent>
          <TabsContent value="config" className="flex-1">
            <ConfigTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
