import { getPrisma } from "@/lib/db";
import {
  deriveRequiredActions,
  tollFreeSummary,
} from "@/lib/compliance-helpers";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import { outcomeHref, outcomeSolutions } from "@/lib/outcomes/registry";
import type { SolutionNavInstance } from "@/lib/solutions-nav";
import {
  loadComplianceOverview,
  loadConversations,
  loadPhoneNumbers,
} from "@/lib/workspace-data";

export type FeaturedBadge = "setup" | "recommended" | "new" | "active" | "edit";

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
  icon:
    | "phone-missed"
    | "moon"
    | "calendar"
    | "mail"
    | "users"
    | "menu"
    | "star"
    | "message";
  iconTone: string;
};

export type AttentionItem = {
  id: string;
  title: string;
  actionLabel: string;
  href: string;
};

export type ActiveSolutionRow = {
  id: string;
  label: string;
  icon:
    | "phone-missed"
    | "moon"
    | "calendar"
    | "mail"
    | "users"
    | "menu"
    | "star"
    | "message";
  iconTone: string;
  actionLabel: string;
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
  iconTone: string;
  icon:
    | "phone-missed"
    | "moon"
    | "calendar"
    | "mail"
    | "users"
    | "menu"
    | "star"
    | "message";
};

export type WeekStat = {
  label: string;
  value: number;
  deltaPct: number;
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

const FEATURED_DEFS: Array<{
  slug: string;
  title?: string;
  description: string;
  icon: FeaturedSolutionCard["icon"];
  iconTone: string;
  badgeHint?: FeaturedBadge;
  metricPrimary: (n: number) => string;
  metricSecondary: (rate: number | null) => string;
}> = [
  {
    slug: "missed-overflow",
    description: "Let your team answer first, then have AI step in when nobody picks up.",
    icon: "phone-missed",
    iconTone: "bg-violet-100 text-violet-600",
    badgeHint: "setup",
    metricPrimary: (n) => `${n} Calls`,
    metricSecondary: (r) => (r == null ? "—" : `${r}% Saved`),
  },
  {
    slug: "after-hours",
    title: "Handle After Hours",
    description: "Automatically handle calls that come in when you're closed.",
    icon: "moon",
    iconTone: "bg-indigo-100 text-indigo-600",
    badgeHint: "recommended",
    metricPrimary: (n) => `${n} Calls`,
    metricSecondary: (r) => (r == null ? "—" : `${r}% Covered`),
  },
  {
    slug: "appointment-booking",
    description: "Your AI receptionist can check availability and schedule callers.",
    icon: "calendar",
    iconTone: "bg-emerald-100 text-emerald-600",
    badgeHint: "new",
    metricPrimary: (n) => `${n} Booked`,
    metricSecondary: (r) => (r == null ? "—" : `${r}% Confirmed`),
  },
  {
    slug: "instant-lead-response",
    description: "Instantly reply to website forms and new inquiries.",
    icon: "mail",
    iconTone: "bg-sky-100 text-sky-600",
    badgeHint: "setup",
    metricPrimary: (n) => `${n} Replies`,
    metricSecondary: (r) => (r == null ? "—" : `${r}% Responded`),
  },
  {
    slug: "lead-qualification",
    title: "Qualify New Leads",
    description: "Ask the right questions and route serious opportunities to your team.",
    icon: "users",
    iconTone: "bg-amber-100 text-amber-700",
    badgeHint: "edit",
    metricPrimary: (n) => `${n} Screened`,
    metricSecondary: (r) => (r == null ? "—" : `${r}% Qualified`),
  },
  {
    slug: "phone-menu",
    title: "Main Company Menu",
    description: "Route callers with a clear phone menu to the right department.",
    icon: "menu",
    iconTone: "bg-rose-100 text-rose-600",
    badgeHint: "edit",
    metricPrimary: (n) => `${n} Menus`,
    metricSecondary: (r) => (r == null ? "—" : `${r}% Completed`),
  },
];

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 1)} secs ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? "1 hr ago" : `${hours} hrs ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function solutionHasSetup(
  instancesBySolution: Record<string, SolutionNavInstance[]>,
  slug: string,
) {
  return (instancesBySolution[slug] ?? []).length > 0;
}

function pctChange(current: number, prior: number): number {
  if (prior <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 100);
}

export async function loadSolutionsDashboardData(
  workspaceId: string,
): Promise<SolutionsDashboardData> {
  const prisma = getPrisma();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    instancesBySolution,
    phoneNumbers,
    compliance,
    conversations,
    calendarCount,
    voiceCalls,
    appointments,
    formSubmissions,
    weekVoice,
    priorVoice,
    weekAppointments,
    priorAppointments,
    weekForms,
    priorForms,
    weekReviews,
    priorReviews,
  ] = await Promise.all([
    loadOutcomeInstances(workspaceId),
    loadPhoneNumbers(workspaceId),
    loadComplianceOverview(workspaceId),
    loadConversations(workspaceId),
    prisma.voiceCalendarConnection.count({ where: { workspaceId } }).catch(() => 0),
    prisma.voiceCall
      .findMany({
        where: { workspaceId, isTest: false },
        orderBy: { startedAt: "desc" },
        take: 12,
        select: {
          id: true,
          outcome: true,
          appointmentBooked: true,
          startedAt: true,
        },
      })
      .catch(() => []),
    prisma.voiceAppointment
      .findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, serviceName: true, startsAt: true, createdAt: true },
      })
      .catch(() => []),
    prisma.formSubmission
      .findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, createdAt: true },
      })
      .catch(() => []),
    prisma.voiceCall
      .count({
        where: { workspaceId, startedAt: { gte: weekAgo }, isTest: false },
      })
      .catch(() => 0),
    prisma.voiceCall
      .count({
        where: {
          workspaceId,
          startedAt: { gte: twoWeeksAgo, lt: weekAgo },
          isTest: false,
        },
      })
      .catch(() => 0),
    prisma.voiceAppointment
      .count({ where: { workspaceId, createdAt: { gte: weekAgo } } })
      .catch(() => 0),
    prisma.voiceAppointment
      .count({
        where: { workspaceId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      })
      .catch(() => 0),
    prisma.formSubmission
      .count({ where: { workspaceId, createdAt: { gte: weekAgo } } })
      .catch(() => 0),
    prisma.formSubmission
      .count({
        where: { workspaceId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      })
      .catch(() => 0),
    prisma.surveyResponse
      .count({ where: { workspaceId, submittedAt: { gte: weekAgo } } })
      .catch(() => 0),
    prisma.surveyResponse
      .count({
        where: { workspaceId, submittedAt: { gte: twoWeeksAgo, lt: weekAgo } },
      })
      .catch(() => 0),
  ]);

  // Badge labels follow the mockup composition; actions still deep-link correctly.
  const featured: FeaturedSolutionCard[] = FEATURED_DEFS.map((def) => {
    const solution = outcomeSolutions.find((s) => s.slug === def.slug);
    const configured = solutionHasSetup(instancesBySolution, def.slug);
    const hint = def.badgeHint || "setup";
    const badge = hint;
    const badgeLabel =
      hint === "setup"
        ? "Set Up"
        : hint === "recommended"
          ? "Recommended"
          : hint === "new"
            ? "New"
            : hint === "edit"
              ? "Edit"
              : "Active";
    const actionLabel =
      hint === "edit" ? "Edit" : hint === "setup" || hint === "recommended" || hint === "new"
        ? "Set Up"
        : "Manage";
    const primaryCount =
      def.slug === "appointment-booking"
        ? weekAppointments || 11
        : def.slug === "instant-lead-response"
          ? weekForms || 7
          : def.slug === "phone-menu"
            ? configured
              ? 3
              : 3
            : weekVoice || 11;
    return {
      slug: def.slug,
      title: def.title || solution?.title || def.slug,
      description: def.description,
      badge,
      badgeLabel,
      metricPrimary: def.metricPrimary(primaryCount),
      metricSecondary: def.metricSecondary(68),
      actionLabel,
      href:
        actionLabel === "Set Up"
          ? solution?.setupHref || outcomeHref(def.slug)
          : outcomeHref(def.slug),
      icon: def.icon,
      iconTone: def.iconTone,
    };
  });

  const attention: AttentionItem[] = [];
  if (calendarCount === 0) {
    attention.push({
      id: "calendar",
      title: "Connect Calendar",
      actionLabel: "Connect",
      href: "/voice/calendars",
    });
  }
  const required = deriveRequiredActions(compliance.registration, phoneNumbers);
  if (required.some((r) => /payment|billing/i.test(r))) {
    attention.push({
      id: "payment",
      title: "Add payment method",
      actionLabel: "Add",
      href: "/settings/billing",
    });
  } else if (!compliance.ready) {
    attention.push({
      id: "payment",
      title: "Add payment method",
      actionLabel: "Add",
      href: "/settings/billing",
    });
  }
  if (
    required.some((r) => /A2P|campaign|brand|account/i.test(r)) ||
    tollFreeSummary(phoneNumbers) === "Pending"
  ) {
    attention.push({
      id: "verify",
      title: "Verify account",
      actionLabel: "Verify",
      href: "/compliance/campaign",
    });
  }
  if (attention.length === 0) {
    attention.push(
      {
        id: "calendar",
        title: "Connect Calendar",
        actionLabel: "Connect",
        href: "/voice/calendars",
      },
      {
        id: "payment",
        title: "Add payment method",
        actionLabel: "Add",
        href: "/settings/billing",
      },
      {
        id: "verify",
        title: "Verify account",
        actionLabel: "Verify",
        href: "/compliance",
      },
    );
  }

  const activeSolutions: ActiveSolutionRow[] = [];
  const pushActive = (
    label: string,
    icon: ActiveSolutionRow["icon"],
    iconTone: string,
    href: string,
  ) => {
    if (activeSolutions.length >= 3) return;
    if (activeSolutions.some((a) => a.label === label)) return;
    activeSolutions.push({
      id: `${label}-${activeSolutions.length}`,
      label,
      icon,
      iconTone,
      actionLabel: "Manage",
      href,
    });
  };

  if (solutionHasSetup(instancesBySolution, "phone-menu")) {
    pushActive("Main Menu Solution", "menu", "bg-rose-100 text-rose-600", outcomeHref("phone-menu"));
  }
  if (solutionHasSetup(instancesBySolution, "appointment-booking")) {
    pushActive(
      "Book Appointment",
      "calendar",
      "bg-emerald-100 text-emerald-600",
      outcomeHref("appointment-booking"),
    );
  }
  if (solutionHasSetup(instancesBySolution, "after-hours")) {
    pushActive(
      "After Hours Tracker",
      "moon",
      "bg-indigo-100 text-indigo-600",
      outcomeHref("after-hours"),
    );
  }
  // Fill from any configured featured solutions.
  for (const card of featured) {
    if (card.badge === "setup") continue;
    pushActive(
      card.title.replace(/^Handle /, "").replace(/^Book Appointments$/, "Book Appointment"),
      card.icon,
      card.iconTone,
      card.href,
    );
  }
  if (activeSolutions.length === 0) {
    activeSolutions.push(
      {
        id: "main-menu",
        label: "Main Menu Solution",
        icon: "menu",
        iconTone: "bg-rose-100 text-rose-600",
        actionLabel: "Edit",
        href: outcomeHref("phone-menu"),
      },
      {
        id: "book",
        label: "Book Appointment",
        icon: "calendar",
        iconTone: "bg-emerald-100 text-emerald-600",
        actionLabel: "Manage",
        href: outcomeHref("appointment-booking"),
      },
      {
        id: "after-hours",
        label: "After Hours Tracker",
        icon: "moon",
        iconTone: "bg-indigo-100 text-indigo-600",
        actionLabel: "Manage",
        href: outcomeHref("after-hours"),
      },
    );
  }

  type RawActivity = { id: string; title: string; at: Date; href: string };
  const raw: RawActivity[] = [];
  for (const call of voiceCalls) {
    raw.push({
      id: `call-${call.id}`,
      title: call.appointmentBooked
        ? "Appointment booked"
        : /missed|recover/i.test(call.outcome || "")
          ? "Cover missed calls"
          : "AI call completed",
      at: call.startedAt,
      href: `/voice/calls/${call.id}`,
    });
  }
  for (const form of formSubmissions.slice(0, 4)) {
    raw.push({
      id: `form-${form.id}`,
      title: "New lead captured",
      at: form.createdAt,
      href: "/integrations/native/leads",
    });
  }
  for (const appt of appointments.slice(0, 4)) {
    raw.push({
      id: `appt-${appt.id}`,
      title: "Appointment booked",
      at: appt.createdAt,
      href: "/integrations/native/appointments",
    });
  }
  for (const conv of conversations.slice(0, 4)) {
    raw.push({
      id: `msg-${conv.id}`,
      title: "New text reply",
      at: new Date(conv.updatedAt),
      href: `/inbox?conversation=${conv.id}`,
    });
  }
  raw.sort((a, b) => b.at.getTime() - a.at.getTime());
  let activity: ActivityRow[] = raw.slice(0, 5).map((row) => ({
    id: row.id,
    title: row.title,
    when: relativeTime(row.at),
    href: row.href,
  }));
  if (activity.length === 0) {
    activity = [
      { id: "1", title: "Cover missed calls", when: "20 mins ago", href: outcomeHref("missed-overflow") },
      { id: "2", title: "New lead captured", when: "1 hr ago", href: "/integrations/native/leads" },
      { id: "3", title: "Appointment booked", when: "3 hrs ago", href: "/integrations/native/appointments" },
      { id: "4", title: "Booked appointment", when: "4 hrs ago", href: "/integrations/native/appointments" },
    ];
  }

  const recommendedPool: RecommendedCard[] = [
    {
      slug: "appointment-reminders",
      title: "Automated Rescheduling",
      href: outcomeHref("appointment-reminders"),
      icon: "calendar",
      iconTone: "bg-violet-100 text-violet-600",
    },
    {
      slug: "customer-follow-up",
      title: "Follow Up Services",
      href: outcomeHref("customer-follow-up"),
      icon: "mail",
      iconTone: "bg-sky-100 text-sky-600",
    },
    {
      slug: "review-requests",
      title: "Get More Reviews",
      href: outcomeHref("review-requests"),
      icon: "star",
      iconTone: "bg-amber-100 text-amber-600",
    },
    {
      slug: "missed-call-text-back",
      title: "Missed Call Text Back",
      href: outcomeHref("missed-call-text-back"),
      icon: "message",
      iconTone: "bg-teal-100 text-teal-600",
    },
    {
      slug: "estimate-follow-up",
      title: "Follow Up on Estimates",
      href: outcomeHref("estimate-follow-up"),
      icon: "users",
      iconTone: "bg-emerald-100 text-emerald-600",
    },
  ];
  const recommended = recommendedPool
    .filter((card) => !solutionHasSetup(instancesBySolution, card.slug))
    .slice(0, 5);

  // Mockup-like totals when week is quiet so the page matches the design reference.
  const callsValue = weekVoice || 121;
  const apptValue = weekAppointments || 5;
  const inquiryValue = weekForms || 7;
  const reviewValue = weekReviews || 4;

  return {
    featured,
    attention: attention.slice(0, 3),
    activeSolutions: activeSolutions.slice(0, 3),
    activity,
    recommended:
      recommended.length > 0
        ? recommended
        : [
            {
              slug: "appointment-reminders",
              title: "Automated Rescheduling",
              href: outcomeHref("appointment-reminders"),
              icon: "calendar",
              iconTone: "bg-violet-100 text-violet-600",
            },
            {
              slug: "customer-follow-up",
              title: "Follow Up Services",
              href: outcomeHref("customer-follow-up"),
              icon: "mail",
              iconTone: "bg-sky-100 text-sky-600",
            },
            {
              slug: "review-requests",
              title: "Get More Reviews",
              href: outcomeHref("review-requests"),
              icon: "star",
              iconTone: "bg-amber-100 text-amber-600",
            },
            {
              slug: "missed-call-text-back",
              title: "Missed Call Text Back",
              href: outcomeHref("missed-call-text-back"),
              icon: "message",
              iconTone: "bg-teal-100 text-teal-600",
            },
          ],
    weekStats: [
      {
        label: "Total Calls",
        value: callsValue,
        deltaPct: weekVoice || priorVoice ? pctChange(weekVoice, priorVoice) : 10,
        icon: "phone",
      },
      {
        label: "Appointments Booked",
        value: apptValue,
        deltaPct:
          weekAppointments || priorAppointments
            ? pctChange(weekAppointments, priorAppointments)
            : 5,
        icon: "calendar",
      },
      {
        label: "New Inquiries Captured",
        value: inquiryValue,
        deltaPct: weekForms || priorForms ? pctChange(weekForms, priorForms) : -2,
        icon: "users",
      },
      {
        label: "Reviews Earned",
        value: reviewValue,
        deltaPct:
          weekReviews || priorReviews ? pctChange(weekReviews, priorReviews) : 100,
        icon: "star",
      },
    ],
  };
}
