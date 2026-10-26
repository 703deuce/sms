import {
  AudioLines,
  Clapperboard,
  Download,
  HelpCircle,
  Home,
  LayoutTemplate,
  LifeBuoy,
  Palette,
  Plug,
  Plus,
  PenLine,
  Radio,
  Scissors,
  Settings,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { isScreenwritingEnabled } from '@/lib/features/screenwriting'

export type ProductKey = 'clips'
export type ContextKey = 'clips' | 'workspace'

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  group?: string
  exact?: boolean
  badge?: 'soon' | 'new'
  disabled?: boolean
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

export const GROUP_ORDER = ['Create', 'Library', 'Brand', 'Exports'] as const

const CLIPS_ITEMS: NavItem[] = [
    { title: 'New project', href: '/app/clips/new', icon: Plus, group: 'Create' },
    { title: 'Streamer', href: '/app/streamer', icon: Radio, group: 'Create' },
    { title: 'Screenwriting', href: '/app/sw', icon: PenLine, group: 'Create' },
    {
      title: 'Record',
      href: '/app/record',
      icon: Video,
      group: 'Create',
      badge: 'soon',
      disabled: true,
    },
    { title: 'Projects', href: '/app/clips', icon: Clapperboard, group: 'Library', exact: true },
    {
      title: 'Editor',
      href: '/app/editor',
      icon: Scissors,
      group: 'Library',
      badge: 'soon',
      disabled: true,
    },
    {
      title: 'Voice',
      href: '/app/voice',
      icon: AudioLines,
      group: 'Library',
      badge: 'soon',
      disabled: true,
    },
    { title: 'Brand kit', href: '/app/clips/brand', icon: Palette, group: 'Brand' },
    {
      title: 'Templates',
      href: '/app/clips/brand?tab=templates',
      icon: LayoutTemplate,
      group: 'Brand',
    },
    { title: 'Exports', href: '/app/exports', icon: Download, group: 'Exports' },
]

export function clipsNavItems(): NavItem[] {
  if (isScreenwritingEnabled()) return CLIPS_ITEMS
  return CLIPS_ITEMS.filter((i) => i.href !== '/app/sw')
}

export const CLIPS: NavContext = {
  key: 'clips',
  title: 'Clips',
  shortTitle: 'Clips',
  href: '/app/clips',
  icon: Scissors,
  items: clipsNavItems(),
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
    { title: 'Help', href: '/app/help', icon: HelpCircle, group: 'Manage' },
  ],
}

export const ALL_CONTEXTS: NavContext[] = [WORKSPACE, CLIPS]

export function resolveContext(pathname: string): NavContext {
  if (
    pathname === '/app/clips' ||
    pathname.startsWith('/app/clips/') ||
    pathname === '/app/exports' ||
    pathname.startsWith('/app/streamer') ||
    pathname.startsWith('/app/sw')
  ) {
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

export function isItemActive(item: NavItem, pathname: string, searchParams?: URLSearchParams) {
  if (item.isActive) {
    if (item.href.includes('?tab=templates') && searchParams) {
      return pathname === '/app/clips/brand' && searchParams.get('tab') === 'templates'
    }
    return item.isActive(pathname)
  }
  if (item.href === '/app/clips' && item.exact) {
    return pathname === '/app/clips'
  }
  if (item.href.startsWith('/app/clips/') && item.href.includes('/edit/')) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }
  if (item.href.includes('?')) {
    const base = item.href.split('?')[0]
    if (pathname !== base) return false
    if (item.href.includes('tab=templates')) {
      return searchParams?.get('tab') === 'templates'
    }
    return pathname === base
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

export function sortGroups(groups: { label: string; items: NavItem[] }[]) {
  return [...groups].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.label as (typeof GROUP_ORDER)[number])
    const bi = GROUP_ORDER.indexOf(b.label as (typeof GROUP_ORDER)[number])
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export const PRIMARY_DESTINATION_COUNT = ALL_CONTEXTS.reduce((sum, c) => sum + c.items.length, 0)
