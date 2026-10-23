import { getPrisma } from "@/lib/server/db";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";

export type PowerDialerUsageSnapshot = {
  billableSecondsMonth: number;
  minutesUsed: number;
  minutesIncluded: number | null;
  overageMinutes: number;
  usageAlertThresholdPct: number | null;
  blocked: boolean;
};

function monthStartUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getPowerDialerUsageSnapshot(workspaceId: string): Promise<PowerDialerUsageSnapshot> {
  const prisma = getPrisma();
  const start = monthStartUtc();
  const agg = await prisma.powerDialerAttempt.aggregate({
    where: { workspaceId, createdAt: { gte: start } },
    _sum: { billableSeconds: true },
  });
  const billableSecondsMonth = agg._sum.billableSeconds ?? 0;
  const minutesUsed = Math.ceil(billableSecondsMonth / 60);

  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const root = (limitsRow?.limits || {}) as Record<string, unknown>;
  const pd = (root.powerDialer || {}) as Record<string, unknown>;
  const minutesIncluded =
    typeof pd.minutesIncluded === "number" ? pd.minutesIncluded : null;
  const settings = await getPowerDialerSettings(workspaceId);
  const threshold =
    typeof settings.usageAlertThresholdPct === "number"
      ? settings.usageAlertThresholdPct
      : null;

  const overageMinutes =
    minutesIncluded != null ? Math.max(0, minutesUsed - minutesIncluded) : 0;
  const blockOnCap =
    pd.blockDialingOnCap === true || settings.overageBehavior === "block";
  const blocked =
    minutesIncluded != null && minutesUsed >= minutesIncluded && blockOnCap;

  return {
    billableSecondsMonth,
    minutesUsed,
    minutesIncluded,
    overageMinutes,
    usageAlertThresholdPct: threshold,
    blocked,
  };
}

export async function assertDialingWithinUsageLimits(workspaceId: string) {
  const snap = await getPowerDialerUsageSnapshot(workspaceId);
  if (snap.blocked) {
    throw new Error(
      "Included dialing minutes are exhausted for this billing period. Adjust your plan or limits before starting a session.",
    );
  }
  return snap;
}
