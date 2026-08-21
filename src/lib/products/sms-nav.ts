import {
  BarChart3,
  Hash,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type SmsNavOptions = {
  inboxBadge?: number;
};

/** Transovo SMS — standalone product sidebar. */
export function buildSmsNav(options: SmsNavOptions = {}): NavItem[] {
  const inboxBadge = options.inboxBadge ?? 0;

  return [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Main",
    },
    {
      label: "Inbox",
      href: "/inbox",
      icon: Inbox,
      badge: inboxBadge > 0 ? inboxBadge : undefined,
    },
    { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    { label: "Contacts", href: "/contacts", icon: Users },
    {
      label: "Automations",
      href: "/automations",
      icon: Workflow,
      sectionLabel: "Automation",
    },
    {
      label: "Missed Call Text Back",
      href: "/solutions/lead-recovery/missed-call-text-back",
      icon: Zap,
    },
    {
      label: "Numbers",
      href: "/numbers",
      icon: Hash,
      sectionLabel: "Manage",
    },
    { label: "Analytics", href: "/reports", icon: BarChart3 },
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      sectionLabel: "Account",
    },
    { label: "Help", href: "/getting-started", icon: HelpCircle },
  ];
}

export function getSmsPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "";
  if (pathname.startsWith("/inbox")) return "Inbox";
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.includes("missed-call-text-back")) return "Missed Call Text Back";
  if (pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/reports")) return "Analytics";
  return "";
}
