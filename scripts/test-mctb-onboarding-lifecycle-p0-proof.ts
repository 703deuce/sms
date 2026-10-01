/**
 * Executable proofs for MCTB onboarding P0 (provisioning concurrency, activation retry,
 * DID ambiguity, existing-consent gating).
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-onboarding-lifecycle-p0-proof.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { defaultMctbOnboardingState, isOnboardingComplete, saveMctbOnboardingState } from "../src/lib/mctb/onboarding/state";
import { authorizeOnboardingLiveTestRecoverySend } from "../src/lib/mctb/onboarding/live-test-recovery-send";
import {
  provisionMctbWorkspaceTollFreeIngress,
  setMctbTollFreeIngressProvisionTestDeps,
} from "../src/lib/mctb/provisioning/provision-workspace-toll-free-ingress";
import { readMctbIngressProvisionPendingE164 } from "../src/lib/mctb/provisioning/workspace-ingress-provision-lock";
import {
  clearMctbIngressPhoneRowAmbiguityForTest,
  getLastMctbIngressPhoneRowAmbiguityForTest,
  resolveBestMctbIngressPhoneRow,
} from "../src/lib/mctb/texml-ingress/resolve-phone-row";
import { resolveInboundPhoneRowByE164 } from "../src/lib/phone/resolve-inbound-e164";
import { MCTB_TEXML_ROUTING_MODE, MCTB_TEXML_ROUTING_OWNER } from "../src/lib/mctb/texml-ingress/constants";
import { resolveMctbPlatformOwnerWorkspaceId } from "../src/lib/mctb/platform-owner-workspace";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { recordWorkspaceExistingConsentAttestation } from "../src/lib/mctb/capture/attestation";

const DATABASE_URL = process.env.DATABASE_URL?.trim();

function ingressSettings() {
  return {
    telephony: { routingMode: MCTB_TEXML_ROUTING_MODE },
    routingOwner: MCTB_TEXML_ROUTING_OWNER,
    mctbSipIngress: true,
    mctbRole: "customer_mctb",
    capabilities: { mctbEnabled: true },
  };
}

async function createWorkspace(
  prisma: Awaited<ReturnType<typeof import("../src/lib/db").getPrisma>>,
  billingPlan = "onboarding",
) {
  const id = `mctb_p0pf_${randomUUID().slice(0, 8)}`;
  await prisma.workspace.create({
    data: {
      id,
      name: "P0 proof",
      slug: `p0pf-${randomUUID().slice(0, 8)}`,
      type: "BUSINESS",
      billingPlan,
      customFieldsConfig: { mctbOnboarding: defaultMctbOnboardingState() },
    },
  });
  await grantWorkspaceProductFeature(id, "mctb", "active");
  return id;
}

async function testProvisioningConcurrency(
  prisma: Awaited<ReturnType<typeof import("../src/lib/db").getPrisma>>,
): Promise<void> {
  const workspaceId = await createWorkspace(prisma);
  const purchasedE164 = "+18885559001";
  let purchaseCalls = 0;
  let importCalls = 0;

  setMctbTollFreeIngressProvisionTestDeps({
    pickTelnyxTollFreeIngressE164: async () => null,
    purchaseTelnyxTollFree: async () => {
      purchaseCalls += 1;
      await new Promise((r) => setTimeout(r, 80));
      return purchasedE164;
    },
    importTelnyxNumbersIntoWorkspace: async ({ workspaceId: wsId, e164s }) => {
      importCalls += 1;
      const e164 = e164s[0]!;
      await prisma.phoneNumber.upsert({
        where: { workspaceId_e164: { workspaceId: wsId, e164 } },
        create: {
          workspaceId: wsId,
          e164,
          type: "toll_free",
          provider: "telnyx",
          providerNumberId: `prov-${randomUUID()}`,
          settingsJson: ingressSettings(),
        },
        update: {
          providerNumberId: `prov-${randomUUID()}`,
          settingsJson: ingressSettings(),
        },
      });
    },
    routePhoneToMctbCallHandlingIngress: async () => ({
      verify: { ok: true },
    }),
    verifyMctbTexmlIngressRoute: async () => ({ ok: true }),
    setActiveCallHandler: async () => undefined,
  });

  const [a, b] = await Promise.all([
    provisionMctbWorkspaceTollFreeIngress(workspaceId),
    provisionMctbWorkspaceTollFreeIngress(workspaceId),
  ]);

  assert.equal(purchaseCalls, 1, "Telnyx purchase must run exactly once");
  assert.ok(a.ok || b.ok, "at least one provision result succeeds");
  assert.equal(a.e164, purchasedE164);
  assert.equal(b.e164, purchasedE164);
  assert.equal(a.phoneNumberId, b.phoneNumberId, "both callers converge on same phone row");

  const phoneCount = await prisma.phoneNumber.count({
    where: { workspaceId, e164: purchasedE164 },
  });
  assert.equal(phoneCount, 1, "only one ingress row for workspace");

  setMctbTollFreeIngressProvisionTestDeps(null);
  await prisma.phoneNumber.deleteMany({ where: { workspaceId } });
  await prisma.workspaceLimits.deleteMany({ where: { workspaceId } });
  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log("provisioning concurrency: PASS");
}

async function testPurchaseSuccessLocalFailureRetry(
  prisma: Awaited<ReturnType<typeof import("../src/lib/db").getPrisma>>,
): Promise<void> {
  const workspaceId = await createWorkspace(prisma);
  const purchasedE164 = "+18885559002";
  let purchaseCalls = 0;
  let importAttempts = 0;

  setMctbTollFreeIngressProvisionTestDeps({
    pickTelnyxTollFreeIngressE164: async () => null,
    purchaseTelnyxTollFree: async () => {
      purchaseCalls += 1;
      return purchasedE164;
    },
    importTelnyxNumbersIntoWorkspace: async () => {
      importAttempts += 1;
      if (importAttempts === 1) {
        throw new Error("simulated_local_import_failure");
      }
      await prisma.phoneNumber.create({
        data: {
          workspaceId,
          e164: purchasedE164,
          type: "toll_free",
          provider: "telnyx",
          providerNumberId: `prov-${randomUUID()}`,
          settingsJson: ingressSettings(),
        },
      });
    },
    routePhoneToMctbCallHandlingIngress: async () => ({
      verify: { ok: true },
    }),
    verifyMctbTexmlIngressRoute: async () => ({ ok: true }),
    setActiveCallHandler: async () => undefined,
  });

  const first = await provisionMctbWorkspaceTollFreeIngress(workspaceId);
  assert.equal(first.ok, false, "first attempt fails after purchase");
  assert.equal(purchaseCalls, 1);
  const pending = await readMctbIngressProvisionPendingE164(workspaceId);
  assert.equal(pending, purchasedE164, "pending E.164 persisted after purchase");

  const second = await provisionMctbWorkspaceTollFreeIngress(workspaceId);
  assert.equal(second.ok, true, "retry completes provisioning");
  assert.equal(purchaseCalls, 1, "retry must not purchase again");
  assert.equal(second.e164, purchasedE164);

  const pendingAfter = await readMctbIngressProvisionPendingE164(workspaceId);
  assert.equal(pendingAfter, null, "pending cleared after success");

  setMctbTollFreeIngressProvisionTestDeps(null);
  await prisma.phoneNumber.deleteMany({ where: { workspaceId } });
  await prisma.workspaceLimits.deleteMany({ where: { workspaceId } });
  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log("provisioning purchase-success local-failure retry: PASS");
}

async function testActivationFailureRetrySuccess(
  prisma: Awaited<ReturnType<typeof import("../src/lib/db").getPrisma>>,
): Promise<void> {
  const { activateMctbTrial } = await import("../src/lib/mctb/onboarding/trial");
  const { updateMissedCallTextConfig } = await import(
    "../src/lib/agents/missed-call-text-back/config"
  );
  const { getMctbEntitlement } = await import("../src/lib/mctb/entitlement");

  const workspaceId = await createWorkspace(prisma);
  const forwardTarget = "+18885559003";
  const businessLine = "+15555559003";
  const sessionStart = new Date().toISOString();
  const liveTestPassedAt = new Date().toISOString();

  const phone = await prisma.phoneNumber.create({
    data: {
      workspaceId,
      e164: forwardTarget,
      type: "toll_free",
      provider: "telnyx",
      providerNumberId: `prov-${randomUUID()}`,
      settingsJson: ingressSettings(),
    },
  });

  await updateMissedCallTextConfig({
    workspaceId,
    patch: {
      enabled: true,
      sender_mode: "PLATFORM",
      phone_number_id: phone.id,
    },
    source: "test-mctb-onboarding-lifecycle-p0-proof",
  });

  await saveMctbOnboardingState(workspaceId, {
    consentMode: "press_1",
    businessNumberE164: businessLine,
    liveTestPassedAt,
    currentStep: "ready",
    liveTestSession: {
      startedAt: sessionStart,
      textSentAt: sessionStart,
      replyReceivedAt: sessionStart,
      missedCallEventId: "mce_proof",
    },
    workspaceTollFreeNumber: {
      e164: forwardTarget,
      phoneNumberId: phone.id,
      provider: "telnyx",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: "not_started",
      provisionedAt: sessionStart,
    },
  });

  const fail = await activateMctbTrial(workspaceId);
  assert.equal(fail.ok, false, "activation fails without forwarding_connected");
  const stateAfterFail = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, customFieldsConfig: true },
  });
  const onboardingState = (stateAfterFail?.customFieldsConfig as { mctbOnboarding?: unknown })
    ?.mctbOnboarding as Record<string, unknown>;
  assert.equal(stateAfterFail?.billingPlan, "onboarding");
  assert.ok(onboardingState?.liveTestPassedAt, "live test evidence preserved");
  assert.equal(onboardingState?.trialActivatedAt, undefined);
  assert.equal(isOnboardingComplete(onboardingState as never), false);

  const ent = await getMctbEntitlement(workspaceId);
  assert.notEqual(ent.serviceStatus, "ACTIVE");

  await saveMctbOnboardingState(workspaceId, {
    forwardingConnectedAt: sessionStart,
    businessNumberE164: businessLine,
  });

  const ok = await activateMctbTrial(workspaceId);
  assert.equal(ok.ok, true, "activation retry succeeds without new live test");

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, customFieldsConfig: true },
  });
  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = (limitsRow?.limits || {}) as Record<string, unknown>;
  const { loadMctbOnboardingState } = await import("../src/lib/mctb/onboarding/state");
  const finalOnboarding = await loadMctbOnboardingState(workspaceId);
  assert.equal(ws?.billingPlan, "free");
  assert.equal(String(limits.mctbServiceStatus || ""), "ACTIVE");
  assert.ok(finalOnboarding.trialActivatedAt);
  assert.equal(finalOnboarding.currentStep, "complete");
  assert.equal(isOnboardingComplete(finalOnboarding), true);
  assert.ok(finalOnboarding.liveTestPassedAt, "live test evidence still present after activation");

  const trialActivatedOnce = finalOnboarding.trialActivatedAt;
  const again = await activateMctbTrial(workspaceId);
  assert.equal(again.ok, true, "idempotent re-activation");
  const onboardingAgain = await loadMctbOnboardingState(workspaceId);
  assert.equal(String(onboardingAgain.trialActivatedAt), String(trialActivatedOnce), "trialActivatedAt unchanged on retry");

  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId } });
  await prisma.phoneNumber.deleteMany({ where: { workspaceId } });
  await prisma.workspaceLimits.deleteMany({ where: { workspaceId } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log("activation failure → retry → success: PASS");
}

async function testDidAmbiguityAndCustomerResolution(
  prisma: Awaited<ReturnType<typeof import("../src/lib/db").getPrisma>>,
): Promise<void> {
  const { updateMissedCallTextConfig } = await import(
    "../src/lib/agents/missed-call-text-back/config"
  );
  clearMctbIngressPhoneRowAmbiguityForTest();

  const wsA = `mctb_p0a_${randomUUID().slice(0, 6)}`;
  const wsB = `mctb_p0b_${randomUUID().slice(0, 6)}`;
  const sharedDid = "+18886660001";
  const customerOnlyDid = "+18887770001";
  const ownerWs = resolveMctbPlatformOwnerWorkspaceId();

  await prisma.workspace.create({
    data: { id: wsA, name: "A", slug: `a-${randomUUID().slice(0, 6)}`, type: "BUSINESS", billingPlan: "free" },
  });
  await prisma.workspace.create({
    data: { id: wsB, name: "B", slug: `b-${randomUUID().slice(0, 6)}`, type: "BUSINESS", billingPlan: "free" },
  });

  const settings = ingressSettings();
  const phoneA = await prisma.phoneNumber.create({
    data: {
      workspaceId: wsA,
      e164: sharedDid,
      type: "toll_free",
      provider: "telnyx",
      providerNumberId: `pa-${randomUUID()}`,
      settingsJson: settings,
    },
  });
  const phoneB = await prisma.phoneNumber.create({
    data: {
      workspaceId: wsB,
      e164: sharedDid,
      type: "toll_free",
      provider: "telnyx",
      providerNumberId: `pb-${randomUUID()}`,
      settingsJson: settings,
    },
  });

  await updateMissedCallTextConfig({
    workspaceId: wsA,
    patch: { enabled: true, phone_number_id: phoneA.id },
    source: "p0-proof-ambiguity",
  });
  await updateMissedCallTextConfig({
    workspaceId: wsB,
    patch: { enabled: true, phone_number_id: phoneB.id },
    source: "p0-proof-ambiguity",
  });

  const ambiguous = await resolveBestMctbIngressPhoneRow(sharedDid);
  assert.equal(ambiguous, null, "ambiguous cross-tenant DID must not resolve");
  const amb = getLastMctbIngressPhoneRowAmbiguityForTest();
  assert.ok(amb, "ingress_phone_row_ambiguous must be recorded");
  assert.ok(amb!.workspaceIds.includes(wsA) && amb!.workspaceIds.includes(wsB));

  const customerPhone = await prisma.phoneNumber.create({
    data: {
      workspaceId: wsA,
      e164: customerOnlyDid,
      type: "toll_free",
      provider: "telnyx",
      providerNumberId: `pc-${randomUUID()}`,
      settingsJson: settings,
    },
  });
  const ownerExists = await prisma.workspace.findUnique({ where: { id: ownerWs }, select: { id: true } });
  if (ownerExists) {
    await prisma.phoneNumber.create({
      data: {
        workspaceId: ownerWs,
        e164: "+18887779999",
        type: "toll_free",
        provider: "telnyx",
        providerNumberId: `po-${randomUUID()}`,
        settingsJson: { ...settings, mctbRole: "platform_mctb_sender" },
      },
    });
  }
  await updateMissedCallTextConfig({
    workspaceId: wsA,
    patch: { enabled: true, phone_number_id: customerPhone.id },
    source: "p0-proof-customer",
  });

  const resolved = await resolveInboundPhoneRowByE164(customerOnlyDid);
  assert.ok(resolved);
  assert.equal(resolved!.workspaceId, wsA, "customer ingress must not prefer ws_1");
  if (ownerExists) {
    assert.notEqual(resolved!.workspaceId, ownerWs, "customer ingress must not prefer ws_1");
  }

  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
  await prisma.phoneNumber.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
  if (ownerExists) {
    await prisma.phoneNumber.deleteMany({ where: { workspaceId: ownerWs, e164: "+18887779999" } });
  }
  await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } }).catch(() => undefined);

  console.log("DID ambiguity + customer resolution: PASS");
}

async function testExistingConsentGating(
  prisma: Awaited<ReturnType<typeof import("../src/lib/db").getPrisma>>,
): Promise<void> {
  const { updateMissedCallTextConfig } = await import(
    "../src/lib/agents/missed-call-text-back/config"
  );

  const workspaceId = await createWorkspace(prisma);
  const forwardTarget = "+18885559004";
  const businessLine = "+15555559004";
  const caller = "+15555559005";
  const sessionStart = new Date().toISOString();

  const phone = await prisma.phoneNumber.create({
    data: {
      workspaceId,
      e164: forwardTarget,
      type: "toll_free",
      provider: "telnyx",
      providerNumberId: `prov-${randomUUID()}`,
      settingsJson: ingressSettings(),
    },
  });

  await updateMissedCallTextConfig({
    workspaceId,
    patch: { enabled: true, sender_mode: "PLATFORM", phone_number_id: phone.id },
    source: "p0-proof-consent",
  });

  await saveMctbOnboardingState(workspaceId, {
    consentMode: "existing_consent",
    businessNumberE164: businessLine,
    forwardingConnectedAt: sessionStart,
    liveTestSession: { startedAt: sessionStart, businessNumberE164: businessLine },
    workspaceTollFreeNumber: {
      e164: forwardTarget,
      phoneNumberId: phone.id,
      provider: "telnyx",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: "not_started",
      provisionedAt: sessionStart,
    },
  });

  const idempotencyKey = `p0-ec-${randomUUID()}`;
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

  const denied = await authorizeOnboardingLiveTestRecoverySend({
    workspaceId,
    idempotencyKey,
    callerE164: caller,
    businessE164: forwardTarget,
    forwardedFromE164: businessLine,
  });
  assert.equal(denied, false, "manipulated existing_consent without attestation must DENY");

  const user = await prisma.user.create({
    data: {
      email: `p0-${randomUUID()}@example.com`,
      name: "P0 attest",
    },
  });

  await recordWorkspaceExistingConsentAttestation({
    workspaceId,
    attestedByUserId: user.id,
  });

  const allowed = await authorizeOnboardingLiveTestRecoverySend({
    workspaceId,
    idempotencyKey,
    callerE164: caller,
    businessE164: forwardTarget,
    forwardedFromE164: businessLine,
  });
  assert.equal(allowed, true, "legitimate attested existing_consent may authorize live-test send");

  await prisma.missedCallEvent.deleteMany({ where: { workspaceId } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId } });
  await prisma.phoneNumber.deleteMany({ where: { workspaceId } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log("existing-consent gating: PASS");
}

async function main(): Promise<void> {
  if (!DATABASE_URL) {
    console.log("test-mctb-onboarding-lifecycle-p0-proof: SKIP (no DATABASE_URL)");
    return;
  }

  const { getPrisma } = await import("../src/lib/db");
  const prisma = getPrisma();

  await testProvisioningConcurrency(prisma);
  await testPurchaseSuccessLocalFailureRetry(prisma);
  await testActivationFailureRetrySuccess(prisma);
  await testDidAmbiguityAndCustomerResolution(prisma);
  await testExistingConsentGating(prisma);

  console.log("test-mctb-onboarding-lifecycle-p0-proof: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
