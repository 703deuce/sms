/**
 * Audit test users and workspaces before purge.
 */
import { getPrisma } from "@/lib/db";

const PRESERVE_WORKSPACE_IDS = new Set([
  "ws_1",
  "cmt2zyg4l43373s0f146b442h", // platform demo 571 owner
]);

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

const TEST_USER_OR = [
  { email: { endsWith: "@transovo.test", mode: "insensitive" as const } },
  { email: { contains: "smoke", mode: "insensitive" as const } },
  { email: { contains: "qa-", mode: "insensitive" as const } },
  { email: { contains: "sr-e2e", mode: "insensitive" as const } },
  { email: { contains: "cal-smoke", mode: "insensitive" as const } },
  { email: { contains: "webrtc-", mode: "insensitive" as const } },
  { email: { contains: "voice-talk-", mode: "insensitive" as const } },
];

async function main() {
  const prisma = getPrisma();
  const preserveUserEmails = await resolvePreserveUserEmails(prisma);

  const [totalUsers, totalWorkspaces] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
  ]);

  const testUsers = await prisma.user.findMany({
    where: { OR: TEST_USER_OR },
    select: { id: true, email: true, isPlatformAdmin: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const deletableUserIds = testUsers
    .filter((u) => !preserveUserEmails.has(u.email.toLowerCase()))
    .map((u) => u.id);

  const testWorkspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { name: { contains: "E2E", mode: "insensitive" } },
        { name: { contains: "Smoke", mode: "insensitive" } },
        { name: { contains: "Preprod", mode: "insensitive" } },
        { name: { contains: "Test Workspace", mode: "insensitive" } },
        { name: { contains: "Amy", mode: "insensitive" } },
        { slug: { contains: "test", mode: "insensitive" } },
        { slug: { contains: "smoke", mode: "insensitive" } },
        { slug: { contains: "e2e", mode: "insensitive" } },
        { slug: { contains: "qa-", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, ownerUserId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const deletableWorkspaceIds = testWorkspaces
    .filter((w) => !PRESERVE_WORKSPACE_IDS.has(w.id))
    .map((w) => w.id);

  const orphanCount = await prisma.workspace.count({
    where: {
      id: { notIn: [...PRESERVE_WORKSPACE_IDS] },
      memberships: { none: {} },
    },
  });

  const ownedByTestUser = await prisma.workspace.count({
    where: {
      id: { notIn: [...PRESERVE_WORKSPACE_IDS] },
      ownerUserId: { in: deletableUserIds },
    },
  });

  const allNonPreserveUsers = await prisma.user.findMany({
    where: {
      email: { notIn: [...PRESERVE_USER_EMAILS] },
      isPlatformAdmin: false,
      OR: TEST_USER_OR,
    },
    select: { email: true },
    take: 5,
  });

  console.log(
    JSON.stringify(
      {
        totalUsers,
        totalWorkspaces,
        testUsersMatched: testUsers.length,
        deletableTestUsers: deletableUserIds.length,
        sampleTestUsers: testUsers.slice(0, 10).map((u) => u.email),
        testWorkspacesMatched: testWorkspaces.length,
        deletableTestWorkspaces: deletableWorkspaceIds.length,
        sampleTestWorkspaces: testWorkspaces.slice(0, 10).map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
        })),
        orphanWorkspaces: orphanCount,
        workspacesOwnedByTestUsers: ownedByTestUser,
        preserveWorkspaces: [...PRESERVE_WORKSPACE_IDS],
        preserveUsers: [...preserveUserEmails],
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
