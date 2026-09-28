import { TabsContent } from '@/components/ui'
import { StaffCustomerSearchInput } from '@/components/staff/staff-customer-search-input'
import { StaffTableVoucherSheet } from '@/components/staff/staff-table-voucher-sheet'
import type { IVoucher } from '@/types'
import type { OrderItem, TableCustomer } from '@/types/session'

interface AdminCartInfoTabProps {
  sessionCustomer: TableCustomer | null
  sessionVoucher: IVoucher | null
  pendingItems: OrderItem[]
  submittedItems: OrderItem[]
  onSelectCustomer: (c: TableCustomer) => void
  onClearCustomer: () => void
  onApplyVoucher: (v: IVoucher) => Promise<void> | void
  onRemoveVoucher: () => Promise<void> | void
}

export function AdminCartInfoTab({
  sessionCustomer,
  sessionVoucher,
  pendingItems,
  submittedItems,
  onSelectCustomer,
  onClearCustomer,
  onApplyVoucher,
  onRemoveVoucher,
}: AdminCartInfoTabProps) {
  return (
    <TabsContent
      value="info"
      className="mt-0 min-h-0 flex-1 px-3 data-[state=inactive]:hidden"
    >
      <div
        className="flex h-full flex-col justify-between gap-3 pb-8 pt-3"
        data-testid="admin-cart-info-tab"
      >
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Khách hàng
          </label>
          <StaffCustomerSearchInput
            customer={sessionCustomer}
            onSelect={onSelectCustomer}
            onClear={onClearCustomer}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Voucher
          </label>
          <StaffTableVoucherSheet
            pendingItems={pendingItems}
            submittedItems={submittedItems}
            customer={sessionCustomer}
            appliedVoucher={sessionVoucher}
            onApply={onApplyVoucher}
            onRemove={onRemoveVoucher}
          />
        </div>
      </div>
    </TabsContent>
  )
}
