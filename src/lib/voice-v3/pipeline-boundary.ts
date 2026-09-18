/**
 * Voice V3 must not dispatch through removed Voice V2 booking executors / Telnyx V2 webhooks.
 * Enforced by `scripts/test-voice-v3-pipeline-boundary.ts`.
 */

export const VOICE_V3_PIPELINE_SCAN_ROOTS = [
  "lib/voice-v3",
  "lib/voice-v3-basic",
] as const;

export const VOICE_V3_PROHIBITED_IMPORT_MARKERS: readonly string[] = [
  "voice-v2/pipelines",
  "voice-v2/book-offered-slot",
  "voice-v2/find-availability",
  "voice-v2/booking-workflow",
  "api/telnyx/voice-v2",
  "openai-live-bridge",
  "live-tool-runtime",
];

export const VOICE_V3_PROHIBITED_LIVE_TOOL_NAMES: readonly string[] = [
  "calendar_availability",
  "continue_workflow",
  "record_current_field",
  "book_offered_slot",
  "get_booking_verification",
];
