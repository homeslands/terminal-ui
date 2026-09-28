import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { SystemMenuAndProductManagementTabsContent } from '@/components/app/tabscontent'

export function SystemMenuAndProductManagementTabs() {
  const { t } = useTranslation(['menu'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'menu')

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
          value="menu"
          className="flex min-w-[150px] justify-center"
          onClick={() => setTab('menu')}
        >
          {t('menu.menuManagement')}
        </TabsTrigger>
        <TabsTrigger
          value="product"
          className="flex w-fit min-w-[160px] justify-center"
          onClick={() => setTab('product')}
        >
          {t('menu.productManagement')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="menu" className="w-full p-0">
        <SystemMenuAndProductManagementTabsContent />
      </TabsContent>
      <TabsContent value="product" className="w-full p-0">
        <SystemMenuAndProductManagementTabsContent />
      </TabsContent>
    </Tabs>
  )
}
