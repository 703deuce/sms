import { NextResponse } from "next/server";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-v2/after-hours-handling-config";
import { executeVoiceV2CreateCallbackRequest } from "@/lib/voice-v2/callback-request";
import { VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = request.headers.get("x-transovo-workspace-id")?.trim() || "";
  const agentId = request.headers.get("x-transovo-agent-id")?.trim() || "";
  const toolType = request.headers.get("x-transovo-tool-type")?.trim() || "";

  if (!workspaceId || !agentId) {
    return NextResponse.json(
      { ok: false, speak: "Configuration missing.", error: "workspace_or_agent_required" },
      { status: 200 },
    );
  }
  if (toolType && toolType !== VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE) {
    return NextResponse.json({ ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" }, {
      status: 200,
    });
  }

  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  const config = parseVoiceAgentConfig(runtime);
  const handling = resolveAfterHoursHandlingFromAgentConfig(config);
  if (!handling) {
    return NextResponse.json({
      ok: false,
      speak: "Callback is not configured.",
      voice_v2_status: "CALLBACK_DISABLED",
    });
  }

  const callId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    null;
  const conversationId = String(body.conversation_id || body.conversationId || "").trim() || null;
  const invocationId = String(body.tool_invocation_id || body.toolInvocationId || callId || "inv");

  const result = await executeVoiceV2CreateCallbackRequest({
    workspaceId,
    agentId,
    callControlId: callId,
    conversationId,
    voiceCallId: callId,
    invocationId,
    callbackNumberOverride: body.callback_number ? String(body.callback_number) : undefined,
    callbackPreference: body.callback_preference ? String(body.callback_preference) : undefined,
    config: handling,
  });

  return NextResponse.json({ ok: result.status === "CALLBACK_REQUESTED", ...result });
}
