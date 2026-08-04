/**
 * Solutions Dashboard data shaped to the control-center mockup.
 * Values mirror the reference composition for pixel-parity.
 */

import { outcomeHref } from "@/lib/outcomes/registry";

export type FeaturedBadge =
  | "running"
  | "active"
  | "recommended"
  | "new"
  | "hot";

export type FeaturedSolutionCard = {
  slug: string;
  title: string;
  description: string;
  badge: FeaturedBadge;
  badgeLabel: string;
  metricPrimary: string;
  metricSecondary: string;
  metricLinkLabel?: string;
  metricLinkHref?: string;
  actionLabel: string;
  href: string;
  icon:
    | "phone-missed"
    | "moon"
    | "calendar"
    | "mail"
    | "welcome"
    | "reactivate"
    | "star";
  iconTone: string;
};

export type ActiveSolutionRow = {
  id: string;
  label: string;
  description?: string;
  icon: "phone-missed" | "moon" | "calendar" | "mail" | "sparkles" | "star";
  iconTone: string;
  href: string;
};

export type StatisticRow = {
  id: string;
  service: string;
  value: string;
  update: string;
  trendTone: "up" | "down";
  href?: string;
};

export type ActivityRow = {
  id: string;
  title: string;
  when: string;
  href: string;
  icon: "phone" | "mail" | "calendar" | "star";
  iconTone: string;
};

export type RecommendedCard = {
  slug: string;
  title: string;
  description?: string;
  badge?: FeaturedBadge;
  badgeLabel?: string;
  href: string;
  icon: "clock" | "phone-missed" | "users" | "mail";
  iconTone: string;
};

export type WeekStat = {
  label: string;
  value: number;
  deltaLabel: string;
  deltaTone: "up" | "down" | "flat";
  icon: "phone" | "calendar" | "sparkles" | "star";
  iconTone: string;
};

export type SolutionsDashboardData = {
  featured: FeaturedSolutionCard[];
  activeSolutions: ActiveSolutionRow[];
  statistics: StatisticRow[];
  activity: ActivityRow[];
  recommended: RecommendedCard[];
  weekStats: WeekStat[];
};

/** Exact mockup composition — not live-derived. */
export async function loadSolutionsDashboardData(
  _workspaceId: string,
): Promise<SolutionsDashboardData> {
  return {
    featured: [
      {
        slug: "missed-overflow",
        title: "Cover Missed Calls",
        description: "Let AI step in when your team can’t answer.",
        badge: "running",
        badgeLabel: "Running",
        metricPrimary: "78 Total",
        metricSecondary: "",
        metricLinkLabel: "Buy Phone",
        metricLinkHref: "/numbers",
        actionLabel: "Open",
        href: outcomeHref("missed-overflow"),
        icon: "phone-missed",
        iconTone: "bg-violet-500",
      },
      {
        slug: "after-hours",
        title: "Answer After Hours",
        description: "Handle nights and weekends automatically.",
        badge: "recommended",
        badgeLabel: "Recommended",
        metricPrimary: "12 Total",
        metricSecondary: "",
        metricLinkLabel: "Set Hours",
        metricLinkHref: outcomeHref("after-hours", "hours"),
        actionLabel: "Set up",
        href: outcomeHref("after-hours", "setup"),
        icon: "moon",
        iconTone: "bg-indigo-600",
      },
      {
        slug: "appointment-booking",
        title: "Book Appointments",
        description: "Schedule callers directly onto your calendar.",
        badge: "active",
        badgeLabel: "Active",
        metricPrimary: "5 Booked",
        metricSecondary: "12 SMS",
        actionLabel: "Open",
        href: outcomeHref("appointment-booking"),
        icon: "calendar",
        iconTone: "bg-emerald-500",
      },
      {
        slug: "instant-lead-response",
        title: "Respond to New Inquiries",
        description: "Reply instantly to forms and new leads.",
        badge: "running",
        badgeLabel: "Running",
        metricPrimary: "20 SMS",
        metricSecondary: "11 Voice",
        actionLabel: "Open",
        href: outcomeHref("instant-lead-response"),
        icon: "mail",
        iconTone: "bg-sky-500",
      },
      {
        slug: "review-requests",
        title: "Get More Reviews",
        description: "Ask happy customers for Google reviews.",
        badge: "recommended",
        badgeLabel: "Recommended",
        metricPrimary: "4 Sent",
        metricSecondary: "",
        metricLinkLabel: "Add Profile",
        metricLinkHref: outcomeHref("review-requests", "setup"),
        actionLabel: "Set up",
        href: outcomeHref("review-requests", "setup"),
        icon: "star",
        iconTone: "bg-amber-500",
      },
      {
        slug: "customer-reactivation",
        title: "Bring Back Past Customers",
        description: "Re-engage customers who haven’t returned.",
        badge: "active",
        badgeLabel: "Active",
        metricPrimary: "6 Won",
        metricSecondary: "2 Booked",
        actionLabel: "Open",
        href: outcomeHref("customer-reactivation"),
        icon: "reactivate",
        iconTone: "bg-emerald-500",
      },
    ],
    activeSolutions: [
      {
        id: "missed",
        label: "Cover Missed Calls",
        icon: "phone-missed",
        iconTone: "bg-violet-100 text-violet-600",
        href: outcomeHref("missed-overflow"),
      },
      {
        id: "after-hours",
        label: "Answer After Hours",
        icon: "moon",
        iconTone: "bg-indigo-100 text-indigo-600",
        href: outcomeHref("after-hours"),
      },
      {
        id: "book",
        label: "Book Appointments",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
        href: outcomeHref("appointment-booking"),
      },
      {
        id: "inquiries",
        label: "Respond to New Inquiries",
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
        href: outcomeHref("instant-lead-response"),
      },
      {
        id: "reviews",
        label: "Get More Reviews",
        icon: "star",
        iconTone: "bg-amber-100 text-amber-600",
        href: outcomeHref("review-requests"),
      },
      {
        id: "reactivate",
        label: "Bring Back Past Customers",
        icon: "sparkles",
        iconTone: "bg-emerald-100 text-emerald-600",
        href: outcomeHref("customer-reactivation"),
      },
    ],
    statistics: [
      {
        id: "1",
        service: "Calls this week",
        value: "131",
        update: "↑ 7%",
        trendTone: "up",
        href: "/voice/analytics",
      },
      {
        id: "2",
        service: "New leads",
        value: "7",
        update: "↑ 5%",
        trendTone: "up",
        href: "/integrations/native/leads",
      },
      {
        id: "3",
        service: "Appointments booked",
        value: "5",
        update: "↓ 2%",
        trendTone: "down",
        href: "/integrations/native/appointments",
      },
    ],
    activity: [
      {
        id: "1",
        title: "James Booked",
        when: "12:44 pm",
        href: "/integrations/native/appointments",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
      {
        id: "2",
        title: "Call missed",
        when: "12:31 pm",
        href: outcomeHref("missed-overflow"),
        icon: "phone",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        id: "3",
        title: "New inquiry captured",
        when: "11:58 am",
        href: "/integrations/native/leads",
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
      },
      {
        id: "4",
        title: "Review received",
        when: "10:12 am",
        href: outcomeHref("review-requests"),
        icon: "star",
        iconTone: "bg-amber-100 text-amber-600",
      },
    ],
    recommended: [
      {
        slug: "appointment-reminders",
        title: "Appointment Reminders",
        badge: "recommended",
        badgeLabel: "Recommended",
        href: outcomeHref("appointment-reminders"),
        icon: "clock",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        slug: "estimate-follow-up",
        title: "Follow Up on Estimates",
        badge: "new",
        badgeLabel: "New",
        href: outcomeHref("estimate-follow-up"),
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
      },
      {
        slug: "customer-reactivation",
        title: "Bring Back Past Customers",
        badge: "hot",
        badgeLabel: "Hot",
        href: outcomeHref("customer-reactivation"),
        icon: "users",
        iconTone: "bg-amber-100 text-amber-600",
      },
    ],
    weekStats: [
      {
        label: "Calls Handled",
        value: 131,
        deltaLabel: "7% since yesterday",
        deltaTone: "up",
        icon: "phone",
        iconTone: "bg-violet-100 text-violet-500",
      },
      {
        label: "Appts Booked",
        value: 5,
        deltaLabel: "5% since yesterday",
        deltaTone: "up",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-500",
      },
      {
        label: "New Inquiries",
        value: 7,
        deltaLabel: "3% since yesterday",
        deltaTone: "up",
        icon: "sparkles",
        iconTone: "bg-sky-100 text-sky-500",
      },
      {
        label: "Leads Won",
        value: 4,
        deltaLabel: "2% since yesterday",
        deltaTone: "up",
        icon: "star",
        iconTone: "bg-amber-100 text-amber-500",
      },
    ],
  };
}
