import { getPrisma } from "@/lib/db";

export type NotificationPrefsJson = Record<
  string,
  { email?: boolean; inApp?: boolean } | undefined
>;

export async function getNotificationPrefs(workspaceId: string, userId: string) {
  const prisma = getPrisma();
  const row = await prisma.workspaceNotificationPrefs.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  return row;
}

export async function upsertNotificationPrefs(
  workspaceId: string,
  userId: string,
  patch: {
    notifyEmail?: string | null;
    digestFrequency?: string;
    pushEnabled?: boolean;
    prefs?: NotificationPrefsJson;
  },
) {
  const prisma = getPrisma();
  return prisma.workspaceNotificationPrefs.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: {
      workspaceId,
      userId,
      notifyEmail: patch.notifyEmail ?? null,
      digestFrequency: patch.digestFrequency ?? "daily",
      pushEnabled: patch.pushEnabled ?? false,
      prefs: patch.prefs ?? {},
    },
    update: {
      notifyEmail: patch.notifyEmail,
      digestFrequency: patch.digestFrequency,
      pushEnabled: patch.pushEnabled,
      prefs: patch.prefs,
    },
  });
}
