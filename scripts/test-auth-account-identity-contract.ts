/**
 * Account identity contract: one email → one User; repeat auth must not create new workspaces.
 * Run: npx tsx scripts/test-auth-account-identity-contract.ts
 */
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { findOrCreateUserFromGoogle } from "@/lib/auth/google-oauth";
import { getPrisma } from "@/lib/db";
import { ensureOwnerMembership } from "@/lib/workspace/owner-membership";

async function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

async function main() {
  const prisma = getPrisma();
  const stamp = Date.now().toString(36);
  const email = `identity-contract-${stamp}@example.invalid`;

  // --- Email/password signup shape (membership must exist) ---
  const user = await prisma.user.create({
    data: {
      email,
      name: "Identity Contract",
      passwordHash: await hash("test-password", 4),
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Contract WS",
      slug: `contract-ws-${stamp}`,
      type: "BUSINESS",
      ownerUserId: user.id,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await ensureOwnerMembership(user.id, workspace.id);

  const membershipAfterSignup = await prisma.membership.count({
    where: { userId: user.id, workspaceId: workspace.id },
  });
  assert(membershipAfterSignup === 1, "signup workspace must have exactly one OWNER membership");

  const usersWithEmail = await prisma.user.count({ where: { email } });
  assert(usersWithEmail === 1, "email must map to exactly one User row");

  // --- Google OAuth return login (same email twice) ---
  const profile = {
    sub: `google-sub-${stamp}`,
    email,
    name: "Identity Contract",
    emailVerified: true,
  };

  const first = await findOrCreateUserFromGoogle(profile);
  assert(first.userId === user.id, "Google must resolve existing user by email, not create a new User");
  assert(first.created === false, "second auth must not be treated as brand-new user");

  const wsCountAfterGoogle = await prisma.workspace.count({ where: { ownerUserId: user.id } });
  assert(wsCountAfterGoogle === 1, "repeat Google login must not create another workspace");

  const second = await findOrCreateUserFromGoogle(profile);
  assert(second.workspaceId === first.workspaceId, "repeat login must resolve same workspace");

  const wsCountAfterThird = await prisma.workspace.count({ where: { ownerUserId: user.id } });
  assert(wsCountAfterThird === 1, "third Google login must still have only one workspace");

  // --- Tenant isolation: membership is the gate for workspace override ---
  const otherUser = await prisma.user.create({
    data: {
      email: `other-${stamp}@example.invalid`,
      name: "Other",
      passwordHash: await hash("x", 4),
    },
  });
  const cross = await prisma.membership.findFirst({
    where: { userId: otherUser.id, workspaceId: workspace.id },
  });
  assert(cross === null, "other users must not have membership on foreign workspace");

  await prisma.membership.deleteMany({ where: { userId: user.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.user.delete({ where: { id: otherUser.id } });

  console.log("PASS: auth account identity contract");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
