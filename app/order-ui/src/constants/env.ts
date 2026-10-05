export const baseURL = import.meta.env.VITE_BASE_API_URL
// export const baseURL = import.meta.env.VITE_BASE_API_URL
// shared-user (identity service, cổng 8086) — client `httpAuth` dùng làm
// baseURL. Thiếu biến này thì `httpAuth` KHÔNG có baseURL và request rơi vào
// cùng origin; lỗi chỉ hiện ra ở tận màn đăng nhập. `trend-ui` đã vấp đúng
// chỗ này (biến bị comment sẵn trong ENV/dev/ui/.env).
export const authURL = import.meta.env.VITE_AUTH_API_URL
export const publicFileURL = import.meta.env.VITE_PUBLIC_FILE_URL
export const googleMapAPIKey = import.meta.env.VITE_GOOGLE_MAP_API_KEY
export const fanpageUrl = import.meta.env.VITE_TREND_FANPAGE_URL
export const bookingHotline = import.meta.env.VITE_TREND_HOTLINE
export const phone = import.meta.env.VITE_TREND_PHONE
export const registrationPhone = import.meta.env.VITE_REGISTRATION_PHONE
export const mail = import.meta.env.VITE_TREND_EMAIL
export const youtubeVideoId = import.meta.env.VITE_TREND_YOUTUBE_VIDEO_ID
export const orderExpirationTimeInSeconds = Number(
  import.meta.env.VITE_ORDER_EXPIRATION_TIME_SECONDS || '900',
) // Default to 15 minutes (900 seconds)
