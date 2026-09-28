import { http } from '@/utils'
import type { 
    IApiResponse,   
    IVatLinkResponse,
    IVatPublicStatus,
    IVatRequest,
    IVatSubmitRequest, 
} from '@/types'

/**
 * Đổi `order.slug` → URL public `/vat-request/{invoiceSlug}` để cashier
 * render QR hoặc dùng `invoiceSlug` cho form điền hộ.
 * Yêu cầu: order ở status paid/completed/shipping. BE từ chối nếu sai.
 */
export async function getVatLink(
  orderSlug: string,
): Promise<IApiResponse<IVatLinkResponse>> {
  const response = await http.post<IApiResponse<IVatLinkResponse>>(
    `/orders/${orderSlug}/vat-link`,
  )
  return response.data
}

/**
 * Check trạng thái invoice — đã có VAT request submit chưa.
 * Public (không Bearer token). Dùng doNotShowLoading vì gọi mỗi lần mở
 * dialog, không muốn NProgress chớp lên.
 */
export async function getVatRequestPublic(
  invoiceSlug: string,
): Promise<IApiResponse<IVatPublicStatus>> {
  const response = await http.get<IApiResponse<IVatPublicStatus>>(
    `/vat-request/public/${invoiceSlug}`,
    { doNotShowLoading: true },
  )
  return response.data
}

/**
 * Submit form VAT (1 lần duy nhất). Khách hoặc cashier điền hộ đều dùng
 * endpoint này. BE gửi email confirm sau khi thành công.
 */
export async function submitVatRequestPublic(
  invoiceSlug: string,
  body: IVatSubmitRequest,
): Promise<IApiResponse<IVatRequest>> {
  const response = await http.post<IApiResponse<IVatRequest>>(
    `/vat-request/public/${invoiceSlug}`,
    body,
  )
  return response.data
}
