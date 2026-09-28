import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'

import {
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
import { campaignFormSchema, TCampaignFormSchema } from '@/schemas'
import { IVoucherGroup } from '@/types'
import { CAMPAIGN_TYPE } from '@/constants'
import { useVoucherGroups } from '@/hooks'

interface CampaignInfoFormProps {
  defaultValues?: Partial<TCampaignFormSchema>
  onSubmit: (data: TCampaignFormSchema) => void
  isLoading?: boolean
  isEdit?: boolean
}

export function CampaignInfoForm({ defaultValues, onSubmit, isLoading, isEdit }: CampaignInfoFormProps) {
  const { t } = useTranslation('campaign')
  const { data: voucherGroupsData } = useVoucherGroups({ hasPaging: false })

  const form = useForm<TCampaignFormSchema>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: '',
      type: CAMPAIGN_TYPE.NEW_USER,
      startDate: '',
      endDate: '',
      recipientLimit: 100,
      voucherGroupSlug: '',
      ...defaultValues,
    },
  })

  const voucherGroups: IVoucherGroup[] = voucherGroupsData?.result?.items ?? []

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('campaign.name')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('campaign.name')} />
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
              <FormLabel>{t('campaign.type')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('campaign.type')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={CAMPAIGN_TYPE.NEW_USER}>
                    {t('campaign.types.new-user')}
                  </SelectItem>
                  <SelectItem value={CAMPAIGN_TYPE.BIRTHDAY}>
                    {t('campaign.types.user-birthday')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('campaign.startDate')}</FormLabel>
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
                <FormLabel>{t('campaign.endDate')}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
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
              <FormLabel>{t('campaign.recipientLimit')}</FormLabel>
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
              <FormLabel>{t('campaign.voucherGroups')}</FormLabel>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border rounded p-2">
                {voucherGroups.map((group) => (
                  <label key={group.slug} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      value={group.slug}
                      checked={field.value === group.slug}
                      onChange={(e) => {
                        if (e.target.checked) {
                          field.onChange(group.slug)
                        } else {
                          field.onChange('')
                        }
                      }}
                    />
                    {group.title}
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? '...' : isEdit ? t('campaign.save') : t('campaign.createCampaign')}
        </Button>
      </form>
    </Form>
  )
}
