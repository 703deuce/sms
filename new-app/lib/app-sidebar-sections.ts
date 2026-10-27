export type SidebarProductSection = 'clips' | 'editor' | 't2v' | 'shared'

export const SIDEBAR_SECTIONS_STORAGE_KEY = 'transovo_sidebar_sections_v1'

export function resolveActiveSidebarSection(
  pathname: string,
  searchParams?: URLSearchParams,
): SidebarProductSection {
  if (pathname.startsWith('/app/clips/brand')) return 'shared'
  if (pathname === '/app/help' || pathname.startsWith('/app/help/')) return 'shared'
  if (pathname === '/app/clips' && searchParams?.get('view') === 'workspaces') return 'shared'

  if (pathname.startsWith('/app/clips/video/')) return 't2v'
  if (/^\/app\/clips\/[^/]+\/video(?:\/|$)/.test(pathname)) return 't2v'
  if (pathname === '/app/clips' && searchParams?.get('kind') === 'video') return 't2v'

  if (pathname === '/app/editor' || pathname.startsWith('/app/editor/')) return 'editor'
  if (pathname.includes('/script')) return 'editor'
  if (pathname.startsWith('/app/rooms')) return 'editor'
  if (pathname === '/app/voice' || pathname.startsWith('/app/voice/')) return 'editor'
  if (pathname.startsWith('/app/sw')) return 'editor'
  if (pathname.includes('/clips/media')) return 'editor'
  if (pathname === '/app/clips' && searchParams?.get('view') === 'layouts') return 'editor'

  if (pathname.startsWith('/app/streamer')) return 'clips'
  if (pathname === '/app/exports' || pathname.startsWith('/app/clips/exports')) return 'clips'
  if (pathname.includes('/edit/')) return 'clips'
  if (pathname === '/app/clips/new' || pathname === '/app/clips' || pathname.startsWith('/app/clips/')) {
    return 'clips'
  }

  return 'clips'
}

export function readSidebarSectionsState(): Partial<Record<SidebarProductSection, boolean>> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<Record<SidebarProductSection, boolean>>
  } catch {
    return {}
  }
}

export function writeSidebarSectionState(section: SidebarProductSection, open: boolean) {
  try {
    const prev = readSidebarSectionsState()
    window.localStorage.setItem(
      SIDEBAR_SECTIONS_STORAGE_KEY,
      JSON.stringify({ ...prev, [section]: open }),
    )
  } catch {
    /* ignore */
  }
}

export const PROJECTS_SUBSECTION_STORAGE_KEY = 'transovo_sidebar_projects_open'

export function readProjectsSubsectionOpen(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROJECTS_SUBSECTION_STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {
    /* ignore */
  }
  return null
}

export function writeProjectsSubsectionOpen(open: boolean) {
  try {
    window.localStorage.setItem(PROJECTS_SUBSECTION_STORAGE_KEY, open ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}
