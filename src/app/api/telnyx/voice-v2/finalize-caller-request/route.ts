import { NextResponse } from "next/server";
import { executeVoiceV2FinalizeCallerRequest } from "@/lib/voice-v2/finalize-caller-request";
import { resolveTrustedTransovoVoiceCallId } from "@/lib/voice-v2/intake/resolve-trusted-call-id";
import { VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

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
  if (toolType && toolType !== VOICE_V2_FINALIZE_CALLER_REQUEST_TOOL_TYPE) {
    return NextResponse.json({ ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" }, { status: 200 });
  }

  const callControlId =
    String(
      body.call_id ||
        body.callId ||
        body.call_control_id ||
        request.headers.get("x-telnyx-call-control-id") ||
        "",
    ).trim() || null;
  const conversationId = String(body.conversation_id || body.conversationId || "").trim() || null;
  const trustedVoiceCallId = resolveTrustedTransovoVoiceCallId({
    headers: request.headers,
    body,
  });
  const fromE164 = String(body.from || body.caller || body.from_e164 || "").trim() || null;

  const result = await executeVoiceV2FinalizeCallerRequest({
    workspaceId,
    agentId,
    callControlId,
    conversationId,
    voiceCallId: trustedVoiceCallId,
    fromE164,
    summary: body.summary ? String(body.summary) : undefined,
  });

  return NextResponse.json({
    ok:
      result.status === "CALLER_REQUEST_ACCEPTED" ||
      result.status === "FINALIZED" ||
      result.status === "ALREADY_FINALIZED",
    speak: result.speak,
    ...result,
  });
}
