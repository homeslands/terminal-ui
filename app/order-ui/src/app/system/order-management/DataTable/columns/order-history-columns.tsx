import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ColumnDef } from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import {
  MoreHorizontal,
  CreditCard,
  DownloadIcon,
  SquarePen,
  Loader2,
  ShoppingBag,
  Receipt,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import moment from 'moment'

import {
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui'
import { IOrder, OrderStatus, OrderTypeEnum } from '@/types'
import { PaymentMethod, paymentStatus, PrinterJobStatus, QUERYKEY, Role } from '@/constants'
import { useCallCustomerToGetOrder, useExportOrderInvoice, useExportPayment, useGetAuthorityGroup, useReprintFailedInvoicePrinterJobs } from '@/hooks'
import { getOrderBySlug } from '@/api/order'
import { formatCurrency, hasPermissionInBoth, loadDataToPrinter, showErrorToastMessage, showToast } from '@/utils'
import OrderStatusBadge from '@/components/app/badge/order-status-badge'
import { CreateChefOrderDialog, OutlineCancelOrderDialog } from '@/components/app/dialog'
import { useUserStore } from '@/stores'
import { useTableSessions } from '@/hooks/useTableSessions'

export const useOrderHistoryColumns = (): {
  columns: ColumnDef<IOrder>[]
  vatDialogOrder: IOrder | null
  closeVatDialog: () => void
} => {
  const { t } = useTranslation(['menu'])
  const { t: tToast } = useTranslation(['toast'])
  const { t: tCommon } = useTranslation(['common'])
  const { userInfo } = useUserStore()
  const { data: authorityData } = useGetAuthorityGroup({})
  const navigate = useNavigate()
  const { openSession } = useTableSessions()

  const authorityGroup = authorityData?.result ?? [];
  const authorityGroupCodes = Array.isArray(authorityGroup)
    ? authorityGroup.flatMap(group =>
      Array.isArray(group.authorities)
        ? group.authorities
          .filter(auth => auth != null && typeof auth.code !== 'undefined')
          .map(auth => auth.code)
        : []
    )
    : [];

  const userPermissionCodes = (userInfo?.role.permissions ?? []).map(p => p.authority.code);
  const isDeletePermissionValid = hasPermissionInBoth("DELETE_ORDER", authorityGroupCodes, userPermissionCodes);
  const { mutate: exportPayment } = useExportPayment()
  const { mutate: exportOrderInvoice, isPending: isExporting } = useExportOrderInvoice()
  const { mutate: reprintOrderInvoice, isPending: isReprinting } = useReprintFailedInvoicePrinterJobs()
  const { mutate: callCustomerToGetOrder, isPending: isCallingCustomerToGetOrder } = useCallCustomerToGetOrder()
  const [exportingSlug, setExportingSlug] = useState<string | null>(null)
  const [callingSlug, setCallingSlug] = useState<string | null>(null)
  const [paymentPrecheckSlug, setPaymentPrecheckSlug] = useState<string | null>(
    null,
  )
  const [vatDialogOrder, setVatDialogOrder] = useState<IOrder | null>(null)
  const queryClient = useQueryClient()

  const handleExportPayment = (slug: string) => {
    exportPayment(slug, {
      onSuccess: (data: Blob) => {
        showToast(tToast('toast.exportPaymentSuccess'))
        // Load data to print
        loadDataToPrinter(data)
      },
    })
  }

  const handleExportOrderInvoice = async (order: IOrder | undefined) => {
    if (!order?.slug) return
    setExportingSlug(order.slug)
    exportOrderInvoice(order.slug, {
      onSuccess: (data: Blob) => {
        showToast(tToast('toast.exportInvoiceSuccess'))
        // Load data to print
        loadDataToPrinter(data)
      },
      onSettled: () => setExportingSlug(null),
    })
  }

  const handleReprintFailedOrderPrinterJobs = (order: IOrder) => {
    reprintOrderInvoice(order.slug, {
      onSuccess: () => {
        showToast(tToast('toast.reprintFailedOrderPrinterJobsSuccess'))
      }
    })
  }

  const handleCallCustomerToGetOrder = (order: IOrder) => {
    setCallingSlug(order.slug)
    callCustomerToGetOrder(order.slug, {
      onSuccess: () => {
        showToast(tToast('toast.callCustomerToGetOrderSuccess'))
      },
      onSettled: () => setCallingSlug(null),
    })
  }

  const columns: ColumnDef<IOrder>[] = [
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('menu.createdAt')} />
      ),
      cell: ({ row }) => {
        const createdAt = row.getValue('createdAt')
        return (
          <div className="text-xs xl:text-sm">
            {createdAt ? moment(createdAt).format('HH:mm DD/MM/YYYY') : ''}
          </div>
        )
      },
    },
        {
      accessorKey: 'table',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.table')} />
      ),
      cell: ({ row }) => {
        const location = row.original.type === OrderTypeEnum.AT_TABLE ? t('order.at-table') + " " + row.original.table?.name || "" : row.original.type === OrderTypeEnum.TAKE_OUT ? t('order.take-out') : t('order.delivery')
        return <div className="text-sm">{location}</div>
      },
    },
    {
      accessorKey: 'callCustomerToGetOrder',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.callCustomerToGetOrder')} />
      ),
      cell: ({ row }) => {
        const order = row.original
        // Chỉ enable khi đơn đã thanh toán (PAID/SHIPPING) — không hợp lý gọi
        // khách khi đơn còn PENDING (chưa trả tiền), COMPLETED (đã lấy), hoặc
        // FAILED. Tránh tài xế gọi nhầm.
        const isPaid =
          order.status === OrderStatus.PAID ||
          order.status === OrderStatus.SHIPPING
        // Owner phải là CUSTOMER thực (không phải staff/admin tạo đơn hộ và
        // không phải placeholder 'default-customer').
        // BE list endpoint /orders đôi khi không kèm `role` nested trong
        // owner, nên không yêu cầu role === CUSTOMER là bắt buộc. Logic:
        //  - Phonenumber phải tồn tại và không phải 'default-customer'
        //  - Nếu BE có trả role: chỉ enable khi role === CUSTOMER (loại staff)
        //  - Nếu BE không trả role: trust phonenumber (BE inconsistency)
        const owner = order.owner
        const ownerRoleName = owner?.role?.name
        const hasRealPhone =
          !!owner?.phonenumber && owner.phonenumber !== 'default-customer'
        const roleOkOrAbsent =
          ownerRoleName === undefined || ownerRoleName === Role.CUSTOMER
        const isRealCustomer = hasRealPhone && roleOkOrAbsent
        // Spinner + disabled chỉ áp lên row đang gọi — tránh "nháy" toàn bảng
        // khi click 1 row.
        const isCallingThisRow =
          isCallingCustomerToGetOrder && callingSlug === order.slug
        return (
          <Button
            variant="outline"
            disabled={!isPaid || !isRealCustomer || isCallingThisRow}
            className="text-xs xl:text-sm"
            onClick={(e) => {
              e.stopPropagation()
              handleCallCustomerToGetOrder(order)
            }}
          >
            {/* Icon slot có width cố định — Loader2 và ShoppingBag cùng h-4 w-4
                và cùng được margin trái 0 nên text không bị nhảy ngang. */}
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
              {isCallingThisRow ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
            </span>
            {t('order.callCustomerToGetOrder')}
          </Button>
        )
      },
    },
    {
      accessorKey: 'vatRequest',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.vatRequest')} />
      ),
      cell: ({ row }) => {
        const order = row.original
        const enabled = order?.status === OrderStatus.PAID
        return (
          <Button
            variant="outline"
            disabled={!enabled}
            onClick={(e) => {
              e.stopPropagation()
              if (!enabled) return
              setVatDialogOrder(order)
            }}
            aria-label={t('order.vatRequest')}
            title={
              enabled ? t('order.vatRequest') : t('order.vatRequestUnavailable')
            }
          >
            <Receipt className="h-4 w-4" />
            {t('order.vatRequest')}
          </Button>
        )
      },
    },
    {
      accessorKey: 'exportInvoice',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.exportInvoice')} />
      ),
      cell: ({ row }) => {
        const order = row.original
        return (
          <div className="text-xs xl:text-sm">
            {(order.status !== OrderStatus.PENDING) && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  className="flex gap-1 justify-start px-2 w-full text-xs xl:text-sm"
                  disabled={isExporting && exportingSlug === order.slug}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportOrderInvoice(order);
                  }}
                >
                  {isExporting && exportingSlug === order.slug ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xuất...
                    </>
                  ) : (
                    <>
                      <DownloadIcon />
                      {t('order.exportInvoice')}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'printerOrders',
      header: ({ column }) => (
        <DataTableColumnHeader
          key={column.id}
          column={column}
          title={t('order.printerOrders')}
        />
      ),
      cell: ({ row }) => {
        const printerInvoices = row.original.printerInvoices || []

        const countByStatus: Record<PrinterJobStatus, number> = {
          pending: 0,
          printing: 0,
          printed: 0,
          failed: 0,
        }

        for (const job of printerInvoices) {
          const status = job.status as PrinterJobStatus
          countByStatus[status]++
        }

        const statusLabels: Record<PrinterJobStatus, string> = {
          printed: t('order.printed'),   // ví dụ: 'Đã in'
          printing: t('order.printing'), // ví dụ: 'Đang in'
          pending: t('order.pendingPrint'),   // ví dụ: 'Chờ in'
          failed: t('order.failed'),     // ví dụ: 'Lỗi'
        }

        const statusColors: Record<PrinterJobStatus, string> = {
          printed: 'text-green-600',
          printing: 'text-blue-600',
          pending: 'text-gray-500',
          failed: 'text-red-600',
        }

        return (
          <div className="flex flex-col flex-wrap gap-x-3 text-xs font-medium xl:text-sm">
            {(['printed', 'printing', 'pending', 'failed'] as PrinterJobStatus[]).map(status => (
              <span key={status} className={statusColors[status]}>
                {statusLabels[status]}: {countByStatus[status]}
              </span>
            ))}
          </div>
        )
      }
    },
    {
      accessorKey: 'orderReferenceNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.orderReferenceNumber')} />
      ),
      cell: ({ row }) => {
        const order = row.original
        return <div className="text-sm">{order?.referenceNumber || 'N/A'}</div>
      },
    },
    {
      accessorKey: 'paymentMethod',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('order.paymentMethod')}
        />
      ),
      cell: ({ row }) => {
        const order = row.original
        let paymentMethodValue = '';
        if (order?.payment?.paymentMethod === PaymentMethod.CASH) {
          paymentMethodValue = t('order.cash');
        }
        if (order?.payment?.paymentMethod === PaymentMethod.BANK_TRANSFER) {
          paymentMethodValue = t('order.bankTransfer')
        }
        if (order?.payment?.paymentMethod === PaymentMethod.POINT) {
          paymentMethodValue = t('order.point')
        }
        if (order?.payment?.paymentMethod === PaymentMethod.CREDIT_CARD) {
          paymentMethodValue = t('order.creditCard')
        }
        return (
          <div className="flex flex-col">
            <span className="text-[0.8rem]">
              {paymentMethodValue}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'transactionId',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('order.transactionId')}
        />
      ),
      cell: ({ row }) => {
        const order = row.original
        let transactionIdValue = '';
        if (order?.payment?.paymentMethod === PaymentMethod.CREDIT_CARD) {
          transactionIdValue = order?.payment?.transactionId || ''
        }
        return (
          <div className="flex flex-col">
            <span className="text-[0.8rem]">
              {transactionIdValue}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'owner',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.owner')} />
      ),
      cell: ({ row }) => {
        const order = row.original
        return (
          <div className="text-sm">
            {order?.owner?.firstName || ''} {order?.owner?.lastName || ''}
          </div>
        )
      },
    },
    {
      accessorKey: 'pickupTime',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('menu.pickupTime')} />
      ),
      cell: ({ row }) => {
        const pickupTime = row.original.timeLeftTakeOut

        return row.original.type === OrderTypeEnum.TAKE_OUT ? (
          <div className={`text-sm ${pickupTime === 0 ? 'text-green-600' : 'text-destructive'}`}>
            {pickupTime === 0
              ? t('menu.immediately')
              : pickupTime
                ? `${t('menu.waiting')} ${pickupTime} ${t('menu.minutes')}`
                : ""}
          </div>
        ) : (
          <div className="text-sm">{row.original.type === OrderTypeEnum.AT_TABLE ? t('menu.dineIn') : row.original.type === OrderTypeEnum.TAKE_OUT ? t('order.take-out') : ''}</div>
        )
      },
    },
    {
      accessorKey: 'orderStatus',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.orderStatus')} />
      ),
      cell: ({ row }) => {
        const order = row.original
        return (
          <div className="flex flex-col">
            <OrderStatusBadge order={order} />
          </div>
        )
      },
    },
    {
      accessorKey: 'subtotal',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('order.subtotal')} />
      ),
      cell: ({ row }) => {
        const order = row.original
        return (
          <div className="text-sm">{formatCurrency(order?.subtotal || 0)}</div>
        )
      },
    },

    {
      id: 'actions',
      header: tCommon('common.action'),
      cell: ({ row }) => {
        const order = row.original
        const failedJobs = order.printerInvoices?.filter(job => job.status === PrinterJobStatus.FAILED) || []
        return (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0 w-8 h-8">
                  <span className="sr-only">{tCommon('common.action')}</span>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {tCommon('common.action')}
                </DropdownMenuLabel>

                {/* Update payment — admin payment screen */}
                {order?.slug &&
                  order?.table?.slug &&
                  order?.status === OrderStatus.PENDING &&
                  (!order?.payment?.statusCode ||
                    order?.payment.statusCode === paymentStatus.PENDING) && (
                    <Button
                      variant="ghost"
                      className="flex gap-1 justify-start px-2 w-full text-sm"
                      disabled={paymentPrecheckSlug === order.slug}
                      onClick={async (e) => {
                        e.stopPropagation()
                        const tableSlug = order.table!.slug
                        // Tầng 0 defensive: list endpoint có thể lệch với
                        // detail (sandbox quirk). Fetch fresh detail trước
                        // khi navigate. Nếu detail nói status ≠ pending →
                        // toast tại order-management, KHÔNG mở page payment
                        // để tránh user nhìn payment UI fake rồi mới bị
                        // bouncerr về bằng error banner.
                        setPaymentPrecheckSlug(order.slug)
                        try {
                          const fresh = await queryClient.fetchQuery({
                            queryKey: [...QUERYKEY.order, order.slug],
                            queryFn: () => getOrderBySlug(order.slug),
                            staleTime: 0,
                          })
                          const freshStatus = fresh.result?.status
                          if (freshStatus !== OrderStatus.PENDING) {
                            const label =
                              freshStatus === OrderStatus.PAID
                                ? 'đã được thanh toán'
                                : freshStatus === OrderStatus.FAILED
                                  ? 'đã bị huỷ'
                                  : 'đã được xử lý'
                            showErrorToastMessage(
                              `Đơn này ${label}, không thể tạo mã thanh toán mới.`,
                            )
                            return
                          }
                          openSession(
                            tableSlug,
                            order.table!.name ?? tableSlug,
                          )
                          // ?order=... → page payment đọc URL param thay vì
                          // session.orderSlug (cached có thể là đơn paid cũ
                          // ở cùng bàn → tránh nháy fetch nhầm + load wrong
                          // order).
                          navigate(
                            `/system/table/${tableSlug}/payment?order=${order.slug}`,
                          )
                        } catch {
                          openSession(
                            tableSlug,
                            order.table!.name ?? tableSlug,
                          )
                          navigate(
                            `/system/table/${tableSlug}/payment?order=${order.slug}`,
                          )
                        } finally {
                          setPaymentPrecheckSlug(null)
                        }
                      }}
                    >
                      {paymentPrecheckSlug === order.slug ? (
                        <Loader2 className="icon animate-spin" />
                      ) : (
                        <CreditCard className="icon" />
                      )}
                      {t('order.updatePayment')}
                    </Button>
                  )
                }

                {/* Update order — admin menu order flow */}
                {order?.slug &&
                  order?.table?.slug &&
                  order?.status === OrderStatus.PENDING &&
                  (!order?.payment || order?.payment?.statusCode === paymentStatus.PENDING) && (
                    <Button
                      variant="ghost"
                      className="flex gap-1 justify-start px-2 w-full text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        const tableSlug = order.table!.slug
                        openSession(tableSlug, order.table!.name ?? tableSlug)
                        navigate(`/system/menu?tab=menu&table=${tableSlug}`)
                      }}
                    >
                      <SquarePen className="icon" />
                      {t('order.updateOrder')}
                    </Button>
                  )
                }

                {/* Create chef order */}
                {order.chefOrders.length === 0 && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <CreateChefOrderDialog
                      order={order}
                    />
                  </div>
                )}

                {/* Export payment */}
                {order?.payment?.slug && order?.payment?.paymentMethod === PaymentMethod.BANK_TRANSFER && order?.payment?.statusCode === paymentStatus.PENDING && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportPayment(order.payment!.slug);
                    }}
                    variant="ghost"
                    className="flex gap-1 justify-start px-2 w-full"
                  >
                    <DownloadIcon />
                    {t('order.exportPayment')}
                  </Button>
                )}

                {/* Cancel order */}
                {isDeletePermissionValid &&
                  !(
                    order &&
                    (order.status === OrderStatus.PAID || order.status === OrderStatus.COMPLETED) &&
                    order.payment?.statusCode === paymentStatus.COMPLETED
                  ) && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <OutlineCancelOrderDialog order={order} />
                    </div>
                  )}
                {order.status !== OrderStatus.PENDING && failedJobs.length > 0 ? (
                  <Button
                    disabled={isReprinting}
                    variant="ghost"
                    className="flex justify-start px-2 w-full text-xs xl:text-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReprintFailedOrderPrinterJobs(order)
                    }}
                  >
                    {isReprinting && <Loader2 className="mr-2 animate-spin" />}
                    <DownloadIcon />
                    {t('order.reprintFailedOrderJobs')}
                  </Button>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return {
    columns,
    vatDialogOrder,
    closeVatDialog: () => setVatDialogOrder(null),
  }
}