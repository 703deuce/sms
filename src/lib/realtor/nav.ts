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

const LEADS_CHILDREN = [
  { label: "All Leads", href: "/realtor/leads" },
  { label: "Pipeline", href: "/realtor/leads/pipeline" },
  { label: "Needs Attention", href: "/realtor/leads/needs-attention", badge: 8 },
  { label: "Lists / Segments", href: "/realtor/leads/lists" },
  { label: "Tags", href: "/realtor/leads/tags" },
  { label: "Lead Capture", href: "/realtor/leads/capture" },
  { label: "Import", href: "/realtor/leads/import" },
  { label: "Lead Sources", href: "/realtor/leads/sources" },
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
  "/realtor/leads": "All Leads",
  "/realtor/leads/pipeline": "Pipeline",
  "/realtor/leads/needs-attention": "Needs Attention",
  "/realtor/leads/lists": "Lists / Segments",
  "/realtor/leads/tags": "Tags",
  "/realtor/leads/capture": "Lead Capture",
  "/realtor/leads/import": "Import",
  "/realtor/needs-attention": "Needs Attention",
  "/realtor/test": "Test Amy",
  "/realtor/messages": "Messages",
  "/realtor/appointments": "Appointments",
  "/realtor/appointments/types": "Appointment Types",
  "/realtor/leads/sources": "Lead Sources",
  "/realtor/settings/business": "Business Settings",
  "/realtor/agents/front-desk": "Front Desk Agent",
  "/realtor/agents/speed-to-lead": "Speed-to-Lead",
  "/realtor/agents/knowledge": "Knowledge",
  "/realtor/agents/activity": "Agent Activity",
};

export function getRealtorPageTitle(pathname: string): string | null {
  if (REALTOR_PAGE_TITLES[pathname]) return REALTOR_PAGE_TITLES[pathname];
  if (pathname.match(/^\/realtor\/leads\/[^/]+$/)) return "Lead Detail";
  return null;
}

/** Sidebar nav with expandable Leads section matching CRM mockups. */
export function buildRealtorNav(inboxBadge?: number): NavItem[] {
  return [
    { label: "Setup", href: "/realtor/setup", icon: SlidersHorizontal },
    { label: "Dashboard", href: "/realtor/dashboard", icon: LayoutDashboard },
    {
      label: "Leads",
      href: "/realtor/leads",
      icon: Users,
      children: LEADS_CHILDREN,
    },
    {
      label: "Inbox",
      href: "/inbox",
      icon: Inbox,
      badge: inboxBadge && inboxBadge > 0 ? inboxBadge : undefined,
    },
    { label: "Calls", href: "/phone/calls", icon: PhoneCall },
    { label: "Messages", href: "/realtor/messages", icon: MessageSquare },
    { label: "AI Agents", href: "/realtor/agents/front-desk", icon: Bot },
    { label: "Automations", href: "/automations", icon: Workflow },
    { label: "Appointments", href: "/realtor/appointments", icon: CalendarDays },
    { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
  ];
}
