import { MoreHorizontal } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui'
import { UpdateCampaignSheet } from '@/components/app/sheet'
import { ICampaign } from '@/types'

export function CampaignActions({ campaign }: { campaign: ICampaign }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex flex-col gap-1 w-fit">
          <UpdateCampaignSheet campaign={campaign} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
