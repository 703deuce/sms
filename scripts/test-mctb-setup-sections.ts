import assert from "node:assert/strict";
import { resolveMctbSetupSectionId, MCTB_SETUP_SECTIONS } from "../src/lib/mctb/setup-sections";
import {
  buildSetupSummaryRows,
  buildSetupAttentionItems,
  buildCoreSystemsReadiness,
  resolveSetupChipTone,
} from "../src/lib/mctb/setup-overview-model";
import { isExistingConsentModeEligible } from "../src/lib/mctb/setup-consent-eligibility";

assert.equal(MCTB_SETUP_SECTIONS.length, 10);
assert.equal(resolveMctbSetupSectionId("/mctb/setup"), "overview");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/phone"), "phone");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/consent"), "consent");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/missed-call-rules"), "recovery");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/text-back"), "text-back");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/links"), "links");
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
  linksSummary: "Optional",
  senderMode: "PLATFORM",
});

assert.equal(rows.length, 9);
assert.ok(rows[0].secondary.includes("→"));
assert.equal(rows[0].group, "call-flow");
assert.equal(rows.find((r) => r.id === "text-back")?.title, "Text Back");
assert.equal(rows.filter((r) => r.group === "operations").length, 4);

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

const readiness = buildCoreSystemsReadiness({
  forwardingVerified: true,
  messagingReady: true,
  recoveryPaused: false,
  triggersOn: true,
  messageConfigured: true,
  voicemailReady: true,
});
assert.equal(readiness.ready, 5);

assert.equal(resolveSetupChipTone("Configured", "neutral"), "neutral");
assert.equal(resolveSetupChipTone("Verified", "ok"), "positive");

assert.equal(isExistingConsentModeEligible({ messagingReady: true, paidEntitled: true }), true);
assert.equal(isExistingConsentModeEligible({ messagingReady: true, paidEntitled: false }), false);

console.log("test-mctb-setup-sections: ok");
