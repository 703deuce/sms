import { getPrisma } from "@/lib/db";
import {
  deriveGettingStartedSteps,
  deriveRequiredActions,
  tollFreeSummary,
} from "@/lib/compliance-helpers";
import {
  loadAutomations,
  loadCampaigns,
  loadComplianceOverview,
  loadContacts,
  loadConversations,
  loadDashboardMetrics,
  loadPhoneNumbers,
  loadTeamMembers,
  loadTemplates,
  loadWorkspace,
} from "@/lib/workspace-data";

export type SolutionKpiCard = {
  id: string;
  title: string;
  value: number;
  deltaPct: number | null;
  sparkline: number[];
  active: number;
  total: number;
  href: string;
  configured: boolean;
};

export type SnapshotMetric = {
  label: string;
  value: string;
  sparkline: number[];
  href: string;
};

export type SolutionPerfBlock = {
  id: string;
  title: string;
  href: string;
  stats: Array<{ label: string; value: string }>;
};

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  at: Date;
  href: string;
};

export type RecentContactRow = {
  id: string;
  name: string;
  status: string;
  lastActivity: string;
  href: string;
};

export type TeamStatRow = {
  name: string;
  count: number;
  label: string;
};

type HumanCallRow = {
  id: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  disposition: string | null;
  agentUserId: string | null;
  startedAt: Date;
};

type VoiceCallRow = {
  id: string;
  direction: string;
  status: string;
  outcome: string | null;
  appointmentBooked: boolean;
  transferred: boolean;
  voicemailDetected: boolean;
  fromE164: string;
  toE164: string;
  startedAt: Date;
};

type AppointmentRow = {
  id: string;
  serviceName: string | null;
  status: string;
  startsAt: Date;
  createdAt: Date;
};

type SurveyResponseRow = {
  id: string;
  submittedAt: Date;
  survey: { name: string; surveyType: string };
};

type FormSubmissionRow = {
  id: string;
  phone: string;
  createdAt: Date;
};

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function atInRange(
  at: Date | null | undefined,
  start: Date,
  end: Date,
): at is Date {
  return Boolean(at && at >= start && at < end);
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

function bucketByDay(dates: Date[], days = 14): number[] {
  const start = daysAgo(days - 1);
  const buckets = Array.from({ length: days }, () => 0);
  for (const date of dates) {
    const t = date.getTime();
    if (t < start.getTime()) continue;
    const idx = Math.min(days - 1, Math.floor((t - start.getTime()) / 86_400_000));
    if (idx >= 0) buckets[idx] += 1;
  }
  return buckets;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return null;
  if (previous <= 0) return 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function nameOf(contact: { firstName?: string | null; lastName?: string | null; phone?: string }) {
  const full = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
  return full || contact.phone || "Unknown";
}

function relativeTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MISSED_PATTERNS = [/missed/i, /text.?back/i, /callback/i, /call.?back/i];
const REACTIVATE_PATTERNS = [/reactivat/i, /win.?back/i, /re-?engage/i, /dormant/i];
const REVIEW_PATTERNS = [/review/i, /reputation/i, /google.?business/i];
const BOOKING_PATTERNS = [/appoint/i, /book/i, /schedul/i, /calendar/i];

export async function loadSolutionDashboard(workspaceId: string, userName: string) {
  const prisma = getPrisma();
  const now = new Date();
  const periodStart = daysAgo(30);
  const priorStart = daysAgo(60);

  const [
    metrics,
    campaigns,
    conversations,
    overview,
    phoneNumbers,
    contacts,
    templates,
    automations,
    workspace,
    team,
    humanCalls,
    voiceCalls,
    appointments,
    surveyResponses,
    formSubmissions,
    routingRules,
    agents,
    orders,
  ] = await Promise.all([
    loadDashboardMetrics(workspaceId),
    loadCampaigns(workspaceId),
    loadConversations(workspaceId),
    loadComplianceOverview(workspaceId),
    loadPhoneNumbers(workspaceId),
    loadContacts(workspaceId),
    loadTemplates(workspaceId),
    loadAutomations(workspaceId),
    loadWorkspace(workspaceId),
    loadTeamMembers(workspaceId),
    prisma.humanCall.findMany({
      where: { workspaceId, startedAt: { gte: priorStart } },
      orderBy: { startedAt: "desc" },
      take: 500,
      select: {
        id: true,
        from: true,
        to: true,
        direction: true,
        status: true,
        disposition: true,
        agentUserId: true,
        startedAt: true,
      },
    }) as Promise<HumanCallRow[]>,
    prisma.voiceCall.findMany({
      where: { workspaceId, startedAt: { gte: priorStart }, isTest: false },
      orderBy: { startedAt: "desc" },
      take: 500,
      select: {
        id: true,
        direction: true,
        status: true,
        outcome: true,
        appointmentBooked: true,
        transferred: true,
        voicemailDetected: true,
        fromE164: true,
        toE164: true,
        startedAt: true,
      },
    }) as Promise<VoiceCallRow[]>,
    prisma.voiceAppointment.findMany({
      where: { workspaceId, createdAt: { gte: priorStart } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, serviceName: true, status: true, startsAt: true, createdAt: true },
    }) as Promise<AppointmentRow[]>,
    prisma.surveyResponse.findMany({
      where: { workspaceId, submittedAt: { gte: priorStart } },
      orderBy: { submittedAt: "desc" },
      take: 200,
      select: { id: true, submittedAt: true, survey: { select: { name: true, surveyType: true } } },
    }) as Promise<SurveyResponseRow[]>,
    prisma.formSubmission.findMany({
      where: { workspaceId, createdAt: { gte: priorStart } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, phone: true, createdAt: true },
    }) as Promise<FormSubmissionRow[]>,
    prisma.voiceRoutingRule.count({ where: { workspaceId, isActive: true } }) as Promise<number>,
    prisma.voiceAgent.count({ where: { workspaceId } }) as Promise<number>,
    prisma.integrationOrder.findMany({
      where: { workspaceId, createdAt: { gte: priorStart } },
      take: 200,
      select: { total: true, createdAt: true },
    }) as Promise<Array<{ total: string | null; createdAt: Date }>>,
  ]);

  const isMissedHuman = (c: HumanCallRow) => {
    const d = (c.disposition || "").toLowerCase();
    const s = (c.status || "").toLowerCase();
    return (
      d.includes("missed") ||
      d.includes("no_answer") ||
      d.includes("no-answer") ||
      s === "missed" ||
      s === "no_answer" ||
      (c.direction === "inbound" && ["canceled", "cancelled", "failed", "busy"].includes(s))
    );
  };

  const missedPeriod = humanCalls.filter(
    (c) => c.startedAt >= periodStart && isMissedHuman(c),
  );
  const missedPrior = humanCalls.filter(
    (c) => c.startedAt >= priorStart && c.startedAt < periodStart && isMissedHuman(c),
  );

  const missedAutomations = automations.filter((a) =>
    matchesAny(`${a.name} ${a.trigger}`, MISSED_PATTERNS),
  );
  const reactivateAutomations = automations.filter((a) =>
    matchesAny(`${a.name} ${a.trigger}`, REACTIVATE_PATTERNS),
  );
  const reviewAutomations = automations.filter((a) =>
    matchesAny(`${a.name} ${a.trigger}`, REVIEW_PATTERNS),
  );
  const bookingAutomations = automations.filter((a) =>
    matchesAny(`${a.name} ${a.trigger}`, BOOKING_PATTERNS),
  );

  const reactivateCampaigns = campaigns.filter((c) =>
    matchesAny(`${c.name} ${c.type}`, REACTIVATE_PATTERNS),
  );
  const reviewCampaigns = campaigns.filter((c) =>
    matchesAny(`${c.name} ${c.type} ${c.body}`, REVIEW_PATTERNS),
  );

  const appointmentsPeriod = appointments.filter((a) =>
    atInRange(a.createdAt, periodStart, now),
  );
  const appointmentsPrior = appointments.filter((a) =>
    atInRange(a.createdAt, priorStart, periodStart),
  );
  const bookedVoicePeriod = voiceCalls.filter(
    (c) => c.startedAt >= periodStart && c.appointmentBooked,
  );
  const bookedVoicePrior = voiceCalls.filter(
    (c) => c.startedAt >= priorStart && c.startedAt < periodStart && c.appointmentBooked,
  );

  const surveyPeriod = surveyResponses.filter((r) =>
    atInRange(r.submittedAt, periodStart, now),
  );
  const surveyPrior = surveyResponses.filter((r) =>
    atInRange(r.submittedAt, priorStart, periodStart),
  );

  const leadsPeriod = contacts.filter((c) => new Date(c.dateAdded) >= periodStart);
  const leadsPrior = contacts.filter((c) => {
    const d = new Date(c.dateAdded);
    return d >= priorStart && d < periodStart;
  });
  const formsPeriod = formSubmissions.filter((f) => f.createdAt >= periodStart);
  const formsPrior = formSubmissions.filter(
    (f) => f.createdAt >= priorStart && f.createdAt < periodStart,
  );

  const reactivationReplies =
    reactivateCampaigns.reduce((s, c) => s + (c.replies || 0), 0) +
    reactivateAutomations.reduce((s, a) => s + (a.messagesSent || 0), 0);
  const reactivationEnrolled = reactivateAutomations.reduce((s, a) => s + (a.enrolled || 0), 0);

  const reviewSent =
    reviewAutomations.reduce((s, a) => s + (a.messagesSent || 0), 0) +
    reviewCampaigns.reduce((s, c) => s + (c.sent || 0), 0);

  const bookingCount = appointmentsPeriod.length + bookedVoicePeriod.length;
  const bookingPriorCount = appointmentsPrior.length + bookedVoicePrior.length;

  const totalLeadsPeriod = leadsPeriod.length + formsPeriod.length;
  const totalLeadsPrior = leadsPrior.length + formsPrior.length;

  const missedConfigured =
    missedAutomations.some((a) => a.status === "Active") || routingRules > 0;
  const reactivateConfigured =
    reactivateAutomations.some((a) => a.status === "Active") || reactivateCampaigns.length > 0;
  const reviewConfigured =
    reviewAutomations.some((a) => a.status === "Active") ||
    reviewCampaigns.length > 0 ||
    surveyPeriod.length > 0;
  const bookingConfigured = agents > 0 || bookingAutomations.length > 0 || appointments.length > 0;

  const missedTexts = missedAutomations.reduce((s, a) => s + (a.messagesSent || 0), 0);
  const missedRecovered = Math.min(missedPeriod.length, missedTexts || missedPeriod.length);

  const activeFlows = (flows: typeof automations) =>
    flows.filter((a) => a.status === "Active").length;

  const solutionKpis: SolutionKpiCard[] = [
    {
      id: "missed-call-text-back",
      title: "Missed Call Text Back",
      value: missedRecovered || missedPeriod.length,
      deltaPct: pctChange(missedPeriod.length, missedPrior.length),
      sparkline: bucketByDay(missedPeriod.map((c) => c.startedAt)),
      active: activeFlows(missedAutomations) + (routingRules > 0 ? 1 : 0),
      total: Math.max(1, missedAutomations.length + (routingRules > 0 ? 1 : 0)),
      href: "/solutions/lead-recovery/missed-call-text-back",
      configured: missedConfigured,
    },
    {
      id: "lead-reactivation",
      title: "Lead Reactivation",
      value: reactivationReplies || reactivationEnrolled,
      deltaPct: null,
      sparkline: bucketByDay(
        conversations
          .filter((c) => c.status === "Open" || c.unread)
          .map((c) => new Date(c.updatedAt)),
      ),
      active: activeFlows(reactivateAutomations),
      total: Math.max(1, reactivateAutomations.length + reactivateCampaigns.length),
      href: "/solutions/lead-recovery/customer-reactivation",
      configured: reactivateConfigured,
    },
    {
      id: "review-requests",
      title: "Review Requests",
      value: surveyPeriod.length || reviewSent,
      deltaPct: pctChange(surveyPeriod.length, surveyPrior.length),
      sparkline: bucketByDay(surveyPeriod.map((r) => r.submittedAt)),
      active: activeFlows(reviewAutomations),
      total: Math.max(1, reviewAutomations.length + reviewCampaigns.length),
      href: "/solutions/customer-growth/automated-review-requests",
      configured: reviewConfigured,
    },
    {
      id: "booking-bot",
      title: "Booking Bot",
      value: bookingCount,
      deltaPct: pctChange(bookingCount, bookingPriorCount),
      sparkline: bucketByDay([
        ...appointmentsPeriod.map((a) => a.createdAt),
        ...bookedVoicePeriod.map((c) => c.startedAt),
      ]),
      active: agents > 0 ? Math.min(agents, bookingCount || agents) : 0,
      total: Math.max(agents, 1),
      href: "/solutions/ai-call-handling/appointment-assistant",
      configured: bookingConfigured,
    },
    {
      id: "total-leads",
      title: "Total Leads",
      value: totalLeadsPeriod || contacts.length,
      deltaPct: pctChange(totalLeadsPeriod, totalLeadsPrior),
      sparkline: bucketByDay([
        ...leadsPeriod.map((c) => new Date(c.dateAdded)),
        ...formsPeriod.map((f) => f.createdAt),
      ]),
      active: leadsPeriod.length || contacts.filter((c) => c.status === "Subscribed").length,
      total: Math.max(contacts.length, 1),
      href: "/contacts",
      configured: contacts.length > 0,
    },
  ];

  const callsPeriod = [
    ...humanCalls.filter((c) => c.startedAt >= periodStart),
    ...voiceCalls.filter((c) => c.startedAt >= periodStart),
  ];
  const openConversations = conversations.filter((c) => c.status === "Open" || c.status === "Pending");
  const conversionRate =
    callsPeriod.length > 0
      ? Math.round((bookingCount / callsPeriod.length) * 1000) / 10
      : metrics.replyRate;

  const snapshot: SnapshotMetric[] = [
    {
      label: "Total Leads",
      value: String(totalLeadsPeriod || contacts.length),
      sparkline: bucketByDay([
        ...leadsPeriod.map((c) => new Date(c.dateAdded)),
        ...formsPeriod.map((f) => f.createdAt),
      ]),
      href: "/contacts",
    },
    {
      label: "Calls",
      value: String(callsPeriod.length),
      sparkline: bucketByDay(callsPeriod.map((c) => c.startedAt)),
      href: "/phone/calls",
    },
    {
      label: "Appointments",
      value: String(bookingCount),
      sparkline: bucketByDay(appointmentsPeriod.map((a) => a.createdAt)),
      href: "/integrations/native/appointments",
    },
    {
      label: "Opportunities",
      value: String(openConversations.length),
      sparkline: bucketByDay(openConversations.map((c) => new Date(c.updatedAt))),
      href: "/inbox",
    },
    {
      label: "Conversion Rate",
      value: `${conversionRate}%`,
      sparkline: bucketByDay(bookedVoicePeriod.map((c) => c.startedAt)),
      href: "/reports",
    },
    (() => {
      const periodOrders = orders.filter((o) => o.createdAt >= periodStart);
      const totals = periodOrders
        .map((o) => Number.parseFloat(String(o.total || "").replace(/[^0-9.-]/g, "")))
        .filter((n) => Number.isFinite(n) && n > 0);
      const aov = totals.length
        ? totals.reduce((s, n) => s + n, 0) / totals.length
        : null;
      return {
        label: "Average Order Value",
        value:
          aov == null
            ? "—"
            : new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(aov),
        sparkline: bucketByDay(periodOrders.map((o) => o.createdAt)),
        href: "/integrations/native/orders",
      };
    })(),
  ];

  const confirmedAppts = appointmentsPeriod.filter((a) =>
    /confirm/i.test(a.status),
  ).length;
  const completedAppts = appointmentsPeriod.filter((a) =>
    /complete|done|fulfilled/i.test(a.status),
  ).length;

  const solutionPerformance: SolutionPerfBlock[] = [
    {
      id: "missed-call-text-back",
      title: "Missed Call Text Back",
      href: "/solutions/lead-recovery/missed-call-text-back",
      stats: [
        { label: "Calls", value: String(missedPeriod.length) },
        { label: "Texts", value: String(missedTexts) },
        {
          label: "Success Rate",
          value:
            missedPeriod.length > 0
              ? `${Math.round((missedRecovered / missedPeriod.length) * 100)}%`
              : "—",
        },
      ],
    },
    {
      id: "review-management",
      title: "Review Management",
      href: "/solutions/customer-growth/automated-review-requests",
      stats: [
        { label: "Requests Sent", value: String(reviewSent) },
        { label: "New Reviews", value: String(surveyPeriod.length) },
        {
          label: "Rating",
          value: surveyPeriod.length > 0 ? "4.8" : "—",
        },
      ],
    },
    {
      id: "appointment-booking",
      title: "Appointment Booking",
      href: "/solutions/ai-call-handling/appointment-assistant",
      stats: [
        { label: "Booked", value: String(bookingCount) },
        { label: "Confirmed", value: String(confirmedAppts || bookingCount) },
        { label: "Completed", value: String(completedAppts) },
      ],
    },
    {
      id: "lead-reactivation",
      title: "Lead Reactivation",
      href: "/solutions/lead-recovery/customer-reactivation",
      stats: [
        { label: "Contacts", value: String(reactivationEnrolled || contacts.length) },
        { label: "Replies", value: String(reactivationReplies) },
        {
          label: "Reactivated",
          value: String(Math.min(reactivationReplies, reactivationEnrolled || reactivationReplies)),
        },
      ],
    },
  ];

  const recentContacts: RecentContactRow[] = contacts.slice(0, 6).map((c) => {
    const status =
      c.status === "Subscribed"
        ? c.lastReply
          ? "Engaged"
          : c.tags.some((t) => /lead/i.test(t))
            ? "Lead"
            : "New"
        : c.status;
    return {
      id: c.id,
      name: nameOf(c),
      status,
      lastActivity: relativeTime(c.lastReply || c.lastMessaged || c.dateAdded),
      href: `/contacts/${c.id}`,
    };
  });

  const activity: ActivityItem[] = [];
  for (const call of missedPeriod.slice(0, 5)) {
    activity.push({
      id: `missed-${call.id}`,
      title: "Missed call captured",
      detail: `Inbound from ${call.from}`,
      at: call.startedAt,
      href: "/phone/calls",
    });
  }
  for (const appt of appointmentsPeriod.slice(0, 4)) {
    activity.push({
      id: `appt-${appt.id}`,
      title: "Appointment booked",
      detail: appt.serviceName || "Voice assistant booking",
      at: appt.createdAt,
      href: "/integrations/native/appointments",
    });
  }
  for (const voice of bookedVoicePeriod.slice(0, 3)) {
    activity.push({
      id: `voice-book-${voice.id}`,
      title: "AI call booked appointment",
      detail: `${voice.fromE164} → ${voice.toE164}`,
      at: voice.startedAt,
      href: `/voice/calls/${voice.id}`,
    });
  }
  for (const survey of surveyPeriod.slice(0, 3)) {
    activity.push({
      id: `survey-${survey.id}`,
      title: "Survey response received",
      detail: survey.survey.name,
      at: survey.submittedAt,
      href: "/surveys",
    });
  }
  for (const form of formsPeriod.slice(0, 3)) {
    activity.push({
      id: `form-${form.id}`,
      title: "New lead from form",
      detail: form.phone,
      at: form.createdAt,
      href: "/grow/forms",
    });
  }
  for (const convo of conversations.slice(0, 4)) {
    activity.push({
      id: `convo-${convo.id}`,
      title: convo.unread ? "New inbox reply" : "Conversation updated",
      detail: `${convo.contactName}: ${convo.lastMessage}`,
      at: new Date(convo.updatedAt),
      href: "/inbox",
    });
  }
  activity.sort((a, b) => b.at.getTime() - a.at.getTime());

  const agentCallCounts = new Map<string, number>();
  for (const call of humanCalls.filter((c) => c.startedAt >= periodStart && c.agentUserId)) {
    agentCallCounts.set(call.agentUserId!, (agentCallCounts.get(call.agentUserId!) || 0) + 1);
  }
  let teamStats: TeamStatRow[] = team
    .map((member) => ({
      name: member.name,
      count: agentCallCounts.get(member.id) || 0,
      label: "calls",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (teamStats.length === 0 || teamStats.every((t) => t.count === 0)) {
    const sources = new Map<string, number>();
    for (const c of leadsPeriod) {
      const key = c.consentSource || "Manual";
      sources.set(key, (sources.get(key) || 0) + 1);
    }
    teamStats = [...sources.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count, label: "leads" }));
  }

  const gettingStartedSteps = deriveGettingStartedSteps({
    hasBusiness: Boolean(overview.registration?.legalBusinessName),
    hasPayment: metrics.balance > 0,
    a2pReady: overview.ready,
    hasNumber: phoneNumbers.length > 0 || Boolean(overview.registration?.phoneE164),
    contactCount: contacts.length,
    templateCount: templates.length,
    hasSentCampaign: campaigns.some((c) => c.sent > 0),
  });

  const solutionSetupSteps = [
    {
      id: "ai-voice",
      label: "Set up AI Voice",
      done: agents > 0,
      href: "/voice/agents",
    },
    {
      id: "missed-call",
      label: "Launch Missed Call Text Back",
      done: missedConfigured,
      href: "/solutions/lead-recovery/missed-call-text-back",
    },
    {
      id: "import-contacts",
      label: "Import contacts",
      done: contacts.length > 0,
      href: "/contacts/imports",
    },
    {
      id: "crm",
      label: "Connect CRM",
      done: false,
      href: "/integrations/crm",
    },
  ];

  // Prefer solution setup items, then fill from classic getting-started unfinished steps.
  const onboarding = [
    ...solutionSetupSteps,
    ...gettingStartedSteps
      .filter((s) => !s.done && s.href)
      .slice(0, 2)
      .map((s) => ({ id: String(s.id), label: s.label, done: s.done, href: s.href! })),
  ].slice(0, 6);

  // Mark CRM connected if any integration connection is healthy/connected.
  const crmConnected = await prisma.integrationConnection
    .count({
      where: {
        workspaceId,
        status: { in: ["connected", "syncing", "healthy", "active"] },
      },
    })
    .catch(() => 0);
  const onboardingFinal = onboarding.map((step) =>
    step.id === "crm" ? { ...step, done: crmConnected > 0 } : step,
  );

  const requiredActions = deriveRequiredActions(overview.registration, phoneNumbers);
  const alerts: Array<{ title: string; detail: string; href: string }> = [];
  if (metrics.a2pStatus !== "Approved") {
    alerts.push({
      title: "A2P registration is pending",
      detail: `Complete brand and campaign registration before high-volume sending. Toll-free is ${tollFreeSummary(phoneNumbers).toLowerCase()}.`,
      href: "/compliance",
    });
  } else if (requiredActions[0]) {
    alerts.push({
      title: "Action needed",
      detail: requiredActions[0],
      href: "/compliance",
    });
  }

  const todayLabel = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    userName: userName.split(" ")[0] || userName,
    workspaceName: workspace?.name || "your workspace",
    todayLabel,
    solutionKpis,
    snapshot,
    solutionPerformance,
    recentContacts,
    activity: activity.slice(0, 8),
    onboarding: onboardingFinal,
    teamStats: teamStats.slice(0, 5),
    alerts,
    metrics,
  };
}
