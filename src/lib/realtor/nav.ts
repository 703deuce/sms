import type { NavItem } from "@/lib/nav";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Puzzle,
  Settings,
  SlidersHorizontal,
  Users,
  Workflow,
} from "lucide-react";

export const REALTOR_PIPELINE_COLUMNS: Array<{
  status: import("./types").RealtorLeadStatus;
  label: string;
}> = [
  { status: "new", label: "New" },
  { status: "working", label: "Working" },
  { status: "contacted", label: "Contacted" },
  { status: "qualified", label: "Qualified" },
  { status: "appointment", label: "Appointment" },
  { status: "nurture", label: "Nurture" },
  { status: "closed", label: "Closed" },
];

const CALLS_CHILDREN = [
  { label: "All Calls", href: "/realtor/calls" },
  { label: "Dialer", href: "/realtor/calls/dialer" },
  { label: "Voicemails", href: "/realtor/calls/voicemails" },
  { label: "Transcripts", href: "/realtor/calls/transcripts" },
  { label: "Recordings", href: "/realtor/calls/recordings" },
  { label: "Phone Settings", href: "/realtor/calls/phone-settings" },
];

const APPOINTMENTS_CHILDREN = [
  { label: "Calendar", href: "/realtor/appointments/calendar" },
  { label: "Appointments", href: "/realtor/appointments" },
  { label: "Appointment Types", href: "/realtor/appointments/types" },
  { label: "Connections", href: "/realtor/appointments/connections" },
  { label: "Availability", href: "/realtor/appointments/availability" },
];

export function buildRealtorMobileNav(): NavItem[] {
  return [
    { label: "Dashboard", href: "/realtor/dashboard", icon: LayoutDashboard },
    { label: "Leads", href: "/realtor/leads", icon: Users },
    { label: "Inbox", href: "/inbox", icon: Inbox },
    { label: "Calls", href: "/phone/calls", icon: PhoneCall },
  ];
}

const REALTOR_PAGE_TITLES: Record<string, string> = {
  "/realtor": "Real Estate",
  "/realtor/setup": "Setup",
  "/realtor/onboarding": "Guided Setup",
  "/realtor/dashboard": "Dashboard",
  "/realtor/leads": "Leads",
  "/realtor/needs-attention": "Needs Attention",
  "/realtor/test": "Test Amy",
  "/realtor/messages": "Messages",
  "/realtor/calls": "All Calls",
  "/realtor/calls/dialer": "Dialer",
  "/realtor/calls/voicemails": "Voicemails",
  "/realtor/calls/transcripts": "Transcripts",
  "/realtor/calls/recordings": "Recordings",
  "/realtor/calls/phone-settings": "Phone Settings",
  "/realtor/appointments": "Appointments",
  "/realtor/appointments/calendar": "Calendar",
  "/realtor/appointments/types": "Appointment Types",
  "/realtor/appointments/connections": "Connections",
  "/realtor/appointments/availability": "Availability",
  "/realtor/leads/sources": "Lead Sources",
  "/realtor/settings/business": "Business Settings",
  "/realtor/agents/front-desk": "Front Desk Agent",
  "/realtor/agents/speed-to-lead": "Speed-to-Lead",
  "/realtor/agents/knowledge": "Knowledge",
  "/realtor/agents/activity": "Agent Activity",
};

export function getRealtorPageTitle(pathname: string): string | null {
  if (REALTOR_PAGE_TITLES[pathname]) return REALTOR_PAGE_TITLES[pathname];
  if (pathname.startsWith("/realtor/leads/")) return "Lead Detail";
  return null;
}

/** Flat sidebar matching product mockups — badges set from shell unread count. */
export function buildRealtorNav(inboxBadge?: number): NavItem[] {
  return [
    { label: "Setup", href: "/realtor/setup", icon: SlidersHorizontal },
    { label: "Dashboard", href: "/realtor/dashboard", icon: LayoutDashboard },
    { label: "Leads", href: "/realtor/leads", icon: Users },
    {
      label: "Inbox",
      href: "/inbox",
      icon: Inbox,
      badge: inboxBadge && inboxBadge > 0 ? inboxBadge : undefined,
    },
    {
      label: "Calls",
      href: "/realtor/calls",
      icon: PhoneCall,
      children: CALLS_CHILDREN,
    },
    { label: "Messages", href: "/realtor/messages", icon: MessageSquare },
    { label: "AI Agents", href: "/realtor/agents/front-desk", icon: Bot },
    { label: "Automations", href: "/automations", icon: Workflow },
    {
      label: "Appointments",
      href: "/realtor/appointments/calendar",
      icon: CalendarDays,
      children: APPOINTMENTS_CHILDREN,
    },
    { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
  ];
}
