/**
 * Voice V3 must never import or dispatch through Voice V2 booking / Telnyx tool runtimes.
 * Enforced by `scripts/test-voice-v3-pipeline-boundary.ts`.
 */

/** Roots scanned for prohibited imports (relative to `src/`). */
export const VOICE_V3_PIPELINE_SCAN_ROOTS = [
  "lib/voice-v3",
  "lib/voice-v3-basic",
] as const;

/**
 * Import path fragments that must not appear in Voice V3 production code.
 * (Matches `from "...path..."` and `from "@/...path..."`.)
 */
export const VOICE_V3_PROHIBITED_IMPORT_MARKERS: readonly string[] = [
  "lib/voice-v2/",
  "voice-v2/pipelines",
  "voice-v2/book-offered-slot",
  "voice-v2/booking-workflow",
  "voice-v2/live-tool-registry",
  "voice-v2/telnyx-tool-definition",
  "voice-v2/runtime-dispatch-state",
  "agents/missed-call-text-back",
  "voice-runtime/",
  "live-tool-runtime",
  "api/telnyx/voice/tools",
];

/** Substrings that must not appear in Live delegation tool names for V3 basic. */
export const VOICE_V3_PROHIBITED_LIVE_TOOL_NAMES: readonly string[] = [
  "calendar_availability",
  "continue_workflow",
  "record_current_field",
  "book_offered_slot",
  "get_booking_verification",
];
