import { normalizeTelnyxMctbInboundEvent } from "@/lib/mctb/event-only/normalize";
import {
  mctbDirectTelnyxTestEmitSms,
  MCTB_DIRECT_TELNYX_TEST_LOG_SOURCE,
} from "@/lib/mctb/direct-telnyx-test/config";

const FALLBACK_WORKSPACE_ID =
  process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";

export type DirectTelnyxNormalizedEventKind = "call.missed" | "call.forwarded_unanswered";

/**
 * Emit a normalized missed-call automation event for the direct Telnyx isolation test.
 * Default: log only — no SMS unless MCTB_DIRECT_TELNYX_TEST_EMIT_SMS=1.
 */
export async function emitDirectTelnyxNormalizedEvent(input: {
  payload: Record<string, unknown>;
  holdDurationMs: number | null;
  answeredAt: string | null;
}): Promise<{
  kind: DirectTelnyxNormalizedEventKind;
  callEventId?: string;
  smsQueued: boolean;
}> {
  const normalized = normalizeTelnyxMctbInboundEvent(input.payload, {
    voiceCaptureStatus: "EVENT_CAPTURED",
  });
  if (!normalized) {
    console.log(
      JSON.stringify({
        source: MCTB_DIRECT_TELNYX_TEST_LOG_SOURCE,
        event: "normalized_event_skipped",
        reason: "invalid_payload",
      }),
    );
    return { kind: "call.forwarded_unanswered", smsQueued: false };
  }

  const hasForwardMetadata = Boolean(
    normalized.forwardedFromE164 || normalized.diversionHeader,
  );
  const kind: DirectTelnyxNormalizedEventKind = hasForwardMetadata
    ? "call.forwarded_unanswered"
    : "call.missed";

  console.log(
    JSON.stringify({
      source: MCTB_DIRECT_TELNYX_TEST_LOG_SOURCE,
      event: "normalized_automation_event",
      kind,
      providerCallId: normalized.providerCallId,
      callerE164: normalized.callerE164,
      transovoNumberE164: normalized.transovoNumberE164,
      forwardedFromE164: normalized.forwardedFromE164,
      hangupCause: normalized.hangupCause,
      sipHangupCause: normalized.sipHangupCause,
      holdDurationMs: input.holdDurationMs,
      answeredAt: input.answeredAt,
      livekitRoomCreated: false,
      captureMode: "DIRECT_TELNYX_TEST",
    }),
  );

  if (!mctbDirectTelnyxTestEmitSms()) {
    return { kind, smsQueued: false };
  }

  const { handleMctbInboundEvent } = await import("@/lib/mctb/event-only/handle");
  const result = await handleMctbInboundEvent(normalized, {
    fallbackWorkspaceId: FALLBACK_WORKSPACE_ID,
  });
  return {
    kind,
    callEventId: result.callEventId,
    smsQueued: Boolean(result.ok && !result.deduped),
  };
}
