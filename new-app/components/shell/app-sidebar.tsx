'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { FlaskConical, Plus } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { LogoMark } from '@/components/brand/logo-mark'
import { useClipsWorkspace } from '@/components/providers/clips-workspace-provider'
import { BUSINESS } from '@/lib/data'
import { clipsNavItems, groupItems, isItemActive, sortGroups } from '@/lib/nav'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

export function AppSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { testMode } = useClipsWorkspace()
  const groups = sortGroups(groupItems(clipsNavItems()))

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" data-testid="app-sidebar">
      <SidebarHeader className="flex h-14 flex-row items-center gap-2.5 px-3">
        <LogoMark className="size-7 shrink-0" />
        <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
          <p className="text-sm font-semibold">
            Transovo <span className="text-brand-gradient">Clips</span>
          </p>
          <p className="truncate text-[11px] text-sidebar-muted">{BUSINESS.workspace}</p>
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin">
        <div className="px-2 pb-1 group-data-[collapsible=icon]:px-1">
          <PrimaryButton
            render={<Link href="/app/clips/new" />}
            className="h-9 w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
          >
            <Plus className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">Create</span>
          </PrimaryButton>
        </div>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-sidebar-muted">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isItemActive(item, pathname, searchParams)
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={active}
                      className={cn(
                        'relative h-9 gap-3 rounded-md text-sm',
                        item.disabled && 'pointer-events-none opacity-50',
                      )}
                      render={
                        item.disabled ? (
                          <span aria-disabled="true" tabIndex={-1} className="flex items-center gap-3" />
                        ) : (
                          <Link href={item.href} />
                        )
                      }
                    >
                      <Icon className="size-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.badge === 'soon' && (
                      <SidebarMenuBadge className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                        Soon
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-2">
        {testMode && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs group-data-[collapsible=icon]:hidden">
            <p className="flex items-center gap-1.5 font-medium text-warning">
              <FlaskConical className="size-3.5" />
              Test mode
            </p>
            <p className="mt-0.5 text-muted-foreground">All features unlocked. No billing.</p>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
