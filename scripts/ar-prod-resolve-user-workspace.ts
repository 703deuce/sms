import { getPrisma } from "../src/lib/db";

async function main() {
const EMAIL = (process.env.EMAIL || "whywriteit@gmail.com").toLowerCase();

const user = await getPrisma().user.findFirst({
  where: { email: { equals: EMAIL, mode: "insensitive" } },
  select: { id: true, email: true },
});
if (!user) throw new Error("no user");

const memberships = await getPrisma().membership.findMany({
  where: { userId: user.id },
  select: { workspaceId: true, role: true },
});

const out = [];
for (const m of memberships) {
  const ws = await getPrisma().workspace.findUnique({
    where: { id: m.workspaceId },
    select: { id: true, name: true, displayName: true },
  });
  const ms = await getPrisma().voiceCalendarConnection.findMany({
    where: { workspaceId: m.workspaceId, provider: "microsoft" },
    select: { id: true, status: true, name: true },
  });
  const ar = await getPrisma().solutionSetup.findFirst({
    where: { workspaceId: m.workspaceId, solutionType: "appointment-reminders-product" },
    select: { configJson: true },
  });
  out.push({
    workspaceId: m.workspaceId,
    workspaceName: ws?.displayName || ws?.name,
    role: m.role,
    microsoft: ms,
    arActivatedAt: (ar?.configJson as { activatedAt?: string })?.activatedAt ?? null,
  });
}
console.log(JSON.stringify({ user, memberships: out }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
