/**
 * Solutions Dashboard data shaped to the control-center mockup.
 * Values mirror the reference composition for pixel-parity.
 */

import { outcomeHref } from "@/lib/outcomes/registry";

export type FeaturedBadge = "working" | "ready" | "active" | "draft";

export type FeaturedSolutionCard = {
  slug: string;
  title: string;
  description: string;
  badge: FeaturedBadge;
  badgeLabel: string;
  metricPrimary: string;
  metricSecondary: string;
  actionLabel: string;
  href: string;
  icon: "phone-missed" | "moon" | "calendar" | "mail" | "star" | "welcome";
  iconTone: string;
};

export type AttentionItem = {
  id: string;
  title: string;
  tone: "danger" | "warning" | "caution";
  icon: "calendar" | "sms" | "balance";
  actionLabel: string;
  href: string;
};

export type ActiveSolutionRow = {
  id: string;
  label: string;
  countLabel: string;
  progress: number;
  icon: "calendar" | "moon" | "star";
  iconTone: string;
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
  icon: "calendar" | "mail" | "users";
  iconTone: string;
};

export type WeekStat = {
  label: string;
  value: number;
  deltaLabel: string;
  deltaTone: "up" | "down" | "flat";
  icon: "phone" | "calendar" | "users" | "star";
};

export type SolutionsDashboardData = {
  featured: FeaturedSolutionCard[];
  attention: AttentionItem[];
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
        title: "Cover Missed Calls",
        description:
          "Let your team answer first, then have AI step in when nobody picks up.",
        badge: "working",
        badgeLabel: "Working",
        metricPrimary: "12 Calls",
        metricSecondary: "0 SMS",
        actionLabel: "Setup",
        href: outcomeHref("missed-overflow"),
        icon: "phone-missed",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        slug: "after-hours",
        title: "Answer After Hours",
        description:
          "Automatically handle calls that come in when you're closed.",
        badge: "ready",
        badgeLabel: "Ready to Start",
        metricPrimary: "0 Calls",
        metricSecondary: "Set Hours",
        actionLabel: "Set up",
        href: outcomeHref("after-hours", "setup"),
        icon: "moon",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        slug: "appointment-booking",
        title: "Book Appointments",
        description:
          "Your AI receptionist can check availability and schedule callers.",
        badge: "active",
        badgeLabel: "Active",
        metricPrimary: "5 Booked",
        metricSecondary: "12 SMS",
        actionLabel: "Manage",
        href: outcomeHref("appointment-booking"),
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
      {
        slug: "instant-lead-response",
        title: "Respond to New Inquiries",
        description: "Instantly reply to website forms and new inquiries.",
        badge: "working",
        badgeLabel: "Working",
        metricPrimary: "20 SMS",
        metricSecondary: "11 Voice",
        actionLabel: "Setup",
        href: outcomeHref("instant-lead-response"),
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
      },
      {
        slug: "review-requests",
        title: "Get More Reviews",
        description: "Ask happy customers for Google and Facebook reviews.",
        badge: "draft",
        badgeLabel: "Draft",
        metricPrimary: "0 SMS",
        metricSecondary: "0 Links",
        actionLabel: "Set up",
        href: outcomeHref("review-requests", "setup"),
        icon: "star",
        iconTone: "bg-amber-100 text-amber-600",
      },
      {
        slug: "client-onboarding",
        title: "Welcome New Customers",
        description:
          "Send welcome messages, collect information, and schedule next steps.",
        badge: "active",
        badgeLabel: "Active",
        metricPrimary: "4 Sent",
        metricSecondary: "",
        actionLabel: "Manage",
        href: outcomeHref("client-onboarding"),
        icon: "welcome",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
    ],
    attention: [
      {
        id: "calendar",
        title: "Calendar Disconnected",
        tone: "danger",
        icon: "calendar",
        actionLabel: "Reconnect",
        href: "/voice/calendars",
      },
      {
        id: "opt-in",
        title: "SMS Opt-In Missing",
        tone: "warning",
        icon: "sms",
        actionLabel: "Fix Now",
        href: "/compliance/consent",
      },
      {
        id: "balance",
        title: "Low Balance",
        tone: "caution",
        icon: "balance",
        actionLabel: "Fix Now",
        href: "/settings/billing",
      },
    ],
    activeSolutions: [
      {
        id: "book",
        label: "Book Appointments",
        countLabel: "7 events",
        progress: 70,
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
        href: outcomeHref("appointment-booking"),
      },
      {
        id: "after-hours",
        label: "Answer After Hours",
        countLabel: "12 calls",
        progress: 55,
        icon: "moon",
        iconTone: "bg-violet-100 text-violet-600",
        href: outcomeHref("after-hours"),
      },
      {
        id: "reviews",
        label: "Get More Reviews",
        countLabel: "4 reviews",
        progress: 35,
        icon: "star",
        iconTone: "bg-amber-100 text-amber-600",
        href: outcomeHref("review-requests"),
      },
    ],
    activity: [
      {
        id: "1",
        title: "Appointment scheduled - John Smith",
        when: "2m ago",
        href: "/integrations/native/appointments",
      },
      {
        id: "2",
        title: "New inquiry from Sarah J",
        when: "18m ago",
        href: "/integrations/native/leads",
      },
      {
        id: "3",
        title: "Review received - Dave Wilson",
        when: "41m ago",
        href: outcomeHref("review-requests"),
      },
    ],
    recommended: [
      {
        slug: "appointment-reminders",
        title: "Appointment Reminders",
        href: outcomeHref("appointment-reminders"),
        icon: "calendar",
        iconTone: "bg-violet-100 text-violet-600",
      },
      {
        slug: "estimate-follow-up",
        title: "Follow Up on Estimates",
        href: outcomeHref("estimate-follow-up"),
        icon: "mail",
        iconTone: "bg-sky-100 text-sky-600",
      },
      {
        slug: "customer-reactivation",
        title: "Bring Back Past Customers",
        href: outcomeHref("customer-reactivation"),
        icon: "users",
        iconTone: "bg-emerald-100 text-emerald-600",
      },
    ],
    weekStats: [
      {
        label: "Total Calls Today",
        value: 12,
        deltaLabel: "+2 from yesterday",
        deltaTone: "up",
        icon: "phone",
      },
      {
        label: "Appointments Booked",
        value: 5,
        deltaLabel: "+1 from yesterday",
        deltaTone: "up",
        icon: "calendar",
      },
      {
        label: "New Inquiries Received",
        value: 7,
        deltaLabel: "-2 from yesterday",
        deltaTone: "down",
        icon: "users",
      },
      {
        label: "Customer Reviews",
        value: 4,
        deltaLabel: "0 from yesterday",
        deltaTone: "flat",
        icon: "star",
      },
    ],
  };
}
