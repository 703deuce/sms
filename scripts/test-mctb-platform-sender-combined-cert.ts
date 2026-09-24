#!/usr/bin/env tsx
/**
 * Combined-stack certification helpers for PR #504 + tenant remediation.
 * Run on the combined deploy candidate branch only.
 *
 *   npx tsx scripts/test-mctb-platform-sender-combined-cert.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getPrisma } from "../src/lib/db";
import {
  claimPlatformSenderAssignment,
  findActivePlatformSenderAssignment,
  releasePlatformSenderAssignment,
  resolvePlatformMctbInboundReplyWithAssignment,
  resolvePlatformInboundReplyFromContexts,
  touchPlatformSenderAssignment,
  MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS,
} from "../src/lib/mctb/messaging/platform-sender-assignment";
import { gateMctbPlatformOutboundSend } from "../src/lib/mctb/messaging/platform-outbound-gate";
import type { MctbOutboundSmsRoute } from "../src/lib/mctb/messaging/outbound-sms-route";

async function setupPair() {
  const prisma = getPrisma();
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const platformOwner = await prisma.workspace.create({
    data: { name: "Combined Cert Platform", slug: `ccp-${token}` },
  });
  const wsA = await prisma.workspace.create({
    data: { name: "Combined A", slug: `cca-${token}` },
  });
  const wsB = await prisma.workspace.create({
    data: { name: "Combined B", slug: `ccb-${token}` },
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
    platformSender: {
      phoneNumberId: platformPhone.id,
      e164: "+18885046264",
      workspaceId: platformOwner.id,
      provider: "twilio" as const,
    },
  };
}

async function teardown(ids: { platformOwnerId: string; wsA: string; wsB: string }) {
  const prisma = getPrisma();
  await prisma.workspace.delete({ where: { id: ids.wsA } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ids.wsB } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ids.platformOwnerId } }).catch(() => undefined);
}

function platformRoute(phoneNumberId: string, wsA: string): MctbOutboundSmsRoute {
  return {
    customerWorkspaceId: wsA,
    sendWorkspaceId: "platform-owner-ws",
    senderMode: "PLATFORM",
    fromE164: "+18885046264",
    phoneNumberId,
    provider: "twilio",
    source: "platform_mctb_sender",
    complianceRegime: "TOLL_FREE_VERIFICATION",
    trafficMode: "CUSTOMER_PRODUCTION",
  };
}

function workspaceRoute(phoneNumberId: string, ws: string): MctbOutboundSmsRoute {
  return {
    customerWorkspaceId: ws,
    sendWorkspaceId: ws,
    senderMode: "WORKSPACE",
    fromE164: "+15551234567",
    phoneNumberId,
    provider: "twilio",
    source: "workspace_owned",
    complianceRegime: "A2P_10DLC",
    trafficMode: "CUSTOMER_PRODUCTION",
  };
}

/** M — release / inbound / reclaim race (no sleeps, no LLM). */
async function testReleaseInboundReclaimRace(fx: Awaited<ReturnType<typeof setupPair>>) {
  const prisma = getPrisma();
  const iterations = 48;
  let violations = 0;

  for (let i = 0; i < iterations; i++) {
    const consumer = `+1555088${String(1000 + i).slice(-4)}`;
    await prisma.contact.create({
      data: { workspaceId: fx.wsA, phone: consumer, name: "Race A" },
    });
    await prisma.missedCallEvent.create({
      data: {
        workspaceId: fx.wsA,
        callerE164: consumer,
        businessE164: "+15550001111",
        reason: "no_answer",
        traceId: `race-${fx.token}-${i}`,
        idempotencyKey: `race-${fx.token}-${i}`,
        smsSentAt: new Date(),
        metadata: {
          outboundSmsPhoneNumberId: fx.platformPhoneId,
          outboundSmsFromE164: "+18885046264",
        },
      },
    });

    await claimPlatformSenderAssignment({
      workspaceId: fx.wsA,
      consumerE164: consumer,
      platformPhoneNumberId: fx.platformPhoneId,
    });

    const [releaseResult, inboundResult, claimB] = await Promise.all([
      releasePlatformSenderAssignment({
        consumerE164: consumer,
        platformPhoneNumberId: fx.platformPhoneId,
        workspaceId: fx.wsA,
        releaseReason: "RESOLVED",
      }),
      resolvePlatformMctbInboundReplyWithAssignment({
        platformSender: fx.platformSender,
        consumerE164: consumer,
      }),
      claimPlatformSenderAssignment({
        workspaceId: fx.wsB,
        consumerE164: consumer,
        platformPhoneNumberId: fx.platformPhoneId,
      }),
    ]);

    void releaseResult;

    if (inboundResult.status === "RESOLVED") {
      const ws = inboundResult.workspaceId;
      if (ws === fx.wsB) {
        const active = await findActivePlatformSenderAssignment({
          consumerE164: consumer,
          platformPhoneNumberId: fx.platformPhoneId,
        });
        const legacyOnlyA =
          resolvePlatformInboundReplyFromContexts([
            {
              workspaceId: fx.wsA,
              conversationId: null,
              lastOutboundAt: new Date(),
            },
          ]).status === "RESOLVED";
        if (active?.workspaceId === fx.wsB && legacyOnlyA) {
          violations++;
        }
        if (claimB.status === "COLLISION" && ws === fx.wsB) {
          violations++;
        }
      }
      if (ws !== fx.wsA && ws !== fx.wsB) violations++;
    }

    await prisma.mctbPlatformSenderAssignment.deleteMany({
      where: { consumerE164: consumer, platformPhoneNumberId: fx.platformPhoneId },
    });
    await prisma.missedCallEvent.deleteMany({ where: { idempotencyKey: `race-${fx.token}-${i}` } });
    await prisma.contact.deleteMany({ where: { workspaceId: fx.wsA, phone: consumer } });
  }

  assert.equal(violations, 0, `inbound routed to wrong tenant in ${violations} race iterations`);
  console.log("PASS M release/inbound/reclaim race", { iterations });
}

/** Pre-send collision at outbound integration boundary (gate before provider). */
async function testCollisionPreSendBoundary(fx: Awaited<ReturnType<typeof setupPair>>) {
  const consumer = `+1555077${fx.token.slice(-4)}`;
  await claimPlatformSenderAssignment({
    workspaceId: fx.wsA,
    consumerE164: consumer,
    platformPhoneNumberId: fx.platformPhoneId,
  });

  const routeB = platformRoute(fx.platformPhoneId, fx.wsB);
  const gate = await gateMctbPlatformOutboundSend({
    workspaceId: fx.wsB,
    route: routeB,
    consumerE164: consumer,
  });
  assert.equal(gate.ok, false);
  if (gate.ok) throw new Error("expected collision");
  assert.equal(gate.reason, "PLATFORM_SENDER_PAIR_COLLISION");

  const active = await findActivePlatformSenderAssignment({
    consumerE164: consumer,
    platformPhoneNumberId: fx.platformPhoneId,
  });
  assert.equal(active?.workspaceId, fx.wsA);

  const sendSrc = readFileSync("src/lib/agents/missed-call-text-back/send.ts", "utf8");
  const gateMarker = "gateMctbPlatformOutboundSend";
  const collisionReturn = 'reason: "PLATFORM_SENDER_PAIR_COLLISION"';
  const providerCall = "sendQuickSms({";
  const gateIdx = sendSrc.indexOf(gateMarker);
  const collisionIdx = sendSrc.indexOf(collisionReturn, gateIdx);
  const providerIdx = sendSrc.indexOf(providerCall, gateIdx);
  assert.ok(gateIdx >= 0 && collisionIdx > gateIdx && providerIdx > collisionIdx);

  const jobSrc = readFileSync("src/lib/mctb/messaging/send-customer-sms-job.ts", "utf8");
  const jobGate = jobSrc.indexOf("gateMctbPlatformOutboundSend");
  const jobThrow = jobSrc.indexOf("PLATFORM_SENDER_PAIR_COLLISION", jobGate);
  const jobSend = jobSrc.indexOf("sendQuickSms({", jobGate);
  assert.ok(jobGate >= 0 && jobThrow > jobGate && jobSend > jobThrow);

  console.log("PASS collision pre-send boundary (gate blocks before sendQuickSms in send + job)");
}

/** Legacy deploy compatibility without assignment rows. */
async function testLegacyDeployCompatibility(fx: Awaited<ReturnType<typeof setupPair>>) {
  const prisma = getPrisma();
  const uniqueConsumer = `+1555066${fx.token.slice(-4)}`;
  const ambConsumer = `+1555067${fx.token.slice(-4)}`;

  await prisma.contact.create({
    data: { workspaceId: fx.wsA, phone: uniqueConsumer, name: "Legacy U" },
  });
  await prisma.missedCallEvent.create({
    data: {
      workspaceId: fx.wsA,
      callerE164: uniqueConsumer,
      businessE164: "+15550002222",
      reason: "no_answer",
      traceId: `leg-u-${fx.token}`,
      idempotencyKey: `leg-u-${fx.token}`,
      smsSentAt: new Date(),
      metadata: {
        outboundSmsPhoneNumberId: fx.platformPhoneId,
        outboundSmsFromE164: "+18885046264",
      },
    },
  });
  const unique = await resolvePlatformMctbInboundReplyWithAssignment({
    platformSender: fx.platformSender,
    consumerE164: uniqueConsumer,
  });
  assert.equal(unique.status, "RESOLVED");
  assert.equal(unique.workspaceId, fx.wsA);

  await prisma.contact.create({
    data: { workspaceId: fx.wsA, phone: ambConsumer, name: "Amb A" },
  });
  await prisma.contact.create({
    data: { workspaceId: fx.wsB, phone: ambConsumer, name: "Amb B" },
  });
  await prisma.missedCallEvent.create({
    data: {
      workspaceId: fx.wsA,
      callerE164: ambConsumer,
      businessE164: "+15550003333",
      reason: "no_answer",
      traceId: `leg-a-${fx.token}`,
      idempotencyKey: `leg-a-${fx.token}`,
      smsSentAt: new Date(),
      metadata: {
        outboundSmsPhoneNumberId: fx.platformPhoneId,
        outboundSmsFromE164: "+18885046264",
      },
    },
  });
  await prisma.missedCallEvent.create({
    data: {
      workspaceId: fx.wsB,
      callerE164: ambConsumer,
      businessE164: "+15550004444",
      reason: "no_answer",
      traceId: `leg-b-${fx.token}`,
      idempotencyKey: `leg-b-${fx.token}`,
      smsSentAt: new Date(),
      metadata: {
        outboundSmsPhoneNumberId: fx.platformPhoneId,
        outboundSmsFromE164: "+18885046264",
      },
    },
  });
  const amb = await resolvePlatformMctbInboundReplyWithAssignment({
    platformSender: fx.platformSender,
    consumerE164: ambConsumer,
  });
  assert.equal(amb.status, "AMBIGUOUS");

  const unmatched = await resolvePlatformMctbInboundReplyWithAssignment({
    platformSender: fx.platformSender,
    consumerE164: `+15550999999`,
  });
  assert.equal(unmatched.status, "UNMATCHED");

  const assignCount = await prisma.mctbPlatformSenderAssignment.count({
    where: { consumerE164: ambConsumer },
  });
  assert.equal(assignCount, 0);

  console.log("PASS legacy deploy compatibility");
}

/** 72h lifecycle policy — single constant, touch on activity, explicit release wins. */
async function test72HourLifecycle(fx: Awaited<ReturnType<typeof setupPair>>) {
  const prisma = getPrisma();
  assert.equal(MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS, 72 * 60 * 60 * 1000);

  const idleSrc = readFileSync("src/lib/mctb/messaging/platform-sender-assignment.ts", "utf8");
  assert.ok(idleSrc.includes("MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS"));
  assert.ok(!idleSrc.includes("MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS"));

  const consumer = `+1555055${fx.token.slice(-4)}`;
  const claimed = await claimPlatformSenderAssignment({
    workspaceId: fx.wsA,
    consumerE164: consumer,
    platformPhoneNumberId: fx.platformPhoneId,
  });
  assert.equal(claimed.status, "CLAIMED");
  const before = await prisma.mctbPlatformSenderAssignment.findUnique({
    where: { id: claimed.assignmentId },
  });
  const expiresBefore = before?.expiresAt?.getTime() ?? 0;

  await findActivePlatformSenderAssignment({
    consumerE164: consumer,
    platformPhoneNumberId: fx.platformPhoneId,
  });
  const afterRead = await prisma.mctbPlatformSenderAssignment.findUnique({
    where: { id: claimed.assignmentId },
  });
  assert.equal(afterRead?.lastUsedAt?.getTime(), before?.lastUsedAt?.getTime());

  await touchPlatformSenderAssignment({
    assignmentId: claimed.assignmentId,
    workspaceId: fx.wsA,
    consumerE164: consumer,
    platformPhoneNumberId: fx.platformPhoneId,
  });
  const afterTouch = await prisma.mctbPlatformSenderAssignment.findUnique({
    where: { id: claimed.assignmentId },
  });
  assert.ok((afterTouch?.expiresAt?.getTime() ?? 0) >= expiresBefore);
  assert.ok((afterTouch?.lastUsedAt?.getTime() ?? 0) >= (before?.lastUsedAt?.getTime() ?? 0));

  await prisma.mctbPlatformSenderAssignment.update({
    where: { id: claimed.assignmentId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await releasePlatformSenderAssignment({
    consumerE164: consumer,
    platformPhoneNumberId: fx.platformPhoneId,
    workspaceId: fx.wsA,
    releaseReason: "HANDOFF_COMPLETE",
  });
  const released = await prisma.mctbPlatformSenderAssignment.findUnique({
    where: { id: claimed.assignmentId },
  });
  assert.equal(released?.state, "RELEASED");
  assert.equal(released?.releaseReason, "HANDOFF_COMPLETE");

  console.log("PASS 72h lifecycle policy");
}

async function testWorkspaceSenderUnchanged(fx: Awaited<ReturnType<typeof setupPair>>) {
  const wsPhone = await getPrisma().phoneNumber.create({
    data: {
      workspaceId: fx.wsA,
      e164: `+1555044${fx.token.slice(-4)}`,
      type: "local",
      provider: "twilio",
    },
  });
  const gate = await gateMctbPlatformOutboundSend({
    workspaceId: fx.wsA,
    route: workspaceRoute(wsPhone.id, fx.wsA),
    consumerE164: "+15550101010",
  });
  assert.equal(gate.ok, true);
  assert.equal(gate.claim.status, "NOT_PLATFORM");
  console.log("PASS WORKSPACE sender unchanged");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const fx = await setupPair();
  try {
    await testReleaseInboundReclaimRace(fx);
    await testCollisionPreSendBoundary(fx);
    await testLegacyDeployCompatibility(fx);
    await test72HourLifecycle(fx);
    await testWorkspaceSenderUnchanged(fx);
    console.log("\nALL COMBINED CERT HELPERS PASS");
  } finally {
    await teardown(fx);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
