import { z } from 'zod'
import {
  APPLICABILITY_RULE,
  CAMPAIGN_TYPE,
  VOUCHER_PAYMENT_METHOD,
  VOUCHER_TYPE,
  VOUCHER_USAGE_FREQUENCY_UNIT,
} from '@/constants'

export const campaignVoucherTemplateSchema = z
  .object({
    title: z.string().min(1, 'Tên template là bắt buộc'),
    description: z.string().optional(),
    type: z.enum([
      VOUCHER_TYPE.PERCENT_ORDER,
      VOUCHER_TYPE.FIXED_VALUE,
      VOUCHER_TYPE.SAME_PRICE_PRODUCT,
    ] as [string, ...string[]]),
    value: z
      .number({ invalid_type_error: 'Giá trị phải là số' })
      .positive('Giá trị phải lớn hơn 0'),
    maxUsage: z
      .number({ invalid_type_error: 'Số lần sử dụng phải là số' })
      .int()
      .positive('Số lần sử dụng phải lớn hơn 0'),
    minOrderValue: z
      .number({ invalid_type_error: 'Giá trị đơn tối thiểu phải là số' })
      .min(0, 'Giá trị đơn tối thiểu không được âm'),
    maxItems: z
      .number({ invalid_type_error: 'Số items phải là số' })
      .int()
      .positive('Số items phải lớn hơn 0'),
    duration: z
      .number({ invalid_type_error: 'Thời hạn phải là số' })
      .int()
      .min(0, 'Thời hạn không được âm'),
    usageFrequencyUnit: z.union([
      z.enum([
        VOUCHER_USAGE_FREQUENCY_UNIT.HOUR,
        VOUCHER_USAGE_FREQUENCY_UNIT.DAY,
        VOUCHER_USAGE_FREQUENCY_UNIT.WEEK,
        VOUCHER_USAGE_FREQUENCY_UNIT.MONTH,
        VOUCHER_USAGE_FREQUENCY_UNIT.YEAR,
      ]),
      z.literal('unlimited'),
    ]),
    usageFrequencyValue: z.number().int().positive().nullable(),
    applicabilityRule: z.enum([
      APPLICABILITY_RULE.ALL_REQUIRED,
      APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    ]),
    paymentMethods: z
      .array(z.enum([VOUCHER_PAYMENT_METHOD.CASH, VOUCHER_PAYMENT_METHOD.POINT, VOUCHER_PAYMENT_METHOD.BANK_TRANSFER, VOUCHER_PAYMENT_METHOD.CREDIT_CARD]))
      .min(1, 'Chọn ít nhất 1 phương thức thanh toán'),
    productSlugs: z.array(z.string()).optional().default([]),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === VOUCHER_TYPE.PERCENT_ORDER) return data.value <= 100
      return true
    },
    { message: 'Giá trị phần trăm không được vượt quá 100', path: ['value'] },
  )
  .refine(
    (data) => {
      if (data.usageFrequencyUnit !== 'unlimited') {
        return data.usageFrequencyValue !== null && data.usageFrequencyValue > 0
      }
      return true
    },
    { message: 'Tần suất sử dụng là bắt buộc', path: ['usageFrequencyValue'] },
  )

export type TCampaignVoucherTemplateSchema = z.infer<typeof campaignVoucherTemplateSchema>

export const campaignFormSchema = z
  .object({
    name: z.string().min(1, 'Tên chiến dịch là bắt buộc'),
    type: z.enum([CAMPAIGN_TYPE.NEW_USER, CAMPAIGN_TYPE.BIRTHDAY]),
    startDate: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
    endDate: z.string().default(''),
    recipientLimit: z
      .number({ invalid_type_error: 'Giới hạn người nhận phải là số' })
      .int()
      .positive('Giới hạn người nhận phải lớn hơn 0'),
    voucherGroupSlug: z.string().min(1, 'Chọn nhóm voucher'),
    template: campaignVoucherTemplateSchema,
  })
  .refine((data) => !data.endDate || data.endDate > data.startDate, {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['endDate'],
  })
  .refine((data) => !!data.endDate || data.template.duration > 0, {
    message: 'Cần điền thời hạn voucher nếu không có ngày kết thúc chiến dịch',
    path: ['template', 'duration'],
  })

export type TCampaignFormSchema = z.infer<typeof campaignFormSchema>
