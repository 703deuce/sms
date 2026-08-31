import { buildAccountNavItems } from "@/lib/products/account-nav";
import {
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Reply,
  Sparkles,
  Sprout,
  Users,
  Zap,
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
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    {
      label: "Audience",
      href: "/contacts",
      icon: Users,
      children: [
        { label: "Contacts", href: "/contacts" },
        { label: "Lists", href: "/contacts/lists" },
        { label: "Segments", href: "/contacts/segments" },
      ],
    },
    {
      label: "List Growth",
      href: "/grow/forms",
      icon: Sprout,
      children: [
        { label: "QR Codes", href: "/grow/qr-codes" },
        { label: "Web Forms", href: "/grow/forms" },
        { label: "Tap-to-Join", href: "/grow/tap-to-join" },
        { label: "Keywords", href: "/grow/keywords" },
      ],
    },
    {
      label: "Automations",
      href: "/automations",
      icon: Zap,
      sectionLabel: "Automate",
    },
    { label: "Auto Replies", href: "/auto-replies", icon: Reply },
    { label: "AI Replies", href: "/ai-replies", icon: Sparkles },
    ...buildAccountNavItems(),
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
  if (pathname.startsWith("/contacts/lists")) return "Lists";
  if (pathname.startsWith("/contacts/segments")) return "Segments";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname.startsWith("/grow/qr-codes")) return "QR Codes";
  if (pathname.startsWith("/grow/forms")) return "Web Forms";
  if (pathname.startsWith("/grow/tap-to-join")) return "Tap-to-Join";
  if (pathname.startsWith("/grow/keywords")) return "Keywords";
  if (pathname.startsWith("/auto-replies")) return "Auto Replies";
  if (pathname.startsWith("/drip-campaigns") || pathname.startsWith("/automations/drip-campaigns")) {
    return "Drip Campaigns";
  }
  if (pathname.startsWith("/ai-replies")) return "AI Replies";
  if (pathname === "/automations/new") return "Create Automation";
  if (pathname === "/automations/logs") return "Run History";
  if (pathname.startsWith("/automations/templates")) return "Automation Templates";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.startsWith("/grow")) return "List Growth";
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
