import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { useSearchParams } from 'react-router-dom'
import { SystemCardTabContent } from '../tabscontent/system-card.tabscontent'
import { SystemCoinPolicyTabContent } from '../tabscontent/system-coin-policy.tabscontent'
import { SystemFeatureFlagTabContent } from '../tabscontent/system-feature-flag.tabscontent'

export enum SystemCardTabEnum {
  FEATURE_FLAGS = 'feature-flags',
  COIN_POLICY = 'coin-policy',
  CARD = 'card',
}

export function SystemCardTabs() {
  const { t } = useTranslation(['giftCard'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(
    searchParams.get('panel') || SystemCardTabEnum.CARD,
  )

  useEffect(() => {
    setSearchParams((prev) => {
      prev.set('panel', tab)
      return prev
    })
  }, [tab, setSearchParams])

  return (
    <Tabs defaultValue={tab} className="w-full">
      <TabsList
        variant="line"
        className="mb-6 flex justify-start gap-3 border-b sm:grid-cols-6 lg:mb-0"
      >
        <TabsTrigger
          value={SystemCardTabEnum.CARD}
          className="flex min-w-[150px] justify-center"
          onClick={() => setTab(SystemCardTabEnum.CARD)}
        >
          {t('giftCard.card.title')}
        </TabsTrigger>
        <TabsTrigger
          value={SystemCardTabEnum.COIN_POLICY}
          className="flex w-fit min-w-[160px] justify-center"
          onClick={() => setTab(SystemCardTabEnum.COIN_POLICY)}
        >
          {t('giftCard.card.coinPolicyTitle')}
        </TabsTrigger>
        <TabsTrigger
          value={SystemCardTabEnum.FEATURE_FLAGS}
          className="flex w-fit min-w-[160px] justify-center"
          onClick={() => setTab(SystemCardTabEnum.FEATURE_FLAGS)}
        >
          {t('giftCard.card.featureFlagTitle')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value={SystemCardTabEnum.CARD} className="w-full p-0">
        <SystemCardTabContent />
      </TabsContent>
      <TabsContent value={SystemCardTabEnum.COIN_POLICY} className="w-full p-0">
        <SystemCoinPolicyTabContent />
      </TabsContent>
      <TabsContent
        value={SystemCardTabEnum.FEATURE_FLAGS}
        className="w-full p-0"
      >
        <SystemFeatureFlagTabContent />
      </TabsContent>
    </Tabs>
  )
}
