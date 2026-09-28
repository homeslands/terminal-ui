import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { SquareMenu } from 'lucide-react'

import { DataTable } from '@/components/ui'
import { useUsers, usePagination } from '@/hooks'
import { useUserListColumns } from './DataTable/columns'
import { Role, ROUTE } from '@/constants'
import { CustomerAction } from './DataTable/actions'
import { IUserInfo } from '@/types'
import { showErrorToastMessage } from '@/utils'

export default function CustomerPage() {
  const { t } = useTranslation('customer')
  const { t: tHelmet } = useTranslation('helmet')
  const { t: tToast } = useTranslation('toast')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 10
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  const [phonenumber, setPhoneNumber] = useState<string>('')
  const [membershipCard, setMembershipCard] = useState<string>('')
  const [userSlug, setUserSlug] = useState<string>('')
  const [scannedCode, setScannedCode] = useState<string>('')
  const hasShownToastForCurrentFilterRef = useRef<string>('')

  useEffect(() => {
    setSearchParams((prev) => {
      prev.set('page', pagination.pageIndex.toString())
      prev.set('size', pagination.pageSize.toString())
      return prev
    })
  }, [pagination.pageIndex, pagination.pageSize, setSearchParams])

  const { data, isLoading } = useUsers({
    page,
    size,
    order: 'DESC',
    phonenumber,
    membershipCard: membershipCard || undefined,
    slug: userSlug || undefined,
    hasPaging: true,
    role: Role.CUSTOMER,
  }, true)

  // Show toast khi filter không tìm thấy user
  const activeCode = scannedCode
  useEffect(() => {
    if (isLoading || !data?.result || !activeCode) {
      if (!activeCode) {
        hasShownToastForCurrentFilterRef.current = ''
      }
      return
    }

    const currentItemsCount = data.result.items?.length ?? 0

    if (currentItemsCount === 0 && hasShownToastForCurrentFilterRef.current !== activeCode) {
      showErrorToastMessage(tToast('toast.userNotFound', { ns: 'toast' }))
      hasShownToastForCurrentFilterRef.current = activeCode
    }
  }, [data, activeCode, isLoading, tToast])

  const handleSearchChange = useCallback((value: string) => {
    setPhoneNumber(value)
    // Clear RFID filter khi tìm bằng phone number
    if (value) {
      setMembershipCard('')
    }
  }, [])

  const handleRFIDScan = useCallback((code: string, mode: 'rfid' | 'qr') => {
    setScannedCode(code)
    setMembershipCard(mode === 'rfid' ? code : '')
    setUserSlug(mode === 'qr' ? code : '')
    setPhoneNumber('')
  }, [])

  const handleRFIDClear = useCallback(() => {
    setScannedCode('')
    setMembershipCard('')
    setUserSlug('')
  }, [])

  const handleReset = useCallback(() => {
    setPhoneNumber('')
    setScannedCode('')
    setMembershipCard('')
    setUserSlug('')
  }, [])

  const handleRowClick = (row: IUserInfo) => {
    navigate(`${ROUTE.STAFF_CUSTOMER_MANAGEMENT}/${row.slug}`)
  }

  // Tạo actionOptions component với callbacks
  const CustomerActionOptions = useMemo(() => {
    return function ActionOptions() {
      return (
        <CustomerAction
          onRFIDScan={handleRFIDScan}
          onRFIDClear={handleRFIDClear}
          onReset={handleReset}
          scannedCode={scannedCode}
          hasActiveFilter={!!phonenumber || !!scannedCode}
        />
      )
    }
  }, [scannedCode, phonenumber, handleRFIDScan, handleRFIDClear, handleReset])

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
      <Helmet>
        <meta charSet='utf-8' />
        <title>
          {tHelmet('helmet.customer.title')}
        </title>
        <meta name='description' content={tHelmet('helmet.customer.title')} />
      </Helmet>
      <span className="flex gap-1 items-center text-lg">
        <SquareMenu />
        {t('customer.title')}
      </span>
      <DataTable
        columns={useUserListColumns()}
        data={data?.result.items || []}
        isLoading={isLoading}
        pages={data?.result.totalPages || 0}
        onInputChange={handleSearchChange}
        hiddenInput={false}
        searchPlaceholder={t('customer.searchByPhoneNumber')}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        actionOptions={CustomerActionOptions}
        onRowClick={handleRowClick}
      />
    </div>
  )
}
