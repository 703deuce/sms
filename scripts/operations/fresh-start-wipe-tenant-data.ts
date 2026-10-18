#!/usr/bin/env npx tsx
/**
 * Fresh start: remove all workspace-scoped application data; keep DB schema.
 *
 * Dry run (default):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/fresh-start-wipe-tenant-data.ts
 *
 * Execute (irreversible without backup restore):
 *   EXECUTE=1 FRESH_START_CONFIRM=DELETE_ALL_WORKSPACE_DATA \
 *     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/operations/fresh-start-wipe-tenant-data.ts
 *
 * Optional:
 *   DELETE_ORPHAN_USERS=1  — delete users with zero memberships after workspace wipe
 *   WIPE_PROVIDER_WEBHOOK_EVENTS=1 — delete provider_webhook_event rows (can be large)
 */
import { getPrisma } from "@/lib/db";

const EXECUTE = process.env.EXECUTE === "1";
const CONFIRM = process.env.FRESH_START_CONFIRM === "DELETE_ALL_WORKSPACE_DATA";
const DELETE_ORPHAN_USERS = process.env.DELETE_ORPHAN_USERS === "1";
const WIPE_PROVIDER_WEBHOOK_EVENTS = process.env.WIPE_PROVIDER_WEBHOOK_EVENTS === "1";

async function main() {
  const prisma = getPrisma();

  const [dbSize] = await prisma.$queryRaw<{ db_size: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
  `;

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
          deleteOrphanUsers: DELETE_ORPHAN_USERS,
          wipeProviderWebhookEvents: WIPE_PROVIDER_WEBHOOK_EVENTS,
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
  };

  console.log(JSON.stringify({ event: "fresh_start_execute_complete", after }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
