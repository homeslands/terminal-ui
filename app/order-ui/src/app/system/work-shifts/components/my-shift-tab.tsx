import { useTranslation } from 'react-i18next'

import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { OpenShiftScreen } from '@/components/work-shift/open-shift-screen'
import { ShiftInvoicesList } from '@/components/work-shift/shift-invoices-list'
import { ShiftOrdersList } from '@/components/work-shift/shift-orders-list'
import { ShiftStaffList } from '@/components/work-shift/shift-staff-list'
import { ShiftSummaryPanel } from '@/components/work-shift/shift-summary-panel'
import {
  useCurrentWorkShift,
  useCurrentWorkShiftInvoices,
  useCurrentWorkShiftOrders,
  useCurrentWorkShiftStaff,
  useCurrentWorkShiftSummary,
} from '@/hooks'

/**
 * Khung ca làm việc của CASHIER đang đăng nhập.
 * Chưa có ca → OpenShiftScreen. Có ca → 4 tab: đơn / hoá đơn / nhân viên / tổng kết.
 * Render bên trong SystemLayout (đã có sidebar + AppHeader + breadcrumb).
 */
export function MyShiftTab() {
  const { t } = useTranslation('workShift')

  // isFetched (không phải isLoading): true VĨNH VIỄN sau lần fetch đầu tiên
  // settle. Dùng isLoading sẽ bật lại mỗi lần refetch 30s (vì không có data
  // nên isPending luôn true), làm skeleton↔modal nhấp nháy. isFetched chỉ đổi
  // một lần nên modal mở ca hiện ổn định, không nháy.
  const { data: shift, isFetched: isShiftFetched } = useCurrentWorkShift()
  const hasShift = !!shift

  const { data: orders, isLoading: isLoadingOrders } =
    useCurrentWorkShiftOrders(hasShift)
  const { data: invoices, isLoading: isLoadingInvoices } =
    useCurrentWorkShiftInvoices(hasShift)
  const { data: staff, isLoading: isLoadingStaff } =
    useCurrentWorkShiftStaff(hasShift)
  const { data: summary } = useCurrentWorkShiftSummary(hasShift)

  // Đang chờ /work-shifts/current lần đầu settle: hiện skeleton thay vì trắng
  // màn. Không render OpenShiftScreen ở đây để tránh chớp "mở ca" vào mặt
  // cashier đang thực sự có ca — chỉ khi query xong mà vẫn không có ca mới mở.
  if (!isShiftFetched && !shift) {
    return (
      <div className="space-y-4" data-testid="my-shift-loading">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!shift) return <OpenShiftScreen />

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">{t('currentShift')}</h2>
        <p className="text-sm text-muted-foreground">
          {shift.branch.name} · {shift.cashier.firstName}{' '}
          {shift.cashier.lastName}
        </p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList variant="line" className="mt-2 w-full justify-start border-b">
          <TabsTrigger value="orders">{t('tabOrders')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('tabInvoices')}</TabsTrigger>
          <TabsTrigger value="staff">{t('tabStaff')}</TabsTrigger>
          <TabsTrigger value="summary">{t('tabSummary')}</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-3">
          <ShiftOrdersList
            orders={orders ?? []}
            currentShiftSlug={shift.slug}
            isLoading={isLoadingOrders}
          />
        </TabsContent>
        <TabsContent value="invoices" className="mt-3">
          <ShiftInvoicesList
            invoices={invoices ?? []}
            isLoading={isLoadingInvoices}
          />
        </TabsContent>
        <TabsContent value="staff" className="mt-3">
          <ShiftStaffList staff={staff ?? []} isLoading={isLoadingStaff} />
        </TabsContent>
        <TabsContent value="summary" className="mt-3">
          {summary ? <ShiftSummaryPanel summary={summary} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
