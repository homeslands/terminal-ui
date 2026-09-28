import { useUserStore } from '@/stores'
import { Role } from '@/constants/role'

export function useCurrentRole(): Role | null {
  const name = useUserStore((s) => s.userInfo?.role?.name)
  if (!name) return null
  if ((Object.values(Role) as string[]).includes(name)) return name as Role
  return null
}
