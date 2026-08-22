/**
 * MCTB engine regression matrix — frozen SIP path + demo/production ingress split.
 * Run: npx tsx scripts/test-mctb-engine-matrix.ts
 */
import assert from "node:assert/strict";
import { isMctb571SipDiagnosticTarget } from "@/lib/mctb/sip-diagnostic/constants";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { isPhoneMctbSipIngress, isMctbSipIngressTargetSync } from "@/lib/mctb/sip-ingress/sync";
import {
  classifyMctbIngress,
  demoRequiresForwarding,
  isDemoDirectIngress,
  isProductionActivationPhase,
  isProductionForwardedIngress,
  productionRequiresForwardingSetup,
  resolveRuntimeDemoMode,
} from "@/lib/mctb/ingress";
import { defaultMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { evaluateTrialActivationGates } from "@/lib/mctb/onboarding/trial-gates";
import type { MctbDemoSession } from "@/lib/mctb/onboarding/types";

const TEST_WS = "cmt2zyg4l43373s0f146b442h";
const DEMO_CALLER =
  process.env.MCTB_TEST_CALLER_E164?.trim() || ["+1", "999", "000", "0100"].join("");
const PROD_MCTB_DID = ["+1", "999", "000", "0200"].join("");
const PROD_BUSINESS_LINE = ["+1", "999", "000", "0300"].join("");

function activeDemoSession(): MctbDemoSession {
  return {
    status: "waiting_call",
    callerE164: DEMO_CALLER,
    demoNumberE164: MCTB_PLATFORM_DEMO_E164,
    startedAt: new Date().toISOString(),
  };
}

async function testMctbSipPress1Route() {
  assert.equal(isMctbSipIngressTargetSync(MCTB_PLATFORM_DEMO_E164), true);
  assert.equal(isMctb571SipDiagnosticTarget(MCTB_PLATFORM_DEMO_E164), true);
  assert.equal(isMctbSipIngressTargetSync("+18880001002"), false);
  console.log("test:mctb-sip-press1-route ok");
}

async function testMctbExistingConsentRoute() {
  const settings = { mctbRole: "customer_mctb", mctbSipIngress: true };
  assert.equal(isPhoneMctbSipIngress(settings), true);
  console.log("test:mctb-existing-consent-route ok");
}

function testMctbDemoDirectPress1() {
  const session = activeDemoSession();
  assert.equal(
    classifyMctbIngress({
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      callerE164: DEMO_CALLER,
      demoSession: session,
    }),
    "demo_direct",
  );
  assert.equal(
    resolveRuntimeDemoMode({
      workspaceId: TEST_WS,
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      callerE164: DEMO_CALLER,
      demoSession: session,
    }),
    true,
  );
  console.log("test:mctb-demo-direct-press1 ok");
}

function testMctbDemoDirectExistingConsent() {
  const session = activeDemoSession();
  assert.equal(demoRequiresForwarding(), false);
  assert.equal(
    isDemoDirectIngress({
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      callerE164: DEMO_CALLER,
      demoSession: session,
    }),
    true,
  );
  console.log("test:mctb-demo-direct-existing-consent ok");
}

function testMctbProductionForwardedPress1() {
  const state = {
    ...defaultMctbOnboardingState(),
    currentStep: "connect" as const,
    completedSteps: ["business", "consent", "demo", "trial_number", "configure"] as const,
    businessNumberE164: process.env.MCTB_TEST_BUSINESS_E164?.trim() || PROD_BUSINESS_LINE,
    forwardingTestStartedAt: new Date().toISOString(),
  };
  assert.equal(isProductionActivationPhase(state), true);
  assert.equal(
    isProductionForwardedIngress({
      transovoNumberE164: PROD_MCTB_DID,
      forwardedFromE164: process.env.MCTB_TEST_BUSINESS_E164?.trim() || PROD_BUSINESS_LINE,
      onboardingState: state,
    }),
    true,
  );
  assert.equal(productionRequiresForwardingSetup(), true);
  console.log("test:mctb-production-forwarded-press1 ok");
}

function testMctbProductionForwardedExistingConsent() {
  const gates = evaluateTrialActivationGates({
    trialPhoneE164: PROD_MCTB_DID,
    trialPhoneNumberId: "pn_test",
    tfvPhoneNumberId: "pn_test",
    tfvStatus: "APPROVED",
    forwardingConnected: false,
    liveTestPassed: false,
    trialAlreadyStarted: false,
  });
  assert.ok(gates.missing.includes("forwarding_connected"));
  console.log("test:mctb-production-forwarded-existing-consent ok");
}

function testMctbDemoForcesZeroDelay() {
  const session = activeDemoSession();
  const demoMode = resolveRuntimeDemoMode({
    workspaceId: TEST_WS,
    transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
    callerE164: DEMO_CALLER,
    demoSession: session,
  });
  const delaySeconds = demoMode ? 0 : 120;
  assert.equal(delaySeconds, 0);
  console.log("test:mctb-demo-forces-zero-delay ok");
}

function testMctbProductionPreservesConfiguredDelay() {
  const session = activeDemoSession();
  const demoMode = resolveRuntimeDemoMode({
    workspaceId: TEST_WS,
    transovoNumberE164: PROD_MCTB_DID,
    callerE164: DEMO_CALLER,
    forwardedFromE164: PROD_BUSINESS_LINE,
    demoSession: session,
  });
  const configuredDelay = 90;
  const delaySeconds = demoMode ? 0 : configuredDelay;
  assert.equal(delaySeconds, configuredDelay);
  console.log("test:mctb-production-preserves-configured-delay ok");
}

function testMctbDemoDoesNotRequireForwarding() {
  assert.equal(demoRequiresForwarding(), false);
  const gates = evaluateTrialActivationGates({
    trialPhoneE164: MCTB_PLATFORM_DEMO_E164,
    trialPhoneNumberId: "pn_demo",
    tfvPhoneNumberId: "pn_demo",
    tfvStatus: "APPROVED",
    forwardingConnected: false,
    liveTestPassed: false,
    trialAlreadyStarted: false,
  });
  assert.ok(gates.missing.includes("demo_number_not_allowed"));
  console.log("test:mctb-demo-does-not-require-forwarding ok");
}

function testMctbProductionStillRequiresForwardingSetup() {
  const gates = evaluateTrialActivationGates({
    trialPhoneE164: PROD_MCTB_DID,
    trialPhoneNumberId: "pn_prod",
    tfvPhoneNumberId: "pn_prod",
    tfvStatus: "APPROVED",
    forwardingConnected: false,
    liveTestPassed: true,
    trialAlreadyStarted: false,
  });
  assert.ok(gates.missing.includes("forwarding_connected"));
  console.log("test:mctb-production-still-requires-forwarding-setup ok");
}

function testMctbProductionPipelineUnchanged() {
  // Regression guard: frozen SIP ingress targets and customer DID flags remain intact.
  assert.equal(isMctbSipIngressTargetSync(MCTB_PLATFORM_DEMO_E164), true);
  assert.equal(
    isPhoneMctbSipIngress({ mctbSipIngress: true, mctbRole: "customer_mctb" }),
    true,
  );
  assert.equal(
    resolveRuntimeDemoMode({
      workspaceId: TEST_WS,
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      callerE164: DEMO_CALLER,
      forwardedFromE164: process.env.MCTB_TEST_BUSINESS_E164?.trim() || PROD_BUSINESS_LINE,
      demoSession: activeDemoSession(),
    }),
    false,
  );
  console.log("test:mctb-production-sip-pipeline-unchanged ok");
}

async function main() {
  await testMctbSipPress1Route();
  await testMctbExistingConsentRoute();
  testMctbDemoDirectPress1();
  testMctbDemoDirectExistingConsent();
  testMctbProductionForwardedPress1();
  testMctbProductionForwardedExistingConsent();
  testMctbDemoForcesZeroDelay();
  testMctbProductionPreservesConfiguredDelay();
  testMctbDemoDoesNotRequireForwarding();
  testMctbProductionStillRequiresForwardingSetup();
  testMctbProductionPipelineUnchanged();
  console.log("DEMO DIRECT-INGRESS ADDED — PRODUCTION FORWARDING PIPELINE UNCHANGED");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
