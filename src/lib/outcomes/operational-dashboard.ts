import { getPrisma } from "@/lib/db";
import {
  deriveCallOutcomeBadge,
  fmtCallDurationShort,
  fmtCallPhone,
  type CallOutcomeBadge,
} from "@/lib/voice/calls/display";
import { loadPrimaryVoiceAgentId } from "@/lib/voice/shell-nav";
import {
  loadComplianceOverview,
  loadDashboardMetrics,
} from "@/lib/workspace-data";

export type DashboardDateRange = "today" | "7d" | "30d";

export type AttentionTone = "red" | "yellow" | "green";

export type OperationalDashboardData = {
  greeting: string;
  userName: string;
  dateRange: DashboardDateRange;
  receptionist: {
    name: string;
    active: boolean;
    phoneDisplay: string;
    editHref: string;
    testHref: string;
  };
  sms: {
    ready: boolean;
    label: string;
    sublabel: string;
  };
  kpis: {
    callsAnswered: number;
    callsAnsweredChangePct: number | null;
    callsAnsweredHint: string;
    newLeads: number;
    newLeadsHint: string;
    appointmentsBooked: number;
    appointmentsHint: string;
    messagesTaken: number;
    messagesHint: string;
  };
  chart: {
    days: Array<{ label: string; leads: number; existing: number; other: number }>;
  };
  attention: Array<{
    id: string;
    tone: AttentionTone;
    title: string;
    body?: string;
    actionLabel: string;
    href: string;
  }>;
  recentCalls: Array<{
    id: string;
    name: string;
    reason: string;
    statusLabel: string;
    statusClass: string;
    duration: string;
    time: string;
    href: string;
    hasRecording: boolean;
  }>;
  smsPanel: {
    sent: number;
    replies: number;
    campaign?: {
      name: string;
      sent: number;
      total: number;
      pct: number;
      href: string;
    };
    empty?: { title: string; body: string; actionLabel: string; href: string };
  };
  automationsPanel: {
    activeCount: number;
    runsThisWeek: number;
    failedCount: number;
    flows: Array<{ name: string; status: string }>;
    href: string;
  };
  planUsage: {
    receptionistMinutesUsed: number;
    receptionistMinutesLimit: number;
    smsMessagesUsed: number;
    smsMessagesLimit: number;
    daysLeftInCycle: number;
  };
  isDemo: boolean;
};

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
  return formatted.replace(/\d{4}$/, "XXXX").replace(/-\d{4}$/, "-XXXX");
}

function statusLabel(badge: CallOutcomeBadge): string {
  if (badge === "Appointment Booked") return "Booked";
  if (badge === "Message Taken") return "Message";
  return badge;
}

function statusClass(badge: CallOutcomeBadge): string {
  switch (badge) {
    case "New Lead":
    case "Lead Captured":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    case "Appointment Booked":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    case "Spam":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "Message Taken":
      return "bg-indigo-50 text-indigo-700 ring-indigo-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function classifyChartBucket(call: {
  contactId: string | null;
  leadScore: number | null;
  outcome: string | null;
  appointmentBooked: boolean;
}): "leads" | "existing" | "other" {
  const outcome = String(call.outcome || "").toLowerCase();
  if (
    (call.leadScore != null && call.leadScore >= 40) ||
    outcome.includes("lead")
  ) {
    return "leads";
  }
  if (call.contactId) return "existing";
  return "other";
}

const DEMO_DATA: OperationalDashboardData = {
  greeting: "Good afternoon",
  userName: "Anthony",
  dateRange: "7d",
  receptionist: {
    name: "Amy",
    active: true,
    phoneDisplay: "(571) XXX-XXXX",
    editHref: "/voice/receptionist",
    testHref: "/voice/agents",
  },
  sms: { ready: true, label: "SMS Ready", sublabel: "A2P Registered" },
  kpis: {
    callsAnswered: 37,
    callsAnsweredChangePct: 12,
    callsAnsweredHint: "+12% vs last week",
    newLeads: 11,
    newLeadsHint: "Today",
    appointmentsBooked: 6,
    appointmentsHint: "This Week",
    messagesTaken: 14,
    messagesHint: "Today",
  },
  chart: {
    days: [
      { label: "M", leads: 4, existing: 3, other: 2 },
      { label: "T", leads: 5, existing: 4, other: 1 },
      { label: "W", leads: 3, existing: 5, other: 2 },
      { label: "T", leads: 6, existing: 3, other: 3 },
      { label: "F", leads: 4, existing: 6, other: 2 },
      { label: "S", leads: 2, existing: 2, other: 1 },
      { label: "S", leads: 1, existing: 1, other: 1 },
    ],
  },
  attention: [
    {
      id: "callbacks",
      tone: "red",
      title: "2 callers requested callbacks",
      actionLabel: "View Calls",
      href: "/voice/calls?filter=messages",
    },
    {
      id: "a2p",
      tone: "yellow",
      title: "A2P registration incomplete",
      body: "Finish registration to enable outbound SMS.",
      actionLabel: "Continue",
      href: "/compliance",
    },
    {
      id: "amy",
      tone: "yellow",
      title: "Amy couldn't answer 1 question this week",
      body: "Review and update business information.",
      actionLabel: "Review",
      href: "/voice/receptionist",
    },
    {
      id: "automations",
      tone: "green",
      title: "Automations healthy",
      actionLabel: "View Automations",
      href: "/automations",
    },
  ],
  recentCalls: [
    {
      id: "demo-call-jamie",
      name: "James Wilson",
      reason: "Furnace not heating — requested callback",
      statusLabel: "New Lead",
      statusClass: "bg-violet-50 text-violet-700 ring-violet-200",
      duration: "3m 42s",
      time: "2:34 PM",
      href: "/voice/calls/demo-call-jamie",
      hasRecording: true,
    },
    {
      id: "demo-call-1",
      name: "Sarah Miller",
      reason: "Booked service appointment for Friday",
      statusLabel: "Booked",
      statusClass: "bg-indigo-50 text-indigo-700 ring-indigo-200",
      duration: "4m 08s",
      time: "1:11 PM",
      href: "/voice/calls/demo-call-1",
      hasRecording: true,
    },
    {
      id: "demo-call-spam",
      name: "(571) 555-0128",
      reason: "Robocall detected",
      statusLabel: "Spam",
      statusClass: "bg-slate-100 text-slate-600 ring-slate-200",
      duration: "0m 12s",
      time: "12:45 PM",
      href: "/voice/calls",
      hasRecording: false,
    },
  ],
  smsPanel: {
    sent: 312,
    replies: 24,
    campaign: {
      name: "Spring Reactivation",
      sent: 428,
      total: 1200,
      pct: 36,
      href: "/campaigns",
    },
  },
  automationsPanel: {
    activeCount: 4,
    runsThisWeek: 128,
    failedCount: 2,
    flows: [
      { name: "Missed Call Text Back", status: "Active" },
      { name: "Appointment Reminder", status: "Active" },
    ],
    href: "/automations",
  },
  planUsage: {
    receptionistMinutesUsed: 327,
    receptionistMinutesLimit: 500,
    smsMessagesUsed: 1842,
    smsMessagesLimit: 5000,
    daysLeftInCycle: 14,
  },
  isDemo: true,
};

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

  const primaryAgentId = await loadPrimaryVoiceAgentId(workspaceId);

  const [metrics, compliance, callCount, agent, phoneNumbers, liveDeployments] =
    await Promise.all([
      loadDashboardMetrics(workspaceId),
      loadComplianceOverview(workspaceId),
      prisma.voiceCall.count({ where: { workspaceId, isTest: false } }),
      primaryAgentId
        ? prisma.voiceAgent.findUnique({
            where: { id: primaryAgentId },
            select: { id: true, name: true, status: true },
          })
        : Promise.resolve(null),
      prisma.phoneNumber.findMany({
        where: { workspaceId, status: "Active" },
        take: 1,
        select: { e164: true },
      }),
      prisma.triggerDeployment.findMany({
        where: { workspaceId, status: "live", channel: "voice" },
        take: 1,
        include: { phoneNumber: { select: { e164: true } } },
      }),
    ]);

  if (callCount === 0) {
    const demo = { ...DEMO_DATA };
    demo.greeting = greetingForHour(now.getHours());
    demo.userName = userName.split(" ")[0] || userName;
    demo.dateRange = dateRange;
    if (primaryAgentId) {
      demo.receptionist.editHref = `/voice/agents/${primaryAgentId}/about`;
      demo.receptionist.testHref = `/voice/agents/${primaryAgentId}/voice-test`;
    }
    if (compliance.ready) {
      demo.attention = demo.attention.filter((a) => a.id !== "a2p");
    }
    return demo;
  }

  const baseWhere = {
    workspaceId,
    isTest: false,
    startedAt: { gte: start },
  };

  const prevWhere = {
    workspaceId,
    isTest: false,
    startedAt: { gte: prevStart, lt: start },
  };

  const messageWhere = {
    ...baseWhere,
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
    recentCalls,
    weekCalls,
    callbackCount,
    activeFlows,
    failedExecutions,
    runsThisWeek,
    activeCampaign,
    usage,
    unansweredKnowledge,
  ] = await Promise.all([
    prisma.voiceCall.count({ where: { ...baseWhere, answeredAt: { not: null } } }),
    prisma.voiceCall.count({
      where: { ...baseWhere, leadScore: { gte: 40 } },
    }),
    prisma.voiceCall.count({ where: { ...baseWhere, appointmentBooked: true } }),
    prisma.voiceCall.count({ where: messageWhere }),
    prisma.voiceCall.count({
      where: { ...prevWhere, answeredAt: { not: null } },
    }),
    prisma.voiceCall.findMany({
      where: { workspaceId, isTest: false },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        insights: { orderBy: { createdAt: "desc" }, take: 1, select: { summary: true } },
        recordings: { select: { id: true }, take: 1 },
      },
    }),
    prisma.voiceCall.findMany({
      where: {
        workspaceId,
        isTest: false,
        startedAt: { gte: rangeStart("7d") },
      },
      select: {
        startedAt: true,
        contactId: true,
        leadScore: true,
        outcome: true,
        appointmentBooked: true,
      },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        isTest: false,
        startedAt: { gte: rangeStart("7d") },
        outcome: { contains: "callback", mode: "insensitive" },
      },
    }),
    prisma.automationFlow.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { name: true, status: true },
    }),
    prisma.automationExecution.count({
      where: {
        workspaceId,
        status: "FAILED",
        startedAt: { gte: rangeStart("7d") },
      },
    }),
    prisma.automationExecution.count({
      where: {
        workspaceId,
        startedAt: { gte: rangeStart("7d") },
      },
    }),
    prisma.campaign.findFirst({
      where: {
        workspaceId,
        status: { in: ["SENDING", "SCHEDULED"] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, sent: true, audience: true, configJson: true },
    }),
    prisma.usageRecord.findFirst({
      where: { workspaceId },
      orderBy: { periodStart: "desc" },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        isTest: false,
        startedAt: { gte: rangeStart("7d") },
        outcome: { contains: "unanswered", mode: "insensitive" },
      },
    }),
  ]);

  const contactIds = [
    ...new Set(recentCalls.map((c) => c.contactId).filter(Boolean) as string[]),
  ];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      })
    : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const chartDays: OperationalDashboardData["chart"]["days"] = [];
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayCalls = weekCalls.filter(
      (c) => c.startedAt >= dayStart && c.startedAt < dayEnd,
    );
    let leadsC = 0;
    let existingC = 0;
    let otherC = 0;
    for (const c of dayCalls) {
      const bucket = classifyChartBucket(c);
      if (bucket === "leads") leadsC++;
      else if (bucket === "existing") existingC++;
      else otherC++;
    }
    chartDays.push({
      label: dayLabels[dayStart.getDay() === 0 ? 6 : dayStart.getDay() - 1],
      leads: leadsC,
      existing: existingC,
      other: otherC,
    });
  }

  const answeredChange = pctChange(answered, prevAnswered);
  const kpiHints = {
    today: "Today",
    week: "This week",
    period: dateRange === "30d" ? "Last 30 days" : "Last 7 days",
  };

  const phoneE164 =
    liveDeployments[0]?.phoneNumber?.e164 ||
    phoneNumbers[0]?.e164 ||
    metrics.activeNumber;
  const phoneDisplay =
    phoneE164 && phoneE164 !== "No number"
      ? maskPhoneDisplay(phoneE164)
      : "No number assigned";

  const agentName = agent?.name?.split(" ")[0] || "Amy";
  const agentActive = agent?.status === "ACTIVE";

  const attention: OperationalDashboardData["attention"] = [];
  if (callbackCount > 0) {
    attention.push({
      id: "callbacks",
      tone: "red",
      title: `${callbackCount} caller${callbackCount === 1 ? "" : "s"} requested callbacks`,
      actionLabel: "View Calls",
      href: "/voice/calls?filter=messages",
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
  if (unansweredKnowledge > 0) {
    attention.push({
      id: "knowledge",
      tone: "yellow",
      title: `${agentName} couldn't answer ${unansweredKnowledge} question${unansweredKnowledge === 1 ? "" : "s"} this week`,
      body: "Review and update business information.",
      actionLabel: "Review",
      href: primaryAgentId
        ? `/voice/agents/${primaryAgentId}/about`
        : "/voice/receptionist",
    });
  }
  if (failedExecutions > 0) {
    attention.push({
      id: "automation-fail",
      tone: "yellow",
      title: `${failedExecutions} automation run${failedExecutions === 1 ? "" : "s"} failed`,
      actionLabel: "View Logs",
      href: "/automations/logs",
    });
  } else if (activeFlows.length > 0) {
    attention.push({
      id: "automations-ok",
      tone: "green",
      title: "Automations healthy",
      actionLabel: "View Automations",
      href: "/automations",
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

  const recentRows = recentCalls.map((call) => {
    const contact = call.contactId ? contactMap.get(call.contactId) : null;
    const name = contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || fmtCallPhone(contact.phone)
      : fmtCallPhone(call.fromE164);
    const summary =
      call.insights[0]?.summary ||
      call.outcome ||
      "Inbound call";
    const badge = deriveCallOutcomeBadge({
      outcome: call.outcome,
      appointmentBooked: call.appointmentBooked,
      transferred: call.transferred,
      voicemailDetected: call.voicemailDetected,
      leadScore: call.leadScore,
      status: call.status,
    });
    const time = new Date(call.startedAt).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return {
      id: call.id,
      name,
      reason: String(summary).slice(0, 80),
      statusLabel: statusLabel(badge),
      statusClass: statusClass(badge),
      duration: fmtCallDurationShort(call.durationSeconds),
      time,
      href: `/voice/calls/${call.id}`,
      hasRecording: call.recordings.length > 0,
    };
  });

  let campaignPanel: OperationalDashboardData["smsPanel"]["campaign"] | undefined;
  if (activeCampaign) {
    const cfg = (activeCampaign.configJson as { audienceSize?: number } | null) || {};
    const total = cfg.audienceSize || Math.max(activeCampaign.sent, 1200);
    campaignPanel = {
      name: activeCampaign.name,
      sent: activeCampaign.sent,
      total,
      pct: total > 0 ? Math.round((activeCampaign.sent / total) * 100) : 0,
      href: `/campaigns/${activeCampaign.id}`,
    };
  }

  const smsPanel: OperationalDashboardData["smsPanel"] = {
    sent: metrics.messagesSentPeriod,
    replies: Math.round(metrics.messagesSentPeriod * (metrics.replyRate / 100)),
    campaign: campaignPanel,
    empty: campaignPanel
      ? undefined
      : {
          title: "Reach your customers by text",
          body: "Send a broadcast or start a campaign.",
          actionLabel: "Send Message",
          href: "/send/quick",
        },
  };

  const periodEnd = usage?.periodEnd ? new Date(usage.periodEnd) : null;
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000))
    : 14;

  const editHref = primaryAgentId
    ? `/voice/agents/${primaryAgentId}/about`
    : "/voice/receptionist";
  const testHref = primaryAgentId
    ? `/voice/agents/${primaryAgentId}/voice-test`
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
      sublabel: compliance.ready ? "A2P Registered" : "Complete A2P registration",
    },
    kpis: {
      callsAnswered: answered,
      callsAnsweredChangePct: answeredChange,
      callsAnsweredHint:
        answeredChange != null
          ? `${answeredChange >= 0 ? "+" : ""}${answeredChange}% vs last period`
          : kpiHints.period,
      newLeads: leads,
      newLeadsHint: dateRange === "today" ? kpiHints.today : kpiHints.period,
      appointmentsBooked: appointments,
      appointmentsHint: dateRange === "today" ? kpiHints.today : kpiHints.week,
      messagesTaken: messagesTaken,
      messagesHint: dateRange === "today" ? kpiHints.today : kpiHints.period,
    },
    chart: { days: chartDays },
    attention,
    recentCalls: recentRows,
    smsPanel,
    automationsPanel: {
      activeCount: activeFlows.length,
      runsThisWeek,
      failedCount: failedExecutions,
      flows: activeFlows.slice(0, 2).map((f) => ({
        name: f.name,
        status: "Active",
      })),
      href: "/automations",
    },
    planUsage: {
      receptionistMinutesUsed: Math.round(usage?.voiceMinutes || usage?.aiMinutes || 0),
      receptionistMinutesLimit: 500,
      smsMessagesUsed: usage?.outbound || metrics.messagesSentPeriod,
      smsMessagesLimit: 5000,
      daysLeftInCycle: daysLeft,
    },
    isDemo: false,
  };
}
