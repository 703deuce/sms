import type { AgentSession } from "@livekit/agents";
import { appendLiveKitTranscriptLine } from "@/lib/voice/runtime-provider/livekit-call-telemetry";
import { deliverScriptedSpeech } from "../outbound/scripted-speech";
import { isAgentSessionAlive, safeInterruptSession } from "../session-utils";

/**
 * Speak a deterministic booking line on OpenAI Realtime without runCtx.update().
 * LiveKit pattern: allow_interruptions=False for authoritative lines (healthcare, warm-transfer).
 *
 * Returns true only when playout completes within maxWaitMs — never on timeout alone.
 */
export async function speakBookingLine<T extends { workspaceId: string; callId: string }>(
  session: AgentSession<T>,
  text: string,
  options?: { maxWaitMs?: number },
): Promise<boolean> {
  const maxWaitMs = options?.maxWaitMs ?? 30_000;
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (!isAgentSessionAlive(session)) {
    console.warn(
      JSON.stringify({
        source: "booking-speech",
        event: "speak_booking_line_skipped",
        callId: session.userData.callId,
        reason: "session_not_alive",
        preview: trimmed.slice(0, 80),
      }),
    );
    return false;
  }

  try {
    await safeInterruptSession(session);

    let completed = false;
    const playout = deliverScriptedSpeech(session, trimmed, {
      allowInterruptions: false,
      addToChatCtx: true,
    }).then(async () => {
      completed = true;
      const ud = session.userData;
      void appendLiveKitTranscriptLine({
        workspaceId: ud.workspaceId,
        callId: ud.callId,
        speaker: "agent",
        text: trimmed,
      }).catch(() => undefined);
    });

    await Promise.race([
      playout,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("speakBookingLine_timeout")), maxWaitMs),
      ),
    ]);
    return completed;
  } catch (err) {
    console.warn(
      JSON.stringify({
        source: "booking-speech",
        event: "speak_booking_line_failed",
        callId: session.userData.callId,
        error: err instanceof Error ? err.message : String(err),
        preview: trimmed.slice(0, 80),
      }),
    );
    return false;
  }
}
