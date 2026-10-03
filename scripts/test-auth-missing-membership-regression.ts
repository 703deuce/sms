/**
 * Regression: production failure boundary — User + owned Workspace + missing OWNER Membership.
 * Neither Google return nor resolveAuthenticatedWorkspace may create another workspace.
 *
 * Run: npx tsx scripts/test-auth-missing-membership-regression.ts
 */
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { findOrCreateUserFromGoogle } from "@/lib/auth/google-oauth";
import { resolveAuthenticatedWorkspace } from "@/lib/auth/resolve-session-workspace";
import { getPrisma } from "@/lib/db";

async function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

async function counts(userId: string) {
  const prisma = getPrisma();
  const users = await prisma.user.count({ where: { id: userId } });
  const workspaces = await prisma.workspace.count({ where: { ownerUserId: userId } });
  const memberships = await prisma.membership.count({
    where: { userId, role: "OWNER" },
  });
  return { users, workspaces, memberships };
}

async function main() {
  const prisma = getPrisma();
  const stamp = Date.now().toString(36);
  const email = `missing-membership-regression-${stamp}@example.invalid`;

  // --- Broken legacy shape: User + Workspace, deliberately NO Membership ---
  const user = await prisma.user.create({
    data: {
      email,
      name: "Regression User",
      passwordHash: await hash("pw", 4),
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Original Business",
      slug: `regression-ws-${stamp}`,
      type: "BUSINESS",
      ownerUserId: user.id,
    },
  });

  let c = await counts(user.id);
  assert(c.users === 1 && c.workspaces === 1 && c.memberships === 0, "seed: missing membership");

  // Password-login path (shared resolver)
  const resolved = await resolveAuthenticatedWorkspace(user.id, "voice");
  assert(resolved.workspaceId === workspace.id, "resolver must return existing owned workspace");

  c = await counts(user.id);
  assert(
    c.users === 1 && c.workspaces === 1 && c.memberships === 1,
    "after password resolver: exactly one OWNER membership",
  );

  // Google OAuth return (same email, existing user)
  const profile = {
    sub: `google-${stamp}`,
    email,
    name: "Regression User",
    emailVerified: true,
  };

  const google1 = await findOrCreateUserFromGoogle(profile);
  assert(google1.userId === user.id, "Google must not create a new User");
  assert(google1.created === false, "Google return is not a new signup");
  assert(google1.workspaceId === workspace.id, "Google must resolve same workspace");

  c = await counts(user.id);
  assert(c.workspaces === 1, "after Google login: workspace count still 1");

  const google2 = await findOrCreateUserFromGoogle(profile);
  assert(google2.workspaceId === workspace.id, "repeat Google login: same workspace");

  c = await counts(user.id);
  assert(
    c.users === 1 && c.workspaces === 1 && c.memberships === 1,
    "after repeat Google: counts unchanged",
  );

  const phones = await prisma.phoneNumber.count({ where: { workspaceId: workspace.id } });
  assert(phones === 0, "login recovery must not auto-provision phone numbers");

  // Cleanup regression user
  await prisma.membership.deleteMany({ where: { userId: user.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });

  // --- Genuinely new email: first Google signup ---
  const newEmail = `new-google-${stamp}@example.invalid`;
  const newProfile = {
    sub: `google-new-${stamp}`,
    email: newEmail,
    name: "New Google User",
    emailVerified: true,
  };

  const firstSignup = await findOrCreateUserFromGoogle(newProfile);
  assert(firstSignup.created === true, "new email is first-time signup");

  const newUser = await prisma.user.findUnique({ where: { email: newEmail } });
  assert(newUser != null, "new user row exists");
  const nc = await counts(newUser!.id);
  assert(
    nc.users === 1 && nc.workspaces === 1 && nc.memberships === 1,
    "new signup: exactly one User, Workspace, OWNER Membership",
  );

  const secondSignup = await findOrCreateUserFromGoogle(newProfile);
  const nc2 = await counts(newUser!.id);
  assert(secondSignup.workspaceId === firstSignup.workspaceId, "second login same workspace");
  assert(
    nc2.users === 1 && nc2.workspaces === 1 && nc2.memberships === 1,
    "new user repeat login: counts unchanged",
  );

  await prisma.membership.deleteMany({ where: { userId: newUser!.id } });
  await prisma.workspace.deleteMany({ where: { ownerUserId: newUser!.id } });
  await prisma.user.delete({ where: { id: newUser!.id } });

  console.log("PASS: missing-membership regression (Google + password resolver + new signup)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
