import { routes } from './routes'

export type SidebarNavFlags = {
  recording: boolean
  soloRecording: boolean
  scriptEditor: boolean
  t2v: boolean
}
export type SidebarNavGroup = 'home' | 'products' | 'library' | 'footer'
export type SidebarNavIcon =
  | 'home' | 'clips' | 'streamer' | 'editor' | 'youtubeVideo' | 'record' | 'aiVideo'
  | 'media' | 'brand' | 'templates' | 'exports' | 'learn' | 'settings'
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
    rec ? { id: 'record', label: 'Record', href: rec, icon: 'record', group: 'products' } : null,
    f.t2v ? { id: 'ai-video', label: 'AI Video', href: routes.aiVideoNew(), icon: 'aiVideo', group: 'products' } : null,
    { id: 'media', label: 'Media', href: '/app/clips/media', icon: 'media', group: 'library' },
    { id: 'brand', label: 'Brand kit', href: '/app/clips/brand', icon: 'brand', group: 'library' },
    { id: 'templates', label: 'Templates', href: '/app/clips/templates', icon: 'templates', group: 'library' },
    { id: 'exports', label: 'Exports', href: '/app/exports', icon: 'exports', group: 'library' },
    { id: 'learn', label: 'Learn', href: '/app/help', icon: 'learn', group: 'footer' },
    { id: 'settings', label: 'Settings', href: '/app/settings', icon: 'settings', group: 'footer' },
  ]
  return items.filter((x): x is SidebarNavItem => x !== null)
}

/** Exactly one id (or null) is active for any URL. Order matters. */
export function activeSidebarId(pathname: string, search: URLSearchParams | string = ''): string | null {
  const sp = typeof search === 'string' ? new URLSearchParams(search) : search
  const p = pathname.replace(/\/+$/, '') || '/'
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
  if (p.startsWith('/app/youtube-video')) return 'youtube-video'
  if (p.startsWith('/app/streamer')) return 'streamer'
  if (p.startsWith('/app/record') || p.startsWith('/app/rooms')) return 'record'
  if (
    p.startsWith('/app/video-editor') ||
    p.startsWith('/app/editor') ||
    /^\/app\/clips\/[^/]+\/(edit|studio|script)(\/|$)/.test(p)
  )
    return 'editor'
  if (p === '/app' || p === '/app/home' || p === '/app/dashboard') return 'home'
  if (p === '/app/clips' || p === '/app/clips/trash' || clipsProjectId(p)) return 'clips'
  if (p.startsWith('/app/help') || p.startsWith('/app/learn')) return 'learn'
  if (p.startsWith('/app/settings')) return 'settings'
  return null
}

export function isClipEditRoute(pathname: string): boolean {
  return /^\/app\/(clips|video-editor)\/[^/]+\/edit\/[^/]+/.test(pathname)
}
