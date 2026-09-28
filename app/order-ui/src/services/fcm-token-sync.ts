import { Capacitor } from '@capacitor/core'
import { unregisterDeviceToken } from '@/api/notification'
import { getNativeFcmToken } from '@/utils/getNativeFcmToken'
import { tokenRegistrationQueue } from '@/services/token-registration-queue'
import { useUserStore } from '@/stores'

export async function syncFcmTokenAfterRefresh(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const newFcmToken = await getNativeFcmToken()
  const savedFcmToken = useUserStore.getState().getDeviceToken()

  if (!newFcmToken || newFcmToken === savedFcmToken || !savedFcmToken) return

  await unregisterDeviceToken(savedFcmToken)

  const userInfo = useUserStore.getState().getUserInfo()
  await tokenRegistrationQueue.enqueue({
    token: newFcmToken,
    platform: Capacitor.getPlatform(),
    userAgent: navigator.userAgent,
    userId: userInfo?.slug,
  })
}
