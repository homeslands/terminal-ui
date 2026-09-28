import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import _ from 'lodash'
import moment from 'moment'
import Lottie from 'lottie-react'
import { Helmet } from 'react-helmet'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleX, Info, SquareMenu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import {
  useAutoPrintQRPayment,
  useAutoPrintTemporaryPayment,
  useBranchShiftGate,
  useExportPayment,
  useGetOrderProvisionalBill,
  useInitiatePayment,
  useOrderBySlug,
  usePaymentResolver,
  useValidateVoucherPaymentMethod,
} from '@/hooks'
import {
  APPLICABILITY_RULE,
  PaymentMethod,
  paymentStatus,
  Role,
  ROUTE,
  VOUCHER_TYPE,
  WORK_SHIFT_ERROR_CODE,
} from '@/constants'
import { getApiErrorCode } from '@/lib/api-error'
import {
  calculateOrderItemDisplay,
  calculatePlacedOrderTotals,
  formatCurrency,
  loadDataToPrinter,
  showErrorToast,
  showErrorToastMessage,
  showToast,
} from '@/utils'
import { ButtonLoading } from '@/components/app/loading'
import { OrderStatus, OrderTypeEnum } from '@/types'
import PaymentPageSkeleton from '@/app/client/payment/skeleton/page'
import { OrderCountdown } from '@/components/app/countdown'
import {
  useCartItemStore,
  useUpdateOrderStore,
  useOrderFlowStore,
  OrderFlowStep,
} from '@/stores'
import DownloadQrCode from '@/components/app/button/download-qr-code'
import LoadingAnimation from '@/assets/images/loading-animation.json'
import { StaffRemoveVoucherWhenPayingDialog } from '@/components/app/dialog'
import { StaffVoucherListSheetInPayment } from '@/components/app/sheet'
import {
  StaffLoyaltyPointSelector,
  StaffPaymentMethodSelect,
} from '@/components/app/select'
import { OrderItemPrice } from '@/components/app/order-item-price'
import { getItemPriceDisplay } from '@/lib/order-item-display'
import { ShiftGateBanner } from '@/components/work-shift/shift-gate-banner'

export default function PaymentPage() {
  const [searchParams] = useSearchParams()
  const { t } = useTranslation(['menu'])
  const { t: tToast } = useTranslation(['toast'])
  const { t: tHelmet } = useTranslation('helmet')
  const slug = searchParams.get('order')
  const navigate = useNavigate()
  const {
    mutate: getOrderProvisionalBill,
    isPending: isPendingGetOrderProvisionalBill,
  } = useGetOrderProvisionalBill()
  const { data: order, isPending, refetch: refetchOrder } = useOrderBySlug(slug)
  const ownerSlug =
    order?.owner?.firstName !== 'Default' ? order?.owner?.slug : null
  const { mutate: initiatePayment, isPending: isPendingInitiatePayment } =
    useInitiatePayment()
  const { mutate: validateVoucherPaymentMethod } =
    useValidateVoucherPaymentMethod()
  const { mutate: exportPayment, isPending: isPendingExportPayment } =
    useExportPayment()
  const { mutate: autoPrintQRPayment, isPending: isPendingAutoPrintQRPayment } =
    useAutoPrintQRPayment()
  const {
    mutate: autoPrintTemporaryPayment,
    isPending: isPendingAutoPrintTemporaryPayment,
  } = useAutoPrintTemporaryPayment()
  const { clearCart: clearCartItemStore } = useCartItemStore()
  const { clearStore: clearUpdateOrderStore } = useUpdateOrderStore()

  const [isPolling, setIsPolling] = useState<boolean>(false)
  const [isExpired, setIsExpired] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isRemoveVoucherOption, setIsRemoveVoucherOption] =
    useState<boolean>(false)
  const [previousPaymentMethod, setPreviousPaymentMethod] = useState<
    PaymentMethod | undefined
  >()
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<
    PaymentMethod | undefined
  >()
  const isRemovingVoucherRef = useRef<boolean>(false) // Track if voucher removal is in progress
  const {
    currentStep,
    paymentData,
    isHydrated,
    initializePayment,
    setCurrentStep,
    updatePaymentMethod,
    updateQrCode,
    setOrderFromAPI,
    clearPaymentData,
  } = useOrderFlowStore()

  const qrCodeSetRef = useRef<boolean>(false) // Track if QR code has been set to avoid repeated calls
  const initializedSlugRef = useRef<string>('') // Track initialized slug to avoid repeated initialization
  const timeDefaultExpired =
    'Sat Jan 01 2000 07:00:00 GMT+0700 (Indochina Time)' // Khi order không tồn tại
  const orderData = order

  const orderItems = order?.orderItems || []
  const voucher = order?.voucher || null
  const hasCustomPriceItems = orderItems.some(
    (i) => i.isCustomPrice || (i.customPrice != null && i.customPrice > 0),
  )

  const voucherPaymentMethods = useMemo(
    () => orderData?.voucher?.voucherPaymentMethods || [],
    [orderData?.voucher?.voucherPaymentMethods],
  )
  const deliveryFee = orderData?.deliveryFee || 0
  const accumulatedPointsToUse = orderData?.accumulatedPointsToUse || 0
  // Use payment resolver to get available methods and handle conflicts
  const {
    effectiveMethods,
    defaultMethod,
    disabledMethods,
    reasonMap,
    bannerMessage,
  } = usePaymentResolver(
    orderData || null,
    Role.STAFF,
    paymentData?.paymentMethod || null,
  )

  // Use payment method from order flow store, fallback to default method from payment resolver
  const paymentMethod = useMemo(() => {
    // Nếu đang có pending method (đang chờ remove voucher), ưu tiên dùng nó
    if (pendingPaymentMethod) {
      return pendingPaymentMethod
    }

    // Nếu có payment data từ store và method đó có trong effective methods, ưu tiên dùng nó
    if (
      paymentData?.paymentMethod &&
      effectiveMethods.includes(paymentData.paymentMethod)
    ) {
      return paymentData.paymentMethod
    }

    // Nếu có voucher, ưu tiên dùng method của voucher
    if (voucherPaymentMethods?.length > 0) {
      return voucherPaymentMethods[0].paymentMethod
    }

    // If no voucher, use method from payment resolver
    return defaultMethod || PaymentMethod.BANK_TRANSFER
  }, [
    pendingPaymentMethod,
    paymentData?.paymentMethod,
    voucherPaymentMethods,
    defaultMethod,
    effectiveMethods,
  ])

  // Check if there's a conflict between voucher payment methods and user's available payment methods
  const hasVoucherPaymentConflict = useMemo(() => {
    return effectiveMethods.length === 0 && !!voucher
  }, [effectiveMethods.length, voucher])

  const isDisabled = !paymentMethod || !slug

  // Work-shift gate: chặn nút thanh toán khi chi nhánh chưa có ca (CASHIER/
  // MANAGER+) hoặc khi role không có quyền tạo payment (STAFF). Xem
  // src/hooks/use-branch-shift-gate.ts.
  const { canPay, reason: shiftGateReason } = useBranchShiftGate(
    orderData?.branch,
  )

  const isPointReady =
    paymentMethod !== PaymentMethod.POINT ||
    !!(paymentData?.qrToken || paymentData?.transactionId)

  useEffect(() => {
    if (slug) {
      // Initialize payment phase with order slug
      if (
        slug !== initializedSlugRef.current ||
        currentStep !== OrderFlowStep.PAYMENT
      ) {
        // Use current payment method from store if available, otherwise fallback to voucher method
        // const currentPaymentMethod = (voucherPaymentMethods?.[0]?.paymentMethod || PaymentMethod.BANK_TRANSFER) as PaymentMethod
        initializePayment(slug, paymentMethod as PaymentMethod)

        // Mark as initialized only for new slugs
        if (slug !== initializedSlugRef.current) {
          initializedSlugRef.current = slug
          qrCodeSetRef.current = false // Reset QR code tracking for new order
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, currentStep, initializePayment])

  // Ensure we're in ORDERING phase when component mounts
  useEffect(() => {
    if (isHydrated) {
      const paymentMethod = voucherPaymentMethods.find(
        (method) => method.paymentMethod === PaymentMethod.BANK_TRANSFER,
      )
      // Switch to ORDERING phase if we're not in PAYMENT phase
      if (currentStep !== OrderFlowStep.PAYMENT) {
        setCurrentStep(OrderFlowStep.PAYMENT)
      }

      // Initialize ordering data if it doesn't exist
      if (!paymentData) {
        initializePayment(
          slug as string,
          paymentMethod?.paymentMethod as PaymentMethod,
        )
        return
      }
    }
  }, [
    isHydrated,
    currentStep,
    paymentData,
    setCurrentStep,
    initializePayment,
    slug,
    voucherPaymentMethods,
  ])

  const displayItems = calculateOrderItemDisplay(orderItems, voucher)
  const cartTotals = calculatePlacedOrderTotals(
    displayItems,
    voucher,
    deliveryFee,
    accumulatedPointsToUse,
  )

  // Get QR code from Order Flow Store or orderData as fallback
  const qrCode = paymentData?.qrCode || orderData?.payment?.qrCode || ''
  const paymentSlug = orderData?.payment?.slug || ''

  // Stable sync function
  const paymentStoreVoucherSlug = paymentData?.orderData?.voucher?.slug || null
  const orderVoucherSlug = orderData?.voucher?.slug || null
  const paymentStoreUpdatedAt =
    (paymentData?.orderData as { updatedAt?: string })?.updatedAt || null
  const orderUpdatedAt =
    (orderData as { updatedAt?: string })?.updatedAt || null

  const handleSyncOrderData = useCallback(() => {
    if (orderData && slug && paymentData?.orderSlug === slug) {
      // Check if payment has changed (new payment from API)
      const apiHasPayment = !!orderData.payment
      const storeHasPayment = !!paymentData.orderData?.payment
      const paymentChanged =
        apiHasPayment !== storeHasPayment ||
        (apiHasPayment &&
          storeHasPayment &&
          orderData.payment?.slug !== paymentData.orderData?.payment?.slug)

      const shouldSync =
        !paymentData.orderData ||
        paymentData.orderData.slug !== orderData.slug ||
        paymentStoreVoucherSlug !== orderVoucherSlug ||
        paymentChanged ||
        (paymentStoreUpdatedAt && orderUpdatedAt
          ? paymentStoreUpdatedAt !== orderUpdatedAt
          : false)

      if (shouldSync) {
        setOrderFromAPI(orderData)
      }
    }
  }, [
    orderData,
    slug,
    paymentData?.orderSlug,
    paymentData?.orderData,
    paymentStoreVoucherSlug,
    orderVoucherSlug,
    paymentStoreUpdatedAt,
    orderUpdatedAt,
    setOrderFromAPI,
  ])

  useEffect(() => {
    handleSyncOrderData()
  }, [handleSyncOrderData])

  // Check voucher payment method compatibility on render
  useEffect(() => {
    // Skip if voucher removal is in progress to avoid double dialog
    if (isRemovingVoucherRef.current) {
      return
    }

    if (hasVoucherPaymentConflict && voucher && !isRemoveVoucherOption) {
      // Automatically show remove voucher dialog when there's a conflict
      setIsRemoveVoucherOption(true)
    }
    // Reset dialog state when voucher is removed (voucher becomes null)
    else if (!voucher && isRemoveVoucherOption) {
      setIsRemoveVoucherOption(false)
    }
  }, [hasVoucherPaymentConflict, voucher, isRemoveVoucherOption])

  // Stable QR code update function
  const handleUpdateQrCode = useCallback(() => {
    if (qrCode && qrCode.trim() !== '' && !qrCodeSetRef.current) {
      updateQrCode(qrCode)
      qrCodeSetRef.current = true
    }
  }, [qrCode, updateQrCode])

  useEffect(() => {
    handleUpdateQrCode()
  }, [handleUpdateQrCode])

  // Check voucher payment method compatibility on render
  useEffect(() => {
    // Skip if voucher removal is in progress to avoid double dialog
    if (isRemovingVoucherRef.current) {
      return
    }

    if (hasVoucherPaymentConflict && voucher && !isRemoveVoucherOption) {
      // Automatically show remove voucher dialog when there's a conflict
      setIsRemoveVoucherOption(true)
    }
    // Reset dialog state when voucher is removed (voucher becomes null)
    else if (!voucher && isRemoveVoucherOption) {
      setIsRemoveVoucherOption(false)
    }
  }, [hasVoucherPaymentConflict, voucher, isRemoveVoucherOption])

  const handleGetOrderProvisionalBill = (slug: string) => {
    getOrderProvisionalBill(slug, {
      onSuccess: (data: Blob) => {
        showToast(tToast('toast.exportOrderProvisionalBillSuccess'))
        // Load data to print
        loadDataToPrinter(data)
      },
    })
  }

  // Check if payment amount matches order subtotal and QR code is valid
  const hasValidPaymentAndQr =
    orderData?.payment?.amount != null &&
    orderData?.subtotal != null &&
    orderData.payment.amount === orderData.subtotal &&
    qrCode &&
    qrCode.trim() !== ''

  // Debug logs to check payment validation
  useEffect(() => {
    if (orderData) {
      // Remove debug logs for production
    }
  }, [orderData, qrCode, hasValidPaymentAndQr, paymentMethod])

  useEffect(() => {
    if (isExpired) {
      setIsPolling(false)
    }
  }, [isExpired])

  // Start polling when QR code exists and payment is valid, or when payment method is selected
  useEffect(() => {
    if (
      !isExpired &&
      (paymentMethod === PaymentMethod.BANK_TRANSFER ||
        paymentMethod === PaymentMethod.CASH ||
        paymentMethod === PaymentMethod.CREDIT_CARD)
    ) {
      if (hasValidPaymentAndQr) {
        // Case 1: Valid QR code - check if payment is completed
        if (orderData.payment.statusMessage === paymentStatus.COMPLETED) {
          setIsPolling(false)
        } else {
          setIsPolling(true)
        }
      } else if (
        orderData?.payment &&
        orderData.payment.amount !== orderData.subtotal
      ) {
        // Case 2: Payment exists but amount doesn't match - start polling for status updates
        setIsPolling(true)
      } else if (
        orderData?.payment &&
        !qrCode &&
        orderData.payment.amount === orderData.subtotal
      ) {
        // Case 3: Payment exists but no QR code (amount < 2000) - start polling
        setIsPolling(true)
      } else if (!orderData?.payment) {
        // Case 4: No payment exists yet - start polling to wait for payment creation
        setIsPolling(true)
      } else if (
        paymentMethod === PaymentMethod.CREDIT_CARD &&
        orderData?.payment
      ) {
        // Case 5: CREDIT_CARD - Payment exists, check if order is PAID
        // For CREDIT_CARD, continue polling until order status is PAID
        if (orderData.status === OrderStatus.PAID) {
          setIsPolling(false)
        } else {
          setIsPolling(true)
        }
      } else {
        // Case 6: Other cases - stop polling only if order is already PAID
        if (orderData?.status === OrderStatus.PAID) {
          setIsPolling(false)
        } else {
          // Keep current polling state, don't force stop
          // This prevents overriding manual polling start from handleConfirmPayment
        }
      }
    } else {
      setIsPolling(false)
    }
  }, [hasValidPaymentAndQr, isExpired, orderData, paymentMethod, qrCode])

  // Stable polling function
  const handlePolling = useCallback(async () => {
    const updatedOrder = await refetchOrder()
    const orderStatus = updatedOrder.data?.status
    const updatedOrderData = updatedOrder.data

    // Sync order data with Order Flow Store
    if (updatedOrderData) {
      // setOrderFromAPI(updatedOrderData)
    }

    // Only update QR code if it's not already set and becomes available during polling
    if (
      updatedOrderData?.payment?.qrCode &&
      updatedOrderData.payment.qrCode.trim() !== '' &&
      !qrCodeSetRef.current
    ) {
      updateQrCode(updatedOrderData.payment.qrCode)
      qrCodeSetRef.current = true
    }

    if (orderStatus === OrderStatus.PAID) {
      // Sync orderData vào store TRƯỚC KHI clear để customer-display có thể detect PAID
      // Đảm bảo sync với status PAID vào store (updatedOrderData.status === "paid")
      if (
        updatedOrderData &&
        updatedOrderData.status === OrderStatus.PAID &&
        paymentData?.orderSlug === updatedOrderData.slug
      ) {
        setOrderFromAPI(updatedOrderData)
      }

      // Delay một chút để đảm bảo customer-display có thể detect PAID từ store
      // Sau đó mới clear và navigate
      setTimeout(() => {
        clearCartItemStore()
        clearUpdateOrderStore()
        clearPaymentData()
        setIsLoading(false)
        navigate(`${ROUTE.ORDER_SUCCESS}/${slug}`)
      }, 200) // Delay 200ms để đảm bảo store được update và customer-display có thể detect

      return true // Signal to stop polling
    } else {
      // Turn off loading if order is updated but not yet paid (for orders without QR code)
      if (
        updatedOrderData?.payment &&
        !updatedOrderData.payment.qrCode &&
        updatedOrderData.payment.amount === updatedOrderData.subtotal
      ) {
        setIsLoading(false)
      }
      return false // Continue polling
    }
  }, [
    refetchOrder,
    updateQrCode,
    clearCartItemStore,
    clearUpdateOrderStore,
    clearPaymentData,
    navigate,
    slug,
    paymentData?.orderSlug,
    setOrderFromAPI,
  ])

  //polling order status every 3 seconds
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null

    if (isPolling) {
      pollingInterval = setInterval(async () => {
        const shouldStop = await handlePolling()
        if (shouldStop && pollingInterval) {
          clearInterval(pollingInterval)
        }
      }, 2000)
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }, [isPolling, handlePolling])

  const handleSelectPaymentMethod = (
    selectedPaymentMethod: PaymentMethod,
    transactionId?: string,
    qrToken?: string,
  ) => {
    // Lưu method hiện tại để có thể restore nếu validate fail
    setPreviousPaymentMethod(paymentMethod as PaymentMethod)

    // Set pending method ngay để UI cập nhật mượt mà
    setPendingPaymentMethod(selectedPaymentMethod)

    // Check if selected method is disabled
    const isMethodDisabled = disabledMethods.includes(selectedPaymentMethod)

    // Show dialog if method is disabled
    if (isMethodDisabled) {
      if (!isRemoveVoucherOption) {
        setIsRemoveVoucherOption(true)
      }
      setIsLoading(false)
      return
    }

    if (voucher?.slug) {
      validateVoucherPaymentMethod(
        { slug: voucher.slug, paymentMethod: selectedPaymentMethod },
        {
          onSuccess: () => {
            updatePaymentMethod(selectedPaymentMethod, transactionId, qrToken)
            setPendingPaymentMethod(undefined)
            setPreviousPaymentMethod(undefined)
            setIsLoading(false)
          },
          onError: () => {
            setPendingPaymentMethod(undefined)
            setIsRemoveVoucherOption(true)
            setIsLoading(false)
          },
        },
      )
    } else {
      updatePaymentMethod(selectedPaymentMethod, transactionId, qrToken)
      setPendingPaymentMethod(undefined)
      setPreviousPaymentMethod(undefined)
      setIsLoading(false)
    }
  }

  // Work-shift gate: BE chặn tạo payment khi chi nhánh chưa có ca (161003)
  // hoặc STAFF không có quyền tạo payment (161006). meta.ignoreGlobalError =
  // true trên useInitiatePayment nên global MutationCache không tự toast —
  // phải bắt và toast thủ công tại mọi call site initiatePayment.
  const handleInitiatePaymentError = (err: unknown) => {
    setIsLoading(false)
    const code = getApiErrorCode(err)
    if (
      code === WORK_SHIFT_ERROR_CODE.BRANCH_NO_ACTIVE ||
      code === WORK_SHIFT_ERROR_CODE.PAYMENT_FORBIDDEN_FOR_STAFF
    ) {
      showErrorToast(code)
      return
    }
    showErrorToastMessage('toast.requestFailed')
  }

  const handleConfirmPayment = () => {
    if (!slug || !paymentMethod) return
    setIsLoading(true)

    if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
      initiatePayment(
        { orderSlug: slug, paymentMethod },
        {
          onSuccess: (data) => {
            // Fast-path: đơn nhỏ (< ~2000đ) BE bỏ qua QR và auto-complete
            // payment ngay. Polling sẽ kẹt nếu BE không đồng thời mark order
            // status = PAID. Detect bằng statusMessage/statusCode = 'completed'
            // và navigate luôn — không cần đợi polling.
            const status =
              (data.result.statusMessage ?? data.result.statusCode) || ''
            if (!data.result.qrCode && String(status).toLowerCase() === 'completed') {
              clearPaymentData()
              navigate(`${ROUTE.ORDER_SUCCESS}/${slug}`)
              return
            }
            // Set QR code immediately from response if available
            if (data.result.qrCode && data.result.qrCode.trim() !== '') {
              updateQrCode(data.result.qrCode)
              qrCodeSetRef.current = true
            }
            // Refetch order to get latest payment data and sync with customer display
            refetchOrder()
            setIsPolling(true)

            // Only turn off loading if we get a QR code (amount > 2000)
            if (data.result.qrCode) {
              setIsLoading(false)
            }
          },
          onError: handleInitiatePaymentError,
        },
      )
    } else if (paymentMethod === PaymentMethod.CASH) {
      initiatePayment(
        { orderSlug: slug, paymentMethod },
        {
          onSuccess: () => {
            // Điều hướng ngay khi thanh toán CASH thành công (giống client page)
            clearPaymentData()
            navigate(`${ROUTE.ORDER_SUCCESS}/${slug}`)
          },
          onError: handleInitiatePaymentError,
        },
      )
    } else if (paymentMethod === PaymentMethod.CREDIT_CARD) {
      initiatePayment(
        {
          orderSlug: slug,
          paymentMethod,
          transactionId: paymentData?.transactionId,
        },
        {
          onSuccess: () => {
            setIsPolling(true)
            refetchOrder()
          },
          onError: handleInitiatePaymentError,
        },
      )
    } else if (paymentMethod === PaymentMethod.POINT) {
      initiatePayment(
        {
          orderSlug: slug,
          paymentMethod,
          membershipCard: paymentData?.qrToken
            ? undefined
            : paymentData?.transactionId,
          qrToken: paymentData?.qrToken || undefined,
        },
        {
          onSuccess: () => {
            // Điều hướng ngay khi thanh toán POINT thành công (giống CASH - thanh toán ngay lập tức)
            clearPaymentData()
            navigate(`${ROUTE.ORDER_SUCCESS}/${slug}`)
          },
          onError: handleInitiatePaymentError,
        },
      )
    }
  }

  const handleExportPayment = () => {
    if (!slug) return
    exportPayment(paymentSlug, {
      onSuccess: (data: Blob) => {
        showToast(tToast('toast.exportPaymentSuccess'))
        // Load data to print
        loadDataToPrinter(data)
      },
    })
  }

  const handleAutoPrintQRPayment = () => {
    if (!slug) return
    autoPrintQRPayment(slug, {
      onSuccess: () => {
        showToast(tToast('toast.autoPrintQRPaymentSuccess'))
      },
      onError: () => {
        showToast(tToast('toast.autoPrintQRPaymentError'))
      },
    })
  }

  const handleAutoPrintTemporaryPayment = () => {
    if (!slug) return
    autoPrintTemporaryPayment(slug, {
      onSuccess: () => {
        showToast(tToast('toast.autoPrintTemporaryPaymentSuccess'))
      },
      onError: () => {
        showToast(tToast('toast.autoPrintTemporaryPaymentError'))
      },
    })
  }

  const handleExpire = useCallback(
    (value: boolean) => {
      setIsExpired(value)
      if (value) {
        // Clear payment store when order expires
        clearPaymentData()
      }
    },
    [clearPaymentData],
  )

  if (isExpired) {
    return (
      <div className="container py-20 lg:h-[60vh]">
        <div className="flex flex-col items-center justify-center gap-5">
          <CircleX className="h-32 w-32 text-destructive" />
          <p className="text-center text-muted-foreground">
            {t('order.orderExpired')}
          </p>
          <Button variant="default" onClick={() => navigate(-1)}>
            {t('order.goBackToMenu')}
          </Button>
        </div>
      </div>
    )
  }

  if (isPending) return <PaymentPageSkeleton />

  return (
    <div>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-40">
          <div className="h-64 w-64">
            <Lottie animationData={LoadingAnimation} loop={true} />
          </div>
        </div>
      )}
      <Helmet>
        <meta charSet="utf-8" />
        <title>{tHelmet('helmet.payment.title')}</title>
        <meta name="description" content={tHelmet('helmet.bankConfig.title')} />
      </Helmet>
      <OrderCountdown
        createdAt={order?.createdAt || timeDefaultExpired}
        setIsExpired={handleExpire}
      />
      <span className="flex w-full items-center justify-start gap-1 text-lg">
        <SquareMenu />
        {t('menu.payment')}
        {order?.type === OrderTypeEnum.AT_TABLE && order?.table?.name && (
          <span className="ml-1 rounded bg-primary px-2 py-0.5 text-sm font-bold text-primary-foreground">
            Bàn {order.table.name}
          </span>
        )}
        <span className="text-muted-foreground">#{slug}</span>
      </span>
      <div className="mt-2 flex w-full flex-col gap-3">
        {order && (
          <div className="w-full space-y-2">
            {/* Customer Information */}
            <div className="grid grid-cols-1 items-center justify-between rounded-sm bg-background py-2 sm:grid-cols-2">
              <div className="col-span-1 flex flex-col gap-1 sm:border-r">
                <div className="grid grid-cols-2 gap-2">
                  <h3 className="col-span-1 text-sm font-bold">
                    {t('order.customerName')}
                  </h3>
                  <p className="text-sm font-semibold">{`${order.owner.lastName} ${order.owner.firstName}`}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <h3 className="col-span-1 text-sm font-bold">
                    {t('order.orderDate')}
                  </h3>
                  <span className="text-sm">
                    {moment(order.createdAt).format('HH:mm DD/MM/YYYY')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <h3 className="col-span-1 text-sm font-bold">
                    {t('order.phoneNumber')}
                  </h3>
                  <p className="text-sm">{order.owner.phonenumber}</p>
                </div>
              </div>
              {/* Delivery Information */}
              <div className="col-span-1 flex flex-col gap-1 sm:px-4">
                <div className="grid grid-cols-2 gap-2">
                  <h3 className="col-span-1 text-sm font-bold">
                    {t('order.deliveryMethod')}
                  </h3>
                  <p className="col-span-1 text-sm">
                    {order.type === OrderTypeEnum.AT_TABLE
                      ? t('order.dineIn')
                      : order.type === OrderTypeEnum.DELIVERY
                        ? t('order.delivery')
                        : t('order.takeAway')}
                    {order.type === OrderTypeEnum.TAKE_OUT && (
                      <>
                        {' - '}
                        {order.timeLeftTakeOut === 0
                          ? t('menu.immediately')
                          : `${t('menu.waiting')} ${order.timeLeftTakeOut} ${t('menu.minutes')}`}
                      </>
                    )}
                  </p>
                </div>
                {order?.type === OrderTypeEnum.AT_TABLE && order?.table && (
                  <div className="grid grid-cols-2 gap-2">
                    <h3 className="col-span-1 text-sm font-bold">
                      {t('order.location')}
                    </h3>
                    <p className="col-span-1 text-sm">
                      {order.table ? order.table.name : ''}
                    </p>
                  </div>
                )}
                {order?.type === OrderTypeEnum.DELIVERY &&
                  order?.deliveryTo && (
                    <div className="grid grid-cols-2 gap-2">
                      <h3 className="col-span-1 text-sm font-bold">
                        {t('order.deliveryAddress')}
                      </h3>
                      <p className="col-span-1 text-sm">
                        {order?.deliveryTo?.formattedAddress}
                      </p>
                    </div>
                  )}
                {order?.type === OrderTypeEnum.DELIVERY &&
                  order?.deliveryPhone && (
                    <div className="grid grid-cols-2 gap-2">
                      <h3 className="col-span-1 text-sm font-bold">
                        {t('order.deliveryPhone')}
                      </h3>
                      <p className="col-span-1 text-sm">
                        {order.deliveryPhone}
                      </p>
                    </div>
                  )}
                <div className="grid grid-cols-2 gap-2">
                  <h3 className="col-span-1 text-sm font-bold">
                    {t('order.note')}
                  </h3>
                  <p className="col-span-1 text-sm">
                    {order.description || t('order.noNote')}
                  </p>
                </div>
              </div>
            </div>
            {/* Order Information */}
            <div className="mb-2 grid w-full grid-cols-4 rounded-md bg-muted-foreground/10 px-4 py-3 text-sm font-thin">
              <span className="col-span-1">{t('order.product')}</span>
              <span className="col-span-1">{t('order.unitPrice')}</span>
              <span className="col-span-1 text-center">
                {t('order.quantity')}
              </span>
              <span className="col-span-1 text-right">
                {t('order.grandTotal')}
              </span>
            </div>
            <div className="flex w-full flex-col rounded-md border bg-background">
              {order?.orderItems.map((item) => (
                <div
                  key={item.slug}
                  className="grid w-full items-center gap-4 border-b p-4 pb-4"
                >
                  {(() => {
                    if (item?.variant?.product?.isCustomPrice === true) {
                      const price = item.customPrice ?? 0
                      return (
                        <div className="grid w-full grid-cols-4 flex-row items-center">
                          <div className="col-span-1 flex w-full gap-2">
                            <span className="w-full truncate text-wrap text-[12px] font-bold sm:text-sm lg:text-base">
                              {item.variant.product.name}
                            </span>
                          </div>
                          <div className="col-span-1 flex items-center">
                            <span className="font-bold text-primary">
                              {formatCurrency(price)}
                            </span>
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <span className="text-sm">
                              {item.quantity || 0}
                            </span>
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="text-sm">
                              {formatCurrency(price * (item.quantity || 1))}
                            </span>
                          </div>
                        </div>
                      )
                    }

                    const display = getItemPriceDisplay(
                      {
                        unitPrice: item.variant.price || 0,
                        quantity: 1,
                        productSlug: item.variant.product.slug,
                        promotionValue: item.promotion?.value,
                        isCustomPrice: item.isCustomPrice,
                        customPrice: item.customPrice,
                      },
                      voucher,
                    )
                    return (
                      <div className="grid w-full grid-cols-4 flex-row items-center">
                        <div className="col-span-1 flex w-full gap-2">
                          <div className="flex w-full flex-col items-center justify-start gap-2 sm:flex-row sm:justify-center">
                            <span className="w-full truncate text-wrap text-[12px] font-bold sm:text-sm lg:text-base">
                              {item.variant.product.name}
                            </span>
                          </div>
                        </div>
                        <div className="col-span-1 flex items-center">
                          <OrderItemPrice
                            originalPrice={display.originalPrice}
                            finalPrice={display.finalPrice}
                            showStrikethrough={display.showStrikethrough}
                            promoLabel={display.promoLabel}
                            voucherLabel={display.voucherLabel}
                            formatter={formatCurrency}
                            className="w-28"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <span className="text-sm">{item.quantity || 0}</span>
                        </div>
                        <div className="col-span-1 text-right">
                          <span className="text-sm">
                            {formatCurrency(
                              display.finalPrice * (item.quantity || 0),
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                  {item.note && (
                    <div className="grid w-full grid-cols-9 items-center text-sm">
                      <span className="col-span-2 font-semibold sm:col-span-1">
                        {t('order.note')}:{' '}
                      </span>
                      <span className="col-span-7 w-full rounded-md border border-muted-foreground/40 p-2 sm:col-span-8">
                        {item.note}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex w-full flex-col items-end gap-2 p-4">
                <div className="flex w-[20rem] flex-col">
                  {!hasCustomPriceItems &&
                    (() => {
                      const subTotal = order?.originalSubtotal || 0
                      const promo = cartTotals?.promotionDiscount || 0
                      const voucherDisc = cartTotals?.voucherDiscount || 0
                      const preVatTotal = Math.max(
                        0,
                        subTotal - promo - voucherDisc,
                      )

                      const totalVatAmount = orderItems.reduce(
                        (sum, it) => sum + (it.vatValue ?? 0),
                        0,
                      )

                      const vatRates = orderItems
                        .map(
                          (it) =>
                            it.vatRate ?? it.variant?.product?.vatRate ?? 0,
                        )
                        .filter((r) => r > 0)
                      const uniqueRates = [...new Set(vatRates)]
                      const vatRateLabel =
                        uniqueRates.length === 1
                          ? `VAT (${uniqueRates[0]}%)`
                          : 'VAT'

                      const hasItemsWithPromotion = orderItems.some(
                        (it) => (it.promotion?.value ?? 0) > 0,
                      )
                      const voucherDropsPromotion =
                        !!voucher &&
                        (voucher.applicabilityRule ===
                          APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED ||
                          voucher.type === VOUCHER_TYPE.SAME_PRICE_PRODUCT)
                      const isPromoDroppedByVoucher =
                        hasItemsWithPromotion &&
                        voucherDropsPromotion &&
                        promo === 0
                      const showPromotionRow =
                        promo > 0 || isPromoDroppedByVoucher

                      return (
                        <>
                          <div className="flex w-full justify-between pb-4">
                            <h3 className="text-sm font-medium">
                              {t('order.total')}
                            </h3>
                            <p className="text-sm font-semibold tabular-nums">
                              {`${formatCurrency(subTotal)}`}
                            </p>
                          </div>
                          {showPromotionRow && (
                            <div className="flex w-full justify-between pb-4">
                              <h3
                                className={`inline-flex items-center gap-1 text-sm font-medium italic ${
                                  isPromoDroppedByVoucher
                                    ? 'text-muted-foreground'
                                    : 'text-green-500'
                                }`}
                              >
                                {t('order.promotionDiscount')}
                                {isPromoDroppedByVoucher && (
                                  <TooltipProvider delayDuration={150}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs"
                                      >
                                        Khuyến mãi không áp dụng khi món đang dùng
                                        voucher
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </h3>
                              <p
                                className={`text-sm font-semibold italic tabular-nums ${
                                  isPromoDroppedByVoucher
                                    ? 'text-muted-foreground'
                                    : 'text-green-500'
                                }`}
                              >
                                - {`${formatCurrency(promo)}`}
                              </p>
                            </div>
                          )}
                          <div className="flex w-full justify-between pb-4">
                            <h3 className="text-sm font-medium italic text-green-500">
                              {t('order.voucher')}
                            </h3>
                            <p className="text-sm font-semibold italic tabular-nums text-green-500">
                              - {`${formatCurrency(voucherDisc)}`}
                            </p>
                          </div>
                          <div className="flex w-full justify-between pb-4">
                            <h3 className="text-sm font-medium italic text-primary">
                              {t('order.loyaltyPoint')}
                            </h3>
                            <p className="text-sm font-semibold italic tabular-nums text-primary">
                              -{' '}
                              {`${formatCurrency(order.accumulatedPointsToUse || 0)}`}
                            </p>
                          </div>
                          <div className="flex w-full justify-between border-b pb-4">
                            <h3 className="text-sm font-medium italic text-muted-foreground/60">
                              {t('order.deliveryFee')}
                            </h3>
                            <p className="text-sm font-semibold italic tabular-nums text-muted-foreground/60">
                              {`${formatCurrency(order.deliveryFee || 0)}`}
                            </p>
                          </div>
                          {/* P1: Tạm tính sau giảm */}
                          <div className="flex w-full justify-between pt-4">
                            <h3 className="text-sm font-semibold">
                              Tạm tính sau giảm
                            </h3>
                            <p className="text-sm font-semibold tabular-nums">
                              {formatCurrency(preVatTotal)}
                            </p>
                          </div>
                          {/* P1: VAT */}
                          {totalVatAmount > 0 && (
                            <div className="flex w-full justify-between pt-2">
                              <h3 className="text-sm italic text-muted-foreground">
                                {vatRateLabel}
                              </h3>
                              <p className="text-sm italic tabular-nums text-muted-foreground">
                                +{formatCurrency(totalVatAmount)}
                              </p>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  <div className="flex flex-col py-4">
                    <div className="flex w-full justify-between">
                      <h3 className="text-md font-semibold">
                        {t('order.totalPayment')}
                      </h3>
                      <p
                        className={`text-2xl font-extrabold tabular-nums ${hasCustomPriceItems ? 'text-orange-600' : 'text-primary'}`}
                      >
                        {`${formatCurrency(order.subtotal)}`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!hasCustomPriceItems && (
              <StaffVoucherListSheetInPayment
                order={order}
                onSuccess={() => {
                  refetchOrder().then(() => {
                    if (slug) {
                      initializePayment(
                        slug,
                        (paymentData?.paymentMethod ||
                          paymentMethod) as PaymentMethod,
                      )
                    }
                  })
                }}
              />
            )}

            {/* Remove Voucher Dialog */}
            {isRemoveVoucherOption && (
              <StaffRemoveVoucherWhenPayingDialog
                voucher={voucher}
                selectedPaymentMethod={
                  pendingPaymentMethod ||
                  paymentMethod ||
                  PaymentMethod.BANK_TRANSFER
                }
                previousPaymentMethod={previousPaymentMethod}
                isOpen={isRemoveVoucherOption}
                onOpenChange={setIsRemoveVoucherOption}
                order={order}
                onRemoveStart={() => {
                  // Set flag immediately when user clicks remove
                  isRemovingVoucherRef.current = true
                }}
                onCancel={() => {
                  // Reset pending payment method sau khi cancel
                  setPendingPaymentMethod(undefined)
                  // Reset previous payment method
                  setPreviousPaymentMethod(undefined)
                  // Reset voucher removal flag
                  isRemovingVoucherRef.current = false
                }}
                onSuccess={() => {
                  // Không reset initializedSlugRef để tránh trigger lại initializePayment
                  qrCodeSetRef.current = false

                  // Explicitly close dialog FIRST to prevent flicker
                  setIsRemoveVoucherOption(false)

                  // Reset states sau khi đã sync order data
                  setPreviousPaymentMethod(undefined)

                  // Sync updated order data với Order Flow Store
                  // setOrderFromAPI(updatedOrder)
                  const selectedMethod =
                    pendingPaymentMethod || PaymentMethod.BANK_TRANSFER

                  // Reset states sau khi đã sync order data
                  setPendingPaymentMethod(selectedMethod as PaymentMethod)

                  // Update payment method in store immediately BEFORE refetch
                  updatePaymentMethod(
                    selectedMethod as PaymentMethod,
                    paymentData?.transactionId,
                    paymentData?.qrToken,
                  )

                  // Refetch order data immediately
                  refetchOrder().then(() => {
                    // Re-initialize payment with updated order data (no voucher)
                    if (slug) {
                      initializePayment(
                        slug,
                        (paymentData?.paymentMethod ||
                          selectedMethod) as PaymentMethod,
                      )
                    }

                    // Reset flag after everything is complete - allow new voucher dialogs
                    setTimeout(() => {
                      isRemovingVoucherRef.current = false
                      setPendingPaymentMethod(undefined)
                    }, 100)
                  })
                }}
              />
            )}

            {/* Payment method */}
            {/* Show banner message if exists */}
            {bannerMessage && (
              <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                <p>{bannerMessage}</p>
              </div>
            )}
            <StaffPaymentMethodSelect
              order={order}
              paymentMethod={effectiveMethods}
              defaultMethod={paymentMethod as PaymentMethod}
              disabledMethods={disabledMethods}
              disabledReasons={reasonMap}
              qrCode={hasValidPaymentAndQr ? qrCode : ''}
              total={order ? order.subtotal : 0}
              onSubmit={handleSelectPaymentMethod}
              initialQrToken={paymentData?.qrToken}
            />
            {!hasCustomPriceItems &&
              order?.owner.firstName !== 'Default' &&
              order?.owner.role.name === Role.CUSTOMER && (
                <StaffLoyaltyPointSelector
                  usedPoints={order.accumulatedPointsToUse}
                  orderSlug={slug ?? ''}
                  ownerSlug={ownerSlug ?? null}
                  total={order.subtotal}
                  onSuccess={() => {
                    refetchOrder().then(() => {
                      // Re-initialize payment with updated order data after voucher update
                      if (slug) {
                        initializePayment(
                          slug,
                          (paymentData?.paymentMethod ||
                            paymentMethod) as PaymentMethod,
                        )
                      }
                    })
                  }}
                />
              )}
          </div>
        )}
        <ShiftGateBanner reason={shiftGateReason} className="mx-2 mt-4" />
        <div className="flex flex-wrap-reverse justify-between gap-2 px-2 py-6">
          <Button className="w-fit" onClick={() => navigate(-1)}>
            {t('order.backToMenu')}
          </Button>
          {(paymentMethod === PaymentMethod.BANK_TRANSFER ||
            paymentMethod === PaymentMethod.CASH ||
            paymentMethod === PaymentMethod.CREDIT_CARD ||
            paymentMethod === PaymentMethod.POINT) && (
            <div className="flex justify-end gap-2">
              {/* Chỉ hiển thị nếu là BANK_TRANSFER và có QR */}
              {hasValidPaymentAndQr &&
              paymentMethod === PaymentMethod.BANK_TRANSFER ? (
                <>
                  <DownloadQrCode qrCode={qrCode} slug={slug} />
                  <Button
                    disabled={isDisabled || isPendingExportPayment}
                    className="w-fit"
                    onClick={handleExportPayment}
                  >
                    {isPendingExportPayment && <ButtonLoading />}
                    {t('paymentMethod.exportPayment')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isDisabled || isPendingAutoPrintQRPayment}
                    className="w-fit"
                    onClick={() => handleAutoPrintQRPayment()}
                  >
                    {isPendingAutoPrintQRPayment && <ButtonLoading />}
                    {t('paymentMethod.autoPrintQRPayment')}
                  </Button>
                </>
              ) : (
                <Button
                  disabled={
                    isDisabled ||
                    isPendingInitiatePayment ||
                    !isPointReady ||
                    !canPay
                  }
                  className="w-fit"
                  onClick={handleConfirmPayment}
                >
                  {isPendingInitiatePayment && <ButtonLoading />}
                  {t('paymentMethod.confirmPayment')}
                </Button>
              )}

              {/* Nút này luôn hiển thị nếu là transfer, cash, hoặc point */}
              {(paymentMethod === PaymentMethod.BANK_TRANSFER ||
                paymentMethod === PaymentMethod.CASH ||
                paymentMethod === PaymentMethod.POINT) && (
                <>
                  <Button
                    disabled={isDisabled || isPendingGetOrderProvisionalBill}
                    className="w-fit"
                    onClick={() =>
                      handleGetOrderProvisionalBill(slug as string)
                    }
                  >
                    {isPendingGetOrderProvisionalBill && <ButtonLoading />}
                    {t('paymentMethod.exportOrderProvisionalBill')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isDisabled || isPendingAutoPrintTemporaryPayment}
                    className="w-fit"
                    onClick={() => handleAutoPrintTemporaryPayment()}
                  >
                    {isPendingAutoPrintTemporaryPayment && <ButtonLoading />}
                    {t('paymentMethod.autoPrintTemporaryPayment')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
