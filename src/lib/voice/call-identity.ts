/**
 * Canonical call identity helpers — one VoiceCall row per live Telnyx leg.
 * ANI backfill, session phone reseed, and safe lookup by provider ids.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { SYSTEM_FIELD_IDS } from "@/lib/voice/field-runtime/system-fields";
import {
  loadWorkflowFieldSession,
  saveWorkflowFieldSession,
  setSessionField,
} from "@/lib/voice/field-runtime/session";

export function normalizeCallerAni(raw: string | null | undefined): string | null {
  if (!raw || raw === "unknown") return null;
  try {
    return normalizeE164(String(raw).trim());
  } catch {
    const trimmed = String(raw).trim();
    return trimmed || null;
  }
}

export function isUnknownCallerId(value: string | null | undefined): boolean {
  return !value || value === "unknown";
}

/**
 * Patch fromE164 when currently unknown. Never overwrites a known number.
 */
export async function backfillCallAni(input: {
  callId: string;
  workspaceId: string;
  fromE164: string;
  agentId?: string;
}): Promise<boolean> {
  const normalized = normalizeCallerAni(input.fromE164);
  if (!normalized) return false;

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { fromE164: true },
  });
  if (!call) return false;

  let updated = false;
  if (isUnknownCallerId(call.fromE164)) {
    await prisma.voiceCall
      .update({
        where: { id: input.callId },
        data: { fromE164: normalized },
      })
      .catch(() => undefined);
    updated = true;
  }

  await reseedCallerPhoneInSession({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    phone: normalized,
  }).catch(() => undefined);

  return updated;
}

/** Seed sys_phone from ANI when the field session exists but phone is empty. */
export async function reseedCallerPhoneInSession(input: {
  callId: string;
  workspaceId: string;
  agentId?: string;
  phone: string;
}): Promise<void> {
  const phone = normalizeCallerAni(input.phone);
  if (!phone) return;

  let session = await loadWorkflowFieldSession(input.callId);
  if (!session) {
    const { ensureWorkflowFieldSession } = await import("@/lib/voice/field-runtime/session");
    session = await ensureWorkflowFieldSession({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow: "book_appointment",
    });
  }

  const existing = session.fields[SYSTEM_FIELD_IDS.phone]?.value;
  if (existing && String(existing).trim()) return;

  const now = new Date().toISOString();
  session = setSessionField(session, SYSTEM_FIELD_IDS.phone, phone, "caller_id", "Phone");
  session.derived.caller_phone = session.fields[SYSTEM_FIELD_IDS.phone];
  session.derived.source_number = session.fields[SYSTEM_FIELD_IDS.phone];
  session.updated_at = now;
  await saveWorkflowFieldSession(input.callId, session);
}

export async function findVoiceCallByTelnyxIds(input: {
  workspaceId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  agentId?: string | null;
}): Promise<{ id: string; telnyxConversationId: string | null } | null> {
  const prisma = getPrisma();

  if (input.callControlId) {
    const byControl = await prisma.voiceCall.findFirst({
      where: { workspaceId: input.workspaceId, telnyxCallControlId: input.callControlId },
      select: { id: true, telnyxConversationId: true },
    });
    if (byControl) return byControl;
  }

  if (input.conversationId) {
    const byConv = await prisma.voiceCall.findFirst({
      where: { workspaceId: input.workspaceId, telnyxConversationId: input.conversationId },
      orderBy: { startedAt: "desc" },
      select: { id: true, telnyxConversationId: true },
    });
    if (byConv) return byConv;
  }

  if (input.agentId) {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const recent = await prisma.voiceCall.findFirst({
      where: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        status: { in: ["IN_PROGRESS", "ANSWERED", "RINGING"] },
        startedAt: { gte: since },
        endedAt: null,
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, telnyxConversationId: true },
    });
    if (recent) return recent;
  }

  return null;
}
