import "server-only";

import { afterVoiceV3StateChange } from "@/lib/server/voice-v3/agent/after-state-change";
import { resolveVoiceV3DelegatedRuntimeContextForLiveKit } from "@/lib/server/voice-v3/livekit/live-context";
import { getRollingCallerTranscript } from "@/lib/server/voice-v3/conversation/transcript-accumulator";
import { mergeDialogActiveGoalFromOperation } from "@/lib/server/voice-v3/intake/merge-intake-state";
import { transcriptSignalsBookingIntent } from "@/lib/server/voice-v3/intake/booking-intent-from-transcript";
import { callerAffirmsBookingLinkToInboundNumber } from "@/lib/server/voice-v3/intake/sms-to-inbound-affirmation";
import { executeNativeVoiceV3Tool } from "@/lib/server/voice-v3/execute-tool";
import {
  attachLiveContextEventsToToolResult,
  createVoiceV3LiveKitLiveContextCollector,
  VOICE_V3_LIVEKIT_LIVE_CONTEXT_RESULT_KEY,
} from "@/lib/server/voice-v3/livekit/live-context";
import { getLiveSession } from "@/lib/server/receptionist/runtime/session-store";
import { getVoiceV3CallRuntime } from "@/lib/server/voice-v3/state/call-runtime";

export async function resolveDelegatedRuntimeContext(input: {
  liveSessionId: string;
  delegationId?: string | null;
}) {
  const session = getLiveSession(input.liveSessionId);
  if (!session) return { liveContextEvents: [] };
  return resolveVoiceV3DelegatedRuntimeContextForLiveKit(input);
}

export async function commitCallerUtterance(input: {
  liveSessionId: string;
  utterance: string;
}) {
  const inputSession = getLiveSession(input.liveSessionId);
  if (!inputSession) {
    return { committed: false, code: "RUNTIME_NOT_FOUND" };
  }
  const { commitFinalCallerUtterance } = await import(
    "@/lib/server/voice-v3/conversation/caller-turn-manager"
  );
  const turn = commitFinalCallerUtterance(input.liveSessionId, input.utterance);
  if (!turn) {
    return { committed: false, code: "EMPTY_UTTERANCE" };
  }

  const liveContext = createVoiceV3LiveKitLiveContextCollector();
  const runtime = getVoiceV3CallRuntime(input.liveSessionId);
  if (runtime) {
    const rolling = getRollingCallerTranscript(input.liveSessionId);
    if (
      runtime.config.scheduling?.bookingStrategy === "SEND_LINK" &&
      transcriptSignalsBookingIntent(rolling)
    ) {
      const snap = runtime.getSnapshot();
      const merged = mergeDialogActiveGoalFromOperation(snap, "send_booking_link");
      if (merged.runtime.version !== snap.runtime.version) {
        runtime.replaceContext(merged);
      }
    }
    afterVoiceV3StateChange({
      runtime,
      reason: "caller_turn_committed",
      send: liveContext.sendContext,
    });

    const utterance = input.utterance.trim();
    const sendLinkMode = runtime.config.scheduling?.bookingStrategy === "SEND_LINK";
    const bookingContext =
      sendLinkMode &&
      (transcriptSignalsBookingIntent(rolling) ||
        runtime.getSnapshot().dialog.activeGoal === "BOOK_APPOINTMENT");
    const linkAlreadySent =
      runtime.getSnapshot().bookingLink?.lastSend?.status === "sent" ||
      runtime.getSnapshot().bookingLink?.lastSend?.status === "already_sent";
    if (
      bookingContext &&
      !linkAlreadySent &&
      callerAffirmsBookingLinkToInboundNumber(utterance)
    ) {
      const autoFcId = `auto_send_link_${turn.turnId}`;
      const toolResult = await executeNativeVoiceV3Tool({
        session: inputSession,
        toolName: "send_booking_link",
        args: { confirmed: true },
        functionCallId: autoFcId,
      });
      console.log("VOICE_V3_AUTO_SEND_BOOKING_LINK", {
        live_session_id: input.liveSessionId,
        turn_id: turn.turnId,
        ok: toolResult.ok,
        status: toolResult.status,
      });
      if (toolResult.ok) {
        afterVoiceV3StateChange({
          runtime,
          reason: "auto_send_booking_link",
          send: liveContext.sendContext,
        });
      }
    }
  }

  const base = {
    committed: true,
    sequence: turn.sequence,
    turnId: turn.turnId,
    utterance: input.utterance.trim(),
  };
  if (liveContext.events.length === 0) {
    return base;
  }
  return attachLiveContextEventsToToolResult(base, liveContext.events) as typeof base & {
    [VOICE_V3_LIVEKIT_LIVE_CONTEXT_RESULT_KEY]: unknown;
  };
}
