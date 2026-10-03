/**
 * MCTB dedicated ingress validity + read/provision split regressions.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-workspace-ingress-lifecycle.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { getPrisma } from "../src/lib/db";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { assessWorkspaceDedicatedMctbIngress } from "../src/lib/mctb/provisioning/workspace-ingress-validity";
import { getWorkspaceIngressStatus } from "../src/lib/mctb/provisioning/get-workspace-ingress-status";
import { getProductionMctbForwardTargetE164 } from "../src/lib/mctb/production-forward-target";
import {
  ensureMctbWorkspaceIngressReady,
} from "../src/lib/mctb/provisioning/ensure-workspace-ingress";
import {
  provisionMctbWorkspaceTollFreeIngress,
  setMctbTollFreeIngressProvisionTestDeps,
} from "../src/lib/mctb/provisioning/provision-workspace-toll-free-ingress";
import { updateMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { saveMctbOnboardingState } from "../src/lib/mctb/onboarding/state";
import { platformMctbSenderSettings } from "../src/lib/messaging/compliance/phone-number-class";

const onboardingApi = readFileSync(resolve("src/app/api/mctb/onboarding/route.ts"), "utf8");
const setupApi = readFileSync(resolve("src/app/api/mctb/setup/route.ts"), "utf8");
const onboardingGetOnly = onboardingApi.split("export async function POST")[0] ?? onboardingApi;

assert.doesNotMatch(
  onboardingGetOnly,
  /ensureMctbWorkspaceIngressReady/,
  "onboarding GET must not call ensureMctbWorkspaceIngressReady",
);
assert.match(
  onboardingApi,
  /getWorkspaceIngressStatus/,
  "onboarding GET must use read-only ingress status",
);
assert.doesNotMatch(
  setupApi,
  /ensureMctbWorkspaceIngressReady/,
  "setup GET must not provision ingress",
);
assert.match(setupApi, /getWorkspaceIngressStatus/, "setup GET must use read-only ingress status");

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.log("test-mctb-workspace-ingress-lifecycle: PASS (static only, no DATABASE_URL)");
  process.exit(0);
}

async function createWorkspace() {
  const prisma = getPrisma();
  const id = `mctb_ing_life_${randomUUID().slice(0, 8)}`;
  await prisma.workspace.create({
    data: {
      id,
      name: "Ingress lifecycle test",
      slug: `ing-life-${randomUUID().slice(0, 8)}`,
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

async function seedPlatformSenderIngress(workspaceId: string) {
  const prisma = getPrisma();
  const phoneId = `pn_platform_ing_${randomUUID().slice(0, 8)}`;
  const e164 = "+18885559042";
  await prisma.phoneNumber.create({
    data: {
      id: phoneId,
      workspaceId,
      e164,
      provider: "telnyx",
      providerNumberId: `telnyx-test-${randomUUID().slice(0, 6)}`,
      status: "Active",
      type: "TollFree",
      settingsJson: {
        ...platformMctbSenderSettings({ provider: "telnyx", isTollFree: true }),
        mctbSipIngress: true,
        telephony: { routingMode: "mctb_texml" },
        routingOwner: "mctb_texml",
      },
    },
  });
  await updateMissedCallTextConfig({
    workspaceId,
    patch: { phone_number_id: phoneId },
    source: "test_ingress_lifecycle",
  });
  await saveMctbOnboardingState(workspaceId, {
    workspaceTollFreeNumber: {
      e164,
      phoneNumberId: phoneId,
      provider: "telnyx",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: "not_started",
      provisionedAt: new Date().toISOString(),
    },
  });
  return { phoneId, e164 };
}

async function seedValidDedicatedIngress(workspaceId: string) {
  const prisma = getPrisma();
  const phoneId = `pn_dedicated_${randomUUID().slice(0, 8)}`;
  const e164 = "+18885559043";
  await prisma.phoneNumber.create({
    data: {
      id: phoneId,
      workspaceId,
      e164,
      provider: "telnyx",
      providerNumberId: `telnyx-ded-${randomUUID().slice(0, 6)}`,
      status: "Active",
      type: "TollFree",
      settingsJson: {
        mctbRole: "customer_mctb",
        mctbSipIngress: true,
        telephony: { routingMode: "mctb_texml" },
        routingOwner: "mctb_texml",
      },
    },
  });
  await updateMissedCallTextConfig({
    workspaceId,
    patch: { phone_number_id: phoneId },
    source: "test_ingress_lifecycle",
  });
  await saveMctbOnboardingState(workspaceId, {
    workspaceTollFreeNumber: {
      e164,
      phoneNumberId: phoneId,
      provider: "telnyx",
      numberType: "toll_free",
      voiceStatus: "ready",
      messagingVerificationStatus: "not_started",
      provisionedAt: new Date().toISOString(),
    },
  });
  return { phoneId, e164 };
}

async function main() {
  const wsPlatform = await createWorkspace();
  const wsDedicated = await createWorkspace();
  const wsConcurrent = await createWorkspace();

  try {
    const platformSeed = await seedPlatformSenderIngress(wsPlatform);
    const platformAssessment = await assessWorkspaceDedicatedMctbIngress(wsPlatform);
    assert.equal(platformAssessment.valid, false, "platform sender must not be valid ingress");
    const forwardPlatform = await getProductionMctbForwardTargetE164(wsPlatform);
    assert.notEqual(forwardPlatform, platformSeed.e164, "forward target must refuse platform sender");

    let provisionCalls = 0;
    setMctbTollFreeIngressProvisionTestDeps({
      pickTelnyxTollFreeIngressE164: async () => "+18885559099",
      importTelnyxNumbersIntoWorkspace: async ({ workspaceId, e164s }) => {
        const prisma = getPrisma();
        const e164 = e164s[0]!;
        const existing = await prisma.phoneNumber.findFirst({ where: { workspaceId, e164 } });
        if (existing) return;
        await prisma.phoneNumber.create({
          data: {
            id: `pn_import_${randomUUID().slice(0, 8)}`,
            workspaceId,
            e164,
            provider: "telnyx",
            providerNumberId: `telnyx-import-${randomUUID().slice(0, 6)}`,
            status: "Active",
            type: "TollFree",
            settingsJson: { mctbRole: "customer_mctb", mctbSipIngress: true },
          },
        });
      },
      routePhoneToMctbCallHandlingIngress: async ({ workspaceId, phoneNumberId }) => ({
        verify: { ok: true },
        texmlRoute: { texmlAppId: "test" },
        workspaceId,
        phoneNumberId,
      }),
      verifyMctbTexmlIngressRoute: async () => ({ ok: true }),
      setActiveCallHandler: async () => undefined,
      purchaseTelnyxTollFree: async () => {
        provisionCalls += 1;
        return "+18885559099";
      },
    });

    const provisioned = await provisionMctbWorkspaceTollFreeIngress(wsPlatform);
    assert.equal(provisioned.ok, true, "provision should replace invalid ingress");
    assert.notEqual(provisioned.phoneNumberId, platformSeed.phoneId);
    assert.ok(provisioned.phoneNumberId, "invalid legacy must receive dedicated ingress");

    const dedicated = await seedValidDedicatedIngress(wsDedicated);
    const assessmentDedicated = await assessWorkspaceDedicatedMctbIngress(wsDedicated);
    assert.equal(assessmentDedicated.valid, true);
    assert.equal(assessmentDedicated.phoneNumberId, dedicated.phoneId);

    const beforeCalls = provisionCalls;
    const reuse1 = await ensureMctbWorkspaceIngressReady(wsDedicated);
    const reuse2 = await ensureMctbWorkspaceIngressReady(wsDedicated);
    assert.equal(reuse1.phoneNumberId, dedicated.phoneId);
    assert.equal(reuse2.phoneNumberId, dedicated.phoneId);
    assert.equal(provisionCalls, beforeCalls, "valid ingress must not re-purchase");

    const status = await getWorkspaceIngressStatus(wsDedicated);
    assert.equal(status.validIngress, true);
    assert.equal(status.forwardTargetE164, dedicated.e164);

    const concurrent = await Promise.all([
      provisionMctbWorkspaceTollFreeIngress(wsConcurrent),
      provisionMctbWorkspaceTollFreeIngress(wsConcurrent),
      provisionMctbWorkspaceTollFreeIngress(wsConcurrent),
    ]);
    const okResults = concurrent.filter((r) => r.ok && r.phoneNumberId);
    assert.ok(okResults.length >= 1);
    const uniqueIds = new Set(okResults.map((r) => r.phoneNumberId));
    assert.equal(uniqueIds.size, 1, "concurrent provision must yield one ingress id");

    console.log("test-mctb-workspace-ingress-lifecycle: PASS");
  } finally {
    setMctbTollFreeIngressProvisionTestDeps(null);
    await cleanup(wsPlatform);
    await cleanup(wsDedicated);
    await cleanup(wsConcurrent);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
