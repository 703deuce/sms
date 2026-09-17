/**
 * GPT-Live PSTN entry — split prompts + optional Responses delegation.
 * Realtime wizard path remains in openai-realtime-bridge/call-bridge.ts.
 */
import WebSocket from "ws";
import { getOpenAiApiKey } from "../openai-realtime-bridge/config";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import { logRealtimeBridgeEvent } from "../openai-realtime-bridge/telemetry";
import { OPENAI_LIVE_WEBSOCKET_URL } from "../openai-realtime-bridge/live-config";
import { liveBridgeMetadata, resolveOpenAiLiveBaseline } from "../openai-realtime-bridge/live-config";
import { runOpenAiLiveBaselineBridge } from "../openai-realtime-bridge/live-minimal-bridge";
import { buildOpenAiLiveSessionStartPayload } from "../openai-realtime-bridge/live-config";
import {
  buildOpenAiLiveSessionStartPayloadForCall,
  shouldUseSplitLiveSessionStart,
} from "./live-session-start";
import { isOpenAiLiveDelegationEnabled } from "./constants";

export async function runTelnyxOpenAiLiveSplitBridge(input: {
  claims: RealtimeBridgeStreamClaims;
  telnyxSocket: WebSocket;
}): Promise<void> {
  const meta = liveBridgeMetadata();
  const callId = input.claims.callId;

  logRealtimeBridgeEvent("telnyx_media_ws_connected", {
    callId,
    workspaceId: input.claims.workspaceId,
    transport: "openai_live",
    live_baseline: resolveOpenAiLiveBaseline(),
    bridge_module: "openai-live-bridge",
    live_split_prompts: shouldUseSplitLiveSessionStart(),
    live_delegation: isOpenAiLiveDelegationEnabled(),
    ...meta,
  });

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    input.telnyxSocket.close(1011, "openai_key_missing");
    return;
  }

  const sessionStartPayload =
    shouldUseSplitLiveSessionStart() && isOpenAiLiveDelegationEnabled()
      ? await buildOpenAiLiveSessionStartPayloadForCall(input.claims)
      : buildOpenAiLiveSessionStartPayload();

  runOpenAiLiveBaselineBridge({
    telnyxSocket: input.telnyxSocket,
    apiKey,
    openAiLiveWsUrl: OPENAI_LIVE_WEBSOCKET_URL,
    sessionStartPayload,
    callId,
    onMilestone: (name, msSinceBridge, extra) => {
      logRealtimeBridgeEvent("openai_live_timing", {
        callId,
        milestone: name,
        ms_since_telnyx_ws: msSinceBridge,
        ...extra,
      });
    },
  });
}
