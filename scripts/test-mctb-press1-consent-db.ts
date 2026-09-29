#!/usr/bin/env npx tsx
/**
 * Tests MCTB Press-1 DB linkage without sending SMS.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  normalizeBusinessE164ForStorage,
  resolveInboundPhoneNumberId,
  resolveMctbConfiguredTriggerPhoneNumberId,
} from "@/lib/mctb/resolve-inbound-phone-number";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { recordSmsConsent } from "@/lib/smart-routing/consent-service";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

const PROVIDER_CALL_ID = `test_mctb_press1_${Date.now()}`;
const CALLER = "+12025550198";

async function createIsolatedWorkspace(phoneNumberId: string): Promise<string> {
  const prisma = getPrisma();
  const workspaceId = `mctb_press1_${randomUUID().slice(0, 10)}`;
  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "MCTB Press-1 DB test",
      slug: `mctb-p1-${randomUUID().slice(0, 8)}`,
      type: "BUSINESS",
      billingPlan: "trial",
      customFieldsConfig: {},
    },
  });
  await grantWorkspaceProductFeature(workspaceId, "mctb", "active");
  await prisma.missedCallTextConfig.create({
    data: {
      workspaceId,
      enabled: true,
      phoneNumberId,
      smsPhoneNumberId: phoneNumberId,
      messageTemplate: "Test",
      delaySeconds: 0,
    },
  });
  return workspaceId;
}

async function cleanupWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.smartRoutingSmsConsentEvent.deleteMany({ where: { workspaceId } }).catch(() => undefined);
  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
}

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: MCTB_PLATFORM_DEMO_E164 },
    select: { id: true, e164: true },
  });
  assert.ok(phone?.id, "platform demo phone number must exist");

  const WORKSPACE_ID = await createIsolatedWorkspace(phone.id);

  try {
    const phoneIdBare = await resolveInboundPhoneNumberId({
      workspaceId: WORKSPACE_ID,
      transovoNumberE164: "15714073615",
      isPlatformDemo: true,
    });
    assert.equal(phoneIdBare, phone.id, "bare-digit transovo E164 must resolve phoneNumberId");

    const phoneIdPlus = await resolveInboundPhoneNumberId({
      workspaceId: WORKSPACE_ID,
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      isPlatformDemo: true,
    });
    assert.equal(phoneIdPlus, phone.id, "+E164 transovo must resolve phoneNumberId");

    assert.equal(
      normalizeBusinessE164ForStorage("15714073615", MCTB_PLATFORM_DEMO_E164),
      MCTB_PLATFORM_DEMO_E164,
    );

    const mctbConfig = await loadMissedCallTextConfig(WORKSPACE_ID);
    const triggerPhoneNumberId = await resolveMctbConfiguredTriggerPhoneNumberId(WORKSPACE_ID);
    assert.equal(
      triggerPhoneNumberId,
      mctbConfig.smsPhoneNumberId || mctbConfig.phoneNumberId,
      "configured MCTB SMS trigger must match setup sender line",
    );
    assert.ok(triggerPhoneNumberId, "workspace must have MCTB sender configured");

    const observability = {
      path: "livekit_sip_mctb",
      captureMode: "SIP_INGRESS",
      consentMode: "press_1",
      providerCallId: PROVIDER_CALL_ID,
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      mediaBackend: "self_hosted",
    };

    const first = await recordSmsConsent({
      workspaceId: WORKSPACE_ID,
      callerNumber: CALLER,
      businessNumber: MCTB_PLATFORM_DEMO_E164,
      callSessionId: PROVIDER_CALL_ID,
      affirmativeInput: "1",
      metadata: observability,
    });
    assert.equal(first.duplicate, false);

    const second = await recordSmsConsent({
      workspaceId: WORKSPACE_ID,
      callerNumber: CALLER,
      businessNumber: MCTB_PLATFORM_DEMO_E164,
      callSessionId: PROVIDER_CALL_ID,
      affirmativeInput: "1",
      metadata: observability,
    });
    assert.equal(second.duplicate, true, "duplicate providerCallId must not create second consent");

    console.log("test:mctb-press1-consent-db PASS", {
      phoneNumberId: phone.id,
      consentId: first.consent.id,
      duplicateBlocked: second.duplicate,
    });
  } finally {
    await cleanupWorkspace(WORKSPACE_ID);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
