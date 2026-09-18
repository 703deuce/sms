#!/usr/bin/env npx tsx
/**
 * Caller-experience law — runtime contract tests (P7 fast reject).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-caller-experience-law.ts
 */
import { clearVoiceV2CallSessions } from "../src/lib/voice-receptionist-wizard/intake/session-store";
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-receptionist-wizard/intake/save-intake-fields";
import { VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS } from "../src/lib/voice-receptionist-wizard/caller-experience-law";
import { isBookingIntentOnlyFields } from "../src/lib/voice-receptionist-wizard/intake/booking-intent-guard";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

async function main() {
  assert(isBookingIntentOnlyFields({ service_reason: "appointment" }), "appointment-only intent");
  assert(isBookingIntentOnlyFields({ service_reason: "need to book" }), "need to book intent");
  assert(
    !isBookingIntentOnlyFields({ service_reason: "kitchen leak" }),
    "real service reason must not be intent-only",
  );

  clearVoiceV2CallSessions();
  const t0 = Date.now();
  const result = await executeVoiceV2SaveIntakeFields(
    {
      call_id: "cc:law-test-cold-context",
      fields: { service_reason: "appointment" },
      tool_invocation_id: "law-intent-1",
    },
    "ws_law_test",
    "agent_law_test",
  );
  const elapsed = Date.now() - t0;

  assert(result.status === VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS, `status ${result.status}`);
  assert(elapsed < 500, `intent-only save must not cold-load context (took ${elapsed}ms)`);
  assert(
    "TOTAL_MS" in result.timing_ms && result.timing_ms.TOTAL_MS < 200,
    `timing_ms.TOTAL_MS ${JSON.stringify(result.timing_ms)}`,
  );

  console.log("PASS: voice-v2 caller-experience law tests");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
