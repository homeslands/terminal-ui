import {
  NapasLogo,
  VietQRLogo,
  MposLogo,
  VlsLogo,
  CashLogo,
} from '@/assets/images'

// Supported payment-method logos shown in the client footer.
export const PAYMENT_LOGOS = [
  { src: NapasLogo, alt: 'NAPAS' },
  { src: VietQRLogo, alt: 'VietQR' },
  { src: MposLogo, alt: 'mPOS' },
  { src: VlsLogo, alt: 'Visa' },
  { src: CashLogo, alt: 'Cash' },
]

export enum PaymentMethod {
  BANK_TRANSFER = 'bank-transfer',
  CASH = 'cash',
  POINT = 'point',
  CREDIT_CARD = 'credit-card',
}

export enum CardOrderPaymentMethod {
  BANK_TRANSFER = 'bank-transfer',
  CASH = 'cash',
}

export enum paymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
