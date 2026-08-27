/**
 * SMS sending-number preference — HP-certified 571 beats unverified 866.
 * Run: npx tsx scripts/test-preferred-sending-number.ts
 */
import assert from "node:assert/strict";
import {
  HP_CERTIFIED_SMS_E164,
  isApprovedMessagingStatus,
  isHpCertifiedSmsNumber,
  pickPreferredSmsSendingNumber,
  scoreSmsSendingNumber,
  sortPhoneNumbersForSms,
  workspaceMessagingStatusLabel,
} from "../src/lib/messaging/preferred-sending-number";

const tfv866 = {
  id: "866",
  e164: "+18665779653",
  status: "Active",
  type: "Toll-free",
  a2pStatus: "PENDING",
  provider: "twilio",
};
const hp571 = {
  id: "571",
  e164: HP_CERTIFIED_SMS_E164,
  status: "Active",
  type: "Local",
  a2pStatus: "APPROVED",
  provider: "telnyx",
  settingsJson: {
    messagingCompliance: { type: "A2P_10DLC", status: "APPROVED" },
  },
};

assert.equal(isHpCertifiedSmsNumber("+1 (571) 407-3615"), true);
assert.equal(isHpCertifiedSmsNumber("+18665779653"), false);
assert.ok(scoreSmsSendingNumber(hp571) > scoreSmsSendingNumber(tfv866));
assert.equal(pickPreferredSmsSendingNumber([tfv866, hp571])?.id, "571");
assert.equal(sortPhoneNumbersForSms([tfv866, hp571])[0]?.id, "571");
assert.equal(pickPreferredSmsSendingNumber([{ number: "+15714073615", a2pStatus: "Approved" }])?.number, "+15714073615");

assert.equal(isApprovedMessagingStatus("ready"), true);
assert.equal(isApprovedMessagingStatus("certified"), true);
assert.equal(
  workspaceMessagingStatusLabel({
    productRegistrationStatus: "not_started",
    sendingNumberApproved: true,
    workspaceRegistrationReady: false,
  }),
  "approved",
);
assert.equal(
  workspaceMessagingStatusLabel({
    productRegistrationStatus: "not_started",
    sendingNumberApproved: false,
    workspaceRegistrationReady: false,
  }),
  "not_started",
);

console.log("test-preferred-sending-number: ok");
