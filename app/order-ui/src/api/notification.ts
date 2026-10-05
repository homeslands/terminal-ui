import {
  IAllNotificationRequest,
  IApiResponse,
  INotification,
  IPaginationResponse,
  IRegisterDeviceTokenRequest,
  IRegisterDeviceTokenResponse,
} from '@/types'
// Import tu MODULE CU THE: tep nay bi `utils/http.ts` keo vao, nen di qua barrel
// `@/utils` la tao vong `http.ts` -> day -> barrel -> `http-auth.ts` -> can
// `attachAuthInterceptors` cua `http.ts` khi no moi danh gia mot nua.
import http from '@/utils/http'

export async function getAllNotifications(
  params: IAllNotificationRequest,
): Promise<IApiResponse<IPaginationResponse<INotification>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<INotification>>
  >('/notification', {
    doNotShowLoading: true,
    params,
  })
  return response.data
}

export async function updateNotificationStatus(
  slug: string,
): Promise<IApiResponse<INotification>> {
  const response = await http.patch<IApiResponse<INotification>>(
    `/notification/${slug}/read`,
  )
  if (!response || !response.data) throw new Error('No data found')
  return response.data
}

// Đăng ký token FCM
export async function registerDeviceToken(params: IRegisterDeviceTokenRequest): Promise<IApiResponse<IRegisterDeviceTokenResponse>> {
  const response = await http.post<IApiResponse<IRegisterDeviceTokenResponse>>('/notification/firebase/register-device-token', params)
  return response.data
}

export async function unregisterDeviceToken(token: string): Promise<IApiResponse<void>> {
  const response = await http.delete<IApiResponse<void>>(`/notification/firebase/unregister-device-token/${token}`)
  return response.data
}