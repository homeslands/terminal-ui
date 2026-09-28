/** Error code work-shift từ BE — spec §6 Error Codes. */
export const WORK_SHIFT_ERROR_CODE = {
  /** 404 — Không tìm thấy ca làm việc */
  NOT_FOUND: 161000,
  /** 400 — Chi nhánh đã có ca đang ACTIVE */
  BRANCH_HAS_ACTIVE: 161001,
  /** 400 — Thu ngân này không có ca nào ACTIVE */
  NO_ACTIVE: 161002,
  /** 400 — Chi nhánh chưa có ca mở, không thể thanh toán */
  BRANCH_NO_ACTIVE: 161003,
  /** 403 — Không có quyền truy cập ca này */
  FORBIDDEN: 161004,
  /** 400 — Ca không ở trạng thái ACTIVE */
  NOT_ACTIVE: 161005,
  /** 403 — Staff không được tạo payment */
  PAYMENT_FORBIDDEN_FOR_STAFF: 161006,
} as const

export type TWorkShiftErrorCode =
  (typeof WORK_SHIFT_ERROR_CODE)[keyof typeof WORK_SHIFT_ERROR_CODE]

/** Số phút cửa sổ hiển thị đơn xuyên ca — spec §4 Luồng C. */
export const CROSS_SHIFT_WINDOW_MINUTES = 120
