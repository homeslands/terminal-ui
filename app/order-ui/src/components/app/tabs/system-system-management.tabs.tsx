import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  SystemRoleManagementTabsContent,
  SystemConfigManagementTabsContent,
  SystemBannerManagementTabsContent,
  SystemLogManagementTabsContent,
  SystemStaticPageManagementTabsContent,
  SystemLockManagementTabsContent,
  SystemPrinterConnectorManagementTabsContent,
} from '@/components/app/tabscontent'

export function SystemSystemManagementTabs() {
  const { t } = useTranslation(['role'])
  const { t: tSystem } = useTranslation(['system'])
  const { t: tConfig } = useTranslation(['config'])
  const { t: tBanner } = useTranslation(['banner'])
  const { t: tLog } = useTranslation(['log'])
  const { t: tStaticPage } = useTranslation(['staticPage'])
  const { t: tChefArea } = useTranslation(['chefArea'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'role')

  useEffect(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev)
      newParams.set('tab', tab)
      return newParams
    })
  }, [setSearchParams, tab])

  return (
    <Tabs defaultValue={tab} className="w-full">
      <TabsList
        variant="line"
        className="mb-6 flex justify-start gap-3 border-b sm:grid-cols-6 lg:mb-0"
      >
        <TabsTrigger
          value="role"
          className="flex min-w-[120px] justify-center"
          onClick={() => setTab('role')}
        >
          {t('role.title')}
        </TabsTrigger>
        <TabsTrigger
          value="config"
          className="flex min-w-[120px] justify-center"
          onClick={() => setTab('config')}
        >
          {tConfig('config.title')}
        </TabsTrigger>
        <TabsTrigger
          value="banner"
          className="flex min-w-[120px] justify-center"
          onClick={() => setTab('banner')}
        >
          {tBanner('banner.bannerTitle')}
        </TabsTrigger>
        <TabsTrigger
          value="log"
          className="flex min-w-[120px] justify-center"
          onClick={() => setTab('log')}
        >
          {tLog('log.title')}
        </TabsTrigger>
        <TabsTrigger
          value="static-page"
          className="flex min-w-[120px] justify-center"
          onClick={() => setTab('static-page')}
        >
          {tStaticPage('staticPage.staticPageTitle')}
        </TabsTrigger>
        <TabsTrigger
          value="lock"
          className="flex min-w-[120px] justify-center"
          onClick={() => setTab('lock')}
        >
          {tSystem('system.lockFeature.title')}
        </TabsTrigger>
        <TabsTrigger
          value="printer-connector"
          className="flex min-w-[120px] justify-center"
          onClick={() => setTab('printer-connector')}
        >
          {tChefArea('printerConnector.title')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="role" className="w-full p-0">
        <SystemRoleManagementTabsContent />
      </TabsContent>
      <TabsContent value="config" className="w-full p-0">
        <SystemConfigManagementTabsContent />
      </TabsContent>
      <TabsContent value="banner" className="w-full p-0">
        <SystemBannerManagementTabsContent />
      </TabsContent>
      <TabsContent value="log" className="w-full p-0">
        <SystemLogManagementTabsContent />
      </TabsContent>
      <TabsContent value="static-page" className="w-full p-0">
        <SystemStaticPageManagementTabsContent />
      </TabsContent>
      <TabsContent value="lock" className="w-full p-0">
        <SystemLockManagementTabsContent />
      </TabsContent>
      <TabsContent value="printer-connector" className="w-full p-0">
        <SystemPrinterConnectorManagementTabsContent />
      </TabsContent>
    </Tabs>
  )
}
