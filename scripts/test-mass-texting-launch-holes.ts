/**
 * Mass Texting launch/credit/nav hole regressions.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mass-texting-launch-holes.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import {
  ensureWorkspaceProductFeatures,
  getWorkspaceProductFeatures,
  grantWorkspaceProductFeature,
} from "../src/lib/products/feature-entitlements";
import { activeProductKeys } from "../src/lib/products/entitlements";
import {
  getOrCreateMassTextingBillingAccount,
  updateMassTextingLifecycle,
} from "../src/lib/mass-texting/billing-account";
import {
  getSegmentAvailability,
  getActiveCampaignReservation,
  settleCampaignReservation,
} from "../src/lib/mass-texting/credit-accounting";
import { launchCampaignWithAudit } from "../src/lib/mass-texting/campaign-launch";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";
import { buildSequenceForCategory } from "../src/lib/campaigns/catalog";
import { attachMediaToFirstSmsStep } from "../src/lib/campaigns/sequence-engine";
import { buildPreSendReview } from "../src/lib/mass-texting/pre-send-review";

function suffix() {
  return randomBytes(4).toString("hex");
}

async function createWorkspace(name: string) {
  const prisma = getPrisma();
  const id = suffix();
  return prisma.workspace.create({
    data: { name: `${name} ${id}`, slug: `mt-holes-${id}`, type: "BUSINESS" },
  });
}

async function cleanupWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  const lists = await prisma.contactList.findMany({ where: { workspaceId }, select: { id: true } });
  for (const list of lists) {
    await prisma.contactListMember.deleteMany({ where: { listId: list.id } });
  }
  await prisma.contactList.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignMessage.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaignLaunchAudit.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.campaign.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.contact.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.massTextingCreditReservation.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.massTextingBillingAccount.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.messagingProductRegistration.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.missedCallTextConfig.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.productEntitlement.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}

async function prepareSendReady(workspaceId: string) {
  const prisma = getPrisma();
  await grantWorkspaceProductFeature(workspaceId, "mass_texting", "trial");
  await getOrCreateMassTextingBillingAccount(workspaceId);
  await prisma.messagingProductRegistration.upsert({
    where: {
      workspaceId_productUseCase: {
        workspaceId,
        productUseCase: "MASS_TEXT_MARKETING",
      },
    },
    create: {
      workspaceId,
      productUseCase: "MASS_TEXT_MARKETING",
      overallStatus: "approved",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: "+15550001111",
    },
    update: {
      overallStatus: "approved",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: "+15550001111",
    },
  });
  await updateMassTextingLifecycle(workspaceId, "PRODUCTION_ACTIVE", {
    billingModel: "monthly",
    monthlyPlanTier: "growth",
    monthlySegmentsIncluded: 1000,
    monthlySegmentsUsed: 0,
    paygCreditsSegments: 0,
    paygLineActive: false,
  });
}

async function main() {
  const prisma = getPrisma();
  const ws = await createWorkspace("MT Holes");
  const workspaceId = ws.id;
  try {
    const cookieKeys = activeProductKeys({
      products: [{ productKey: "voice", status: "active", activatedAt: null, deactivatedAt: null }],
      hasVoice: true,
      hasSms: true,
      hasNumbers: false,
      lastActiveProduct: null,
      productIntent: null,
    });
    assert.ok(cookieKeys.includes("sms"), "mass-texting hasSms must be in the product cookie");
    assert.ok(cookieKeys.includes("voice"));

    await prepareSendReady(workspaceId);

    await prisma.productEntitlement.upsert({
      where: { workspaceId_productKey: { workspaceId, productKey: "VOICE" } },
      create: { workspaceId, productKey: "VOICE", status: "ACTIVE", activatedAt: new Date() },
      update: { status: "ACTIVE" },
    });
    await ensureWorkspaceProductFeatures(workspaceId);
    const mtOnlyFeatures = await getWorkspaceProductFeatures(workspaceId);
    assert.equal(
      mtOnlyFeatures.mctb,
      "inactive",
      "Mass Texting-only workspaces must not auto-gain MCTB from default voice",
    );
    assert.ok(
      mtOnlyFeatures.mass_texting === "trial" || mtOnlyFeatures.mass_texting === "active",
    );

    await prisma.missedCallTextConfig.create({
      data: { workspaceId, enabled: true },
    });
    const withUsage = await getWorkspaceProductFeatures(workspaceId);
    assert.equal(withUsage.mctb, "active", "MCTB usage must keep MCTB next to Mass Texting");

    const phoneKeep = normalizeE164("555-301-0001");
    const phoneDrop = normalizeE164("555-301-0002");
    const keep = await prisma.contact.create({
      data: { workspaceId, phone: phoneKeep, firstName: "Keep", status: "SUBSCRIBED" },
    });
    const drop = await prisma.contact.create({
      data: { workspaceId, phone: phoneDrop, firstName: "Drop", status: "SUBSCRIBED" },
    });
    const list = await prisma.contactList.create({
      data: { workspaceId, name: "Live list" },
    });
    await prisma.contactListMember.create({ data: { listId: list.id, contactId: keep.id } });

    const sequence = buildSequenceForCategory("follow_up", "Hi {{first_name}}", {
      followUpCount: 2,
    });
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name: "Hole blast",
        type: "Promotion",
        category: "follow_up",
        audience: "List",
        body: "Hi {{first_name}}",
        status: "DRAFT",
        sequenceJson: sequence,
        configJson: {
          productSource: "mass_text",
          massTexting: true,
          listIds: [list.id],
        },
      },
    });
    await prisma.campaignRecipient.create({
      data: {
        workspaceId,
        campaignId: campaign.id,
        contactId: drop.id,
        phone: phoneDrop,
        displayName: "Drop",
        workflowStatus: "pending",
        enrollmentKey: `${campaign.id}:p:${phoneDrop}`,
      },
    });

    const review = await buildPreSendReview(workspaceId, campaign.id);
    assert.ok(review);
    assert.ok(review!.estimatedSegments >= 2, "multi-step follow-up must reserve more than one SMS");
    assert.equal(review!.acceptedPhones.includes(phoneKeep), true);
    assert.equal(review!.acceptedPhones.includes(phoneDrop), false);

    await prisma.campaignLaunchAudit.create({
      data: {
        workspaceId,
        campaignId: campaign.id,
        idempotencyKey: `launch:${workspaceId}:${campaign.id}`,
        rawContactCount: 1,
        finalRecipientCount: 1,
        estimatedSegments: review!.estimatedSegments,
      },
    });
    const stillDraft = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert.equal(stillDraft?.status, "DRAFT");

    const beforeLaunch = await getSegmentAvailability(workspaceId);
    const orphanResume = await launchCampaignWithAudit({
      workspaceId,
      campaignId: campaign.id,
      idempotencyKey: `launch:${campaign.id}`,
    });
    assert.equal(orphanResume.ok, true, orphanResume.ok ? "" : orphanResume.error);
    const sending = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert.equal(sending?.status, "SENDING", "orphan audit must resume into SENDING, not false-success DRAFT");

    const dropped = await prisma.campaignRecipient.findFirst({
      where: { campaignId: campaign.id, phone: phoneDrop },
    });
    assert.equal(dropped?.workflowStatus, "stopped");
    assert.equal(dropped?.stopReason, "left_audience_before_launch");

    const activeRes = await getActiveCampaignReservation(campaign.id);
    assert.ok(activeRes, "launch must hold an ACTIVE credit reservation");
    const afterLaunch = await getSegmentAvailability(workspaceId);
    assert.ok(afterLaunch.available < beforeLaunch.available, "credits stay reserved through launch");

    const replay = await launchCampaignWithAudit({
      workspaceId,
      campaignId: campaign.id,
      idempotencyKey: `launch:${campaign.id}`,
    });
    assert.equal(replay.ok, true);
    if (replay.ok) assert.equal(replay.idempotentReplay, true);
    const reservations = await prisma.massTextingCreditReservation.findMany({
      where: { campaignId: campaign.id, status: "ACTIVE" },
    });
    assert.equal(reservations.length, 1, "replay must not double-reserve");

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "CANCELED" },
    });
    const settled = await settleCampaignReservation(campaign.id);
    assert.equal(settled.settled, true);
    const afterCancel = await getSegmentAvailability(workspaceId);
    assert.equal(afterCancel.available, beforeLaunch.available, "cancel must release unused credits");
    const leftover = await getActiveCampaignReservation(campaign.id);
    assert.equal(leftover, null);

    const pic = "https://example.com/promo.jpg";
    const mmsSequence = attachMediaToFirstSmsStep(
      buildSequenceForCategory("broadcast", "Check this out", {}),
      [pic],
    );
    const mmsCampaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name: "MMS blast",
        type: "Announcement",
        category: "broadcast",
        audience: "List",
        body: "Check this out",
        status: "DRAFT",
        sequenceJson: mmsSequence,
        configJson: {
          productSource: "mass_text",
          massTexting: true,
          listIds: [list.id],
          mediaUrls: [pic],
        },
      },
    });
    const mmsReview = await buildPreSendReview(workspaceId, mmsCampaign.id);
    assert.ok(mmsReview);
    assert.equal(mmsReview!.estimatedSegments, 3, "one-step MMS blast bills 3 credits per recipient");
    assert.equal(mmsReview!.mmsCount, 1);
    assert.equal(mmsReview!.mmsBlocked, false);

    console.log("test-mass-texting-launch-holes: ok");
  } finally {
    await cleanupWorkspace(workspaceId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
