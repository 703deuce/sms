/**
 * Mass Texting billing + credit reservation integration tests.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mass-texting-credit-reservations.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import { getOrCreateMassTextingBillingAccount, updateMassTextingLifecycle } from "../src/lib/mass-texting/billing-account";
import {
  getSegmentAvailability,
  reserveSegmentsForCampaign,
  releaseReservation,
} from "../src/lib/mass-texting/credit-accounting";
import { MASS_TEXT_TRIAL } from "../src/lib/mass-texting/pricing";

async function createTestWorkspace() {
  const prisma = getPrisma();
  const suffix = randomBytes(4).toString("hex");
  const workspace = await prisma.workspace.create({
    data: {
      name: `MT Test ${suffix}`,
      slug: `mt-test-${suffix}`,
      type: "BUSINESS",
    },
  });
  return workspace.id;
}

async function cleanup(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.massTextingCreditReservation.deleteMany({ where: { workspaceId } });
  await prisma.massTextingBillingAccount.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}

async function main() {
  const workspaceId = await createTestWorkspace();
  try {
    await getOrCreateMassTextingBillingAccount(workspaceId);
    await updateMassTextingLifecycle(workspaceId, "TRIAL_ACTIVE", {
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
      trialSegmentsUsed: 0,
    });

    const avail1 = await getSegmentAvailability(workspaceId);
    assert.equal(avail1.available, MASS_TEXT_TRIAL.includedSegments);
    assert.equal(avail1.canSend, true);

    const r1 = await reserveSegmentsForCampaign({
      workspaceId,
      campaignId: "camp_a",
      segments: 60,
      idempotencyKey: `test-${randomBytes(4).toString("hex")}`,
    });
    assert.equal(r1.ok, true);
    if (!r1.ok) throw new Error("reservation failed");

    const avail2 = await getSegmentAvailability(workspaceId);
    assert.equal(avail2.available, MASS_TEXT_TRIAL.includedSegments - 60);

    const r2 = await reserveSegmentsForCampaign({
      workspaceId,
      campaignId: "camp_b",
      segments: 40,
      idempotencyKey: `test-${randomBytes(4).toString("hex")}`,
    });
    assert.equal(r2.ok, true);

    const avail3 = await getSegmentAvailability(workspaceId);
    assert.equal(avail3.available, 0);

    const r3 = await reserveSegmentsForCampaign({
      workspaceId,
      campaignId: "camp_c",
      segments: 1,
      idempotencyKey: `test-${randomBytes(4).toString("hex")}`,
    });
    assert.equal(r3.ok, false);
    if (r3.ok) throw new Error("should not allow over-reservation");

    await releaseReservation(r1.reservationId, "test_cleanup");
    const avail4 = await getSegmentAvailability(workspaceId);
    assert.equal(avail4.available, 60);

    await updateMassTextingLifecycle(workspaceId, "PRODUCTION_ACTIVE", {
      billingModel: "monthly",
      monthlyPlanTier: "growth",
      monthlySegmentsIncluded: 1000,
      monthlySegmentsUsed: 0,
      paygCreditsSegments: 200,
    });

    const r4 = await reserveSegmentsForCampaign({
      workspaceId,
      campaignId: "camp_d",
      segments: 900,
      idempotencyKey: `test-${randomBytes(4).toString("hex")}`,
    });
    assert.equal(r4.ok, true);

    const r5 = await reserveSegmentsForCampaign({
      workspaceId,
      campaignId: "camp_e",
      segments: 400,
      idempotencyKey: `test-${randomBytes(4).toString("hex")}`,
    });
    assert.equal(r5.ok, false);

    console.log("test-mass-texting-credit-reservations: ok");
  } finally {
    await cleanup(workspaceId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
