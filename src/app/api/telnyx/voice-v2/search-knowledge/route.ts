import { NextResponse } from "next/server";
import { VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { executeVoiceV2SearchKnowledge } from "@/lib/voice-v2/search-knowledge";
import { resolveSessionKey } from "@/lib/voice-v2/intake/load-call-context";
import { getVoiceV2CallContext } from "@/lib/voice-v2/intake/session-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = request.headers.get("x-transovo-workspace-id")?.trim() || "";
  const agentId = request.headers.get("x-transovo-agent-id")?.trim() || "";
  const toolType = request.headers.get("x-transovo-tool-type")?.trim() || "";

  if (!workspaceId || !agentId) {
    return NextResponse.json(
      { ok: false, error: "workspace_or_agent_required", speak: "I could not look that up right now." },
      { status: 200 },
    );
  }
  if (toolType && toolType !== VOICE_V2_SEARCH_KNOWLEDGE_TOOL_TYPE) {
    return NextResponse.json(
      { ok: false, error: "tool_type_mismatch", speak: "Wrong tool." },
      { status: 200 },
    );
  }

  const callControlId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    null;
  const sessionKey = resolveSessionKey({
    callControlId,
    conversationId: String(
      body.conversation_id || request.headers.get("x-telnyx-conversation-id") || "",
    ),
  });
  const ctx = sessionKey ? getVoiceV2CallContext(sessionKey) : null;

  const result = await executeVoiceV2SearchKnowledge(body, workspaceId, agentId, {
    ctx,
    voiceCallId: callControlId,
  });

  const ok = result.status === "FOUND";
  return NextResponse.json(
    {
      ok,
      voice_v2_status: result.status,
      answerable: "answerable" in result ? result.answerable : false,
      results: "results" in result ? result.results : [],
      knowledge_revision: "knowledge_revision" in result ? result.knowledge_revision : undefined,
      speak: result.speak_hint,
      error: "error" in result ? result.error : undefined,
    },
    { status: 200 },
  );
}
