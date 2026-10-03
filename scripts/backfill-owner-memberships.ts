/**
 * One-time: every workspace.ownerUserId without a Membership OWNER row gets one.
 * Run: DRY_RUN=1 npx tsx scripts/backfill-owner-memberships.ts
 *      APPLY=1 npx tsx scripts/backfill-owner-memberships.ts
 */
import { getPrisma } from "@/lib/db";
import { ensureOwnerMembership } from "@/lib/workspace/owner-membership";

const dryRun = process.env.APPLY !== "1";

async function main() {
  const prisma = getPrisma();
  const workspaces = await prisma.workspace.findMany({
    where: { ownerUserId: { not: null } },
    select: { id: true, ownerUserId: true, slug: true },
  });

  let missing = 0;
  for (const ws of workspaces) {
    const ownerId = ws.ownerUserId as string;
    if (!ownerId) continue;
    const membership = await prisma.membership.findFirst({
      where: { userId: ownerId, workspaceId: ws.id },
    });
    if (membership) continue;
    missing += 1;
    console.log(dryRun ? "would link" : "linking", ownerId, ws.id, ws.slug);
    if (!dryRun) await ensureOwnerMembership(ownerId, ws.id);
  }

  console.log(
    JSON.stringify({ dryRun, workspacesScanned: workspaces.length, membershipsCreated: dryRun ? 0 : missing, missingFound: missing }, null, 2),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
