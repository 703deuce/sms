/**
 * TFV status merge + number lifecycle tests.
 * Run: npx tsx scripts/test-mctb-tfv-gates.ts
 */
import assert from "node:assert/strict";
import {
  isTfvApproved,
  mapTwilioTfvStatus,
  complianceStatusToA2p,
  shouldDedupeTfvSubmission,
} from "../src/lib/messaging/compliance/messaging-compliance";
import { mergeTfvStatuses } from "../src/lib/mctb/tfv/state-update";
import { getPlatformDemoNumberE164 } from "../src/lib/mctb/onboarding/demo";
import {
  canActivateTrialFromGates,
  evaluateTrialActivationGates,
} from "../src/lib/mctb/onboarding/trial-gates";
import { normalizeWorkspaceTollFreeFields } from "../src/lib/mctb/workspace-toll-free";
import {
  buildMctbTfvExternalReferenceId,
  isMctbTfvExternalReferenceId,
  parseMctbTfvExternalReferenceId,
} from "../src/lib/mctb/tfv/external-reference";

assert.equal(mapTwilioTfvStatus("TWILIO_APPROVED"), "APPROVED");
assert.equal(mapTwilioTfvStatus("PENDING_REVIEW"), "PENDING");
assert.equal(mapTwilioTfvStatus("TWILIO_REJECTED"), "REJECTED");
assert.equal(
  mapTwilioTfvStatus("TWILIO_REJECTED", {
    editExpiration: new Date(Date.now() + 86400000).toISOString(),
  }),
  "ACTION_REQUIRED",
);
assert.equal(mapTwilioTfvStatus("IN_REVIEW"), "PENDING");
assert.equal(isTfvApproved("APPROVED"), true);
assert.equal(isTfvApproved("PENDING"), false);
assert.equal(complianceStatusToA2p("APPROVED"), "APPROVED");

assert.equal(mergeTfvStatuses("APPROVED", "PENDING"), "APPROVED");
assert.equal(mergeTfvStatuses("PENDING", "APPROVED"), "APPROVED");
assert.equal(mergeTfvStatuses("REJECTED", "PENDING"), "REJECTED");
assert.equal(mergeTfvStatuses("SUBMITTED", "PENDING"), "PENDING");

assert.equal(
  shouldDedupeTfvSubmission({ existingSid: "TFV123", existingStatus: "PENDING" }),
  true,
);
assert.equal(
  shouldDedupeTfvSubmission({ existingSid: "TFV123", existingStatus: "NOT_STARTED" }),
  false,
);

const normalized = normalizeWorkspaceTollFreeFields({
  trialNumber: { e164: "+18885551212", phoneNumberId: "pn_1" },
});
assert.equal(normalized.workspaceTollFreeNumber?.phoneNumberId, "pn_1");
assert.equal(normalized.trialNumber?.phoneNumberId, "pn_1");

const demoE164 = getPlatformDemoNumberE164();
assert.ok(demoE164);

const baseGate = {
  trialPhoneE164: "+18885551212",
  trialPhoneNumberId: "pn_trial",
  tfvPhoneNumberId: "pn_trial",
  tfvStatus: "APPROVED" as const,
  forwardingConnected: true,
  liveTestPassed: true,
  trialAlreadyStarted: false,
};

assert.equal(
  evaluateTrialActivationGates({
    ...baseGate,
    trialPhoneE164: demoE164,
    trialPhoneNumberId: "pn_demo",
    tfvPhoneNumberId: "pn_demo",
  }).canActivate,
  false,
);

assert.equal(
  evaluateTrialActivationGates({ ...baseGate, tfvStatus: "PENDING" }).canActivate,
  false,
);

assert.equal(
  evaluateTrialActivationGates({ ...baseGate, forwardingConnected: false }).canActivate,
  false,
);

assert.equal(
  evaluateTrialActivationGates({ ...baseGate, liveTestPassed: false }).canActivate,
  false,
);

assert.equal(evaluateTrialActivationGates(baseGate).canActivate, true);
assert.equal(canActivateTrialFromGates(baseGate), true);

assert.equal(
  evaluateTrialActivationGates({
    ...baseGate,
    tfvStatus: "PENDING",
    usesPlatformSender: true,
  }).canActivate,
  true,
);

assert.equal(canActivateTrialFromGates({ ...baseGate, trialAlreadyStarted: true }), true);

const extRefA = buildMctbTfvExternalReferenceId("ws_a", "cmt3abc1234567890phon01");
const extRefB = buildMctbTfvExternalReferenceId("ws_b", "cmt3abc1234567890phon02");
assert.notEqual(extRefA, extRefB);
assert.equal(parseMctbTfvExternalReferenceId(extRefA)?.phoneNumberId, "cmt3abc1234567890phon01");
assert.equal(isMctbTfvExternalReferenceId("ws_a", "cmt3abc1234567890phon01", extRefA), true);
assert.equal(extRefA, "cmt3abc1234567890phon01");
assert.equal(parseMctbTfvExternalReferenceId("mctb-tfv:ws_a:pn_1")?.phoneNumberId, "pn_1");

assert.equal(
  evaluateTrialActivationGates({
    ...baseGate,
    trialPhoneNumberId: "pn_trial_a",
    tfvPhoneNumberId: "pn_trial_b",
  }).canActivate,
  false,
);

console.log("test-mctb-tfv-gates: ok");
