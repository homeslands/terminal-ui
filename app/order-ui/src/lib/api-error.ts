/**
 * Trích BE error code từ lỗi axios.
 * BE trả `statusCode` ở shape mới, `code` ở shape cũ — ưu tiên statusCode.
 * Trả undefined nếu không phải lỗi API.
 */
export function getApiErrorCode(error: unknown): number | undefined {
  const data = (
    error as {
      response?: {
        data?: { statusCode?: number; code?: number; errorCodeValue?: number }
      }
    }
  )?.response?.data
  if (!data) return undefined
  return data.statusCode ?? data.code ?? data.errorCodeValue
}
