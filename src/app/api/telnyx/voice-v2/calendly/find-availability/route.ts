import { NextResponse } from "next/server";
import { executeVoiceV2FindAvailability } from "@/lib/voice-v2/find-availability";
import { formatVoiceV2TelnyxToolResponse } from "@/lib/voice-v2/telnyx-response";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { resolveTrustedTransovoVoiceCallId } from "@/lib/voice-v2/intake/resolve-trusted-call-id";

/**
 * Telnyx FIND for wizard bookingStrategy CALENDLY only — not the frozen Microsoft 365 pipeline.
 */
export async function POST(request: Request) {
  const ingressStarted = Date.now();
  const webhookReceivedIso = new Date(ingressStarted).toISOString();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const telnyxToolCalledAt =
    request.headers.get("x-telnyx-request-timestamp") ||
    (body.telnyx_tool_called_at ? String(body.telnyx_tool_called_at) : null);
  const workspaceId = request.headers.get("x-transovo-workspace-id")?.trim() || "";
  const agentId = request.headers.get("x-transovo-agent-id")?.trim() || "";
  const toolType = request.headers.get("x-transovo-tool-type")?.trim() || "";

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, speak: "Workspace missing.", error: "workspace_required" },
      { status: 200 },
    );
  }
  if (toolType && toolType !== VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE) {
    return NextResponse.json(
      { ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" },
      { status: 200 },
    );
  }

  const callId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    null;
  const trustedPrismaCallId = resolveTrustedTransovoVoiceCallId({ headers: request.headers, body });

  if (agentId && (callId || trustedPrismaCallId)) {
    const { ensureVoiceV2CallContext } = await import("@/lib/voice-v2/intake/load-call-context");
    await ensureVoiceV2CallContext({
      workspaceId,
      agentId,
      callControlId: callId,
      trustedPrismaCallId,
      conversationId:
        typeof body.conversation_id === "string"
          ? body.conversation_id
          : request.headers.get("x-telnyx-conversation-id"),
    }).catch(() => undefined);
  }

  const result = await executeVoiceV2FindAvailability(
    { ...body, call_id: callId, agent_id: agentId },
    workspaceId,
    { voiceCallId: callId, trustedPrismaCallId },
  );

  if (result.status === "AVAILABILITY_FOUND" && callId) {
    const { patchWorkflowAfterFind } = await import("@/lib/voice-v2/booking-workflow-hooks");
    const requestedDate = String(body.requested_date ?? body.requestedDate ?? "");
    await patchWorkflowAfterFind({
      workspaceId,
      agentId,
      callControlId: callId,
      requestedDate,
      offerSetId: result.offer_set_id,
      slotIds: result.slots.map((s) => s.slot_id),
    }).catch(() => undefined);
  }

  const payload = formatVoiceV2TelnyxToolResponse(result);
  const httpResponseAtMs = Date.now();
  const { buildVoiceV2PstnTrace } = await import("@/lib/voice-v2/pstn-trace");
  const structuredArgs = {
    requested_date: body.requested_date ?? body.requestedDate,
    time_window: body.time_window ?? body.timeWindow,
    tool_invocation_id: body.tool_invocation_id ?? body.toolInvocationId,
  };
  const pstnTrace = buildVoiceV2PstnTrace({
    webhookReceivedAtMs: ingressStarted,
    telnyxToolCalledAt,
    structuredArgs,
    result,
    httpResponseAtMs,
    responsePayload: payload,
  });

  console.info("[voice-v2/calendly-pstn-trace]", JSON.stringify(pstnTrace));

  if (callId && workspaceId) {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    await prisma.auditLog
      .create({
        data: {
          workspaceId,
          event: "voice_v2.pstn_tool_trace",
          detail: JSON.stringify({
            callId,
            agentId,
            toolType: toolType || "voice_v2_find_availability",
            pipeline: "calendly",
            pstnTrace,
            webhookReceivedIso,
          }),
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({
    ...payload,
    agent_id: agentId || null,
    call_id: callId,
    booking_pipeline: "calendly",
    voice_v2_pstn_trace: pstnTrace,
    telnyx_to_transovo_ms: httpResponseAtMs - ingressStarted,
    transovo_total_ms: result.timing_ms.TOTAL_MS,
  });
}
