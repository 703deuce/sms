/**
 * GPT-Live PSTN entry — split prompts, Responses delegation, shared Voice V2 booking engine.
 */
import WebSocket from "ws";
import { getOpenAiApiKey } from "../openai-realtime-bridge/config";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import { logRealtimeBridgeEvent } from "../openai-realtime-bridge/telemetry";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-v2/after-hours-handling-config";
import {
  OPENAI_LIVE_WEBSOCKET_URL,
  buildOpenAiLiveSessionStartPayload,
  liveBridgeMetadata,
  resolveOpenAiLiveBaseline,
  resolveOpenAiLiveGreetingLine,
} from "./live-config";
import { isOpenAiLiveDelegationEnabled } from "./constants";
import { buildLiveSessionConfig } from "./build-live-session-config";
import { buildLiveVoiceTools } from "./live-tools";
import { createLiveToolDispatchContext } from "./live-tool-runtime";
import { buildLiveResponsesRuntimeContext } from "./live-runtime-context";
import { runOpenAiLiveMediaBridge } from "./live-media-bridge";
import { startLiveVoiceV2OnCall } from "./start-on-call";

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

  startLiveVoiceV2OnCall(input.claims);

  const config = await loadVoiceAgentRuntimeConfig(
    input.claims.workspaceId,
    input.claims.agentId,
  );
  const parsed = parseVoiceAgentConfig(config);
  const handling = resolveAfterHoursHandlingFromAgentConfig(parsed);
  const toolContext = createLiveToolDispatchContext({
    claims: input.claims,
    config: parsed,
  });

  let sessionStartPayload: Record<string, unknown>;

  if (isOpenAiLiveDelegationEnabled()) {
    const { runtimeContext, bookingContext } = await buildLiveResponsesRuntimeContext(
      input.claims,
    );
    const tools = buildLiveVoiceTools({
      config: parsed,
      transferEnabled: Boolean(handling?.transferEnabled),
    });
    const session = buildLiveSessionConfig({
      greeting: resolveOpenAiLiveGreetingLine(),
      bookingContext,
      runtimeContext,
      tools,
    });
    sessionStartPayload = buildOpenAiLiveSessionStartPayload(session);
  } else {
    sessionStartPayload = buildOpenAiLiveSessionStartPayload();
  }

  runOpenAiLiveMediaBridge({
    telnyxSocket: input.telnyxSocket,
    apiKey,
    openAiLiveWsUrl: OPENAI_LIVE_WEBSOCKET_URL,
    sessionStartPayload,
    callId,
    toolContext: isOpenAiLiveDelegationEnabled() ? toolContext : undefined,
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
