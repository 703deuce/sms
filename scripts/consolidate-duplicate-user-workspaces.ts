/**
 * Remove orphan workspaces created by repeat OAuth logins (same user email).
 * Keeps one canonical workspace (MCTB ACTIVE BUSINESS preferred, or KEEP_WORKSPACE_ID).
 *
 * Usage:
 *   TARGET_EMAIL=... DRY_RUN=1 npx tsx scripts/consolidate-duplicate-user-workspaces.ts
 *   TARGET_EMAIL=... APPLY=1 KEEP_WORKSPACE_ID=... npx tsx ...
 */
import { getPrisma } from "@/lib/db";
import { releaseWorkspaceNumber } from "@/lib/numbers/release-service";

const email = (process.env.TARGET_EMAIL || "").trim().toLowerCase();
const dryRun = process.env.APPLY !== "1";
const keepId = process.env.KEEP_WORKSPACE_ID?.trim();

if (!email) {
  console.error("Set TARGET_EMAIL");
  process.exit(1);
}

async function pickCanonicalWorkspace(
  userId: string,
): Promise<{ id: string; name: string; type: string }> {
  const prisma = getPrisma();
  if (keepId) {
    const ws = await prisma.workspace.findFirst({
      where: { id: keepId, ownerUserId: userId },
      select: { id: true, name: true, type: true },
    });
    if (!ws) throw new Error("KEEP_WORKSPACE_ID not owned by user");
    return ws;
  }

  const owned = await prisma.workspace.findMany({
    where: { ownerUserId: userId },
    select: { id: true, name: true, type: true },
  });

  let best = owned[0]!;
  let bestScore = -1;
  for (const ws of owned) {
    const phones = await prisma.phoneNumber.count({ where: { workspaceId: ws.id } });
    const mctb = await prisma.workspaceProductFeature.findFirst({
      where: { workspaceId: ws.id, featureKey: "MCTB", status: "ACTIVE" },
      select: { id: true },
    });
    const typeScore = ws.type === "BUSINESS" ? 500 : 0;
    const score = typeScore + (mctb ? 2000 : 0) + phones * 10;
    if (score > bestScore) {
      bestScore = score;
      best = ws;
    }
  }
  return best;
}

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  const owned = await prisma.workspace.findMany({
    where: { ownerUserId: user.id },
    select: { id: true, name: true, type: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  if (owned.length <= 1) {
    console.log(JSON.stringify({ email, message: "Only one workspace — nothing to consolidate" }, null, 2));
    return;
  }

  const keep = await pickCanonicalWorkspace(user.id);
  const remove = owned.filter((w) => w.id !== keep.id);

  const plan = {
    email,
    userId: user.id,
    dryRun,
    keep,
    remove,
  };
  console.log(JSON.stringify(plan, null, 2));

  if (dryRun) {
    console.log("DRY_RUN — set APPLY=1 to execute");
    return;
  }

  for (const ws of remove) {
    const numbers = await prisma.phoneNumber.findMany({
      where: { workspaceId: ws.id },
      select: { id: true, e164: true, status: true },
    });
    for (const num of numbers) {
      if (num.status === "Released") continue;
      const released = await releaseWorkspaceNumber(ws.id, num.id);
      console.log("release", num.e164, released);
    }
    await prisma.membership.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } });
    console.log("deleted workspace", ws.id, ws.slug);
  }

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: keep.id },
    },
    create: { userId: user.id, workspaceId: keep.id, role: "OWNER" },
    update: { role: "OWNER" },
  });

  console.log("done — canonical workspace", keep.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
