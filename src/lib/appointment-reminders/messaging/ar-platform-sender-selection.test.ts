import assert from "node:assert/strict";
import { pickFirstUnoccupiedPlatformSender } from "./ar-platform-sender-selection";

const telnyx = {
  phoneNumberId: "pn_telnyx",
  e164: "+18665550100",
  workspaceId: "ws_platform",
  provider: "telnyx" as const,
  priority: 1,
};
const twilio = {
  phoneNumberId: "pn_twilio",
  e164: "+15551234567",
  workspaceId: "ws_platform",
  provider: "twilio" as const,
  priority: 2,
};

assert.deepEqual(
  pickFirstUnoccupiedPlatformSender([telnyx, twilio], new Set()),
  telnyx,
  "prefers first sender when none occupied",
);

assert.deepEqual(
  pickFirstUnoccupiedPlatformSender([telnyx, twilio], new Set(["pn_telnyx"])),
  twilio,
  "overflow to twilio when telnyx slot occupied for customer",
);

assert.equal(
  pickFirstUnoccupiedPlatformSender([telnyx, twilio], new Set(["pn_telnyx", "pn_twilio"])),
  null,
  "pool exhausted when both senders occupied",
);

console.log("ar-platform-sender-selection.test.ts: ok");
