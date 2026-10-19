import { getLiveSession } from "@/lib/server/receptionist/runtime/session-store";
import { executeNativeVoiceV3Tool } from "@/lib/server/voice-v3/execute-tool";
import { toolErr } from "@/lib/server/voice-v3/tool-result";

export async function executeVoiceV3ToolForNewApp(payload: {
  liveSessionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  functionCallId: string;
}): Promise<Record<string, unknown>> {
  const session = getLiveSession(payload.liveSessionId);
  if (!session) {
    return toolErr("RUNTIME_NOT_FOUND", "Session not found — worker must resolve session first.");
  }

  const result = await executeNativeVoiceV3Tool({
    session,
    toolName: payload.toolName,
    args: payload.arguments,
    functionCallId: payload.functionCallId,
  });
  return result as Record<string, unknown>;
}
