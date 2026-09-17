import crypto from "node:crypto";
import WebSocket from "ws";

/** OpenAI Live primary WebSocket client events used by this diagnostic baseline. */
export type LiveClientEventType =
  | "session.start"
  | "session.input_audio.append"
  | "session.close";

type LiveEvent = {
  type: string;
  [key: string]: unknown;
};

type TelnyxMediaMessage = {
  event?: string;
  stream_id?: string;
  track?: string;
  media?: { payload?: string; track?: string };
  start?: { stream_id?: string; streamSid?: string };
};

const MAX_PENDING_CALLER_AUDIO = 50;

export function liveBaselineEventId(prefix = "evt"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function resolveTelnyxStreamId(msg: TelnyxMediaMessage): string | null {
  if (msg.stream_id) return msg.stream_id;
  if (msg.start?.stream_id) return msg.start.stream_id;
  if (msg.start?.streamSid) return msg.start.streamSid;
  return null;
}

function resolveTelnyxMediaTrack(msg: TelnyxMediaMessage): string | undefined {
  return msg.media?.track ?? msg.track;
}

/**
 * both_tracks: only explicit inbound legs may reach Live input.
 * Never forward outbound / Amy audio (feedback loop).
 */
export function shouldForwardInboundTelnyxTrackToLive(track: string | undefined): boolean {
  if (!track) return true;
  const t = track.toLowerCase();
  if (t === "inbound" || t === "inbound_track") return true;
  return false;
}

export function isLiveOutputAudioDelta(type: string): boolean {
  return type === "output_audio.delta" || type === "session.output_audio.delta";
}

export function isLiveOutputTranscriptDelta(type: string): boolean {
  return type === "output_transcript.delta" || type === "session.output_transcript.delta";
}

function logLiveOut(type: string, extra?: Record<string, unknown>) {
  console.info(
    `LIVE_OUT ${type}${extra ? ` ${JSON.stringify(extra)}` : ""}`,
  );
}

function logLiveIn(type: string, extra?: Record<string, unknown>) {
  console.info(
    `LIVE_IN ${type}${extra ? ` ${JSON.stringify(extra)}` : ""}`,
  );
}

export type LiveBaselineBridgeInput = {
  telnyxSocket: WebSocket;
  apiKey: string;
  openAiLiveWsUrl: string;
  sessionStartPayload: Record<string, unknown>;
  callId?: string;
};

/**
 * Isolated GPT-Live ↔ Telnyx diagnostic baseline (official Live event names only).
 * Not used for Realtime booking, tools, delegation, or Responses-backend turn creation.
 */
export function runOpenAiLiveBaselineBridge(input: LiveBaselineBridgeInput): void {
  const callId = input.callId ?? "unknown";
  let openAiWs: WebSocket | null = null;
  let liveStarted = false;
  let sessionStartSent = false;
  let telnyxStreamId: string | null = null;
  let firstOutputAudioLogged = false;
  const pendingCallerAudio: string[] = [];

  let telnyxInboundFrames = 0;
  let telnyxOutboundFramesDropped = 0;
  let openaiInputAudioFrames = 0;
  let openaiOutputAudioFrames = 0;
  let lastStatsLogAt = 0;

  const logStats = (reason: string) => {
    console.info(
      `LIVE_STATS reason=${reason} callId=${callId} telnyx_inbound_frames=${telnyxInboundFrames} telnyx_outbound_frames_dropped=${telnyxOutboundFramesDropped} openai_input_audio_frames=${openaiInputAudioFrames} openai_output_audio_frames=${openaiOutputAudioFrames}`,
    );
  };

  const maybeLogStats = () => {
    const now = Date.now();
    if (now - lastStatsLogAt < 5000) return;
    lastStatsLogAt = now;
    logStats("periodic");
  };

  const sendLiveOut = (event: Record<string, unknown>) => {
    if (!openAiWs || openAiWs.readyState !== WebSocket.OPEN) return;
    const type = String(event.type || "");
    if (type !== "session.input_audio.append") {
      logLiveOut(type, { callId, event_id: event.event_id ?? null });
    }
    openAiWs.send(JSON.stringify(event));
  };

  const appendCallerAudio = (payloadB64: string, track?: string) => {
    if (!liveStarted) return;
    if (!shouldForwardInboundTelnyxTrackToLive(track)) {
      telnyxOutboundFramesDropped += 1;
      maybeLogStats();
      return;
    }
    telnyxInboundFrames += 1;
    openaiInputAudioFrames += 1;
    maybeLogStats();
    sendLiveOut({
      type: "session.input_audio.append",
      event_id: liveBaselineEventId("audio"),
      audio: payloadB64,
    });
  };

  const flushPendingCallerAudio = () => {
    while (pendingCallerAudio.length > 0) {
      appendCallerAudio(pendingCallerAudio.shift()!, "inbound");
    }
  };

  const sendAudioToTelnyx = (base64Audio: string) => {
    if (!telnyxStreamId || input.telnyxSocket.readyState !== WebSocket.OPEN) return;
    openaiOutputAudioFrames += 1;
    maybeLogStats();
    input.telnyxSocket.send(
      JSON.stringify({
        event: "media",
        stream_id: telnyxStreamId,
        media: { payload: base64Audio },
      }),
    );
  };

  const connectOpenAi = () => {
    if (openAiWs) return;
    openAiWs = new WebSocket(input.openAiLiveWsUrl, {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "User-Agent": "Transovo-LiveBaselineBridge/1.0",
      },
    });

    openAiWs.on("open", () => {
      if (sessionStartSent) return;
      sessionStartSent = true;
      const startEvent = {
        ...input.sessionStartPayload,
        event_id:
          (input.sessionStartPayload.event_id as string) ||
          liveBaselineEventId("session_start"),
      };
      sendLiveOut(startEvent);
    });

    openAiWs.on("message", (raw) => {
      let event: LiveEvent;
      try {
        event = JSON.parse(raw.toString()) as LiveEvent;
      } catch (err) {
        console.error("[live-baseline] invalid JSON", err);
        return;
      }
      const type = String(event.type || "");

      if (type === "session.started") {
        liveStarted = true;
        logLiveIn("session.started", {
          callId,
          session_id: (event.session as { id?: string })?.id ?? "",
        });
        flushPendingCallerAudio();
        return;
      }

      if (isLiveOutputAudioDelta(type) && event.delta) {
        if (!firstOutputAudioLogged) {
          firstOutputAudioLogged = true;
          logLiveIn("output_audio.delta", { callId, first: true });
        }
        sendAudioToTelnyx(String(event.delta));
        return;
      }

      if (isLiveOutputTranscriptDelta(type)) {
        logLiveIn("output_transcript.delta", {
          callId,
          delta: String(event.delta ?? ""),
        });
        return;
      }

      if (type === "error") {
        console.error(JSON.stringify(event.error ?? event, null, 2));
        logLiveIn("error", { callId });
        return;
      }

      if (type === "session.closed") {
        logLiveIn("session.closed", {
          callId,
          reason: String(event.reason ?? ""),
        });
        return;
      }
    });

    openAiWs.on("error", (err) => {
      console.error("[live-baseline websocket error]", err);
    });

    openAiWs.on("close", (code, reason) => {
      logLiveIn("websocket.close", {
        callId,
        code,
        reason: reason.toString(),
      });
      logStats("openai_close");
    });
  };

  const closeLiveSession = () => {
    if (!openAiWs || openAiWs.readyState !== WebSocket.OPEN) return;
    sendLiveOut({
      type: "session.close",
      event_id: liveBaselineEventId("session_close"),
    });
    openAiWs.close();
  };

  input.telnyxSocket.on("message", (raw) => {
    let msg: TelnyxMediaMessage;
    try {
      msg = JSON.parse(raw.toString()) as TelnyxMediaMessage;
    } catch {
      return;
    }

    if (msg.event === "connected") return;

    if (msg.event === "start") {
      telnyxStreamId = resolveTelnyxStreamId(msg);
      console.info(`[telnyx] stream started callId=${callId} stream_id=${telnyxStreamId ?? ""}`);
      connectOpenAi();
      return;
    }

    if (msg.event === "stop") {
      console.info(`[telnyx] stream stop callId=${callId}`);
      logStats("telnyx_stop");
      closeLiveSession();
      return;
    }

    if (msg.event !== "media") return;

    const track = resolveTelnyxMediaTrack(msg);
    const payload = msg.media?.payload;
    if (!payload) return;

    if (!liveStarted) {
      if (shouldForwardInboundTelnyxTrackToLive(track)) {
        if (pendingCallerAudio.length < MAX_PENDING_CALLER_AUDIO) {
          pendingCallerAudio.push(payload);
        } else {
          pendingCallerAudio.shift();
          pendingCallerAudio.push(payload);
        }
      } else {
        telnyxOutboundFramesDropped += 1;
      }
      return;
    }

    appendCallerAudio(payload, track);
  });

  input.telnyxSocket.on("close", () => {
    console.info(`[telnyx] websocket closed callId=${callId}`);
    logStats("telnyx_close");
    closeLiveSession();
  });

  input.telnyxSocket.on("error", (err) => {
    console.error("[live-baseline telnyx error]", err);
    closeLiveSession();
  });
}
