import { useEffect, useState } from 'react'
import { CheckCircle2, PlayCircle, RotateCcw, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { useHasVatPermission } from '@/hooks/use-vat-admin'
import { canTransition } from '@/lib/vat-status-transitions'
import type { IVatRequestListItem } from '@/types'
import { VatRequestStatus } from '@/types'
import { StatusTransitionConfirmDialog } from '@/components/app/dialog'

import { CustomerInfoSection } from './customer-info-section'
import { OverviewTab } from './overview-tab'

interface VatRequestDetailSheetProps {
  vatRequest: IVatRequestListItem | null
  onClose: () => void
}

const STATUS_COLORS: Record<VatRequestStatus, string> = {
  [VatRequestStatus.PENDING]: 'bg-gray-100 text-gray-700',
  [VatRequestStatus.PROCESSING]: 'bg-blue-100 text-blue-700',
  [VatRequestStatus.COMPLETED]: 'bg-green-100 text-green-700',
  [VatRequestStatus.REJECTED]: 'bg-red-100 text-red-700',
}

type TransitionMeta = {
  variant: 'default' | 'outline' | 'destructive'
  Icon: typeof CheckCircle2
}

/** UX: PENDING = rollback outline (RotateCcw), PROCESSING = neutral outline,
 *  COMPLETED = primary (positive next-natural step), REJECTED = destructive (red).
 *  Icons giúp nhận diện nhanh không cần đọc chữ. */
const TRANSITION_META: Record<VatRequestStatus, TransitionMeta> = {
  [VatRequestStatus.PENDING]: { variant: 'outline', Icon: RotateCcw },
  [VatRequestStatus.PROCESSING]: { variant: 'outline', Icon: PlayCircle },
  [VatRequestStatus.COMPLETED]: { variant: 'default', Icon: CheckCircle2 },
  [VatRequestStatus.REJECTED]: { variant: 'destructive', Icon: XCircle },
}

/** LEFT group transitions: PENDING (rollback) + PROCESSING + COMPLETED.
 *  RIGHT group: REJECTED — tách riêng phía bên phải footer.
 *  Free transitions: canTransition chỉ chặn same-status. */
const FORWARD_TARGETS: VatRequestStatus[] = [
  VatRequestStatus.PENDING,
  VatRequestStatus.PROCESSING,
  VatRequestStatus.COMPLETED,
]

/**
 * Pattern Sheet shadcn chuẩn: SheetHeader (title + status) → scrollable body
 * (sections customer + accountant) → SheetFooter sticky (workflow transitions
 * trái + Close phải). Tuân theo industry RBAC admin tools: state-changing
 * actions ở footer, edit forms inline trong body.
 */
export function VatRequestDetailSheet({
  vatRequest,
  onClose,
}: VatRequestDetailSheetProps) {
  const { t } = useTranslation('vatAdmin')
  const [snapshot, setSnapshot] = useState<IVatRequestListItem | null>(null)
  const [transitionTarget, setTransitionTarget] = useState<VatRequestStatus | null>(null)
  const { canEdit, canUpdateStatus } = useHasVatPermission()

  useEffect(() => {
    if (vatRequest) setSnapshot({ ...vatRequest })
    else setSnapshot(null)
  }, [vatRequest])

  if (!snapshot) return null

  const isTerminal =
    snapshot.status === VatRequestStatus.COMPLETED ||
    snapshot.status === VatRequestStatus.REJECTED
  const customerLocked = isTerminal || !canEdit

  const headerTitle =
    snapshot.invoice?.referenceNumber != null
      ? `#${snapshot.invoice.referenceNumber}`
      : snapshot.slug

  function handleOpenChange(open: boolean) {
    if (!open) onClose()
  }

  return (
    <Sheet open={!!snapshot} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-2xl flex-col gap-0 p-0"
        data-testid="vat-detail-sheet"
      >
        {/* Header */}
        <SheetHeader className="space-y-2 border-b px-6 py-4 text-left">
          <div className="flex items-center gap-3">
            <SheetTitle className="font-mono text-lg">{headerTitle}</SheetTitle>
            <Badge
              data-testid={`vat-status-badge-${snapshot.status}`}
              className={STATUS_COLORS[snapshot.status]}
            >
              {t(`status.${snapshot.status}`, snapshot.status)}
            </Badge>
          </div>
          <SheetDescription className="text-xs">
            {t('detail.description', 'Quản lý thông tin và trạng thái yêu cầu xuất hoá đơn VAT')}
          </SheetDescription>
        </SheetHeader>

        {/* Tabs: Tổng quan (read) / Khách (edit). 90% case kế toán chỉ xem
            Tổng quan rồi action ở footer. Variant "line" = underline indicator
            (pattern customer-info-page). */}
        <Tabs
          defaultValue="overview"
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabsList
            variant="line"
            className="mx-6 mt-2 flex h-auto w-full !justify-start gap-4 border-b"
          >
            <TabsTrigger
              value="overview"
              className="whitespace-nowrap px-1"
              data-testid="vat-tab-overview"
            >
              {t('tabs.overview', 'Tổng quan')}
            </TabsTrigger>
            <TabsTrigger
              value="customer"
              className="whitespace-nowrap px-1"
              data-testid="vat-tab-customer"
            >
              {t('tabs.customer', 'Thông tin khách')}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="overview"
            className="flex-1 overflow-y-auto px-6 py-4"
          >
            <OverviewTab vatRequest={snapshot} />
          </TabsContent>
          <TabsContent
            value="customer"
            className="flex-1 overflow-y-auto px-6 py-4"
          >
            <CustomerInfoSection
              vatRequest={snapshot}
              isLocked={customerLocked}
              onUpdated={(updated) => setSnapshot({ ...snapshot, ...updated })}
            />
          </TabsContent>
        </Tabs>

        {/* Footer chuẩn ngành workflow admin:
            - LEFT: forward actions (Bắt đầu xử lý / Hoàn thành) — chỉ show
              transitions hợp lệ với current status, hide khi không dùng được
              (không grey-out để giảm cognitive load)
            - RIGHT: destructive (Từ chối) tách riêng + Close
            - Terminal status → chỉ còn Close */}
        <SheetFooter
          className="flex-row items-center justify-between gap-2 border-t px-6 py-3 sm:justify-between"
          data-testid="vat-detail-footer"
        >
          <div
            className="flex flex-wrap gap-2"
            data-testid="vat-status-workflow-section"
          >
            {canUpdateStatus &&
              FORWARD_TARGETS.filter((target) =>
                canTransition(snapshot.status, target),
              ).map((target) => {
                const meta = TRANSITION_META[target]
                const Icon = meta.Icon
                return (
                  <Button
                    key={target}
                    size="sm"
                    variant={meta.variant}
                    onClick={() => setTransitionTarget(target)}
                    data-testid={`vat-transition-${target}`}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {t(`workflow.transitionTo.${target}`, target)}
                  </Button>
                )
              })}
          </div>
          <div className="flex items-center gap-2">
            {canUpdateStatus &&
              canTransition(snapshot.status, VatRequestStatus.REJECTED) && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setTransitionTarget(VatRequestStatus.REJECTED)}
                  data-testid={`vat-transition-${VatRequestStatus.REJECTED}`}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  {t(
                    `workflow.transitionTo.${VatRequestStatus.REJECTED}`,
                    'Từ chối',
                  )}
                </Button>
              )}
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('close', 'Đóng')}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      {transitionTarget && (
        <StatusTransitionConfirmDialog
          open={transitionTarget !== null}
          vatRequest={snapshot}
          targetStatus={transitionTarget}
          onClose={() => setTransitionTarget(null)}
          onConfirmed={(updated) => {
            setSnapshot({ ...snapshot, ...updated })
            setTransitionTarget(null)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}
