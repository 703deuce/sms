import { NextResponse } from "next/server";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-v2/after-hours-handling-config";
import { executeVoiceV2TransferCall } from "@/lib/voice-v2/transfer-call";
import { VoiceV2TelnyxCallControlTransferProvider } from "@/lib/voice-v2/transfer/telnyx-transfer-provider";
import { VOICE_V2_TRANSFER_CALL_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

const transferProvider = new VoiceV2TelnyxCallControlTransferProvider();

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
  if (toolType && toolType !== VOICE_V2_TRANSFER_CALL_TOOL_TYPE) {
    return NextResponse.json({ ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" }, {
      status: 200,
    });
  }

  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  const config = parseVoiceAgentConfig(runtime);
  const handling = resolveAfterHoursHandlingFromAgentConfig(config);
  if (!handling?.transferEnabled) {
    return NextResponse.json({
      ok: false,
      speak: "Transfer is not available on this line.",
      voice_v2_status: "TRANSFER_DISABLED",
    });
  }

  const callId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    null;
  const conversationId = String(body.conversation_id || body.conversationId || "").trim() || null;
  const invocationId = String(body.tool_invocation_id || body.toolInvocationId || callId || "inv");

  const result = await executeVoiceV2TransferCall({
    workspaceId,
    agentId,
    callControlId: callId,
    conversationId,
    invocationId,
    transferPlanId: body.transfer_plan_id ? String(body.transfer_plan_id) : undefined,
    callerRequested: body.caller_requested_human === true,
    destinationPhone: body.destination_phone ? String(body.destination_phone) : undefined,
    config: handling,
    provider: transferProvider,
  });

  return NextResponse.json(result);
}
