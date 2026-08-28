import {
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Puzzle,
  Settings,
  Users,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type SmsPlatformNavOptions = {
  conversationsBadge?: number;
};

/**
 * V1 SMS platform sidebar — focused operator nav matching inbox wireframe.
 */
export function buildSmsPlatformNav(options: SmsPlatformNavOptions = {}): NavItem[] {
  const badge = options.conversationsBadge ?? 0;

  return [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Main",
    },
    {
      label: "Conversations",
      href: "/conversations",
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
    { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Playbooks", href: "/playbooks", icon: BookOpen },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
    { label: "Settings", href: "/settings", icon: Settings, sectionLabel: "Account" },
    { label: "Help", href: "/settings", icon: HelpCircle },
  ];
}

export function getSmsPlatformPageTitle(pathname: string): string {
  if (pathname.startsWith("/conversations")) return "Conversations";
  if (pathname.startsWith("/analytics")) {
    if (pathname.startsWith("/analytics/sources")) return "Lead Sources";
    if (pathname.startsWith("/analytics/mctb")) return "Missed Call Text Back";
    if (pathname.startsWith("/analytics/campaigns")) return "Campaigns";
    if (pathname.startsWith("/analytics/messaging")) return "Messaging";
    return "Analytics";
  }
  if (pathname === "/sms" || pathname.startsWith("/sms/")) {
    if (pathname.startsWith("/sms/settings")) return "Settings";
    return "Analytics";
  }
  if (pathname.startsWith("/playbooks")) return "Playbooks";
  if (pathname.startsWith("/campaigns")) {
    if (pathname.startsWith("/campaigns/new/review")) return "Review Campaign";
    if (pathname.startsWith("/campaigns/new")) return "Create Campaign";
    return "Campaigns";
  }
  if (pathname === "/send" || pathname.startsWith("/send/")) {
    if (pathname.startsWith("/send/quick")) return "Quick Send";
    if (pathname.startsWith("/send/test")) return "Send test";
    if (pathname.startsWith("/send/ai")) return "AI Composer";
    return "Send";
  }
  if (pathname.startsWith("/templates")) return "Message Templates";
  if (pathname.startsWith("/messaging/media")) return "Media library";
  if (pathname.startsWith("/messaging/payments")) return "Text-to-pay";
  if (pathname.startsWith("/contacts/imports")) return "Imports";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname === "/automations/new") return "Create Automation";
  if (pathname === "/automations/logs") return "Run History";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.startsWith("/grow")) return "Lead Capture";
  if (pathname.startsWith("/help")) return "Help";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/reports")) return "Analytics";
  if (pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/compliance")) return "Compliance";
  if (pathname.startsWith("/settings/workspaces")) return "Workspace";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/settings")) return "Settings";
  return "";
}
