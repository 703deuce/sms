import { getPrisma } from "@/lib/db";
import type {
  RealtorAmyActivityItem,
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
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        consentSource: true,
        createdAt: true,
        updatedAt: true,
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
      lastActivityAt: (call?.endedAt || call?.startedAt || c.updatedAt).toISOString(),
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
    const reason =
      call.outcome === "transfer_requested"
        ? "Transfer requested"
        : "Message taken — follow up needed";
    items.push({
      id: `call-${call.id}`,
      leadId: call.contactId || undefined,
      leadName: name,
      reason,
      detail: String(asRecord(meta.structuredMessage).reason || reason),
      urgency: call.outcome === "transfer_requested" ? "high" : "normal",
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
      reason: audit.event.replace("voice.real_estate.", "").replace(/_/g, " "),
      detail: String(detail.title || detail.reason || audit.event),
      urgency: "normal",
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
      select: { id: true, metadata: true, direction: true, startedAt: true },
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
    return {
      id: call.id,
      title: call.direction === "INBOUND" ? "Front Desk on inbound call" : "Speed-to-Lead calling",
      detail: reState.primaryIntent
        ? `${String(reState.primaryIntent)} inquiry`
        : "Active voice session",
      kind: call.direction === "INBOUND" ? "front_desk" : "calling",
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

export async function loadRealtorDashboard(workspaceId: string) {
  const config = await loadRealtorProductConfig(workspaceId);
  const [leads, needsAttention, amyActivity, phone, agent] = await Promise.all([
    loadRealtorLeads(workspaceId),
    loadRealtorNeedsAttention(workspaceId),
    loadRealtorAmyActivity(workspaceId),
    getPrisma().phoneNumber.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { e164: true },
    }),
    getPrisma().voiceAgent.findFirst({
      where: { workspaceId, status: "ACTIVE" },
      select: { id: true, name: true, draftConfig: true },
    }),
  ]);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLeads = leads.filter((l) => new Date(l.addedAt) >= since);
  const qualified = leads.filter((l) => l.status === "qualified" || l.status === "appointment");

  return {
    config,
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
      worked: leads.filter((l) => l.status !== "new").length,
      contacted: leads.filter((l) =>
        ["contacted", "qualified", "appointment", "working"].includes(l.status),
      ).length,
      qualified: qualified.length,
      appointments: leads.filter((l) => l.status === "appointment").length,
      needYou: needsAttention.length,
    },
    needsAttention,
    amyActivity,
    leads: leads.slice(0, 10),
  };
}
