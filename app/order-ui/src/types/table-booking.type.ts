// Booking status string values mirror the backend `BookingStatus` enum exactly.
export const TableBookingStatus = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked_in',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const

export type TTableBookingStatus =
  (typeof TableBookingStatus)[keyof typeof TableBookingStatus]

// How the staff list is filtered by date: by the reserved booking date-time
// (`fromDate`/`toDate` range) or by the day the booking request was made
// (`date`).
export const TableBookingDateFilterMode = {
  BOOKING_DATE: 'bookingDate',
  REQUEST_DATE: 'requestDate',
} as const

export type TTableBookingDateFilterMode =
  (typeof TableBookingDateFilterMode)[keyof typeof TableBookingDateFilterMode]

export interface ITableBooking {
  id: string
  slug: string
  name: string
  phone: string
  email?: string | null
  date: string
  seats: number
  table?: string | null
  deposit?: number
  status: TTableBookingStatus
  note?: string | null
  createdAt: string
  updatedAt: string
}

export interface ICreateTableBookingRequest {
  name: string
  phone: string
  email?: string
  /** Format expected by the backend: "dd/MM/yyyy HH:mm" */
  date: string
  seats?: number
  note?: string
}

export interface IUpdateTableBookingRequest {
  name?: string
  phone?: string
  email?: string
  date?: string
  seats?: number
  table?: string
  deposit?: number
  status?: TTableBookingStatus
  note?: string
}

export interface IGetTableBookingQuery {
  page?: number
  size?: number
  hasPaging?: boolean
  status?: TTableBookingStatus
  /** Day the booking request was made. Format: "dd/MM/yyyy" */
  createdDate?: string
  /** Filter bookings from this day onward. Format: "dd/MM/yyyy" */
  fromDate?: string
  /** Filter bookings up to this day. Format: "dd/MM/yyyy" */
  toDate?: string
  /** Format: "HH:mm" (requires `createdDate`) */
  time?: string
  name?: string
  phone?: string
  email?: string
}
