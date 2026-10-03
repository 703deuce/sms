/**
 * Read-only: show workspaces + memberships for a user email (Google OAuth debugging).
 * Usage: set TARGET_EMAIL then run this script with tsx.
 */
import { getPrisma } from "@/lib/db";

const email = (process.env.TARGET_EMAIL || "").trim().toLowerCase();
if (!email) {
  console.error("Set TARGET_EMAIL");
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(JSON.stringify({ email, found: false }, null, 2));
    return;
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          ownerUserId: true,
          billingPlan: true,
        },
      },
    },
  });

  const owned = await prisma.workspace.findMany({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const ownedDetail = [];
  for (const ws of owned) {
    const phones = await prisma.phoneNumber.findMany({
      where: { workspaceId: ws.id },
      select: { e164: true, type: true },
    });
    const mctbFeature = await prisma.workspaceProductFeature.findFirst({
      where: { workspaceId: ws.id, featureKey: "MCTB" },
      select: { status: true },
    });
    const hasMembership = memberships.some((m) => m.workspaceId === ws.id);
    ownedDetail.push({
      workspaceId: ws.id,
      name: ws.name,
      type: ws.type,
      slug: ws.slug,
      createdAt: ws.createdAt.toISOString(),
      hasMembership,
      phones,
      mctbFeature: mctbFeature?.status ?? null,
    });
  }

  console.log(
    JSON.stringify(
      {
        email,
        userId: user.id,
        membershipCount: memberships.length,
        memberships: memberships.map((m) => ({
          workspaceId: m.workspaceId,
          role: m.role,
          workspaceName: m.workspace.name,
          workspaceType: m.workspace.type,
          isOwner: m.workspace.ownerUserId === user.id,
        })),
        ownedWorkspaces: ownedDetail,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
