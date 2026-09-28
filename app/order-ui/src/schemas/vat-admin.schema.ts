import { z } from 'zod'
import { VatRequestStatus } from '@/types'

const taxCodeRegex = /^(\d{10}|\d{13})$/

export const vatUpdateCustomerSchema = z.object({
  customerName: z
    .string()
    .min(1, 'customerInfo.errors.customerName.required')
    .optional(),
  taxCode: z
    .string()
    .regex(taxCodeRegex, 'customerInfo.errors.taxCode.invalidFormat')
    .optional(),
  address: z
    .string()
    .min(1, 'customerInfo.errors.address.required')
    .optional(),
  email: z.string().email('customerInfo.errors.email.invalid').optional(),
  companyName: z.string().optional(),
  note: z.string().optional(),
})

export const vatStatusTransitionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal(VatRequestStatus.PENDING),
    invoiceNumber: z.string().optional(),
    note: z.string().optional(),
  }),
  z.object({
    status: z.literal(VatRequestStatus.PROCESSING),
    invoiceNumber: z.string().optional(),
    note: z.string().optional(),
  }),
  z.object({
    status: z.literal(VatRequestStatus.COMPLETED),
    invoiceNumber: z.string().min(1),
    note: z.string().optional(),
  }),
  z.object({
    status: z.literal(VatRequestStatus.REJECTED),
    invoiceNumber: z.string().optional(),
    note: z.string().min(3),
  }),
])

export type TVatUpdateCustomer = z.infer<typeof vatUpdateCustomerSchema>
export type TVatStatusTransition = z.infer<typeof vatStatusTransitionSchema>
