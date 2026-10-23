import { getPrisma } from "@/lib/server/db";

export type CallCrmSyncChip = {
  status: "none" | "pending" | "succeeded" | "failed" | "skipped";
  lastAt: string | null;
  provider: string | null;
  errorMessage: string | null;
};

export async function getCrmSyncStatusForHumanCall(
  workspaceId: string,
  humanCallId: string,
): Promise<CallCrmSyncChip> {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { workspaceId, humanCallId },
    select: { id: true },
  });
  if (!attempt) {
    return { status: "none", lastAt: null, provider: null, errorMessage: null };
  }
  const log = await prisma.powerDialerIntegrationSyncLog.findFirst({
    where: { workspaceId, attemptId: attempt.id },
    orderBy: { createdAt: "desc" },
  });
  if (!log) {
    return { status: "none", lastAt: null, provider: null, errorMessage: null };
  }
  const st = log.status === "succeeded"
    ? "succeeded"
    : log.status === "failed"
      ? "failed"
      : log.status === "skipped"
        ? "skipped"
        : "pending";
  return {
    status: st,
    lastAt: log.finishedAt?.toISOString() || log.createdAt.toISOString(),
    provider: log.provider,
    errorMessage: log.errorMessage,
  };
}

export async function getCrmSyncStatusForAttempts(
  workspaceId: string,
  attemptIds: string[],
): Promise<Map<string, CallCrmSyncChip>> {
  const prisma = getPrisma();
  const map = new Map<string, CallCrmSyncChip>();
  if (!attemptIds.length) return map;
  const logs = await prisma.powerDialerIntegrationSyncLog.findMany({
    where: { workspaceId, attemptId: { in: attemptIds } },
    orderBy: { createdAt: "desc" },
  });
  for (const id of attemptIds) {
    map.set(id, { status: "none", lastAt: null, provider: null, errorMessage: null });
  }
  for (const log of logs) {
    if (!log.attemptId) continue;
    if (map.get(log.attemptId)?.status !== "none") continue;
    const st = log.status === "succeeded"
      ? "succeeded"
      : log.status === "failed"
        ? "failed"
        : log.status === "skipped"
          ? "skipped"
          : "pending";
    map.set(log.attemptId, {
      status: st,
      lastAt: log.finishedAt?.toISOString() || log.createdAt.toISOString(),
      provider: log.provider,
      errorMessage: log.errorMessage,
    });
  }
  return map;
}
