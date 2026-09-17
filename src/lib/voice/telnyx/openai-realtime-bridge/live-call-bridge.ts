import WebSocket from "ws";
import { getOpenAiApiKey } from "./config";
import type { RealtimeBridgeStreamClaims } from "./stream-token";
import { logRealtimeBridgeEvent } from "./telemetry";
import { createLiveBridgeDiagnostics } from "./live-bridge-diagnostics";
import {
  OPENAI_LIVE_GREETING_LINE,
  OPENAI_LIVE_WEBSOCKET_URL,
  buildOpenAiLiveSessionStartPayload,
  liveBridgeMetadata,
} from "./live-config";

type TelnyxMediaEvent = {
  event?: string;
  media?: { payload?: string; track?: string };
  stream_id?: string;
  start?: { stream_id?: string; streamSid?: string };
};

const MAX_PENDING_CALLER_AUDIO = 50;

function resolveTelnyxStreamId(ev: TelnyxMediaEvent): string | null {
  if (ev.stream_id) return ev.stream_id;
  if (ev.start?.stream_id) return ev.start.stream_id;
  if (ev.start?.streamSid) return ev.start.streamSid;
  return null;
}

/** Only PSTN caller leg → Live input. Never forward outbound (Amy) track — prevents self-echo loops. */
function shouldForwardTelnyxMediaToLive(track: string | undefined): boolean {
  if (!track) {
    return true;
  }
  const t = track.toLowerCase();
  if (t === "outbound" || t === "outbound_track") return false;
  if (t === "inbound" || t === "inbound_track") return true;
  return true;
}

function summarizeOpenAiLiveError(ev: Record<string, unknown>): Record<string, unknown> {
  const err = (ev.error ?? ev) as Record<string, unknown>;
  return {
    type: ev.type,
    event_id: ev.event_id,
    error_type: err.type,
    error_code: err.code,
    error_message: err.message,
    error_param: err.param,
  };
}

/**
 * Minimal Telnyx media ↔ OpenAI Live (gpt-live-1) — no booking/tools.
 */
export async function runTelnyxOpenAiLiveBridge(input: {
  claims: RealtimeBridgeStreamClaims;
  telnyxSocket: WebSocket;
}): Promise<void> {
  const meta = liveBridgeMetadata();
  const bridgeStartedAt = Date.now();
  const diag = createLiveBridgeDiagnostics(input.claims.callId);
  logRealtimeBridgeEvent("telnyx_media_ws_connected", {
    callId: input.claims.callId,
    workspaceId: input.claims.workspaceId,
    transport: "openai_live",
    live_diag_trace: process.env.OPENAI_LIVE_DIAG_TRACE !== "0",
    ...meta,
  });

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    input.telnyxSocket.close(1011, "openai_key_missing");
    return;
  }

  let openAi: WebSocket | null = null;
  let telnyxStreamId: string | null = null;
  let telnyxStarted = false;
  let openAiSessionStarted = false;
  let greetingSent = false;
  let firstCallerAudioForwarded = false;
  let firstAmyAudioReceived = false;
  let firstAmyAudioToTelnyx = false;
  let lastClientEvent = "";
  let openAiOpenedAt = 0;
  let tornDown = false;
  const pendingCallerAudio: string[] = [];

  const sendOpenAi = (event: Record<string, unknown>, source: string) => {
    if (!openAi || openAi.readyState !== WebSocket.OPEN) return;
    lastClientEvent = String(event.type || "");
    diag.logClientEvent(source, event);
    openAi.send(JSON.stringify(event));
  };

  const sendCallerAudioToOpenAi = (payloadB64: string, track?: string) => {
    if (!openAiSessionStarted || !openAi || openAi.readyState !== WebSocket.OPEN) return;
    if (!shouldForwardTelnyxMediaToLive(track)) {
      diag.logTelnyxMedia(track, "drop");
      return;
    }
    diag.logTelnyxMedia(track, "forward");
    if (!firstCallerAudioForwarded) {
      firstCallerAudioForwarded = true;
      logRealtimeBridgeEvent("first_caller_audio_forwarded", {
        callId: input.claims.callId,
        transport: "openai_live",
        track: track ?? "unspecified",
      });
    }
    sendOpenAi(
      {
        type: "session.input_audio.append",
        audio: payloadB64,
      },
      "sendCallerAudioToOpenAi",
    );
  };

  const flushPendingCallerAudio = () => {
    while (pendingCallerAudio.length > 0) {
      sendCallerAudioToOpenAi(pendingCallerAudio.shift()!, "inbound");
    }
  };

  const sendAmyGreeting = () => {
    if (greetingSent || !openAiSessionStarted) return;
    greetingSent = true;
    const line = OPENAI_LIVE_GREETING_LINE;
    sendOpenAi(
      {
        type: "session.instructions.append",
        delegation_id: null,
        content: `Your first spoken line on this call is, verbatim: "${line}"`,
      },
      "sendAmyGreeting:instructions.append",
    );
    sendOpenAi(
      {
        type: "session.commentary.append",
        delegation_id: null,
        content: line,
      },
      "sendAmyGreeting:commentary.append",
    );
    logRealtimeBridgeEvent("openai_live_greeting_sent", {
      callId: input.claims.callId,
      client_events: 2,
    });
    diag.flushFirst15sReportHint();
  };

  const sendAudioToTelnyx = (base64Audio: string) => {
    if (!telnyxStreamId || input.telnyxSocket.readyState !== WebSocket.OPEN) return;
    if (!firstAmyAudioToTelnyx) {
      firstAmyAudioToTelnyx = true;
      logRealtimeBridgeEvent("first_amy_audio_sent_to_telnyx", {
        callId: input.claims.callId,
        transport: "openai_live",
      });
    }
    input.telnyxSocket.send(
      JSON.stringify({
        event: "media",
        stream_id: telnyxStreamId,
        media: { payload: base64Audio },
      }),
    );
  };

  const connectOpenAiLive = () => {
    if (openAi) return;
    openAi = new WebSocket(OPENAI_LIVE_WEBSOCKET_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "Transovo-VoiceV2-LiveBridge/1.0",
      },
    });

    openAi.on("open", () => {
      openAiOpenedAt = Date.now();
      logRealtimeBridgeEvent("openai_live_ws_connected", {
        callId: input.claims.callId,
        ...meta,
      });
      const startPayload = buildOpenAiLiveSessionStartPayload();
      logRealtimeBridgeEvent("openai_session_start_sent", {
        callId: input.claims.callId,
        model: meta.model,
        voice: meta.voice,
      });
      sendOpenAi(startPayload, "connectOpenAiLive:session.start");
    });

    openAi.on("message", (raw) => {
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = String(ev.type || "");
      diag.logServerEvent(ev);

      if (type === "error") {
        logRealtimeBridgeEvent("openai_live_error", {
          callId: input.claims.callId,
          ...summarizeOpenAiLiveError(ev),
        });
        return;
      }

      if (type === "session.started" && !openAiSessionStarted) {
        openAiSessionStarted = true;
        diag.markSessionStarted();
        logRealtimeBridgeEvent("openai_session_started", {
          callId: input.claims.callId,
          session_id: (ev.session as { id?: string })?.id,
          model: (ev.session as { model?: string })?.model ?? meta.model,
          voice: meta.voice,
          ms_since_open: openAiOpenedAt ? Date.now() - openAiOpenedAt : null,
        });
        flushPendingCallerAudio();
        sendAmyGreeting();
        return;
      }

      if (type === "session.output_audio.delta" && ev.delta) {
        if (!firstAmyAudioReceived) {
          firstAmyAudioReceived = true;
          logRealtimeBridgeEvent("first_amy_audio_received", {
            callId: input.claims.callId,
            transport: "openai_live",
            ms_since_bridge_start: Date.now() - bridgeStartedAt,
          });
        }
        sendAudioToTelnyx(String(ev.delta));
        return;
      }

      if (type === "session.output_transcript.delta" && ev.delta) {
        logRealtimeBridgeEvent("amy_transcript_delta", {
          callId: input.claims.callId,
          delta_chars: String(ev.delta).length,
        });
      }
    });

    openAi.on("close", (code, reason) => {
      logRealtimeBridgeEvent("openai_live_ws_closed", {
        callId: input.claims.callId,
        code,
        reason: reason.toString(),
        session_started: openAiSessionStarted,
        last_client_event: lastClientEvent,
        duration_ms: Date.now() - bridgeStartedAt,
      });
      teardown("openai_close");
    });

    openAi.on("error", (err) => {
      logRealtimeBridgeEvent("openai_live_ws_error", {
        callId: input.claims.callId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  };

  const teardown = (source: string) => {
    if (tornDown) return;
    tornDown = true;
    logRealtimeBridgeEvent("live_bridge_session_closed", {
      callId: input.claims.callId,
      source,
      duration_ms: Date.now() - bridgeStartedAt,
      telnyx_started: telnyxStarted,
      openai_session_started: openAiSessionStarted,
    });
    try {
      if (openAi?.readyState === WebSocket.OPEN) {
        sendOpenAi({ type: "session.close" }, "teardown:session.close");
        openAi.close();
      }
    } catch {
      /* ignore */
    }
    try {
      if (input.telnyxSocket.readyState === WebSocket.OPEN) {
        input.telnyxSocket.close();
      }
    } catch {
      /* ignore */
    }
  };

  input.telnyxSocket.on("message", (buf) => {
    let ev: TelnyxMediaEvent;
    try {
      ev = JSON.parse(buf.toString()) as TelnyxMediaEvent;
    } catch {
      return;
    }

    if (ev.event === "connected") return;

    if (ev.event === "start") {
      telnyxStarted = true;
      telnyxStreamId = resolveTelnyxStreamId(ev);
      logRealtimeBridgeEvent("telnyx_start_received", {
        callId: input.claims.callId,
        stream_id: telnyxStreamId,
        note: "streaming uses both_tracks; Live input forwards inbound only",
      });
      connectOpenAiLive();
      return;
    }

    if (ev.event === "media" && ev.media?.payload) {
      const track = ev.media.track;
      if (openAiSessionStarted) {
        sendCallerAudioToOpenAi(ev.media.payload, track);
      } else if (shouldForwardTelnyxMediaToLive(track)) {
        if (pendingCallerAudio.length < MAX_PENDING_CALLER_AUDIO) {
          pendingCallerAudio.push(ev.media.payload);
        } else {
          pendingCallerAudio.shift();
          pendingCallerAudio.push(ev.media.payload);
        }
      }
      return;
    }

    if (ev.event === "stop") {
      logRealtimeBridgeEvent("telnyx_media_ws_stop", {
        callId: input.claims.callId,
        transport: "openai_live",
      });
      teardown("telnyx_stop");
    }
  });

  input.telnyxSocket.on("close", () => {
    logRealtimeBridgeEvent("telnyx_media_ws_closed", {
      callId: input.claims.callId,
      transport: "openai_live",
      duration_ms: Date.now() - bridgeStartedAt,
    });
    teardown("telnyx_close");
  });

  input.telnyxSocket.on("error", (err) => {
    console.error("[live-bridge] telnyx ws", err);
    teardown("telnyx_error");
  });
}
