import { z } from 'zod'

/**
 * VAT-side rule: tax code phải đúng 10 hoặc 13 chữ số (chính sách thuế VN).
 * 10 = cá nhân/hộ kinh doanh, 13 = chi nhánh.
 */
export const vatSubmitSchema = z.object({
  customerName: z.string().min(1, 'customerName.required'),
  taxCode: z
    .string()
    .min(1, 'taxCode.required')
    .regex(/^(\d{10}|\d{13})$/, 'taxCode.invalidFormat'),
  address: z.string().min(1, 'address.required'),
  email: z.string().email('email.invalid'),
  companyName: z.string().optional(),
  note: z.string().optional(),
})

export type VatSubmitFormValues = z.infer<typeof vatSubmitSchema>
