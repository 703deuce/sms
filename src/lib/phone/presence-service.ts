import { getPrisma } from "@/lib/db";

export async function setPresence(input: {
  workspaceId: string;
  userId: string;
  status: string;
  customLabel?: string | null;
  queueAvailable?: boolean;
  /** When false, leave existing customLabel untouched (used by softphone auto on_call). */
  touchCustomLabel?: boolean;
}) {
  const prisma = getPrisma();
  const touchLabel = input.touchCustomLabel !== false;
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
      ...(touchLabel ? { customLabel: input.customLabel ?? null } : {}),
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
  const prisma = getPrisma();
  const existing = await prisma.softphonePresence.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (onCall) {
    // Remember prior status so hangup can restore busy/away/dnd instead of forcing available.
    const prior =
      existing?.status && existing.status !== "on_call" ? existing.status : "available";
    const label = existing?.customLabel || null;
    const tagged =
      label && label.startsWith("pre_call:")
        ? label
        : `pre_call:${prior}${label ? `|${label}` : ""}`;
    return setPresence({
      workspaceId,
      userId,
      status: "on_call",
      customLabel: tagged,
      queueAvailable: false,
    });
  }

  // Leaving on_call: restore pre_call status when present; never wipe intentional DND.
  const label = existing?.customLabel || "";
  const match = label.match(/^pre_call:([^|]+)(?:\|(.*))?$/);
  const restoreStatus = match?.[1] || "available";
  const restoreLabel = match?.[2] || null;
  return setPresence({
    workspaceId,
    userId,
    status: restoreStatus === "on_call" ? "available" : restoreStatus,
    customLabel: restoreLabel,
    queueAvailable: restoreStatus !== "dnd" && restoreStatus !== "offline",
  });
}
