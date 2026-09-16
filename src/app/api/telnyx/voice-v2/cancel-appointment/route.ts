import { NextResponse } from "next/server";
import { executeVoiceV2CancelAppointment } from "@/lib/voice-v2/appointment-changes/cancel";
import { VOICE_V2_CANCEL_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

export async function POST(request: Request) {
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
  if (toolType && toolType !== VOICE_V2_CANCEL_TOOL_TYPE) {
    return NextResponse.json(
      { ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" },
      { status: 200 },
    );
  }

  const callId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    "";

  const result = await executeVoiceV2CancelAppointment(
    { ...body, call_id: callId, agent_id: agentId },
    workspaceId,
    { agentId },
  );

  if (result.status === "CANCEL_CONFIRMED") {
    return NextResponse.json({
      ok: true,
      voice_v2_status: "CANCEL_CONFIRMED",
      speak: result.spoken_confirmation,
    });
  }
  if (result.error === "caller_confirmation_required") {
    return NextResponse.json({
      ok: true,
      voice_v2_status: "CONFIRMATION_REQUIRED",
      speak: "Just to confirm — you want me to cancel that appointment, correct?",
    });
  }
  return NextResponse.json({
    ok: false,
    voice_v2_status: result.status,
    error: result.error,
    speak: "I could not cancel that appointment right now.",
  });
}
