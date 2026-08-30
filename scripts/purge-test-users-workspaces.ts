/**
 * Purge automated test users and workspaces from the database.
 *
 * Preserves only ws_1 (production admin workspace) and its owner accounts.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/purge-test-users-workspaces.ts
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/purge-test-users-workspaces.ts --apply
 */
import { getPrisma } from "@/lib/db";

const args = process.argv.slice(2);
const apply = args.includes("--apply");

async function resolvePreserveUserEmails(prisma: ReturnType<typeof getPrisma>): Promise<Set<string>> {
  const fromEnv = [
    process.env.PURGE_PRESERVE_USER_EMAIL?.trim(),
    process.env.MCTB_ADMIN_ASSIGN_EMAIL?.trim(),
    process.env.BOOTSTRAP_USER_EMAIL?.trim(),
  ].filter(Boolean) as string[];

  if (fromEnv.length > 0) {
    return new Set(fromEnv.map((e) => e.toLowerCase()));
  }

  const owners = await prisma.membership.findMany({
    where: { workspaceId: "ws_1", role: "OWNER" },
    include: { user: { select: { email: true } } },
  });
  return new Set(owners.map((m) => m.user.email.toLowerCase()));
}

const PRESERVE_WORKSPACE_IDS = new Set(["ws_1"]);
const WS_1_CANONICAL_571_PHONE_ID = "cmsgtjms84g6l2h0o255w1e3v";

function isTestEmail(email: string, preserveUserEmails: Set<string>): boolean {
  const e = email.trim().toLowerCase();
  if (preserveUserEmails.has(e)) return false;
  if (e.endsWith("@transovo.test")) return true;
  if (e.endsWith("@transovo-cert.internal")) return true;
  if (e.endsWith("@example.com")) return true;
  if (e.endsWith("@test.com")) return true;
  if (e.includes("smoke")) return true;
  if (e.includes("qa-")) return true;
  if (e.includes("sr-e2e")) return true;
  if (e.includes("cal-smoke")) return true;
  if (e.includes("webrtc-")) return true;
  if (e.includes("voice-talk-")) return true;
  if (e.includes("e2e")) return true;
  if (e.includes("preprod")) return true;
  if (e.includes("amy-preprod")) return true;
  if (/^wait[a-z0-9]+@gmail\.com$/.test(e)) return true;
  if (/^(crud|ix|insp|ivr)[a-z0-9]+@gmail\.com$/.test(e)) return true;
  if (e.startsWith("test@") || e.startsWith("test-") || e.startsWith("ui-test-")) return true;
  if (e.startsWith("fresh-")) return true;
  return false;
}

async function deleteWorkspacesInBatches(
  prisma: ReturnType<typeof getPrisma>,
  workspaceIds: string[],
  batchSize = 50,
): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < workspaceIds.length; i += batchSize) {
    const batch = workspaceIds.slice(i, i + batchSize);
    const result = await prisma.workspace.deleteMany({ where: { id: { in: batch } } });
    deleted += result.count;
    console.log(`  deleted workspace batch ${i / batchSize + 1}: ${result.count}`);
  }
  return deleted;
}

async function deleteUsersInBatches(
  prisma: ReturnType<typeof getPrisma>,
  userIds: string[],
  batchSize = 50,
): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    await prisma.membership.deleteMany({ where: { userId: { in: batch } } });
    const result = await prisma.user.deleteMany({ where: { id: { in: batch } } });
    deleted += result.count;
    console.log(`  deleted user batch ${i / batchSize + 1}: ${result.count}`);
  }
  return deleted;
}

async function main() {
  const prisma = getPrisma();
  const preserveUserEmails = await resolvePreserveUserEmails(prisma);

  const [allUsers, allWorkspaces] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, isPlatformAdmin: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspace.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const usersToDelete = allUsers.filter((u) => isTestEmail(u.email, preserveUserEmails));
  const usersToKeep = allUsers.filter((u) => !isTestEmail(u.email, preserveUserEmails));
  const workspacesToDelete = allWorkspaces.filter((w) => !PRESERVE_WORKSPACE_IDS.has(w.id));
  const workspacesToKeep = allWorkspaces.filter((w) => PRESERVE_WORKSPACE_IDS.has(w.id));

  const ws1TestMemberships = await prisma.membership.findMany({
    where: {
      workspaceId: "ws_1",
      userId: { in: usersToDelete.map((u) => u.id) },
    },
    include: { user: { select: { email: true } } },
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "APPLY" : "DRY_RUN",
        preserveUsers: [...preserveUserEmails],
        preserveWorkspaces: [...PRESERVE_WORKSPACE_IDS],
        usersBefore: allUsers.length,
        usersToDelete: usersToDelete.length,
        usersToKeep: usersToKeep.map((u) => u.email),
        workspacesBefore: allWorkspaces.length,
        workspacesToDelete: workspacesToDelete.length,
        workspacesToKeep: workspacesToKeep.map((w) => ({ id: w.id, name: w.name, slug: w.slug })),
        ws1TestMembershipsToRemove: ws1TestMemberships.map((m) => m.user.email),
        sampleUsersToDelete: usersToDelete.slice(0, 10).map((u) => u.email),
        sampleWorkspacesToDelete: workspacesToDelete.slice(0, 10).map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to delete.");
    return;
  }

  console.log("\nRemoving test memberships from ws_1...");
  if (ws1TestMemberships.length > 0) {
    await prisma.membership.deleteMany({
      where: { id: { in: ws1TestMemberships.map((m) => m.id) } },
    });
  }

  console.log("Deleting test workspaces...");
  const deletedWorkspaces = await deleteWorkspacesInBatches(
    prisma,
    workspacesToDelete.map((w) => w.id),
  );

  console.log("Healing ws_1 references...");
  await prisma.workspace.update({
    where: { id: "ws_1" },
    data: { activeFromNumberId: WS_1_CANONICAL_571_PHONE_ID },
  });
  const orphan571 = await prisma.phoneNumber.deleteMany({
    where: {
      e164: "+15714073615",
      workspaceId: { not: "ws_1" },
    },
  });
  if (orphan571.count > 0) {
    console.log(`  removed ${orphan571.count} orphan +15714073615 phone row(s)`);
  }

  console.log("Deleting test users...");
  const deletedUsers = await deleteUsersInBatches(
    prisma,
    usersToDelete.map((u) => u.id),
  );

  const [usersAfter, workspacesAfter] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
  ]);

  const remainingWs1Members = await prisma.membership.findMany({
    where: { workspaceId: "ws_1" },
    include: { user: { select: { email: true, role: true } } },
  });

  const remaining571 = await prisma.phoneNumber.findMany({
    where: { e164: "+15714073615" },
    select: { id: true, workspaceId: true, status: true },
  });

  console.log(
    JSON.stringify(
      {
        deletedWorkspaces,
        deletedUsers,
        usersAfter,
        workspacesAfter,
        ws1Members: remainingWs1Members.map((m) => ({
          email: m.user.email,
          role: m.role,
        })),
        remaining571Rows: remaining571,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
