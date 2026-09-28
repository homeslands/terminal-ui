import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useGetOrderProvisionalBill,
  useInitiatePayment,
} from '@/hooks'
import { PaymentMethod, paymentStatus, WORK_SHIFT_ERROR_CODE } from '@/constants'
import { getApiErrorCode } from '@/lib/api-error'
import { loadDataToPrinter, showErrorToast, showErrorToastMessage, showToast } from '@/utils'
import { OrderStatus, type IOrder, type IVoucher } from '@/types'
import type { TableCustomer } from '@/types/session'

type Tab = 'cash' | 'transfer' | 'card'

export interface UseTablePaymentSessionInput {
  orderSlug: string | undefined
  isOrderEditable: boolean
  refetchOrder: () => Promise<{ data?: IOrder | undefined }>
  orderData: IOrder | undefined
  /** Needed for pre-payment voucher-identity guard */
  selectedVoucher: IVoucher | null
  /** Needed for pre-payment voucher-identity guard */
  effectiveCustomer: TableCustomer | null
}

export interface UseTablePaymentSessionReturn {
  tab: Tab
  amount: number
  qrCode: string
  isLoading: boolean
  initError: string | null
  isPrinting: boolean
  isPaid: boolean
  setAmount: (v: number) => void
  handleTabChange: (next: Tab) => void
  handleConfirm: () => Promise<void>
  triggerInitiateTransfer: () => Promise<void>
  onPrintProvisional: () => void
}

export function useTablePaymentSession({
  orderSlug,
  isOrderEditable,
  refetchOrder,
  orderData,
  selectedVoucher,
  effectiveCustomer,
}: UseTablePaymentSessionInput): UseTablePaymentSessionReturn {
  const { t: tToast } = useTranslation('toast')

  const [tab, setTab] = useState<Tab>('transfer')
  const [amount, setAmount] = useState(0)
  const [qrCode, setQrCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const hasTriggeredAutoInit = useRef(false)
  const initAttemptRef = useRef(0)
  // Track the last-seen BE payment.qrCode so we can detect the transition
  // valid → invalid (order changed → BE nulled/cancelled payment). We only
  // react on that transition; otherwise a first-mount `null` payment would
  // false-trigger a reset right after our own initiate response, before the
  // polling refetch updates orderData.payment.
  const prevBePaymentQrRef = useRef<string | null>(null)

  const { mutateAsync: initiatePaymentAsync } = useInitiatePayment()
  const {
    mutate: getOrderProvisionalBill,
    isPending: isPendingGetOrderProvisionalBill,
  } = useGetOrderProvisionalBill()

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setIsPolling(false)
  }, [])

  const handlePaymentSuccess = useCallback(() => {
    stopPolling()
    setIsPaid(true)
    showToast(tToast('toast.paymentSuccess'))
  }, [stopPolling, tToast])

  // polling — refetch every 2s until order.status === PAID
  // Cleanup khi unmount hoặc isPolling đổi → handle bởi return của effect này,
  // không cần extra useEffect riêng (giữ parity với code gốc).
  useEffect(() => {
    if (!isPolling) return

    pollingRef.current = setInterval(async () => {
      const result = await refetchOrder()
      if (result.data?.status === OrderStatus.PAID) {
        handlePaymentSuccess()
      }
    }, 2000)

    return () => stopPolling()
  }, [isPolling, refetchOrder, handlePaymentSuccess, stopPolling])

  const triggerInitiateTransfer = useCallback(async () => {
    if (!orderSlug) return
    const myAttempt = ++initAttemptRef.current
    setInitError(null)
    setIsLoading(true)
    try {
      const data = await initiatePaymentAsync({
        orderSlug,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
      })
      if (myAttempt !== initAttemptRef.current) return // stale
      setIsLoading(false)
      if (data?.result?.qrCode) {
        setQrCode(data.result.qrCode)
        setIsPolling(true)
        setInitError(null)
      } else {
        // BE returned 2xx + no qrCode: ưu tiên detect auto-completed payment
        // (đơn < ~2000đ BE bỏ qua QR và auto-PAID). Chỉ rơi vào nhánh failure
        // nếu thực sự không có signal completed.
        const status = String(
          data?.result?.statusMessage ?? data?.result?.statusCode ?? '',
        ).toLowerCase()
        if (status === 'completed') {
          handlePaymentSuccess()
          return
        }
        const errorMsg =
          (data as { message?: string })?.message ||
          tToast('toast.qrCreationFailed') ||
          'Không thể tạo mã QR'
        setInitError(errorMsg)
      }
    } catch (err) {
      if (myAttempt !== initAttemptRef.current) return // stale
      setIsLoading(false)

      // Work-shift gate: BE chặn tạo payment khi chi nhánh chưa có ca (161003)
      // hoặc STAFF không có quyền tạo payment (161006). meta.ignoreGlobalError
      // = true trên useInitiatePayment nên global MutationCache không tự toast
      // — phải bắt và toast thủ công tại đây.
      const gateCode = getApiErrorCode(err)
      if (
        gateCode === WORK_SHIFT_ERROR_CODE.BRANCH_NO_ACTIVE ||
        gateCode === WORK_SHIFT_ERROR_CODE.PAYMENT_FORBIDDEN_FOR_STAFF
      ) {
        showErrorToast(gateCode)
        const gateMessage = tToast(
          gateCode === WORK_SHIFT_ERROR_CODE.BRANCH_NO_ACTIVE
            ? 'toast.workShiftBranchNoActive'
            : 'toast.workShiftPaymentForbiddenForStaff',
        )
        setInitError(gateMessage)
        return
      }

      const errorObj = err as {
        response?: {
          data?: { statusCode?: number; errorCodeValue?: number; message?: string }
        }
        message?: string
      }
      // BE error envelope: { statusCode: 101002, message: "Order is not pending" }
      // (legacy code đọc errorCodeValue — vẫn check để tương thích).
      const code =
        errorObj?.response?.data?.statusCode ??
        errorObj?.response?.data?.errorCodeValue
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.message ||
        tToast('toast.qrCreationFailed') ||
        'Không thể tạo mã QR'
      // Bắn TOAST tường minh ngoài inline error — đặc biệt cần cho case đơn
      // không còn ở status pending (101002) khi user navigate từ
      // order-management vào trang thanh toán của đơn đã xử lý.
      if (typeof code === 'number') {
        showErrorToast(code)
      } else {
        showErrorToastMessage(msg)
      }
      setInitError(msg)
    }
  }, [orderSlug, initiatePaymentAsync, tToast, handlePaymentSuccess])

  // Auto-init transfer payment khi mount nếu chưa có QR.
  // Check orderData.payment trước — nếu BE đã có sẵn payment pending với qrCode
  // thì reuse, không gọi init mới.
  useEffect(() => {
    if (hasTriggeredAutoInit.current) return
    if (tab !== 'transfer') return
    if (!orderSlug) return
    if (qrCode) return
    if (!orderData) return

    // Pre-check defensive: orderData fetch fresh có thể trả status khác với
    // list endpoint user vừa click từ đó (sandbox đôi khi lệch giữa
    // /orders list và /orders/:slug detail). Nếu đơn KHÔNG còn pending,
    // gọi /payment/initiate sẽ chắc chắn 101002 — bỏ qua, hiện UI/toast
    // tường minh ngay để user không phải đợi spinner rồi mới nhận lỗi.
    if (!isOrderEditable) {
      hasTriggeredAutoInit.current = true
      const statusLabel =
        orderData.status === OrderStatus.PAID
          ? 'đã được thanh toán'
          : orderData.status === OrderStatus.FAILED
            ? 'đã bị huỷ'
            : 'đã được xử lý'
      const msg = `Đơn này ${statusLabel}, không thể tạo mã thanh toán mới.`
      showErrorToastMessage(msg)
      setInitError(msg)
      return
    }

    hasTriggeredAutoInit.current = true

    const existingPayment = orderData.payment
    const hasReusableQr =
      !!existingPayment?.qrCode &&
      existingPayment.statusCode !== paymentStatus.CANCELLED

    if (hasReusableQr && existingPayment) {
      setQrCode(existingPayment.qrCode)
      setIsPolling(true)
    } else {
      void triggerInitiateTransfer()
    }
  }, [
    tab,
    orderSlug,
    orderData,
    qrCode,
    triggerInitiateTransfer,
    isOrderEditable,
  ])

  // BE-driven QR invalidation: khi order thay đổi (thêm/sửa món, đổi voucher,
  // đổi customer … làm tổng tiền lệch), BE null hoặc CANCEL payment cũ. Local
  // qrCode vẫn còn giá trị nên UI hiển thị QR stale, khách quét sẽ trả số tiền
  // sai. Detect transition "BE payment valid → invalid" rồi clear local state
  // để auto-init effect fire lại và tạo QR mới cho amount hiện tại (silent
  // swap, không confirm — theo yêu cầu UX).
  useEffect(() => {
    if (tab !== 'transfer') return
    const currentBeQr = orderData?.payment?.qrCode ?? null
    const beCancelled =
      orderData?.payment?.statusCode === paymentStatus.CANCELLED
    const prevBeQr = prevBePaymentQrRef.current
    prevBePaymentQrRef.current = currentBeQr
    // Chỉ react khi trước đó BE có QR hợp lệ, giờ mất/huỷ → mới là dấu hiệu
    // order thay đổi. Ban đầu prevBeQr === null tránh false trigger race giữa
    // initiate response và polling refetch đầu tiên.
    if (!prevBeQr) return
    if (!qrCode) return
    const beInvalidated = !currentBeQr || beCancelled
    if (beInvalidated) {
      setQrCode('')
      setIsPolling(false)
      hasTriggeredAutoInit.current = false
    }
  }, [tab, orderData?.payment, qrCode])

  const handleTabChange = useCallback((next: Tab) => {
    setTab(next)
    setQrCode('')
    setIsPolling(false)
    setIsLoading(false) // defensive: ensure no stuck loading from previous tab
    if (next === 'cash' || next === 'card') setInitError(null)
    // Khi rời transfer, reset auto-init guard để lần sau quay lại fire init mới.
    // Auto-init effect sẽ check orderData.payment trước (reuse nếu có QR còn valid),
    // không spam BE.
    if (next !== 'transfer') hasTriggeredAutoInit.current = false
  }, [])

  const handleConfirm = async () => {
    // Guard runtime + narrow type cho TS (tránh non-null assertion bên dưới).
    // PaymentPanel chỉ render khi orderSlug có nên thực tế không đụng path này.
    if (!orderSlug) return

    // Pre-payment validation: voucher requiring identity needs a selected customer.
    // BE reads customer/voucher from order state (set via PATCH on select/apply),
    // so we only need to guard the UI here — payload itself is unchanged.
    if (selectedVoucher?.isVerificationIdentity && !effectiveCustomer) {
      showErrorToastMessage(tToast('toast.voucherRequiresCustomer'))
      return
    }

    setIsLoading(true)

    if (tab === 'cash') {
      try {
        await initiatePaymentAsync({ orderSlug, paymentMethod: PaymentMethod.CASH })
        handlePaymentSuccess()
      } catch (err) {
        setIsLoading(false)

        // Work-shift gate — xem giải thích ở nhánh transfer phía trên.
        const gateCode = getApiErrorCode(err)
        if (
          gateCode === WORK_SHIFT_ERROR_CODE.BRANCH_NO_ACTIVE ||
          gateCode === WORK_SHIFT_ERROR_CODE.PAYMENT_FORBIDDEN_FOR_STAFF
        ) {
          showErrorToast(gateCode)
          return
        }

        const data = (
          err as {
            response?: {
              data?: { statusCode?: number; errorCodeValue?: number }
            }
          }
        )?.response?.data
        const code = data?.statusCode ?? data?.errorCodeValue
        if (typeof code === 'number') showErrorToast(code)
        else showErrorToastMessage(tToast('toast.paymentFailed'))
      }
    } else if (tab === 'card') {
      try {
        await initiatePaymentAsync({ orderSlug, paymentMethod: PaymentMethod.CREDIT_CARD })
        handlePaymentSuccess()
      } catch (err) {
        setIsLoading(false)

        // Work-shift gate — xem giải thích ở nhánh transfer phía trên.
        const gateCode = getApiErrorCode(err)
        if (
          gateCode === WORK_SHIFT_ERROR_CODE.BRANCH_NO_ACTIVE ||
          gateCode === WORK_SHIFT_ERROR_CODE.PAYMENT_FORBIDDEN_FOR_STAFF
        ) {
          showErrorToast(gateCode)
          return
        }

        const data = (
          err as {
            response?: {
              data?: { statusCode?: number; errorCodeValue?: number }
            }
          }
        )?.response?.data
        const code = data?.statusCode ?? data?.errorCodeValue
        if (typeof code === 'number') showErrorToast(code)
        else showErrorToastMessage(tToast('toast.paymentFailed'))
      }
    } else {
      void triggerInitiateTransfer()
    }
  }

  const onPrintProvisional = () => {
    if (!orderSlug) return
    getOrderProvisionalBill(orderSlug, {
      onSuccess: (data: Blob) => {
        showToast(tToast('toast.exportOrderProvisionalBillSuccess'))
        loadDataToPrinter(data)
      },
    })
  }

  return {
    tab,
    amount,
    qrCode,
    isLoading,
    initError,
    isPrinting: isPendingGetOrderProvisionalBill,
    isPaid,
    setAmount,
    handleTabChange,
    handleConfirm,
    triggerInitiateTransfer,
    onPrintProvisional,
  }
}
