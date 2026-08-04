/**
 * Solutions Dashboard data shaped to the control-center mockup.
 * Values mirror the reference composition for pixel-parity.
 */

import { outcomeHref } from "@/lib/outcomes/registry";

export type FeaturedBadge =
  | "voice"
  | "automated"
  | "new"
  | "running"
  | "active"
  | "recommended"
  | "hot";

export type FeaturedSolutionCard = {
  slug: string;
  title: string;
  description: string;
  badge: FeaturedBadge;
  badgeLabel: string;
  channelLabel: string;
  actionLabel: string;
  actionVariant: "primary" | "outline";
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

export type TopActiveRow = {
  id: string;
  label: string;
  status: string;
  date: string;
  href: string;
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
  href: string;
  icon: "clock" | "phone-missed" | "users" | "mail";
  iconTone: string;
};

export type WeekStat = {
  label: string;
  value: number;
  icon: "phone" | "calendar" | "sparkles" | "star";
  iconTone: string;
};

export type SolutionsDashboardData = {
  featured: FeaturedSolutionCard[];
  activeSolutions: ActiveSolutionRow[];
  topActive: TopActiveRow[];
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
        badge: "voice",
        badgeLabel: "AI Voice",
        channelLabel: "AI Voice",
        actionLabel: "Setup",
        actionVariant: "outline",
        href: outcomeHref("missed-overflow", "setup"),
        icon: "phone-missed",
        iconTone: "bg-violet-500",
      },
      {
        slug: "after-hours",
        title: "Answer After Hours",
        description: "Handle nights and weekends automatically.",
        badge: "voice",
        badgeLabel: "AI Voice",
        channelLabel: "AI Voice",
        actionLabel: "Setup",
        actionVariant: "outline",
        href: outcomeHref("after-hours", "setup"),
        icon: "moon",
        iconTone: "bg-indigo-600",
      },
      {
        slug: "appointment-booking",
        title: "Book Appointments",
        description: "Schedule callers directly onto your calendar.",
        badge: "automated",
        badgeLabel: "Automated",
        channelLabel: "AI Voice",
        actionLabel: "Edit",
        actionVariant: "outline",
        href: outcomeHref("appointment-booking"),
        icon: "calendar",
        iconTone: "bg-emerald-500",
      },
      {
        slug: "missed-call-text-back",
        title: "Missed Call Text Back",
        description: "Text every missed caller automatically.",
        badge: "automated",
        badgeLabel: "Automated",
        channelLabel: "SMS",
        actionLabel: "Setup",
        actionVariant: "primary",
        href: outcomeHref("missed-call-text-back", "setup"),
        icon: "mail",
        iconTone: "bg-sky-500",
      },
      {
        slug: "review-requests",
        title: "Get More Reviews",
        description: "Ask happy customers for Google reviews.",
        badge: "new",
        badgeLabel: "New",
        channelLabel: "SMS",
        actionLabel: "Setup",
        actionVariant: "outline",
        href: outcomeHref("review-requests", "setup"),
        icon: "star",
        iconTone: "bg-amber-500",
      },
      {
        slug: "customer-reactivation",
        title: "Bring Back Past Customers",
        description: "Re-engage customers who haven’t returned.",
        badge: "automated",
        badgeLabel: "Automated",
        channelLabel: "SMS",
        actionLabel: "Edit",
        actionVariant: "outline",
        href: outcomeHref("customer-reactivation"),
        icon: "reactivate",
        iconTone: "bg-emerald-500",
      },
    ],
    activeSolutions: [
      {
        id: "booking",
        label: "Online Booking Kit",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
        href: outcomeHref("appointment-booking"),
      },
      {
        id: "missed",
        label: "Cover Missed Calls",
        icon: "phone-missed",
        iconTone: "bg-violet-100 text-violet-600",
        href: outcomeHref("missed-overflow"),
      },
      {
        id: "textback",
        label: "Missed Call Text Back",
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
        href: outcomeHref("missed-call-text-back"),
      },
      {
        id: "reviews",
        label: "Get More Reviews",
        icon: "star",
        iconTone: "bg-amber-100 text-amber-600",
        href: outcomeHref("review-requests"),
      },
    ],
    topActive: [
      {
        id: "1",
        label: "After Hours Voice",
        status: "Active",
        date: "Jan 12",
        href: outcomeHref("after-hours"),
      },
      {
        id: "2",
        label: "Main Office Booking",
        status: "Active",
        date: "Jan 8",
        href: outcomeHref("appointment-booking"),
      },
      {
        id: "3",
        label: "Review Requests",
        status: "Active",
        date: "Dec 22",
        href: outcomeHref("review-requests"),
      },
    ],
    activity: [
      {
        id: "1",
        title: "132 Missed Calls Saved",
        when: "2m ago",
        href: outcomeHref("missed-overflow"),
        icon: "phone",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        id: "2",
        title: "7 New Reviews Collected",
        when: "18m ago",
        href: outcomeHref("review-requests"),
        icon: "star",
        iconTone: "bg-amber-100 text-amber-600",
      },
      {
        id: "3",
        title: "5 Appointments Booked",
        when: "1h ago",
        href: "/integrations/native/appointments",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
      {
        id: "4",
        title: "4 Estimates Sent",
        when: "3h ago",
        href: outcomeHref("estimate-follow-up"),
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
      },
    ],
    recommended: [
      {
        slug: "appointment-reminders",
        title: "Appointment Reminders",
        href: outcomeHref("appointment-reminders"),
        icon: "clock",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        slug: "estimate-follow-up",
        title: "Follow Up On Estimates",
        href: outcomeHref("estimate-follow-up"),
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
      },
      {
        slug: "customer-reactivation",
        title: "Bring Back Past Customers",
        href: outcomeHref("customer-reactivation"),
        icon: "users",
        iconTone: "bg-amber-100 text-amber-600",
      },
    ],
    weekStats: [
      {
        label: "Missed Calls Saved",
        value: 132,
        icon: "phone",
        iconTone: "bg-violet-100 text-violet-500",
      },
      {
        label: "Appointments Booked",
        value: 5,
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-500",
      },
      {
        label: "New Reviews Collected",
        value: 7,
        icon: "star",
        iconTone: "bg-amber-100 text-amber-500",
      },
      {
        label: "Estimates Sent",
        value: 4,
        icon: "sparkles",
        iconTone: "bg-sky-100 text-sky-500",
      },
    ],
  };
}
