/**
 * Unified contact timeline: SMS + softphone calls + AI voice calls + voicemail.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type TimelineCrmSync = {
  provider: string;
  externalUrl: string | null;
  syncStatus: string;
};

export type TimelineItem = {
  id: string;
  kind: "sms" | "call" | "voice_ai" | "voicemail";
  direction?: string | null;
  summary: string;
  status?: string | null;
  at: string;
  href?: string | null;
  crmSync?: TimelineCrmSync[];
  meta?: Record<string, unknown>;
};

const CRM_ACTIVITY_PROVIDERS = ["salesforce", "zoho", "pipedrive"];

export async function getContactActivityTimeline(
  workspaceId: string,
  contactId: string,
  limit = 80,
): Promise<TimelineItem[]> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, workspaceId },
  });
  if (!contact) return [];

  const phone = normalizeE164(contact.phone);
  const items: TimelineItem[] = [];

  const conversations = await prisma.conversation.findMany({
    where: { workspaceId, contactId },
    select: { id: true },
  });
  const conversationIds = conversations.map((c: { id: string }) => c.id);

  if (conversationIds.length) {
    const messages = await prisma.conversationMessage.findMany({
      where: { conversationId: { in: conversationIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    for (const m of messages) {
      items.push({
        id: `sms:${m.id}`,
        kind: "sms",
        direction: m.direction,
        summary: (m.body || "").slice(0, 160) || "(empty message)",
        status: m.status,
        at: new Date(m.createdAt).toISOString(),
        href: `/conversations?conversation=${m.conversationId}`,
        meta: { mediaUrl: m.mediaUrl || null },
      });
    }
  }

  const humanCalls = await prisma.humanCall.findMany({
    where: {
      workspaceId,
      OR: [{ contactId }, { from: phone }, { to: phone }],
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  for (const c of humanCalls) {
    items.push({
      id: `call:${c.id}`,
      kind: "call",
      direction: c.direction,
      summary: `${c.direction} call · ${c.status}${c.disposition ? ` · ${c.disposition}` : ""}`,
      status: c.status,
      at: new Date(c.startedAt).toISOString(),
      href: `/phone/calls/${c.id}`,
      meta: {
        recordingUrl: c.recordingUrl,
        aiSummary: c.aiSummary,
        transcriptText: c.transcriptText ? String(c.transcriptText).slice(0, 200) : null,
      },
    });
  }

  const voiceCalls = await prisma.voiceCall.findMany({
    where: {
      workspaceId,
      OR: [{ contactId }, { fromE164: phone }, { toE164: phone }],
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  for (const c of voiceCalls) {
    items.push({
      id: `voice:${c.id}`,
      kind: "voice_ai",
      direction: String(c.direction || "").toLowerCase(),
      summary: `AI voice · ${c.status}${c.outcome ? ` · ${c.outcome}` : ""}`,
      status: c.status,
      at: new Date(c.startedAt).toISOString(),
      href: `/voice/calls/${c.id}`,
      meta: { appointmentBooked: c.appointmentBooked, leadScore: c.leadScore },
    });
  }

  const voicemails = await prisma.voicemailMessage.findMany({
    where: {
      workspaceId,
      OR: [{ fromE164: phone }, { toE164: phone }],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  for (const v of voicemails) {
    items.push({
      id: `vm:${v.id}`,
      kind: "voicemail",
      direction: "inbound",
      summary: v.transcriptText
        ? `Voicemail: ${String(v.transcriptText).slice(0, 140)}`
        : "Voicemail message",
      status: v.isRead ? "read" : "unread",
      at: new Date(v.createdAt).toISOString(),
      href: "/phone/settings",
      meta: {
        recordingUrl: v.recordingUrl,
        durationSeconds: v.durationSeconds,
        humanCallId: v.humanCallId,
      },
    });
  }

  // Attach CRM-sync indicators so a call/SMS that was mirrored into a CRM shows
  // its source rather than appearing as a duplicate timeline entry.
  const callIds = items
    .filter((i) => i.kind === "call")
    .map((i) => i.id.slice("call:".length));
  const smsIds = items
    .filter((i) => i.kind === "sms")
    .map((i) => i.id.slice("sms:".length));

  if (callIds.length || smsIds.length) {
    const syncRows = await prisma.crmObjectMapping.findMany({
      where: {
        workspaceId,
        provider: { in: CRM_ACTIVITY_PROVIDERS },
        objectType: { in: ["call", "sms"] },
        internalId: { in: [...callIds, ...smsIds] },
      },
    });
    const byInternalId = new Map<string, TimelineCrmSync[]>();
    for (const row of syncRows as Array<{
      internalId: string;
      objectType: string;
      provider: string;
      externalUrl: string | null;
      syncStatus: string;
    }>) {
      const key = `${row.objectType}:${row.internalId}`;
      const list = byInternalId.get(key) || [];
      list.push({
        provider: row.provider,
        externalUrl: row.externalUrl,
        syncStatus: row.syncStatus,
      });
      byInternalId.set(key, list);
    }
    for (const item of items) {
      if (item.kind === "call") {
        const sync = byInternalId.get(`call:${item.id.slice("call:".length)}`);
        if (sync) item.crmSync = sync;
      } else if (item.kind === "sms") {
        const sync = byInternalId.get(`sms:${item.id.slice("sms:".length)}`);
        if (sync) item.crmSync = sync;
      }
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, limit);
}

/** Best-effort attach contactId on human calls by phone match. */
export async function resolveContactIdForPhone(workspaceId: string, phone: string) {
  const normalized = normalizeE164(phone);
  const contact = await getPrisma().contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: normalized } },
  });
  return contact?.id || null;
}
