/**
 * Low-latency Telnyx conversation-workflow tool webhooks (send_resource, search_business_details).
 */
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { executeBuiltinVoiceAction } from "@/lib/voice/tools/builtin-actions";
import { formatTelnyxToolPayload } from "@/lib/voice/telnyx/format-speak-text";
import {
  CANONICAL_AI_BOOKING_PUBLISHED_TOOL_KEYS,
  WORKFLOW_PUBLISHED_WEBHOOK_TOOLS,
} from "@/lib/voice/workflow-engine/tool-publish";
import { resolveToolWebhookContext } from "@/lib/voice/tools/tool-webhook-context";

export const WORKFLOW_FAST_TOOL_SET = new Set<string>([
  ...WORKFLOW_PUBLISHED_WEBHOOK_TOOLS,
  ...CANONICAL_AI_BOOKING_PUBLISHED_TOOL_KEYS,
]);

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

export async function handleWorkflowToolFastPath(input: {
  request: Request;
  body: Record<string, unknown>;
  workspaceId: string;
  agentId: string;
  toolType: string;
  ingressStartedAt?: number;
}): Promise<NextResponse | null> {
  if (!WORKFLOW_FAST_TOOL_SET.has(input.toolType)) return null;
  if (!input.workspaceId || !input.agentId) return null;

  const ingressStartedAt = input.ingressStartedAt ?? Date.now();
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

  let ctxOrErr: Awaited<ReturnType<typeof resolveToolWebhookContext>>;
  try {
    ctxOrErr = await resolveToolWebhookContext({
      request: input.request,
      body: input.body,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      toolType: input.toolType,
      ingressStartedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice/tool-fast-path] context_resolution_error", message);
    return telnyxJson({
      ok: false,
      status: "temporarily_unavailable",
      result: "tool_context_error",
      error: message,
      speak:
        input.toolType === "voice_ai_booking_turn"
          ? "I'm having trouble checking the calendar right now. I can take your preferred time and have someone call you back."
          : "I wasn't able to complete that just now. I can take a message for the team.",
      fast_path: true,
      timing_ms: Date.now() - ingressStartedAt,
    });
  }

  if ("ok" in ctxOrErr && ctxOrErr.ok === false) {
    return telnyxJson({
      ok: false,
      status: ctxOrErr.status,
      result: ctxOrErr.result,
      speak: ctxOrErr.speak,
      fast_path: true,
      timing_ms: ctxOrErr.timingMs,
    });
  }

  const ctx = ctxOrErr as import("@/lib/voice/tools/tool-webhook-context").ToolWebhookContext;
  const start = Date.now();

  const execution = await prisma.voiceToolExecution
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: ctx.callId || null,
        toolId: null,
        status: "running",
        input: {
          toolType: input.toolType,
          fastPath: true,
          callControlId: ctx.callControlId,
          conversationId: ctx.conversationId,
          timing: ctx.timing,
          ...input.body,
        } as object,
        isAsync: false,
      },
    })
    .catch(() => null);

  try {
    const result = (await executeBuiltinVoiceAction({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: ctx.callId,
      toolType: input.toolType,
      input: {
        ...input.body,
        call_control_id: ctx.callControlId || input.body.call_control_id,
        conversation_id: ctx.conversationId || input.body.conversation_id,
        telnyx_conversation_id: ctx.conversationId,
        from: ctx.callerE164 || input.body.from,
        caller_e164: ctx.callerE164,
        called_e164: ctx.calledE164,
        to: ctx.calledE164 || input.body.to,
      },
    })) as Record<string, unknown>;

    const processing =
      result.status === "PROCESSING" ||
      result.status === "OPERATION_PENDING" ||
      result.voice_booking_status === "OPERATION_PENDING" ||
      (result.data as Record<string, unknown> | undefined)?.processing === true;
    const opSucceeded = result.ok !== false && !processing;
    const latencyMs = Date.now() - start;
    if (execution) {
      await prisma.voiceToolExecution
        .update({
          where: { id: execution.id },
          data: {
            status: opSucceeded ? "completed" : "failed",
            output: result as object,
            errorMessage: opSucceeded ? null : String(result.error || result.result || "failed"),
            latencyMs,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }

    const speak =
      typeof result.speak === "string"
        ? result.speak
        : processing
          ? "Absolutely. Give me just a moment while I check that for you."
          : opSucceeded
            ? "Done."
            : "I wasn't able to complete that just now.";

    console.info(
      "[voice/tool-fast-path]",
      JSON.stringify({
        toolType: input.toolType,
        callId: ctx.callId,
        conversationId: ctx.conversationId,
        callControlId: ctx.callControlId,
        executionId: execution?.id,
        latencyMs,
        timing: ctx.timing,
        result: result.result,
        ok: opSucceeded,
      }),
    );

    if (
      input.toolType === "voice_ai_booking_turn" &&
      latencyMs > 8_000 &&
      ctx.callId &&
      typeof result.operationId === "string"
    ) {
      const { markHttpDeliveryTimeoutPreservingOperation } = await import(
        "@/lib/voice/ai-booking/durable-operation-delivery"
      );
      await markHttpDeliveryTimeoutPreservingOperation({
        callId: ctx.callId,
        operationId: String(result.operationId),
      }).catch(() => undefined);
    }

    return telnyxJson({
      ...result,
      ok: opSucceeded,
      speak,
      fast_path: true,
      latency_ms: latencyMs,
      executionId: execution?.id,
      callId: ctx.callId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const latencyMs = Date.now() - start;
    if (execution) {
      await prisma.voiceToolExecution
        .update({
          where: { id: execution.id },
          data: {
            status: "failed",
            errorMessage: message,
            latencyMs,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
    console.error("[voice/tool-fast-path] error", message);
    const speak =
      input.toolType === "voice_ai_booking_turn"
        ? "I'm having trouble checking the calendar right now. I can take your preferred time and have someone call you back."
        : input.toolType === "send_resource"
          ? "I wasn't able to send that text just now. I can take your information for a callback instead."
          : "I wasn't able to complete that just now. I can take a message for the team.";

    return telnyxJson({
      ok: false,
      status: "temporarily_unavailable",
      result: "tool_handler_error",
      error: message,
      speak,
      fast_path: true,
      latency_ms: latencyMs,
      executionId: execution?.id,
    });
  }
}
