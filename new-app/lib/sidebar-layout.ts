import { isClipEditRoute } from '@/lib/sidebar-nav'

/** Viewport at or below this width uses icon rail unless user expands on large screens. */
export const SIDEBAR_AUTO_COLLAPSE_MAX_WIDTH_PX = 1279

export const SIDEBAR_DRAWER_BREAKPOINT_PX = 1024

export const SIDEBAR_OPEN_STORAGE_KEY = 'transovo_sidebar_open'

export function readSidebarOpenFromStorage(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {
    /* ignore */
  }
  return null
}

export function writeSidebarOpenToStorage(open: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, open ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

export function isClipEditorPath(pathname: string) {
  return isClipEditRoute(pathname)
}

export function isClipsProjectsLibraryPath(pathname: string, searchParams?: URLSearchParams) {
  if (pathname === '/app/clips/trash') return true
  if (pathname !== '/app/clips') return false
  const view = searchParams?.get('view')
  if (view === 'recents' || view === 'shared' || view === 'workspaces' || view === 'layouts') return true
  if (searchParams?.get('folder')) return true
  if (searchParams?.get('kind') === 'video') return false
  const v = view ?? 'home'
  return v === 'home' || v === 'all'
}

export function isClipsLibraryPath(pathname: string, searchParams?: URLSearchParams) {
  if (pathname === '/app/clips' || pathname === '/app/clips/trash') return true
  if (pathname.startsWith('/app/clips/brand')) return false
  if (pathname.startsWith('/app/clips/new')) return false
  const view = searchParams?.get('view')
  if (view === 'recents' || view === 'shared' || view === 'workspaces' || view === 'layouts') return true
  if (searchParams?.get('folder')) return true
  return pathname === '/app/clips'
}
