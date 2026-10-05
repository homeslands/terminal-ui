import {
  IApiResponse,
  IUserInfo,
  IUpdateProfileRequest,
  IUpdatePasswordRequest,
  IDeleteAccountRequest,
} from '@/types'
import { http, httpAuth } from '@/utils'

/**
 * `getProfile` gọi `terminal` (KHÔNG phải shared-user) — hàm DUY NHẤT trong tệp
 * này còn dùng `http`.
 *
 * `GET /auth/profile` tồn tại ở CẢ HAI service với nội dung khác nhau: bản
 * shared-user trả identity thuần, bản terminal trả identity **ghép sẵn role +
 * branch**. Response cần cả hai, và terminal tự gọi nội bộ sang shared-user để
 * ghép trước khi trả về — một hành động, một lệnh gọi, UI không ghép hộ
 * (architect-http.md mục 1.1 quy tắc 4).
 *
 * ⚠️ HỆ QUẢ: `getProfile` và `updateProfile` gọi HAI SERVICE KHÁC NHAU. Sau khi
 * sửa hồ sơ phải **refetch `getProfile()`** mới thấy giá trị mới — không dựa
 * vào response của `updateProfile` để cập nhật cache profile.
 */
export async function getProfile(): Promise<IApiResponse<IUserInfo>> {
  const response = await http.get<IApiResponse<IUserInfo>>('/auth/profile')
  return response.data
}

export async function updateProfile(
  data: IUpdateProfileRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await httpAuth.patch<IApiResponse<IUserInfo>>(
    '/auth/profile',
    data,
  )
  return response.data
}

export async function updatePassword(
  data: IUpdatePasswordRequest,
): Promise<IApiResponse<IUserInfo>> {
  const response = await httpAuth.post<IApiResponse<IUserInfo>>(
    '/auth/change-password',
    data,
  )
  return response.data
}

export async function uploadProfilePicture(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await httpAuth.patch<IApiResponse<IUserInfo>>(
    `/auth/upload`,
    formData,
  )
  return response.data
}

export async function deleteAccount(
  data: IDeleteAccountRequest,
): Promise<IApiResponse<null>> {
  const response = await httpAuth.delete<IApiResponse<null>>(
    '/auth/delete-account',
    {
      data,
    },
  )
  return response.data
}
