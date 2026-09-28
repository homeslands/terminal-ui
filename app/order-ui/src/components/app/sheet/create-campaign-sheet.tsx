import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusCircle } from 'lucide-react'

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
import { ConfirmCreateCampaignDialog } from '@/components/app/dialog'
import { campaignFormSchema, TCampaignFormSchema } from '@/schemas/campaign.schema'
import { APPLICABILITY_RULE, CAMPAIGN_TYPE, VOUCHER_PAYMENT_METHOD, VOUCHER_TYPE } from '@/constants'
import { useVoucherGroups } from '@/hooks'
import { ICreateCampaignRequest, IVoucherGroup } from '@/types'

export default function CreateCampaignSheet() {
  const { t } = useTranslation('campaign')
  const [open, setOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [formData, setFormData] = useState<ICreateCampaignRequest | null>(null)

  const { data: voucherGroupsData } = useVoucherGroups({ hasPaging: false })
  const voucherGroups: IVoucherGroup[] = voucherGroupsData?.result?.items ?? []

  const form = useForm<TCampaignFormSchema>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: '',
      type: CAMPAIGN_TYPE.NEW_USER,
      startDate: '',
      endDate: '',
      recipientLimit: 100,
      voucherGroupSlug: '',
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

  const disableStartDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

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
        <Button>
          <PlusCircle size={16} />
          {t('campaign.createCampaign')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-4xl">
        <SheetHeader className="p-4">
          <SheetTitle className="text-primary">{t('campaign.createCampaign')}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 max-h-[calc(100vh-8rem)]">
            <Form {...form}>
              <form
                id="create-campaign-form"
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="--">
                                  {field.value ? t(`campaign.types.${field.value}`) : undefined}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
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
                                disabledDates={disableStartDate}
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
                            <span className="text-destructive">*</span> {t('campaign.voucherGroups')}
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
                <CampaignTemplateFields />
              </form>
            </Form>
          </ScrollArea>
          <SheetFooter className="shrink-0 p-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('campaign.cancel')}
            </Button>
            <Button type="submit" form="create-campaign-form">
              {t('campaign.createCampaign')}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
      {isConfirmOpen && (
        <ConfirmCreateCampaignDialog
          isOpen={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          onCloseSheet={() => {
            form.reset()
            setOpen(false)
          }}
          campaign={formData}
        />
      )}
    </Sheet>
  )
}
