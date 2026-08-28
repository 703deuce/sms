/**
 * Mass Texting production certification — backend/data paths.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mass-texting-certification.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "../src/lib/db";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import {
  getOrCreateMassTextingBillingAccount,
  getMassTextingBillingSummary,
  updateMassTextingLifecycle,
} from "../src/lib/mass-texting/billing-account";
import {
  getSegmentAvailability,
  reserveSegmentsForCampaign,
} from "../src/lib/mass-texting/credit-accounting";
import { activateMassTextingTrial, refreshMassTextingTrialState } from "../src/lib/mass-texting/trial-lifecycle";
import { assertMassTextMarketingSendAllowed } from "../src/lib/mass-texting/a2p-enforcement";
import { launchCampaignWithAudit } from "../src/lib/mass-texting/campaign-launch";
import { handleMassTextingStripeEvent } from "../src/lib/mass-texting/stripe-webhook";
import { ensureProductConversation, resolveInboundConversation } from "../src/lib/mass-texting/conversation-context";
import { detectMassTextingIncidents } from "../src/lib/mass-texting/incident-detection";
import { MASS_TEXT_TRIAL } from "../src/lib/mass-texting/pricing";
import { normalizeE164 } from "../src/lib/messaging/twilio-mappings";
import { processInboundMessage } from "../src/lib/messaging/inbound-process";
import { buildPreSendReview } from "../src/lib/mass-texting/pre-send-review";

function suffix() {
  return randomBytes(4).toString("hex");
}

async function createWorkspace(name: string) {
  const prisma = getPrisma();
  const id = suffix();
  return prisma.workspace.create({
    data: { name: `${name} ${id}`, slug: `mt-cert-${id}`, type: "BUSINESS" },
  });
}

async function cleanupWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  const lists = await prisma.contactList.findMany({ where: { workspaceId }, select: { id: true } });
  for (const list of lists) {
    await prisma.contactListMember.deleteMany({ where: { listId: list.id } });
  }
  await prisma.contactList.deleteMany({ where: { workspaceId } });
  await prisma.campaignMessage.deleteMany({ where: { workspaceId } });
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId } });
  await prisma.campaignLaunchAudit.deleteMany({ where: { workspaceId } });
  await prisma.campaign.deleteMany({ where: { workspaceId } });
  await prisma.conversationMessage.deleteMany({
    where: { conversation: { workspaceId } },
  }).catch(async () => {
    const convos = await prisma.conversation.findMany({ where: { workspaceId }, select: { id: true } });
    for (const c of convos) {
      await prisma.conversationMessage.deleteMany({ where: { conversationId: c.id } });
    }
  });
  await prisma.conversation.deleteMany({ where: { workspaceId } });
  await prisma.suppression.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.massTextingCreditReservation.deleteMany({ where: { workspaceId } });
  await prisma.massTextingBillingEvent.deleteMany({ where: { workspaceId } });
  await prisma.massTextingBillingAccount.deleteMany({ where: { workspaceId } });
  await prisma.messagingRegistration.deleteMany({ where: { workspaceId } });
  await prisma.messagingProductRegistration.deleteMany({ where: { workspaceId } });
  await prisma.phoneNumber.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.integrationAlert.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}

async function main() {
  const prisma = getPrisma();
  const ws = await createWorkspace("MT Cert");
  const other = await createWorkspace("MT Other");
  const workspaceId = ws.id;
  try {
    await grantWorkspaceProductFeature(workspaceId, "mass_texting", "trial");
    await grantWorkspaceProductFeature(other.id, "mctb", "active");

    // Trial does not start until messaging can send
    await getOrCreateMassTextingBillingAccount(workspaceId);
    const pendingTrial = await activateMassTextingTrial(workspaceId);
    assert.equal(pendingTrial.ok, false);

    await prisma.messagingRegistration.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        overallStatus: "ready",
        messagingEnabled: true,
        phoneAttached: true,
        phoneE164: "+15550001111",
        brandStatus: "approved",
        campaignStatus: "approved",
        messagingProfileId: "mock-profile",
        campaignId: "mock-campaign",
        messagingProvider: "mock",
        messagingServiceSid: "mock-service",
        useCase: "mixed",
      },
      update: {
        overallStatus: "ready",
        messagingEnabled: true,
        phoneAttached: true,
        phoneE164: "+15550001111",
        brandStatus: "approved",
        campaignStatus: "approved",
        messagingProfileId: "mock-profile",
        campaignId: "mock-campaign",
        messagingProvider: "mock",
        messagingServiceSid: "mock-service",
        useCase: "mixed",
      },
    });
    await prisma.phoneNumber.create({
      data: {
        workspaceId,
        e164: "+15550001111",
        status: "Active",
        type: "local",
        a2pStatus: "APPROVED",
      },
    }).catch(() => undefined);

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
    await prisma.messagingProductRegistration.upsert({
      where: {
        workspaceId_productUseCase: {
          workspaceId,
          productUseCase: "MCTB_CUSTOMER_CARE",
        },
      },
      create: {
        workspaceId,
        productUseCase: "MCTB_CUSTOMER_CARE",
        overallStatus: "approved",
        messagingEnabled: true,
        phoneAttached: true,
        phoneE164: "+15550002222",
      },
      update: {
        overallStatus: "approved",
        messagingEnabled: true,
        phoneAttached: true,
      },
    });

    const trial = await activateMassTextingTrial(workspaceId);
    assert.equal(trial.ok, true);
    const a2p = await assertMassTextMarketingSendAllowed(workspaceId);
    assert.equal(a2p.allowed, true);

    const summary = await getMassTextingBillingSummary(workspaceId);
    assert.equal(summary.lifecycleState, "TRIAL_ACTIVE");
    assert.equal(summary.trialSegmentsRemaining, MASS_TEXT_TRIAL.includedSegments);

    const over = await reserveSegmentsForCampaign({
      workspaceId,
      campaignId: "cap",
      segments: 101,
      idempotencyKey: `cap-${suffix()}`,
    });
    assert.equal(over.ok, false);

    const exact = await reserveSegmentsForCampaign({
      workspaceId,
      campaignId: "exact",
      segments: 100,
      idempotencyKey: `exact-${suffix()}`,
    });
    assert.equal(exact.ok, true);
    await refreshMassTextingTrialState(workspaceId);
    const after = await getSegmentAvailability(workspaceId);
    assert.equal(after.available, 0);

    // Contacts + lists + suppression
    const phoneA = normalizeE164("555-201-0001");
    const phoneB = normalizeE164("(555) 201-0002");
    const contactA = await prisma.contact.create({
      data: { workspaceId, phone: phoneA, firstName: "Amy", status: "SUBSCRIBED" },
    });
    const contactB = await prisma.contact.create({
      data: { workspaceId, phone: phoneB, firstName: "Bob", status: "SUBSCRIBED" },
    });
    const list1 = await prisma.contactList.create({
      data: { workspaceId, name: "List One" },
    });
    const list2 = await prisma.contactList.create({
      data: { workspaceId, name: "List Two" },
    });
    await prisma.contactListMember.create({ data: { listId: list1.id, contactId: contactA.id } });
    await prisma.contactListMember.create({ data: { listId: list1.id, contactId: contactB.id } });
    await prisma.contactListMember.create({ data: { listId: list2.id, contactId: contactA.id } });

    const otherContact = await prisma.contact.create({
      data: { workspaceId: other.id, phone: phoneA, firstName: "Other", status: "SUBSCRIBED" },
    });
    const leaked = await prisma.contact.findFirst({
      where: { id: otherContact.id, workspaceId },
    });
    assert.equal(leaked, null);

    await prisma.suppression.create({
      data: {
        workspaceId,
        phone: phoneB,
        suppressionKey: `${workspaceId}:p:${phoneB}`,
        reason: "STOP",
        source: "test",
      },
    });
    await prisma.contact.update({
      where: { id: contactB.id },
      data: { status: "UNSUBSCRIBED" },
    });

    await updateMassTextingLifecycle(workspaceId, "PRODUCTION_ACTIVE", {
      billingModel: "monthly",
      monthlyPlanTier: "growth",
      monthlySegmentsIncluded: 1000,
      monthlySegmentsUsed: 0,
      paygCreditsSegments: 0,
      paygLineActive: false,
    });

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name: "Cert blast",
        type: "Promotion",
        category: "promotion",
        audience: "List",
        body: "Hi {{first_name}}, sale today. Reply STOP to opt out.",
        status: "DRAFT",
        configJson: {
          productSource: "mass_text",
          massTexting: true,
          listIds: [list1.id, list2.id],
        },
      },
    });

    const review = await buildPreSendReview(workspaceId, campaign.id);
    assert.ok(review);
    assert.equal(review!.duplicateRemoved >= 1, true, "overlapping lists must dedupe");
    assert.equal(review!.suppressedRemoved >= 1, true);
    assert.equal(review!.finalRecipientCount, 1);

    const firstLaunch = await launchCampaignWithAudit({
      workspaceId,
      campaignId: campaign.id,
      idempotencyKey: `launch:${workspaceId}:${campaign.id}`,
    });
    assert.equal(firstLaunch.ok, true);
    const replay = await launchCampaignWithAudit({
      workspaceId,
      campaignId: campaign.id,
      idempotencyKey: `launch:${workspaceId}:${campaign.id}`,
    });
    assert.equal(replay.ok, true);
    if (replay.ok) assert.equal(replay.idempotentReplay, true);

    const sending = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert.equal(sending?.status, "SENDING");

    // Dual-product inbox isolation
    const mctbNumber = await prisma.phoneNumber.create({
      data: {
        workspaceId,
        e164: "+15550002222",
        type: "local",
        status: "Active",
        settingsJson: { mctbRole: "customer_mctb" },
      },
    });
    const mtNumber =
      (await prisma.phoneNumber.findFirst({
        where: { workspaceId, e164: "+15550001111" },
      })) ??
      (await prisma.phoneNumber.create({
        data: {
          workspaceId,
          e164: "+15550001111",
          type: "local",
          status: "Active",
          settingsJson: { massTextRole: "primary" },
        },
      }));
    const mctbConvo = await ensureProductConversation({
      workspaceId,
      contactId: contactA.id,
      productSource: "mctb",
      phoneNumberId: mctbNumber.id,
      fromE164: mctbNumber.e164,
    });
    const mtConvo = await ensureProductConversation({
      workspaceId,
      contactId: contactA.id,
      productSource: "mass_text",
      phoneNumberId: mtNumber.id,
      fromE164: mtNumber.e164,
    });
    assert.notEqual(mctbConvo.conversationId, mtConvo.conversationId);

    const inboundMt = await resolveInboundConversation({
      workspaceId,
      contactId: contactA.id,
      toE164: mtNumber.e164,
      fromE164: phoneA,
    });
    assert.equal(inboundMt.productSource, "mass_text");
    const inboundMctb = await resolveInboundConversation({
      workspaceId,
      contactId: contactA.id,
      toE164: mctbNumber.e164,
      fromE164: phoneA,
    });
    assert.equal(inboundMctb.productSource, "mctb");

    const stop = await processInboundMessage({
      workspaceId,
      from: phoneA,
      to: mtNumber.e164,
      body: "STOP",
      providerMessageId: `stop-${suffix()}`,
    });
    assert.equal(stop.kind, "stop");
    const suppressedA = await prisma.suppression.findFirst({
      where: { workspaceId, phone: phoneA },
    });
    assert.ok(suppressedA);

    const help = await processInboundMessage({
      workspaceId,
      from: phoneA,
      to: mtNumber.e164,
      body: "HELP",
      providerMessageId: `help-${suffix()}`,
    });
    assert.equal(help.kind, "help");

    const eventId = `evt_${suffix()}`;
    const stripeEvent = {
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          metadata: {
            product: "mass_texting",
            workspaceId,
            massTextProductKey: "mass_texting_starter",
            a2pWaived: "false",
          },
          subscription: "sub_test",
        },
      },
    } as never;
    const firstWh = await handleMassTextingStripeEvent(stripeEvent);
    assert.equal(firstWh.handled, true);
    const secondWh = await handleMassTextingStripeEvent(stripeEvent);
    assert.equal(secondWh.handled, true);
    const events = await prisma.massTextingBillingEvent.count({
      where: { stripeEventId: eventId },
    });
    assert.equal(events, 1);

    await detectMassTextingIncidents(workspaceId);

    console.log("test-mass-texting-certification: ok");
  } finally {
    await cleanupWorkspace(workspaceId);
    await cleanupWorkspace(other.id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
