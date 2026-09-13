/**
 * Low-latency Telnyx conversation-workflow tool webhooks (send_resource, search_business_details).
 *
 * Live PSTN calls only send call_control_id + tool body — not the rich headers our tests inject.
 * Telnyx times out at timeout_ms (~12s) while the full /voice/tools route loads agent config,
 * bootstraps realtime sessions, and runs workflow refresh.
 */
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { backfillCallAni, findVoiceCallByTelnyxIds, normalizeCallerAni } from "@/lib/voice/call-identity";
import { executeBuiltinVoiceAction } from "@/lib/voice/tools/builtin-actions";
import { formatTelnyxToolPayload } from "@/lib/voice/telnyx/format-speak-text";
import { WORKFLOW_PUBLISHED_WEBHOOK_TOOLS } from "@/lib/voice/workflow-engine/tool-publish";
import { ensureToolWebhookCallContext } from "@/lib/voice/tools/ensure-tool-webhook-call-context";
import * as ai from "@/lib/voice/telnyx/ai-client";

export const WORKFLOW_FAST_TOOL_SET = new Set<string>(WORKFLOW_PUBLISHED_WEBHOOK_TOOLS);

function telnyxJson(payload: Record<string, unknown>) {
  return NextResponse.json(formatTelnyxToolPayload(payload), { status: 200 });
}

export function resolveInboundAniForToolWebhook(
  request: Request,
  body: Record<string, unknown>,
): string {
  const headerKeys = [
    "x-telnyx-from",
    "x-telnyx-caller-id",
    "x-telnyx-end-user-target",
    "x-telnyx-calling-number",
  ];
  for (const key of headerKeys) {
    const value = request.headers.get(key);
    if (value && value !== "unknown") return value;
  }
  for (const key of ["from", "caller", "caller_id", "from_number", "telnyx_end_user_target"]) {
    const fromBody = body[key];
    if (fromBody && String(fromBody) !== "unknown") return String(fromBody);
  }
  return "";
}

async function resolveAniFromExistingCall(input: {
  workspaceId: string;
  callControlId?: string;
  conversationId?: string;
}): Promise<string | null> {
  const row = await findVoiceCallByTelnyxIds({
    workspaceId: input.workspaceId,
    callControlId: input.callControlId || null,
    conversationId: input.conversationId || null,
    agentId: null,
  });
  if (!row) return null;
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: row.id, workspaceId: input.workspaceId },
    select: { fromE164: true },
  });
  return normalizeCallerAni(call?.fromE164);
}

/** Telnyx tool webhooks often omit caller headers; conversation metadata has ANI. */
async function resolveAniFromTelnyxConversation(callControlId: string): Promise<string | null> {
  if (!callControlId.trim()) return null;
  try {
    const listed = await ai.listConversations({ "page[size]": 25 });
    const data = (listed as { data?: unknown[] }).data;
    if (!Array.isArray(data)) return null;
    for (const raw of data) {
      const conv = raw as Record<string, unknown>;
      const meta = (conv.metadata || {}) as Record<string, unknown>;
      if (String(meta.call_control_id || "") !== callControlId) continue;
      const ani = normalizeCallerAni(
        String(meta.telnyx_end_user_target || meta.from || ""),
      );
      if (ani) return ani;
    }
  } catch {
    return null;
  }
  return null;
}

export async function handleWorkflowToolFastPath(input: {
  request: Request;
  body: Record<string, unknown>;
  workspaceId: string;
  agentId: string;
  toolType: string;
}): Promise<NextResponse | null> {
  if (!WORKFLOW_FAST_TOOL_SET.has(input.toolType)) return null;
  if (!input.workspaceId || !input.agentId) return null;

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!agent) {
    return telnyxJson({
      ok: false,
      error: "agent not found",
      speak: "I'm not able to do that right now.",
    });
  }

  const callControlId =
    input.request.headers.get("x-telnyx-call-control-id")?.trim() ||
    String(input.body.call_control_id || input.body.callControlId || "");
  const conversationId =
    input.request.headers.get("x-telnyx-conversation-id")?.trim() ||
    String(input.body.conversation_id || input.body.telnyx_conversation_id || "");
  const toE164FromBody = input.body.to
    ? String(input.body.to)
    : input.body.called
      ? String(input.body.called)
      : "";

  let inboundAni = resolveInboundAniForToolWebhook(input.request, input.body);
  if (!inboundAni && callControlId) {
    inboundAni =
      (await resolveAniFromExistingCall({
        workspaceId: input.workspaceId,
        callControlId,
        conversationId: conversationId || undefined,
      })) ||
      (await resolveAniFromTelnyxConversation(callControlId)) ||
      "";
  }

  let callId: string | undefined;
  if (callControlId || conversationId) {
    callId = await ensureToolWebhookCallContext({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callControlId: callControlId || undefined,
      conversationId: conversationId || undefined,
      inboundAni: inboundAni || undefined,
      toE164FromBody: toE164FromBody || undefined,
      skipRealtimeSessionInit: true,
    });
  }

  if (callId && inboundAni) {
    await backfillCallAni({
      callId,
      workspaceId: input.workspaceId,
      fromE164: inboundAni,
      agentId: input.agentId,
    }).catch(() => undefined);
  }

  let calledE164ForTool = toE164FromBody;
  if (!calledE164ForTool) {
    const { loadMctbLineInboundConfig } = await import("@/lib/mctb/inbound-handling/line-config");
    const line = await loadMctbLineInboundConfig({ workspaceId: input.workspaceId }).catch(() => null);
    if (line?.ingressE164) calledE164ForTool = line.ingressE164;
  }

  const start = Date.now();
  const execution = await prisma.voiceToolExecution
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: callId || null,
        toolId: null,
        status: "running",
        input: { toolType: input.toolType, fastPath: true, ...input.body } as object,
        isAsync: false,
      },
    })
    .catch(() => null);

  try {
    const result = (await executeBuiltinVoiceAction({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId,
      toolType: input.toolType,
      input: {
        ...input.body,
        call_control_id: callControlId || input.body.call_control_id,
        conversation_id: conversationId || input.body.conversation_id,
        telnyx_conversation_id: conversationId,
        from: inboundAni || input.body.from,
        caller_e164: inboundAni,
        called_e164: calledE164ForTool,
        to: calledE164ForTool || input.body.to,
      },
    })) as Record<string, unknown>;

    const opSucceeded = result.ok !== false;
    if (execution) {
      await prisma.voiceToolExecution
        .update({
          where: { id: execution.id },
          data: {
            status: opSucceeded ? "completed" : "failed",
            output: result as object,
            errorMessage: opSucceeded ? null : String(result.error || result.result || "failed"),
            latencyMs: Date.now() - start,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }

    const speak =
      typeof result.speak === "string"
        ? result.speak
        : opSucceeded
          ? "Done."
          : "I wasn't able to complete that just now.";

    return telnyxJson({
      ...result,
      ok: opSucceeded,
      speak,
      fast_path: true,
      latency_ms: Date.now() - start,
      executionId: execution?.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (execution) {
      await prisma.voiceToolExecution
        .update({
          where: { id: execution.id },
          data: {
            status: "failed",
            errorMessage: message,
            latencyMs: Date.now() - start,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
    return telnyxJson({
      ok: false,
      error: message,
      speak: "I wasn't able to send that text just now. I can take your information for a callback instead.",
      fast_path: true,
    });
  }
}
