import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { SystemCardOrderTabContent } from '../tabscontent/system-card-order-history.tabscontent'
import { SystemTransactionPointHistoryTabContent } from '../tabscontent/system-transaction-point-history.tabscontent'
import { useSearchParams } from 'react-router-dom'

export enum SystemCardOrderHistoryTabEnum {
  CARD_ORDER_TAB = 'card-order',
  COIN_TAB = 'coin',
}

export function SystemCardOrderHistoryTabs() {
  const { t } = useTranslation(['giftCard'])
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(
    searchParams.get('panel') || SystemCardOrderHistoryTabEnum.CARD_ORDER_TAB,
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
          value={SystemCardOrderHistoryTabEnum.CARD_ORDER_TAB}
          className="flex min-w-[150px] justify-center"
          onClick={() => setTab(SystemCardOrderHistoryTabEnum.CARD_ORDER_TAB)}
        >
          {t('giftCard.cardOrder.shortTitle')}
        </TabsTrigger>
        <TabsTrigger
          value={SystemCardOrderHistoryTabEnum.COIN_TAB}
          className="flex w-fit min-w-[160px] justify-center"
          onClick={() => setTab(SystemCardOrderHistoryTabEnum.COIN_TAB)}
        >
          {t('giftCard.cardOrder.coinTitle')}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value={SystemCardOrderHistoryTabEnum.CARD_ORDER_TAB}
        className="w-full p-0"
      >
        <SystemCardOrderTabContent />
      </TabsContent>
      <TabsContent
        value={SystemCardOrderHistoryTabEnum.COIN_TAB}
        className="w-full p-0"
      >
        <SystemTransactionPointHistoryTabContent />
      </TabsContent>
    </Tabs>
  )
}
