import { NextResponse } from "next/server";
import { executeVoiceV2FindAvailability } from "@/lib/voice-v2/find-availability";
import { formatVoiceV2TelnyxToolResponse } from "@/lib/voice-v2/telnyx-response";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

/**
 * Isolated Telnyx webhook for Voice Booking V2 (FIND_AVAILABILITY only).
 * Does not use legacy /api/telnyx/voice/tools routing.
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

  const result = await executeVoiceV2FindAvailability(
    {
      ...body,
      call_id: callId,
    },
    workspaceId,
    { voiceCallId: callId },
  );

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
    await prisma.auditLog
      .create({
        data: {
          workspaceId,
          event: "voice_v2.pstn_tool_trace",
          detail: JSON.stringify({
            callId,
            agentId,
            toolType: toolType || "voice_v2_find_availability",
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
    voice_v2_pstn_trace: pstnTrace,
    telnyx_to_transovo_ms: httpResponseAtMs - ingressStarted,
    transovo_total_ms: result.timing_ms.TOTAL_MS,
    transovo_microsoft_ms:
      result.timing_ms.TOKEN_MS + result.timing_ms.GRAPH_MS + result.timing_ms.AVAILABILITY_COMPUTE_MS,
  });
}
