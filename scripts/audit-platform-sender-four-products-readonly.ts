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
const HOURS = Number(process.env.SAMPLE_HOURS?.trim() || "48");
const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

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

  console.log("\n=== Tenant scope:", WORKSPACE_ID, `(since ${since.toISOString()}) ===`);

  const massMsgs = await prisma.message.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
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
  const campaignWsMismatch = campaigns.filter((c) => c.workspaceId !== WORKSPACE_ID);

  const wrongWorkspaceMass = await prisma.message.count({
    where: {
      workspaceId: { not: WORKSPACE_ID },
      from: platformFrom,
      createdAt: { gte: since },
      OR: [
        { campaignId: { in: campaigns.map((c) => c.id) } },
        // quick heuristic: same body prefix as ws_1 mass cert — skip
      ],
    },
  });

  console.log("\n--- Mass / quick SMS (Message table, platform FROM) ---");
  console.log({
    totalPlatformFrom: massMsgs.length,
    withCampaignId: withCampaign.length,
    withoutCampaignId: withoutCampaign.length,
    campaignRowsWrongWorkspace: campaignWsMismatch.length,
  });

  const mctbTraces = await prisma.missedCallEvent.count({
    where: { workspaceId: WORKSPACE_ID, createdAt: { gte: since } },
  });
  const mctbSms = await prisma.missedCallEvent.count({
    where: {
      workspaceId: WORKSPACE_ID,
      smsSentAt: { not: null },
      createdAt: { gte: since },
    },
  });

  console.log("\n--- MCTB (missed call events) ---");
  console.log({ missedCalls: mctbTraces, withRecoverySms: mctbSms });

  const arDispatches = await prisma.arReminderDispatch.count({
    where: { workspaceId: WORKSPACE_ID, createdAt: { gte: since } },
  }).catch(() => null);

  console.log("\n--- Appointment reminders ---");
  console.log({
    reminderDispatches: arDispatches ?? "(model unavailable in compat)",
  });

  const sb = createServiceClient();
  const { data: reviewSends, error: rsErr } = await sb
    .from("review_request_sends")
    .select("id, business_id, recipient_phone, status, created_at")
    .eq("business_id", WORKSPACE_ID)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: reviewSendsOtherWs } = await sb
    .from("review_request_sends")
    .select("id, business_id")
    .neq("business_id", WORKSPACE_ID)
    .gte("created_at", since.toISOString())
    .limit(5);

  console.log("\n--- Review requests ---");
  console.log({
    reviewSendsForWorkspace: reviewSends?.length ?? 0,
    reviewSendsQueryError: rsErr?.message ?? null,
    sampleOtherBusinessIds: (reviewSendsOtherWs ?? []).map((r) => r.business_id),
  });

  const assignments = await prisma.mctbPlatformSenderAssignment.count({
    where: { workspaceId: WORKSPACE_ID, state: "ACTIVE" },
  });
  const productAssignments = await prisma.platformProductConsumerAssignment.count({
    where: { workspaceId: WORKSPACE_ID },
  });

  console.log("\n--- Inbound routing maps (platform number → workspace) ---");
  console.log({
    activeMctbPlatformAssignments: assignments,
    platformProductConsumerAssignments: productAssignments,
  });

  const leakCheck = await prisma.message.findFirst({
    where: {
      campaignId: { in: campaigns.map((c) => c.id) },
      workspaceId: { not: WORKSPACE_ID },
    },
    select: { id: true, workspaceId: true, campaignId: true },
  });

  console.log("\n=== Isolation checks ===");
  const ok =
    campaignWsMismatch.length === 0 &&
    !leakCheck &&
    Boolean(platform?.e164);
  console.log({
    campaignsBelongToWorkspace: campaignWsMismatch.length === 0,
    noMessageLeakAcrossWorkspaceForThoseCampaigns: !leakCheck,
    platformSenderResolved: Boolean(platform?.e164),
    overall: ok ? "PASS" : "NEEDS_REVIEW",
  });

  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
