import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  SystemBranchManagementTabsContent,
  SystemChefAreaManagementTabsContent,
  SystemBankConfigManagementTabsContent,
} from '@/components/app/tabscontent'

export function SystemBranchAndSystemManagementTabs() {
  const { t } = useTranslation(['branch'])
  const { t: tChefArea } = useTranslation(['chefArea'])
  const { t: tBank } = useTranslation(['bank'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'branch')

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
          value="branch"
          className="flex min-w-[150px] justify-center"
          onClick={() => setTab('branch')}
        >
          {t('branch.manageBranch')}
        </TabsTrigger>
        <TabsTrigger
          value="chef-area"
          className="flex w-fit min-w-[160px] justify-center"
          onClick={() => setTab('chef-area')}
        >
          {tChefArea('chefArea.title')}
        </TabsTrigger>
        <TabsTrigger
          value="bank"
          className="flex min-w-[150px] justify-center"
          onClick={() => setTab('bank')}
        >
          {tBank('bank.title')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="branch" className="w-full p-0">
        <SystemBranchManagementTabsContent />
      </TabsContent>
      <TabsContent value="chef-area" className="w-full p-0">
        <SystemChefAreaManagementTabsContent />
      </TabsContent>
      <TabsContent value="bank" className="w-full p-0">
        <SystemBankConfigManagementTabsContent />
      </TabsContent>
    </Tabs>
  )
}
