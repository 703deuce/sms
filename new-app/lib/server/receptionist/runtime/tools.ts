import { getLiveSession } from "@/lib/server/receptionist/runtime/session-store";
import { executeVoiceV3LiveKitToolForConnector } from "@/lib/server/voice-v3-runtime-connector";
import { toolErr } from "@/lib/server/voice-v3/tool-result";

export async function executeVoiceV3ToolForNewApp(payload: {
  liveSessionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  functionCallId: string;
  delegationId?: string | null;
}): Promise<Record<string, unknown>> {
  const session = getLiveSession(payload.liveSessionId);
  if (!session) {
    return toolErr("RUNTIME_NOT_FOUND", "Session not found — worker must resolve session first.");
  }

  const result = await executeVoiceV3LiveKitToolForConnector({
    session,
    toolName: payload.toolName,
    args: payload.arguments,
    functionCallId: payload.functionCallId,
    delegationId: payload.delegationId ?? null,
  });
  return result as Record<string, unknown>;
}
