'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronsUpDown, PhoneCall } from 'lucide-react'
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
import { mctbLaunchCustomerHome } from '@/lib/products/launch-product-availability'
import { resolveCustomerNavSections, type NavItem } from '@/newui-transplant/lib/nav'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'
import { useOpusWorkspaceData, workspaceInitials } from '@/newui-transplant/context/opus-workspace-data'

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true
  return false
}

export function AppSidebar({ userName }: { userName?: string }) {
  const pathname = usePathname()
  const { workspaceName, business } = useOpusWorkspaceData()
  const displayName = business?.name || workspaceName || BUSINESS.name
  const initials = workspaceInitials(displayName)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <Link href={mctbLaunchCustomerHome()} className="flex items-center gap-2.5 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <PhoneCall className="size-4" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            Transovo
          </span>
        </Link>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-sidebar-border text-[11px] font-semibold text-sidebar-accent-foreground">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-sidebar-accent-foreground">{displayName}</span>
            <span className="block text-[11px] text-sidebar-foreground/70">Pro workspace</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-sidebar-foreground/60" aria-hidden="true" />
        </button>
      </SidebarHeader>

      <SidebarContent className="pb-2">
        {resolveCustomerNavSections().map((section) => (
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
      <SidebarRail />
    </Sidebar>
  )
}
