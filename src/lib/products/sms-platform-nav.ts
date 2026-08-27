import {
  BarChart3,
  CreditCard,
  FileText,
  Hash,
  HelpCircle,
  Image,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Puzzle,
  Send,
  Settings,
  ShieldCheck,
  Sprout,
  Upload,
  Users,
  Workflow,
  ClipboardList,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type SmsPlatformNavOptions = {
  inboxBadge?: number;
  /** Mass Texting entitlement — shows overview + SMS-specific compliance/settings. */
  hasMassTexting?: boolean;
};

/**
 * Primary SMS platform sidebar — campaigns, contacts, automations, grow, etc.
 * Shown at the top of the unified Transovo customer nav.
 */
export function buildSmsPlatformNav(options: SmsPlatformNavOptions = {}): NavItem[] {
  const inboxBadge = options.inboxBadge ?? 0;
  const hasMassTexting = options.hasMassTexting ?? false;

  const items: NavItem[] = [];

  if (hasMassTexting) {
    items.push({
      label: "Overview",
      href: "/sms",
      icon: LayoutDashboard,
      sectionLabel: "SMS",
    });
  }

  items.push({
    label: "Inbox",
    href: "/inbox",
    icon: Inbox,
    badge: inboxBadge > 0 ? inboxBadge : undefined,
    sectionLabel: hasMassTexting ? undefined : "SMS",
  });

  items.push(
    { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    { label: "Send", href: "/send", icon: Send },
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Lists", href: "/contacts/lists", icon: Users },
    { label: "Imports", href: "/contacts/imports", icon: Upload },
    { label: "Templates", href: "/templates", icon: FileText },
    { label: "Media", href: "/messaging/media", icon: Image },
    {
      label: "Automations",
      href: "/automations",
      icon: Workflow,
      sectionLabel: "Automate & Grow",
    },
    { label: "Grow", href: "/grow/keywords", icon: Sprout },
    { label: "Surveys", href: "/surveys", icon: ClipboardList },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    {
      label: "Numbers",
      href: "/numbers",
      icon: Hash,
      sectionLabel: "Manage",
    },
    {
      label: "Compliance",
      href: hasMassTexting ? "/sms/compliance" : "/compliance",
      icon: ShieldCheck,
    },
    {
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
    },
  );

  if (hasMassTexting) {
    items.push({
      label: "Analytics",
      href: "/sms/analytics",
      icon: BarChart3,
    });
  }

  items.push(
    {
      label: "Settings",
      href: hasMassTexting ? "/sms/settings" : "/settings",
      icon: Settings,
      sectionLabel: "Account",
    },
    { label: "Billing", href: "/settings/billing", icon: CreditCard },
    { label: "Help", href: "/getting-started", icon: HelpCircle },
  );

  return items;
}

export function getSmsPlatformPageTitle(pathname: string): string {
  if (pathname === "/sms" || pathname.startsWith("/sms/")) {
    if (pathname.startsWith("/sms/analytics")) return "Analytics";
    if (pathname.startsWith("/sms/compliance")) return "Compliance";
    if (pathname.startsWith("/sms/settings")) return "Settings";
    return "SMS";
  }
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname === "/send" || pathname.startsWith("/send/")) {
    if (pathname.startsWith("/send/quick")) return "Quick text";
    if (pathname.startsWith("/send/test")) return "Send test";
    if (pathname.startsWith("/send/ai")) return "Write with AI";
    return "Send message";
  }
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/messaging/media")) return "Media";
  if (pathname.startsWith("/contacts/lists")) return "Lists";
  if (pathname.startsWith("/contacts/imports")) return "Imports";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.startsWith("/grow")) return "Grow";
  if (pathname.startsWith("/surveys")) return "Surveys";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/compliance")) return "Compliance";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/getting-started")) return "Help";
  return "";
}
