import WebSocket from "ws";
import { getOpenAiApiKey } from "./config";
import type { RealtimeBridgeStreamClaims } from "./stream-token";
import { logRealtimeBridgeEvent } from "./telemetry";
import {
  OPENAI_LIVE_MINIMAL_WS_URL,
  buildOpenAiLiveMinimalSessionStartPayload,
  liveMinimalBridgeMetadata,
  resolveOpenAiLiveMinimalBaseline,
} from "./live-minimal-config";

type TelnyxMediaEvent = {
  event?: string;
  media?: { payload?: string; track?: string };
  stream_id?: string;
  start?: { stream_id?: string; streamSid?: string };
};

const MAX_PENDING_INBOUND_AUDIO = 50;

function resolveTelnyxStreamId(ev: TelnyxMediaEvent): string | null {
  if (ev.stream_id) return ev.stream_id;
  if (ev.start?.stream_id) return ev.start.stream_id;
  if (ev.start?.streamSid) return ev.start.streamSid;
  return null;
}

function isInboundTelnyxTrack(track: string | undefined): boolean {
  if (!track) return true;
  const t = track.toLowerCase();
  if (t === "outbound" || t === "outbound_track") return false;
  return true;
}

function logClient(source: string, type: string, extra?: Record<string, unknown>) {
  console.info(
    `LIVE_CLIENT_EVENT type=${type} timestamp=${new Date().toISOString()} source=${source}${
      extra ? ` ${JSON.stringify(extra)}` : ""
    }`,
  );
}

function logServer(type: string, extra?: Record<string, unknown>) {
  console.info(
    `LIVE_SERVER_EVENT type=${type} timestamp=${new Date().toISOString()}${
      extra ? ` ${JSON.stringify(extra)}` : ""
    }`,
  );
}

/**
 * Official GPT-Live baseline: session.start → session.started → caller audio in → output_audio.delta out.
 * No Amy greeting, tools, delegation, response.create, or post-start control events.
 */
export async function runTelnyxOpenAiLiveMinimalBridge(input: {
  claims: RealtimeBridgeStreamClaims;
  telnyxSocket: WebSocket;
}): Promise<void> {
  const meta = liveMinimalBridgeMetadata();
  const callId = input.claims.callId;
  const bridgeStartedAt = Date.now();
  let sessionStartedAt: number | null = null;
  let clientEventsAfterStart = 0;
  let telnyxMediaPackets = 0;
  let telnyxOutboundDropped = 0;
  let openAiInputAudioPackets = 0;
  let openAiOutputAudioDeltas = 0;
  let amySegment = 0;
  let amySegmentOpen = false;

  logRealtimeBridgeEvent("live_minimal_bridge_connected", {
    callId,
    workspaceId: input.claims.workspaceId,
    transport: "openai_live_minimal",
    baseline: resolveOpenAiLiveMinimalBaseline(),
    ...meta,
  });

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    input.telnyxSocket.close(1011, "openai_key_missing");
    return;
  }

  let openAi: WebSocket | null = null;
  let telnyxStreamId: string | null = null;
  let sessionStarted = false;
  let sessionStartSent = false;
  let tornDown = false;
  const pendingInbound: string[] = [];

  let lastInputAudioLogAt = 0;

  const sendOpenAiControl = (event: Record<string, unknown>, source: string) => {
    if (!openAi || openAi.readyState !== WebSocket.OPEN) return;
    const type = String(event.type || "");
    logClient(source, type, { callId, event_id: event.event_id ?? null });
    if (sessionStarted && type !== "session.close") {
      clientEventsAfterStart += 1;
      logRealtimeBridgeEvent("live_minimal_unexpected_client_event", {
        callId,
        type,
        source,
        client_events_after_session_start: clientEventsAfterStart,
      });
    }
    if (!sessionStarted && type !== "session.start") {
      logRealtimeBridgeEvent("live_minimal_client_event_before_started", {
        callId,
        type,
        source,
      });
    }
    openAi.send(JSON.stringify(event));
  };

  const forwardInboundAudio = (payload: string, track?: string) => {
    if (!sessionStarted || !openAi || openAi.readyState !== WebSocket.OPEN) return;
    if (!isInboundTelnyxTrack(track)) {
      telnyxOutboundDropped += 1;
      return;
    }
    openAiInputAudioPackets += 1;
    const now = Date.now();
    if (now - lastInputAudioLogAt >= 1000) {
      lastInputAudioLogAt = now;
      logClient("forwardInboundAudio", "session.input_audio.append", {
        callId,
        packets_total: openAiInputAudioPackets,
        telnyx_media_total: telnyxMediaPackets,
        outbound_dropped: telnyxOutboundDropped,
      });
    }
    openAi.send(
      JSON.stringify({ type: "session.input_audio.append", audio: payload }),
    );
  };

  const flushPending = () => {
    while (pendingInbound.length > 0) {
      forwardInboundAudio(pendingInbound.shift()!, "inbound");
    }
  };

  const sendToTelnyx = (base64Audio: string) => {
    if (!telnyxStreamId || input.telnyxSocket.readyState !== WebSocket.OPEN) return;
    input.telnyxSocket.send(
      JSON.stringify({
        event: "media",
        stream_id: telnyxStreamId,
        media: { payload: base64Audio },
      }),
    );
  };

  const connect = () => {
    if (openAi) return;
    openAi = new WebSocket(OPENAI_LIVE_MINIMAL_WS_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "Transovo-LiveMinimalBaseline/1.0",
      },
    });

    openAi.on("open", () => {
      if (sessionStartSent) return;
      sessionStartSent = true;
      const payload = buildOpenAiLiveMinimalSessionStartPayload();
      sendOpenAiControl(payload, "connect:session.start");
    });

    openAi.on("message", (raw) => {
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = String(ev.type || "");

      if (type === "session.output_audio.delta" && ev.delta) {
        openAiOutputAudioDeltas += 1;
        if (!amySegmentOpen) {
          amySegment += 1;
          amySegmentOpen = true;
          logServer("session.output_audio.segment_start", {
            callId,
            segment: amySegment,
            ms_since_session: sessionStartedAt ? Date.now() - sessionStartedAt : null,
          });
        }
        sendToTelnyx(String(ev.delta));
        return;
      }

      if (amySegmentOpen && type !== "session.output_audio.delta") {
        amySegmentOpen = false;
        logServer("session.output_audio.segment_end", {
          callId,
          segment: amySegment,
          ms_since_session: sessionStartedAt ? Date.now() - sessionStartedAt : null,
          next_type: type,
        });
      }

      logServer(type, {
        callId,
        event_id: ev.event_id ?? null,
        ms_since_session: sessionStartedAt ? Date.now() - sessionStartedAt : null,
      });

      if (type === "session.started" && !sessionStarted) {
        sessionStarted = true;
        sessionStartedAt = Date.now();
        logRealtimeBridgeEvent("live_minimal_session_started", {
          callId,
          session_id: (ev.session as { id?: string })?.id,
          baseline: resolveOpenAiLiveMinimalBaseline(),
          ms_since_bridge: Date.now() - bridgeStartedAt,
        });
        flushPending();
      }
    });

    openAi.on("close", () => teardown("openai_close"));
    openAi.on("error", (err) => {
      logRealtimeBridgeEvent("live_minimal_openai_error", {
        callId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  };

  const teardown = (source: string) => {
    if (tornDown) return;
    tornDown = true;
    logRealtimeBridgeEvent("live_minimal_bridge_closed", {
      callId,
      source,
      duration_ms: Date.now() - bridgeStartedAt,
      telnyx_media_packets: telnyxMediaPackets,
      telnyx_outbound_dropped: telnyxOutboundDropped,
      openai_input_audio_packets: openAiInputAudioPackets,
      openai_output_audio_deltas: openAiOutputAudioDeltas,
      client_events_after_session_start: clientEventsAfterStart,
    });
    try {
      if (openAi?.readyState === WebSocket.OPEN) {
        sendOpenAiControl({ type: "session.close" }, "teardown:session.close");
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
      telnyxStreamId = resolveTelnyxStreamId(ev);
      logRealtimeBridgeEvent("live_minimal_telnyx_start", {
        callId,
        stream_id: telnyxStreamId,
      });
      connect();
      return;
    }
    if (ev.event === "media" && ev.media?.payload) {
      telnyxMediaPackets += 1;
      const track = ev.media.track;
      if (sessionStarted) {
        forwardInboundAudio(ev.media.payload, track);
      } else if (isInboundTelnyxTrack(track)) {
        if (pendingInbound.length >= MAX_PENDING_INBOUND_AUDIO) pendingInbound.shift();
        pendingInbound.push(ev.media.payload);
      }
      return;
    }
    if (ev.event === "stop") teardown("telnyx_stop");
  });

  input.telnyxSocket.on("close", () => teardown("telnyx_close"));
  input.telnyxSocket.on("error", () => teardown("telnyx_error"));
}
