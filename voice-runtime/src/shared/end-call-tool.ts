import { beta } from "@livekit/agents";

/** LiveKit-native hangup — replaces hand-rolled end_call + session.shutdown(). */
export function buildEndCallToolset(extraDescription?: string) {
  return beta.createEndCallTool({
    ignoreOnEnter: true,
    deleteRoom: false,
    ...(extraDescription ? { extraDescription } : {}),
  });
}
