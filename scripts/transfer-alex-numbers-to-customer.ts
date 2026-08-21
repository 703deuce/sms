/**
 * Transfer all phone numbers from Alex harbor-home account to a target customer.
 *
 * Run: npx tsx scripts/transfer-alex-numbers-to-customer.ts
 * Env: SOURCE_EMAIL=alex@harborhome.co TARGET_EMAIL=ywriteit@gmail.com
 */
import { getPrisma } from "@/lib/db";

const SOURCE_EMAIL = (process.env.SOURCE_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const TARGET_EMAIL = (process.env.TARGET_EMAIL || "ywriteit@gmail.com").trim().toLowerCase();
const TARGET_USER_ID = process.env.TARGET_USER_ID?.trim();

async function resolveTargetUser(prisma: ReturnType<typeof getPrisma>) {
  if (TARGET_USER_ID) {
    const byId = await prisma.user.findUnique({ where: { id: TARGET_USER_ID } });
    if (byId) return byId;
  }
  const exact = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (exact) return exact;
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  return (
    users.find((u) => u.email.toLowerCase() === TARGET_EMAIL) ??
    users.find((u) => u.email.toLowerCase().includes("ywriteit")) ??
    null
  );
}

async function main() {
  const prisma = getPrisma();

  const [sourceUser, targetUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: SOURCE_EMAIL } }),
    resolveTargetUser(prisma),
  ]);

  if (!sourceUser) throw new Error(`Source user not found: ${SOURCE_EMAIL}`);
  if (!targetUser) throw new Error(`Target user not found: ${TARGET_EMAIL}`);
  console.log(`Target user: ${targetUser.email} (${targetUser.id})`);

  let targetMembership = await prisma.membership.findFirst({
    where: { userId: targetUser.id, workspace: { type: "BUSINESS" } },
    include: { workspace: true },
  });
  if (!targetMembership) {
    targetMembership = await prisma.membership.findFirst({
      where: { userId: targetUser.id },
      include: { workspace: true },
    });
  }
  if (!targetMembership) {
    const { createWorkspaceForUser } = await import("@/lib/workspace/create-workspace");
    const ws = await createWorkspaceForUser(targetUser.id, "Business", "BUSINESS");
    targetMembership = {
      workspaceId: ws.id,
      workspace: ws,
    } as typeof targetMembership;
  }
  const targetWorkspaceId = targetMembership.workspaceId;

  const sourceMemberships = await prisma.membership.findMany({
    where: { userId: sourceUser.id },
    select: { workspaceId: true },
  });
  const sourceWorkspaceIds = sourceMemberships.map((m) => m.workspaceId);
  if (!sourceWorkspaceIds.length) {
    console.log("No source workspaces — nothing to transfer.");
    return;
  }

  const numbers = await prisma.phoneNumber.findMany({
    where: { workspaceId: { in: sourceWorkspaceIds } },
    select: { id: true, e164: true, workspaceId: true, label: true },
  });

  console.log(`Found ${numbers.length} number(s) on ${SOURCE_EMAIL} workspaces.`);

  let moved = 0;
  for (const num of numbers) {
    await prisma.phoneNumber.update({
      where: { id: num.id },
      data: { workspaceId: targetWorkspaceId },
    });

    await prisma.voiceAgentPhoneNumber.updateMany({
      where: { phoneNumberId: num.id },
      data: { workspaceId: targetWorkspaceId },
    });

    await prisma.voiceAgent.updateMany({
      where: { phoneNumberId: num.id },
      data: { workspaceId: targetWorkspaceId },
    });

    console.log(`  → ${num.e164} (${num.label || "no label"}) moved to ${TARGET_EMAIL}`);
    moved += 1;
  }

  console.log(`Done. Transferred ${moved} number(s) to workspace ${targetWorkspaceId}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
