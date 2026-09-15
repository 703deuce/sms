import { NextResponse } from "next/server";
import { executeVoiceV2SaveIntakeFields } from "@/lib/voice-v2/intake/save-intake-fields";
import { formatVoiceV2SaveIntakeTelnyxResponse } from "@/lib/voice-v2/telnyx-save-intake-response";
import { VOICE_V2_SAVE_INTAKE_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { SaveIntakeTrace } from "@/lib/voice-v2/intake/save-intake-trace";
import { extractTelnyxTurnObservability } from "@/lib/voice-v2/pstn-turn-observability";

export async function POST(request: Request) {
  const ingressStarted = Date.now();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const telnyxTurn = extractTelnyxTurnObservability({ headers: request.headers, body });
  const trace = new SaveIntakeTrace();
  const workspaceId = request.headers.get("x-transovo-workspace-id")?.trim() || "";
  const agentId = request.headers.get("x-transovo-agent-id")?.trim() || "";
  const toolType = request.headers.get("x-transovo-tool-type")?.trim() || "";

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, speak: "Workspace missing.", error: "workspace_required" },
      { status: 200 },
    );
  }
  if (toolType && toolType !== VOICE_V2_SAVE_INTAKE_TOOL_TYPE) {
    return NextResponse.json(
      { ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" },
      { status: 200 },
    );
  }

  const callId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    null;

  const result = await executeVoiceV2SaveIntakeFields(
    {
      ...body,
      call_id: callId,
      conversation_id:
        body.conversation_id ||
        request.headers.get("x-telnyx-conversation-id") ||
        body.telnyx_conversation_id,
    },
    workspaceId,
    agentId,
    { trace },
  );

  const payload = formatVoiceV2SaveIntakeTelnyxResponse(result);
  const webhookMs = Date.now() - ingressStarted;

  const observabilityPayload =
    result.status === "INTAKE_SAVED" || result.status === "FIELD_NOT_ENABLED"
      ? {
          telnyx_turn: telnyxTurn,
          save_trace:
            result.observability?.trace ||
            ("observability" in result ? (result as { observability?: unknown }).observability : null),
          webhook_ms: webhookMs,
        }
      : { telnyx_turn: telnyxTurn, webhook_ms: webhookMs };

  console.info(
    "[voice-v2/intake-save]",
    JSON.stringify({
      status: result.status,
      timing_ms: "timing_ms" in result ? result.timing_ms : null,
      webhook_ms: webhookMs,
      save_sequence:
        result.status === "INTAKE_SAVED" || result.status === "FIELD_NOT_ENABLED"
          ? result.observability?.save_sequence
          : null,
      trace_spans:
        result.status === "INTAKE_SAVED" || result.status === "FIELD_NOT_ENABLED"
          ? result.observability?.trace.spans_ms
          : null,
    }),
  );

  if (callId && workspaceId) {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    await prisma.auditLog
      .create({
        data: {
          workspaceId,
          event: "voice_v2.intake_save_trace",
          detail: JSON.stringify({
            callId,
            agentId,
            status: result.status,
            observability: observabilityPayload,
          }),
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({
    ...payload,
    call_id: callId,
    telnyx_to_transovo_ms: webhookMs,
    voice_v2_observability: observabilityPayload,
  });
}
