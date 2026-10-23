import { getPrisma } from "@/lib/server/db";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";

/** Server-side after-call-work timeout while awaiting disposition (M38). */
export async function enforceAcwTimeouts(workspaceId: string, sessionId: string) {
  const settings = await getPowerDialerSettings(workspaceId);
  const timeoutSec = settings.afterCallWorkTimeoutSec;
  if (!timeoutSec || timeoutSec <= 0) return { cleared: 0 };

  const prisma = getPrisma();
  const now = new Date();
  const stale = await prisma.powerDialerAttempt.findMany({
    where: {
      workspaceId,
      sessionId,
      status: "answered",
      disposition: null,
      acwDeadlineAt: { lt: now },
    },
    select: { id: true },
  });

  for (const row of stale) {
    await prisma.powerDialerAttempt.update({
      where: { id: row.id },
      data: {
        disposition: "ACW timeout",
        status: "completed",
        endedAt: now,
        notes: "Auto-completed after ACW timeout",
      },
    });
  }

  if (stale.length) {
    await prisma.powerDialerSession.updateMany({
      where: { id: sessionId, workspaceId, progressionPhase: "awaiting_disposition" },
      data: {
        progressionPhase: "countdown",
        currentAttemptId: null,
        nextCallAt: new Date(now.getTime() + 1000),
      },
    });
  }

  return { cleared: stale.length };
}

export function computeAcwDeadline(timeoutSec: number | undefined | null): Date | null {
  if (!timeoutSec || timeoutSec <= 0) return null;
  return new Date(Date.now() + timeoutSec * 1000);
}
