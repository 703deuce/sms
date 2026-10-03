/**
 * One-off / ops: link all workspaces owned by a user into Membership (OWNER).
 * Usage: set TARGET_EMAIL then run this script with tsx.
 */
import { getPrisma } from "@/lib/db";
import { ensureProductWorkspace } from "@/lib/products/entitlements";
import { ensureOwnerMembershipsForOwnedWorkspaces } from "@/lib/workspace/owner-membership";

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

  const created = await ensureOwnerMembershipsForOwnedWorkspaces(user.id);
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
