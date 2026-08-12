import type { NavItem } from "@/lib/nav";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Phone,
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
  "/realtor/setup": "Get Amy Ready",
  "/realtor/onboarding": "Guided Setup",
  "/realtor/dashboard": "Dashboard",
  "/realtor/leads": "Leads",
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
  if (pathname.startsWith("/realtor/leads/")) return "Lead Detail";
  return null;
}

export function buildRealtorNav(): NavItem[] {
  return [
    {
      sectionLabel: "Work",
      label: "Dashboard",
      href: "/realtor/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Leads",
      href: "/realtor/leads",
      icon: Users,
      children: [
        { label: "All Leads", href: "/realtor/leads" },
        { label: "Needs Attention", href: "/realtor/leads?view=needs_attention" },
        { label: "Qualified", href: "/realtor/leads?view=qualified" },
        { label: "Lead Sources", href: "/realtor/leads/sources" },
      ],
    },
    {
      label: "Inbox",
      href: "/inbox",
      icon: Inbox,
      children: [
        { label: "All Conversations", href: "/inbox" },
        { label: "Unread", href: "/inbox?filter=unread" },
        { label: "SMS", href: "/inbox?channel=sms" },
        { label: "Email", href: "/inbox?channel=email" },
      ],
    },
    {
      label: "Calls",
      href: "/phone/calls",
      icon: PhoneCall,
      children: [
        { label: "All Calls", href: "/phone/calls" },
        { label: "Inbound", href: "/phone/calls?direction=inbound" },
        { label: "Outbound", href: "/phone/calls?direction=outbound" },
        { label: "AI Calls", href: "/phone/calls?kind=ai" },
      ],
    },
    {
      label: "Appointments",
      href: "/realtor/appointments",
      icon: CalendarDays,
    },
    {
      sectionLabel: "Setup",
      label: "Get Amy Ready",
      href: "/realtor/setup",
      icon: SlidersHorizontal,
    },
    {
      label: "AI Agents",
      href: "/realtor/agents/front-desk",
      icon: Bot,
      children: [
        { label: "Front Desk", href: "/realtor/agents/front-desk" },
        { label: "Speed-to-Lead", href: "/realtor/agents/speed-to-lead" },
        { label: "Knowledge", href: "/realtor/agents/knowledge" },
        { label: "Test Amy", href: "/realtor/test" },
      ],
    },
    {
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
      children: [
        { label: "Lead Sources", href: "/realtor/leads/sources" },
        { label: "CRM", href: "/integrations/crm" },
        { label: "Calendar", href: "/integrations/native/calendly" },
        { label: "Messaging", href: "/settings/messaging" },
      ],
    },
    {
      label: "Phone",
      href: "/my-numbers",
      icon: Phone,
      children: [
        { label: "Numbers", href: "/my-numbers" },
        { label: "Phone Settings", href: "/settings/phone" },
      ],
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      children: [
        { label: "Setup Home", href: "/realtor/setup" },
        { label: "Business", href: "/realtor/settings/business" },
        { label: "Guided onboarding", href: "/realtor/onboarding" },
      ],
    },
    {
      sectionLabel: "Growth",
      label: "Campaigns",
      href: "/campaigns",
      icon: Megaphone,
    },
    {
      label: "Automations",
      href: "/automations",
      icon: Workflow,
      children: [
        { label: "Flows", href: "/automations" },
        { label: "Templates", href: "/automations/templates" },
        { label: "Logs", href: "/automations/logs" },
      ],
    },
    {
      label: "Messages",
      href: "/realtor/messages",
      icon: MessageSquare,
      children: [
        { label: "SMS", href: "/realtor/messages?channel=sms" },
        { label: "Email", href: "/realtor/messages?channel=email" },
        { label: "Templates", href: "/templates" },
      ],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: BarChart3,
    },
  ];
}
