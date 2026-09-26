'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PhoneCall } from 'lucide-react'
import type { ReactNode } from 'react'
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
  SidebarRail,
} from '@/newui-transplant/components/ui/sidebar'
import type { NavItem, NavSection } from '@/newui-transplant/lib/nav'

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true
  return false
}

export type TransplantAppSidebarProps = {
  sections: NavSection[]
  homeHref: string
  /** Replaces mock workspace chip (workspace switcher, call-handling switcher, etc.). */
  workspaceControl: ReactNode
  /** Replaces mock AI minutes footer when provided. */
  footer?: ReactNode
}

export function AppSidebar({ sections, homeHref, workspaceControl, footer }: TransplantAppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <Link href={homeHref} className="flex items-center gap-2.5 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <PhoneCall className="size-4" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            Transovo
          </span>
        </Link>
        <div className="group-data-[collapsible=icon]:hidden">{workspaceControl}</div>
      </SidebarHeader>

      <SidebarContent className="pb-2">
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(pathname, item)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                        className="data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-sidebar-primary"
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge ? (
                        <SidebarMenuBadge className="rounded-full bg-sidebar-primary/15 text-[10px] text-sidebar-primary">
                          {item.badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {footer ? (
        <SidebarFooter className="px-3 pb-4 group-data-[collapsible=icon]:hidden">{footer}</SidebarFooter>
      ) : null}
      <SidebarRail />
    </Sidebar>
  )
}
