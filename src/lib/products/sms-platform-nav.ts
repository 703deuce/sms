import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  Hash,
  Link2,
  Megaphone,
  MessageSquare,
  Puzzle,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sprout,
  Upload,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { leadCaptureTabs } from "@/lib/lead-capture-tabs";

export type SmsPlatformNavOptions = {
  conversationsBadge?: number;
};

/**
 * V1 SMS platform sidebar — messaging, contacts, automations, lead capture, analytics.
 */
export function buildSmsPlatformNav(options: SmsPlatformNavOptions = {}): NavItem[] {
  const badge = options.conversationsBadge ?? 0;

  const items: NavItem[] = [
    {
      label: "Conversations",
      href: "/conversations",
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
      sectionLabel: "Messaging",
    },
    { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    { label: "Send", href: "/send", icon: Send },
    { label: "AI Composer", href: "/send/ai", icon: Sparkles },
    { label: "Message Templates", href: "/templates", icon: FileText },
    { label: "Link Tracking", href: "/reports/links", icon: Link2 },
    {
      label: "Contacts",
      href: "/contacts",
      icon: Users,
      sectionLabel: "Contacts",
    },
    { label: "Imports", href: "/contacts/imports", icon: Upload },
    {
      label: "Flows",
      href: "/automations",
      icon: Workflow,
      sectionLabel: "Automations",
    },
    { label: "Automation Templates", href: "/automations/templates", icon: FileText },
    { label: "Flow Builder", href: "/automations/new", icon: Wrench },
    { label: "Run History", href: "/automations/logs", icon: ClipboardList },
    {
      label: leadCaptureTabs[0]?.label ?? "Keywords",
      href: leadCaptureTabs[0]?.href ?? "/grow/keywords",
      icon: Sprout,
      sectionLabel: "Lead Capture",
    },
  ];

  for (const tab of leadCaptureTabs.slice(1)) {
    items.push({ label: tab.label, href: tab.href, icon: Sprout });
  }

  items.push(
    {
      label: "Manage Numbers",
      href: "/numbers",
      icon: Hash,
      sectionLabel: "Numbers",
    },
    {
      label: "Buy Numbers",
      href: "/numbers/buy",
      icon: ShoppingCart,
    },
    {
      label: "Compliance",
      href: "/compliance",
      icon: ShieldCheck,
      sectionLabel: "Compliance",
    },
    {
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
      sectionLabel: "Integrations",
    },
    {
      label: "Analytics",
      href: "/analytics",
      icon: BarChart3,
      sectionLabel: "Analytics",
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      sectionLabel: "Account",
    },
    { label: "Billing", href: "/settings/billing", icon: CreditCard },
    { label: "Workspace", href: "/settings/workspaces", icon: Settings },
  );

  return items;
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
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname === "/send" || pathname.startsWith("/send/")) {
    if (pathname.startsWith("/send/quick")) return "Quick text";
    if (pathname.startsWith("/send/test")) return "Send test";
    if (pathname.startsWith("/send/ai")) return "AI Composer";
    return "Send";
  }
  if (pathname.startsWith("/templates")) return "Message Templates";
  if (pathname.startsWith("/messaging/media")) return "Media library";
  if (pathname.startsWith("/messaging/payments")) return "Text-to-pay";
  if (pathname.startsWith("/contacts/imports")) return "Imports";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname === "/automations/templates") return "Automation Templates";
  if (pathname === "/automations/new") return "Flow Builder";
  if (pathname === "/automations/logs") return "Run History";
  if (pathname.startsWith("/automations")) return "Flows";
  if (pathname.startsWith("/grow")) {
    const tab = leadCaptureTabs.find(
      (t) => pathname === t.href || pathname.startsWith(`${t.href}/`),
    );
    return tab?.label ?? "Lead Capture";
  }
  if (pathname.startsWith("/reports")) return "Analytics";
  if (pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/compliance")) return "Compliance";
  if (pathname.startsWith("/settings/workspaces")) return "Workspace";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/settings")) return "Settings";
  return "";
}
