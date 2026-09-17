import { logRealtimeBridgeEvent } from "./telemetry";

/** Chronological GPT-Live bridge trace (grep `openai_live_diag` during a test call). */
export function createLiveBridgeDiagnostics(callId: string) {
  const bridgeStartedAt = Date.now();
  let sessionStartedAt: number | null = null;
  let clientSeq = 0;
  let serverSeq = 0;
  let amyAudioSegment = 0;
  let amyAudioSegmentOpen = false;
  let amyAudioSegmentStartedAt: number | null = null;
  let inboundChunksForwarded = 0;
  let outboundChunksDropped = 0;
  let inputAudioAppendChunks = 0;
  let lastDiagSummaryAt = 0;

  const msSinceSession = () =>
    sessionStartedAt == null ? null : Date.now() - sessionStartedAt;

  const msSinceBridge = () => Date.now() - bridgeStartedAt;

  const enabled = () => process.env.OPENAI_LIVE_DIAG_TRACE !== "0";

  const log = (event: string, fields: Record<string, unknown>) => {
    if (!enabled()) return;
    logRealtimeBridgeEvent(event, { callId, diag: true, ...fields });
  };

  return {
    markSessionStarted() {
      sessionStartedAt = Date.now();
      log("openai_live_diag_session_started", {
        ms_since_bridge: msSinceBridge(),
      });
    },

    logClientEvent(
      source: string,
      event: Record<string, unknown>,
    ) {
      if (!enabled()) return;
      clientSeq += 1;
      const type = String(event.type || "");
      if (type === "session.input_audio.append") {
        inputAudioAppendChunks += 1;
        const now = Date.now();
        if (now - lastDiagSummaryAt >= 1000) {
          lastDiagSummaryAt = now;
          log("openai_live_diag_input_audio_summary", {
            seq: clientSeq,
            ms_since_session: msSinceSession(),
            append_chunks_total: inputAudioAppendChunks,
            inbound_telnyx_chunks_forwarded: inboundChunksForwarded,
            outbound_telnyx_chunks_dropped: outboundChunksDropped,
            source: "live-call-bridge",
          });
        }
        return;
      }
      log("openai_live_diag_client_event", {
        seq: clientSeq,
        source,
        type,
        event_id: event.event_id ?? null,
        ms_since_bridge: msSinceBridge(),
        ms_since_session: msSinceSession(),
        delegation_id: event.delegation_id ?? undefined,
        content_chars:
          typeof event.content === "string" ? event.content.length : undefined,
      });
    },

    logServerEvent(ev: Record<string, unknown>) {
      if (!enabled()) return;
      const type = String(ev.type || "");
      serverSeq += 1;

      if (type === "session.output_audio.delta" && ev.delta) {
        if (!amyAudioSegmentOpen) {
          amyAudioSegment += 1;
          amyAudioSegmentOpen = true;
          amyAudioSegmentStartedAt = Date.now();
          log("openai_live_diag_amy_audio_segment_start", {
            segment: amyAudioSegment,
            ms_since_session: msSinceSession(),
            server_seq: serverSeq,
          });
        }
        return;
      }

      if (amyAudioSegmentOpen && type !== "session.output_audio.delta") {
        log("openai_live_diag_amy_audio_segment_end", {
          segment: amyAudioSegment,
          ms_since_session: msSinceSession(),
          duration_ms:
            amyAudioSegmentStartedAt != null
              ? Date.now() - amyAudioSegmentStartedAt
              : null,
          next_server_type: type,
        });
        amyAudioSegmentOpen = false;
        amyAudioSegmentStartedAt = null;
      }

      if (type === "session.output_transcript.delta") {
        log("openai_live_diag_server_transcript_delta", {
          server_seq: serverSeq,
          ms_since_session: msSinceSession(),
          delta_chars: String(ev.delta ?? "").length,
        });
        return;
      }

      log("openai_live_diag_server_event", {
        server_seq: serverSeq,
        type,
        event_id: ev.event_id ?? null,
        ms_since_bridge: msSinceBridge(),
        ms_since_session: msSinceSession(),
      });
    },

    logTelnyxMedia(track: string | undefined, action: "forward" | "drop") {
      if (action === "forward") inboundChunksForwarded += 1;
      else outboundChunksDropped += 1;
      if (!enabled()) return;
      if (action === "drop" && outboundChunksDropped <= 5) {
        log("openai_live_diag_telnyx_media_dropped", {
          track: track ?? "unknown",
          reason: "outbound_not_forwarded_to_live_input",
          dropped_total: outboundChunksDropped,
          ms_since_session: msSinceSession(),
        });
      }
    },

    flushFirst15sReportHint() {
      log("openai_live_diag_trace_hint", {
        hint:
          "grep openai_live_diag for this callId; first 15s: client events, server segments, outbound drops",
        ms_since_bridge: msSinceBridge(),
      });
    },
  };
}
