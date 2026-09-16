import { NextResponse } from "next/server";
import { executeVoiceV2FindExistingAppointment } from "@/lib/voice-v2/appointment-changes/find-existing";
import { VOICE_V2_FIND_EXISTING_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

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
  if (toolType && toolType !== VOICE_V2_FIND_EXISTING_TOOL_TYPE) {
    return NextResponse.json(
      { ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" },
      { status: 200 },
    );
  }

  const callId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    "";

  const result = await executeVoiceV2FindExistingAppointment(
    { ...body, call_id: callId, agent_id: agentId },
    workspaceId,
    { agentId },
  );

  if (result.status === "FOUND_ONE") {
    return NextResponse.json({
      ok: true,
      voice_v2_status: "EXISTING_APPOINTMENT_FOUND",
      appointment_ref_id: result.appointment_ref_id,
      spoken_label: result.spoken_label,
      speak: `I found ${result.spoken_label}.`,
    });
  }
  if (result.status === "MULTIPLE") {
    return NextResponse.json({
      ok: true,
      voice_v2_status: "EXISTING_APPOINTMENT_MULTIPLE",
      choices: result.choices,
      speak: "I found more than one appointment. Which one are you changing?",
    });
  }
  if (result.status === "NONE") {
    return NextResponse.json({
      ok: true,
      voice_v2_status: "EXISTING_APPOINTMENT_NONE",
      speak: result.message,
    });
  }
  return NextResponse.json({
    ok: false,
    voice_v2_status: "ERROR",
    error: result.error,
    speak: "I could not look up appointments right now.",
  });
}
