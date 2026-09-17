import "server-only";

import { resolveSessionKey } from "@/lib/voice-v2/intake/load-call-context";
import {
  dropVoiceV2CallContextL1,
  markVoiceV2CallContextEnded,
} from "@/lib/voice-v2/session/call-context-store";
import type { LiveToolDispatchContext } from "./live-tool-runtime";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";

/**
 * Per-call GPT-Live runtime (one Telnyx↔OpenAI bridge instance).
 *
 * Isolation contract: workflow stage, tools, transcript cursor, delegation state,
 * and control-plane caches MUST live on this object graph only — never module globals.
 * Authoritative booking state is {@link VoiceV2CallContext} in the session store,
 * keyed by `cc:{callControlId}` (unique per concurrent PSTN call).
 *
 * Audit (concurrent calls): `createLiveControlPlane`, `createLiveDelegationHandler`,
 * `LiveConversationTranscript`, and `createLiveToolDispatchContextFromClaims` use
 * per-bridge closures only. Shared process maps (`VoiceV2CallContext` L1) are keyed
 * by session key, not a single global stage. Teardown: `disposeLiveCallRuntime` on
 * Telnyx stop / Live websocket close.
 */
export type LiveCallRuntime = {
  callId: string;
  liveSessionId?: string;
  callControlId: string;
  controlPlane: LiveToolDispatchContext["controlPlane"];
  toolDispatch: LiveToolDispatchContext;
};

export function sessionKeyForLiveClaims(claims: RealtimeBridgeStreamClaims): string | null {
  return resolveSessionKey({
    callControlId: claims.callControlId,
    conversationId: claims.callControlId,
  });
}

/** Tear down call-local caches when Telnyx stops or the Live websocket closes. */
export async function disposeLiveCallRuntime(claims: RealtimeBridgeStreamClaims): Promise<void> {
  const sessionKey = sessionKeyForLiveClaims(claims);
  if (sessionKey) {
    try {
      await markVoiceV2CallContextEnded(sessionKey);
    } catch (err) {
      console.warn(
        `[live-call-runtime] markEnded failed callId=${claims.callId}`,
        err instanceof Error ? err.message : err,
      );
    }
    dropVoiceV2CallContextL1(sessionKey);
  }
  console.info(
    `LIVE_CALL_RUNTIME_DISPOSED ${JSON.stringify({
      call_id: claims.callId,
      call_control_id: claims.callControlId,
      session_key: sessionKey,
    })}`,
  );
}
