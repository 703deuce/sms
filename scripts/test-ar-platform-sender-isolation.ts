/**
 * AR platform sender + launch isolation unit checks (no live SMS/calendar).
 * Run: npx tsx scripts/test-ar-platform-sender-isolation.ts
 */
import assert from "node:assert/strict";
import {
  pickFirstUnoccupiedPlatformSender,
  type ArPlatformSenderCandidate,
} from "../src/lib/appointment-reminders/messaging/ar-platform-sender-selection";
import {
  AR_AI_RESCHEDULER_MODEL_ID,
  getArAiReschedulerModelId,
} from "../src/lib/appointment-reminders/ai-rescheduler/model";
import {
  shouldShowProductSwitcher,
  visibleProductShells,
} from "../src/lib/products/product-shell";
import { AR_ROUTES } from "../src/lib/appointment-reminders/routes";
import {
  isAppointmentRemindersV1Primary,
  isMctbV1Primary,
  isPlatformSharedSmsMctbInboundEnabled,
} from "../src/lib/workspace/platform-launch";

const telnyx: ArPlatformSenderCandidate = {
  phoneNumberId: "pn-telnyx",
  e164: "+18005550100",
  workspaceId: "ws-platform",
  provider: "telnyx",
  priority: 1,
};
const twilio: ArPlatformSenderCandidate = {
  phoneNumberId: "pn-twilio",
  e164: "+18005550200",
  workspaceId: "ws-platform",
  provider: "twilio",
  priority: 2,
};

assert.equal(
  pickFirstUnoccupiedPlatformSender([telnyx, twilio], new Set())?.phoneNumberId,
  "pn-telnyx",
  "prefers Telnyx when nothing occupied",
);

assert.equal(
  pickFirstUnoccupiedPlatformSender([telnyx, twilio], new Set(["pn-telnyx"]))?.phoneNumberId,
  "pn-twilio",
  "uses Twilio when Telnyx occupied for consumer",
);

assert.equal(
  pickFirstUnoccupiedPlatformSender([telnyx, twilio], new Set(["pn-telnyx", "pn-twilio"])),
  null,
  "both senders occupied → no sender",
);

assert.ok(isMctbV1Primary(), "MCTB is V1 primary");
assert.ok(!isAppointmentRemindersV1Primary(), "AR is hidden from primary chrome");
assert.equal(
  isPlatformSharedSmsMctbInboundEnabled(),
  true,
  "shared platform SMS may route to MCTB when MCTB is primary",
);

const ent = { hasMctb: true, hasMassSms: false, hasAiAfterHours: false, hasAppointmentReminders: true };
assert.deepEqual(visibleProductShells(ent), ["mctb"]);
assert.equal(shouldShowProductSwitcher(ent), false);

assert.equal(AR_ROUTES.home, "/appointment-reminders");

assert.equal(getArAiReschedulerModelId(), AR_AI_RESCHEDULER_MODEL_ID);
assert.equal(AR_AI_RESCHEDULER_MODEL_ID, "gpt-6-luna");

console.log("PASS test-ar-platform-sender-isolation");
