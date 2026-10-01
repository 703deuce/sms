/**
 * P0 onboarding lifecycle: live-test SMS authorization, activation state, ingress lock helpers.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-onboarding-lifecycle-p0.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { defaultMctbOnboardingState, isOnboardingComplete, parseMctbOnboardingState } from "../src/lib/mctb/onboarding/state";
import { authorizeOnboardingLiveTestRecoverySend } from "../src/lib/mctb/onboarding/live-test-recovery-send";
import { resolveBestMctbIngressPhoneRow } from "../src/lib/mctb/texml-ingress/resolve-phone-row";

const DATABASE_URL = process.env.DATABASE_URL?.trim();

function stateMachineTests(): void {
  const fresh = defaultMctbOnboardingState();
  assert.equal(isOnboardingComplete(fresh), false, "fresh onboarding incomplete");

  const readyNoActivation = { ...fresh, currentStep: "ready" as const, liveTestPassedAt: new Date().toISOString() };
  assert.equal(isOnboardingComplete(readyNoActivation), false, "ready without activation is not complete");

  const activated = {
    ...readyNoActivation,
    trialActivatedAt: new Date().toISOString(),
    currentStep: "complete" as const,
  };
  assert.equal(isOnboardingComplete(activated), true, "trialActivatedAt means complete");

  console.log("onboarding state machine: PASS");
}

async function runDbProof(): Promise<void> {
  const { getPrisma } = await import("../src/lib/db");
  const { evaluateMissedCallTextEligibility } = await import(
    "../src/lib/agents/missed-call-text-back/eligibility"
  );
  const { updateMissedCallTextConfig } = await import(
    "../src/lib/agents/missed-call-text-back/config"
  );
  const { saveMctbOnboardingState } = await import("../src/lib/mctb/onboarding/state");
  const { ensureMctbPlatformSenderDefault } = await import(
    "../src/lib/mctb/ensure-platform-sender-default"
  );

  const prisma = getPrisma();
  const workspaceId = `mctb_p0_${randomUUID().slice(0, 8)}`;
  const otherWs = `mctb_p0_o_${randomUUID().slice(0, 8)}`;
  const forwardTarget = "+18885550123";
  const businessLine = "+15555550111";
  const caller = "+15555550222";

  await prisma.workspace.createMany({
    data: [
      {
        id: workspaceId,
        name: "P0 lifecycle test",
        slug: `p0-${randomUUID().slice(0, 8)}`,
        type: "BUSINESS",
        billingPlan: "onboarding",
        customFieldsConfig: { mctbOnboarding: defaultMctbOnboardingState() },
      },
      {
        id: otherWs,
        name: "P0 other",
        slug: `p0o-${randomUUID().slice(0, 8)}`,
        type: "BUSINESS",
        billingPlan: "onboarding",
      },
    ],
  });

  const phoneRow = await prisma.phoneNumber.create({
    data: {
      workspaceId,
      e164: forwardTarget,
      type: "toll_free",
      provider: "telnyx",
      providerNumberId: `test-${randomUUID()}`,
      settingsJson: { mctbSipIngress: true, mctbRole: "customer_mctb" },
    },
  });

  await updateMissedCallTextConfig({
    workspaceId,
    patch: {
      enabled: true,
      sender_mode: "PLATFORM",
      phone_number_id: phoneRow.id,
      trigger_rules: { no_answer: true, busy: true, rejected: true },
      require_carrier_forward: true,
    },
    source: "test-mctb-onboarding-lifecycle-p0",
  });
  await ensureMctbPlatformSenderDefault(workspaceId).catch(() => undefined);

  const sessionStart = new Date().toISOString();
  await saveMctbOnboardingState(workspaceId, {
    consentMode: "press_1",
    businessNumberE164: businessLine,
    forwardingConnectedAt: sessionStart,
    liveTestSession: { startedAt: sessionStart, businessNumberE164: businessLine },
    workspaceTollFreeNumber: {
      e164: forwardTarget,
      phoneNumberId: phoneRow.id,
      provider: "telnyx",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: "not_started",
      provisionedAt: sessionStart,
    },
  });

  const baseElig = {
    workspaceId,
    callerE164: caller,
    businessE164: forwardTarget,
    call: { direction: "inbound", disposition: "no-answer" },
    forwardedFromE164: businessLine,
    transovoNumberE164: forwardTarget,
  };

  const blocked = await evaluateMissedCallTextEligibility({
    ...baseElig,
    idempotencyKey: `p0-block-${randomUUID()}`,
  });
  assert.equal(blocked.eligible, false, "onboarding without event/consent should block");

  const idempotencyKey = `p0-live-${randomUUID()}`;
  await prisma.missedCallEvent.create({
    data: {
      workspaceId,
      callerE164: caller,
      businessE164: forwardTarget,
      reason: "missed_no_answer",
      traceId: randomUUID(),
      idempotencyKey,
      status: "DETECTED",
      detectedAt: new Date(),
      metadata: { forwardedFrom: businessLine },
    },
  });

  const noConsent = await evaluateMissedCallTextEligibility({
    ...baseElig,
    idempotencyKey,
  });
  assert.equal(noConsent.eligible, false, "press-1 without consent should block");

  await prisma.smartRoutingSmsConsentEvent.create({
    data: {
      workspaceId,
      callerNumber: caller,
      businessNumber: forwardTarget,
      affirmativeInput: "1",
      consentedAt: new Date(),
    },
  });

  const authorized = await evaluateMissedCallTextEligibility({
    ...baseElig,
    idempotencyKey,
  });
  assert.equal(authorized.eligible, true, "valid live-test path should authorize");

  const wrongWs = await authorizeOnboardingLiveTestRecoverySend({
    workspaceId: otherWs,
    idempotencyKey,
    callerE164: caller,
    businessE164: forwardTarget,
    forwardedFromE164: businessLine,
  });
  assert.equal(wrongWs, false, "other workspace cannot reuse authorization");

  await prisma.suppression.create({
    data: {
      workspaceId,
      phone: caller,
      suppressionKey: `${workspaceId}:p:${caller}`,
      reason: "STOP",
    },
  });

  const stopped = await evaluateMissedCallTextEligibility({
    ...baseElig,
    idempotencyKey: `p0-stop-${randomUUID()}`,
  });
  assert.equal(stopped.eligible, false, "STOP should still suppress live-test send");

  await prisma.missedCallEvent.update({
    where: { idempotencyKey },
    data: { smsSentAt: new Date(), status: "SENT" },
  });
  const dup = await evaluateMissedCallTextEligibility({
    ...baseElig,
    idempotencyKey,
  });
  assert.equal(dup.eligible, false, "duplicate send blocked");

  const ambiguous = await resolveBestMctbIngressPhoneRow("+18885550999");
  assert.equal(ambiguous, null, "unknown DID resolves null not ambiguous tenant");

  await prisma.smartRoutingSmsConsentEvent.deleteMany({ where: { workspaceId } });
  await prisma.suppression.deleteMany({ where: { workspaceId } });
  await prisma.missedCallEvent.deleteMany({ where: { workspaceId } });
  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId } });
  await prisma.phoneNumber.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, otherWs] } } });

  console.log("test-mctb-onboarding-lifecycle-p0: DB PASS");
}

async function main(): Promise<void> {
  stateMachineTests();
  if (!DATABASE_URL) {
    console.log("test-mctb-onboarding-lifecycle-p0: SKIP DB (no DATABASE_URL)");
    return;
  }
  await runDbProof();
  console.log("test-mctb-onboarding-lifecycle-p0: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
