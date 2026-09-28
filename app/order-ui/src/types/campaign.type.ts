import { IBase } from "./base.type"
import { APPLICABILITY_RULE, VOUCHER_PAYMENT_METHOD, VOUCHER_USAGE_FREQUENCY_UNIT, CAMPAIGN_TYPE, CAMPAIGN_STATUS } from "@/constants"

export interface ICampaignTypeKey {
  key: string
}

export interface ICampaignVoucherGroup {
  slug: string
  title: string
}

// Response shape returned by GET /campaigns and GET /campaigns/:slug
export interface ICampaignVoucherTemplateResponse extends IBase {
  title: string
  description: string
  duration: number | null
  value: number
  valueType: string
  type: string
  maxUsage: number
  minOrderValue: number
  applicabilityRule: string
  usageFrequencyUnit: string
  usageFrequencyValue: number
  maxItems: number
  paymentMethods: (typeof VOUCHER_PAYMENT_METHOD)[keyof typeof VOUCHER_PAYMENT_METHOD][]
  productSlugs: string[]
  startDate?: string
  endDate?: string
}

// Request body shape used in POST /campaigns and PUT /campaigns/:slug
export interface ICampaignVoucherTemplate {
  title: string
  description?: string
  duration: number | null
  value: number
  type: string
  maxUsage: number
  minOrderValue: number
  applicabilityRule: APPLICABILITY_RULE
  usageFrequencyUnit: VOUCHER_USAGE_FREQUENCY_UNIT | 'unlimited'
  usageFrequencyValue: number | null
  maxItems: number
  paymentMethods: (typeof VOUCHER_PAYMENT_METHOD)[keyof typeof VOUCHER_PAYMENT_METHOD][]
  productSlugs: string[]
  startDate?: string
  endDate?: string
}

export interface ICampaign extends IBase {
  name: string
  type: CAMPAIGN_TYPE
  status: CAMPAIGN_STATUS
  recipientLimit: number
  startDate: string
  endDate: string | null
  voucherGroup: ICampaignVoucherGroup
  voucherCampaignTemplate: ICampaignVoucherTemplateResponse
}

export interface IGetCampaignRequestParams {
  hasPaging?: boolean
  page?: number | 1
  limit?: number | 10
  sort?: 'DESC' | 'ASC'
  status?: CAMPAIGN_STATUS
  type?: CAMPAIGN_TYPE
  startDate?: string
  endDate?: string
}

export interface ICreateCampaignRequest {
  name: string
  type: CAMPAIGN_TYPE
  recipientLimit: number
  startDate: string
  endDate: string | null
  voucherGroupSlug: string
  voucherCampaignTemplate: ICampaignVoucherTemplate
}

export interface IUpdateCampaignRequest {
  slug: string
  name: string
  type: CAMPAIGN_TYPE
  recipientLimit: number
  startDate: string
  endDate: string | null
  voucherGroupSlug: string
  voucherCampaignTemplate: ICampaignVoucherTemplate
}
