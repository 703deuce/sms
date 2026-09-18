/**
 * Voice V3 appointment receptionist must not reach legacy Telnyx Amy / V2 booking HTTP tools.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import { isAppointmentReceptionistAgent } from "../src/lib/voice-v3/runtime-isolation";

const root = process.cwd();

for (const rel of [
  "src/app/api/telnyx/voice-v2/find-availability/route.ts",
  "src/lib/voice-v2/pipelines/microsoft-certified-booking.ts",
]) {
  assert.ok(!existsSync(join(root, rel)), `removed legacy path must not exist: ${rel}`);
}

const assistantSync = readFileSync(
  join(root, "src/lib/voice/telnyx/assistant-sync.ts"),
  "utf8",
);
assert.match(assistantSync, /VOICE_V3_ONLY_NO_LEGACY_TELNYX_AMY/);

const state = createDefaultWizardState();
state.bookingStrategy = "MICROSOFT_365";
state.calendarProvider = "microsoft";
state.calendarConnected = true;
const cfg = buildWizardAgentConfig(state);
assert.ok(isAppointmentReceptionistAgent(cfg), "wizard receptionist is V3-only agent");
assert.equal((cfg.advanced as Record<string, unknown>).voiceV2PstnLiveBooking, false);
assert.equal(
  (cfg.advanced as Record<string, unknown>).voiceV3PstnBooking,
  undefined,
  "no voiceV3PstnBooking feature flag",
);

const inbound = readFileSync(join(root, "src/lib/voice/inbound.ts"), "utf8");
const leanIdx = inbound.indexOf("isGptLivePstnLeanInbound");
const receptionistIdx = inbound.indexOf("isAppointmentReceptionistAgent");
assert.ok(
  receptionistIdx > 0 && leanIdx > 0 && receptionistIdx < leanIdx,
  "receptionist V3 SIP path runs before GPT-Live lean inbound",
);

const workflow = readFileSync(
  join(root, "src/lib/voice/telnyx/conversation-workflow.ts"),
  "utf8",
);
assert.match(workflow, /VOICE_V3_PSTN_GENERAL_APPEND/);

console.log("PASS voice-v3 runtime isolation");
