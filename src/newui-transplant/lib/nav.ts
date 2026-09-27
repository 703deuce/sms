import {
  BarChart3,
  Bot,
  CreditCard,
  Hash,
  Inbox,
  LayoutDashboard,
  PhoneCall,
  PhoneMissed,
  Plug,
  Settings,
  Sparkles,
  Voicemail,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { isVoiceProductCustomerVisible } from '@/lib/products/launch-product-availability'
import { RECEPTIONIST_WIZARD_NAV_ITEMS } from '@/lib/voice/receptionist/wizard-step-url'

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

const FULL_NAV: NavSection[] = [
  {
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
  },
  {
    label: 'Missed Call Text Back',
    items: [
      { label: 'Overview', href: '/mctb', icon: LayoutDashboard },
      { label: 'Missed Calls', href: '/mctb/missed-calls', icon: PhoneMissed, matchPrefix: '/mctb/missed-calls' },
      { label: 'Inbox', href: '/mctb/conversations', icon: Inbox },
      { label: 'AI Recovery', href: '/mctb/ai-recovery', icon: Sparkles },
      { label: 'Voicemail', href: '/mctb/voicemail', icon: Voicemail },
      { label: 'Analytics', href: '/mctb/analytics', icon: BarChart3 },
      { label: 'Setup', href: '/mctb/setup', icon: Wrench, matchPrefix: '/mctb/setup' },
    ],
  },
  {
    label: 'Shared',
    items: [
      { label: 'Integrations', href: '/integrations', icon: Plug, matchPrefix: '/integrations' },
      { label: 'Numbers', href: '/voice/numbers', icon: Hash },
      { label: 'Billing', href: '/settings/billing', icon: CreditCard },
      { label: 'Settings', href: '/settings', icon: Settings, matchPrefix: '/settings/business' },
    ],
  },
]

export const MCTB_SETUP_SECTIONS = [
  { label: 'Overview', href: '/mctb/setup' },
  { label: 'Phone & Forwarding', href: '/mctb/setup/phone' },
  { label: 'Consent', href: '/mctb/setup/consent' },
  { label: 'Text Back', href: '/mctb/setup/text-back' },
  { label: 'Recovery', href: '/mctb/setup/recovery' },
  { label: 'Voicemail', href: '/mctb/setup/voicemail' },
  { label: 'Notifications', href: '/mctb/setup/notifications' },
  { label: 'Exclusions', href: '/mctb/setup/exclusions' },
  { label: 'Links', href: '/mctb/setup/links' },
  { label: 'Test', href: '/mctb/setup/test' },
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

/** Customer-facing sidebar sections (respects launch product visibility). */
export function resolveCustomerNavSections(): NavSection[] {
  if (isVoiceProductCustomerVisible()) return FULL_NAV
  return FULL_NAV.filter((section) => section.label !== 'AI Receptionist')
}

/** @deprecated Use resolveCustomerNavSections() for app chrome. */
export const NAV: NavSection[] = FULL_NAV

export const SETTINGS_TABS = [
  { label: 'Business', href: '/settings/business' },
  { label: 'Team', href: '/settings/team' },
  { label: 'Billing', href: '/settings/billing' },
]
