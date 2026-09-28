import React from 'react'

import type { Role } from '@/constants/role'

export interface ISidebarRoute {
  title: string
  path: string
  icon?: React.ComponentType
  isActive?: boolean
  permission?: string
  children?: ISidebarRoute[]
  notificationCount?: number
  allowedRoles?: Role[]
}
