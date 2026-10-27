'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  AudioLines,
  Download,
  FlaskConical,
  GraduationCap,
  Images,
  LayoutTemplate,
  Palette,
  PenLine,
  Radio,
  Scissors,
  Users,
  Video,
  Film,
} from 'lucide-react'
import { LogoMark } from '@/components/brand/logo-mark'
import { DriveWorkspaceSwitcher } from '@/components/drive/drive-workspace-switcher'
import { ClipsProjectsNav } from '@/components/shell/clips-projects-nav'
import { SidebarCreateMenu } from '@/components/shell/sidebar-create-menu'
import { SidebarProductSection } from '@/components/shell/sidebar-product-section'
import { useClipsWorkspace } from '@/components/providers/clips-workspace-provider'
import { resolveActiveSidebarSection } from '@/lib/app-sidebar-sections'
import { isItemActive, type NavItem } from '@/lib/nav'
import { isScreenwritingEnabled } from '@/lib/features/screenwriting'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { useRecordingEnabled } from '@/lib/recording/use-recording-enabled'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

function NavLink({
  item,
  pathname,
  searchParams,
}: {
  item: NavItem
  pathname: string
  searchParams: URLSearchParams
}) {
  const active = isItemActive(item, pathname, searchParams)
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={active}
        className={cn('relative h-9 gap-3 rounded-md text-sm', item.disabled && 'pointer-events-none opacity-50')}
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
}

export function AppSidebar({ recordingNavEnabled = false }: { recordingNavEnabled?: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { testMode } = useClipsWorkspace()
  const recordingEnabledClient = useRecordingEnabled()
  const recordingEnabled = recordingNavEnabled || recordingEnabledClient
  const activeSection = resolveActiveSidebarSection(pathname, searchParams)
  const t2vEnabled = isT2vFeatureEnabled()

  useEffect(() => {
    console.info('[nav:ai-video-flag]', { enabled: t2vEnabled })
  }, [t2vEnabled])

  useEffect(() => {
    console.info('[nav:section]', { activeSection, pathname })
  }, [activeSection, pathname])

  const clipsItems: NavItem[] = [
    { title: 'Streamer', href: '/app/streamer', icon: Radio },
    { title: 'Exports', href: '/app/exports', icon: Download },
  ]

  const editorItems: NavItem[] = [
    { title: 'Editor hub', href: '/app/editor', icon: Scissors, isActive: (p) => p === '/app/editor' || p.startsWith('/app/editor/') },
    ...(recordingEnabled
      ? [
          { title: 'Rooms', href: '/app/rooms/new', icon: Video },
          { title: 'Rooms recordings', href: '/app/rooms', icon: Video },
        ]
      : []),
    { title: 'Media library', href: '/app/clips/media', icon: Images },
    { title: 'Layout packs', href: '/app/clips?view=layouts', icon: LayoutTemplate },
    { title: 'Voice', href: '/app/voice', icon: AudioLines, badge: 'soon', disabled: true },
    ...(isScreenwritingEnabled()
      ? [{ title: 'Screenwriting', href: '/app/sw', icon: PenLine }]
      : []),
  ]

  const t2vItems: NavItem[] = t2vEnabled
    ? [
        { title: 'New AI Video', href: '/app/clips/video/new', icon: Video },
        { title: 'Templates', href: '/app/clips/video/templates', icon: LayoutTemplate },
        { title: 'AI Video projects', href: '/app/clips?kind=video', icon: Film },
      ]
    : []

  const sharedItems: NavItem[] = [
    { title: 'Brand kit', href: '/app/clips/brand', icon: Palette },
    {
      title: 'Brand templates',
      href: '/app/clips/brand?tab=templates',
      icon: LayoutTemplate,
    },
    { title: 'Workspaces', href: '/app/clips?view=workspaces', icon: Users },
    { title: 'Learn', href: '/app/help', icon: GraduationCap },
  ]

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" data-testid="app-sidebar">
      <SidebarHeader className="flex flex-col gap-2 px-2 py-3">
        <div className="flex h-9 flex-row items-center gap-2.5 px-1 group-data-[collapsible=icon]:justify-center">
          <LogoMark className="size-7 shrink-0" />
          <p className="min-w-0 text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Transovo <span className="text-brand-gradient">Studio</span>
          </p>
        </div>
        <div className="group-data-[collapsible=icon]:hidden">
          <DriveWorkspaceSwitcher />
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin">
        <div className="px-2 pb-2 group-data-[collapsible=icon]:px-1">
          <SidebarCreateMenu />
        </div>

        <SidebarProductSection section="clips" title="Clips" active={activeSection === 'clips'}>
          <SidebarMenu>
            {clipsItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} searchParams={searchParams} />
            ))}
            <SidebarMenuItem>
              <ClipsProjectsNav />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarProductSection>

        <SidebarProductSection section="editor" title="Editor" active={activeSection === 'editor'}>
          <SidebarMenu>
            {editorItems.map((item) => (
              <NavLink key={item.href + item.title} item={item} pathname={pathname} searchParams={searchParams} />
            ))}
          </SidebarMenu>
        </SidebarProductSection>

        {t2vItems.length > 0 ? (
          <SidebarProductSection section="t2v" title="AI Video" active={activeSection === 't2v'}>
            <SidebarMenu>
              {t2vItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} searchParams={searchParams} />
              ))}
            </SidebarMenu>
          </SidebarProductSection>
        ) : null}

        <SidebarProductSection section="shared" title="Shared" active={activeSection === 'shared'}>
          <SidebarMenu>
            {sharedItems.map((item) => (
              <NavLink key={item.href + item.title} item={item} pathname={pathname} searchParams={searchParams} />
            ))}
          </SidebarMenu>
        </SidebarProductSection>
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
