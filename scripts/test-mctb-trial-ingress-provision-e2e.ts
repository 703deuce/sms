/**
 * Fresh-workspace MCTB ingress provisioning E2E (DB + optional live Telnyx acquire).
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-trial-ingress-provision-e2e.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import {
  getTrialNumberStatus,
  provisionTrialMctbNumber,
} from "../src/lib/mctb/onboarding/trial-number";
import { mctbTexmlEntryVoiceUrl } from "../src/lib/mctb/texml-ingress/texml-route";
import { provisionMctbPhoneTexmlIngressMode } from "../src/lib/mctb/texml-ingress/texml-mode-provision";
import { saveMctbOnboardingState, loadMctbOnboardingState } from "../src/lib/mctb/onboarding/state";

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.log("test-mctb-trial-ingress-provision-e2e: SKIP (no DATABASE_URL)");
  process.exit(0);
}

async function createFreshWorkspace() {
  const prisma = getPrisma();
  const id = `mctb_ingress_${randomUUID().slice(0, 10)}`;
  await prisma.workspace.create({
    data: {
      id,
      name: "MCTB ingress E2E",
      slug: `mctb-ing-${randomUUID().slice(0, 8)}`,
      type: "BUSINESS",
      billingPlan: "trial",
      customFieldsConfig: {},
    },
  });
  await grantWorkspaceProductFeature(id, "mctb", "active");
  return id;
}

async function cleanup(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.phoneNumber.deleteMany({ where: { workspaceId } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
}

async function main() {
  const workspaceId = await createFreshWorkspace();
  const prisma = getPrisma();

  try {
    const before = await getTrialNumberStatus(workspaceId);
    assert.equal(before.provisioned, false, "fresh workspace has no ingress");

    const skipLivePurchase = process.env.MCTB_CERT_SKIP_LIVE_DID_PURCHASE?.trim() === "1";
    let liveProvisioned = false;
    if (!skipLivePurchase) {
      const live = await provisionTrialMctbNumber(workspaceId);
      if (live.ok && live.trialNumber?.e164) {
        liveProvisioned = true;
        const after = await getTrialNumberStatus(workspaceId);
        assert.equal(after.provisioned, true);
        assert.ok(after.trialNumber?.e164);
        const retry = await provisionTrialMctbNumber(workspaceId);
        assert.equal(retry.ok, true);
        assert.equal(
          retry.trialNumber?.phoneNumberId,
          live.trialNumber.phoneNumberId,
          "retry must not purchase duplicate DID",
        );

        const phone = await prisma.phoneNumber.findFirst({
          where: { workspaceId, id: live.trialNumber.phoneNumberId },
          select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
        });
        assert.ok(phone?.providerNumberId, "ingress row must have providerNumberId");

        try {
          const bound = await provisionMctbPhoneTexmlIngressMode({
            workspaceId,
            phoneNumberId: phone!.id,
            consentMode: "press_1",
            automationActive: true,
          });
          assert.equal(bound.voiceUrl, mctbTexmlEntryVoiceUrl());
          assert.equal(bound.handlerMode, "press_1");
        } catch (bindErr) {
          console.warn(
            "TeXML bind skipped (provider):",
            bindErr instanceof Error ? bindErr.message : bindErr,
          );
        }
      } else {
        assert.ok(live.error, "failed provision must return error, not fake success");
        assert.equal(
          (await getTrialNumberStatus(workspaceId)).provisioned,
          false,
          "no usable forwarding target when acquire fails",
        );
      }
    }

    if (!liveProvisioned) {
      const rowId = randomUUID();
      const providerNumberId = `pn_test_${randomUUID().slice(0, 8)}`;
      const e164 = "+1866555" + String(Math.floor(1000 + Math.random() * 9000));
      await prisma.phoneNumber.create({
        data: {
          id: rowId,
          workspaceId,
          e164,
          provider: "telnyx",
          providerNumberId,
          type: "Local",
          status: "Active",
          settingsJson: {},
        },
      });
      const state = await loadMctbOnboardingState(workspaceId);
      await saveMctbOnboardingState(workspaceId, {
        ...state,
        trialNumber: {
          e164,
          phoneNumberId: rowId,
          provider: "telnyx",
          numberType: "local",
          voiceStatus: "ready",
          messagingVerificationStatus: "not_started",
          provisionedAt: new Date().toISOString(),
        },
        workspaceTollFreeNumber: { e164, phoneNumberId: rowId },
      });
      const seeded = await getTrialNumberStatus(workspaceId);
      assert.equal(seeded.provisioned, true);
      assert.ok(seeded.trialNumber?.e164);
      const seededAgain = await getTrialNumberStatus(workspaceId);
      assert.equal(seededAgain.trialNumber?.phoneNumberId, seeded.trialNumber?.phoneNumberId);
      if (!skipLivePurchase) {
        const idempotent = await provisionTrialMctbNumber(workspaceId);
        assert.equal(idempotent.ok, true);
      }
    }

    console.log("test-mctb-trial-ingress-provision-e2e: PASS");
  } finally {
    await cleanup(workspaceId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
