import { describe, it, expect } from 'vitest'
import { sidebarRoutes } from '@/router/routes'
import { ROUTE } from '@/constants'
import { Permission } from '@/constants/sidebar-permission'

describe('sidebarRoutes — VAT', () => {
  it('includes /system/vat-request with VAT_MANAGEMENT permission code', () => {
    const route = sidebarRoutes.find((r) => r.path === ROUTE.STAFF_VAT_REQUEST)
    expect(route).toBeDefined()
    expect(route?.permission).toBe(Permission.VAT_MANAGEMENT)
    // JWT scope dùng module-level name 'VAT_REQUEST' (không phải fine-grained
    // 'VIEW_VAT_REQUEST'). Sidebar/route gate match JWT module name; còn các
    // fine-grained codes (VIEW_/EDIT_/UPDATE_) check ở REST userInfo cho
    // button-level gating.
    expect(Permission.VAT_MANAGEMENT).toBe('VAT_REQUEST')
  })
})
