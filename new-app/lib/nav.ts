import {
  BarChart3,
  Bot,
  BookOpen,
  Contact,
  Grid3x3,
  Home,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MessageSquare,
  MessageSquareReply,
  MessagesSquare,
  Phone,
  PhoneCall,
  PhoneMissed,
  Plug,
  Route,
  Settings,
  Settings2,
  SlidersHorizontal,
  Signpost,
  CalendarClock,
  ClipboardList,
  Hash,
  Clock3,
  ListTree,
  PhoneForwarded,
  Voicemail,
  type LucideIcon,
} from 'lucide-react'
import {
  AI_RECEPTIONIST_PRODUCT_TITLE,
  type RuntimeProfile,
  RUNTIME_PROFILE_FULL_RECEPTIONIST,
} from '@/lib/receptionist/runtime-profile'
import { MCTB_UI_ENABLED } from '@/lib/products/mctb-ui'

export type ProductKey = 'phone' | 'receptionist' | 'mctb'
export type ContextKey = ProductKey | 'workspace'

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  group?: string
  /** Match nested child routes so detail pages keep their parent active. */
  exact?: boolean
}

export type NavContext = {
  key: ContextKey
  title: string
  shortTitle: string
  href: string
  icon: LucideIcon
  items: NavItem[]
}

export function receptionistNavItems(profile: RuntimeProfile): NavItem[] {
  const intake: NavItem = {
    title:
      profile === RUNTIME_PROFILE_FULL_RECEPTIONIST ? 'Caller Intake' : 'Message Taking',
    href: '/app/receptionist/message-taking',
    icon: profile === RUNTIME_PROFILE_FULL_RECEPTIONIST ? ClipboardList : MessageSquare,
    group: 'Configure',
  }
  const base: NavItem[] = [
    { title: 'Overview', href: '/app/receptionist', icon: LayoutDashboard, exact: true, group: 'Workspace' },
    { title: 'Business Knowledge', href: '/app/receptionist/knowledge', icon: BookOpen, group: 'Configure' },
    { title: 'Call Routing', href: '/app/receptionist/call-routing', icon: Route, group: 'Configure' },
    intake,
    { title: 'Calls', href: '/app/receptionist/calls', icon: PhoneCall, group: 'Activity' },
  ]
  const agentSettings: NavItem = {
    title: 'Agent Settings',
    href: '/app/receptionist/agent',
    icon: SlidersHorizontal,
    group: 'Configure',
  }

  if (profile === RUNTIME_PROFILE_FULL_RECEPTIONIST) {
    return [
      base[0],
      base[1],
      base[2],
      base[3],
      {
        title: 'Appointments',
        href: '/app/receptionist/appointments',
        icon: CalendarClock,
        group: 'Configure',
      },
      agentSettings,
      base[4],
    ]
  }
  return [base[0], agentSettings, base[1], base[2], base[3], base[4]]
}

export function receptionistProductContext(profile: RuntimeProfile): NavContext {
  return {
    key: 'receptionist',
    title: AI_RECEPTIONIST_PRODUCT_TITLE,
    shortTitle: 'AI Receptionist',
    href: '/app/receptionist',
    icon: Bot,
    items: receptionistNavItems(profile),
  }
}

export const PRODUCTS: NavContext[] = [
  {
    key: 'phone',
    title: 'Phone',
    shortTitle: 'Phone',
    href: '/app/phone',
    icon: Phone,
    items: [
      { title: 'Overview', href: '/app/phone', icon: LayoutDashboard, exact: true, group: 'Workspace' },
      { title: 'Dialer', href: '/app/phone/dialer', icon: Grid3x3, group: 'Calling' },
      { title: 'Power Dialer', href: '/app/phone/power-dialer', icon: ListChecks, group: 'Calling' },
      { title: 'Calls', href: '/app/phone/calls', icon: PhoneCall, group: 'Calling' },
      { title: 'Call Forwarding', href: '/app/phone/forwarding', icon: PhoneForwarded, group: 'Configure' },
      { title: 'Auto Attendant', href: '/app/phone/auto-attendant', icon: ListTree, group: 'Configure' },
      { title: 'Business Hours', href: '/app/phone/business-hours', icon: Clock3, group: 'Configure' },
      { title: 'Voicemail', href: '/app/phone/voicemail', icon: Voicemail, group: 'Configure' },
      { title: 'Phone Numbers', href: '/app/numbers', icon: Hash, group: 'Configure' },
      { title: 'Call Handling', href: '/app/phone/call-handling', icon: Signpost, group: 'Configure' },
      ...(MCTB_UI_ENABLED
        ? [{ title: 'Missed Call Text Back', href: '/app/phone/missed-call-text-back', icon: PhoneMissed, group: 'Configure' as const }]
        : []),
      { title: 'Analytics', href: '/app/phone/analytics', icon: BarChart3, group: 'Insights' },
    ],
  },
  receptionistProductContext('conversational_ivr'),
  ...(MCTB_UI_ENABLED
    ? [
        {
          key: 'mctb' as const,
          title: 'Missed Call Text Back',
          shortTitle: 'Missed Call Text Back',
          href: '/app/mctb',
          icon: MessageSquareReply,
          items: [
            { title: 'Overview', href: '/app/mctb', icon: LayoutDashboard, exact: true, group: 'Workspace' },
            { title: 'Missed Calls', href: '/app/mctb/calls', icon: PhoneMissed, group: 'Activity' },
            { title: 'Conversations', href: '/app/mctb/conversations', icon: MessagesSquare, group: 'Activity' },
            { title: 'Recovery Settings', href: '/app/mctb/recovery', icon: Settings2, group: 'Configure' },
            { title: 'Analytics', href: '/app/mctb/analytics', icon: BarChart3, group: 'Insights' },
          ],
        },
      ]
    : []),
]

export const WORKSPACE: NavContext = {
  key: 'workspace',
  title: 'Workspace',
  shortTitle: 'Workspace',
  href: '/app/home',
  icon: Home,
  items: [
    { title: 'Home', href: '/app/home', icon: Home, group: 'Workspace' },
    { title: 'Inbox', href: '/app/inbox', icon: Inbox, group: 'Workspace' },
    { title: 'Contacts', href: '/app/contacts', icon: Contact, group: 'Workspace' },
    { title: 'Numbers', href: '/app/numbers', icon: Hash, group: 'Workspace' },
    { title: 'Integrations', href: '/app/integrations', icon: Plug, group: 'Manage' },
    { title: 'Settings', href: '/app/settings', icon: Settings, group: 'Manage' },
    { title: 'Help', href: '/app/help', icon: LifeBuoy, group: 'Manage' },
  ],
}

export const ALL_CONTEXTS: NavContext[] = [...PRODUCTS, WORKSPACE]

export function resolveContext(
  pathname: string,
  receptionistProfile?: RuntimeProfile,
): NavContext {
  if (pathname === '/app/receptionist' || pathname.startsWith('/app/receptionist/')) {
    return receptionistProductContext(receptionistProfile ?? 'conversational_ivr')
  }
  const product = PRODUCTS.find(
    (p) => pathname === p.href || pathname.startsWith(`${p.href}/`),
  )
  return product ?? WORKSPACE
}

export function isItemActive(item: NavItem, pathname: string) {
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

export const PRIMARY_DESTINATION_COUNT = ALL_CONTEXTS.reduce(
  (sum, c) => sum + c.items.length,
  0,
)
