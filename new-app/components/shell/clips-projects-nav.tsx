'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ChevronRight,
  Clock,
  Folder,
  House,
  Share2,
  Trash2,
} from 'lucide-react'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { useClipsFolders } from '@/hooks/use-clips-folders'
import {
  readProjectsSubsectionOpen,
  writeProjectsSubsectionOpen,
} from '@/lib/app-sidebar-sections'
import { isClipsProjectsLibraryPath } from '@/lib/sidebar-layout'
import { cn } from '@/lib/utils'

function subActive(
  pathname: string,
  searchParams: URLSearchParams,
  match: { path?: string; view?: string; folderId?: string; trash?: boolean },
) {
  if (match.trash) return pathname.includes('/trash')
  if (match.path && pathname !== match.path) return false
  if (match.view) return (searchParams.get('view') ?? 'home') === match.view && !searchParams.get('folder')
  if (match.folderId) return searchParams.get('folder') === match.folderId
  if (match.path === '/app/clips' && !match.view) {
    const view = searchParams.get('view') ?? 'home'
    return view === 'home' && !searchParams.get('folder') && !pathname.includes('/trash')
  }
  return false
}

export function ClipsProjectsNav({ active = false }: { active?: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { folders } = useClipsFolders(true)
  const libraryActive = isClipsProjectsLibraryPath(pathname, searchParams)
  const [open, setOpen] = useState(libraryActive)

  useEffect(() => {
    const stored = readProjectsSubsectionOpen()
    if (stored !== null) setOpen(stored)
    else if (libraryActive) setOpen(true)
  }, [libraryActive])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    writeProjectsSubsectionOpen(next)
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="group/projects">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Home"
            isActive={active}
            aria-current={active ? 'page' : undefined}
            data-nav-id="home"
            className="relative h-9 gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground [&>span:last-child]:whitespace-nowrap [&>span:last-child]:overflow-visible"
            render={<Link href="/app/clips" />}
          >
            <House className="size-5" strokeWidth={1.75} />
            <span>Home</span>
          </SidebarMenuButton>
          <SidebarMenuAction
            aria-label="Show filters"
            data-testid="home-filters-toggle"
            onClick={() => onOpenChange(!open)}
          >
            <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
          </SidebarMenuAction>
          <CollapsibleContent>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  isActive={subActive(pathname, searchParams, { path: '/app/clips', view: 'recents' })}
                  render={<Link href="/app/clips?view=recents" />}
                >
                  <Clock className="size-3.5" />
                  <span>Recents</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  isActive={subActive(pathname, searchParams, { path: '/app/clips', view: 'shared' })}
                  render={<Link href="/app/clips?view=shared" />}
                >
                  <Share2 className="size-3.5" />
                  <span>Shared with me</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  isActive={subActive(pathname, searchParams, { trash: true })}
                  render={<Link href="/app/clips/trash" />}
                >
                  <Trash2 className="size-3.5" />
                  <span>Trash</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              {folders.map((f) => (
                <SidebarMenuSubItem key={f.id}>
                  <SidebarMenuSubButton
                    isActive={subActive(pathname, searchParams, { folderId: f.id })}
                    render={<Link href={`/app/clips?folder=${f.id}`} />}
                  >
                    <Folder className="size-3.5" />
                    <span>{f.name}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </SidebarMenu>
    </Collapsible>
  )
}
