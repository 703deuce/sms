#!/usr/bin/env node
/**
 * Read-only: platform sender + per-workspace isolation for MCTB, AR, mass text, reviews.
 * Does not enqueue or send SMS.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/audit-platform-sender-four-products-readonly.ts
 *
 * Env: WORKSPACE_ID (default ws_1), SAMPLE_HOURS (default 48)
 */
import { getPrisma } from "../src/lib/db";
import { createServiceClient } from "../src/lib/db/client";
import { resolveCanonicalMctbPlatformSender } from "../src/lib/mctb/messaging/platform-sender-config";
import { resolveSharedPlatformOutboundSender } from "../src/lib/messaging/platform-outbound-sender";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const SECOND_WORKSPACE_ID = process.env.SECOND_WORKSPACE_ID?.trim() || "";
const HOURS = Number(process.env.SAMPLE_HOURS?.trim() || "48");
const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

async function auditWorkspace(
  prisma: ReturnType<typeof getPrisma>,
  platformFrom: string,
  platformPhoneNumberId: string,
  platformOwnerWorkspaceId: string,
  workspaceId: string,
) {
  console.log("\n=== Tenant scope:", workspaceId, `(since ${since.toISOString()}) ===`);

  const massMsgs = await prisma.message.findMany({
    where: {
      workspaceId,
      createdAt: { gte: since },
      from: platformFrom,
    },
    select: {
      id: true,
      to: true,
      status: true,
      campaignId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const withCampaign = massMsgs.filter((m) => m.campaignId);
  const withoutCampaign = massMsgs.filter((m) => !m.campaignId);

  const campaigns = withCampaign.length
    ? await prisma.campaign.findMany({
        where: { id: { in: [...new Set(withCampaign.map((m) => m.campaignId!))] } },
        select: { id: true, name: true, workspaceId: true },
      })
    : [];
  const campaignWsMismatch = campaigns.filter((c) => c.workspaceId !== workspaceId);

  console.log("\n--- Mass / quick SMS (Message table, platform FROM) ---");
  console.log({
    totalPlatformFrom: massMsgs.length,
    withCampaignId: withCampaign.length,
    withoutCampaignId: withoutCampaign.length,
    campaignRowsWrongWorkspace: campaignWsMismatch.length,
  });

  const mctbTraces = await prisma.missedCallEvent.count({
    where: { workspaceId, createdAt: { gte: since } },
  });
  const mctbSms = await prisma.missedCallEvent.count({
    where: {
      workspaceId,
      smsSentAt: { not: null },
      createdAt: { gte: since },
    },
  });

  console.log("\n--- MCTB (missed call events) ---");
  console.log({ missedCalls: mctbTraces, withRecoverySms: mctbSms });

  const arDispatches = await prisma.arReminderDispatch.count({
    where: { workspaceId, createdAt: { gte: since } },
  }).catch(() => null);

  const arRecent = await prisma.arReminderDispatch.findMany({
    where: { workspaceId, createdAt: { gte: since } },
    select: { id: true, status: true, channel: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  }).catch(() => []);

  console.log("\n--- Appointment reminders ---");
  console.log({
    reminderDispatches: arDispatches ?? "(model unavailable in compat)",
    recentSamples: arRecent,
  });

  const sb = createServiceClient();
  const { data: reviewSends, error: rsErr } = await sb
    .from("review_request_sends")
    .select("id, business_id, recipient_phone, status, created_at")
    .eq("business_id", workspaceId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  console.log("\n--- Review requests ---");
  console.log({
    reviewSendsForWorkspace: reviewSends?.length ?? 0,
    reviewSendsQueryError: rsErr?.message ?? null,
  });

  const assignments = await prisma.mctbPlatformSenderAssignment.count({
    where: { workspaceId, state: "ACTIVE" },
  });
  const productAssignments = await prisma.platformProductConsumerAssignment.count({
    where: { workspaceId },
  });

  console.log("\n--- Inbound routing maps (platform number → workspace) ---");
  console.log({
    activeMctbPlatformAssignments: assignments,
    platformProductConsumerAssignments: productAssignments,
  });

  const leakCheck = await prisma.message.findFirst({
    where: {
      campaignId: { in: campaigns.map((c) => c.id) },
      workspaceId: { not: workspaceId },
    },
    select: { id: true, workspaceId: true, campaignId: true },
  });

  const platformStopRows = await prisma.suppression.count({
    where: {
      workspaceId: platformOwnerWorkspaceId,
      suppressionKey: { startsWith: `mctb_platform_sender:${platformPhoneNumberId}:` },
      reason: { in: ["STOP", "OPT_OUT"] },
    },
  });

  const workspaceStopRows = await prisma.suppression.count({
    where: { workspaceId, reason: { in: ["STOP", "OPT_OUT"] } },
  });

  console.log("\n--- STOP records (read-only counts) ---");
  console.log({
    senderWidePlatformKeysOnOwnerWorkspace: platformStopRows,
    workspaceScopedStopRows: workspaceStopRows,
  });

  console.log("\n=== Isolation checks:", workspaceId, "===");
  const ok = campaignWsMismatch.length === 0 && !leakCheck;
  console.log({
    campaignsBelongToWorkspace: campaignWsMismatch.length === 0,
    noMessageLeakAcrossWorkspaceForThoseCampaigns: !leakCheck,
    overall: ok ? "PASS" : "NEEDS_REVIEW",
  });
  return ok;
}

async function main() {
  const prisma = getPrisma();
  const platform = await resolveCanonicalMctbPlatformSender();
  const shared = await resolveSharedPlatformOutboundSender();

  console.log("=== Platform sender (shared infrastructure) ===");
  console.log({
    canonical: platform,
    sharedRoute: shared,
    match:
      platform?.e164 === shared?.fromE164 &&
      platform?.phoneNumberId === shared?.phoneNumberId,
  });

  if (!platform?.e164) {
    console.error("FAIL: no canonical platform sender configured");
    process.exit(1);
  }

  const platformFrom = platform.e164;

  let secondWs = SECOND_WORKSPACE_ID;
  if (!secondWs) {
    const grouped = await prisma.message.groupBy({
      by: ["workspaceId"],
      where: { createdAt: { gte: since }, from: platformFrom },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });
    secondWs =
      grouped.find((g) => g.workspaceId !== WORKSPACE_ID)?.workspaceId ?? "";
    console.log("\n--- Auto-selected comparison workspaces from platform FROM traffic ---");
    console.log(grouped.map((g) => ({ workspaceId: g.workspaceId, count: g._count.id })));
  }

  const primaryOk = await auditWorkspace(
    prisma,
    platformFrom,
    platform.phoneNumberId,
    platform.workspaceId,
    WORKSPACE_ID,
  );
  let secondaryOk = true;
  if (secondWs && secondWs !== WORKSPACE_ID) {
    secondaryOk = await auditWorkspace(
      prisma,
      platformFrom,
      platform.phoneNumberId,
      platform.workspaceId,
      secondWs,
    );
  } else {
    console.log("\n(No second workspace with platform FROM traffic in window — set SECOND_WORKSPACE_ID)");
  }

  console.log("\n=== Overall ===", {
    primaryOk,
    secondaryOk,
    result: primaryOk && secondaryOk ? "PASS" : "NEEDS_REVIEW",
  });

  if (!primaryOk || !secondaryOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
