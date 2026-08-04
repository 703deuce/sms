/**
 * Solutions Dashboard data shaped to the control-center mockup.
 * Values mirror the reference composition for pixel-parity.
 */

import { outcomeHref } from "@/lib/outcomes/registry";

export type FeaturedBadge = "active" | "recommended" | "new" | "hot";

export type FeaturedSolutionCard = {
  slug: string;
  title: string;
  badge: FeaturedBadge;
  badgeLabel: string;
  metricPrimary: string;
  metricSecondary: string;
  actionLabel: string;
  href: string;
  icon:
    | "phone-missed"
    | "moon"
    | "calendar"
    | "mail"
    | "welcome"
    | "reactivate";
  iconTone: string;
};

export type ActiveSolutionRow = {
  id: string;
  label: string;
  description: string;
  icon: "phone-missed" | "moon" | "calendar" | "mail" | "sparkles";
  iconTone: string;
  href: string;
};

export type StatisticRow = {
  id: string;
  service: string;
  update: string;
  trendTone: "up" | "down";
  lastActivity: string;
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
  description: string;
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
        title: "Catch Missed Call",
        badge: "active",
        badgeLabel: "Active",
        metricPrimary: "12 Call",
        metricSecondary: "30 Min",
        actionLabel: "Set up",
        href: outcomeHref("missed-overflow", "setup"),
        icon: "phone-missed",
        iconTone: "bg-violet-500",
      },
      {
        slug: "after-hours",
        title: "Handle After Hours",
        badge: "recommended",
        badgeLabel: "Recommended",
        metricPrimary: "8 Call",
        metricSecondary: "45 Min",
        actionLabel: "Set up",
        href: outcomeHref("after-hours", "setup"),
        icon: "moon",
        iconTone: "bg-indigo-600",
      },
      {
        slug: "appointment-booking",
        title: "Book Appointments",
        badge: "new",
        badgeLabel: "New",
        metricPrimary: "5 Book",
        metricSecondary: "12 Min",
        actionLabel: "View",
        href: outcomeHref("appointment-booking"),
        icon: "calendar",
        iconTone: "bg-emerald-500",
      },
      {
        slug: "instant-lead-response",
        title: "Respond to New Inquiries",
        badge: "active",
        badgeLabel: "Active",
        metricPrimary: "20 SMS",
        metricSecondary: "5 Min",
        actionLabel: "Set up",
        href: outcomeHref("instant-lead-response", "setup"),
        icon: "mail",
        iconTone: "bg-sky-500",
      },
      {
        slug: "review-requests",
        title: "Get More Reviews",
        badge: "hot",
        badgeLabel: "Hot",
        metricPrimary: "4 Ask",
        metricSecondary: "2 Min",
        actionLabel: "Set up",
        href: outcomeHref("review-requests", "setup"),
        icon: "welcome",
        iconTone: "bg-amber-500",
      },
      {
        slug: "customer-reactivation",
        title: "Win Back Past Plans",
        badge: "new",
        badgeLabel: "New",
        metricPrimary: "6 Win",
        metricSecondary: "15 Min",
        actionLabel: "View",
        href: outcomeHref("customer-reactivation"),
        icon: "reactivate",
        iconTone: "bg-emerald-500",
      },
    ],
    activeSolutions: [
      {
        id: "missed",
        label: "Catch Missed Call",
        description: "AI covers overflow when your team is busy.",
        icon: "phone-missed",
        iconTone: "bg-violet-100 text-violet-600",
        href: outcomeHref("missed-overflow"),
      },
      {
        id: "after-hours",
        label: "Handle After Hours",
        description: "Auto-answer and capture leads overnight.",
        icon: "moon",
        iconTone: "bg-indigo-100 text-indigo-600",
        href: outcomeHref("after-hours"),
      },
      {
        id: "book",
        label: "Book Appointments",
        description: "Schedule callers straight onto your calendar.",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
        href: outcomeHref("appointment-booking"),
      },
    ],
    statistics: [
      {
        id: "1",
        service: "Catch Missed Call",
        update: "+12%",
        trendTone: "up",
        lastActivity: "2m ago",
      },
      {
        id: "2",
        service: "Book Appointments",
        update: "+5%",
        trendTone: "up",
        lastActivity: "18m ago",
      },
      {
        id: "3",
        service: "Respond to Inquiries",
        update: "-2%",
        trendTone: "down",
        lastActivity: "1h ago",
      },
    ],
    activity: [
      {
        id: "1",
        title: "Missed call from +1 234 567 8901",
        when: "4:15 PM",
        href: outcomeHref("missed-overflow"),
        icon: "phone",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        id: "2",
        title: "New inquiry from Sarah Smith",
        when: "3:42 PM",
        href: "/integrations/native/leads",
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
      },
      {
        id: "3",
        title: "Appointment booked with Dr. Miller",
        when: "2:00 PM",
        href: "/integrations/native/appointments",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
      {
        id: "4",
        title: "5-star review from John Doe",
        when: "1:18 PM",
        href: outcomeHref("review-requests"),
        icon: "star",
        iconTone: "bg-amber-100 text-amber-600",
      },
    ],
    recommended: [
      {
        slug: "appointment-reminders",
        title: "Appointment Reminders",
        description: "Cut no-shows with timed SMS reminders.",
        href: outcomeHref("appointment-reminders"),
        icon: "clock",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        slug: "missed-call-text-back",
        title: "Follow Up on Missed",
        description: "Text back anyone who didn’t reach you.",
        href: outcomeHref("missed-call-text-back"),
        icon: "phone-missed",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
      {
        slug: "customer-reactivation",
        title: "Bring Back Old Customers",
        description: "Re-engage quiet patients with a warm offer.",
        href: outcomeHref("customer-reactivation"),
        icon: "users",
        iconTone: "bg-amber-100 text-amber-600",
      },
    ],
    weekStats: [
      {
        label: "Calls Handled",
        value: 12,
        deltaLabel: "+12% last 7 days",
        deltaTone: "up",
        icon: "phone",
        iconTone: "bg-violet-100 text-violet-500",
      },
      {
        label: "Appointments Booked",
        value: 5,
        deltaLabel: "+5% last 7 days",
        deltaTone: "up",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-500",
      },
      {
        label: "New Leads Captured",
        value: 7,
        deltaLabel: "+10% last 7 days",
        deltaTone: "up",
        icon: "sparkles",
        iconTone: "bg-sky-100 text-sky-500",
      },
      {
        label: "Reviews Collected",
        value: 4,
        deltaLabel: "+2% last 7 days",
        deltaTone: "up",
        icon: "star",
        iconTone: "bg-amber-100 text-amber-500",
      },
    ],
  };
}
