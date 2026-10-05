import { useMemo } from 'react'
import { ChevronRight, House, Sparkles } from 'lucide-react'
import { useLocation, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useSidebar } from '@/components/ui'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  IconWrapper,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui'
import { useUserStore } from '@/stores'
import { sidebarRoutes } from '@/router/routes'
import { cn } from '@/lib'
import { NotificationMessageCode, Role, ROUTE } from '@/constants'
import { useNotification, usePagination, usePermissionsStatus } from '@/hooks';
import { TerminalLogo } from '@/assets/images'

export function AppSidebar() {
  const { t } = useTranslation('sidebar')
  const location = useLocation()
  const { userInfo } = useUserStore()
  const currentRole = userInfo?.role?.name
  const { state, toggleSidebar } = useSidebar()
  // Quyền lấy qua `GET {terminal}/auth/scope`, không decode từ token (token do
  // shared-user ký không còn field `scope`). Dùng bản có `isLoading` để phân
  // biệt "chưa biết quyền" với "không có quyền nào" — xem `filteredRoutes`.
  const { permissions, isLoading: isScopeLoading } = usePermissionsStatus()
  const { pagination } = usePagination()
  const {
    data: notificationsData
  } = useNotification({
    receiver: userInfo?.slug,
    page: pagination.pageIndex,
    size: pagination.pageSize,
  })

  const notificationList = notificationsData?.pages.flatMap(page => page.result.items) || []

  // count unread order needs processed notification
  const orderNeedsProcessed = notificationList.filter(notification => notification.message === NotificationMessageCode.ORDER_NEEDS_PROCESSED && !notification.isRead).length
  const orderNeedsDelivered = notificationList.filter(notification => notification.message === NotificationMessageCode.ORDER_NEEDS_DELIVERED && !notification.isRead).length
  // const orderNeedsCancelled = notificationList.filter(notification => notification.message === NotificationMessageCode.ORDER_NEEDS_CANCELLED && !notification.isRead).length

  // Update notification counts in routes
  const updatedRoutes = useMemo(() => {
    return sidebarRoutes
      .filter(route => {
        // If allowedRoles defined, current role must be in the list
        if (route.allowedRoles && route.allowedRoles.length > 0) {
          return currentRole && route.allowedRoles.includes(currentRole as Role)
        }
        return true
      })
      .map(route => {
        let notificationCount = undefined;

        if (route.path === ROUTE.STAFF_DELIVERY_MANAGEMENT) {
          notificationCount = orderNeedsDelivered;
        } else if (route.path === ROUTE.STAFF_CHEF_ORDER || route.path === ROUTE.STAFF_ORDER_MANAGEMENT) {
          notificationCount = orderNeedsProcessed;
        }

        return {
          ...route,
          notificationCount,
          title: t(route.title),
          children: route.children?.map(child => ({
            ...child,
            title: t(child.title),
          }))
        };
      });
  }, [orderNeedsDelivered, orderNeedsProcessed, t, currentRole]);

  const isActive = (path: string) => {
    // Override: trang `/system/table/:id/payment` thuộc luồng "Đặt món" admin
    // (vào từ Đặt món → Tiếp tục thanh toán). Trùng prefix `/system/table`
    // với "Quản lý bàn" nên không override sẽ bị highlight Quản lý bàn.
    const isAdminTablePayment =
      location.pathname.startsWith(`${ROUTE.STAFF_TABLE_MANAGEMENT}/`) &&
      location.pathname.endsWith('/payment');
    if (isAdminTablePayment) {
      return path === ROUTE.STAFF_MENU;
    }

    // If the path is exactly the same, return true
    if (location.pathname === path) return true;

    // For nested routes, check if the current path starts with the menu path
    // and the next character is either '/' or the end of the string
    return location.pathname.startsWith(path) &&
      (location.pathname[path.length] === '/' || location.pathname.length === path.length);
  }

  // const translatedSidebarRoute = (sidebarRoutes: ISidebarRoute) => ({
  //   ...sidebarRoutes,
  //   title: t(`${sidebarRoutes.title}`),
  //   children: sidebarRoutes.children?.map((child) => ({
  //     ...child,
  //     title: t(`${child.title}`),
  //   })),
  // })

  // Translate all sidebar routes
  // const translatedRoutes = sidebarRoutes.map(translatedSidebarRoute)

  // Filter routes by permission
  const filteredRoutes = useMemo(() => {
    // Chưa lấy xong scope ⇒ trả rỗng để hiện khung xương bên dưới, KHÔNG hiện
    // sidebar đã lọc bằng một mảng quyền rỗng (nhìn ra giống "không có quyền
    // nào" và người dùng thấy menu trống hẳn).
    if (isScopeLoading) return []

    return updatedRoutes.filter((route) => {
      // Permission-gated routes: show only when the user's scope includes it.
      if (route?.permission) return permissions.includes(route.permission)
      // Role-gated routes (no scope permission) already passed the allowedRoles
      // filter in `updatedRoutes` — let them through here.
      return Boolean(route.allowedRoles && route.allowedRoles.length > 0)
    })
  }, [updatedRoutes, permissions, isScopeLoading])

  return (
    <Sidebar
      variant="inset"
      className={`z-50 border-r shadow-2xl shadow-gray-300 dark:shadow-none`}
      collapsible="icon"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="w-full">
            <NavLink
              to={ROUTE.OVERVIEW}
              className="flex justify-center items-center p-2"
            >
              {state === 'collapsed' ? (
                <div className="transition-colors duration-200 hover:text-primary">
                  <House size={20} />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <img
                    src={TerminalLogo}
                    alt="The Terminal"
                    className="h-7 w-7 rounded-full object-cover"
                  />
                  <span className="text-base font-bold text-pos-gold">
                    The Terminal
                  </span>
                </div>
              )}
            </NavLink>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-x-auto custom-scroll scroll-smooth">
        <SidebarGroup>
          {/* Trong lúc chờ `/auth/scope` trả về: hiện KHUNG XƯƠNG, không hiện
              sidebar trống. Sidebar trống nhìn ra giống "tài khoản này không có
              quyền gì", còn khung xương nói đúng sự thật là "đang tải". */}
          {isScopeLoading ? (
            <SidebarMenu>
              {[0, 1, 2, 3, 4].map((i) => (
                <SidebarMenuItem key={i}>
                  <div className="mx-2 my-1 h-8 animate-pulse rounded-md bg-muted" />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          ) : (
          <SidebarMenu>
            {filteredRoutes.map((item) => (
              <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    className={cn(
                      'hover:bg-primary hover:text-white',
                      isActive(item.path) ? 'bg-primary text-white' : '',
                    )}
                  >
                    <NavLink
                      to={item.path}
                      onClick={(e) => {
                        if (state === 'collapsed') {
                          e.preventDefault()
                          toggleSidebar()
                        } else {
                          // Collapse sidebar after navigation on mobile
                          if (window.innerWidth < 768) {
                            toggleSidebar()
                          }
                        }
                      }}
                    >
                      {item.icon && (
                        <IconWrapper
                          Icon={item.icon}
                          className={
                            isActive(item.path) ? 'bg-primary text-white' : ''
                          }
                        />
                      )}
                      <span className="text-xs font-thin xl:text-sm">{item.title}</span>
                      {/* </div> */}
                      {item?.notificationCount && item.notificationCount > 0 ? (
                        <span
                          className={`px-2 py-1 ml-2 text-xs rounded-full ${isActive(item.path) ? 'bg-white text-primary' : 'bg-primary text-white'
                            } ${item.notificationCount > 99 ? 'px-3' : ''}`}
                        >
                          {item.notificationCount > 9 ? '9+' : item.notificationCount}
                        </span>
                      ) : null}

                    </NavLink>
                  </SidebarMenuButton>
                  {item.children?.length ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction className="data-[state=open]:rotate-90">
                          <ChevronRight />
                          <span className="sr-only">Toggle</span>
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                className={
                                  isActive(subItem.path) ? 'text-primary' : ''
                                }
                              >
                                <NavLink
                                  to={subItem.path}
                                  className="flex flex-col gap-4"
                                >
                                  <span className="text-xs">{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : null}
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
          )}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild></DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Sparkles />
                    Upgrade to Pro
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
