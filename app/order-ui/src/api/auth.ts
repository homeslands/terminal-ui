import {
  IApiResponse,
  IRefreshTokenResponse,
  IVerifyEmailRequest,
  IGetAuthorityGroupsRequest,
  IAuthorityGroup,
  ICreatePermissionRequest,
  IRegisterRequest,
  IEmailVerificationResponse,
  IVerifyPhoneNumberRequest,
  IInitiateForgotPasswordRequest,
  IVerifyOTPForgotPasswordRequest,
  IResendOTPForgotPasswordRequest,
  IConfirmForgotPasswordRequest,
  IVerifyOTPForgotPasswordResponse,
  IInitiateForgotPasswordResponse,
  IAuthScope,
} from '@/types'
import { http, httpAuth } from '@/utils'

// ============================================================================
// httpAuth (shared-user) vs http (terminal) — chọn theo SERVICE SỞ HỮU NGHIỆP
// VỤ, không theo "endpoint nào đang trả lời được".
//
//   httpAuth : đăng nhập, đăng ký, quên mật khẩu, xác minh email/SĐT — nghiệp
//              vụ nằm gọn ở shared-user.
//   http     : /auth/scope, /authority-group, /permission — role và quyền là
//              nghiệp vụ RIÊNG của terminal (QĐ15), shared-user không biết.
//
// ⚠️ Suốt giai đoạn 1, `{terminal}/auth/login` VẪN trả 200 vì chưa tới lượt bị
// xoá. Đừng lấy đó làm cơ sở để trỏ ngược lại.
// ============================================================================

export async function login(params: {
  phonenumber: string
  password: string
}): Promise<IApiResponse<IRefreshTokenResponse>> {
  const response = await httpAuth.post<IApiResponse<IRefreshTokenResponse>>('/auth/login', params)
  return response.data
}

/**
 * Nguồn quyền DUY NHẤT của giao diện.
 *
 * Gọi `http` (terminal), KHÔNG phải `httpAuth`: role và permission là nghiệp vụ
 * của terminal. JWT do shared-user ký có đúng ba field `{ sub, jti, exp }` —
 * không còn `scope`, nên không thể decode quyền từ token nữa.
 */
export async function getAuthScope(): Promise<IApiResponse<IAuthScope>> {
  const response = await http.get<IApiResponse<IAuthScope>>('/auth/scope')
  return response.data
}

export async function register(
  params: IRegisterRequest,
): Promise<IApiResponse<IRefreshTokenResponse>> {
  const response = await httpAuth.post<IApiResponse<IRefreshTokenResponse>>(
    '/auth/register',
    params,
  )
  return response.data
}

export async function initiateForgotPassword(
  params: IInitiateForgotPasswordRequest,
): Promise<IApiResponse<IInitiateForgotPasswordResponse>> {
  const response = await httpAuth.post<
    IApiResponse<IInitiateForgotPasswordResponse>
  >('/auth/forgot-password/initiate', params)
  return response.data
}

export async function verifyOTPForgotPassword(
  params: IVerifyOTPForgotPasswordRequest,
): Promise<IApiResponse<IVerifyOTPForgotPasswordResponse>> {
  const response = await httpAuth.post<
    IApiResponse<IVerifyOTPForgotPasswordResponse>
  >('/auth/forgot-password/confirm', params)
  return response.data
}

export async function resendOTPForgotPassword(
  params: IResendOTPForgotPasswordRequest,
): Promise<IApiResponse<IInitiateForgotPasswordResponse>> {
  const response = await httpAuth.post<
    IApiResponse<IInitiateForgotPasswordResponse>
  >('/auth/forgot-password/resend', params)
  return response.data
}

export async function confirmForgotPassword(
  params: IConfirmForgotPasswordRequest,
): Promise<IApiResponse<null>> {
  const response = await httpAuth.post<IApiResponse<null>>(
    '/auth/forgot-password/change',
    params,
  )
  return response.data
}

export async function verifyEmail(
  verifyParams: IVerifyEmailRequest,
): Promise<IApiResponse<IEmailVerificationResponse>> {
  const response = await httpAuth.post<IApiResponse<IEmailVerificationResponse>>(
    `/auth/initiate-verify-email`,
    verifyParams,
  )
  return response.data
}

export async function verifyPhoneNumber(): Promise<
  IApiResponse<IVerifyPhoneNumberRequest>
> {
  const response = await httpAuth.post<IApiResponse<IVerifyPhoneNumberRequest>>(
    `/auth/initiate-verify-phone-number`,
  )
  return response.data
}

export async function confirmEmailVerification(
  code: string,
): Promise<IApiResponse<null>> {
  const response = await httpAuth.post<IApiResponse<null>>(
    `/auth/confirm-email-verification/code`,
    { code },
  )
  return response.data
}

export async function confirmPhoneNumberVerification(
  code: string,
): Promise<IApiResponse<null>> {
  const response = await httpAuth.post<IApiResponse<null>>(
    `/auth/confirm-phone-number-verification/code`,
    { code },
  )
  return response.data
}

export async function resendEmailVerification(): Promise<
  IApiResponse<IEmailVerificationResponse>
> {
  const response = await httpAuth.post<IApiResponse<IEmailVerificationResponse>>(
    `/auth/resend-verify-email`,
  )
  return response.data
}

export async function resendPhoneNumberVerification(): Promise<
  IApiResponse<IVerifyPhoneNumberRequest>
> {
  const response = await httpAuth.post<IApiResponse<IVerifyPhoneNumberRequest>>(
    `/auth/resend-verify-phone-number`,
  )
  return response.data
}

export async function authorityGroup(
  params: IGetAuthorityGroupsRequest,
): Promise<IApiResponse<IAuthorityGroup[]>> {
  const response = await http.get<IApiResponse<IAuthorityGroup[]>>(
    '/authority-group',
    {
      params,
    },
  )
  return response.data
}

export async function createPermission(
  params: ICreatePermissionRequest,
): Promise<IApiResponse<null>> {
  const response = await http.post<IApiResponse<null>>(
    '/permission/bulk',
    params,
  )
  return response.data
}

export async function deletePermission(
  slug: string,
): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/permission/${slug}`)
  return response.data
}
