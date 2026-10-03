#!/usr/bin/env npx tsx
/**
 * Look up users/workspaces by email pattern and optionally delete (production ops).
 *
 *   LOOKUP=longhp DRY_RUN=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/lookup-and-delete-customers-by-email.ts
 *   TARGET_EMAILS=a@x.com,b@y.com EXECUTE=1 ...
 */
import { getPrisma } from "@/lib/db";
import { releaseWorkspaceNumber } from "@/lib/numbers/release-service";

const lookup = (process.env.LOOKUP || "").trim().toLowerCase();
const listRecent = Number(process.env.LIST_RECENT || 0);
const targetEmails = (process.env.TARGET_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const execute = process.env.EXECUTE === "1";

async function summarizeWorkspace(prisma: ReturnType<typeof getPrisma>, workspaceId: string) {
  const [ws, limits, features, phones, missed, usage] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        billingPlan: true,
        ownerUserId: true,
        createdAt: true,
      },
    }),
    prisma.workspaceLimits.findUnique({
      where: { workspaceId },
      select: { limits: true },
    }),
    prisma.workspaceProductFeature.findMany({
      where: { workspaceId },
      select: { featureKey: true, status: true },
    }),
    prisma.phoneNumber.findMany({
      where: { workspaceId },
      select: { id: true, e164: true, status: true },
    }),
    prisma.missedCallEvent.count({ where: { workspaceId } }),
  ]);
  const lim = (limits?.limits || {}) as Record<string, unknown>;
  return {
    workspace: ws,
    limits: {
      adminUnlimitedMctb: lim.adminUnlimitedMctb,
      mctbServiceStatus: lim.mctbServiceStatus,
      trialSmsSegmentsUsed: lim.trialSmsSegmentsUsed,
    },
    features,
    phones,
    missedCallEvents: missed,
  };
}

async function deleteWorkspace(prisma: ReturnType<typeof getPrisma>, workspaceId: string) {
  if (workspaceId === "ws_1") {
    throw new Error("Refusing to delete ws_1");
  }
  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, e164: true, status: true },
  });
  for (const num of numbers) {
    if (num.status === "Released") continue;
    try {
      await releaseWorkspaceNumber(workspaceId, num.id);
    } catch (e) {
      console.log(JSON.stringify({ warn: "release_failed", e164: num.e164, message: String(e) }));
    }
  }
  await prisma.membership.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

async function deleteUserIfOrphan(prisma: ReturnType<typeof getPrisma>, userId: string) {
  const remaining = await prisma.membership.count({ where: { userId } });
  if (remaining > 0) return false;
  await prisma.user.delete({ where: { id: userId } });
  return true;
}

async function main() {
  const prisma = getPrisma();

  if (listRecent > 0) {
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: listRecent,
      select: { id: true, email: true, name: true, createdAt: true },
    });
    const recentWs = await prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      take: listRecent,
      select: {
        id: true,
        name: true,
        slug: true,
        billingPlan: true,
        ownerUserId: true,
        createdAt: true,
      },
    });
    console.log(JSON.stringify({ recentUsers, recentWorkspaces: recentWs }, null, 2));
    return;
  }

  let users: { id: string; email: string; name: string | null; createdAt: Date }[] = [];
  if (targetEmails.length) {
    for (const email of targetEmails) {
      const u = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, email: true, name: true, createdAt: true },
      });
      if (u) users.push(u);
    }
  } else if (lookup) {
    users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: lookup, mode: "insensitive" } },
          { name: { contains: lookup, mode: "insensitive" } },
        ],
      },
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } else {
    throw new Error("Set LOOKUP=substring or TARGET_EMAILS=comma,separated");
  }

  const workspaceIds = new Set<string>();
  for (const u of users) {
    const owned = await prisma.workspace.findMany({
      where: { ownerUserId: u.id },
      select: { id: true },
    });
    const member = await prisma.membership.findMany({
      where: { userId: u.id },
      select: { workspaceId: true },
    });
    for (const w of owned) workspaceIds.add(w.id);
    for (const m of member) workspaceIds.add(m.workspaceId);
  }

  const summaries = [];
  for (const wsId of workspaceIds) {
    summaries.push(await summarizeWorkspace(prisma, wsId));
  }

  console.log(
    JSON.stringify(
      {
        mode: execute ? "EXECUTE" : "DRY_RUN",
        users,
        workspaceSummaries: summaries,
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log("Set EXECUTE=1 to delete listed workspaces and orphan users");
    return;
  }

  for (const wsId of workspaceIds) {
    if (wsId === "ws_1") continue;
    await deleteWorkspace(prisma, wsId);
    console.log(JSON.stringify({ event: "workspace_deleted", workspaceId: wsId }));
  }

  for (const u of users) {
    const deleted = await deleteUserIfOrphan(prisma, u.id);
    if (deleted) {
      console.log(JSON.stringify({ event: "user_deleted", userId: u.id, email: u.email }));
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
