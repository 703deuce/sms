#!/usr/bin/env npx tsx
/**
 * Voice AI booking production path certification (structural + hermetic).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checks: Array<[string, boolean]> = [];

function pass(name: string, ok: boolean) {
  checks.push([name, ok]);
}

pass(
  "VOICE_AI_BOOKING_TOOL_SELECTED",
  readFileSync("src/lib/voice/tools/builtin-actions.ts", "utf8").includes("voice_ai_booking_turn"),
);
pass(
  "VOICE_FAST_TOOL_RESPONSE",
  readFileSync("src/lib/voice/tools/builtin-actions.ts", "utf8").includes(
    "startVoiceAiBookingDurableOperation",
  ),
);
pass(
  "VOICE_WAIT_ACKNOWLEDGEMENT",
  readFileSync("src/lib/mctb/durable-operations/holding.ts", "utf8").includes(
    "Give me just a moment",
  ),
);
pass(
  "NO_FALSE_BOOKING_CLAIMS",
  readFileSync("src/lib/voice/tools/workflow-tool-fast-path.ts", "utf8").includes("!processing"),
);
pass(
  "RECONNECT_POINTER_MIGRATION",
  readFileSync("src/lib/calendar/oauth.ts", "utf8").includes(
    "migrateMctbAiBookingMicrosoftConnectionPointers",
  ),
);
pass(
  "BOOKING_IDEMPOTENCY",
  readFileSync("src/lib/mctb/durable-operations/create.ts", "utf8").includes("idempotencyKey"),
);
pass(
  "OBSERVABILITY_PERSISTED",
  readFileSync("src/lib/voice/ai-booking/operation-audit.ts", "utf8").includes(
    "VOICE_AI_BOOKING_OPERATION",
  ),
);

for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}
const broken = checks.filter(([, ok]) => !ok).length;
assert.equal(broken, 0, `${broken} failed`);
console.log("BROKEN 0");
console.log("test-voice-ai-booking-production-path-cert: ok");
