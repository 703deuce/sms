import { getPrisma } from "@/lib/db";
import { getNotificationPrefs } from "@/lib/settings/notification-prefs";

export type NotificationType =
  | "newReply"
  | "campaignComplete"
  | "invite"
  | "system"
  | (string & {});

export type InAppNotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function createNotification(input: {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
}) {
  const prisma = getPrisma();
  return prisma.inAppNotification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    },
  });
}

/**
 * Fan a notification out to every member of a workspace, honouring each
 * member's per-type in-app preference (defaults to on).
 */
export async function notifyWorkspace(
  workspaceId: string,
  input: { type: NotificationType; title: string; body?: string | null; href?: string | null },
) {
  const prisma = getPrisma();
  const memberships = await prisma.membership.findMany({ where: { workspaceId } });
  let created = 0;
  for (const m of memberships as Array<{ userId: string }>) {
    const prefs = await getNotificationPrefs(workspaceId, m.userId).catch(() => null);
    const typePref = prefs?.prefs && typeof prefs.prefs === "object"
      ? (prefs.prefs as Record<string, { inApp?: boolean } | undefined>)[String(input.type)]
      : undefined;
    if (typePref?.inApp === false) continue;
    await createNotification({ workspaceId, userId: m.userId, ...input });
    created += 1;
  }
  return { created };
}

export async function listNotifications(
  workspaceId: string,
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<InAppNotificationRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.inAppNotification.findMany({
    where: {
      workspaceId,
      userId,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 30,
  });
  return (rows as Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    href: string | null;
    readAt: Date | null;
    createdAt: Date;
  }>).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    href: r.href,
    readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

export async function countUnread(workspaceId: string, userId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.inAppNotification.count({
    where: { workspaceId, userId, readAt: null },
  });
}

export async function markRead(workspaceId: string, userId: string, id: string) {
  const prisma = getPrisma();
  const row = await prisma.inAppNotification.findUnique({ where: { id } });
  if (!row || row.workspaceId !== workspaceId || row.userId !== userId) {
    return { ok: false as const };
  }
  await prisma.inAppNotification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  return { ok: true as const };
}

export async function markAllRead(workspaceId: string, userId: string) {
  const prisma = getPrisma();
  const result = await prisma.inAppNotification.updateMany({
    where: { workspaceId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}
