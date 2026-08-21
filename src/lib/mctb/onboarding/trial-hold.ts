/**
 * Post-trial toll-free number hold window before release.
 * Default: 7 days after trial ends if customer does not convert.
 */
import { getPrisma } from "@/lib/db";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { releaseWorkspaceNumber } from "@/lib/numbers/release-service";

export const MCTB_TRIAL_NUMBER_HOLD_DAYS = 7;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function markTrialEnded(workspaceId: string) {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { workspaceLimits: true },
  });
  const limits = asRecord(ws?.workspaceLimits?.limits);
  if (limits.trialNumberHoldUntil) {
    return;
  }
  const endedAt = new Date();
  const holdUntil = new Date(
    endedAt.getTime() + MCTB_TRIAL_NUMBER_HOLD_DAYS * 24 * 60 * 60 * 1000,
  );
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        trialEndedAt: endedAt.toISOString(),
        trialNumberHoldUntil: holdUntil.toISOString(),
      },
    },
    update: {
      limits: {
        ...limits,
        trialEndedAt: endedAt.toISOString(),
        trialNumberHoldUntil: holdUntil.toISOString(),
      },
    },
  });
}

export async function isTrialNumberInHoldWindow(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { workspaceLimits: true, billingPlan: true },
  });
  const limits = asRecord(ws?.workspaceLimits?.limits);
  const holdUntil = limits.trialNumberHoldUntil as string | undefined;
  if (!holdUntil) return false;
  const plan = String(ws?.billingPlan || "").toLowerCase();
  if (plan === "trial" || plan === "onboarding") return false;
  return new Date(holdUntil).getTime() > Date.now();
}

export async function shouldReleaseTrialNumber(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { workspaceLimits: true, billingPlan: true },
  });
  const limits = asRecord(ws?.workspaceLimits?.limits);
  const holdUntil = limits.trialNumberHoldUntil as string | undefined;
  if (!holdUntil) return false;
  const plan = String(ws?.billingPlan || "").toLowerCase();
  if (plan === "trial" || plan === "onboarding" || plan === "growth") return false;
  return new Date(holdUntil).getTime() <= Date.now();
}

/** End workspaces whose 14-day MCTB trial has expired without conversion. */
export async function processExpiredMctbTrials(limit = 50): Promise<{
  scanned: number;
  ended: number;
}> {
  const prisma = getPrisma();
  const now = new Date().toISOString();
  const rows = await prisma.workspace.findMany({
    where: {
      billingPlan: { in: ["trial", "trial_pending_card"] },
      workspaceLimits: { isNot: null },
    },
    select: {
      id: true,
      workspaceLimits: { select: { limits: true } },
    },
    take: limit,
  });

  let ended = 0;
  for (const row of rows) {
    const limits = asRecord(row.workspaceLimits?.limits);
    const trialEndsAt = limits.trialEndsAt as string | undefined;
    if (!trialEndsAt || trialEndsAt > now) continue;

    await prisma.workspace.update({
      where: { id: row.id },
      data: { billingPlan: "canceled" },
    });
    await markTrialEnded(row.id);
    ended += 1;
  }

  return { scanned: rows.length, ended };
}

/** Release held trial TFNs after the post-trial grace window. */
export async function processMctbTrialNumberReleases(limit = 50): Promise<{
  scanned: number;
  released: number;
  errors: string[];
}> {
  const prisma = getPrisma();
  const rows = await prisma.workspace.findMany({
    where: {
      billingPlan: { in: ["canceled", "suspended", "expired"] },
      workspaceLimits: { isNot: null },
    },
    select: { id: true },
    take: limit,
  });

  const errors: string[] = [];
  let released = 0;

  for (const row of rows) {
    const shouldRelease = await shouldReleaseTrialNumber(row.id);
    if (!shouldRelease) continue;

    const state = await loadMctbOnboardingState(row.id);
    const phoneNumberId = state.trialNumber?.phoneNumberId;
    if (!phoneNumberId) continue;

    const result = await releaseWorkspaceNumber(row.id, phoneNumberId);
    if (result.ok) {
      released += 1;
      const limitsRow = await prisma.workspaceLimits.findUnique({
        where: { workspaceId: row.id },
        select: { limits: true },
      });
      const limits = asRecord(limitsRow?.limits);
      await prisma.workspaceLimits.update({
        where: { workspaceId: row.id },
        data: {
          limits: {
            ...limits,
            trialNumberReleasedAt: new Date().toISOString(),
          },
        },
      });
    } else if (result.error) {
      errors.push(`${row.id}: ${result.error}`);
    }
  }

  return { scanned: rows.length, released, errors };
}

export async function runMctbTrialLifecycleJobs(limit = 50) {
  const [expired, releases] = await Promise.all([
    processExpiredMctbTrials(limit),
    processMctbTrialNumberReleases(limit),
  ]);
  return { expired, releases };
}
