import { getPrisma } from "@/lib/db";

export async function setPresence(input: {
  workspaceId: string;
  userId: string;
  status: string;
  customLabel?: string | null;
  queueAvailable?: boolean;
}) {
  const prisma = getPrisma();
  const row = await prisma.softphonePresence.upsert({
    where: {
      workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      status: input.status,
      customLabel: input.customLabel || null,
      queueAvailable: input.queueAvailable ?? true,
    },
    update: {
      status: input.status,
      customLabel: input.customLabel ?? undefined,
      queueAvailable: input.queueAvailable,
    },
  });

  // Keep softphoneUserSettings.dndEnabled in sync so dial guards honor presence DND.
  if (input.status === "dnd" || input.status === "available" || input.status === "away") {
    await prisma.softphoneUserSettings
      .upsert({
        where: {
          workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId },
        },
        create: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          dndEnabled: input.status === "dnd",
        },
        update: {
          dndEnabled: input.status === "dnd",
        },
      })
      .catch(() => undefined);
  }

  return row;
}

export type PresenceRow = {
  userId: string;
  status: string;
  queueAvailable: boolean;
  updatedAt: Date;
  customLabel?: string | null;
};

export async function getPresenceMap(workspaceId: string): Promise<Map<string, PresenceRow>> {
  const rows = await getPrisma().softphonePresence.findMany({ where: { workspaceId } });
  return new Map(
    rows.map((r: PresenceRow) => [
      r.userId,
      {
        userId: r.userId,
        status: r.status,
        queueAvailable: r.queueAvailable,
        updatedAt: r.updatedAt,
        customLabel: r.customLabel,
      },
    ]),
  );
}

export async function listPresence(workspaceId: string) {
  return getPrisma().softphonePresence.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function markOnCall(workspaceId: string, userId: string, onCall: boolean) {
  return setPresence({
    workspaceId,
    userId,
    status: onCall ? "on_call" : "available",
    queueAvailable: !onCall,
  });
}
