import {
  BarChart3,
  Hash,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  Sprout,
  Users,
  Workflow,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type SmsNavOptions = {
  inboxBadge?: number;
};

/**
 * Transovo SMS — customer-facing sidebar (~10 items).
 * Deep routes (inbox tabs, campaign states, grow tools, etc.) stay off the menu.
 */
export function buildSmsNav(options: SmsNavOptions = {}): NavItem[] {
  const inboxBadge = options.inboxBadge ?? 0;

  return [
    {
      label: "Dashboard",
      href: "/sms/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Main",
    },
    {
      label: "Inbox",
      href: "/conversations",
      icon: Inbox,
      badge: inboxBadge > 0 ? inboxBadge : undefined,
    },
    { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    { label: "Contacts", href: "/contacts", icon: Users },
    {
      label: "Automations",
      href: "/automations",
      icon: Workflow,
      sectionLabel: "Automate & Grow",
    },
    { label: "Grow", href: "/grow/keywords", icon: Sprout },
    {
      label: "Numbers",
      href: "/numbers",
      icon: Hash,
      sectionLabel: "Manage",
    },
    { label: "Analytics", href: "/sms/analytics", icon: BarChart3 },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      sectionLabel: "Account",
    },
    { label: "Help", href: "/getting-started", icon: HelpCircle },
  ];
}

export function getSmsPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "";
  if (pathname.startsWith("/sms/dashboard")) return "Dashboard";
  if (pathname.startsWith("/conversations")) return "Inbox";
  if (pathname.startsWith("/inbox")) return "Inbox";
  if (pathname.startsWith("/send")) return "Send Message";
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.includes("missed-call-text-back")) return "Missed Call Text Back";
  if (pathname.startsWith("/grow")) return "Grow";
  if (pathname.startsWith("/surveys")) return "Surveys";
  if (pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/sms/analytics")) return "Analytics";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/compliance")) return "Compliance";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/messaging")) return "Messaging";
  return "";
}
