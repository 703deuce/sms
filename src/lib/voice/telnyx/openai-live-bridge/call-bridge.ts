/**
 * GPT-Live PSTN entry — split prompts, Responses delegation, shared Voice V2 booking engine.
 */
import WebSocket from "ws";
import { getOpenAiApiKey } from "../openai-realtime-bridge/config";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import { logRealtimeBridgeEvent } from "../openai-realtime-bridge/telemetry";
import {
  OPENAI_LIVE_WEBSOCKET_URL,
  buildOpenAiLiveSessionStartPayload,
  liveBridgeMetadata,
  resolveOpenAiLiveBaseline,
  resolveOpenAiLiveGreetingLine,
} from "./live-config";
import {
  buildLiveMinimalSessionConfig,
  buildLiveStaticDelegationSessionPatch,
} from "./build-live-session-config";
import { isOpenAiLiveDelegationEnabled } from "./constants";
import { runOpenAiLiveMediaBridge } from "./live-media-bridge";
import { createLiveToolDispatchContextFromClaims } from "./live-tool-runtime";

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
    bridge_module: "openai-live-bridge",
    ...meta,
  });

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    input.telnyxSocket.close(1011, "openai_key_missing");
    return;
  }

  const greeting = resolveOpenAiLiveGreetingLine();
  const delegationEnabled = isOpenAiLiveDelegationEnabled();
  const toolContext = createLiveToolDispatchContextFromClaims(input.claims);

  // Attach Telnyx handlers immediately — Telnyx "start" must not be dropped while config loads.
  runOpenAiLiveMediaBridge({
    telnyxSocket: input.telnyxSocket,
    apiKey,
    openAiLiveWsUrl: OPENAI_LIVE_WEBSOCKET_URL,
    callId,
    immediateLiveStart: delegationEnabled
      ? {
          minimalSessionStartPayload: buildOpenAiLiveSessionStartPayload(
            buildLiveMinimalSessionConfig({ greeting }),
          ),
          toolContext,
          claims: input.claims,
          delegationSessionPatch: buildLiveStaticDelegationSessionPatch(),
        }
      : undefined,
    sessionStartPayload: delegationEnabled
      ? undefined
      : buildOpenAiLiveSessionStartPayload(buildLiveMinimalSessionConfig({ greeting })),
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

/** @deprecated alias */
export const runTelnyxOpenAiLiveSplitBridge = runTelnyxOpenAiLiveBridge;
