import { getPrisma } from "@/lib/db";
import type {
  RealtorAmyActivityItem,
  RealtorAttentionKind,
  RealtorDashboardAppointment,
  RealtorLeadRow,
  RealtorLeadStatus,
  RealtorNeedsAttentionItem,
} from "./types";
import { loadRealtorProductConfig } from "./workspace-config";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function attentionKind(outcome: string | null, urgency: string): RealtorAttentionKind {
  if (outcome === "transfer_requested") return "transfer_missed";
  if (urgency === "high") return "hot_buyer";
  return "follow_up";
}

function formatIntentLabel(intent: string | undefined): string {
  if (!intent) return "";
  return intent.replace(/_/g, " ");
}

function leadSubtitle(lead: RealtorLeadRow): string | undefined {
  const parts: string[] = [];
  if (lead.intent) parts.push(formatIntentLabel(lead.intent));
  const budget = lead.collectedFields?.budget_or_price_range;
  const area = lead.collectedFields?.target_areas;
  if (budget) parts.push(budget);
  if (area) parts.push(area);
  return parts.length ? parts.join(" • ") : undefined;
}

function mapLeadStatus(raw: string | null | undefined, meta: Record<string, unknown>): RealtorLeadStatus {
  const reState = asRecord(meta.realEstateCallState);
  const leadStatus = String(reState.leadStatus || meta.leadStatus || raw || "").toLowerCase();
  if (leadStatus.includes("qualified")) return "qualified";
  if (leadStatus.includes("appointment")) return "appointment";
  if (leadStatus.includes("message")) return "contacted";
  if (leadStatus.includes("intake")) return "working";
  if (leadStatus.includes("not_interested")) return "closed";
  if (leadStatus.includes("nurture")) return "nurture";
  return "new";
}

export async function loadRealtorLeads(workspaceId: string): Promise<RealtorLeadRow[]> {
  const prisma = getPrisma();
  const [contacts, calls] = await Promise.all([
    prisma.contact.findMany({
      where: {
        workspaceId,
        NOT: { phone: { startsWith: "email:" } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        consentSource: true,
        createdAt: true,
      },
    }),
    prisma.voiceCall.findMany({
      where: { workspaceId },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: {
        id: true,
        contactId: true,
        fromE164: true,
        outcome: true,
        metadata: true,
        startedAt: true,
        endedAt: true,
      },
    }),
  ]);

  const callByContact = new Map<string, (typeof calls)[number]>();
  for (const call of calls) {
    if (call.contactId && !callByContact.has(call.contactId)) {
      callByContact.set(call.contactId, call);
    }
  }

  const rows: RealtorLeadRow[] = contacts.map((c: (typeof contacts)[number]) => {
    const call = callByContact.get(c.id);
    const meta = asRecord(call?.metadata);
    const reState = asRecord(meta.realEstateCallState);
    const collected = asRecord(reState.collectedFields) as Record<string, string>;
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown";
    return {
      id: c.id,
      name,
      phone: c.phone,
      email: c.email,
      status: mapLeadStatus(call?.outcome, meta),
      source: c.consentSource || String(meta.leadSource || "Direct"),
      intent: reState.primaryIntent ? String(reState.primaryIntent) : undefined,
      addedAt: c.createdAt.toISOString(),
      lastActivityAt: (call?.endedAt || call?.startedAt || c.createdAt).toISOString(),
      needsAttention: Boolean(meta.follow_up_required) || reState.leadStatus === "message_taken",
      collectedFields: collected,
    };
  });

  return rows.sort(
    (a, b) =>
      new Date(b.lastActivityAt || b.addedAt).getTime() -
      new Date(a.lastActivityAt || a.addedAt).getTime(),
  );
}

export async function loadRealtorNeedsAttention(
  workspaceId: string,
): Promise<RealtorNeedsAttentionItem[]> {
  const prisma = getPrisma();
  const [calls, audits] = await Promise.all([
    prisma.voiceCall.findMany({
      where: {
        workspaceId,
        OR: [
          { outcome: "message_taken" },
          { outcome: "transfer_requested" },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 50,
      select: {
        id: true,
        contactId: true,
        metadata: true,
        startedAt: true,
        outcome: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        workspaceId,
        event: {
          in: [
            "voice.real_estate.intake_complete",
            "voice.real_estate.message_taken",
            "voice.real_estate.transfer_requested",
            "voice.real_estate_lead_sync",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const items: RealtorNeedsAttentionItem[] = [];

  for (const call of calls) {
    const meta = asRecord(call.metadata);
    const reState = asRecord(meta.realEstateCallState);
    const name =
      String(reState.contactName || meta.callerName || "Caller").trim() || "Caller";
    const urgency = call.outcome === "transfer_requested" ? "high" : "normal";
    const intent = reState.primaryIntent ? formatIntentLabel(String(reState.primaryIntent)) : "";
    const subtitleParts = [intent].filter(Boolean);
    items.push({
      id: `call-${call.id}`,
      leadId: call.contactId || undefined,
      leadName: name,
      reason:
        call.outcome === "transfer_requested"
          ? "Amy attempted a live transfer"
          : "Follow up needed",
      detail:
        call.outcome === "transfer_requested"
          ? "Caller may still be waiting for a human."
          : String(asRecord(meta.structuredMessage).reason || "Message taken for the team."),
      subtitle: subtitleParts.join(" • ") || undefined,
      urgency,
      kind: attentionKind(call.outcome, urgency),
      createdAt: call.startedAt?.toISOString() || new Date().toISOString(),
      href: call.contactId ? `/realtor/leads/${call.contactId}` : `/phone/calls/${call.id}`,
    });
  }

  for (const audit of audits) {
    const detail = asRecord(JSON.parse(String(audit.detail || "{}")));
    if (detail.trigger === "intake_complete") continue;
    items.push({
      id: `audit-${audit.id}`,
      leadName: String(detail.name || detail.title || "Lead"),
      reason: "AI needs help",
      detail: String(detail.title || detail.reason || audit.event),
      urgency: "normal",
      kind: "ai_needs_help",
      createdAt: audit.createdAt.toISOString(),
      href: "/realtor/needs-attention",
    });
  }

  return items.slice(0, 20);
}

export async function loadRealtorAmyActivity(
  workspaceId: string,
): Promise<RealtorAmyActivityItem[]> {
  const prisma = getPrisma();
  const [activeCalls, recentAudits] = await Promise.all([
    prisma.voiceCall.findMany({
      where: {
        workspaceId,
        status: { in: ["RINGING", "IN_PROGRESS", "ANSWERED"] },
      },
      orderBy: { startedAt: "desc" },
      take: 5,
      select: { id: true, contactId: true, metadata: true, direction: true, startedAt: true },
    }),
    prisma.auditLog.findMany({
      where: {
        workspaceId,
        event: { startsWith: "voice.real_estate" },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const items: RealtorAmyActivityItem[] = activeCalls.map((call: (typeof activeCalls)[number]) => {
    const meta = asRecord(call.metadata);
    const reState = asRecord(meta.realEstateCallState);
    const contactName =
      String(reState.contactName || meta.callerName || "Lead").trim() || "Lead";
    return {
      id: call.id,
      title:
        call.direction === "INBOUND"
          ? contactName
          : contactName,
      detail:
        call.direction === "INBOUND"
          ? `Inbound call • ${reState.primaryIntent ? formatIntentLabel(String(reState.primaryIntent)) : "Front Desk"}`
          : `Speed-to-Lead • Attempt active`,
      kind: call.direction === "INBOUND" ? "inbound" : "calling",
      leadId: call.contactId || undefined,
      href: call.contactId ? `/realtor/leads/${call.contactId}` : `/phone/calls/${call.id}`,
      createdAt: call.startedAt?.toISOString() || new Date().toISOString(),
    };
  });

  for (const audit of recentAudits) {
    const detail = asRecord(JSON.parse(String(audit.detail || "{}")));
    items.push({
      id: audit.id,
      title: String(detail.title || audit.event),
      detail: String(detail.intents || detail.leadStatus || "Amy activity"),
      kind: audit.event.includes("appointment") ? "completed" : "following_up",
      createdAt: audit.createdAt.toISOString(),
    });
  }

  return items.slice(0, 12);
}

export async function loadUpcomingAppointments(
  workspaceId: string,
): Promise<RealtorDashboardAppointment[]> {
  const prisma = getPrisma();
  const now = new Date();
  const appointments = await prisma.voiceAppointment.findMany({
    where: { workspaceId, startsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    take: 8,
    select: {
      id: true,
      serviceName: true,
      startsAt: true,
      contactId: true,
      contact: { select: { firstName: true, lastName: true } },
    },
  });

  return appointments.map((appt: (typeof appointments)[number]) => {
    const name =
      [appt.contact?.firstName, appt.contact?.lastName].filter(Boolean).join(" ") || "Guest";
    return {
      id: appt.id,
      startsAt: appt.startsAt.toISOString(),
      serviceName: appt.serviceName || "Consultation",
      leadId: appt.contactId || undefined,
      leadName: name,
    };
  });
}

export function filterRealtorLeads(
  leads: RealtorLeadRow[],
  input: {
    view?: string;
    q?: string;
    status?: RealtorLeadStatus;
  },
): RealtorLeadRow[] {
  let rows = [...leads];
  const view = input.view || "all";

  if (view === "hot") {
    rows = rows.filter((l) => l.needsAttention || l.status === "qualified");
  } else if (view === "needs_attention") {
    rows = rows.filter((l) => l.needsAttention);
  } else if (view === "qualified") {
    rows = rows.filter((l) => l.status === "qualified");
  } else if (view === "appointments") {
    rows = rows.filter((l) => l.status === "appointment");
  } else if (view === "nurture") {
    rows = rows.filter((l) => l.status === "nurture");
  } else if (view === "new") {
    rows = rows.filter((l) => l.status === "new");
  } else if (view === "closed") {
    rows = rows.filter((l) => l.status === "closed");
  }

  if (input.status) {
    rows = rows.filter((l) => l.status === input.status);
  }

  const q = input.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.source?.toLowerCase().includes(q),
    );
  }

  return rows;
}

export async function loadRealtorDashboard(workspaceId: string, userName?: string) {
  const config = await loadRealtorProductConfig(workspaceId);
  const [leads, needsAttention, amyActivity, phone, agent, appointments] = await Promise.all([
    loadRealtorLeads(workspaceId),
    loadRealtorNeedsAttention(workspaceId),
    loadRealtorAmyActivity(workspaceId),
    getPrisma().phoneNumber.findFirst({
      where: { workspaceId },
      orderBy: { e164: "asc" },
      select: { e164: true },
    }),
    getPrisma().voiceAgent.findFirst({
      where: { workspaceId, status: "ACTIVE" },
      select: { id: true, name: true, draftConfig: true },
    }),
    loadUpcomingAppointments(workspaceId),
  ]);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLeads = leads.filter((l) => new Date(l.addedAt) >= since);
  const workedSince = leads.filter(
    (l) => l.status !== "new" && new Date(l.lastActivityAt || l.addedAt) >= since,
  );
  const conversations = leads.filter((l) =>
    ["contacted", "qualified", "appointment", "working"].includes(l.status),
  ).length;
  const qualified = leads.filter((l) => l.status === "qualified" || l.status === "appointment");

  const greetingName = userName?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? `Good morning, ${greetingName}!`
      : hour < 17
        ? `Good afternoon, ${greetingName}!`
        : `Good evening, ${greetingName}!`;

  const sourceMap = new Map<string, number>();
  for (const lead of recentLeads) {
    const src = lead.source || "Direct";
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
  }
  const leadSources = Array.from(sourceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const totalLeads = leads.length;
  const workedCount = leads.filter((l) => l.status !== "new").length;
  const convCount = conversations;
  const qualCount = qualified.length;
  const apptCount = leads.filter((l) => l.status === "appointment").length;

  const recentCalls = await getPrisma().voiceCall.findMany({
    where: { workspaceId, startedAt: { gte: since } },
    select: { durationSeconds: true },
  });
  const callStats = {
    count: recentCalls.length,
    avgDuration:
      recentCalls.length
        ? recentCalls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0) / recentCalls.length
        : 0,
  };

  const recentAudits = await getPrisma().auditLog.findMany({
    where: { workspaceId, event: { startsWith: "voice.real_estate" } },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const recentActivity = recentAudits.map((audit: (typeof recentAudits)[number]) => {
    const detail = asRecord(JSON.parse(String(audit.detail || "{}")));
    return {
      id: audit.id,
      title: String(detail.name || detail.title || audit.event.replace("voice.real_estate.", "")),
      at: audit.createdAt.toISOString(),
    };
  });

  return {
    config,
    greeting,
    amyWorkedSummary: `Amy has worked ${workedSince.length} leads for you since yesterday.`,
    setupMode: !config.onboardingComplete || !config.live,
    amy: {
      frontDeskActive: config.amyMode !== "speed_to_lead" && config.live,
      speedToLeadActive: config.amyMode !== "front_desk" && config.live,
      phoneE164: phone?.e164 || null,
      agentId: agent?.id || config.deployedAgentId || null,
      agentName: agent?.name || "Amy",
    },
    metrics: {
      newLeads: recentLeads.length,
      worked: workedSince.length,
      conversations,
      qualified: qualified.length,
      appointments: leads.filter((l) => l.status === "appointment").length,
      needYou: needsAttention.length,
    },
    metricHrefs: {
      newLeads: "/realtor/leads?view=new",
      worked: "/realtor/leads",
      conversations: "/realtor/leads?view=hot",
      qualified: "/realtor/leads?view=qualified",
      appointments: "/realtor/leads?view=appointments",
    },
    needsAttention,
    amyActivity,
    appointments,
    leads: leads.slice(0, 8).map((l) => ({ ...l, subtitle: leadSubtitle(l) })),
    leadSources,
    funnel: {
      leads: totalLeads || recentLeads.length,
      worked: workedCount,
      conversations: convCount,
      qualified: qualCount,
      appointments: apptCount,
    },
    aiPerformance: {
      totalCalls: callStats.count,
      avgDurationSec: Math.round(callStats.avgDuration),
      qualificationRate:
        workedCount > 0 ? Math.round((qualCount / workedCount) * 100) : 0,
      appointmentRate:
        qualCount > 0 ? Math.round((apptCount / qualCount) * 100) : 0,
    },
    recentActivity,
  };
}
