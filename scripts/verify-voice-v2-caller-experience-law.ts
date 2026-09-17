#!/usr/bin/env npx tsx
/**
 * FAIL the build if Voice V2 caller-experience law is missing or regressed.
 * npm run verify:voice-v2-caller-experience-law
 */
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  VOICE_V2_CALLER_EXPERIENCE_LAW_PATHS,
  VOICE_V2_CALLER_EXPERIENCE_RULE_CATALOG,
} from "../src/lib/voice-v2/caller-experience-law";

const PRELOAD =
  "NODE_OPTIONS='--import ./scripts/preload-server-only.mjs'";

function fail(msg: string) {
  console.error("FAIL [caller-experience-law]:", msg);
  process.exit(1);
}

function runHeadless(label: string, cmd: string) {
  console.log(`→ ${label}`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd() });
}

for (const [key, rel] of Object.entries(VOICE_V2_CALLER_EXPERIENCE_LAW_PATHS)) {
  if (!existsSync(rel)) fail(`missing ${key}: ${rel}`);
}

const lawDoc = readFileSync(VOICE_V2_CALLER_EXPERIENCE_LAW_PATHS.lawDoc, "utf8");
if (!lawDoc.includes("## Appendix — full rule catalog")) {
  fail("law doc must include appendix rule catalog");
}
if (VOICE_V2_CALLER_EXPERIENCE_RULE_CATALOG.length < 10) {
  fail("caller-experience rule catalog too small — law regression");
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
  if (/await\s+prisma\.auditLog/.test(src)) {
    fail(`${name} route must not await prisma.auditLog (Law 6 — defer observer)`);
  }
  if (!src.includes("void prisma.auditLog")) {
    fail(`${name} route must void-defer audit telemetry after provider result`);
  }
}
if (!bookRoute.includes("evaluateBookingIntakeGate")) {
  fail("PSTN book route must run wizard BOOK gate before certified executor");
}

const inbound = readFileSync("src/lib/voice/inbound.ts", "utf8");
if (!inbound.includes("scheduleVoiceV2CallWarmup")) {
  fail("inbound must schedule Voice V2 warmup (P10)");
}
const warmupIdx = inbound.indexOf("scheduleVoiceV2CallWarmup");
const assistantStartIdx = inbound.indexOf("assistantStartReturnedAt");
if (warmupIdx < 0 || assistantStartIdx < 0 || warmupIdx < assistantStartIdx) {
  fail("warmup must be scheduled after assistant start returns (P10)");
}

const amy = readFileSync("src/lib/voice-v2/one-amy/amy-core-static-prompt.ts", "utf8");
if (!amy.includes("does not require an external action")) {
  fail("one-amy prompt must include booking-intent conversational rule");
}

runHeadless("test-voice-v2-caller-experience-law.ts", `${PRELOAD} npx tsx scripts/test-voice-v2-caller-experience-law.ts`);
runHeadless("test-voice-v2-one-amy-headless.ts", "npx tsx scripts/test-voice-v2-one-amy-headless.ts");
runHeadless(
  "test-voice-v2-step1-intake-headless.ts",
  `${PRELOAD} npx tsx scripts/test-voice-v2-step1-intake-headless.ts`,
);
runHeadless(
  "test-voice-v2-scheduling-preference-headless.ts",
  `${PRELOAD} npx tsx scripts/test-voice-v2-scheduling-preference-headless.ts`,
);
runHeadless(
  "test-voice-v2-call-warmup-phase-2b.ts",
  `${PRELOAD} VOICE_V2_ALLOW_MEMORY_L2=1 npx tsx scripts/test-voice-v2-call-warmup-phase-2b.ts`,
);
runHeadless("test-voice-v2-certified-boundary.ts", "npx tsx scripts/test-voice-v2-certified-boundary.ts");
runHeadless(
  "test-voice-v2-wizard-conversational-intake-headless.ts",
  `${PRELOAD} npx tsx scripts/test-voice-v2-wizard-conversational-intake-headless.ts`,
);
runHeadless("test-voice-v2-custom-intake-headless.ts", `${PRELOAD} npx tsx scripts/test-voice-v2-custom-intake-headless.ts`);

const compileTs = readFileSync("src/lib/voice/receptionist/compile.ts", "utf8");
if (compileTs.includes("voiceV2Intake: advanced?.voiceV2Intake")) {
  fail("compile must pass full advanced to compileVoiceV2IntakeSchema for custom callerFields");
}

console.log("PASS: verify-voice-v2-caller-experience-law");
