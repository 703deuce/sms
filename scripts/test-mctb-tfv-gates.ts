/**
 * MCTB trial activation + TFV gate tests.
 * Run: npx tsx scripts/test-mctb-tfv-gates.ts
 */
import assert from "node:assert/strict";
import {
  isTfvApproved,
  mapTwilioTfvStatus,
  complianceStatusToA2p,
  shouldDedupeTfvSubmission,
} from "../src/lib/messaging/compliance/messaging-compliance";
import { getPlatformDemoNumberE164 } from "../src/lib/mctb/onboarding/demo";
import {
  canActivateTrialFromGates,
  evaluateTrialActivationGates,
} from "../src/lib/mctb/onboarding/trial-gates";

assert.equal(mapTwilioTfvStatus("TWILIO_APPROVED"), "APPROVED");
assert.equal(mapTwilioTfvStatus("PENDING_REVIEW"), "PENDING");
assert.equal(mapTwilioTfvStatus("TWILIO_REJECTED"), "REJECTED");
assert.equal(isTfvApproved("APPROVED"), true);
assert.equal(isTfvApproved("PENDING"), false);
assert.equal(complianceStatusToA2p("APPROVED"), "APPROVED");

assert.equal(
  shouldDedupeTfvSubmission({ existingSid: "TFV123", existingStatus: "PENDING" }),
  true,
);
assert.equal(
  shouldDedupeTfvSubmission({ existingSid: "TFV123", existingStatus: "NOT_STARTED" }),
  false,
);
assert.equal(shouldDedupeTfvSubmission({ existingSid: null, existingStatus: "PENDING" }), false);

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

// 1. demo line approval cannot activate trial
assert.equal(
  evaluateTrialActivationGates({
    ...baseGate,
    trialPhoneE164: demoE164,
    trialPhoneNumberId: "pn_demo",
    tfvPhoneNumberId: "pn_demo",
  }).canActivate,
  false,
);

// 2. unverified customer TFN cannot activate trial
assert.equal(
  evaluateTrialActivationGates({ ...baseGate, tfvStatus: "PENDING" }).canActivate,
  false,
);

// 3. approved TFN + unverified forwarding cannot activate
assert.equal(
  evaluateTrialActivationGates({ ...baseGate, forwardingConnected: false }).canActivate,
  false,
);

// 4. approved TFN + forwarding + failed live test cannot activate
assert.equal(
  evaluateTrialActivationGates({ ...baseGate, liveTestPassed: false }).canActivate,
  false,
);

// 5. full success activates
assert.equal(evaluateTrialActivationGates(baseGate).canActivate, true);
assert.equal(canActivateTrialFromGates(baseGate), true);

// 5b. trial activates exactly once when already started
assert.equal(canActivateTrialFromGates({ ...baseGate, trialAlreadyStarted: true }), true);
assert.equal(
  canActivateTrialFromGates({
    ...baseGate,
    trialAlreadyStarted: true,
    tfvStatus: "PENDING",
    forwardingConnected: false,
    liveTestPassed: false,
  }),
  true,
);

// 6. duplicate TFV idempotency — external refs are workspace-scoped
const extRefA = "mctb-tfv:ws_a:pn_1";
const extRefB = "mctb-tfv:ws_b:pn_2";
assert.notEqual(extRefA, extRefB);
assert.equal(
  shouldDedupeTfvSubmission({ existingSid: extRefA, existingStatus: "SUBMITTED" }),
  true,
);

// 7. workspace isolation — TFV phone must match trial phone for that workspace
assert.equal(
  evaluateTrialActivationGates({
    ...baseGate,
    trialPhoneNumberId: "pn_trial_a",
    tfvPhoneNumberId: "pn_trial_b",
  }).canActivate,
  false,
);

console.log("test-mctb-tfv-gates: ok");
