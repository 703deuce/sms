/**
 * Prep cert workspace for Twilio forwarding + live TFN test (Pass 2 style).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-cert-prep-forwarding-live-test.mjs
 */
import { getPrisma } from "../src/lib/db.ts";
import {
  loadMctbOnboardingState,
  saveMctbOnboardingState,
} from "../src/lib/mctb/onboarding/state.ts";
import { getWorkspaceTollFreeNumber } from "../src/lib/mctb/workspace-toll-free.ts";
import { startForwardingVerificationTest } from "../src/lib/mctb/onboarding/forwarding-verification.ts";
import {
  initMctbConsentPromptForWorkspace,
  generateMctbConsentAudio,
  syncMctbConsentRouting,
  getMctbConsentPromptStatus,
  publishMctbConsentPrompt,
} from "../src/lib/mctb/consent-prompt/service.ts";
import { getTfvStatusForWorkspace } from "../src/lib/mctb/tfv/service.ts";

const WORKSPACE_ID = process.env.CERT_WORKSPACE_ID || "cmt3m55zl0p2f5o1l16604i73";
const businessE164 =
  process.env.CERT_BUSINESS_E164?.trim() || process.env.OUTBOUND_TEST_PHONE?.trim() || "";

if (!businessE164) {
  console.error("Set CERT_BUSINESS_E164 or OUTBOUND_TEST_PHONE");
  process.exit(1);
}

const prisma = getPrisma();
const state = await loadMctbOnboardingState(WORKSPACE_ID);
const tfn = getWorkspaceTollFreeNumber(state);

if (!tfn?.e164) {
  console.error("❌ No workspace TFN provisioned");
  process.exit(1);
}

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

await startForwardingVerificationTest(WORKSPACE_ID);

const tfv = await getTfvStatusForWorkspace(WORKSPACE_ID);
const after = await loadMctbOnboardingState(WORKSPACE_ID);

console.log(
  JSON.stringify(
    {
      workspaceId: WORKSPACE_ID,
      businessLine: businessE164,
      transovoTfn: tfn.e164,
      currentStep: after.currentStep,
      consentRouting: routing,
      consentPublished: promptStatus.isPublished,
      tfvStatus: tfv.status,
      tfvApproved: tfv.approved,
      smsFromTfnReady: tfv.approved,
      humanSteps: [
        `1. On your business line (${businessE164}), set no-answer forwarding → ${tfn.e164} (ring timer < voicemail, ~12s).`,
        "2. From a DIFFERENT phone, call your business line — do not answer; let it forward to the TFN.",
        "3. On the TFN call: hear Press-1 consent → press 1 (workspace is press_1).",
        "4. After forwarding verifies in UI, run live test: call again the same way.",
        tfv.approved
          ? "5. Missed-call recovery SMS should send from your TFN after Press-1."
          : `5. TFV is ${tfv.status} — voice/forwarding/Press-1 can be tested; TFN SMS waits for TFV approval.`,
        `6. Inspect: npx tsx scripts/mctb-certification-pass2.ts --inspect --workspace-id ${WORKSPACE_ID} --expected-caller <caller-e164>`,
      ],
    },
    null,
    2,
  ),
);
