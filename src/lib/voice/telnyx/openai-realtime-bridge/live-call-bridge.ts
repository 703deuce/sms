import WebSocket from "ws";
import { getOpenAiApiKey } from "./config";
import type { RealtimeBridgeStreamClaims } from "./stream-token";
import { logRealtimeBridgeEvent } from "./telemetry";
import {
  OPENAI_LIVE_WEBSOCKET_URL,
  buildOpenAiLiveSessionStartPayload,
  liveBridgeMetadata,
  resolveOpenAiLiveBaseline,
} from "./live-config";
import { runOpenAiLiveBaselineBridge } from "./live-minimal-bridge";

/**
 * Production entry for transport `openai_live`.
 * Core protocol wiring lives in `live-minimal-bridge.ts` (diagnostic baseline).
 */
export async function runTelnyxOpenAiLiveBridge(input: {
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
    bridge_module: "live-minimal-bridge",
    ...meta,
  });

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    input.telnyxSocket.close(1011, "openai_key_missing");
    return;
  }

  runOpenAiLiveBaselineBridge({
    telnyxSocket: input.telnyxSocket,
    apiKey,
    openAiLiveWsUrl: OPENAI_LIVE_WEBSOCKET_URL,
    sessionStartPayload: buildOpenAiLiveSessionStartPayload(),
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
