import "server-only";

import { getPrisma } from "@/lib/db";
import {
  fmtCallDurationTable,
  fmtCallPhone,
} from "@/lib/voice/calls/display";
import { loadPrimaryVoiceAgentId } from "@/lib/voice/shell-nav";
import {
  loadComplianceOverview,
  loadDashboardMetrics,
} from "@/lib/workspace-data";

import type {
  CallDisposition,
  DashboardDateRange,
  OperationalDashboardData,
} from "./operational-dashboard-types";

type VoiceAgentSummary = { id: string; name: string | null; status: string };

type RecentCallRow = {
  id: string;
  contactId: string | null;
  fromE164: string;
  startedAt: Date;
  answeredAt: Date | null;
  voicemailDetected: boolean;
  status: string;
  outcome: string | null;
  durationSeconds: number | null;
  insights?: Array<{ summary: string | null; intent: string | null }>;
  recordings?: Array<{ id: string }>;
};

type WeekCallRow = {
  startedAt: Date;
  answeredAt: Date | null;
  voicemailDetected: boolean;
  status: string;
};

type ContactSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

type AutomationFlowSummary = { name: string; status: string };

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function rangeStart(range: DashboardDateRange): Date {
  const d = new Date();
  if (range === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "30d") {
    d.setDate(d.getDate() - 30);
    return d;
  }
  d.setDate(d.getDate() - 7);
  return d;
}

function periodDays(range: DashboardDateRange): number {
  if (range === "today") return 1;
  if (range === "30d") return 30;
  return 7;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function maskPhoneDisplay(e164: string): string {
  const formatted = fmtCallPhone(e164);
  if (formatted.includes("(")) {
    return formatted.replace(/\d{4}$/, "XXXX");
  }
  return formatted;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  if (parts[0]?.startsWith("(")) return "#";
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function classifyDisposition(call: {
  answeredAt: Date | null;
  voicemailDetected: boolean;
  status: string;
}): CallDisposition {
  if (call.voicemailDetected) return "voicemail";
  if (call.answeredAt) return "answered";
  const s = call.status.toUpperCase();
  if (s === "NO_ANSWER" || s === "FAILED" || s === "CANCELED") return "missed";
  return "missed";
}

function formatCallTimeLabel(startedAt: Date): string {
  const d = new Date(startedAt);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function agentDisplayName(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Amy";
  const first = raw.trim().split(/\s+/)[0];
  return first || "Amy";
}

function agentIsLive(status: string | undefined): boolean {
  return status === "ACTIVE" || status === "TESTING";
}

export async function loadOperationalDashboardData(
  workspaceId: string,
  userName: string,
  dateRange: DashboardDateRange = "7d",
): Promise<OperationalDashboardData> {
  const prisma = getPrisma();
  const now = new Date();
  const start = rangeStart(dateRange);
  const days = periodDays(dateRange);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  const weekStart = rangeStart("7d");

  const primaryAgentId = await loadPrimaryVoiceAgentId(workspaceId);

  const [metrics, compliance, agent, allAgents, phoneNumbers, liveDeployments] =
    await Promise.all([
      loadDashboardMetrics(workspaceId),
      loadComplianceOverview(workspaceId),
      primaryAgentId
        ? prisma.voiceAgent.findUnique({
            where: { id: primaryAgentId },
            select: { id: true, name: true, status: true },
          })
        : Promise.resolve(null),
      prisma.voiceAgent.findMany({
        where: { workspaceId, status: { not: "ARCHIVED" } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true, status: true },
      }),
      prisma.phoneNumber.findMany({
        where: { workspaceId, status: "Active" },
        take: 3,
        select: { e164: true },
      }),
      prisma.triggerDeployment.findMany({
        where: { workspaceId, status: "live", channel: "voice" },
        take: 1,
        include: { phoneNumber: { select: { e164: true } } },
      }),
    ]);

  const resolvedAgent: VoiceAgentSummary | null =
    agent ??
    allAgents.find((a: VoiceAgentSummary) => a.status === "ACTIVE") ??
    allAgents.find((a: VoiceAgentSummary) => a.status === "TESTING") ??
    allAgents[0] ??
    null;

  const agentId = resolvedAgent?.id ?? primaryAgentId;
  const agentName = agentDisplayName(resolvedAgent?.name);
  const agentActive = agentIsLive(resolvedAgent?.status);

  const baseWhere = { workspaceId, startedAt: { gte: start } };
  const prevWhere = { workspaceId, startedAt: { gte: prevStart, lt: start } };

  const messageFilter = {
    OR: [
      { outcome: { contains: "message", mode: "insensitive" as const } },
      { outcome: { contains: "callback", mode: "insensitive" as const } },
      { outcome: { contains: "follow_up", mode: "insensitive" as const } },
    ],
  };

  const [
    answered,
    leads,
    appointments,
    messagesTaken,
    prevAnswered,
    prevLeads,
    prevAppointments,
    prevMessages,
    recentCalls,
    weekCalls,
    missedWeekCount,
    pendingLeadsWeek,
    confirmedApptsWeek,
    activeFlows,
    activeCampaign,
    usage,
    voiceMinutesAgg,
  ] = await Promise.all([
    prisma.voiceCall.count({
      where: { ...baseWhere, answeredAt: { not: null } },
    }),
    prisma.voiceCall.count({
      where: { ...baseWhere, leadScore: { gte: 40 } },
    }),
    prisma.voiceCall.count({
      where: { ...baseWhere, appointmentBooked: true },
    }),
    prisma.voiceCall.count({ where: { ...baseWhere, ...messageFilter } }),
    prisma.voiceCall.count({
      where: { ...prevWhere, answeredAt: { not: null } },
    }),
    prisma.voiceCall.count({
      where: { ...prevWhere, leadScore: { gte: 40 } },
    }),
    prisma.voiceCall.count({
      where: { ...prevWhere, appointmentBooked: true },
    }),
    prisma.voiceCall.count({ where: { ...prevWhere, ...messageFilter } }),
    prisma.voiceCall.findMany({
      where: { workspaceId },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        insights: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { summary: true, intent: true },
        },
        recordings: { select: { id: true }, take: 1 },
      },
    }),
    prisma.voiceCall.findMany({
      where: { workspaceId, startedAt: { gte: weekStart } },
      select: {
        startedAt: true,
        answeredAt: true,
        voicemailDetected: true,
        status: true,
      },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        startedAt: { gte: weekStart },
        answeredAt: null,
        voicemailDetected: false,
      },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        startedAt: { gte: weekStart },
        leadScore: { gte: 40 },
        appointmentBooked: false,
      },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        startedAt: { gte: weekStart },
        appointmentBooked: true,
      },
    }),
    prisma.automationFlow.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { name: true, status: true },
    }),
    prisma.campaign.findFirst({
      where: {
        workspaceId,
        status: { in: ["SENDING", "SCHEDULED"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        scheduledAt: true,
        configJson: true,
      },
    }),
    prisma.usageRecord.findFirst({
      where: { workspaceId },
      orderBy: { periodStart: "desc" },
    }),
    prisma.voiceCall.aggregate({
      where: { workspaceId, startedAt: { gte: start } },
      _sum: { durationSeconds: true, aiMinutes: true },
    }),
  ]);

  const recentCallRows = recentCalls as RecentCallRow[];
  const weekCallRows = weekCalls as WeekCallRow[];
  const activeFlowRows = activeFlows as AutomationFlowSummary[];

  const contactIds = [
    ...new Set(recentCallRows.map((c) => c.contactId).filter(Boolean) as string[]),
  ];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      })
    : [];
  const contactMap = new Map(
    (contacts as ContactSummary[]).map((c) => [c.id, c]),
  );

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const chartDays: OperationalDashboardData["chart"]["days"] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayCalls = weekCallRows.filter(
      (c) => c.startedAt >= dayStart && c.startedAt < dayEnd,
    );
    let answeredC = 0;
    let voicemailC = 0;
    let missedC = 0;
    for (const c of dayCalls) {
      const d = classifyDisposition(c);
      if (d === "answered") answeredC++;
      else if (d === "voicemail") voicemailC++;
      else missedC++;
    }
    chartDays.push({
      label: dayLabels[dayStart.getDay() === 0 ? 6 : dayStart.getDay() - 1],
      answered: answeredC,
      voicemail: voicemailC,
      missed: missedC,
    });
  }

  const phoneE164 =
    liveDeployments[0]?.phoneNumber?.e164 ||
    phoneNumbers[0]?.e164 ||
    metrics.activeNumber;
  const phoneDisplay =
    phoneE164 && phoneE164 !== "No number"
      ? maskPhoneDisplay(phoneE164)
      : "No number assigned";

  const attention: OperationalDashboardData["attention"] = [];
  if (missedWeekCount > 0) {
    attention.push({
      id: "missed",
      tone: "red",
      title: `${missedWeekCount} missed call${missedWeekCount === 1 ? "" : "s"}`,
      body: "Calls were missed outside of business hours.",
      actionLabel: "View Calls",
      href: "/voice/calls?filter=no_answer",
    });
  }
  if (pendingLeadsWeek > 0) {
    attention.push({
      id: "leads",
      tone: "yellow",
      title: `${pendingLeadsWeek} new lead${pendingLeadsWeek === 1 ? "" : "s"} to review`,
      body: "New leads need your follow-up.",
      actionLabel: "View Leads",
      href: "/voice/calls?filter=leads",
    });
  }
  if (confirmedApptsWeek > 0) {
    attention.push({
      id: "appointments",
      tone: "green",
      title: "All appointments confirmed",
      body: "Great job! No pending confirmations.",
      actionLabel: "View Appointments",
      href: "/integrations/native/appointments",
    });
  }
  if (!compliance.ready) {
    attention.push({
      id: "a2p",
      tone: "yellow",
      title: "A2P registration incomplete",
      body: "Finish registration to enable outbound SMS.",
      actionLabel: "Continue",
      href: "/compliance",
    });
  }
  if (attention.length === 0) {
    attention.push({
      id: "caught-up",
      tone: "green",
      title: "You're all caught up",
      actionLabel: "View Dashboard",
      href: "/outcomes",
    });
  }

  const recentRows = recentCallRows.map((call) => {
    const contact = call.contactId ? contactMap.get(call.contactId) : null;
    const name = contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
        fmtCallPhone(contact.phone ?? call.fromE164)
      : fmtCallPhone(call.fromE164);
    const summary =
      call.insights?.[0]?.summary ||
      call.insights?.[0]?.intent?.replace(/_/g, " ") ||
      call.outcome ||
      "Inbound call";
    const disposition = classifyDisposition(call);
    const duration =
      disposition === "missed"
        ? "—"
        : fmtCallDurationTable(call.durationSeconds);
    return {
      id: call.id,
      name,
      initials: initialsFromName(name),
      reason: String(summary).slice(0, 72),
      disposition,
      duration,
      timeLabel: formatCallTimeLabel(call.startedAt),
      href: `/voice/calls/${call.id}`,
      hasRecording: (call.recordings?.length ?? 0) > 0,
    };
  });

  const smsMessagesLimit = 5000;
  const smsMessagesUsed = usage?.outbound ?? metrics.messagesSentPeriod;
  const smsPct =
    smsMessagesLimit > 0
      ? Math.min(100, Math.round((smsMessagesUsed / smsMessagesLimit) * 100))
      : 0;

  let campaignMeta: OperationalDashboardData["smsPanel"]["campaign"] | undefined;
  if (activeCampaign) {
    const ends =
      activeCampaign.scheduledAt
        ? `Ends ${activeCampaign.scheduledAt.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`
        : undefined;
    campaignMeta = {
      name: activeCampaign.name,
      endsLabel: ends,
      href: `/campaigns/${activeCampaign.id}`,
    };
  }

  const receptionistMinutesLimit = 2000;
  const voiceSeconds = voiceMinutesAgg._sum.durationSeconds ?? 0;
  const aiMinutes = voiceMinutesAgg._sum.aiMinutes ?? 0;
  const receptionistMinutesUsed = Math.round(
    usage?.voiceMinutes ?? usage?.aiMinutes ?? aiMinutes ?? voiceSeconds / 60,
  );
  const receptionistPct = Math.min(
    100,
    Math.round((receptionistMinutesUsed / receptionistMinutesLimit) * 100),
  );

  const periodEnd = usage?.periodEnd ? new Date(usage.periodEnd) : null;
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000))
    : 14;

  const editHref = agentId
    ? `/voice/agents/${agentId}/about`
    : "/voice/receptionist";
  const testHref = agentId
    ? `/voice/agents/${agentId}/voice-test`
    : "/voice/agents";

  return {
    greeting: greetingForHour(now.getHours()),
    userName: userName.split(" ")[0] || userName,
    dateRange,
    receptionist: {
      name: agentName,
      active: agentActive,
      phoneDisplay,
      editHref,
      testHref,
    },
    sms: {
      ready: compliance.ready,
      label: compliance.ready ? "SMS Ready" : "SMS needs attention",
      sublabel: compliance.ready ? "A2P Registered" : "Complete registration",
      detail: compliance.ready
        ? "Your number is registered and ready to send SMS."
        : "Complete A2P registration to send campaigns.",
    },
    kpis: {
      callsAnswered: answered,
      callsAnsweredChangePct: pctChange(answered, prevAnswered),
      newLeads: leads,
      newLeadsChangePct: pctChange(leads, prevLeads),
      appointmentsBooked: appointments,
      appointmentsChangePct: pctChange(appointments, prevAppointments),
      messagesTaken: messagesTaken,
      messagesChangePct: pctChange(messagesTaken, prevMessages),
    },
    chart: { days: chartDays },
    attention,
    recentCalls: recentRows,
    smsPanel: {
      sent: metrics.messagesSentPeriod,
      replies: Math.round(metrics.messagesSentPeriod * (metrics.replyRate / 100)),
      messagesUsed: smsMessagesUsed,
      messagesLimit: smsMessagesLimit,
      messagesPct: smsPct,
      campaign: campaignMeta,
      empty: campaignMeta
        ? undefined
        : {
            title: "Reach your customers by text",
            body: "Send a broadcast or start a campaign.",
            actionLabel: "Send Message",
            href: "/send/quick",
          },
    },
    automationsPanel: {
      activeCount: activeFlowRows.length,
      flows: activeFlowRows.map((f) => ({
        name: f.name,
        active: f.status === "ACTIVE",
      })),
      href: "/automations",
    },
    planUsage: {
      receptionistMinutesUsed: receptionistMinutesUsed,
      receptionistMinutesLimit: receptionistMinutesLimit,
      receptionistPct,
      smsMessagesUsed: smsMessagesUsed,
      smsMessagesLimit: smsMessagesLimit,
      smsPct,
      daysLeftInCycle: daysLeft,
    },
  };
}
