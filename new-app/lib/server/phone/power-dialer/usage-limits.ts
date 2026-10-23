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

export type ConcurrencyLimits = {
  maxConcurrentCallsWorkspace: number;
  maxConcurrentCallsPerRep: number;
  maxConcurrentCallsPerCampaign: number;
  maxOriginationsPerMinuteWorkspace: number;
  killSwitch: boolean;
  spendCeilingCents: number | null;
};

export async function getPowerDialerConcurrencyLimits(
  workspaceId: string,
): Promise<ConcurrencyLimits> {
  const prisma = getPrisma();
  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const root = (limitsRow?.limits || {}) as Record<string, unknown>;
  const pd = (root.powerDialer || {}) as Record<string, unknown>;
  const safety = (pd.safety || {}) as Record<string, unknown>;
  return {
    maxConcurrentCallsWorkspace:
      typeof safety.maxConcurrentCallsWorkspace === "number" ? safety.maxConcurrentCallsWorkspace : 50,
    maxConcurrentCallsPerRep:
      typeof safety.maxConcurrentCallsPerRep === "number" ? safety.maxConcurrentCallsPerRep : 3,
    maxConcurrentCallsPerCampaign:
      typeof safety.maxConcurrentCallsPerCampaign === "number"
        ? safety.maxConcurrentCallsPerCampaign
        : 25,
    maxOriginationsPerMinuteWorkspace:
      typeof safety.maxOriginationsPerMinuteWorkspace === "number"
        ? safety.maxOriginationsPerMinuteWorkspace
        : 30,
    killSwitch: safety.killSwitch === true || pd.killSwitch === true,
    spendCeilingCents:
      typeof safety.spendCeilingCents === "number" ? safety.spendCeilingCents : null,
  };
}

const LIVE_ATTEMPT = ["pending", "dialing", "ringing", "answered"] as const;

export async function assertPowerDialerConcurrencyLimits(
  workspaceId: string,
  ctx: { sessionId?: string; campaignId?: string; repUserId?: string | null },
) {
  const limits = await getPowerDialerConcurrencyLimits(workspaceId);
  if (limits.killSwitch) {
    throw new Error(
      "Power Dialer is temporarily disabled by an administrator (kill switch). Contact support.",
    );
  }
  const prisma = getPrisma();
  const liveWorkspace = await prisma.powerDialerAttempt.count({
    where: { workspaceId, status: { in: [...LIVE_ATTEMPT] } },
  });
  if (liveWorkspace >= limits.maxConcurrentCallsWorkspace) {
    throw new Error("Workspace concurrent call limit reached. Wait for active calls to finish.");
  }
  if (ctx.repUserId) {
    const liveRep = await prisma.powerDialerAttempt.count({
      where: {
        workspaceId,
        status: { in: [...LIVE_ATTEMPT] },
        session: { repUserId: ctx.repUserId },
      },
    });
    if (liveRep >= limits.maxConcurrentCallsPerRep) {
      throw new Error("Your concurrent call limit is reached. End or disposition active calls first.");
    }
  }
  if (ctx.campaignId) {
    const liveCampaign = await prisma.powerDialerAttempt.count({
      where: {
        workspaceId,
        status: { in: [...LIVE_ATTEMPT] },
        session: { campaignId: ctx.campaignId },
      },
    });
    if (liveCampaign >= limits.maxConcurrentCallsPerCampaign) {
      throw new Error("This campaign has reached its concurrent call limit.");
    }
  }
  return limits;
}
