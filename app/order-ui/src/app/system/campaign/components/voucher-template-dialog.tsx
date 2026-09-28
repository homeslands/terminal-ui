import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import {
  campaignVoucherTemplateSchema,
  TCampaignVoucherTemplateSchema,
} from '@/schemas/campaign.schema'
import {
  APPLICABILITY_RULE,
  VOUCHER_PAYMENT_METHOD,
  VOUCHER_TYPE,
  VOUCHER_USAGE_FREQUENCY_UNIT,
} from '@/constants'

interface VoucherTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues?: Partial<TCampaignVoucherTemplateSchema>
  onSubmit: (data: TCampaignVoucherTemplateSchema) => void
}

const FREQUENCY_UNIT_VALUES = [
  VOUCHER_USAGE_FREQUENCY_UNIT.HOUR,
  VOUCHER_USAGE_FREQUENCY_UNIT.DAY,
  VOUCHER_USAGE_FREQUENCY_UNIT.WEEK,
  VOUCHER_USAGE_FREQUENCY_UNIT.MONTH,
  VOUCHER_USAGE_FREQUENCY_UNIT.YEAR,
  'unlimited',
] as const

export function VoucherTemplateDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: VoucherTemplateDialogProps) {
  const { t } = useTranslation('campaign')

  const form = useForm<TCampaignVoucherTemplateSchema>({
    resolver: zodResolver(campaignVoucherTemplateSchema),
    defaultValues: {
      title: '',
      description: '',
      type: VOUCHER_TYPE.FIXED_VALUE,
      value: 0,
      maxUsage: 1,
      minOrderValue: 0,
      maxItems: 1,
      duration: 30,
      usageFrequencyUnit: 'unlimited',
      usageFrequencyValue: null,
      applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
      paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
      productSlugs: [],
      startDate: '',
      endDate: '',
      ...defaultValues,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        title: '',
        description: '',
        type: VOUCHER_TYPE.FIXED_VALUE,
        value: 0,
        maxUsage: 1,
        minOrderValue: 0,
        maxItems: 1,
        duration: 30,
        usageFrequencyUnit: 'unlimited',
        usageFrequencyValue: null,
        applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED,
        paymentMethods: [VOUCHER_PAYMENT_METHOD.CASH],
        productSlugs: [],
        startDate: '',
        endDate: '',
        ...defaultValues,
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const usageFrequencyUnit = form.watch('usageFrequencyUnit')

  const handleSubmit = (data: TCampaignVoucherTemplateSchema) => {
    onSubmit(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {defaultValues?.title
              ? t('campaign.template.editTemplate')
              : t('campaign.template.addTemplate')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('campaign.template.templateTitle')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('campaign.template.description')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={VOUCHER_TYPE.FIXED_VALUE}>{t('campaign.template.voucherTypes.fixed_value')}</SelectItem>
                        <SelectItem value={VOUCHER_TYPE.PERCENT_ORDER}>{t('campaign.template.voucherTypes.percent_order')}</SelectItem>
                        <SelectItem value={VOUCHER_TYPE.SAME_PRICE_PRODUCT}>{t('campaign.template.voucherTypes.same_price_product')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.value')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxUsage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.maxUsage')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minOrderValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.minOrderValue')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxItems"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.maxItems')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.duration')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="usageFrequencyUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.usageFrequencyUnit')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FREQUENCY_UNIT_VALUES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`campaign.template.frequencyUnits.${v}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {usageFrequencyUnit !== 'unlimited' && (
                <FormField
                  control={form.control}
                  name="usageFrequencyValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('campaign.template.usageFrequencyValue')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="applicabilityRule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.applicabilityRule')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={APPLICABILITY_RULE.ALL_REQUIRED}>
                          {t('campaign.template.applicabilityRules.all_required')}
                        </SelectItem>
                        <SelectItem value={APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED}>
                          {t('campaign.template.applicabilityRules.at_least_one_required')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.templateStartDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('campaign.template.templateEndDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('campaign.cancel')}
              </Button>
              <Button type="submit">
                {defaultValues?.title ? t('campaign.save') : t('campaign.template.addTemplate')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
