/** Runtime-owned voice hold ladder (not prompt-controlled). */
export const VOICE_HOLD_LADDER_PHRASES = [
  "Absolutely — give me just a moment while I check the calendar.",
  "I'm pulling up the available times now.",
  "Thanks — it's taking just a moment longer than usual.",
] as const;

/** Milliseconds after operation start when tier 1 / 2 hold may be spoken. Tier 0 = immediate tool ack. */
export const VOICE_HOLD_LADDER_TIER_MS = [0, 3_500, 9_000] as const;

/** Max wall-clock for a voice booking operation before deterministic fallback. */
export const VOICE_OPERATION_MAX_MS = 45_000;

/** Telnyx webhook must ACK quickly; long work is durable. */
export const VOICE_EXTERNAL_TOOL_ACK_TARGET_MS = 1_000;
