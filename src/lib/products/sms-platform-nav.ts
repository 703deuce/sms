import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  Hash,
  Image,
  Inbox,
  Link2,
  Megaphone,
  Puzzle,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  Upload,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { growTabs } from "@/lib/grow-tabs";

export type SmsPlatformNavOptions = {
  inboxBadge?: number;
  /** Mass Texting entitlement — shows SMS-specific analytics/settings. */
  hasMassTexting?: boolean;
};

/** Grow surfaces shown in the sidebar (subset of on-page grow tabs). */
const growNavTabs = growTabs.filter(
  (tab) =>
    tab.href !== "/grow/click-to-text" &&
    tab.href !== "/grow/pages" &&
    tab.href !== "/grow/contact-cards",
);

const LEAD_CAPTURE_SECTION = "Lead capture";

/**
 * Primary SMS platform sidebar — campaigns, inbox, automations, lead capture, and reports.
 */
export function buildSmsPlatformNav(options: SmsPlatformNavOptions = {}): NavItem[] {
  const inboxBadge = options.inboxBadge ?? 0;
  const hasMassTexting = options.hasMassTexting ?? false;

  const items: NavItem[] = [
    {
      label: "Inbox",
      href: "/inbox",
      icon: Inbox,
      badge: inboxBadge > 0 ? inboxBadge : undefined,
      sectionLabel: "SMS",
    },
    { label: "Campaigns", href: "/campaigns", icon: Megaphone },
    { label: "Send", href: "/send", icon: Send },
    { label: "AI composer", href: "/send/ai", icon: Sparkles },
    { label: "Message templates", href: "/templates", icon: FileText },
    { label: "Media library", href: "/messaging/media", icon: Image },
    { label: "Link tracking", href: "/reports/links", icon: Link2 },
    { label: "Contacts", href: "/contacts", icon: Users, sectionLabel: "Contacts" },
    { label: "Imports", href: "/contacts/imports", icon: Upload },
    {
      label: "Flows",
      href: "/automations",
      icon: Workflow,
      sectionLabel: "Automations",
    },
    { label: "Automation templates", href: "/automations/templates", icon: FileText },
    { label: "Flow builder", href: "/automations/new", icon: Wrench },
    { label: "Run history", href: "/automations/logs", icon: ClipboardList },
    {
      label: growNavTabs[0]?.label ?? "Keywords",
      href: growNavTabs[0]?.href ?? "/grow/keywords",
      icon: Sprout,
      sectionLabel: LEAD_CAPTURE_SECTION,
    },
  ];

  for (const tab of growNavTabs.slice(1)) {
    items.push({ label: tab.label, href: tab.href, icon: Sprout });
  }

  items.push(
    {
      label: "Reports",
      href: "/reports",
      icon: BarChart3,
      sectionLabel: "Reports",
    },
    {
      label: "Numbers",
      href: "/numbers",
      icon: Hash,
      sectionLabel: "Manage",
    },
    {
      label: "Compliance",
      href: "/compliance",
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
    if (pathname.startsWith("/send/ai")) return "AI composer";
    return "Send";
  }
  if (pathname.startsWith("/templates")) return "Message templates";
  if (pathname.startsWith("/messaging/media")) return "Media library";
  if (pathname.startsWith("/messaging/payments")) return "Text-to-pay";
  if (pathname.startsWith("/messaging/links")) return "Link tracking";
  if (pathname.startsWith("/contacts/lists")) return "Lists";
  if (pathname.startsWith("/contacts/imports")) return "Imports";
  if (pathname.startsWith("/contacts")) return "Contacts";
  if (pathname === "/automations/templates") return "Automation templates";
  if (pathname === "/automations/new") return "Flow builder";
  if (pathname === "/automations/logs") return "Run history";
  if (pathname.startsWith("/automations")) return "Automations";
  if (pathname.startsWith("/grow")) {
    const tab = growTabs.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
    return tab?.label ?? LEAD_CAPTURE_SECTION;
  }
  if (pathname.startsWith("/surveys")) return "Surveys";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/compliance")) return "Compliance";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/getting-started")) return "Help";
  return "";
}
