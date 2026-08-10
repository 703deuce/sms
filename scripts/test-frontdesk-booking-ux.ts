/**
 * Regression tests for post-email filler ordering and one-and-done booking close.
 * Run: npx tsx scripts/test-frontdesk-booking-ux.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BOOKING_COMPLETE_TOOL_RESULT,
  POST_EMAIL_BOOKING_FILLER,
  buildBookingSuccessLine,
} from "../voice-runtime/src/booking-completion-messages";

const frontdeskSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/frontdesk-booking-agent.ts"),
  "utf8",
);
const amySource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/amy-receptionist-agent.ts"),
  "utf8",
);

// --- 1. Post-email filler is spoken before protected write ---

assert.ok(
  frontdeskSource.includes("POST_EMAIL_BOOKING_FILLER"),
  "frontdesk uses shared post-email filler constant",
);

const emailToFiller = frontdeskSource.match(
  /GetEmailTask[\s\S]*?\.run\(\)[\s\S]*?await runCtx\.update\(POST_EMAIL_BOOKING_FILLER\)/,
);
assert.ok(emailToFiller, "GetEmailTask.run() is followed by immediate parent filler update");

const fillerBeforeProtect = frontdeskSource.match(
  /await runCtx\.update\(POST_EMAIL_BOOKING_FILLER\)\s*;\s*runCtx\.disallowInterruptions\(\)/,
);
assert.ok(
  fillerBeforeProtect,
  "filler is spoken before disallowInterruptions (protected provider write)",
);

assert.doesNotMatch(
  frontdeskSource,
  /runCtx\.disallowInterruptions\(\)\s*;\s*await runCtx\.update\(POST_EMAIL_BOOKING_FILLER\)/,
  "filler must not come after disallowInterruptions",
);

// --- 2. Provider booking still occurs once inside telemetry wrapper ---

const scheduleTelemetryBlocks = frontdeskSource.match(
  /withLiveKitToolTelemetry\([\s\S]*?scheduleAppointmentResilient/g,
);
assert.ok(scheduleTelemetryBlocks, "schedule_appointment still calls scheduleAppointmentResilient");

assert.ok(
  frontdeskSource.includes("markBookingConfirmed"),
  "booking receipt is still persisted after provider write",
);

// --- 3. Final confirmation spoken once via deterministic update ---

const successLine = buildBookingSuccessLine("Monday at 3 PM");
assert.match(successLine, /confirmed for Monday at 3 PM/);
assert.match(successLine, /confirmation text/i);

assert.ok(
  frontdeskSource.includes("await runCtx.update(buildBookingSuccessLine(local))"),
  "final confirmation is spoken once from parent tool via update()",
);

assert.ok(
  frontdeskSource.includes("return BOOKING_COMPLETE_TOOL_RESULT"),
  "tool result tells model not to repeat confirmation",
);

assert.match(BOOKING_COMPLETE_TOOL_RESULT, /BOOKING_COMPLETE_ALREADY_SPOKEN/);
assert.match(BOOKING_COMPLETE_TOOL_RESULT, /end_call/);

// --- 4. No duplicate goodbye sequence — end_call on frontdesk ---

assert.ok(frontdeskSource.includes('name: "end_call"'), "frontdesk exposes end_call");
assert.ok(frontdeskSource.includes("buildFrontDeskBusinessAnswerTool"), "frontdesk wires business answer tool");
assert.ok(frontdeskSource.includes("buildFrontDeskCancelAppointmentTool"), "frontdesk wires cancel tool");
assert.ok(
  frontdeskSource.includes("do not repeat it or give") &&
    frontdeskSource.includes("multiple goodbyes"),
  "instructions forbid multiple wrap-ups",
);

assert.ok(
  amySource.includes("return BOOKING_COMPLETE_TOOL_RESULT"),
  "amy schedule path uses same one-and-done completion result",
);

console.log("frontdesk booking UX tests: PASS");
