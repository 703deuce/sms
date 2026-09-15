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
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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
  );

  const payload = formatVoiceV2TelnyxToolResponse(result);
  return NextResponse.json({
    ...payload,
    agent_id: agentId || null,
    call_id: callId,
    telnyx_to_transovo_ms: Date.now() - ingressStarted,
    transovo_total_ms: result.timing_ms.TOTAL_MS,
    transovo_microsoft_ms:
      result.timing_ms.TOKEN_MS + result.timing_ms.GRAPH_MS + result.timing_ms.AVAILABILITY_COMPUTE_MS,
  });
}
