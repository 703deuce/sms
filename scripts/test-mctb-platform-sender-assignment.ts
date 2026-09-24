#!/usr/bin/env tsx
/**
 * MCTB platform sender active conversation ownership tests.
 * Run: npx tsx scripts/test-mctb-platform-sender-assignment.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import {
  claimPlatformSenderAssignment,
  findActivePlatformSenderAssignment,
  releasePlatformSenderAssignment,
  resolvePlatformInboundReplyFromContexts,
  resolvePlatformMctbInboundReplyWithAssignment,
  MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS,
} from "../src/lib/mctb/messaging/platform-sender-assignment";

const CONSUMER = "+15550990001";

async function setupFixture() {
  const prisma = getPrisma();
  const token = `${Date.now()}`;
  const platformOwner = await prisma.workspace.create({
    data: { name: "Platform Owner", slug: `plat-own-${token}` },
  });
  const wsA = await prisma.workspace.create({
    data: { name: "Assign A", slug: `assign-a-${token}` },
  });
  const wsB = await prisma.workspace.create({
    data: { name: "Assign B", slug: `assign-b-${token}` },
  });
  const platformPhone = await prisma.phoneNumber.create({
    data: {
      workspaceId: platformOwner.id,
      e164: "+18885046264",
      type: "toll_free",
      provider: "twilio",
      settingsJson: { mctbRole: "platform_mctb_sender" },
    },
  });
  return {
    token,
    platformOwnerId: platformOwner.id,
    wsA: wsA.id,
    wsB: wsB.id,
    platformPhoneId: platformPhone.id,
  };
}

async function teardown(ids: { platformOwnerId: string; wsA: string; wsB: string }) {
  const prisma = getPrisma();
  await prisma.workspace.delete({ where: { id: ids.wsA } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ids.wsB } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ids.platformOwnerId } }).catch(() => undefined);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const fx = await setupFixture();
  const platformSender = {
    phoneNumberId: fx.platformPhoneId,
    e164: "+18885046264",
    workspaceId: fx.platformOwnerId,
    provider: "twilio" as const,
  };

  try {
    // A — sequential reuse
    let c1 = await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    assert.equal(c1.status, "CLAIMED");
    await releasePlatformSenderAssignment({
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
      workspaceId: fx.wsA,
      releaseReason: "RESOLVED",
    });
    const c2 = await claimPlatformSenderAssignment({
      workspaceId: fx.wsB,
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    assert.equal(c2.status, "CLAIMED");
    console.log("PASS A sequential reuse");

    await releasePlatformSenderAssignment({
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
      workspaceId: fx.wsB,
      releaseReason: "ADMIN_RELEASE",
    });

    // B — same workspace reuse
    const r1 = await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    const r2 = await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    assert.equal(r1.status, "CLAIMED");
    assert.equal(r2.status, "REUSED");
    assert.equal(r1.assignmentId, r2.assignmentId);
    const activeCount = await getPrisma().mctbPlatformSenderAssignment.count({
      where: { consumerE164: CONSUMER, platformPhoneNumberId: fx.platformPhoneId, state: "ACTIVE" },
    });
    assert.equal(activeCount, 1);
    console.log("PASS B same-workspace reuse");

    // C — concurrent collision
    await releasePlatformSenderAssignment({
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
      workspaceId: fx.wsA,
      releaseReason: "ADMIN_RELEASE",
    });
    await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    const collision = await claimPlatformSenderAssignment({
      workspaceId: fx.wsB,
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    assert.equal(collision.status, "COLLISION");
    console.log("PASS C concurrent collision");

    // D — atomic race
    await releasePlatformSenderAssignment({
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
      releaseReason: "ADMIN_RELEASE",
    });
    const racers = await Promise.all(
      Array.from({ length: 24 }, (_, i) =>
        claimPlatformSenderAssignment({
          workspaceId: i % 2 === 0 ? fx.wsA : fx.wsB,
          consumerE164: `+1555099${String(1000 + i).slice(-4)}`,
          platformPhoneNumberId: fx.platformPhoneId,
        }),
      ),
    );
    for (const r of racers) {
      assert.ok(r.status === "CLAIMED" || r.status === "REUSED");
    }

    const raceConsumer = "+15550991000";
    await Promise.all([
      claimPlatformSenderAssignment({
        workspaceId: fx.wsA,
        consumerE164: raceConsumer,
        platformPhoneNumberId: fx.platformPhoneId,
      }),
      claimPlatformSenderAssignment({
        workspaceId: fx.wsB,
        consumerE164: raceConsumer,
        platformPhoneNumberId: fx.platformPhoneId,
      }),
      claimPlatformSenderAssignment({
        workspaceId: fx.wsA,
        consumerE164: raceConsumer,
        platformPhoneNumberId: fx.platformPhoneId,
      }),
    ]);
    const raceActive = await getPrisma().mctbPlatformSenderAssignment.count({
      where: {
        consumerE164: raceConsumer,
        platformPhoneNumberId: fx.platformPhoneId,
        state: "ACTIVE",
      },
    });
    assert.equal(raceActive, 1);
    console.log("PASS D atomic race");

    // F — legacy ambiguous
    const amb = resolvePlatformInboundReplyFromContexts([
      { workspaceId: fx.wsA, conversationId: null, lastOutboundAt: new Date() },
      { workspaceId: fx.wsB, conversationId: null, lastOutboundAt: new Date() },
    ]);
    assert.equal(amb.status, "AMBIGUOUS");
    console.log("PASS F legacy ambiguous");

    // G — released owner
    await releasePlatformSenderAssignment({
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
      workspaceId: fx.wsA,
      releaseReason: "RESOLVED",
    });
    const g = await claimPlatformSenderAssignment({
      workspaceId: fx.wsB,
      consumerE164: CONSUMER,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    assert.equal(g.status, "CLAIMED");
    console.log("PASS G released owner");

    // H — idle expiration
    const prisma = getPrisma();
    const idleConsumer = "+15550992000";
    const idleClaim = await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: idleConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    assert.equal(idleClaim.status, "CLAIMED");
    await prisma.mctbPlatformSenderAssignment.update({
      where: { id: idleClaim.assignmentId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const afterIdle = await claimPlatformSenderAssignment({
      workspaceId: fx.wsB,
      consumerE164: idleConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    assert.equal(afterIdle.status, "CLAIMED");
    const old = await prisma.mctbPlatformSenderAssignment.findUnique({
      where: { id: idleClaim.assignmentId },
    });
    assert.equal(old?.state, "RELEASED");
    assert.equal(old?.releaseReason, "IDLE_TIMEOUT");
    console.log("PASS H idle expiration");

    // I — STOP release path (function)
    const stopConsumer = "+15550993000";
    await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: stopConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    await releasePlatformSenderAssignment({
      consumerE164: stopConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
      releaseReason: "OPT_OUT",
    });
    const postStop = await findActivePlatformSenderAssignment({
      consumerE164: stopConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    assert.equal(postStop, null);
    console.log("PASS I STOP release");

    // J — inbound active assignment
    const inboundConsumer = "+15550994000";
    await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: inboundConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    const inbound = await resolvePlatformMctbInboundReplyWithAssignment({
      platformSender,
      consumerE164: inboundConsumer,
    });
    assert.equal(inbound.status, "RESOLVED");
    assert.equal(inbound.workspaceId, fx.wsA);
    assert.equal(inbound.resolutionSource, "ACTIVE_ASSIGNMENT");
    console.log("PASS J platform owner separation / active inbound");

    // E — legacy unique fallback + lazy assignment (missed-call evidence breadcrumb)
    const legacyConsumer = "+15550995000";
    await prisma.contact.create({
      data: { workspaceId: fx.wsA, phone: legacyConsumer, name: "Legacy A" },
    });
    await prisma.missedCallEvent.create({
      data: {
        workspaceId: fx.wsA,
        callerE164: legacyConsumer,
        businessE164: "+15550001111",
        reason: "no_answer",
        traceId: `legacy-e-${fx.token}`,
        idempotencyKey: `legacy-e-${fx.token}`,
        smsSentAt: new Date(),
        metadata: {
          outboundSmsPhoneNumberId: fx.platformPhoneId,
          outboundSmsFromE164: "+18885046264",
        },
      },
    });
    const legacyInbound = await resolvePlatformMctbInboundReplyWithAssignment({
      platformSender,
      consumerE164: legacyConsumer,
    });
    assert.equal(legacyInbound.status, "RESOLVED");
    assert.equal(legacyInbound.workspaceId, fx.wsA);
    assert.ok(
      legacyInbound.resolutionSource === "LEGACY_LAZY_ASSIGNMENT" ||
        legacyInbound.resolutionSource === "LEGACY_EVIDENCE",
    );
    const lazyActive = await findActivePlatformSenderAssignment({
      consumerE164: legacyConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    if (legacyInbound.resolutionSource === "LEGACY_LAZY_ASSIGNMENT") {
      assert.equal(lazyActive?.workspaceId, fx.wsA);
    }
    console.log("PASS E legacy unique fallback", legacyInbound.resolutionSource);

    // K — tenant Brain propagation = assignment workspace (not platform owner)
    const kConsumerA = "+15550996001";
    const kConsumerB = "+15550996002";
    await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: kConsumerA,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    await claimPlatformSenderAssignment({
      workspaceId: fx.wsB,
      consumerE164: kConsumerB,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    const kInboundA = await resolvePlatformMctbInboundReplyWithAssignment({
      platformSender,
      consumerE164: kConsumerA,
    });
    const kInboundB = await resolvePlatformMctbInboundReplyWithAssignment({
      platformSender,
      consumerE164: kConsumerB,
    });
    assert.equal(kInboundA.workspaceId, fx.wsA);
    assert.equal(kInboundB.workspaceId, fx.wsB);
    assert.notEqual(kInboundA.workspaceId, fx.platformOwnerId);
    assert.notEqual(kInboundB.workspaceId, fx.platformOwnerId);
    console.log("PASS K tenant workspace propagation (not platform owner)");

    // L — historical RELEASED rows do not affect ACTIVE inbound
    const histConsumer = "+15550997000";
    const h1 = await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: histConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    await releasePlatformSenderAssignment({
      consumerE164: histConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
      workspaceId: fx.wsA,
      releaseReason: "RESOLVED",
    });
    await claimPlatformSenderAssignment({
      workspaceId: fx.wsB,
      consumerE164: histConsumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });
    const histRows = await prisma.mctbPlatformSenderAssignment.count({
      where: { consumerE164: histConsumer, platformPhoneNumberId: fx.platformPhoneId },
    });
    assert.ok(histRows >= 2);
    const histInbound = await resolvePlatformMctbInboundReplyWithAssignment({
      platformSender,
      consumerE164: histConsumer,
    });
    assert.equal(histInbound.workspaceId, fx.wsB);
    assert.equal(histInbound.resolutionSource, "ACTIVE_ASSIGNMENT");
    const histReleased = await prisma.mctbPlatformSenderAssignment.findUnique({
      where: { id: h1.assignmentId! },
    });
    assert.equal(histReleased?.state, "RELEASED");
    console.log("PASS L historical assignments");

    console.log("\nALL PLATFORM SENDER ASSIGNMENT TESTS PASS");
    console.log("IDLE_MS", MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS);
  } finally {
    await teardown(fx);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
