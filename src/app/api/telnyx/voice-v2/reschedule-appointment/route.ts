import { NextResponse } from "next/server";
import { executeVoiceV2RescheduleAppointment } from "@/lib/voice-v2/appointment-changes/reschedule";
import { VOICE_V2_RESCHEDULE_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

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
  if (toolType && toolType !== VOICE_V2_RESCHEDULE_TOOL_TYPE) {
    return NextResponse.json(
      { ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" },
      { status: 200 },
    );
  }

  const callId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    "";

  const result = await executeVoiceV2RescheduleAppointment(
    { ...body, call_id: callId, agent_id: agentId },
    workspaceId,
    { agentId },
  );

  if (result.status === "RESCHEDULE_CONFIRMED") {
    return NextResponse.json({
      ok: true,
      voice_v2_status: "RESCHEDULE_CONFIRMED",
      event_id: result.event_id,
      speak: result.spoken_confirmation,
    });
  }
  if (result.status === "SLOT_UNAVAILABLE") {
    return NextResponse.json({
      ok: false,
      voice_v2_status: "SLOT_UNAVAILABLE",
      speak: "That time is no longer available. I can check other times.",
      error: result.error,
    });
  }
  return NextResponse.json({
    ok: false,
    voice_v2_status: result.status,
    error: result.error,
    speak: "I could not move that appointment. Let me take a message for the office.",
  });
}
