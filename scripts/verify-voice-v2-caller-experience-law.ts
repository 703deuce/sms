#!/usr/bin/env npx tsx
/**
 * FAIL the build if Voice V2 caller-experience law is missing or regressed.
 * npm run verify:voice-v2-caller-experience-law
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { VOICE_V2_CALLER_EXPERIENCE_LAW_PATHS } from "../src/lib/voice-v2/caller-experience-law";

function fail(msg: string) {
  console.error("FAIL [caller-experience-law]:", msg);
  process.exit(1);
}

for (const [key, rel] of Object.entries(VOICE_V2_CALLER_EXPERIENCE_LAW_PATHS)) {
  if (!existsSync(rel)) fail(`missing ${key}: ${rel}`);
}

const saveIntake = readFileSync("src/lib/voice-v2/intake/save-intake-fields.ts", "utf8");
if (!saveIntake.includes("isBookingIntentOnlyFields")) {
  fail("save-intake-fields must use isBookingIntentOnlyFields");
}
const fnBody = saveIntake.slice(saveIntake.indexOf("export async function executeVoiceV2SaveIntakeFields"));
const earlyIdx = fnBody.indexOf("isBookingIntentOnlyFields");
const ctxIdx = fnBody.indexOf("ensureVoiceV2CallContext");
if (earlyIdx < 0 || ctxIdx < 0 || earlyIdx > ctxIdx) {
  fail("booking-intent check must run before ensureVoiceV2CallContext in save handler");
}

const findRoute = readFileSync("src/app/api/telnyx/voice-v2/find-availability/route.ts", "utf8");
const bookRoute = readFileSync("src/app/api/telnyx/voice-v2/book-offered-slot/route.ts", "utf8");
for (const [name, src] of [
  ["find", findRoute],
  ["book", bookRoute],
] as const) {
  if (src.includes("ensureVoiceV2CallContext") || src.includes("patchWorkflowAfterFind")) {
    fail(`${name} route must not import lazy CallContext / workflow patch on hot path`);
  }
}

const amy = readFileSync("src/lib/voice-v2/one-amy/amy-core-static-prompt.ts", "utf8");
if (!amy.includes("does not require an external action")) {
  fail("one-amy prompt must include booking-intent conversational rule");
}

console.log("→ test-voice-v2-caller-experience-law.ts");
execSync(
  "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-caller-experience-law.ts",
  { stdio: "inherit" },
);

console.log("PASS: verify-voice-v2-caller-experience-law");
