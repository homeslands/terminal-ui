import SystemMenus from '@/app/system/menu/components/system-menus'
import { ISpecificMenu } from '@/types'

export function SystemMenuTabscontent({
  menu,
  isLoading,
  activeTableSlug,
}: {
  menu?: ISpecificMenu
  isLoading?: boolean
  activeTableSlug: string | null
}) {
  return (
    <div className="flex flex-col w-full">
      <SystemMenus menu={menu} isLoading={isLoading} activeTableSlug={activeTableSlug} />
    </div>
  )
}
