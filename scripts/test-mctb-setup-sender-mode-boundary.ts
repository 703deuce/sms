import assert from "node:assert/strict";
import {
  resolveSmsPhoneNumberIdForSetupPatch,
  resolveStaleSmsPhoneRepair,
  shouldAutoCopyIngressToSmsOnPhoneChange,
} from "../src/lib/mctb/setup-sender-patch";
import { filterMctbWorkspaceSmsSenderOptions } from "../src/lib/mctb/sender-mode-ui";

assert.equal(shouldAutoCopyIngressToSmsOnPhoneChange(), false);

assert.equal(
  resolveSmsPhoneNumberIdForSetupPatch({
    bodySmsPhoneNumberId: undefined,
    phoneNumberChanged: true,
    nextPhoneNumberId: "ingress-id",
  }),
  undefined,
  "ingress change must not auto-set smsPhoneNumberId",
);

assert.equal(
  resolveStaleSmsPhoneRepair({
    senderMode: "PLATFORM",
    sanitizedSmsPhoneNumberId: null,
    sanitizedPhoneNumberId: "ingress-id",
  }),
  null,
  "PLATFORM must not copy ingress into sms on stale repair",
);

assert.equal(
  resolveStaleSmsPhoneRepair({
    senderMode: "WORKSPACE",
    sanitizedSmsPhoneNumberId: null,
    sanitizedPhoneNumberId: "ingress-id",
  }),
  "ingress-id",
);

const filtered = filterMctbWorkspaceSmsSenderOptions([
  {
    id: "platform",
    e164: "+18885046264",
    settingsJson: { mctbRole: "platform_mctb_sender" },
    messagingStatus: { approved: true, label: "ok", complianceType: "TOLL_FREE_VERIFICATION", status: "APPROVED", numberClass: "TWILIO_TOLL_FREE" },
  },
  {
    id: "workspace",
    e164: "+15714073615",
    settingsJson: {},
    messagingStatus: { approved: true, label: "ok", complianceType: "A2P_10DLC", status: "APPROVED", numberClass: "TELNYX_LOCAL_A2P" },
  },
]);
assert.equal(filtered.length, 1);
assert.equal(filtered[0]?.id, "workspace");

console.log("test-mctb-setup-sender-mode-boundary: ok");
