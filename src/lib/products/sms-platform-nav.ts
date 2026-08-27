import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  Hash,
  HelpCircle,
  Image,
  Inbox,
  LayoutDashboard,
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
  Wallet,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { growTabs } from "@/lib/grow-tabs";

export type SmsPlatformNavOptions = {
  inboxBadge?: number;
  /** Mass Texting entitlement — shows overview + SMS-specific compliance/settings. */
  hasMassTexting?: boolean;
};

const reportLinks: Array<{ label: string; href: string }> = [
  { label: "Reports overview", href: "/reports" },
  { label: "Campaign reports", href: "/reports/campaigns" },
  { label: "Message reports", href: "/reports/messages" },
  { label: "Inbox reports", href: "/reports/inbox" },
  { label: "Link tracking", href: "/reports/links" },
  { label: "Contact reports", href: "/reports/contacts" },
  { label: "Automation reports", href: "/reports/automations" },
  { label: "Usage", href: "/reports/usage" },
  { label: "Integration reports", href: "/reports/integrations" },
];

/**
 * Primary SMS platform sidebar — mirrors legacy Platform Messaging / Automations /
 * Growth / Reports surfaces as flat items (Contacts & Campaign sub-routes stay on-page tabs).
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
    { label: "Quick text", href: "/send/quick", icon: Zap },
    { label: "AI composer", href: "/send/ai", icon: Sparkles },
    { label: "Message templates", href: "/templates", icon: FileText },
    { label: "Media library", href: "/messaging/media", icon: Image },
    { label: "Link tracking", href: "/reports/links", icon: Link2 },
    { label: "Text-to-pay", href: "/messaging/payments", icon: Wallet },
    { label: "Contacts", href: "/contacts", icon: Users, sectionLabel: "Contacts" },
    { label: "Lists", href: "/contacts/lists", icon: Users },
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
      label: growTabs[0].label,
      href: growTabs[0].href,
      icon: Sprout,
      sectionLabel: "Grow",
    },
  );

  for (const tab of growTabs.slice(1)) {
    items.push({ label: tab.label, href: tab.href, icon: Sprout });
  }

  items.push({
    label: "Surveys",
    href: "/surveys",
    icon: ClipboardList,
    sectionLabel: "Engagement",
  });

  for (const [index, report] of reportLinks.entries()) {
    items.push({
      label: report.label,
      href: report.href,
      icon: BarChart3,
      sectionLabel: index === 0 ? "Reports" : undefined,
    });
  }

  items.push(
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
    return tab?.label ?? "Grow";
  }
  if (pathname.startsWith("/surveys")) return "Surveys";
  if (pathname.startsWith("/reports")) {
    const report = reportLinks.find((r) => pathname === r.href || pathname.startsWith(`${r.href}/`));
    return report?.label ?? "Reports";
  }
  if (pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/compliance")) return "Compliance";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/getting-started")) return "Help";
  return "";
}
