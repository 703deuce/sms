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
  Users,
  Workflow,
} from "lucide-react";

export function buildRealtorNav(): NavItem[] {
  return [
    { label: "Dashboard", href: "/realtor/dashboard", icon: LayoutDashboard },
    {
      label: "Leads",
      href: "/realtor/leads",
      icon: Users,
      children: [
        { label: "All Leads", href: "/realtor/leads" },
        { label: "Pipeline", href: "/realtor/leads?view=pipeline" },
        { label: "Needs Attention", href: "/realtor/needs-attention" },
        { label: "Lead Sources", href: "/realtor/leads/sources" },
        { label: "Import", href: "/contacts/imports" },
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
        { label: "Transcripts", href: "/phone/calls?tab=transcripts" },
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
      label: "AI Agents",
      href: "/realtor/agents/front-desk",
      icon: Bot,
      children: [
        { label: "Front Desk", href: "/realtor/agents/front-desk" },
        { label: "Speed-to-Lead", href: "/realtor/agents/speed-to-lead" },
        { label: "Knowledge", href: "/realtor/agents/knowledge" },
        { label: "Agent Activity", href: "/realtor/agents/activity" },
        { label: "Test Agent", href: "/realtor/test" },
      ],
    },
    {
      label: "Automations",
      href: "/automations",
      icon: Workflow,
      children: [
        { label: "Flows", href: "/automations" },
        { label: "Templates", href: "/automations/templates" },
        { label: "Active", href: "/automations?status=active" },
        { label: "Logs", href: "/automations/logs" },
      ],
    },
    {
      label: "Appointments",
      href: "/realtor/appointments",
      icon: CalendarDays,
      children: [
        { label: "Calendar", href: "/realtor/appointments" },
        { label: "Appointment Types", href: "/realtor/appointments/types" },
        { label: "Connections", href: "/integrations/native/calendly" },
      ],
    },
    {
      label: "Campaigns",
      href: "/campaigns",
      icon: Megaphone,
      children: [
        { label: "All Campaigns", href: "/campaigns" },
        { label: "SMS Campaigns", href: "/campaigns?channel=sms" },
        { label: "Email Campaigns", href: "/campaigns?channel=email" },
      ],
    },
    {
      label: "Phone",
      href: "/my-numbers",
      icon: Phone,
      children: [
        { label: "Numbers", href: "/my-numbers" },
        { label: "Dialer", href: "/phone" },
        { label: "Phone Settings", href: "/settings/phone" },
      ],
    },
    {
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
      children: [
        { label: "Connected Apps", href: "/integrations" },
        { label: "CRM", href: "/integrations/crm" },
        { label: "Lead Sources", href: "/realtor/leads/sources" },
        { label: "Calendars", href: "/integrations/native/calendly" },
      ],
    },
    {
      label: "Reports",
      href: "/reports",
      icon: BarChart3,
      children: [
        { label: "Overview", href: "/reports" },
        { label: "Lead Conversion", href: "/reports?tab=leads" },
        { label: "AI Performance", href: "/reports?tab=ai" },
      ],
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      children: [
        { label: "Business", href: "/realtor/settings/business" },
        { label: "AI", href: "/realtor/agents/front-desk" },
        { label: "Phone & Routing", href: "/settings/phone" },
        { label: "Messaging", href: "/settings/messaging" },
      ],
    },
  ];
}
