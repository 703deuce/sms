'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { PhoneCall } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/newui-transplant/components/ui/sidebar'
import {
  isVoiceProductCustomerVisible,
  mctbLaunchCustomerHome,
} from '@/lib/products/launch-product-availability'
import { resolveCustomerNavSections, type NavItem, type NavSubItem } from '@/newui-transplant/lib/nav'
import {
  isReceptionistWizardAreaPath,
  isReceptionistWizardEditPath,
  stepIdFromReceptionistQuery,
} from '@/lib/voice/receptionist/wizard-step-url'

function isTopNavActive(pathname: string, item: NavItem) {
  if (item.children?.length) {
    if (pathname === item.href) return true
    if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) {
      if (isReceptionistWizardEditPath(pathname)) return false
      return true
    }
    return false
  }
  if (pathname === item.href) return true
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true
  return false
}

function isSubNavActive(pathname: string, searchParams: URLSearchParams, child: NavSubItem) {
  if (!isReceptionistWizardEditPath(pathname)) return false
  const stepParam = searchParams.get('step')
  const childUrl = new URL(child.href, 'http://local')
  const childStep = childUrl.searchParams.get('step')
  if (childStep && stepParam) {
    return childStep === stepParam.trim().toLowerCase()
  }
  if (!stepParam && childStep === 'goals') return true
  const activeId = stepIdFromReceptionistQuery(stepParam)
  const childId = stepIdFromReceptionistQuery(childStep)
  return activeId !== null && childId !== null && activeId === childId
}

function receptionistAreaExpanded(pathname: string) {
  return isReceptionistWizardAreaPath(pathname)
}

export function AppSidebar({ userName }: { userName?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2 px-3 pb-1 pt-3">
        <Link href={mctbLaunchCustomerHome()} className="flex items-center gap-2.5 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <PhoneCall className="size-4" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            Transovo
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="pb-2 pt-0">
        {resolveCustomerNavSections().map((section) => (
          <SidebarGroup key={section.label} className="px-2 py-0.5">
            <SidebarGroupLabel className="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const hasChildren = Boolean(item.children?.length)
                  const parentActive = isTopNavActive(pathname, item)
                  const showChildren = hasChildren && receptionistAreaExpanded(pathname)
                  const parentHighlighted =
                    parentActive ||
                    (hasChildren &&
                      isReceptionistWizardEditPath(pathname) &&
                      receptionistAreaExpanded(pathname))

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={parentHighlighted}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                        className="h-8 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-sidebar-primary"
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge ? (
                        <SidebarMenuBadge className="rounded-full bg-sidebar-primary/15 text-[10px] text-sidebar-primary">
                          {item.badge}
                        </SidebarMenuBadge>
                      ) : null}
                      {showChildren ? (
                        <SidebarMenuSub>
                          {item.children!.map((child) => {
                            const childActive = isSubNavActive(pathname, searchParams, child)
                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton
                                  isActive={childActive}
                                  size="sm"
                                  render={<Link href={child.href} />}
                                >
                                  <span>{child.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {isVoiceProductCustomerVisible() ? (
        <SidebarFooter className="px-3 pb-4 group-data-[collapsible=icon]:hidden">
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-sidebar-accent-foreground">AI minutes</span>
              <span className="text-sidebar-foreground/70">1,284 / 2,000</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar-border">
              <div className="h-full w-[64%] rounded-full bg-sidebar-primary" />
            </div>
            <Link href="/settings/billing" className="mt-2 inline-block text-[11px] text-sidebar-primary hover:underline">
              Manage plan
            </Link>
          </div>
        </SidebarFooter>
      ) : null}
      <SidebarRail />
    </Sidebar>
  )
}
