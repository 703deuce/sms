import { getVoiceV3CallRuntime } from "../state/call-runtime";
import { requestLiveSpeakContinuation } from "../live-response-trigger";
import type { LiveSidebandSend } from "../greeting";
import { getGreetingPhase } from "./greeting-turn";

export function maybeRequestDeferredRecoverySpeak(input: {
  liveSessionId: string;
  send: LiveSidebandSend;
}): void {
  const phase = getGreetingPhase(input.liveSessionId);
  if (phase !== "COMPLETED" && phase !== "INTERRUPTED") return;

  const runtime = getVoiceV3CallRuntime(input.liveSessionId);
  if (!runtime) return;
  const recovery = runtime.getSnapshot().recovery.active;
  if (!recovery || recovery.status !== "ACTIVE") return;
  if (
    recovery.code !== "SEMANTIC_EXTRACTION_FAILED" &&
    recovery.code !== "INTENT_AMBIGUOUS"
  ) {
    return;
  }

  requestLiveSpeakContinuation({
    send: input.send,
    liveSessionId: input.liveSessionId,
    reason: `deferred_recovery_${recovery.code.toLowerCase()}`,
  });
}
