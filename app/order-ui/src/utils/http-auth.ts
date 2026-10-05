import axios, { AxiosInstance } from 'axios'

import { authURL } from '@/constants'
import { attachAuthInterceptors } from './http'

// Client riêng cho shared-user (identity service): đăng nhập/đăng ký/quên mật
// khẩu/thông tin cá nhân/đổi mật khẩu/xoá tài khoản/avatar.
//
// Đây là NGOẠI LỆ CÓ CHỦ ĐÍCH của quy ước "không tạo axios instance mới" — nó
// không phải instance ad-hoc trong một hàm, mà là client thứ hai của app, export
// qua `@/utils` y như `http`, và dùng CHUNG interceptor với `http` qua
// `attachAuthInterceptors` để 2 client không đua nhau refresh cùng lúc.
//
// Trỏ `terminal` hay `shared-user` là quyết định theo SERVICE SỞ HỮU NGHIỆP VỤ,
// không theo "cái nào đang trả lời được": suốt giai đoạn 1
// `{terminal}/auth/login` vẫn trả 200 vì chưa tới lượt bị xoá.
const httpAuth: AxiosInstance = axios.create({
  baseURL: authURL,
  timeout: 10000,
  withCredentials: true,
})

attachAuthInterceptors(httpAuth)

export default httpAuth
