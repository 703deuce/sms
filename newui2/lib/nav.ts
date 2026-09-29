import {
  Activity,
  BarChart3,
  BookOpen,
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
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  exact?: boolean
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    title: 'AI Receptionist',
    items: [
      { label: 'Overview', href: '/voice/overview', icon: LayoutDashboard },
      { label: 'Calls', href: '/voice/calls', icon: PhoneCall, badge: '3' },
      { label: 'Receptionist', href: '/voice/receptionist', icon: Bot },
      { label: 'Business Knowledge', href: '/voice/knowledge', icon: BookOpen },
      { label: 'Call Handling', href: '/voice/call-handling', icon: Workflow },
      { label: 'Analytics', href: '/voice/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Missed Call Text Back',
    items: [
      { label: 'Overview', href: '/mctb', icon: Activity, exact: true },
      { label: 'Missed Calls', href: '/mctb/missed-calls', icon: PhoneMissed },
      { label: 'Inbox', href: '/mctb/conversations', icon: Inbox, badge: '4' },
      { label: 'AI Recovery', href: '/mctb/ai-recovery', icon: Sparkles },
      { label: 'Voicemail', href: '/mctb/voicemail', icon: Voicemail },
      { label: 'Analytics', href: '/mctb/analytics', icon: BarChart3 },
      { label: 'Setup', href: '/mctb/setup', icon: Wrench },
    ],
  },
  {
    title: 'Shared',
    items: [
      { label: 'Integrations', href: '/integrations', icon: Plug },
      { label: 'Numbers', href: '/voice/numbers', icon: Hash },
      { label: 'Billing', href: '/settings/billing', icon: CreditCard },
      { label: 'Settings', href: '/settings/business', icon: Settings },
    ],
  },
]

export const setupSections = [
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

export const settingsSections = [
  { label: 'Business', href: '/settings/business' },
  { label: 'Team', href: '/settings/users' },
  { label: 'Messaging', href: '/settings/messaging' },
  { label: 'Calendar', href: '/settings/calendar' },
  { label: 'Meetings', href: '/settings/ai-notetaker' },
  { label: 'Security', href: '/settings/security' },
  { label: 'Billing', href: '/settings/billing' },
]

export const integrationSections = [
  { label: 'Directory', href: '/integrations' },
  { label: 'Calendars', href: '/integrations?tab=calendars' },
  { label: 'Payments', href: '/integrations?tab=payments' },
  { label: 'Connect apps', href: '/integrations?tab=native' },
  { label: 'CRM', href: '/integrations?tab=crm' },
  { label: 'API', href: '/integrations?tab=api' },
  { label: 'Webhooks', href: '/integrations?tab=webhooks' },
  { label: 'Developer logs', href: '/integrations?tab=logs' },
]

export const mobileNav = [
  { label: 'Home', href: '/mctb', icon: Activity, exact: true },
  { label: 'Missed', href: '/mctb/missed-calls', icon: PhoneMissed },
  { label: 'Inbox', href: '/mctb/conversations', icon: Inbox },
  { label: 'Calls', href: '/voice/calls', icon: PhoneCall },
  { label: 'Setup', href: '/mctb/setup', icon: Wrench },
]
