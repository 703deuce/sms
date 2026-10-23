import { getPrisma } from "@/lib/server/db";
import { ensureInternalOperatorMembership } from "@/lib/server/workspace-operator";

/**
 * Until product auth ships: pin workspace via env or bootstrap the first workspace row.
 */
export async function resolveWorkspaceId(): Promise<string> {
  const pinned =
    process.env.DEV_WORKSPACE_ID?.trim() ||
    process.env.TRANSOVO_WORKSPACE_ID?.trim() ||
    process.env.WORKSPACE_ID?.trim();
  if (pinned) {
    const prisma = getPrisma();
    const row = await prisma.workspace.findUnique({ where: { id: pinned }, select: { id: true } });
    if (row) {
      await ensureInternalOperatorMembership(row.id);
      return row.id;
    }
  }

  const prisma = getPrisma();
  const existing = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) {
    await ensureInternalOperatorMembership(existing.id);
    return existing.id;
  }

  const slug = process.env.TRANSOVO_WORKSPACE_SLUG?.trim() || "main";
  const created = await prisma.workspace.create({
    data: {
      name: process.env.TRANSOVO_WORKSPACE_NAME?.trim() || "Transovo",
      slug,
      type: "BUSINESS",
    },
    select: { id: true },
  });
  await ensureInternalOperatorMembership(created.id);
  return created.id;
}
