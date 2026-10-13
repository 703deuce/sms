import {
  BarChart3,
  Bot,
  LayoutDashboard,
  PhoneCall,
  type LucideIcon,
} from 'lucide-react'
import { isVoiceProductCustomerVisible } from '@/lib/products/launch-product-availability'
import { RECEPTIONIST_WIZARD_NAV_ITEMS } from '@/lib/voice/receptionist/wizard-step-url'
import { buildSchedulingOpusSidebarNav } from '@/lib/products/scheduling-opus-nav'
import { buildMctbV1Nav } from '@/lib/products/mctb-nav'
import { flattenNavLinks, type NavItem as ProductNavItem } from '@/lib/nav'
import { MCTB_ROUTES } from '@/lib/mctb/routes'
import type { ProductShell } from '@/lib/products/product-shell'

export type NavSubItem = {
  label: string
  href: string
}

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  matchPrefix?: string
  /** Direct submenu entries (no extra nav tier). */
  children?: NavSubItem[]
}

/** Operational routes preserved — not primary receptionist config nav. */
export const VOICE_RECEPTIONIST_OPERATIONAL_ROUTES = {
  businessKnowledge: '/voice/knowledge',
  callHandlingOps: '/voice/call-handling',
} as const

export const RECEPTIONIST_SIDEBAR_CHILDREN: NavSubItem[] = RECEPTIONIST_WIZARD_NAV_ITEMS.map(
  (s) => ({
    label: s.label,
    href: s.href,
  }),
)

export type NavSection = { label: string; items: NavItem[] }

const AI_RECEPTIONIST_SECTION: NavSection = {
  label: 'AI Receptionist',
  items: [
    { label: 'Overview', href: '/voice/overview', icon: LayoutDashboard },
    { label: 'Calls', href: '/voice/calls', icon: PhoneCall, matchPrefix: '/voice/calls' },
    {
      label: 'Receptionist',
      href: '/voice/receptionist',
      icon: Bot,
      matchPrefix: '/voice/receptionist',
      children: RECEPTIONIST_SIDEBAR_CHILDREN,
    },
    { label: 'Analytics', href: '/voice/analytics', icon: BarChart3 },
  ],
}

function productNavItemToOpus(item: ProductNavItem): NavItem {
  const opus: NavItem = {
    label: item.label,
    href: item.href,
    icon: item.icon as LucideIcon,
  }
  if (item.badge !== undefined) opus.badge = String(item.badge)
  if (!item.matchExact) {
    opus.matchPrefix = item.href
  }
  if (item.children?.length) {
    opus.children = flattenNavLinks(item.children).map((link) => ({
      label: link.label,
      href: link.href,
    }))
  }
  return opus
}

function flatNavToSections(flat: ProductNavItem[]): NavSection[] {
  const sections: NavSection[] = []
  let bucket: NavItem[] = []
  let bucketLabel = 'Overview'

  const flush = () => {
    if (bucket.length > 0) sections.push({ label: bucketLabel, items: bucket })
    bucket = []
  }

  for (const item of flat) {
    if (item.sectionLabel) {
      flush()
      bucketLabel = item.sectionLabel
    }
    bucket.push(productNavItemToOpus(item))
  }
  flush()
  return sections
}

export function appointmentRemindersNavSections(inboxBadge = 0): NavSection[] {
  const flat = buildSchedulingOpusSidebarNav({ conversationsBadge: inboxBadge })
  return flatNavToSections(flat)
}

/** Launch MCTB IA — single source with `buildMctbV1Nav` (desktop legacy + Opus mobile drawer). */
export function mctbLaunchNavSections(inboxBadge = 0): NavSection[] {
  const flat = buildMctbV1Nav({ inboxBadge })
  const sections: NavSection[] = []
  let bucket: NavItem[] = []
  let bucketLabel = 'Overview'

  const flush = () => {
    if (bucket.length > 0) sections.push({ label: bucketLabel, items: bucket })
    bucket = []
  }

  for (const item of flat) {
    if (item.sectionLabel) {
      flush()
      bucketLabel = item.sectionLabel
    }
    bucket.push(productNavItemToOpus(item))
  }
  flush()
  return sections
}

/** Legacy setup workspace tabs — canonical launch routes (old `/mctb/setup/*` still redirect). */
export const MCTB_SETUP_SECTIONS = [
  { label: 'Missed-Call Recovery', href: MCTB_ROUTES.missedCallRecovery },
  { label: 'Text Back', href: MCTB_ROUTES.textBack },
  { label: 'AI Recovery', href: MCTB_ROUTES.aiRecovery },
  { label: 'Notifications', href: MCTB_ROUTES.notifications },
  { label: 'Phone & Forwarding', href: MCTB_ROUTES.phone },
]

export const INTEGRATION_TABS = [
  { label: 'Directory', href: '/integrations' },
  { label: 'Calendars', href: '/integrations/calendars' },
  { label: 'Payments', href: '/integrations/payments' },
  { label: 'Connect apps', href: '/integrations/native' },
  { label: 'CRM', href: '/integrations/crm' },
  { label: 'API', href: '/integrations/api' },
  { label: 'Webhooks', href: '/integrations/webhooks' },
  { label: 'Developer logs', href: '/integrations/logs' },
]

/** Customer-facing sidebar sections for the active product shell. */
export function resolveCustomerNavSections(
  productShell: ProductShell = 'mctb',
  inboxBadge = 0,
): NavSection[] {
  if (productShell === 'appointment_reminders' || productShell === 'appointments') {
    return appointmentRemindersNavSections(inboxBadge)
  }
  const mctb = mctbLaunchNavSections(inboxBadge)
  if (productShell === 'ai_after_hours' && isVoiceProductCustomerVisible()) {
    return [AI_RECEPTIONIST_SECTION, ...mctb]
  }
  if (isVoiceProductCustomerVisible() && productShell === 'mctb') {
    return [AI_RECEPTIONIST_SECTION, ...mctb]
  }
  return mctb
}

/** @deprecated Use resolveCustomerNavSections() for app chrome. */
export const NAV: NavSection[] = resolveCustomerNavSections()

export const SETTINGS_TABS = [
  { label: 'Business', href: '/settings/business' },
  { label: 'Team', href: '/settings/team' },
  { label: 'Billing', href: '/settings/billing' },
]
