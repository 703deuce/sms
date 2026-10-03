/**
 * Verifies workspace.create nested memberships.create persists (prisma-compat).
 */
import { getPrisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";

async function main() {
  const prisma = getPrisma();
  const email = `nested-create-test-${Date.now()}@example.invalid`;
  const user = await prisma.user.create({
    data: {
      email,
      name: "Nested Create Test",
      passwordHash: await hash(randomBytes(8).toString("hex"), 4),
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Test WS",
      slug: `test-nested-${Date.now().toString(36)}`,
      type: "PERSONAL",
      ownerUserId: user.id,
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: workspace.id },
  });

  if (!membership) {
    console.error("FAIL: membership row missing after nested workspace.create");
    process.exit(1);
  }

  await prisma.membership.deleteMany({ where: { userId: user.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("PASS: nested workspace membership create");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
