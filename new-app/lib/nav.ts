import {
  BarChart3,
  Bot,
  BookOpen,
  CalendarClock,
  Contact,
  FlaskConical,
  Grid3x3,
  Home,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MessageSquareReply,
  MessagesSquare,
  Phone,
  PhoneCall,
  PhoneMissed,
  Plug,
  Settings,
  Settings2,
  Signpost,
  SlidersHorizontal,
  Hash,
  Clock3,
  ListTree,
  PhoneForwarded,
  Voicemail,
  type LucideIcon,
} from 'lucide-react'

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
      { title: 'Analytics', href: '/app/phone/analytics', icon: BarChart3, group: 'Insights' },
    ],
  },
  {
    key: 'receptionist',
    title: 'AI Receptionist',
    shortTitle: 'AI Receptionist',
    href: '/app/receptionist',
    icon: Bot,
    items: [
      { title: 'Overview', href: '/app/receptionist', icon: LayoutDashboard, exact: true, group: 'Workspace' },
      { title: 'Calls', href: '/app/receptionist/calls', icon: PhoneCall, group: 'Activity' },
      { title: 'Agent Settings', href: '/app/receptionist/agent', icon: SlidersHorizontal, group: 'Configure' },
      { title: 'Knowledge', href: '/app/receptionist/knowledge', icon: BookOpen, group: 'Configure' },
      { title: 'Appointments', href: '/app/receptionist/appointments', icon: CalendarClock, group: 'Configure' },
      { title: 'Call Handling', href: '/app/receptionist/call-handling', icon: Signpost, group: 'Configure' },
      { title: 'Test', href: '/app/receptionist/test', icon: FlaskConical, group: 'Insights' },
      { title: 'Analytics', href: '/app/receptionist/analytics', icon: BarChart3, group: 'Insights' },
    ],
  },
  {
    key: 'mctb',
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

export function resolveContext(pathname: string): NavContext {
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
