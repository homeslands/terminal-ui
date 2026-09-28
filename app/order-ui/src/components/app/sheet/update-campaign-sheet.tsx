import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PenLine } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  Button,
  ScrollArea,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { DateAndTimePicker } from '@/components/app/picker'
import { CampaignTemplateFields } from '@/components/app/form'
import { ConfirmUpdateCampaignDialog } from '@/components/app/dialog'
import { campaignFormSchema, TCampaignFormSchema } from '@/schemas/campaign.schema'
import {
  APPLICABILITY_RULE,
  CAMPAIGN_TYPE,
  VOUCHER_PAYMENT_METHOD,
  VOUCHER_TYPE,
  VOUCHER_USAGE_FREQUENCY_UNIT,
} from '@/constants'
import { useGetCampaignBySlug, useVoucherGroups } from '@/hooks'
import { ICampaign, IUpdateCampaignRequest, IVoucherGroup } from '@/types'

interface UpdateCampaignSheetProps {
  campaign: ICampaign
}

export default function UpdateCampaignSheet({ campaign }: UpdateCampaignSheetProps) {
  const { t } = useTranslation('campaign')
  const [open, setOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [formData, setFormData] = useState<IUpdateCampaignRequest | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [selectedCampaignType, setSelectedCampaignType] = useState<CAMPAIGN_TYPE>(campaign.type)

  const { data: detailData, isFetching } = useGetCampaignBySlug(open ? campaign.slug : '')
  const { data: voucherGroupsData } = useVoucherGroups({ hasPaging: false })
  const voucherGroups: IVoucherGroup[] = voucherGroupsData?.result?.items ?? []

  const form = useForm<TCampaignFormSchema>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: campaign.name,
      type: campaign.type,
      startDate: campaign.startDate,
      endDate: campaign.endDate ?? '',
      recipientLimit: campaign.recipientLimit,
      voucherGroupSlug: campaign.voucherGroup?.slug ?? '',
      template: {
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
      },
    },
  })

  useEffect(() => {
    if (!open || !detailData?.result || isFetching) return
    const detail = detailData.result
    const tpl = detail.voucherCampaignTemplate
    setSelectedCampaignType(detail.type as CAMPAIGN_TYPE)
    form.reset({
      name: detail.name,
      type: detail.type,
      startDate: detail.startDate,
      endDate: detail.endDate ?? '',
      recipientLimit: detail.recipientLimit,
      voucherGroupSlug: detail.voucherGroup?.slug ?? '',
      template: tpl
        ? {
            title: tpl.title,
            description: tpl.description ?? '',
            type: tpl.type,
            value: tpl.value,
            maxUsage: tpl.maxUsage,
            minOrderValue: tpl.minOrderValue,
            maxItems: tpl.maxItems,
            duration: tpl.duration || 30,
            usageFrequencyUnit: tpl.usageFrequencyUnit as VOUCHER_USAGE_FREQUENCY_UNIT | 'unlimited',
            usageFrequencyValue: tpl.usageFrequencyValue,
            applicabilityRule: tpl.applicabilityRule as APPLICABILITY_RULE,
            paymentMethods: tpl.paymentMethods?.length ? tpl.paymentMethods : [VOUCHER_PAYMENT_METHOD.CASH],
            productSlugs: tpl.productSlugs?.map((p: unknown) =>
              typeof p === 'string' ? p : (p as { product?: { slug?: string }; slug?: string })?.product?.slug ?? (p as { slug?: string })?.slug ?? ''
            ).filter(Boolean) ?? [],
            startDate: tpl.startDate ?? '',
            endDate: tpl.endDate ?? '',
          }
        : form.getValues('template'),
    })
    setResetKey((k) => k + 1)
  }, [open, detailData, isFetching]) // eslint-disable-line react-hooks/exhaustive-deps

  const parseFormDate = (s: string) => new Date(s.replace(' ', 'T'))

  const disableEndDate = (date: Date) => {
    const start = form.getValues('startDate')
    if (!start) return false
    const startOnly = parseFormDate(start)
    startOnly.setHours(0, 0, 0, 0)
    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)
    return dateOnly < startOnly
  }

  const handleDateChange = (field: 'startDate' | 'endDate', value: string | null) => {
    form.setValue(field, value ?? '', { shouldValidate: true })
    if (field === 'startDate' && value) {
      const end = form.getValues('endDate')
      if (end && parseFormDate(end) < parseFormDate(value)) {
        form.setValue('endDate', '', { shouldValidate: true })
      }
    }
  }

  const handleSubmit = (data: TCampaignFormSchema) => {
    setFormData({
      slug: campaign.slug,
      name: data.name,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate || null,
      recipientLimit: data.recipientLimit,
      voucherGroupSlug: data.voucherGroupSlug,
      voucherCampaignTemplate: {
        ...data.template,
        duration: data.endDate ? null : data.template.duration,
      },
    })
    setIsConfirmOpen(true)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="gap-1 justify-start px-2 w-full">
          <PenLine className="h-4 w-4" />
          {t('campaign.editCampaign')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-4xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{campaign.name}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)]">
            <Form {...form}>
              <form
                id="update-campaign-form"
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex flex-col gap-3 p-4"
              >
                {/* Campaign info */}
                <div className="p-4 bg-white rounded-md border dark:bg-transparent">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">
                    {t('campaign.title')}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-destructive">*</span> {t('campaign.name')}
                          </FormLabel>
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
                          <FormLabel>
                            <span className="text-destructive">*</span> {t('campaign.type')}
                          </FormLabel>
                          <Select
                            value={selectedCampaignType}
                            onValueChange={(v) => {
                              setSelectedCampaignType(v as CAMPAIGN_TYPE)
                              field.onChange(v)
                            }}
                            disabled
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="--" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(CAMPAIGN_TYPE).map((type) => (
                                <SelectItem key={type} value={type}>
                                  {t(`campaign.types.${type}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              <span className="text-destructive">*</span> {t('campaign.startDate')}
                            </FormLabel>
                            <FormControl>
                              <DateAndTimePicker
                                date={field.value}
                                onSelect={(v) => handleDateChange('startDate', v)}
                                showTime
                              />
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
                            <FormLabel>
                              {t('campaign.endDate')}
                            </FormLabel>
                            <FormControl>
                              <DateAndTimePicker
                                date={field.value}
                                onSelect={(v) => handleDateChange('endDate', v)}
                                disabledDates={disableEndDate}
                                showTime
                                clearable
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="recipientLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-destructive">*</span>{' '}
                            {t('campaign.recipientLimit')}
                          </FormLabel>
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
                      name="voucherGroupSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <span className="text-destructive">*</span>{' '}
                            {t('campaign.voucherGroups')}
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="--" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {voucherGroups.map((g) => (
                                <SelectItem key={g.slug} value={g.slug}>
                                  {g.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Voucher template */}
                <p className="text-sm font-medium text-muted-foreground px-1">
                  {t('campaign.template.title')}
                </p>
                <CampaignTemplateFields key={resetKey} />
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('campaign.cancel')}
            </Button>
            <Button type="submit" form="update-campaign-form">
              {t('campaign.save')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
      {isConfirmOpen && (
        <ConfirmUpdateCampaignDialog
          isOpen={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          onCloseSheet={() => setOpen(false)}
          campaign={formData}
        />
      )}
    </Sheet>
  )
}
