/**
 * Prep cert workspace for Twilio forwarding + live test on platform 571.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-cert-prep-forwarding-live-test.mjs
 */
import {
  loadMctbOnboardingState,
  saveMctbOnboardingState,
} from "../src/lib/mctb/onboarding/state.ts";
import { startForwardingVerificationTest } from "../src/lib/mctb/onboarding/forwarding-verification.ts";
import { getOnboardingForwardTargetE164 } from "../src/lib/mctb/onboarding/forward-target.ts";
import { formatDemoPhoneDisplay } from "../src/lib/mctb/onboarding/demo.ts";
import {
  initMctbConsentPromptForWorkspace,
  generateMctbConsentAudio,
  syncMctbConsentRouting,
  getMctbConsentPromptStatus,
  publishMctbConsentPrompt,
  loadMctbConsentMode,
} from "../src/lib/mctb/consent-prompt/service.ts";
import { syncPlatformDemoConsentRuntime } from "../src/lib/mctb/onboarding/platform-demo.ts";

const WORKSPACE_ID = process.env.CERT_WORKSPACE_ID || "cmt3m55zl0p2f5o1l16604i73";
const businessE164 =
  process.env.CERT_BUSINESS_E164?.trim() || process.env.OUTBOUND_TEST_PHONE?.trim() || "";

if (!businessE164) {
  console.error("Set CERT_BUSINESS_E164 or OUTBOUND_TEST_PHONE");
  process.exit(1);
}

const forwardE164 = getOnboardingForwardTargetE164();
const forwardDisplay = formatDemoPhoneDisplay(forwardE164);

const state = await loadMctbOnboardingState(WORKSPACE_ID);

await saveMctbOnboardingState(WORKSPACE_ID, {
  businessNumberE164: businessE164,
  forwardingCarrier: state.forwardingCarrier || "att",
  forwardingRingSeconds: state.forwardingRingSeconds || 12,
  currentStep: "connect",
  forwardingTestStartedAt: null,
  forwardingConnectedAt: null,
  forwardingVerifiedCallSid: null,
  forwardingVerifiedCallerE164: null,
  forwardingVerifiedFromE164: null,
});

await initMctbConsentPromptForWorkspace(WORKSPACE_ID);
let promptStatus = await getMctbConsentPromptStatus(WORKSPACE_ID);
if (!promptStatus.config.audioAssetId) {
  await generateMctbConsentAudio(WORKSPACE_ID);
  promptStatus = await getMctbConsentPromptStatus(WORKSPACE_ID);
}
if (!promptStatus.isPublished) {
  await publishMctbConsentPrompt(WORKSPACE_ID);
  promptStatus = await getMctbConsentPromptStatus(WORKSPACE_ID);
}
const routing = await syncMctbConsentRouting(WORKSPACE_ID);
const consentMode = await loadMctbConsentMode(WORKSPACE_ID);
await syncPlatformDemoConsentRuntime(consentMode);

await startForwardingVerificationTest(WORKSPACE_ID);

const after = await loadMctbOnboardingState(WORKSPACE_ID);

console.log(
  JSON.stringify(
    {
      workspaceId: WORKSPACE_ID,
      businessLine: businessE164,
      forwardTarget: forwardE164,
      forwardTargetDisplay: forwardDisplay,
      currentStep: after.currentStep,
      consentRouting: routing,
      consentPublished: promptStatus.isPublished,
      platform571ConsentRuntime: consentMode,
      humanSteps: [
        `1. On your business line (${businessE164}), set no-answer forwarding → ${forwardE164} (${forwardDisplay}).`,
        "2. From a DIFFERENT phone, call your business line — do not answer; let it forward to 571.",
        "3. On the 571 call: hear Press-1 consent → press 1 (workspace is press_1).",
        "4. After forwarding verifies in UI, run live test: call again the same way.",
        "5. Recovery SMS sends from 571 (same number) — voice and text on platform line until TFV approves your toll-free.",
        `6. Inspect: npx tsx scripts/mctb-certification-pass2.ts --inspect --workspace-id ${WORKSPACE_ID} --expected-caller <caller-e164>`,
      ],
    },
    null,
    2,
  ),
);
