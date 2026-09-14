/**
 * Canonical Telnyx tool webhook context — fast resolution, structured errors.
 */

import { getPrisma } from "@/lib/db";
import { backfillCallAni, findVoiceCallByTelnyxIds, normalizeCallerAni } from "@/lib/voice/call-identity";
import { ensureToolWebhookCallContext } from "@/lib/voice/tools/ensure-tool-webhook-call-context";
import {
  resolveInboundAniForToolWebhook,
} from "@/lib/voice/tools/workflow-tool-fast-path";
import {
  resolveTelnyxLegContext,
  upsertVoiceAiConversationLink,
} from "@/lib/voice/tools/telnyx-leg-conversation";

export type ToolWebhookContext = {
  workspaceId: string;
  agentId: string;
  toolType: string;
  callControlId: string;
  conversationId: string;
  callId?: string;
  callerE164: string;
  calledE164: string;
  timing: {
    ingressMs: number;
    legResolveMs: number;
    callEnsureMs: number;
    totalMs: number;
  };
};

export type ToolWebhookContextError = {
  ok: false;
  status: "invalid_input" | "not_allowed";
  result: string;
  speak: string;
  timingMs: number;
};

export async function resolveToolWebhookContext(input: {
  request: Request;
  body: Record<string, unknown>;
  workspaceId: string;
  agentId: string;
  toolType: string;
  ingressStartedAt: number;
}): Promise<ToolWebhookContext | ToolWebhookContextError> {
  const prisma = getPrisma();
  const t0 = Date.now();
  const callControlId =
    input.request.headers.get("x-telnyx-call-control-id")?.trim() ||
    String(input.body.call_control_id || input.body.callControlId || "");
  let conversationId =
    input.request.headers.get("x-telnyx-conversation-id")?.trim() ||
    String(input.body.conversation_id || input.body.telnyx_conversation_id || "");

  let inboundAni = resolveInboundAniForToolWebhook(input.request, input.body);
  let calledE164 = input.body.to
    ? String(input.body.to)
    : input.body.called
      ? String(input.body.called)
      : "";

  const tLeg = Date.now();
  if (callControlId && (!conversationId || !inboundAni)) {
    const leg = await resolveTelnyxLegContext(callControlId);
    if (leg) {
      if (!conversationId) conversationId = leg.conversationId;
      if (!inboundAni && leg.callerE164) inboundAni = leg.callerE164;
      if (!calledE164 && leg.calledE164) calledE164 = leg.calledE164;
    }
  }
  const legResolveMs = Date.now() - tLeg;

  if (!callControlId && !conversationId) {
    return {
      ok: false,
      status: "invalid_input",
      result: "call_context_missing",
      speak: "I can't match this call yet. Can I take a message instead?",
      timingMs: Date.now() - input.ingressStartedAt,
    };
  }

  const tCall = Date.now();
  let callId: string | undefined;
  if (callControlId || conversationId) {
    callId = await ensureToolWebhookCallContext({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callControlId: callControlId || undefined,
      conversationId: conversationId || undefined,
      inboundAni: inboundAni || undefined,
      toE164FromBody: calledE164 || undefined,
      skipRealtimeSessionInit: true,
    });
  }

  if (!callId) {
    const existing = await findVoiceCallByTelnyxIds({
      workspaceId: input.workspaceId,
      callControlId,
      conversationId,
      agentId: input.agentId,
    });
    callId = existing?.id;
  }

  if (callId && conversationId) {
    await upsertVoiceAiConversationLink({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId,
      callControlId: callControlId || null,
      leg: {
        conversationId,
        callerE164: inboundAni || null,
        calledE164: calledE164 || null,
        callSessionId: null,
      },
    }).catch(() => undefined);
  }

  if (callId && inboundAni) {
    await backfillCallAni({
      callId,
      workspaceId: input.workspaceId,
      fromE164: inboundAni,
      agentId: input.agentId,
    }).catch(() => undefined);
  }

  if (callId && callControlId) {
    await prisma.voiceCall
      .updateMany({
        where: { id: callId, telnyxCallControlId: null },
        data: { telnyxCallControlId: callControlId },
      })
      .catch(() => undefined);
  }

  if (!calledE164) {
    const { loadMctbLineInboundConfig } = await import("@/lib/mctb/inbound-handling/line-config");
    const line = await loadMctbLineInboundConfig({ workspaceId: input.workspaceId }).catch(() => null);
    if (line?.ingressE164) calledE164 = line.ingressE164;
  }

  if (callId && !inboundAni) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, workspaceId: input.workspaceId },
      select: { fromE164: true },
    });
    inboundAni = normalizeCallerAni(call?.fromE164) || "";
  }

  const callEnsureMs = Date.now() - tCall;

  if (!callId) {
    return {
      ok: false,
      status: "invalid_input",
      result: "voice_call_unresolved",
      speak: "I'm still connecting your call. Please try again in a moment.",
      timingMs: Date.now() - input.ingressStartedAt,
    };
  }

  const bookingTurn =
    input.toolType === "voice_ai_booking_turn" ||
    input.toolType === "calendar_availability" ||
    input.toolType === "book_appointment";

  if ((!inboundAni || inboundAni === "unknown") && !bookingTurn) {
    return {
      ok: false,
      status: "invalid_input",
      result: "caller_phone_missing",
      speak: "I don't have a good number to text. Can I take a message instead?",
      timingMs: Date.now() - input.ingressStartedAt,
    };
  }

  if (bookingTurn && (!inboundAni || inboundAni === "unknown")) {
    inboundAni = normalizeCallerAni(inboundAni) || "unknown";
  }

  return {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    toolType: input.toolType,
    callControlId,
    conversationId,
    callId,
    callerE164: inboundAni,
    calledE164,
    timing: {
      ingressMs: t0 - input.ingressStartedAt,
      legResolveMs,
      callEnsureMs,
      totalMs: Date.now() - input.ingressStartedAt,
    },
  };
}
