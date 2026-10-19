#!/usr/bin/env npx tsx
/**
 * Fresh start: remove all workspace-scoped application data; keep DB schema.
 * Preserves canonical Telnyx platform MCTB sender phone row(s) on a dedicated infra workspace.
 *
 * Dry run (default):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/fresh-start-wipe-tenant-data.ts
 *
 * Execute (irreversible without backup restore):
 *   EXECUTE=1 FRESH_START_CONFIRM=DELETE_ALL_WORKSPACE_DATA \
 *     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/operations/fresh-start-wipe-tenant-data.ts
 */
import { getPrisma } from "@/lib/db";
import { isPlatformMctbSenderPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";
import type { Prisma } from "@prisma/client";

const EXECUTE = process.env.EXECUTE === "1";
const CONFIRM = process.env.FRESH_START_CONFIRM === "DELETE_ALL_WORKSPACE_DATA";
const DELETE_ORPHAN_USERS = process.env.DELETE_ORPHAN_USERS === "1";
const PRESERVE_PLATFORM_SENDERS =
  process.env.PRESERVE_PLATFORM_SENDERS !== "0";
const PLATFORM_ONLY_TELNYX = process.env.PLATFORM_ONLY_TELNYX !== "0";
const WIPE_PROVIDER_WEBHOOK_EVENTS =
  process.env.WIPE_PROVIDER_WEBHOOK_EVENTS !== "0";

const PLATFORM_WORKSPACE_SLUG = "transovo-platform-infra";
const PLATFORM_WORKSPACE_NAME = "Transovo Platform Infrastructure";

type PreservedPhone = Prisma.PhoneNumberGetPayload<{
  select: {
    id: true;
    e164: true;
    type: true;
    areaCode: true;
    friendlyName: true;
    provider: true;
    twilioSid: true;
    providerNumberId: true;
    providerOrderId: true;
    a2pStatus: true;
    messagingService: true;
    monthlyCostCents: true;
    status: true;
    purchasedAt: true;
    releasedAt: true;
    voiceForwardTo: true;
    webhookUrl: true;
    capabilitiesJson: true;
    settingsJson: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

function isPreservedPlatformRow(row: {
  provider: string | null;
  settingsJson: unknown;
}): boolean {
  if (!isPlatformMctbSenderPhoneRecord({ settingsJson: row.settingsJson })) {
    return false;
  }
  if (!PLATFORM_ONLY_TELNYX) return true;
  return String(row.provider || "").toLowerCase() === "telnyx";
}

async function loadPlatformPhonesToPreserve(): Promise<PreservedPhone[]> {
  const prisma = getPrisma();
  const rows = await prisma.phoneNumber.findMany({
    where: { status: "Active" },
    select: {
      id: true,
      e164: true,
      type: true,
      areaCode: true,
      friendlyName: true,
      provider: true,
      twilioSid: true,
      providerNumberId: true,
      providerOrderId: true,
      a2pStatus: true,
      messagingService: true,
      monthlyCostCents: true,
      status: true,
      purchasedAt: true,
      releasedAt: true,
      voiceForwardTo: true,
      webhookUrl: true,
      capabilitiesJson: true,
      settingsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.filter(isPreservedPlatformRow);
}

async function main() {
  const prisma = getPrisma();

  const [dbSize] = await prisma.$queryRaw<{ db_size: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
  `;

  const platformToPreserve = PRESERVE_PLATFORM_SENDERS
    ? await loadPlatformPhonesToPreserve()
    : [];

  const before = {
    dbSize: dbSize?.db_size ?? "unknown",
    workspaces: await prisma.workspace.count(),
    users: await prisma.user.count(),
    memberships: await prisma.membership.count(),
    phoneNumbers: await prisma.phoneNumber.count(),
    missedCallEvents: await prisma.missedCallEvent.count(),
    conversations: await prisma.conversation.count(),
    jobQueue: await prisma.jobQueue.count(),
    jobQueuePending: await prisma.jobQueue.count({
      where: { status: { in: ["pending", "deferred", "processing"] } },
    }),
    solutionSetups: await prisma.solutionSetup.count(),
    providerWebhookEvents: await prisma.providerWebhookEvent.count(),
    platformSendersToPreserve: platformToPreserve.map((p) => ({
      id: p.id,
      e164: p.e164,
      provider: p.provider,
    })),
  };

  const workspaceSample = await prisma.workspace.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  console.log(
    JSON.stringify(
      {
        event: "fresh_start_plan",
        mode: EXECUTE ? "execute" : "dry_run",
        before,
        workspaceSample,
        actions: {
          deleteAllWorkspaces: true,
          wipeEntireJobQueue: true,
          wipeProviderWebhookEvents: WIPE_PROVIDER_WEBHOOK_EVENTS,
          preservePlatformSenders: PRESERVE_PLATFORM_SENDERS,
          platformOnlyTelnyx: PLATFORM_ONLY_TELNYX,
          deleteOrphanUsers: DELETE_ORPHAN_USERS,
        },
        doc: "docs/NEW-APP-DATABASE-FRESH-START.md",
      },
      null,
      2,
    ),
  );

  if (!EXECUTE) {
    console.log(
      JSON.stringify({
        event: "fresh_start_dry_run_complete",
        message: "Set EXECUTE=1 and FRESH_START_CONFIRM=DELETE_ALL_WORKSPACE_DATA to apply",
      }),
    );
    return;
  }

  if (!CONFIRM) {
    throw new Error("Missing FRESH_START_CONFIRM=DELETE_ALL_WORKSPACE_DATA");
  }

  if (PRESERVE_PLATFORM_SENDERS && platformToPreserve.length === 0) {
    console.log(
      JSON.stringify({
        event: "fresh_start_warning",
        message: "No active Telnyx platform_mctb_sender rows found to preserve",
      }),
    );
  }

  const workspaceIds = await prisma.workspace.findMany({ select: { id: true } });
  for (const { id } of workspaceIds) {
    await prisma.workspace.delete({ where: { id } });
    console.log(JSON.stringify({ event: "workspace_deleted", workspaceId: id }));
  }

  const jobDeleted = await prisma.jobQueue.deleteMany({});
  console.log(JSON.stringify({ event: "job_queue_wiped", count: jobDeleted.count }));

  if (WIPE_PROVIDER_WEBHOOK_EVENTS) {
    const webhookDeleted = await prisma.providerWebhookEvent.deleteMany({});
    console.log(
      JSON.stringify({ event: "provider_webhook_events_wiped", count: webhookDeleted.count }),
    );
  }

  let platformWorkspaceId: string | null = null;
  if (PRESERVE_PLATFORM_SENDERS && platformToPreserve.length > 0) {
    const owner = await prisma.user.findFirst({
      where: { isPlatformAdmin: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const ws = await prisma.workspace.create({
      data: {
        name: PLATFORM_WORKSPACE_NAME,
        slug: PLATFORM_WORKSPACE_SLUG,
        type: "BUSINESS",
        ownerUserId: owner?.id ?? null,
      },
    });
    platformWorkspaceId = ws.id;
    console.log(
      JSON.stringify({
        event: "platform_workspace_created",
        workspaceId: ws.id,
        slug: PLATFORM_WORKSPACE_SLUG,
      }),
    );

    for (const row of platformToPreserve) {
      await prisma.phoneNumber.create({
        data: {
          id: row.id,
          workspaceId: ws.id,
          e164: row.e164,
          type: row.type,
          areaCode: row.areaCode,
          friendlyName: row.friendlyName ?? "Transovo platform sender",
          provider: row.provider,
          twilioSid: row.twilioSid,
          providerNumberId: row.providerNumberId,
          providerOrderId: row.providerOrderId,
          a2pStatus: row.a2pStatus,
          messagingService: row.messagingService,
          monthlyCostCents: row.monthlyCostCents,
          status: row.status,
          purchasedAt: row.purchasedAt,
          releasedAt: row.releasedAt,
          voiceForwardTo: row.voiceForwardTo,
          webhookUrl: row.webhookUrl,
          capabilitiesJson: row.capabilitiesJson ?? undefined,
          settingsJson: row.settingsJson ?? undefined,
          createdAt: row.createdAt,
          updatedAt: new Date(),
        },
      });
      console.log(
        JSON.stringify({
          event: "platform_phone_restored",
          phoneNumberId: row.id,
          e164: row.e164,
          provider: row.provider,
        }),
      );
    }
  }

  if (DELETE_ORPHAN_USERS) {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, memberships: { select: { id: true } } },
    });
    let orphanDeleted = 0;
    for (const u of users) {
      if (u.memberships.length > 0) continue;
      await prisma.user.delete({ where: { id: u.id } });
      orphanDeleted += 1;
      console.log(JSON.stringify({ event: "orphan_user_deleted", userId: u.id, email: u.email }));
    }
    console.log(JSON.stringify({ event: "orphan_users_summary", orphanDeleted }));
  }

  const after = {
    workspaces: await prisma.workspace.count(),
    users: await prisma.user.count(),
    memberships: await prisma.membership.count(),
    phoneNumbers: await prisma.phoneNumber.count(),
    jobQueue: await prisma.jobQueue.count(),
    providerWebhookEvents: await prisma.providerWebhookEvent.count(),
    platformWorkspaceId,
  };

  console.log(JSON.stringify({ event: "fresh_start_execute_complete", after }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
