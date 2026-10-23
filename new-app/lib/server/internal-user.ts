import { getPrisma } from "@/lib/server/db";

const SYSTEM_EMAIL = "phone-system@transovo.internal";

/** Single business operator for greenfield Phone (no customer auth). */
export async function resolveInternalUserId(): Promise<string> {
  const pinned = process.env.DEV_USER_ID?.trim() || process.env.TRANSOVO_INTERNAL_USER_ID?.trim();
  const prisma = getPrisma();
  if (pinned) {
    const row = await prisma.user.findUnique({ where: { id: pinned }, select: { id: true } });
    if (row) return row.id;
  }

  const existing = await prisma.user.findUnique({
    where: { email: SYSTEM_EMAIL },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      email: SYSTEM_EMAIL,
      name: "Phone Operator",
    },
    select: { id: true },
  });
  return created.id;
}
