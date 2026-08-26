import {
  BarChart3,
  FileText,
  Image,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type MassTextNavOptions = {
  inboxBadge?: number;
};

/**
 * Mass Texting V1 — focused product navigation (no CRM/automation/grow clutter).
 */
export function buildMassTextNav(options: MassTextNavOptions = {}): NavItem[] {
  const inboxBadge = options.inboxBadge ?? 0;

  return [
    {
      label: "Overview",
      href: "/sms",
      icon: LayoutDashboard,
      sectionLabel: "Mass Texting",
    },
    {
      label: "Campaigns",
      href: "/campaigns",
      icon: Megaphone,
    },
    {
      label: "Lists",
      href: "/contacts/lists",
      icon: Users,
    },
    {
      label: "Templates",
      href: "/templates",
      icon: FileText,
    },
    {
      label: "Media",
      href: "/messaging/media",
      icon: Image,
    },
    {
      label: "Analytics",
      href: "/sms/analytics",
      icon: BarChart3,
    },
    {
      label: "Compliance",
      href: "/sms/compliance",
      icon: ShieldCheck,
      sectionLabel: "Shared",
    },
    {
      label: "Inbox",
      href: "/inbox?product=mass_text",
      icon: Inbox,
      badge: inboxBadge > 0 ? inboxBadge : undefined,
    },
    {
      label: "Contacts",
      href: "/contacts",
      icon: Users,
    },
    {
      label: "Numbers",
      href: "/numbers",
      icon: Settings,
      sectionLabel: "Account",
    },
    {
      label: "Settings",
      href: "/sms/settings",
      icon: Settings,
    },
  ];
}

export function getMassTextPageTitle(pathname: string): string {
  if (pathname === "/sms" || pathname.startsWith("/sms/")) {
    if (pathname.startsWith("/sms/analytics")) return "Analytics";
    if (pathname.startsWith("/sms/compliance")) return "Compliance";
    if (pathname.startsWith("/sms/settings")) return "Settings";
    if (pathname.startsWith("/sms/campaigns")) return "Campaigns";
    return "Mass Texting";
  }
  if (pathname.startsWith("/campaigns")) return "Campaigns";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/messaging/media")) return "Media";
  if (pathname.startsWith("/contacts/lists")) return "Lists";
  return "";
}
