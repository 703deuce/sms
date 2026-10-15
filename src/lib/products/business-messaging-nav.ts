import {
  AudioLines,
  CalendarClock,
  Contact,
  Inbox,
  LayoutDashboard,
  Megaphone,
  PhoneMissed,
  Puzzle,
  Settings,
  Star,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import { REVIEW_ROUTES } from "@/lib/reviews/routes";

export type BusinessMessagingNavEntitlements = {
  inboxBadge?: number;
  hasMctb: boolean;
  hasAppointmentReminders: boolean;
  hasMassSms: boolean;
  hasReviews?: boolean;
};

export type ServiceTab = {
  label: string;
  href: string;
  matchPrefix?: string;
  matchExact?: boolean;
};

export const BUSINESS_MESSAGING_OVERVIEW_HREF = "/overview";

export const INBOX_TAB_ROUTES = {
  conversations: "/conversations",
  missedCalls: MCTB_ROUTES.missedCalls,
  voicemail: MCTB_ROUTES.voicemail,
  heldReplies: `${AR_ROUTES.responses}?view=held`,
} as const;

export const MCTB_SERVICE_TABS: ServiceTab[] = [
  { label: "Activity", href: MCTB_ROUTES.home, matchExact: true },
  { label: "Recovery Rules", href: MCTB_ROUTES.missedCallRecovery, matchPrefix: MCTB_ROUTES.missedCallRecovery },
  { label: "Text Back", href: MCTB_ROUTES.textBack, matchPrefix: MCTB_ROUTES.textBack },
  { label: "AI Recovery", href: MCTB_ROUTES.aiRecovery, matchPrefix: MCTB_ROUTES.aiRecovery },
  { label: "Phone Setup", href: MCTB_ROUTES.phone, matchPrefix: MCTB_ROUTES.phone },
  { label: "Analytics", href: MCTB_ROUTES.analytics, matchPrefix: MCTB_ROUTES.analytics },
];

export const AR_SERVICE_TABS: ServiceTab[] = [
  { label: "Calendar", href: AR_ROUTES.home, matchExact: true },
  { label: "Appointments", href: AR_ROUTES.appointments, matchPrefix: AR_ROUTES.appointments },
  { label: "Reminders", href: AR_ROUTES.reminders, matchPrefix: AR_ROUTES.reminders },
  { label: "Sequences", href: AR_ROUTES.remindersSequences, matchPrefix: AR_ROUTES.remindersSequences },
  { label: "AI Rescheduler", href: AR_ROUTES.aiRescheduler, matchPrefix: AR_ROUTES.aiRescheduler },
  { label: "Analytics", href: AR_ROUTES.analytics, matchPrefix: AR_ROUTES.analytics },
];

/** Primary workspace tabs (peer to MCTB / Campaigns service tabs). */
export const REVIEWS_SERVICE_TABS: ServiceTab[] = [
  { label: "Overview", href: REVIEW_ROUTES.overview, matchPrefix: REVIEW_ROUTES.overview },
  { label: "Requests", href: REVIEW_ROUTES.requests, matchPrefix: REVIEW_ROUTES.requests },
  { label: "Campaigns", href: REVIEW_ROUTES.campaigns, matchPrefix: REVIEW_ROUTES.campaigns },
  { label: "Insights", href: REVIEW_ROUTES.insights, matchPrefix: REVIEW_ROUTES.insights },
  { label: "Alerts", href: REVIEW_ROUTES.alerts, matchPrefix: REVIEW_ROUTES.alerts },
];

/** Expandable sidebar links under Reviews (not top tabs). */
export const REVIEWS_SIDEBAR_CHILDREN = [
  { label: "QR campaigns", href: REVIEW_ROUTES.qr },
  { label: "Review feed", href: REVIEW_ROUTES.feed },
  { label: "Velocity", href: REVIEW_ROUTES.velocity },
] as const;

export const CAMPAIGNS_SERVICE_TABS: ServiceTab[] = [
  { label: "All Campaigns", href: "/campaigns", matchExact: true },
  { label: "Drafts", href: "/campaigns/drafts", matchPrefix: "/campaigns/drafts" },
  { label: "Scheduled", href: "/campaigns/scheduled", matchPrefix: "/campaigns/scheduled" },
  { label: "Completed", href: "/campaigns/completed", matchPrefix: "/campaigns/completed" },
  { label: "Templates", href: "/templates", matchPrefix: "/templates" },
  { label: "Analytics", href: "/sms/analytics", matchPrefix: "/sms/analytics" },
];

export const CONTACTS_WORKSPACE_TABS: ServiceTab[] = [
  { label: "All Contacts", href: "/contacts", matchPrefix: "/contacts" },
  { label: "Lists", href: "/contacts/lists", matchPrefix: "/contacts/lists" },
  { label: "Imports", href: "/contacts/imports", matchPrefix: "/contacts/imports" },
  { label: "Consent", href: MCTB_ROUTES.complianceConsent, matchPrefix: "/mctb/compliance" },
];

/** Paths where the global Inbox sidebar item should appear active. */
export function isInboxWorkspacePath(pathname: string): boolean {
  if (pathname === "/conversations" || pathname.startsWith("/conversations/")) return true;
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) return true;
  if (pathname === MCTB_ROUTES.missedCalls || pathname.startsWith(`${MCTB_ROUTES.missedCalls}/`)) {
    return true;
  }
  if (pathname === MCTB_ROUTES.voicemail || pathname.startsWith(`${MCTB_ROUTES.voicemail}/`)) {
    return true;
  }
  if (pathname === AR_ROUTES.responses || pathname.startsWith(`${AR_ROUTES.responses}/`)) {
    return true;
  }
  if (pathname === AR_ROUTES.heldInbound || pathname.startsWith(`${AR_ROUTES.heldInbound}/`)) {
    return true;
  }
  return false;
}

export function shouldShowMctbServiceTabs(pathname: string): boolean {
  if (pathname.startsWith("/onboarding/mctb")) return false;
  if (pathname.startsWith("/mctb/billing")) return false;
  if (isInboxWorkspacePath(pathname) && pathname.startsWith("/mctb/")) return false;
  if (pathname === MCTB_ROUTES.missedCalls || pathname.startsWith(`${MCTB_ROUTES.missedCalls}/`)) {
    return false;
  }
  if (pathname === MCTB_ROUTES.conversations || pathname.startsWith(`${MCTB_ROUTES.conversations}/`)) {
    return false;
  }
  if (pathname === MCTB_ROUTES.voicemail || pathname.startsWith(`${MCTB_ROUTES.voicemail}/`)) {
    return false;
  }
  if (pathname.startsWith("/mctb/setup/") && pathname !== MCTB_ROUTES.setup) {
    return false;
  }
  return pathname === MCTB_ROUTES.home || pathname.startsWith("/mctb/");
}

export function shouldShowArServiceTabs(pathname: string): boolean {
  if (pathname.startsWith(`${AR_ROUTES.setupConnect}`)) return false;
  if (pathname.startsWith(`${AR_ROUTES.setupConfigure}`)) return false;
  if (pathname.startsWith(`${AR_ROUTES.setupActivate}`)) return false;
  if (pathname.startsWith(`${AR_ROUTES.booking}`)) return false;
  if (isInboxWorkspacePath(pathname)) return false;
  return pathname === AR_ROUTES.home || pathname.startsWith("/appointment-reminders/");
}

export function shouldShowCampaignsServiceTabs(pathname: string): boolean {
  if (pathname.startsWith("/campaigns/new")) return false;
  return pathname === "/campaigns" || pathname.startsWith("/campaigns/") || pathname.startsWith("/templates");
}

export function shouldShowContactsWorkspaceTabs(pathname: string): boolean {
  return (
    pathname === "/contacts" ||
    pathname.startsWith("/contacts/") ||
    pathname.startsWith("/mctb/compliance/consent")
  );
}

/**
 * Unified Transovo Business Messaging sidebar — eight primary links (+ section labels).
 */
export function buildBusinessMessagingNav(input: BusinessMessagingNavEntitlements): NavItem[] {
  const badge = input.inboxBadge ?? 0;
  const items: NavItem[] = [
    {
      label: "Overview",
      href: BUSINESS_MESSAGING_OVERVIEW_HREF,
      icon: LayoutDashboard,
      matchExact: true,
      sectionLabel: "Workspace",
    },
    {
      label: "Inbox",
      href: INBOX_TAB_ROUTES.conversations,
      icon: Inbox,
      badge: badge > 0 ? badge : undefined,
    },
    {
      label: "Contacts",
      href: "/contacts",
      icon: Contact,
    },
  ];

  items.push(
    {
      label: "Missed Call Text Back",
      href: MCTB_ROUTES.home,
      icon: PhoneMissed,
      sectionLabel: "Services",
      badge: input.hasMctb ? undefined : "Activate",
    },
    {
      label: "Appointment Reminders",
      href: AR_ROUTES.home,
      icon: CalendarClock,
      badge: input.hasAppointmentReminders ? undefined : "Activate",
    },
    {
      label: "Campaigns",
      href: "/campaigns",
      icon: Megaphone,
      badge: input.hasMassSms ? undefined : "Activate",
    },
    {
      label: "Reviews",
      href: REVIEW_ROUTES.overview,
      icon: Star,
      badge: input.hasReviews === false ? "Activate" : undefined,
      children: [...REVIEWS_SIDEBAR_CHILDREN],
    },
    {
      label: "AI Voice Agent",
      href: MCTB_ROUTES.voiceAgent,
      icon: AudioLines,
    },
  );

  items.push(
    {
      label: "Integrations",
      href: "/integrations",
      icon: Puzzle,
      sectionLabel: "Manage",
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
    },
  );

  return items;
}

/** Sidebar active state for unified nav (Inbox spans multiple routes). */
export function isBusinessMessagingNavItemActive(
  pathname: string,
  search: string,
  item: NavItem,
): boolean {
  const path = pathname.split("?")[0];
  if (item.label === "Inbox") {
    return isInboxWorkspacePath(path);
  }
  if (item.label === "Overview") {
    return path === BUSINESS_MESSAGING_OVERVIEW_HREF;
  }
  if (item.label === "Missed Call Text Back") {
    if (isInboxWorkspacePath(path)) return false;
    return path === MCTB_ROUTES.home || path.startsWith("/mctb/");
  }
  if (item.label === "Appointment Reminders") {
    if (isInboxWorkspacePath(path)) return false;
    return path === AR_ROUTES.home || path.startsWith("/appointment-reminders/");
  }
  if (item.label === "Campaigns") {
    return (
      path === "/campaigns" ||
      path.startsWith("/campaigns/") ||
      path.startsWith("/templates") ||
      path.startsWith("/sms/analytics")
    );
  }
  if (item.label === "Reviews") {
    return path === REVIEW_ROUTES.home || path.startsWith("/reviews/");
  }
  if (item.label === "AI Voice Agent") {
    return (
      path === MCTB_ROUTES.voiceAgent ||
      path.startsWith(`${MCTB_ROUTES.voiceAgent}/`) ||
      path === "/voice" ||
      path.startsWith("/voice/")
    );
  }
  if (item.href.includes("?")) {
    const query = item.href.split("?")[1] ?? "";
    return path === item.href.split("?")[0] && search.includes(query);
  }
  if (item.matchExact) return path === item.href;
  return path === item.href || path.startsWith(`${item.href}/`);
}

export function isBusinessMessagingSharedShellPath(pathname: string): boolean {
  if (pathname === BUSINESS_MESSAGING_OVERVIEW_HREF) return true;
  if (pathname === "/conversations" || pathname.startsWith("/conversations/")) return true;
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) return true;
  if (pathname === "/contacts" || pathname.startsWith("/contacts/")) return true;
  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/")) return true;
  if (pathname === "/templates" || pathname.startsWith("/templates/")) return true;
  if (pathname === "/sms/analytics" || pathname.startsWith("/sms/analytics/")) return true;
  if (pathname === REVIEW_ROUTES.home || pathname.startsWith("/reviews/")) return true;
  if (pathname === MCTB_ROUTES.voiceAgent || pathname.startsWith(`${MCTB_ROUTES.voiceAgent}/`)) {
    return true;
  }
  if (pathname === "/voice" || pathname.startsWith("/voice/")) return true;
  return false;
}

export function shouldShowReviewsServiceTabs(pathname: string): boolean {
  if (!pathname.startsWith("/reviews")) return false;
  if (pathname.startsWith("/reviews/messaging")) return false;
  return true;
}

export function buildBusinessMessagingMobileNav(input: BusinessMessagingNavEntitlements): NavItem[] {
  const badge = input.inboxBadge ?? 0;
  return [
    { label: "Home", href: BUSINESS_MESSAGING_OVERVIEW_HREF, icon: LayoutDashboard },
    {
      label: "Inbox",
      href: INBOX_TAB_ROUTES.conversations,
      icon: Inbox,
      badge: badge > 0 ? badge : undefined,
    },
    {
      label: "Services",
      href: MCTB_ROUTES.home,
      icon: PhoneMissed,
    },
    { label: "Contacts", href: "/contacts", icon: Contact },
  ];
}
