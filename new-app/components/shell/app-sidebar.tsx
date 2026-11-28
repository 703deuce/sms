'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Activity,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Captions,
  Clapperboard,
  Film as MotionStudioIcon,
  Download,
  Film,
  FlaskConical,
  GraduationCap,
  Folder,
  House,
  Images,
  Inbox,
  LayoutTemplate,
  ListChecks,
  MessageSquare,
  LayoutDashboard,
  Monitor,
  Palette,
  Phone,
  Plug,
  Radio,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Video,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { LogoMark } from '@/components/brand/logo-mark'
import { DriveWorkspaceSwitcher } from '@/components/drive/drive-workspace-switcher'
import { ClipsProjectsNav } from '@/components/shell/clips-projects-nav'
import { SidebarCreateMenu } from '@/components/shell/sidebar-create-menu'
import { useClipsWorkspace } from '@/components/providers/clips-workspace-provider'
import { isScriptEditorEnabled } from '@/lib/features/script-editor'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { useRecordingEnabled, useSoloRecordingEnabled } from '@/lib/recording/use-recording-enabled'
import {
  VIDEO_NAV_HIDDEN,
  activeAgentNavId,
  activeSidebarId,
  createMenuItems,
  visibleSidebarNav,
  type SidebarNavGroup,
  type SidebarNavIcon,
  type SidebarNavItem,
} from '@/lib/sidebar-nav'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'

const HEAVY_NAV_HREF_NO_PREFETCH = new Set([
  '/app/streamer',
  '/app/exports',
  '/app/record',
  '/app/video-editor',
  '/app/rooms',
  '/app/rooms/new',
])

const ICONS: Record<SidebarNavIcon, LucideIcon> = {
  home: House,
  clips: Scissors,
  streamer: Radio,
  editor: Clapperboard,
  youtubeVideo: Film,
  record: Video,
  aiVideo: Sparkles,
  studio: WandSparkles,
  motionStudio: MotionStudioIcon,
  captions: Captions,
  media: Images,
  brand: Palette,
  templates: LayoutTemplate,
  exports: Download,
  learn: GraduationCap,
  settings: Settings,
  agentLab: Bot,
  agentChat: MessageSquare,
  agentNeeds: Inbox,
  agentResponsibilities: ListChecks,
  agentActivity: Activity,
  agentCalendar: CalendarDays,
  agentCalls: Phone,
  agentAssignments: BriefcaseBusiness,
  agentPermissions: ShieldCheck,
  agentConnections: Plug,
  agentComputer: Monitor,
  agentFiles: Folder,
  agentHome: LayoutDashboard,
}

const navButtonClass =
  'relative h-9 gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:inset-y-2 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary [&>span:last-child]:whitespace-nowrap [&>span:last-child]:overflow-visible'

function NavItemRow({ item, active }: { item: SidebarNavItem; active: boolean }) {
  const Icon = ICONS[item.icon]
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={item.id === 'ad-studio' ? undefined : item.label}
        isActive={active}
        aria-current={active ? 'page' : undefined}
        data-nav-id={item.id}
        className={navButtonClass}
        render={
          <Link
            href={item.href}
            title={item.label}
            prefetch={HEAVY_NAV_HREF_NO_PREFETCH.has(item.href) ? false : undefined}
            onClick={item.id === 'ad-studio' ? () => console.info('[nav:ad-studio] navigate', { href: item.href }) : undefined}
          />
        }
      >
        <Icon className="size-5" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar({
  recordingNavEnabled = false,
  t2vNavEnabled = false,
  collapsible = 'icon',
}: {
  recordingNavEnabled?: boolean
  t2vNavEnabled?: boolean
  /** TIMELINE_LAYOUT5: 'offcanvas' on the clip editor = no icon column; the editor's menu button slides it in. */
  collapsible?: 'icon' | 'offcanvas'
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { testMode } = useClipsWorkspace()
  const recordingEnabledClient = useRecordingEnabled()
  const soloRecordingEnabled = useSoloRecordingEnabled()
  const recordingEnabled = recordingNavEnabled || recordingEnabledClient
  const t2vEnabled = t2vNavEnabled || isT2vFeatureEnabled()
  const scriptEditorEnabled = isScriptEditorEnabled()

  useEffect(() => {
    console.info('[nav:ai-video-flag]', { enabled: t2vEnabled })
  }, [t2vEnabled])

  useEffect(() => {
    console.info('[editor:flag]', { enabled: scriptEditorEnabled })
  }, [scriptEditorEnabled])

  const flags = {
    recording: recordingEnabled,
    soloRecording: soloRecordingEnabled,
    scriptEditor: scriptEditorEnabled,
    t2v: t2vEnabled,
  }
  const items = visibleSidebarNav(flags)
  const activeId = activeSidebarId(pathname ?? '', searchParams)
  const activeAgentId = activeAgentNavId(pathname ?? '')
  const group = (g: SidebarNavGroup) => items.filter((i) => i.group === g)

  return (
    <Sidebar collapsible={collapsible} className="border-r border-sidebar-border" data-testid="app-sidebar" data-collapsible-mode={collapsible}>
      <SidebarHeader className="gap-2 p-2">
        <div data-nav-id="workspace-switcher" className="flex items-center gap-2">
          <LogoMark className="size-7 shrink-0" />
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <DriveWorkspaceSwitcher />
          </div>
        </div>
        {!VIDEO_NAV_HIDDEN && <SidebarCreateMenu items={createMenuItems(flags)} />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup data-nav-group="agent">
          <SidebarGroupLabel>Agent</SidebarGroupLabel>
          <SidebarMenu>
            {group('agent').map((i) => (
              <NavItemRow key={i.id} item={i} active={activeAgentId === i.id} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator className="mx-3 w-auto" />
        <SidebarGroup data-nav-group="agentSetup">
          <SidebarMenu>
            {group('agentSetup').map((i) => (
              <NavItemRow key={i.id} item={i} active={activeAgentId === i.id} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {!VIDEO_NAV_HIDDEN && (
          <SidebarGroup data-nav-group="home">
            <SidebarMenu>
              <ClipsProjectsNav active={activeId === 'home'} />
            </SidebarMenu>
          </SidebarGroup>
        )}
        {group('products').length > 0 && (
          <SidebarGroup data-nav-group="products">
            <SidebarMenu>
              {group('products').map((i) => (
                <NavItemRow key={i.id} item={i} active={activeId === i.id} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
        {group('library').length > 0 && (
          <SidebarGroup data-nav-group="library">
            <SidebarGroupLabel>Library</SidebarGroupLabel>
            <SidebarMenu>
              {group('library').map((i) => (
                <NavItemRow key={i.id} item={i} active={activeId === i.id} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu data-nav-group="footer">
          {group('footer').map((i) => (
            <NavItemRow key={i.id} item={i} active={activeId === i.id} />
          ))}
        </SidebarMenu>
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
