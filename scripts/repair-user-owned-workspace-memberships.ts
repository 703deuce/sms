/**
 * One-off / ops: link all workspaces owned by a user into Membership (OWNER).
 * Usage: TARGET_EMAIL=user@example.com npx tsx scripts/repair-user-owned-workspace-memberships.ts
 */
import { getPrisma } from "@/lib/db";
import { repairOwnedWorkspaceMemberships, ensureProductWorkspace } from "@/lib/products/entitlements";

const email = (process.env.TARGET_EMAIL || "").trim().toLowerCase();
if (!email) {
  console.error("Set TARGET_EMAIL");
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }

  const created = await repairOwnedWorkspaceMemberships(user.id);
  const voice = await ensureProductWorkspace(user.id, "voice");

  console.log(
    JSON.stringify(
      {
        email,
        userId: user.id,
        membershipsCreated: created,
        voiceWorkspaceId: voice.workspaceId,
        voiceWorkspaceType: voice.workspaceType,
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
