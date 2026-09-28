// src/components/app/notification-provider.tsx
import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { useUserStore } from '@/stores'
import { useAppLifecycle, useFirebaseNotification, useNotificationListener } from '@/hooks'
import { fcmTokenManager } from '@/services/fcm-token-manager'
import { navigateToNotificationUrl } from '@/utils'
import notificationSound from '@/assets/sound/notification.mp3'
import { NotificationMessageCode, QUERYKEY } from '@/constants'
import { NotificationPermissionDialog } from '@/components/app/dialog'
import { NotificationToast } from '@/components/app/toast/notification-toast'
import { useDialogContext } from '@/contexts/dialog-context'

/**
 * Helper function để play audio một cách an toàn
 */
function playNotificationSound(volume: number = 0.5): void {
  try {
    // Check xem Audio API có available không
    if (typeof Audio === 'undefined') {
      return
    }
    
    // Check xem notificationSound có tồn tại không
    if (!notificationSound) {
      return
    }
    
    const audio = new Audio(notificationSound)
    
    // Set volume với validation
    if (volume >= 0 && volume <= 1) {
      audio.volume = volume
    }
    
    // Play với error handling
    audio.play().catch((error) => {
      // Ignore autoplay errors (cần user interaction trên một số browser)
      // eslint-disable-next-line no-console
      console.debug('[Notification] Audio play error (ignored):', error)
    })
  } catch (error) {
    // Ignore audio initialization errors
    // eslint-disable-next-line no-console
    console.debug('[Notification] Audio initialization error (ignored):', error)
  }
}

const printerFailMessages: NotificationMessageCode[] = [
  NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
  NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
  NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
]

/**
 * Extract message code từ nhiều nguồn có thể
 * Backend có thể gửi message code ở các field khác nhau
 */
/**
 * Map backend message code sang frontend message code
 * Backend có thể gửi format khác với frontend
 */
function mapBackendMessageCode(backendMessage: string): string {
  const messageMap: Record<string, string> = {
    'invoice-failed-printing': NotificationMessageCode.ORDER_BILL_FAILED_PRINTING,
    'chef-order-failed-printing': NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING,
    'label-ticket-failed-printing': NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING,
  }
  return messageMap[backendMessage] || backendMessage
}

/**
 * Pull the human-readable body from any field BE might have used. FCM lets
 * the backend put content in:
 *   - notification.body (the "real" FCM notification field, often empty when
 *     BE sends data-only messages)
 *   - data.body / data.message (direct keys)
 *   - data.payload (JSON string containing body / message)
 *
 * Returns the first non-empty match. Caller decides whether to fall back to
 * localized copy by messageCode.
 */
function extractMessageBody(
  data?: Record<string, string>,
  notificationBody?: string,
): string | undefined {
  if (notificationBody && notificationBody.trim()) return notificationBody.trim()

  let parsedPayload: Record<string, string> = {}
  if (data?.payload && typeof data.payload === 'string') {
    try {
      parsedPayload = JSON.parse(data.payload)
    } catch {
      // Ignore parse errors
    }
  }

  const merged = { ...data, ...parsedPayload }
  const candidates = [merged.body, merged.message, merged.description]
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim()
  }
  return undefined
}

function extractMessageCode(
  data?: Record<string, string>,
  notificationBody?: string,
): NotificationMessageCode | undefined {
  // ⚠️ QUAN TRỌNG: Parse data.payload nếu có (backend gửi message code trong payload JSON string)
  let parsedPayload: Record<string, string> = {}
  if (data?.payload && typeof data.payload === 'string') {
    try {
      parsedPayload = JSON.parse(data.payload)
    } catch {
      // Ignore parse errors
    }
  }
  
  // Merge parsed payload vào data (parsed payload có priority cao hơn)
  const mergedData = { ...data, ...parsedPayload }

  // 1. Check mergedData.message (từ payload hoặc data trực tiếp)
  if (mergedData.message) {
    // Map backend message code sang frontend format
    const mappedMessage = mapBackendMessageCode(mergedData.message)
    const code = Object.values(NotificationMessageCode).find(
      (code) => code === mappedMessage,
    )
    if (code) {
      return code
    }
  }

  // 2. Check data.message (fallback nếu không có trong parsed payload)
  if (data?.message && !parsedPayload.message) {
    const code = Object.values(NotificationMessageCode).find(
      (code) => code === data.message,
    )
    if (code) return code
  }

  // 3. Check data.type
  if (mergedData.type) {
    const code = Object.values(NotificationMessageCode).find(
      (code) => code === mergedData.type,
    )
    if (code) return code
  }

  // 4. Check data.notificationType
  if (mergedData.notificationType) {
    const code = Object.values(NotificationMessageCode).find(
      (code) => code === mergedData.notificationType,
    )
    if (code) return code
  }

  // 5. Try extract từ notification body (fallback)
  if (notificationBody) {
    const code = Object.values(NotificationMessageCode).find((code) =>
      notificationBody.toLowerCase().includes(code.toLowerCase()),
    )
    if (code) return code
  }

  return undefined
}

export function NotificationProvider() {
  const { userInfo } = useUserStore()
  const navigate = useNavigate()
  const { t } = useTranslation(['notification'])
  const queryClient = useQueryClient()

  // ⚠️ REMOVED: Printer fail dialog đã được xử lý bởi SystemNotificationPopover
  // Không cần dialog riêng ở đây nữa để tránh trùng lặp

  // Start/stop scheduler
  useEffect(() => {
    if (userInfo?.slug) {
      fcmTokenManager.startScheduler()
    }
    return () => fcmTokenManager.stopScheduler()
  }, [userInfo?.slug])

  // Check token when app resumes
  useAppLifecycle(async () => {
    await fcmTokenManager.checkAndRefreshToken()
  })

  // 1️⃣ Lấy FCM token (Native & Web)
  const { permissionDenied } = useFirebaseNotification(userInfo?.slug ?? '')
  const { isPermissionDialogOpen, setIsPermissionDialogOpen } = useDialogContext()
  const [userDismissedDialog, setUserDismissedDialog] = useState(false)

  // Show permission dialog khi permission denied (chỉ nếu user chưa đóng trước đó)
  useEffect(() => {
    if (permissionDenied && !isPermissionDialogOpen && !userDismissedDialog) {
      setIsPermissionDialogOpen(true)
    }
  }, [permissionDenied, isPermissionDialogOpen, userDismissedDialog, setIsPermissionDialogOpen])

  const handlePermissionDialogChange = (open: boolean) => {
    setIsPermissionDialogOpen(open)
    if (!open) {
      // User đã đóng dialog → đánh dấu để không tự động mở lại
      setUserDismissedDialog(true)
    }
  }


  // 2️⃣ Lắng nghe notifications (Native & Web)
  const { latestNotification, clearNotification } = useNotificationListener()

  const buildNotificationTitle = useCallback((messageCode?: string, fallbackTitle?: string) => {
    if (messageCode) {
      // Key path includes the `notification.` prefix because the JSON file is
      // structured as `{ "notification": { "notificationTitle": { ... } } }`.
      const localized = t(`notification.notificationTitle.${messageCode}`, {
        defaultValue: '',
      })
      if (localized) {
        return localized
      }
    }
    return fallbackTitle || t('notification.defaultTitle')
  }, [t])

  const buildNotificationBody = useCallback(
    (messageCode?: string, fallbackBody?: string) => {
      // 1. Localized body wins when we recognize the message code — keeps
      //    notification text consistent with the user's selected language
      //    regardless of what BE happens to send. Mirrors buildNotificationTitle.
      if (messageCode) {
        const localized = t(`notification.notificationBody.${messageCode}`, {
          defaultValue: '',
        })
        if (localized) return localized
      }
      // 2. Unknown code → fall back to whatever raw text BE provided.
      if (fallbackBody && fallbackBody.trim()) return fallbackBody.trim()
      // 3. Last resort default so the toast never shows empty.
      return (
        t('notification.notificationBody.default', { defaultValue: '' }) ||
        undefined
      )
    },
    [t],
  )

  // 3️⃣ Xử lý foreground notification
  useEffect(() => {
    if (latestNotification) {
      // ✅ Extract message code từ nhiều nguồn
      const messageCode = extractMessageCode(
        latestNotification.data,
        latestNotification.notification?.body,
      )

      // TEMP DEBUG — dump full payload so we can see what BE actually sends
      // and where the code lives. Remove after diagnosing.
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[Notification][DEBUG] payload', {
          messageCode,
          notification: latestNotification.notification,
          data: latestNotification.data,
          dataPayloadParsed: (() => {
            try {
              return latestNotification.data?.payload
                ? JSON.parse(latestNotification.data.payload as string)
                : null
            } catch {
              return null
            }
          })(),
        })
      }

      // Dev warning: BE gửi code mà FE chưa khai báo → toast sẽ fallback về raw
      // text. Surface in console once so it's easy to spot which code is missing.
      if (import.meta.env.DEV && !messageCode) {
        const rawMessage =
          (latestNotification.data?.message as string | undefined) ??
          (latestNotification.data?.type as string | undefined) ??
          (latestNotification.data?.notificationType as string | undefined) ??
          latestNotification.notification?.body
        if (rawMessage) {
          // eslint-disable-next-line no-console
          console.warn(
            `[Notification] Unknown FCM message code "${rawMessage}". ` +
              `Add it to NotificationMessageCode enum + locales/{vi,en}/notification.json (notificationTitle + notificationBody).`,
          )
        }
      }

      const isPrinterFail = messageCode && printerFailMessages.includes(messageCode)

      // Invalidate order cache khi BE push trạng thái thay đổi đơn (paid/failed/
      // completed/created). Payment page subscribe `useOrderBySlug` — nếu không
      // invalidate, polling phải chờ tick 2s hoặc tệ hơn không bao giờ thấy
      // status mới (vd: fast-path bank-transfer < 2000đ kẹt loading).
      const orderStatusMessages: string[] = [
        NotificationMessageCode.ORDER_PAID,
        NotificationMessageCode.ORDER_FAILED,
        NotificationMessageCode.ORDER_COMPLETED,
        NotificationMessageCode.ORDER_CREATED,
      ]
      if (messageCode && orderStatusMessages.includes(messageCode)) {
        let orderSlug: string | null = null
        try {
          const raw = latestNotification.data?.payload as string | undefined
          if (raw) {
            const parsed = JSON.parse(raw) as { order?: string }
            orderSlug = parsed.order ?? null
          }
        } catch {
          orderSlug = null
        }
        if (orderSlug) {
          queryClient.invalidateQueries({
            queryKey: [...QUERYKEY.order, orderSlug],
          })
        }
      }

      // Invalidate table booking list khi BE push booking mới, để tab
      // "Đặt bàn" của staff thấy ngay mà không cần đợi refetch interval.
      if (messageCode === NotificationMessageCode.TABLE_BOOKING_CREATED) {
        queryClient.invalidateQueries({
          queryKey: QUERYKEY.tableBookings,
        })
      }

      // ⚠️ QUAN TRỌNG: Khi có FCM printer fail → trigger refetch printer events
      if (isPrinterFail) {
        // Invalidate và refetch printer events để cập nhật danh sách lỗi in
        // Bỏ exact: true để match tất cả queries có prefix QUERYKEY.printerEvents (kể cả có params)
        queryClient.invalidateQueries({
          queryKey: [QUERYKEY.printerEvents],
        })
        // ⚠️ QUAN TRỌNG: Return sớm để KHÔNG hiển thị toast
        // Chỉ phát âm thanh và clear notification
        playNotificationSound(0.8)
        clearNotification()
        return
      }

      // ⚠️ QUAN TRỌNG: Không hiển thị toast cho printer fail notifications
      // Vì SystemNotificationPopover đã có dialog list lỗi in
      // Chỉ hiển thị toast cho các notification khác
      if (!isPrinterFail) {
        const notifTitle = buildNotificationTitle(
          messageCode,
          latestNotification.notification?.title,
        )
        const rawBody = extractMessageBody(
          latestNotification.data,
          latestNotification.notification?.body,
        )
        const notifBody = buildNotificationBody(messageCode, rawBody)
        const hasUrl = !!latestNotification.data?.url

        // Render via the shared NotificationToast template so the FCM toast
        // matches the S2/W2/E2 family (dark-mode tokens, brass accent, Lucide
        // icons). The previous inline template was bg-white only and broke on
        // dark theme + used a 🔔 emoji + blue link that didn't match brand.
        toast.custom(
          (id) => (
            <NotificationToast
              title={notifTitle}
              description={notifBody || undefined}
              actionLabel={hasUrl ? 'Xem chi tiết' : undefined}
              onAction={
                hasUrl
                  ? async () => {
                      toast.dismiss(id)
                      await navigateToNotificationUrl(
                        latestNotification.data?.url ?? '',
                        navigate,
                      )
                    }
                  : undefined
              }
              onDismiss={() => toast.dismiss(id)}
            />
          ),
          {
            duration: 6000,
            position: 'top-right',
          },
        )

        // Play sound (skip for new order notifications)
        if (messageCode !== NotificationMessageCode.ORDER_NEEDS_PROCESSED) {
          playNotificationSound(0.5)
        }
      }

      // ⚠️ QUAN TRỌNG: Không hiển thị dialog riêng cho printer fail
      // Vì SystemNotificationPopover đã có dialog list lỗi in
      // Chỉ hiển thị toast và phát âm thanh
      if (isPrinterFail && messageCode) {
        // Chỉ phát âm thanh, không mở dialog (dialog sẽ được mở bởi SystemNotificationPopover)
        playNotificationSound(0.8)
      }

      clearNotification()
    }
  }, [latestNotification, clearNotification, navigate, buildNotificationTitle, buildNotificationBody, queryClient])

  // ⚠️ REMOVED: Printer fail dialog đã được xử lý bởi SystemNotificationPopover
  // Không cần dialog riêng ở đây nữa để tránh trùng lặp

  return (
    <>
      <NotificationPermissionDialog
        open={isPermissionDialogOpen}
        onOpenChange={handlePermissionDialogChange}
      />
    </>
  )
}