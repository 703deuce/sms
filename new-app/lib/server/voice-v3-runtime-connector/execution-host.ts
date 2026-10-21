import "server-only";

/**
 * Single LiveKit tool execution host for new-app.
 * Core tool engine: synced mirror of src/lib/voice-v3 (see @transovo/voice-v3-runtime).
 */
import { executeNativeVoiceV3Tool } from "@/lib/server/voice-v3/execute-tool";
import type { LiveSessionRuntime } from "@/lib/server/receptionist/runtime/session-store";

export const VOICE_V3_EXECUTION_AUTHORITY =
  "src/lib/voice-v3 (synced → new-app/lib/server/voice-v3)";

export async function executeVoiceV3LiveKitToolForConnector(payload: {
  session: LiveSessionRuntime;
  toolName: string;
  args: Record<string, unknown>;
  functionCallId: string;
  delegationId?: string | null;
}) {
  return executeNativeVoiceV3Tool({
    session: payload.session,
    toolName: payload.toolName,
    args: payload.args,
    functionCallId: payload.functionCallId,
    delegationId: payload.delegationId ?? null,
  });
}
