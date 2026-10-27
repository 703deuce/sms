'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ChevronRight,
  Clock,
  Folder,
  Home,
  Share2,
  Trash2,
} from 'lucide-react'
import { NewFolderDialog } from '@/components/drive/new-folder-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarMenu,
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

export function ClipsProjectsNav() {
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
          <CollapsibleTrigger className="flex w-full items-center rounded-md outline-hidden focus-visible:ring-2 ring-sidebar-ring">
            <SidebarMenuButton
              tooltip="Projects"
              isActive={libraryActive}
              className="h-8 flex-1 gap-2 text-sm"
              type="button"
            >
              <ChevronRight
                className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')}
              />
              <span className="flex-1 text-left">Projects</span>
              <NewFolderDialog variant="sidebar" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  isActive={subActive(pathname, searchParams, { path: '/app/clips' })}
                  render={<Link href="/app/clips" />}
                >
                  <Home className="size-3.5" />
                  <span>Home</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
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
