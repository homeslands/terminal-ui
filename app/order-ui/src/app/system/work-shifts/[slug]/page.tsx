import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Loader2, SquareMenu, TriangleAlert } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { ShiftInvoicesList } from '@/components/work-shift/shift-invoices-list'
import { ShiftOrdersList } from '@/components/work-shift/shift-orders-list'
import { ShiftStaffList } from '@/components/work-shift/shift-staff-list'
import { ShiftSummaryPanel } from '@/components/work-shift/shift-summary-panel'
import {
  useWorkShiftBySlug,
  useWorkShiftInvoices,
  useWorkShiftOrders,
  useWorkShiftStaff,
  useWorkShiftSummary,
} from '@/hooks'

export default function SystemWorkShiftDetailPage() {
  const { t } = useTranslation('workShift')
  const { t: tHelmet } = useTranslation('helmet')
  const { slug } = useParams<{ slug: string }>()

  const { data: shift, isLoading, isError } = useWorkShiftBySlug(slug)
  const { data: orders, isLoading: isLoadingOrders } = useWorkShiftOrders(slug)
  const { data: invoices, isLoading: isLoadingInvoices } =
    useWorkShiftInvoices(slug)
  const { data: staff, isLoading: isLoadingStaff } = useWorkShiftStaff(slug)
  const { data: summary } = useWorkShiftSummary(slug)

  if (isLoading && !shift) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!shift) {
    // The global QueryCache handler already toasts the mapped 161xxx
    // message (e.g. forbidden / not found) — this is the persistent,
    // visible fallback so the page never just renders blank.
    return (
      <div
        data-testid="work-shift-detail-error"
        className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground"
      >
        <TriangleAlert className="h-6 w-6" />
        <p>{isError ? t('shiftDetailError') : t('shiftDetailNotFound')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-2">
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.workShift.title')}</title>
        <meta
          name="description"
          content={tHelmet('helmet.workShift.description')}
        />
      </Helmet>
      <div>
        <span className="flex items-center gap-1 text-lg">
          <SquareMenu />
          {t('shiftDetail')}
        </span>
        <p className="mt-1 text-sm text-muted-foreground">
          {shift.cashier.firstName} {shift.cashier.lastName} ·{' '}
          {shift.branch.name}
        </p>
      </div>

      <Tabs defaultValue="summary">
        <TabsList variant="line" className="mt-2 w-full justify-start border-b">
          <TabsTrigger value="summary">{t('tabSummary')}</TabsTrigger>
          <TabsTrigger value="orders">{t('tabOrders')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('tabInvoices')}</TabsTrigger>
          <TabsTrigger value="staff">{t('tabStaff')}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-3">
          {summary ? <ShiftSummaryPanel summary={summary} /> : null}
        </TabsContent>
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
      </Tabs>
    </div>
  )
}
