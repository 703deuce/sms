/**
 * Solutions Dashboard data shaped to the latest control-center mockup.
 * Values mirror the reference composition for pixel-parity.
 */

import { outcomeHref } from "@/lib/outcomes/registry";

export type FeaturedBadge = "runs" | "active" | "draft";

export type FeaturedSolutionCard = {
  slug: string;
  title: string;
  description: string;
  badge: FeaturedBadge;
  badgeLabel: string;
  metricPrimary: string;
  metricSecondary: string;
  actionLabel: string;
  actionTone: "primary" | "outline";
  href: string;
  icon: "phone-missed" | "moon" | "calendar" | "welcome" | "sparkles" | "reactivate";
  iconTone: string;
};

export type ActionNeededItem = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

export type ActiveSolutionRow = {
  id: string;
  label: string;
  sparkline: number[];
  status: "active" | "draft" | "running";
  statusLabel: string;
  href: string;
};

export type ActivityRow = {
  id: string;
  title: string;
  when: string;
  href: string;
};

export type RecommendedCard = {
  slug: string;
  title: string;
  href: string;
  icon: "clock" | "phone-missed" | "users";
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
  actionNeeded: ActionNeededItem[];
  activeSolutions: ActiveSolutionRow[];
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
        title: "Catch Missed Calls",
        description:
          "Never miss a customer again. Automatically answer and log calls.",
        badge: "runs",
        badgeLabel: "125 Runs",
        metricPrimary: "12 Today",
        metricSecondary: "98% Success",
        actionLabel: "Manage",
        actionTone: "outline",
        href: outcomeHref("missed-overflow"),
        icon: "phone-missed",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        slug: "after-hours",
        title: "Capture Leads After Hours",
        description:
          "Engage visitors when your team is away with smart auto-responses.",
        badge: "runs",
        badgeLabel: "240 Runs",
        metricPrimary: "22 Today",
        metricSecondary: "96.5% Success",
        actionLabel: "Manage",
        actionTone: "outline",
        href: outcomeHref("after-hours"),
        icon: "moon",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        slug: "appointment-booking",
        title: "Book Appointments",
        description:
          "AI-powered scheduling that syncs directly with your calendar.",
        badge: "active",
        badgeLabel: "Active",
        metricPrimary: "105 Monthly",
        metricSecondary: "5 Today",
        actionLabel: "View",
        actionTone: "outline",
        href: outcomeHref("appointment-booking"),
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
      {
        slug: "client-onboarding",
        title: "Welcome & Wow Customers",
        description:
          "Send personalized onboarding messages to new clients automatically.",
        badge: "runs",
        badgeLabel: "58 Runs",
        metricPrimary: "88 Total",
        metricSecondary: "5 Today",
        actionLabel: "View",
        actionTone: "outline",
        href: outcomeHref("client-onboarding"),
        icon: "welcome",
        iconTone: "bg-sky-100 text-sky-600",
      },
      {
        slug: "instant-lead-response",
        title: "Nurture New Leads",
        description:
          "Automatic follow-ups to turn interested visitors into paying customers.",
        badge: "draft",
        badgeLabel: "Draft",
        metricPrimary: "88 Total",
        metricSecondary: "5 Today",
        actionLabel: "Edit",
        actionTone: "outline",
        href: outcomeHref("instant-lead-response", "setup"),
        icon: "sparkles",
        iconTone: "bg-amber-100 text-amber-600",
      },
      {
        slug: "customer-reactivation",
        title: "Win Back Lost Leads",
        description:
          "Re-engage customers who haven't interacted in a while.",
        badge: "active",
        badgeLabel: "Active",
        metricPrimary: "88 Total",
        metricSecondary: "5 Today",
        actionLabel: "Manage",
        actionTone: "primary",
        href: outcomeHref("customer-reactivation"),
        icon: "reactivate",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
    ],
    actionNeeded: [
      {
        id: "testimonials",
        title: "Collect Testimonials",
        description: "Complete your campaign setup to start collecting reviews.",
        actionLabel: "Configure",
        href: outcomeHref("review-requests", "setup"),
      },
      {
        id: "appointment",
        title: "New Appointment Pending",
        description: "A customer requested a slot and is waiting for confirmation.",
        actionLabel: "Confirm",
        href: "/integrations/native/appointments",
      },
      {
        id: "balance",
        title: "Low Account Balance",
        description: "Your SMS credits are running low — top up to stay live.",
        actionLabel: "Add Credits",
        href: "/settings/billing",
      },
    ],
    activeSolutions: [
      {
        id: "missed",
        label: "Catch Missed Calls",
        sparkline: [4, 8, 6, 10, 7, 12, 9, 14, 11, 13],
        status: "active",
        statusLabel: "Active",
        href: outcomeHref("missed-overflow"),
      },
      {
        id: "nurture",
        label: "Nurture New Leads",
        sparkline: [2, 3, 5, 4, 6, 5, 7, 6, 8, 7],
        status: "draft",
        statusLabel: "Draft",
        href: outcomeHref("instant-lead-response"),
      },
      {
        id: "book",
        label: "Book Appointments",
        sparkline: [6, 9, 8, 12, 10, 14, 11, 15, 13, 16],
        status: "running",
        statusLabel: "Running",
        href: outcomeHref("appointment-booking"),
      },
    ],
    activity: [
      {
        id: "1",
        title: "Missed Call Back - 555-0123 handled",
        when: "5m ago",
        href: outcomeHref("missed-overflow"),
      },
      {
        id: "2",
        title: "Lead Captured - Sarah Smith (Facebook)",
        when: "12m ago",
        href: "/integrations/native/leads",
      },
      {
        id: "3",
        title: "Appointment Booked - Dr. Miller (2:00 PM)",
        when: "1hr ago",
        href: "/integrations/native/appointments",
      },
      {
        id: "4",
        title: "Review Received - 5 stars (John Doe)",
        when: "2hr ago",
        href: outcomeHref("review-requests"),
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
        slug: "missed-call-text-back",
        title: "Follow Up on Missed",
        href: outcomeHref("missed-call-text-back"),
        icon: "phone-missed",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
      {
        slug: "customer-reactivation",
        title: "Bring Back Old Customers",
        href: outcomeHref("customer-reactivation"),
        icon: "users",
        iconTone: "bg-orange-100 text-orange-600",
      },
    ],
    weekStats: [
      {
        label: "Calls Answered",
        value: 12,
        deltaLabel: "+15% from last week",
        deltaTone: "up",
        icon: "phone",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        label: "Appointments Booked",
        value: 5,
        deltaLabel: "+5% from last week",
        deltaTone: "up",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
      {
        label: "New Leads Captured",
        value: 7,
        deltaLabel: "+10% from last week",
        deltaTone: "up",
        icon: "sparkles",
        iconTone: "bg-sky-100 text-sky-600",
      },
      {
        label: "Reviews Collected",
        value: 4,
        deltaLabel: "+2% from last week",
        deltaTone: "up",
        icon: "star",
        iconTone: "bg-orange-100 text-orange-600",
      },
    ],
  };
}
