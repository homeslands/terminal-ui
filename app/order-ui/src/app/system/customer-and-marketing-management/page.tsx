import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'

import { SystemCustomerAndMarketingManagementTabs } from '@/components/app/tabs'

export default function CustomerAndMarketingManagementPage() {
  const { t } = useTranslation(['customer'])
  const { t: tHelmet } = useTranslation('helmet')

  return (
    <div className="grid grid-cols-1 w-full h-full">
      <Helmet>
        <meta charSet='utf-8' />
        <title>
          {tHelmet('helmet.customer.title')}
        </title>
        <meta name='description' content={tHelmet('helmet.customer.title')} />
      </Helmet>
      <span className="flex gap-1 items-center text-lg">
        <Users />
        {t('customer.title')}
      </span>
      <SystemCustomerAndMarketingManagementTabs />
    </div>
  )
}

