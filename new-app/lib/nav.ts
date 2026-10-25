import {
  Clapperboard,
  Download,
  HelpCircle,
  Home,
  LifeBuoy,
  Palette,
  Plug,
  Scissors,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react'

export type ProductKey = 'clips'
export type ContextKey = 'clips' | 'workspace'

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  group?: string
  exact?: boolean
  isActive?: (pathname: string) => boolean
}

export type NavContext = {
  key: ContextKey
  title: string
  shortTitle: string
  href: string
  icon: LucideIcon
  items: NavItem[]
}

export const CLIPS: NavContext = {
  key: 'clips',
  title: 'Clips',
  shortTitle: 'Clips',
  href: '/app/clips',
  icon: Scissors,
  items: [
    { title: 'Projects', href: '/app/clips', icon: Clapperboard, exact: true, group: 'Create' },
    { title: 'New project', href: '/app/clips/new', icon: Upload, group: 'Create' },
    { title: 'Brand template', href: '/app/clips/brand', icon: Palette, group: 'Customize' },
    { title: 'Exports', href: '/app/clips/exports', icon: Download, group: 'Library' },
  ],
}

export const PRODUCTS: NavContext[] = [CLIPS]

export const WORKSPACE: NavContext = {
  key: 'workspace',
  title: 'Workspace',
  shortTitle: 'Workspace',
  href: '/app/clips',
  icon: Home,
  items: [
    { title: 'Home', href: '/app/clips', icon: Home, group: 'Workspace' },
    { title: 'Integrations', href: '/app/integrations', icon: Plug, group: 'Manage' },
    { title: 'Settings', href: '/app/settings', icon: Settings, group: 'Manage' },
    { title: 'Help', href: '/app/help', icon: LifeBuoy, group: 'Manage' },
  ],
}

export const ALL_CONTEXTS: NavContext[] = [WORKSPACE, CLIPS]

export function resolveContext(pathname: string): NavContext {
  if (pathname === '/app/clips' || pathname.startsWith('/app/clips/')) {
    return CLIPS
  }
  if (
    pathname === '/app/home' ||
    pathname.startsWith('/app/settings') ||
    pathname.startsWith('/app/integrations') ||
    pathname.startsWith('/app/help')
  ) {
    return WORKSPACE
  }
  return WORKSPACE
}

export function isItemActive(item: NavItem, pathname: string) {
  if (item.isActive) return item.isActive(pathname)
  if (item.href === '/app/clips' && item.exact) {
    return pathname === '/app/clips'
  }
  if (item.href.startsWith('/app/clips/') && item.href.includes('/edit/')) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function groupItems(items: NavItem[]) {
  const groups: { label: string; items: NavItem[] }[] = []
  for (const item of items) {
    const label = item.group ?? ''
    const existing = groups.find((g) => g.label === label)
    if (existing) existing.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export const PRIMARY_DESTINATION_COUNT = ALL_CONTEXTS.reduce((sum, c) => sum + c.items.length, 0)
