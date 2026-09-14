/**
 * Resolve Telnyx AI conversation + caller ANI from a voice call_control_id.
 * PSTN tool webhooks often omit conversation_id and caller headers.
 */

import { getPrisma } from "@/lib/db";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import * as ai from "@/lib/voice/telnyx/ai-client";

export type TelnyxLegContext = {
  conversationId: string;
  callerE164: string | null;
  calledE164: string | null;
  callSessionId: string | null;
};

async function fromDbByControlId(
  callControlId: string,
  workspaceId?: string,
): Promise<TelnyxLegContext | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: {
      telnyxCallControlId: callControlId,
      ...(workspaceId ? { workspaceId } : {}),
    },
    select: {
      telnyxConversationId: true,
      fromE164: true,
      toE164: true,
      telnyxCallSessionId: true,
    },
  });
  if (call?.telnyxConversationId) {
    return {
      conversationId: call.telnyxConversationId,
      callerE164: normalizeCallerAni(call.fromE164),
      calledE164: call.toE164 || null,
      callSessionId: call.telnyxCallSessionId,
    };
  }

  const aiConvs = await prisma.voiceAiConversation.findMany({
    where: {
      telnyxConversationId: { not: null },
      ...(workspaceId ? { workspaceId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { telnyxConversationId: true, metadata: true },
  });
  const aiConv = aiConvs.find((row) => {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    return String(meta.call_control_id || "") === callControlId;
  });
  if (aiConv?.telnyxConversationId) {
    const meta = (aiConv.metadata || {}) as Record<string, unknown>;
    return {
      conversationId: aiConv.telnyxConversationId,
      callerE164: normalizeCallerAni(
        String(meta.telnyx_end_user_target || meta.from || ""),
      ),
      calledE164: String(meta.to || meta.telnyx_agent_target || "") || null,
      callSessionId: String(meta.call_session_id || "") || null,
    };
  }
  return null;
}

async function fromTelnyxApi(callControlId: string): Promise<TelnyxLegContext | null> {
  try {
    const listed = await ai.listConversations({ "page[size]": 40 });
    const data = (listed as { data?: unknown[] }).data;
    if (!Array.isArray(data)) return null;
    for (const raw of data) {
      const conv = raw as Record<string, unknown>;
      const id = String(conv.id || "");
      const meta = (conv.metadata || {}) as Record<string, unknown>;
      if (String(meta.call_control_id || "") !== callControlId) continue;
      return {
        conversationId: id,
        callerE164: normalizeCallerAni(
          String(meta.telnyx_end_user_target || meta.from || ""),
        ),
        calledE164: String(meta.to || meta.telnyx_agent_target || "") || null,
        callSessionId: String(meta.call_session_id || "") || null,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function resolveTelnyxLegContext(
  callControlId: string,
  workspaceId?: string,
): Promise<TelnyxLegContext | null> {
  const trimmed = callControlId.trim();
  if (!trimmed) return null;
  const db = await fromDbByControlId(trimmed, workspaceId);
  if (db?.conversationId) return db;
  return fromTelnyxApi(trimmed);
}

export async function upsertVoiceAiConversationLink(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  callControlId?: string | null;
  leg: TelnyxLegContext;
}): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.voiceAiConversation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      telnyxConversationId: input.leg.conversationId,
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.voiceAiConversation.update({
      where: { id: existing.id },
      data: {
        callId: input.callId,
        agentId: input.agentId,
        metadata: {
          from: input.leg.callerE164,
          to: input.leg.calledE164,
          call_session_id: input.leg.callSessionId,
          call_control_id: input.callControlId || undefined,
        } as object,
      },
    });
  } else {
    await prisma.voiceAiConversation.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        telnyxConversationId: input.leg.conversationId,
        metadata: {
          from: input.leg.callerE164,
          to: input.leg.calledE164,
          call_session_id: input.leg.callSessionId,
          call_control_id: input.callControlId || undefined,
        } as object,
      },
    });
  }

  await prisma.voiceCall
    .updateMany({
      where: { id: input.callId, telnyxConversationId: null },
      data: {
        telnyxConversationId: input.leg.conversationId,
        ...(input.leg.callSessionId ? { telnyxCallSessionId: input.leg.callSessionId } : {}),
      },
    })
    .catch(() => undefined);
}
