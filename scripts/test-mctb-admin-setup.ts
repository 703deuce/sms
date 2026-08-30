/**
 * A2P detection + admin setup messaging readiness regression tests.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-admin-setup.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { getPhoneMessagingStatus } from "@/lib/messaging/compliance/phone-messaging-status";
import { evaluateTrialActivationGates } from "@/lib/mctb/onboarding/trial-gates";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

async function testProductionForwardRouting() {
  const prisma = getPrisma();
  const businessLine = `+1571${String(Date.now()).slice(-7)}`;
  const workspace = await prisma.workspace.create({
    data: {
      name: "MCTB production forward routing",
      slug: `mctb-prod-fwd-${Date.now()}`,
      type: "BUSINESS",
      customFieldsConfig: {
        mctb: {
          adminTestAccount: true,
          businessLineE164: businessLine,
        },
      },
    },
    select: { id: true },
  });

  try {
    await prisma.missedCallTextConfig.create({
      data: {
        workspaceId: workspace.id,
        enabled: true,
        phoneNumberId: "pn_test",
        messageTemplate: "test",
        delaySeconds: 0,
      },
    });

    const { resolveWorkspaceByForwardedBusinessLine } = await import(
      "@/lib/mctb/platform-production-routing"
    );
    const resolved = await resolveWorkspaceByForwardedBusinessLine(businessLine);
    assert.equal(resolved, workspace.id);
  } finally {
    await prisma.missedCallTextConfig
      .deleteMany({ where: { workspaceId: workspace.id } })
      .catch(() => undefined);
    await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => undefined);
  }
}

async function main() {
  test("test:stale-compliance-trusts-a2p-status", () => {
    const status = getPhoneMessagingStatus({
      e164: "+15714073615",
      provider: "telnyx",
      type: "local",
      a2pStatus: "APPROVED",
      settingsJson: telnyxLocalA2pSettings({ a2pApproved: false }),
    });
    assert.equal(status.approved, true);
    assert.equal(status.label, "A2P approved");
  });

  test("test:a2p-approved-number-detected", () => {
    const status = getPhoneMessagingStatus({
      e164: "+15714073615",
      provider: "telnyx",
      type: "local",
      a2pStatus: "APPROVED",
      settingsJson: telnyxLocalA2pSettings({ a2pApproved: true }),
    });
    assert.equal(status.approved, true);
    assert.equal(status.complianceType, "A2P_10DLC");
    assert.equal(status.label, "A2P approved");
  });

  test("test:trial-gates-skip-tfv-when-a2p-approved", () => {
    const gate = evaluateTrialActivationGates({
      trialPhoneE164: "+12025550123",
      trialPhoneNumberId: "pn_1",
      tfvPhoneNumberId: "pn_1",
      tfvStatus: "NOT_STARTED",
      forwardingConnected: true,
      liveTestPassed: true,
      trialAlreadyStarted: false,
      messagingApproved: true,
      numberClass: "TELNYX_LOCAL_A2P",
    });
    assert.equal(gate.canActivate, true);
    assert.equal(gate.missing.includes("tfv_approved"), false);
  });

  test("test:admin-test-workspace-messaging-ready-with-approved-phone", () => {
    const ready = isMctbSetupMessagingReady({
      phoneNumbers: [
        {
          a2pStatus: "APPROVED",
          settingsJson: telnyxLocalA2pSettings({ a2pApproved: true }),
        },
      ],
      requiredActions: ["Complete brand registration review"],
      adminFlags: {
        adminTestAccount: true,
        unlimitedMctbTesting: true,
        adminUnlimitedMctb: true,
      },
    });
    assert.equal(ready, true);
  });

  test("test:non-admin-requires-clean-compliance", () => {
    const ready = isMctbSetupMessagingReady({
      phoneNumbers: [
        {
          a2pStatus: "APPROVED",
          settingsJson: telnyxLocalA2pSettings({ a2pApproved: true }),
        },
      ],
      requiredActions: ["Complete brand registration review"],
      adminFlags: {
        adminTestAccount: false,
        unlimitedMctbTesting: false,
        adminUnlimitedMctb: false,
      },
    });
    assert.equal(ready, false);
  });

  await testProductionForwardRouting();
  console.log("✓ test:production-forward-routes-by-business-line");

  console.log("\nAll admin setup tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
