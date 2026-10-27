'use client'

import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar'
import { useSidebarSectionOpen } from '@/hooks/use-sidebar-section-open'
import type { SidebarProductSection } from '@/lib/app-sidebar-sections'
import { cn } from '@/lib/utils'

export function SidebarProductSection({
  section,
  title,
  active,
  defaultOpen = true,
  children,
}: {
  section: SidebarProductSection
  title: string
  active: boolean
  defaultOpen?: boolean
  children: ReactNode
}) {
  const { open, onOpenChange } = useSidebarSectionOpen(section, defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="group/section">
      <SidebarGroup
        data-testid={`sidebar-section-${section}`}
        className={cn(active && 'rounded-md bg-sidebar-accent/40 ring-1 ring-sidebar-border')}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-1 px-2 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel
            className={cn(
              'flex flex-1 cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wider',
              active ? 'text-sidebar-accent-foreground' : 'text-sidebar-muted',
            )}
          >
            <ChevronRight
              className={cn(
                'size-3.5 shrink-0 transition-transform',
                open && 'rotate-90',
              )}
            />
            {title}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <SidebarGroupLabel
          className={cn(
            'hidden px-2 text-[10px] font-semibold uppercase tracking-wider group-data-[collapsible=icon]:flex',
            active ? 'text-sidebar-accent-foreground' : 'text-sidebar-muted',
          )}
        >
          {title.slice(0, 1)}
        </SidebarGroupLabel>
        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">{children}</CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
