import { routes } from './routes'

export type SidebarNavFlags = {
  recording: boolean
  soloRecording: boolean
  scriptEditor: boolean
  t2v: boolean
}
export type SidebarNavGroup = 'home' | 'products' | 'library' | 'footer' | 'agent' | 'agentSetup'
export type SidebarNavIcon =
  | 'home' | 'clips' | 'streamer' | 'editor' | 'youtubeVideo' | 'captions' | 'record' | 'aiVideo'
  | 'studio' | 'motionStudio' | 'media' | 'brand' | 'templates' | 'exports' | 'learn' | 'settings' | 'agentLab'
  | 'agentChat' | 'agentNeeds' | 'agentResponsibilities' | 'agentActivity' | 'agentCalendar' | 'agentCalls'
  | 'agentAssignments' | 'agentPermissions' | 'agentConnections' | 'agentComputer' | 'agentFiles' | 'agentHome' | 'agentMemory'
export type SidebarNavItem = { id: string; label: string; href: string; icon: SidebarNavIcon; group: SidebarNavGroup }
export type CreateMenuItem = { id: string; label: string; href: string; icon: SidebarNavIcon }

/** Segments under /app/clips/ that are NOT project ids. */
export const RESERVED_CLIPS_SEGMENTS = new Set([
  'new', 'brand', 'templates', 'media', 'exports', 'trash', 'video', 'folders', 'p',
])

export const SIDEBAR_HIDDEN_HREFS = [
  '/app/sw',
  '/app/voice',
  '/app/rooms',
  '/app/clips/exports',
  '/app/clips?view=workspaces',
  '/app/clips/templates?tab=layouts&sub=mine',
  '/app/clips/templates?tab=ai-video',
  '/app/clips/brand?tab=templates',
] as const

export function clipsProjectId(pathname: string): string | null {
  const m = /^\/app\/clips\/([^/?#]+)/.exec(pathname)
  if (!m) return null
  return RESERVED_CLIPS_SEGMENTS.has(m[1]) ? null : m[1]
}

export function recordHref(f: SidebarNavFlags): string | null {
  if (f.soloRecording) return '/app/record'
  if (f.recording) return '/app/rooms/new'
  return null
}

export function createMenuItems(f: SidebarNavFlags): CreateMenuItem[] {
  const rec = recordHref(f)
  return [
    { id: 'create-clip', label: 'Clip', href: '/app/clips/new', icon: 'clips' },
    { id: 'create-stream', label: 'Stream clip', href: '/app/streamer', icon: 'streamer' },
    { id: 'create-editor', label: 'Editor project', href: f.scriptEditor ? routes.videoEditor() : routes.videoEditorNew(), icon: 'editor' },
    { id: 'create-youtube-video', label: 'YouTube Video', href: routes.youtubeVideo(), icon: 'youtubeVideo' },
    ...(rec ? [{ id: 'create-record', label: 'Recording', href: rec, icon: 'record' as const }] : []),
    ...(f.t2v ? [{ id: 'create-ai-video', label: 'AI Video', href: routes.aiVideoNew(), icon: 'aiVideo' as const }] : []),
    { id: 'create-studio', label: 'AI Studio', href: '/app/studio', icon: 'studio' as const },
    { id: 'create-motion-studio', label: 'Motion Studio', href: '/app/motion-studio/new?type=documentary', icon: 'motionStudio' as const },
  ]
}

export function buildSidebarNav(f: SidebarNavFlags): SidebarNavItem[] {
  const rec = recordHref(f)
  const items: (SidebarNavItem | null)[] = [
    { id: 'home', label: 'Home', href: routes.app(), icon: 'home', group: 'home' },
    { id: 'clips', label: 'Clips', href: '/app/clips/new', icon: 'clips', group: 'products' },
    { id: 'streamer', label: 'Streamer', href: '/app/streamer', icon: 'streamer', group: 'products' },
    { id: 'editor', label: 'Editor', href: routes.videoEditor(), icon: 'editor', group: 'products' },
    { id: 'youtube-video', label: 'YouTube Video', href: routes.youtubeVideo(), icon: 'youtubeVideo', group: 'products' },
    { id: 'captions', label: 'AI Captions', href: '/app/captions', icon: 'captions', group: 'products' },
    rec ? { id: 'record', label: 'Record', href: rec, icon: 'record', group: 'products' } : null,
    f.t2v ? { id: 'ai-video', label: 'AI Video', href: routes.aiVideoNew(), icon: 'aiVideo', group: 'products' } : null,
    { id: 'studio', label: 'Studio', href: '/app/studio', icon: 'studio', group: 'products' },
    { id: 'ad-studio', label: 'Ad Studio', href: '/app/ad-studio', icon: 'studio', group: 'products' },
    { id: 'motion-studio', label: 'Motion Studio', href: '/app/motion-studio', icon: 'motionStudio', group: 'products' },
    { id: 'agent-lab', label: 'Agent Lab', href: '/app/agent-lab', icon: 'agentLab', group: 'products' },
    { id: 'media', label: 'Media', href: '/app/clips/media', icon: 'media', group: 'library' },
    { id: 'brand', label: 'Brand kit', href: '/app/clips/brand', icon: 'brand', group: 'library' },
    { id: 'templates', label: 'Templates', href: '/app/clips/templates', icon: 'templates', group: 'library' },
    { id: 'exports', label: 'Exports', href: '/app/exports', icon: 'exports', group: 'library' },
    { id: 'learn', label: 'Learn', href: '/app/help', icon: 'learn', group: 'footer' },
    { id: 'settings', label: 'Settings', href: '/app/settings', icon: 'settings', group: 'footer' },
  ]
  return items.filter((x): x is SidebarNavItem => x !== null)
}

/**
 * Video-editing products are hidden from the menu while Agent Lab is the product. Their pages are not deleted and
 * still open by URL; flip this to false to bring the items (and the Create menu and clip projects) back.
 */
export const VIDEO_NAV_HIDDEN = true

const VIDEO_NAV_IDS = new Set([
  'home', 'clips', 'streamer', 'editor', 'youtube-video', 'captions', 'record', 'ai-video', 'studio', 'ad-studio',
  'motion-studio', 'media', 'brand', 'templates', 'exports',
])

/** Agent Lab pages, all on the main menu: the work pages, a divider, then setup pages. */
export const AGENT_NAV: SidebarNavItem[] = [
  { id: 'agent-home', label: 'Dashboard', href: '/app', icon: 'agentHome', group: 'agent' },
  { id: 'agent-chat', label: 'Chat', href: '/app/agent-lab', icon: 'agentChat', group: 'agent' },
  { id: 'agent-needs-you', label: 'Needs you', href: '/app/agent-lab/needs-you', icon: 'agentNeeds', group: 'agent' },
  { id: 'agent-responsibilities', label: 'Responsibilities', href: '/app/agent-lab/responsibilities', icon: 'agentResponsibilities', group: 'agent' },
  { id: 'agent-activity', label: 'Activity', href: '/app/agent-lab/activity', icon: 'agentActivity', group: 'agent' },
  { id: 'agent-calendar', label: 'Calendar', href: '/app/agent-lab/calendar', icon: 'agentCalendar', group: 'agent' },
  { id: 'agent-calls', label: 'Calls', href: '/app/agent-lab/calls', icon: 'agentCalls', group: 'agent' },
  { id: 'agent-assignments', label: 'Assignments', href: '/app/agent-lab/assignments', icon: 'agentAssignments', group: 'agent' },
  { id: 'agent-permissions', label: 'Permissions', href: '/app/agent-lab/permissions', icon: 'agentPermissions', group: 'agentSetup' },
  { id: 'agent-connections', label: 'Connections', href: '/app/agent-lab/connections', icon: 'agentConnections', group: 'agentSetup' },
  { id: 'agent-computer', label: 'Computer', href: '/app/agent-lab/computer', icon: 'agentComputer', group: 'agentSetup' },
  { id: 'agent-files', label: 'Files', href: '/app/agent-lab/files', icon: 'agentFiles', group: 'agentSetup' },
  { id: 'agent-memory', label: 'Memory & skills', href: '/app/agent-lab/memory', icon: 'agentMemory', group: 'agentSetup' },
]

/** The menu as shown: Agent Lab pages first, then whatever products are not hidden, then the footer. */
export function visibleSidebarNav(f: SidebarNavFlags): SidebarNavItem[] {
  const base = buildSidebarNav(f).filter((i) => i.id !== 'agent-lab' && !(VIDEO_NAV_HIDDEN && VIDEO_NAV_IDS.has(i.id)))
  return [...AGENT_NAV, ...base]
}

/** Which Agent Lab menu item is active for a path (null outside Agent Lab). */
export function activeAgentNavId(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/app' || p === '/app/home' || p === '/app/dashboard') return 'agent-home'
  if (p === '/app/agent-lab') return 'agent-chat'
  const hit = AGENT_NAV.find((i) => i.href !== '/app/agent-lab' && i.href !== '/app' && (p === i.href || p.startsWith(`${i.href}/`)))
  return hit?.id ?? null
}

/** Exactly one id (or null) is active for any URL. Order matters. */
export function activeSidebarId(pathname: string, search: URLSearchParams | string = ''): string | null {
  const sp = typeof search === 'string' ? new URLSearchParams(search) : search
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/app/ad-studio' || p.startsWith('/app/ad-studio/')) return 'ad-studio'
  if (p === '/app/motion-studio' || p.startsWith('/app/motion-studio/')) return 'motion-studio'
  if (p === '/app/agent-lab' || p.startsWith('/app/agent-lab/')) return 'agent-lab'
  if (p === '/app/studio' || p.startsWith('/app/studio/')) return 'studio'
  if (p === '/app/youtube-video' || p.startsWith('/app/youtube-video/')) return 'youtube-video'
  if (p === '/app/captions' || p.startsWith('/app/captions/')) return 'captions'
  if (p === '/app/clips/new') return 'clips'
  if (p.startsWith('/app/clips/video/templates') || p.startsWith('/app/ai-video/templates')) return 'templates'
  if (p.startsWith('/app/clips/templates')) return 'templates' // every ?tab= / &sub=
  if (p.startsWith('/app/clips/brand')) return 'brand' // kit and ?tab=templates and ?id=
  if (p.startsWith('/app/clips/media')) return 'media'
  if (p === '/app/exports' || p.startsWith('/app/exports/') || p.startsWith('/app/clips/exports')) return 'exports'
  if (
    p.startsWith('/app/ai-video') ||
    p.startsWith('/app/clips/video/') ||
    /^\/app\/clips\/[^/]+\/video(\/|$)/.test(p)
  )
    return 'ai-video'
  if (p === '/app/clips' && sp.get('kind') === 'video') return 'ai-video'
  if (p.startsWith('/app/streamer')) return 'streamer'
  if (p.startsWith('/app/record') || p.startsWith('/app/rooms')) return 'record'
  if (
    p.startsWith('/app/video-editor') ||
    p.startsWith('/app/editor') ||
    /^\/app\/clips\/[^/]+\/(edit|studio|script|story|templates|generate|chat)(\/|$)/.test(p)
  )
    return 'editor'
  if (p === '/app' || p === '/app/home' || p === '/app/dashboard') return 'home'
  if (p === '/app/clips' || p === '/app/clips/trash' || clipsProjectId(p)) return 'clips'
  if (p.startsWith('/app/help') || p.startsWith('/app/learn')) return 'learn'
  if (p.startsWith('/app/settings')) return 'settings'
  return null
}

export function isClipEditRoute(pathname: string): boolean {
  return /^\/app\/(clips|video-editor)\/[^/]+\/(edit|story|templates|generate|chat)\/[^/]+(?:\/|$)/.test(pathname)
}

/** The Chat page itself (not Needs you, Responsibilities, …): fill the area beside the side menu. */
export function isAgentChatRoute(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === '/app/agent-lab'
}
