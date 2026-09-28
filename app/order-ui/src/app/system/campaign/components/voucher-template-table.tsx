import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Plus } from 'lucide-react'

import { Button } from '@/components/ui'
import { ICampaignVoucherTemplate } from '@/types'
import { TCampaignVoucherTemplateSchema } from '@/schemas/campaign.schema'
import { VoucherTemplateDialog } from './voucher-template-dialog'

interface VoucherTemplateTableProps {
  templates: ICampaignVoucherTemplate[]
  onTemplatesChange: (templates: TCampaignVoucherTemplateSchema[]) => void
  isLoading?: boolean
}

export function VoucherTemplateTable({
  templates,
  onTemplatesChange,
  isLoading,
}: VoucherTemplateTableProps) {
  const { t } = useTranslation('campaign')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const [workingTemplates, setWorkingTemplates] =
    useState<TCampaignVoucherTemplateSchema[]>(templates as unknown as TCampaignVoucherTemplateSchema[])

  const handleAdd = (data: TCampaignVoucherTemplateSchema) => {
    const updated = [...workingTemplates, data]
    setWorkingTemplates(updated)
    onTemplatesChange(updated)
  }

  const handleEdit = (index: number, data: TCampaignVoucherTemplateSchema) => {
    const updated = workingTemplates.map((item, i) => (i === index ? data : item))
    setWorkingTemplates(updated)
    onTemplatesChange(updated)
    setEditingIndex(null)
  }

  const handleDelete = (index: number) => {
    const updated = workingTemplates.filter((_, i) => i !== index)
    setWorkingTemplates(updated)
    onTemplatesChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{t('campaign.template.title')}</h3>
        <Button
          size="sm"
          disabled={isLoading}
          onClick={() => {
            setEditingIndex(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('campaign.template.addTemplate')}
        </Button>
      </div>

      {workingTemplates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('campaign.empty')}</p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">{t('campaign.template.templateTitle')}</th>
                <th className="text-left p-3">{t('campaign.template.type')}</th>
                <th className="text-left p-3">{t('campaign.template.value')}</th>
                <th className="text-left p-3">{t('campaign.template.maxUsage')}</th>
                <th className="text-left p-3">{t('campaign.template.minOrderValue')}</th>
                <th className="text-left p-3">{t('campaign.template.duration')}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {workingTemplates.map((template, index) => (
                <tr key={index} className="border-t">
                  <td className="p-3">{template.title}</td>
                  <td className="p-3">{template.type}</td>
                  <td className="p-3">{template.value}</td>
                  <td className="p-3">{template.maxUsage}</td>
                  <td className="p-3">{template.minOrderValue}</td>
                  <td className="p-3">{template.duration}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingIndex(index)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDelete(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VoucherTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultValues={editingIndex !== null ? workingTemplates[editingIndex] : undefined}
        onSubmit={(data) => {
          if (editingIndex !== null) {
            handleEdit(editingIndex, data)
          } else {
            handleAdd(data)
          }
        }}
      />
    </div>
  )
}
