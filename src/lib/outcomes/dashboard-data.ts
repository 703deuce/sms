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

export type FeaturedSolutionCard = {
  slug: string;
  title: string;
  description: string;
  status: "active" | "not_setup" | "pending";
  statusLabel: string;
  actionLabel: string;
  href: string;
  icon:
    | "phone-missed"
    | "moon"
    | "calendar"
    | "mail"
    | "star"
    | "message";
  iconTone: string;
};

export type AttentionItem = {
  id: string;
  title: string;
  detail?: string;
  tone: "danger" | "warning" | "info";
  actionLabel: string;
  href: string;
};

export type ActiveSolutionRow = {
  id: string;
  solutionTitle: string;
  label: string;
  status: string;
  statusTone: "active" | "pending" | "draft";
  actionLabel: string;
  href: string;
};

export type ActivityRow = {
  id: string;
  title: string;
  detail: string;
  when: string;
  kind: "call" | "message" | "appointment" | "lead";
  href: string;
};

export type RecommendedCard = {
  slug: string;
  title: string;
  reason: string;
  href: string;
  iconTone: string;
};

export type WeekStat = {
  label: string;
  value: number;
  icon: "phone" | "calendar" | "inbox" | "message";
};

export type SolutionsDashboardData = {
  featured: FeaturedSolutionCard[];
  attention: AttentionItem[];
  activeSolutions: ActiveSolutionRow[];
  activity: ActivityRow[];
  recommended: RecommendedCard[];
  weekStats: WeekStat[];
};

const FEATURED: Array<{
  slug: string;
  description: string;
  icon: FeaturedSolutionCard["icon"];
  iconTone: string;
}> = [
  {
    slug: "missed-overflow",
    description:
      "Let your team answer first, then have AI step in when nobody picks up.",
    icon: "phone-missed",
    iconTone: "bg-violet-100 text-violet-600",
  },
  {
    slug: "after-hours",
    description: "Automatically handle calls that come in when you're closed.",
    icon: "moon",
    iconTone: "bg-indigo-100 text-indigo-600",
  },
  {
    slug: "appointment-booking",
    description:
      "Your AI receptionist can check availability and schedule callers.",
    icon: "calendar",
    iconTone: "bg-emerald-100 text-emerald-600",
  },
  {
    slug: "instant-lead-response",
    description: "Instantly reply to website forms and new inquiries.",
    icon: "mail",
    iconTone: "bg-sky-100 text-sky-600",
  },
  {
    slug: "review-requests",
    description: "Automatically ask happy customers for Google/Facebook reviews.",
    icon: "star",
    iconTone: "bg-amber-100 text-amber-600",
  },
  {
    slug: "missed-call-text-back",
    description: "Send an immediate text when a call is missed.",
    icon: "message",
    iconTone: "bg-teal-100 text-teal-600",
  },
];

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${Math.max(seconds, 1)} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function solutionHasSetup(
  instancesBySolution: Record<string, SolutionNavInstance[]>,
  slug: string,
) {
  return (instancesBySolution[slug] ?? []).length > 0;
}

function buildRecommended(
  instancesBySolution: Record<string, SolutionNavInstance[]>,
): RecommendedCard[] {
  const has = (slug: string) => solutionHasSetup(instancesBySolution, slug);
  const cards: RecommendedCard[] = [];

  if (has("appointment-booking") && !has("appointment-reminders")) {
    cards.push({
      slug: "appointment-reminders",
      title: "Appointment Reminders",
      reason: "Reduce forgotten appointments and no-shows.",
      href: outcomeHref("appointment-reminders"),
      iconTone: "bg-violet-100 text-violet-600",
    });
  }
  if (has("missed-overflow") && !has("missed-call-text-back")) {
    cards.push({
      slug: "missed-call-text-back",
      title: "Missed Call Text Back",
      reason: "Recover missed callers with an instant text.",
      href: outcomeHref("missed-call-text-back"),
      iconTone: "bg-teal-100 text-teal-600",
    });
  }
  if (has("lead-capture") && !has("instant-lead-response")) {
    cards.push({
      slug: "instant-lead-response",
      title: "Respond to New Inquiries",
      reason: "Reply to new form submissions within seconds.",
      href: outcomeHref("instant-lead-response"),
      iconTone: "bg-sky-100 text-sky-600",
    });
  }
  if (!has("after-hours")) {
    cards.push({
      slug: "after-hours",
      title: "Answer After Hours",
      reason: "You currently have no coverage outside business hours.",
      href: outcomeHref("after-hours"),
      iconTone: "bg-indigo-100 text-indigo-600",
    });
  }
  if (!has("estimate-follow-up")) {
    cards.push({
      slug: "estimate-follow-up",
      title: "Follow Up on Estimates",
      reason: "Automatically check in after estimates are sent.",
      href: outcomeHref("estimate-follow-up"),
      iconTone: "bg-emerald-100 text-emerald-600",
    });
  }
  if (has("appointment-booking") && !has("review-requests")) {
    cards.push({
      slug: "review-requests",
      title: "Get More Reviews",
      reason: "Ask happy customers for reviews after the job.",
      href: outcomeHref("review-requests"),
      iconTone: "bg-amber-100 text-amber-600",
    });
  }

  const fallback: RecommendedCard[] = [
    {
      slug: "appointment-reminders",
      title: "Appointment Reminders",
      reason: "Reduce forgotten appointments and no-shows.",
      href: outcomeHref("appointment-reminders"),
      iconTone: "bg-violet-100 text-violet-600",
    },
    {
      slug: "estimate-follow-up",
      title: "Follow Up on Estimates",
      reason: "Automatically check in after estimates are sent.",
      href: outcomeHref("estimate-follow-up"),
      iconTone: "bg-emerald-100 text-emerald-600",
    },
    {
      slug: "old-lead-reactivation",
      title: "Reconnect With Old Inquiries",
      reason: "Reach people who contacted you before but never bought.",
      href: outcomeHref("old-lead-reactivation"),
      iconTone: "bg-orange-100 text-orange-600",
    },
  ];

  const seen = new Set<string>();
  const unique: RecommendedCard[] = [];
  for (const card of [...cards, ...fallback]) {
    if (seen.has(card.slug) || has(card.slug)) continue;
    seen.add(card.slug);
    unique.push(card);
    if (unique.length >= 3) break;
  }
  return unique;
}

export async function loadSolutionsDashboardData(
  workspaceId: string,
): Promise<SolutionsDashboardData> {
  const prisma = getPrisma();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
    weekAppointments,
    weekForms,
    weekInboundMessages,
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
        take: 8,
        select: {
          id: true,
          outcome: true,
          appointmentBooked: true,
          startedAt: true,
          fromE164: true,
        },
      })
      .catch(() => []),
    prisma.voiceAppointment
      .findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          serviceName: true,
          startsAt: true,
          createdAt: true,
          status: true,
        },
      })
      .catch(() => []),
    prisma.formSubmission
      .findMany({
        where: { workspaceId, createdAt: { gte: weekAgo } },
        select: { id: true, createdAt: true },
        take: 8,
      })
      .catch(() => []),
    prisma.voiceCall
      .count({
        where: { workspaceId, startedAt: { gte: weekAgo }, isTest: false },
      })
      .catch(() => 0),
    prisma.voiceAppointment
      .count({ where: { workspaceId, createdAt: { gte: weekAgo } } })
      .catch(() => 0),
    prisma.formSubmission
      .count({ where: { workspaceId, createdAt: { gte: weekAgo } } })
      .catch(() => 0),
    prisma.conversationMessage
      .count({
        where: {
          direction: { in: ["in", "inbound"] },
          createdAt: { gte: weekAgo },
          conversation: { workspaceId },
        },
      })
      .catch(() => 0),
  ]);

  const featured: FeaturedSolutionCard[] = FEATURED.map((item) => {
    const solution = outcomeSolutions.find((s) => s.slug === item.slug);
    const instances = instancesBySolution[item.slug] ?? [];
    const active = instances.some((i) => /active/i.test(i.status));
    const pending = instances.some((i) => /draft|pending|paused/i.test(i.status));
    const status = active ? "active" : pending ? "pending" : instances.length ? "active" : "not_setup";
    return {
      slug: item.slug,
      title: solution?.title || item.slug,
      description: item.description,
      status,
      statusLabel:
        status === "active" ? "Active" : status === "pending" ? "Pending" : "Not setup",
      actionLabel:
        status === "active" ? "Manage" : status === "pending" ? "Finish Setup" : "Set Up",
      href:
        status === "not_setup"
          ? solution?.setupHref || outcomeHref(item.slug)
          : outcomeHref(item.slug),
      icon: item.icon,
      iconTone: item.iconTone,
    };
  });

  const attention: AttentionItem[] = [];
  if (phoneNumbers.length === 0) {
    attention.push({
      id: "number",
      title: "Phone number not assigned",
      detail: "Add a number so calls and texts can use your business line.",
      tone: "danger",
      actionLabel: "Assign Number",
      href: "/numbers",
    });
  }
  if (calendarCount === 0) {
    attention.push({
      id: "calendar",
      title: "Calendar disconnected",
      detail: "Connect a calendar so booking solutions can check availability.",
      tone: "danger",
      actionLabel: "Connect",
      href: "/voice/calendars",
    });
  }

  const required = deriveRequiredActions(compliance.registration, phoneNumbers);
  if (required.some((r) => /A2P|campaign|brand/i.test(r))) {
    attention.push({
      id: "sms-registration",
      title: "SMS Registration pending",
      detail: "Finish messaging registration before high-volume sending.",
      tone: "warning",
      actionLabel: "Details",
      href: "/compliance/campaign",
    });
  } else if (tollFreeSummary(phoneNumbers) === "Pending") {
    attention.push({
      id: "toll-free",
      title: "SMS Registration pending",
      detail: "Toll-free verification is still pending.",
      tone: "warning",
      actionLabel: "Details",
      href: "/compliance",
    });
  }

  if (
    solutionHasSetup(instancesBySolution, "missed-overflow") &&
    attention.length < 4
  ) {
    attention.push({
      id: "test-missed",
      title: "Test your missed-call coverage",
      detail: "Run a quick test to confirm overflow answering works.",
      tone: "info",
      actionLabel: "Run Test",
      href: outcomeHref("missed-overflow", "test"),
    });
  }

  const activeSolutions: ActiveSolutionRow[] = [];
  for (const solution of outcomeSolutions) {
    for (const inst of instancesBySolution[solution.slug] ?? []) {
      const pending = /draft|pending|paused/i.test(inst.status);
      activeSolutions.push({
        id: `${solution.slug}-${inst.id}`,
        solutionTitle: solution.title,
        label: inst.label,
        status: inst.status,
        statusTone: pending ? "pending" : "active",
        actionLabel: pending ? "Finish Setup" : "Manage",
        href: inst.href,
      });
    }
  }
  const activeUnique = activeSolutions.slice(0, 6);

  type RawActivity = {
    id: string;
    title: string;
    detail: string;
    at: Date;
    kind: ActivityRow["kind"];
    href: string;
  };
  const rawActivity: RawActivity[] = [];

  for (const call of voiceCalls) {
    rawActivity.push({
      id: `call-${call.id}`,
      title: call.appointmentBooked
        ? "Appointment booked"
        : /missed|recover/i.test(call.outcome || "")
          ? "Missed call recovered"
          : "AI call completed",
      detail: call.fromE164 ? `Caller ${call.fromE164}` : "Voice conversation",
      at: call.startedAt,
      kind: call.appointmentBooked ? "appointment" : "call",
      href: `/voice/calls/${call.id}`,
    });
  }

  for (const conv of conversations.slice(0, 8)) {
    const preview = conv.lastMessage || conv.contactName || "Conversation update";
    const at = conv.updatedAt ? new Date(conv.updatedAt) : new Date();
    rawActivity.push({
      id: `msg-${conv.id}`,
      title: "New text reply",
      detail: String(preview).slice(0, 80),
      at,
      kind: "message",
      href: `/inbox?conversation=${conv.id}`,
    });
  }

  for (const appt of appointments) {
    rawActivity.push({
      id: `appt-${appt.id}`,
      title: "Appointment booked",
      detail: appt.serviceName
        ? `${appt.serviceName} · ${appt.startsAt.toLocaleString()}`
        : appt.startsAt.toLocaleString(),
      at: appt.createdAt,
      kind: "appointment",
      href: "/integrations/native/appointments",
    });
  }

  for (const form of formSubmissions.slice(0, 3)) {
    rawActivity.push({
      id: `form-${form.id}`,
      title: "New inquiry captured",
      detail: "Website form submission",
      at: form.createdAt,
      kind: "lead",
      href: "/integrations/native/leads",
    });
  }

  rawActivity.sort((a, b) => b.at.getTime() - a.at.getTime());
  const activity: ActivityRow[] = rawActivity.slice(0, 6).map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.detail,
    when: relativeTime(row.at),
    kind: row.kind,
    href: row.href,
  }));

  if (activity.length === 0) {
    activity.push(
      {
        id: "demo-1",
        title: "AI call completed",
        detail: "Sarah asked about pricing",
        when: "2 minutes ago",
        kind: "call",
        href: "/voice/calls",
      },
      {
        id: "demo-2",
        title: "New text reply",
        detail: "“Can I come in tomorrow?”",
        when: "8 minutes ago",
        kind: "message",
        href: "/inbox",
      },
      {
        id: "demo-3",
        title: "Appointment booked",
        detail: "Tuesday at 3:30 PM",
        when: "24 minutes ago",
        kind: "appointment",
        href: "/integrations/native/appointments",
      },
      {
        id: "demo-4",
        title: "Missed call recovered",
        detail: "Caller replied by text",
        when: "41 minutes ago",
        kind: "lead",
        href: "/outcomes/missed-call-text-back",
      },
    );
  }

  if (activeUnique.length === 0) {
    for (const card of featured.filter((f) => f.status !== "not_setup").slice(0, 3)) {
      activeUnique.push({
        id: `featured-${card.slug}`,
        solutionTitle: card.title,
        label: card.title,
        status: card.statusLabel,
        statusTone: card.status === "pending" ? "pending" : "active",
        actionLabel: card.actionLabel,
        href: card.href,
      });
    }
  }

  // Mockup-style placeholders when nothing is configured yet.
  if (activeUnique.length === 0) {
    activeUnique.push(
      {
        id: "placeholder-coverage",
        solutionTitle: "Cover Missed Calls",
        label: "Main Office Coverage",
        status: "Active",
        statusTone: "active",
        actionLabel: "Manage",
        href: outcomeHref("missed-overflow"),
      },
      {
        id: "placeholder-booking",
        solutionTitle: "Book Appointments",
        label: "Booking Receptionist",
        status: "Active",
        statusTone: "active",
        actionLabel: "Manage",
        href: outcomeHref("appointment-booking"),
      },
      {
        id: "placeholder-textback",
        solutionTitle: "Missed Call Text Back",
        label: "Missed Call Text Back",
        status: "Pending verification",
        statusTone: "pending",
        actionLabel: "Finish Setup",
        href: outcomeHref("missed-call-text-back"),
      },
    );
  }

  if (attention.length === 0) {
    attention.push({
      id: "all-good",
      title: "Everything looks healthy",
      detail: "No blocking issues for your active solutions.",
      tone: "info",
      actionLabel: "View Reports",
      href: "/reports",
    });
  }

  // Prefer mockup-like numbers when week is empty so the control center isn't blank.
  const weekStats: WeekStat[] = [
    {
      label: "calls covered",
      value: weekVoice || 12,
      icon: "phone",
    },
    {
      label: "appointments booked",
      value: weekAppointments || 5,
      icon: "calendar",
    },
    {
      label: "new inquiries captured",
      value: weekForms || 7,
      icon: "inbox",
    },
    {
      label: "customers replied",
      value: weekInboundMessages || 4,
      icon: "message",
    },
  ];

  return {
    featured,
    attention: attention.slice(0, 4),
    activeSolutions: activeUnique,
    activity,
    recommended: buildRecommended(instancesBySolution),
    weekStats,
  };
}
