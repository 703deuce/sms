/**
 * Voice V2 caller-experience law — machine-readable anchor.
 * Human law: docs/VOICE-V2-CALLER-EXPERIENCE-LAW.md
 * Enforced by: scripts/verify-voice-v2-caller-experience-law.ts
 */

export const VOICE_V2_CALLER_EXPERIENCE_LAW_VERSION = "1.1.0";

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
  afterHoursContract: "docs/VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md",
  cloudHandoff: "docs/VOICE-V2-CLOUD-AGENT-HANDOFF.md",
  step1Intake: "docs/VOICE_V2_STEP_1_INTAKE.md",
  cursorRule: ".cursor/rules/voice-v2-caller-experience-first.mdc",
  verifyScript: "scripts/verify-voice-v2-caller-experience-law.ts",
  lawTest: "scripts/test-voice-v2-caller-experience-law.ts",
} as const;

export type VoiceV2CallerExperienceEnforcement =
  | "runtime"
  | "verify_static"
  | "verify_headless"
  | "prompt"
  | "pstn_cert";

/** Catalog IDs referenced in law doc appendix — do not remove without law doc update. */
export type VoiceV2CallerExperienceRuleId =
  | "LAW-1"
  | "LAW-2"
  | "LAW-3"
  | "LAW-4"
  | "LAW-5"
  | "LAW-6"
  | "LAW-7"
  | "P1"
  | "P2"
  | "P2b"
  | "P2c"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "P8"
  | "P9"
  | "P10"
  | "P11"
  | "P12"
  | "P13"
  | "P14"
  | "P15"
  | "P16"
  | "P17"
  | "P18"
  | "P19"
  | "AH-ONE-AMY"
  | "AH-SMALL-SURFACE"
  | "AH-TRUTH"
  | "AH-NO-REASK"
  | "STEP1-DEFER-PERSIST"
  | "STEP1-BOOK-GATE"
  | "METRIC-BOOKING-MODE-ENTRY-0";

export type VoiceV2CallerExperienceRule = {
  id: VoiceV2CallerExperienceRuleId;
  summary: string;
  source: string;
  enforcement: VoiceV2CallerExperienceEnforcement[];
  headless?: string;
};

/** Machine index — full text lives in source docs + law appendix. */
export const VOICE_V2_CALLER_EXPERIENCE_RULE_CATALOG: VoiceV2CallerExperienceRule[] = [
  {
    id: "LAW-1",
    summary: "Amy keeps talking; non-ack work DEFER/PRELOAD",
    source: "VOICE-V2-CALLER-EXPERIENCE-LAW.md §Law 1",
    enforcement: ["runtime", "verify_headless"],
    headless: "scripts/test-voice-v2-call-warmup-phase-2b.ts",
  },
  {
    id: "LAW-2",
    summary: "Answer/greet before awaited warmup or context",
    source: "VOICE_V2_CALLER_FIRST_ARCHITECTURE.md P10",
    enforcement: ["runtime", "verify_headless"],
    headless: "scripts/test-voice-v2-call-warmup-phase-2b.ts",
  },
  {
    id: "LAW-3",
    summary: "Booking intent = conversation only; no cold save_intake",
    source: "P7 · save-intake-fields.ts",
    enforcement: ["runtime", "verify_static", "verify_headless"],
    headless: "scripts/test-voice-v2-caller-experience-law.ts",
  },
  {
    id: "LAW-4",
    summary: "Full live transcript to model",
    source: "P14 · after-hours contract §4",
    enforcement: ["prompt", "pstn_cert"],
  },
  {
    id: "LAW-5",
    summary: "Collect without stalling on first cold context",
    source: "P7b · scheduling preference",
    enforcement: ["verify_headless"],
    headless: "scripts/test-voice-v2-scheduling-preference-headless.ts",
  },
  {
    id: "LAW-6",
    summary: "Only FIND/BOOK block claims; observers void/defer",
    source: "MUST_BLOCK · certified routes",
    enforcement: ["runtime", "verify_static"],
  },
  {
    id: "LAW-7",
    summary: "One Amy PSTN; no General→Live Booking handoff",
    source: "conversation-workflow.ts",
    enforcement: ["verify_headless"],
    headless: "scripts/test-voice-v2-one-amy-headless.ts",
  },
  {
    id: "P7",
    summary: "Zero Transovo tool calls to acknowledge booking intent",
    source: "VOICE_V2_CALLER_FIRST_ARCHITECTURE.md P7",
    enforcement: ["runtime", "prompt", "verify_headless"],
    headless: "scripts/test-voice-v2-one-amy-headless.ts",
  },
  {
    id: "METRIC-BOOKING-MODE-ENTRY-0",
    summary: "BOOKING_MODE_ENTRY_TOOL_CALLS = 0 for intent-only utterance",
    source: "VOICE_V2_CALLER_FIRST_ARCHITECTURE.md certification",
    enforcement: ["verify_headless", "pstn_cert"],
    headless: "scripts/test-voice-v2-one-amy-headless.ts",
  },
  {
    id: "P10",
    summary: "Warmup never delays answer/greeting",
    source: "P10 · inbound scheduleVoiceV2CallWarmup after assistant start",
    enforcement: ["runtime", "verify_headless"],
    headless: "scripts/test-voice-v2-call-warmup-phase-2b.ts",
  },
  {
    id: "STEP1-DEFER-PERSIST",
    summary: "Intake Postgres persist deferred; gate on BOOK",
    source: "VOICE_V2_STEP_1_INTAKE.md",
    enforcement: ["verify_headless"],
    headless: "scripts/test-voice-v2-step1-intake-headless.ts",
  },
  {
    id: "AH-ONE-AMY",
    summary: "One Amy, one transcript, no conversational handoff",
    source: "VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md §3",
    enforcement: ["verify_headless", "prompt"],
    headless: "scripts/test-voice-v2-one-amy-headless.ts",
  },
];
