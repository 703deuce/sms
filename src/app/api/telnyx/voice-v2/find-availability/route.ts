import { NextResponse } from "next/server";
import { executePstnMicrosoftFindWithPeripheral } from "@/lib/voice-v2/pstn-microsoft-find";
import { formatVoiceV2TelnyxToolResponse } from "@/lib/voice-v2/telnyx-response";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

/**
 * Telnyx webhook — Microsoft 365 certified FIND only (06125f5f pipeline).
 * Other booking strategies use separate tools/pipelines; do not extend this route.
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
  const conversationId =
    typeof body.conversation_id === "string"
      ? body.conversation_id
      : request.headers.get("x-telnyx-conversation-id");
  const fromE164 = String(body.from || body.caller || "").trim();
  const requestedDate = body.requested_date ?? body.requestedDate;

  let result;
  if (agentId && callId) {
    const wrapped = await executePstnMicrosoftFindWithPeripheral(body, workspaceId, {
      agentId,
      callId,
      conversationId,
      fromE164: fromE164 || undefined,
      requestedDate,
    });
    if (wrapped.blocked) {
      const ms = Date.now() - ingressStarted;
      return NextResponse.json({
        ok: false,
        status: wrapped.status,
        voice_v2_status: wrapped.status,
        speak: wrapped.speak,
        error: wrapped.status,
        call_id: callId,
        booking_pipeline: "microsoft_365_certified",
        telnyx_to_transovo_ms: ms,
      });
    }
    result = wrapped.result;
  } else {
    const { executeMicrosoft365CertifiedFindAvailability } = await import(
      "@/lib/voice-v2/pipelines/microsoft-365-certified"
    );
    result = await executeMicrosoft365CertifiedFindAvailability(
      { ...body, call_id: callId },
      workspaceId,
      { voiceCallId: callId },
    );
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

  console.info("[voice-v2/pstn-trace]", JSON.stringify(pstnTrace));

  if (callId && workspaceId) {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    void prisma.auditLog
      .create({
        data: {
          workspaceId,
          event: "voice_v2.pstn_tool_trace",
          detail: JSON.stringify({
            callId,
            agentId,
            toolType: toolType || "voice_v2_find_availability",
            pipeline: "microsoft-365-certified",
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
    booking_pipeline: "microsoft_365_certified",
    voice_v2_pstn_trace: pstnTrace,
    telnyx_to_transovo_ms: httpResponseAtMs - ingressStarted,
    transovo_total_ms: result.timing_ms.TOTAL_MS,
    transovo_microsoft_ms:
      result.timing_ms.TOKEN_MS + result.timing_ms.GRAPH_MS + result.timing_ms.AVAILABILITY_COMPUTE_MS,
  });
}
