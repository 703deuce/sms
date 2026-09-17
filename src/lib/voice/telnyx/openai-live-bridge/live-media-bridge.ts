import WebSocket from "ws";
import { performance } from "node:perf_hooks";
import { CallerAudioActivityDetector } from "./live-caller-audio-activity";
import { liveBaselineEventId } from "./live-event-ids";
import {
  createTurnTraceHooks,
  isLiveInputTranscriptDelta,
  isLiveInputTranscriptDone,
  isLiveOutputTranscriptDelta,
  LiveTurnTracer,
} from "./live-turn-trace";
import { syncLiveCallerUtteranceIntent } from "./live-caller-intent-sync";
import {
  buildLiveOpeningGreetingInstructionAppend,
  buildLiveOpeningGreetingKickoffCommentary,
  isLiveInstructionsAppendedAck,
  shouldSendLiveOpeningGreetingAfterSessionStarted,
} from "./live-greeting";
import {
  detectBookingConfirmationViolation,
  detectConcreteAvailabilityWithoutOfferSet,
} from "./live-booking-authority";
import { createLiveDelegationHandler } from "./live-delegation-handler";
import { LiveConversationTranscript } from "./live-conversation-transcript";
import type { LiveToolDispatchContext } from "./live-tool-runtime";
import { disposeLiveCallRuntime } from "./live-call-runtime";
import { isOpenAiLiveDelegationEnabled } from "./constants";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";

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
const MAX_PENDING_AMY_AUDIO = 120;

function resolveTelnyxStreamId(msg: TelnyxMediaMessage): string | null {
  if (msg.stream_id) return msg.stream_id;
  if (msg.start?.stream_id) return msg.start.stream_id;
  if (msg.start?.streamSid) return msg.start.streamSid;
  return null;
}

function resolveTelnyxMediaTrack(msg: TelnyxMediaMessage): string | undefined {
  return msg.media?.track ?? msg.track;
}

export function shouldForwardInboundTelnyxTrackToLive(track: string | undefined): boolean {
  if (!track) return true;
  const t = track.toLowerCase();
  if (t === "inbound" || t === "inbound_track") return true;
  return false;
}

export function isLiveOutputAudioDelta(type: string): boolean {
  return type === "output_audio.delta" || type === "session.output_audio.delta";
}

function logLiveOut(type: string, extra?: Record<string, unknown>) {
  console.info(`LIVE_OUT ${type}${extra ? ` ${JSON.stringify(extra)}` : ""}`);
}

function logLiveIn(type: string, extra?: Record<string, unknown>) {
  console.info(`LIVE_IN ${type}${extra ? ` ${JSON.stringify(extra)}` : ""}`);
}

export type ImmediateLiveStart = {
  minimalSessionStartPayload: Record<string, unknown>;
  toolContext: LiveToolDispatchContext;
  delegationSessionPatch: Record<string, unknown>;
  claims: RealtimeBridgeStreamClaims;
};

export type LiveMediaBridgeInput = {
  telnyxSocket: WebSocket;
  apiKey: string;
  openAiLiveWsUrl: string;
  /** Non-delegation or legacy sync path */
  sessionStartPayload?: Record<string, unknown>;
  /**
   * Default delegation path: minimal session.start on WS open (no DB).
   * Static delegation attached on session.started via session.update.
   */
  immediateLiveStart?: ImmediateLiveStart;
  callId?: string;
  claims?: RealtimeBridgeStreamClaims;
  toolContext?: LiveToolDispatchContext;
  onMilestone?: (name: string, msSinceBridge: number, extra?: Record<string, unknown>) => void;
};

/**
 * GPT-Live ↔ Telnyx media bridge with optional Responses delegation tool loop.
 */
export function runOpenAiLiveMediaBridge(input: LiveMediaBridgeInput): void {
  if (!input.sessionStartPayload && !input.immediateLiveStart) {
    throw new Error("live-media-bridge: sessionStartPayload or immediateLiveStart required");
  }
  const callId = input.callId ?? "unknown";
  let delegationEnabled = false;
  const bridgeStartedAt = Date.now();
  const milestone = (name: string, extra?: Record<string, unknown>) => {
    const ms = Date.now() - bridgeStartedAt;
    console.info(`LIVE_TIMING ${name} ms=${ms} callId=${callId}`);
    input.onMilestone?.(name, ms, extra);
  };

  let openAiWs: WebSocket | null = null;
  let liveStarted = false;
  let sessionStartSent = false;
  let telnyxStreamId: string | null = null;
  let firstOutputAudioLogged = false;
  const pendingCallerAudio: string[] = [];
  const pendingAmyAudio: string[] = [];

  let telnyxInboundFrames = 0;
  let telnyxOutboundFramesDropped = 0;
  let openaiInputAudioFrames = 0;
  let openaiOutputAudioFrames = 0;
  let lastStatsLogAt = 0;
  let liveGreetingInstrEventId: string | null = null;
  let liveGreetingKickoffSent = false;
  let sessionStartedAt = 0;
  let staticDelegationAttached = false;
  const turnTracer = new LiveTurnTracer(callId);
  const turnTraceHooks = createTurnTraceHooks(turnTracer);
  const conversationTranscript = new LiveConversationTranscript();
  const callerAudioDetector = new CallerAudioActivityDetector();

  milestone("telnyx_ws_attached");
  console.info(
    `LIVE_BRIDGE_OBS ${JSON.stringify({
      callId,
      event: "timer_audit",
      setTimeout_on_live_path: false,
      note: "no artificial debounce between caller speech and Live output",
    })}`,
  );

  const logStats = (reason: string) => {
    console.info(
      `LIVE_STATS reason=${reason} callId=${callId} telnyx_inbound_frames=${telnyxInboundFrames} telnyx_outbound_frames_dropped=${telnyxOutboundFramesDropped} openai_input_audio_frames=${openaiInputAudioFrames} openai_output_audio_frames=${openaiOutputAudioFrames} delegation=${delegationEnabled}`,
    );
  };

  const maybeLogStats = () => {
    const now = Date.now();
    if (now - lastStatsLogAt < 5000) return;
    lastStatsLogAt = now;
    logStats("periodic");
  };

  const flushPendingAmyAudio = () => {
    if (!telnyxStreamId) return;
    while (pendingAmyAudio.length > 0) {
      sendAudioToTelnyx(pendingAmyAudio.shift()!, true);
    }
  };

  const sendLiveOut = (event: Record<string, unknown>) => {
    if (!openAiWs || openAiWs.readyState !== WebSocket.OPEN) return;
    const type = String(event.type || "");
    if (type !== "session.input_audio.append") {
      logLiveOut(type, { callId, event_id: event.event_id ?? null });
    }
    openAiWs.send(JSON.stringify(event));
  };

  let delegationHandler: ReturnType<typeof createLiveDelegationHandler> | null = null;
  let amyTranscriptBuffer = "";
  let liveControlPlane: LiveToolDispatchContext["controlPlane"] | null = null;
  let streamClaimsForTeardown: RealtimeBridgeStreamClaims | null = null;
  let liveRuntimeDisposed = false;

  const attachDelegation = (toolContext: LiveToolDispatchContext) => {
    if (!isOpenAiLiveDelegationEnabled() || delegationHandler) return;
    delegationEnabled = true;
    const claims =
      input.claims ?? input.immediateLiveStart?.claims ?? toolContext
        ? {
            workspaceId: toolContext.workspaceId,
            agentId: toolContext.agentId,
            callId: toolContext.callId,
            callControlId: toolContext.callControlId,
          }
        : null;
    if (!claims) {
      console.error("[live-media] delegation missing stream claims");
      return;
    }
    liveControlPlane = toolContext.controlPlane;
    streamClaimsForTeardown = claims;
    delegationHandler = createLiveDelegationHandler({
      callId,
      claims,
      callContext: toolContext,
      conversationTranscript,
      sendLiveOut,
      turnTrace: turnTraceHooks,
    });
  };

  const sendSessionUpdate = (sessionPatch: Record<string, unknown>) => {
    if (!sessionPatch || Object.keys(sessionPatch).length === 0) return;
    sendLiveOut({
      type: "session.update",
      event_id: liveBaselineEventId("session_update_delegation"),
      session: sessionPatch,
    });
    milestone("session_delegation_update_sent");
  };

  const attachStaticDelegation = () => {
    if (staticDelegationAttached || !input.immediateLiveStart) return;
    staticDelegationAttached = true;
    attachDelegation(input.immediateLiveStart.toolContext);
    sendSessionUpdate(input.immediateLiveStart.delegationSessionPatch);
    milestone("session_delegation_attached", {
      ms_since_session_started: sessionStartedAt ? Date.now() - sessionStartedAt : 0,
      lazy_runtime: true,
    });
  };

  const maybeSyncCallerIntent = (utterance: string | null) => {
    if (!utterance || !liveControlPlane || !streamClaimsForTeardown) return;
    void syncLiveCallerUtteranceIntent({
      claims: streamClaimsForTeardown,
      callerUtterance: utterance,
      controlPlane: liveControlPlane,
      sendLiveOut,
    }).catch((err) => {
      console.error("[live-media] caller intent sync failed", err);
    });
  };

  const processInboundCallerFrame = (payloadB64: string) => {
    const telnyxAt = performance.now();
    for (const ev of callerAudioDetector.processFrame(payloadB64, telnyxAt)) {
      turnTracer.onCallerActivity(ev);
      if (ev.type === "CALLER_AUDIO_ENDED_ESTIMATE") {
        maybeSyncCallerIntent(conversationTranscript.commitLatestCallerUtterance());
      }
    }
    const forwardedAt = performance.now();
    turnTracer.onTelnyxInboundFrame(telnyxAt, forwardedAt);
    return forwardedAt;
  };

  const appendCallerAudio = (payloadB64: string, track?: string) => {
    if (!liveStarted) return;
    if (!shouldForwardInboundTelnyxTrackToLive(track)) {
      telnyxOutboundFramesDropped += 1;
      maybeLogStats();
      return;
    }
    processInboundCallerFrame(payloadB64);
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

  const sendAudioToTelnyx = (
    base64Audio: string,
    fromFlush = false,
    openAiDeltaPerf?: number,
  ) => {
    if (!telnyxStreamId || input.telnyxSocket.readyState !== WebSocket.OPEN) {
      if (!fromFlush && pendingAmyAudio.length < MAX_PENDING_AMY_AUDIO) {
        pendingAmyAudio.push(base64Audio);
      }
      return;
    }
    openaiOutputAudioFrames += 1;
    maybeLogStats();
    if (openAiDeltaPerf != null) {
      turnTracer.onFirstAudioSentToTelnyx(openAiDeltaPerf);
    }
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
    milestone("openai_ws_connecting");
    openAiWs = new WebSocket(input.openAiLiveWsUrl, {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "User-Agent": "Transovo-LiveMediaBridge/1.0",
      },
    });

    openAiWs.on("open", () => {
      milestone("openai_ws_open");
      if (sessionStartSent) return;

      const sendSessionStart = (payload: Record<string, unknown>) => {
        if (sessionStartSent) return;
        sessionStartSent = true;
        const startEvent = {
          ...payload,
          event_id: (payload.event_id as string) || liveBaselineEventId("session_start"),
        };
        sendLiveOut(startEvent);
        milestone("session_start_sent", {
          delegation: delegationEnabled,
          immediate_live_start: Boolean(input.immediateLiveStart),
        });
      };

      if (input.immediateLiveStart) {
        sendSessionStart(input.immediateLiveStart.minimalSessionStartPayload);
        return;
      }

      if (input.sessionStartPayload) {
        sendSessionStart(input.sessionStartPayload);
        if (input.toolContext) {
          attachDelegation(input.toolContext);
        }
      }
    });

    openAiWs.on("message", (raw) => {
      void (async () => {
        let event: LiveEvent;
        try {
          event = JSON.parse(raw.toString()) as LiveEvent;
        } catch (err) {
          console.error("[live-media] invalid JSON", err);
          return;
        }
        const type = String(event.type || "");

        if (delegationHandler) {
          delegationHandler.observeInboundLiveEvent(event as Record<string, unknown>);
          await delegationHandler.handleLiveServerEvent(event as Record<string, unknown>);
        }

        if (type === "session.started") {
          liveStarted = true;
          sessionStartedAt = Date.now();
          const openAiSessionId = String((event.session as { id?: string })?.id ?? "");
          if (input.immediateLiveStart?.toolContext.controlPlane) {
            input.immediateLiveStart.toolContext.controlPlane.setLiveSessionId(openAiSessionId);
          }
          milestone("session_started", {
            session_id: openAiSessionId,
            delegation: delegationEnabled,
          });
          if (input.immediateLiveStart) {
            attachStaticDelegation();
          }
          logLiveIn("session.started", {
            callId,
            session_id: openAiSessionId,
          });
          flushPendingCallerAudio();
          if (shouldSendLiveOpeningGreetingAfterSessionStarted()) {
            const instr = buildLiveOpeningGreetingInstructionAppend();
            liveGreetingInstrEventId = String(instr.event_id ?? "");
            sendLiveOut(instr);
            milestone("live_greeting_instruction_sent", {
              event_id: liveGreetingInstrEventId,
            });
          }
          return;
        }

        if (
          liveGreetingInstrEventId &&
          !liveGreetingKickoffSent &&
          isLiveInstructionsAppendedAck(event as Record<string, unknown>, liveGreetingInstrEventId)
        ) {
          liveGreetingKickoffSent = true;
          sendLiveOut(buildLiveOpeningGreetingKickoffCommentary());
          milestone("live_greeting_kickoff_sent");
          return;
        }

        if (type === "session.command.rejected" && liveGreetingInstrEventId) {
          console.error("[live-media] greeting command rejected", event);
          logLiveIn("session.command.rejected", { callId });
          return;
        }

        if (isLiveInputTranscriptDelta(type)) {
          const delta = String(event.delta ?? "");
          if (delta) {
            conversationTranscript.appendDelta("caller", delta);
            turnTracer.onLiveInputTranscriptDelta(delta, event as Record<string, unknown>);
          }
          return;
        }

        if (isLiveInputTranscriptDone(type)) {
          maybeSyncCallerIntent(conversationTranscript.commitLatestCallerUtterance());
          return;
        }

        if (isLiveOutputAudioDelta(type) && event.delta) {
          const openAiAt = performance.now();
          turnTracer.onFirstOutputAudioDelta(event as Record<string, unknown>);
          if (!firstOutputAudioLogged) {
            firstOutputAudioLogged = true;
            milestone("first_output_audio_delta");
            logLiveIn("output_audio.delta", { callId, first: true });
          }
          sendAudioToTelnyx(String(event.delta), false, openAiAt);
          return;
        }

        if (isLiveOutputTranscriptDelta(type)) {
          const delta = String(event.delta ?? "");
          if (delta) {
            conversationTranscript.appendDelta("amy", delta);
            amyTranscriptBuffer += delta;
            if (liveControlPlane) {
              const hasOffer = Boolean(
                liveControlPlane.getCallContext()?.currentOfferSet?.offerSetId,
              );
              if (
                detectConcreteAvailabilityWithoutOfferSet(amyTranscriptBuffer, hasOffer)
              ) {
                console.error(
                  `LIVE_CONCRETE_AVAILABILITY_VIOLATION ${JSON.stringify({
                    callId,
                    has_offer_set: hasOffer,
                    transcript_tail: amyTranscriptBuffer.slice(-240),
                  })}`,
                );
                amyTranscriptBuffer = "";
              }
            }
            if (
              liveControlPlane &&
              detectBookingConfirmationViolation(
                amyTranscriptBuffer,
                liveControlPlane.isBookingConfirmed(),
              )
            ) {
              console.error(
                `LIVE_BOOKING_CONFIRMATION_VIOLATION ${JSON.stringify({
                  callId,
                  booking_confirmed: liveControlPlane.isBookingConfirmed(),
                  booking_status: liveControlPlane.isBookingConfirmed()
                    ? "BOOKING_CONFIRMED"
                    : "NOT_BOOKED",
                  voice_v2_next_stage: liveControlPlane.getWorkflowEnvelope().voice_v2_next_stage,
                  transcript_tail: amyTranscriptBuffer.slice(-240),
                })}`,
              );
              amyTranscriptBuffer = "";
            }
            turnTracer.onLiveOutputTranscriptDelta(delta, event as Record<string, unknown>);
          }
          logLiveIn("output_transcript.delta", {
            callId,
            delta,
          });
          return;
        }

        if (type === "error") {
          const errPayload = (event.error ?? event) as Record<string, unknown>;
          console.error(JSON.stringify(errPayload, null, 2));
          logLiveIn("error", {
            callId,
            code: errPayload.code ?? null,
            message: errPayload.message ?? null,
          });
          return;
        }

        if (type === "session.closed") {
          logLiveIn("session.closed", {
            callId,
            reason: String(event.reason ?? ""),
          });
          return;
        }
      })().catch((err) => {
        console.error("[live-media] message handler", err);
      });
    });

    openAiWs.on("error", (err) => {
      console.error("[live-media websocket error]", err);
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

  connectOpenAi();

  const closeLiveSession = () => {
    if (!liveRuntimeDisposed && streamClaimsForTeardown) {
      liveRuntimeDisposed = true;
      void disposeLiveCallRuntime(streamClaimsForTeardown);
    }
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
      milestone("telnyx_stream_start", { stream_id: telnyxStreamId });
      console.info(`[telnyx] stream started callId=${callId} stream_id=${telnyxStreamId ?? ""}`);
      flushPendingAmyAudio();
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
        processInboundCallerFrame(payload);
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
    console.error("[live-media telnyx error]", err);
    closeLiveSession();
  });
}
