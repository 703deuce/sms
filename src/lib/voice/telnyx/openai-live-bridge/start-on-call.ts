import "server-only";

import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { scheduleVoiceV2CallWarmup } from "@/lib/voice-v2/call-warmup";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";

/** Warm CallContext + booking runtime (same path as Realtime PSTN). */
export function startLiveVoiceV2OnCall(claims: RealtimeBridgeStreamClaims): void {
  void (async () => {
    try {
      const runtime = await loadVoiceAgentRuntimeConfig(claims.workspaceId, claims.agentId);
      const config = parseVoiceAgentConfig(runtime);
      scheduleVoiceV2CallWarmup({
        workspaceId: claims.workspaceId,
        agentId: claims.agentId,
        callId: claims.callId,
        callControlId: claims.callControlId,
        conversationId: claims.callControlId,
        agentConfig: config,
        warmupScheduledAt: Date.now(),
      });
    } catch (err) {
      console.error("[openai-live-bridge] startLiveVoiceV2OnCall failed", err);
    }
  })();
}
