/**
 * Frozen Voice V2 known-good baseline — see KNOWN_GOOD_BASELINE.md
 * Import for scripts/guards only; do not add runtime deps from FIND/BOOK hot path.
 */

export const VOICE_V2_KNOWN_GOOD_BASELINE = {
  gitCommit: "06125f5fb6be3850e9e93314901067d1a4c2fa32",
  shortSha: "06125f5f",
  label: "VOICE_V2_KNOWN_GOOD_BASELINE",
  certifiedPstnUtc: "2026-09-15T12:03:00Z",
  referenceFindWebhookTotalMs: 1969,
  referenceFindTokenMs: 125,
  referenceFindGraphMs: 375,
  referenceFindComputeMs: 135,
} as const;

/** Paths that must not change without re-running PSTN certification (Microsoft sealed box). */
export const VOICE_V2_FROZEN_PATHS = [
  "src/lib/voice-v2/pipelines/microsoft-365-certified/find-availability.ts",
  "src/lib/voice-v2/pipelines/microsoft-365-certified/book-offered-slot.ts",
  "src/lib/voice-v2/pipelines/microsoft-365-certified/index.ts",
  "src/app/api/telnyx/voice-v2/find-availability/route.ts",
  "src/app/api/telnyx/voice-v2/book-offered-slot/route.ts",
  "scripts/verify-microsoft-365-certified-pipeline-frozen.ts",
] as const;

export const VOICE_V2_BASELINE_REGRESSION = [
  "FIND_BACKEND_P50_1_TO_3_SEC",
  "AMY_RECEIVES_REAL_SLOTS",
  "BOOK_ONE_MICROSOFT_EVENT",
  "CORRECT_DATE_TIME_TIMEZONE",
  "AMY_CONFIRMS_AFTER_PROVIDER_SUCCESS",
  "LEGACY_VOICE_AI_BOOKING_TURN_0",
  "SECOND_SCHEDULING_LLM_0",
] as const;
