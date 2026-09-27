/**
 * FROZEN — Voice V3 PSTN Microsoft booking pipeline (voice_v3_pstn_booking_microsoft_v1)
 *
 * PSTN-certified 2026-09-19 on ws_1 / +15717491060 (wizard v98, deploy d001625b).
 * Do not change booking behavior without updating docs/VOICE-V3-PSTN-BOOKING-PIPELINE-FROZEN.md,
 * bumping VOICE_V3_BOOKING_FROZEN_REVISION, and re-certifying a live book on the reference line.
 *
 * @see docs/VOICE-V3-PSTN-BOOKING-PIPELINE-FROZEN.md
 * @see docs/voice-v3/BOOKING-PIPELINE-RUNTIME-PATH.md
 */

export const VOICE_V3_BOOKING_PIPELINE_ID = "voice_v3_pstn_booking_microsoft_v1" as const;

/** Bump only after intentional recert + doc update. */
export const VOICE_V3_BOOKING_FROZEN_REVISION = "2026-09-19-ws1-pstn-microsoft-book-cert" as const;

/** Production image commit when ws_1 PSTN book was certified. */
export const VOICE_V3_BOOKING_FROZEN_BASELINE_GIT =
  "d001625bb3b98834219b8ed48d34abc0dc59cd20" as const;

export const VOICE_V3_BOOKING_REFERENCE_WORKSPACE_ID = "ws_1" as const;
export const VOICE_V3_BOOKING_REFERENCE_AGENT_ID = "cmshz2lc25c622c4i58303501" as const;
export const VOICE_V3_BOOKING_REFERENCE_E164 = "+15717491060" as const;
export const VOICE_V3_BOOKING_REFERENCE_LIVE_SESSION_ID =
  "live_u7_EPmVEp3oMMiXmdMIv8epTgIJhqzfYrYZ" as const;
export const VOICE_V3_BOOKING_REFERENCE_CERT_UTC = "2026-09-19T10:22:33.927Z" as const;

/** Certified tool sequence (Astra → executeVoiceTool). Order may interleave with conversation. */
export const VOICE_V3_BOOKING_FROZEN_TOOL_CHAIN = [
  "set_scheduling_preference",
  "find_availability",
  "update_intake",
  "book_appointment",
] as const;

/**
 * Source files that implement the frozen PSTN booking path.
 * CI: scripts/test-voice-v3-booking-pipeline-frozen-contract.ts
 */
export const VOICE_V3_BOOKING_FROZEN_SOURCE_FILES = [
  "src/lib/voice-v3-basic/openai-live-webhook.ts",
  "src/lib/voice-v3/config/from-published-agent.ts",
  "src/lib/voice-v3/config/compile-voice-v3-agent-config.ts",
  "src/lib/voice-v3/config/booking-agent-config.ts",
  "src/lib/voice-v3/state/call-runtime.ts",
  "src/lib/voice-v3/state/call-rules.ts",
  "src/lib/voice-v3/tools/execute-voice-tool.ts",
  "src/lib/voice-v3/tools/set-scheduling-preference-tool.ts",
  "src/lib/voice-v3/tools/find-availability-tool.ts",
  "src/lib/voice-v3/tools/book-appointment-tool.ts",
  "src/lib/voice-v3/tools/authorize-tool-for-config.ts",
  "src/lib/voice-v3/calendar/find-dispatch.ts",
  "src/lib/voice-v3/calendar/book-dispatch.ts",
  "src/lib/voice-v3/calendar/find-availability.ts",
  "src/lib/voice-v3/calendar/booking-attempt-registry.ts",
  "src/lib/voice-v3/calendar/revalidate-selected-slot.ts",
  "src/lib/voice-v3/calendar/build-create-booking-request.ts",
  "src/lib/voice-v3/calendar/microsoft/microsoft-find-availability.ts",
  "src/lib/voice-v3/calendar/microsoft/microsoft-create-booking.ts",
  "src/lib/voice-v3/time/scheduling-normalizer.ts",
  "src/lib/voice-v3/pipeline-boundary.ts",
  "src/lib/voice-v3/frozen-booking-pipeline.ts",
] as const;

export function isVoiceV3BookingPipelineFrozen(): boolean {
  return true;
}
