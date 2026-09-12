import assert from "node:assert/strict";
import { resolveMctbSetupSectionId, MCTB_SETUP_SECTIONS } from "../src/lib/mctb/setup-sections";
import {
  buildSetupSummaryRows,
  buildSetupAttentionItems,
} from "../src/lib/mctb/setup-overview-model";

assert.equal(MCTB_SETUP_SECTIONS.length, 8);
assert.equal(resolveMctbSetupSectionId("/mctb/setup"), "overview");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/phone"), "phone");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/missed-call-rules"), "recovery");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/text-back"), "recovery");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/test"), "test");

const rows = buildSetupSummaryRows({
  runtime: {
    enabled: true,
    phoneNumberId: "p1",
    messageTemplate: "Hello",
    sendAfterNoAnswer: true,
    sendAfterBusy: false,
    sendAfterRejected: false,
    sendAfterTimeout: false,
    cooldownMinutes: 1440,
  },
  schedule: { paused: false },
  consentMode: "press_1",
  businessLineE164: "+15714073615",
  forwardTargetE164: "+18885550199",
  forwardingVerified: true,
  messagingReady: true,
  exclusionCount: 2,
  lastTestAt: null,
  liveTestPassed: false,
  notificationSummary: "Email enabled · SMS disabled",
  voicemailSummary: "Custom greeting · Active",
  existingConsentBlocked: false,
});

assert.equal(rows.length, 8);
assert.ok(rows[0].secondary.includes("→"));
assert.equal(rows[0].group, "call-flow");
assert.equal(rows.filter((r) => r.group === "operations").length, 3);

const attention = buildSetupAttentionItems({
  forwardingVerified: false,
  messagingReady: false,
  requiredActions: ["Complete brand registration"],
  triggersOn: false,
  consentMode: "press_1",
  existingConsentBlocked: false,
  voicemailConfigured: false,
});
assert.ok(attention.length >= 3);

console.log("test-mctb-setup-sections: ok");
