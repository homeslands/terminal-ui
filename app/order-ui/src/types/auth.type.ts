import { VerificationMethod } from '@/constants'
import { IUserInfo } from './user.type'

export interface ILoginRequest {
  phonenumber: string
  password: string
}

export interface IRegisterSchema {
  dob?: string | null
  firstName: string
  lastName: string
  phonenumber: string
  password: string
  confirmPassword: string
}

export interface IRegisterRequest {
  phonenumber: string
  password: string
  firstName: string
  lastName: string
  dob?: string | null
}

export interface IInitiateForgotPasswordRequest {
  email?: string
  phonenumber?: string
  verificationMethod: VerificationMethod
}

export interface IInitiateForgotPasswordResponse {
  expiresAt: string
}

export interface IResendOTPForgotPasswordRequest {
  email?: string
  phonenumber?: string
  verificationMethod: VerificationMethod
}

export interface IConfirmForgotPasswordRequest {
  newPassword: string
  token: string
}

export interface IVerifyOTPForgotPasswordRequest {
  code: string
}

export interface IVerifyOTPForgotPasswordResponse {
  token: string
}

export interface IRefreshTokenResponse {
  expireTime: string
  expireTimeRefreshToken: string
  accessToken: string
  refreshToken: string
}

/**
 * Payload THẬT của JWT do `shared-user` ký — đúng ba field.
 *
 * ⛔ `scope` đã bị BỎ, và việc bỏ nó là phần quan trọng nhất của đợt này. Token
 * mới decode **thành công** (nó là JWT hợp lệ), chỉ là không có `scope` ⇒ mọi
 * chỗ đọc `decoded.scope` trả mảng rỗng, không exception, không log. Hệ quả:
 * menu trống, mọi route có permission bị chặn, người dùng đăng nhập được nhưng
 * không vào được đâu cả — nhìn từ ngoài giống hệt "tài khoản này không có
 * quyền". Giữ `scope` trong type là để lại đúng cái bẫy đó cho người sửa sau.
 *
 * Quyền lấy qua `GET {terminal}/auth/scope` → `usePermissions()`.
 */
export interface IToken {
  sub: string
  jti: string
  exp?: number
}

/**
 * Response của `GET {terminal}/auth/scope` — nguồn quyền duy nhất của giao diện.
 */
export interface IAuthScope {
  role: string
  permissions: string[]
  // Nguồn thật cho branch (architect-http.md mục 1.1 quy tắc 4) — không lấy
  // branch từ response profile của shared-user, service đó không có field này.
  branch: IUserInfo['branch']
}
