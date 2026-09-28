import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DataTable } from '@/components/ui'
import { useUsers, usePagination } from '@/hooks'
import { useUserListColumns } from '@/app/system/customers/DataTable/columns'
import { Role, ROUTE } from '@/constants'
import { CustomerAction } from '@/app/system/customers/DataTable/actions'
import { IUserInfo } from '@/types'
import { showErrorToastMessage } from '@/utils'
import { useTranslation } from 'react-i18next'

export function SystemCustomerManagementTabsContent() {
  const { t } = useTranslation('customer')
  const { t: tToast } = useTranslation('toast')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const page = Number(searchParams.get('page')) || 1
  const size = Number(searchParams.get('size')) || 10
  const { pagination, handlePageChange, handlePageSizeChange } = usePagination()
  const [phonenumber, setPhoneNumber] = useState<string>('')
  const [membershipCard, setMembershipCard] = useState<string>('')
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
    hasPaging: true,
    role: Role.CUSTOMER,
  }, true)

  // Show toast khi filter không tìm thấy user
  useEffect(() => {
    // Chỉ xử lý khi đã có data, không đang loading, và có filter membershipCard
    if (isLoading || !data?.result || !membershipCard) {
      // Reset toast flag khi không có filter
      if (!membershipCard) {
        hasShownToastForCurrentFilterRef.current = ''
      }
      return
    }

    const currentItemsCount = data.result.items?.length ?? 0

    // Nếu không tìm thấy user và chưa show toast cho filter này
    if (currentItemsCount === 0 && hasShownToastForCurrentFilterRef.current !== membershipCard) {
      showErrorToastMessage(tToast('toast.userNotFound', { ns: 'toast' }))
      hasShownToastForCurrentFilterRef.current = membershipCard
    }
  }, [data, membershipCard, isLoading, tToast])

  const handleSearchChange = useCallback((value: string) => {
    setPhoneNumber(value)
    // Clear RFID filter khi tìm bằng phone number
    if (value) {
      setMembershipCard('')
    }
  }, [])

  const handleRFIDScan = useCallback((code: string) => {
    setMembershipCard(code)
    // Clear phone number filter khi tìm bằng RFID
    setPhoneNumber('')
  }, [])

  const handleRFIDClear = useCallback(() => {
    setMembershipCard('')
  }, [])

  const handleReset = useCallback(() => {
    setPhoneNumber('')
    setMembershipCard('')
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
          scannedCode={membershipCard}
          hasActiveFilter={!!phonenumber || !!membershipCard}
        />
      )
    }
  }, [membershipCard, phonenumber, handleRFIDScan, handleRFIDClear, handleReset])

  return (
    <div className="grid grid-cols-1 gap-2 h-full">
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

