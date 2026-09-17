/**
 * Voice V2 caller-experience law — machine-readable anchor.
 * Human law: docs/VOICE-V2-CALLER-EXPERIENCE-LAW.md
 * Enforced by: scripts/verify-voice-v2-caller-experience-law.ts
 */

export const VOICE_V2_CALLER_EXPERIENCE_LAW_VERSION = "1.0.0";

/** Only these tool types may block spoken availability/booking claims (MUST_BLOCK). */
export const VOICE_V2_MUST_BLOCK_TOOL_TYPES = [
  "voice_v2_find_availability",
  "voice_v2_book_offered_slot",
] as const;

/** Save-intake must reject these without cold CallContext (P7). */
export const VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS =
  "BOOKING_INTENT_CONVERSATION_ONLY" as const;

export const VOICE_V2_CALLER_EXPERIENCE_LAW_PATHS = {
  lawDoc: "docs/VOICE-V2-CALLER-EXPERIENCE-LAW.md",
  architecture: "docs/VOICE_V2_CALLER_FIRST_ARCHITECTURE.md",
  cursorRule: ".cursor/rules/voice-v2-caller-experience-first.mdc",
  verifyScript: "scripts/verify-voice-v2-caller-experience-law.ts",
  lawTest: "scripts/test-voice-v2-caller-experience-law.ts",
} as const;
