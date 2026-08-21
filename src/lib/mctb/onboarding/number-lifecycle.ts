/**
 * Workspace toll-free number lifecycle after trial / paid conversion.
 * The subscription may be in trial; the toll-free number is workspace-owned and permanent on paid conversion.
 */
import { getPrisma } from "@/lib/db";
import { getTrialLimits } from "@/lib/platform-flags";
import {
  clearMctbServiceSuspension,
  hasActiveMctbPaidEntitlement,
  setMctbServiceStatus,
} from "@/lib/mctb/entitlement";
import { loadMctbOnboardingState, recordFunnelEvent } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { releaseWorkspaceNumber } from "@/lib/numbers/release-service";
import { recordNumberReleaseAudit } from "@/lib/mctb/number-release-audit";
import { processAbandonedOnboardingReminders } from "@/lib/mctb/onboarding/abandoned-reminders";

export const MCTB_NUMBER_HOLD_DAYS = 7;
/** Days after TFN provision before releasing numbers from abandoned onboarding (no TFV submit). */
export const MCTB_ABANDONED_ONBOARDING_DAYS = 14;

const TFV_IN_FLIGHT_STATUSES = new Set([
  "SUBMITTED",
  "PENDING",
  "APPROVED",
  "ACTION_REQUIRED",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Paid conversion — retain TFN, cancel hold/release timers, preserve TFV + forwarding + history. */
export async function retainWorkspaceTollFreeOnPaidConversion(workspaceId: string) {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { workspaceLimits: true },
  });
  const limits = asRecord(ws?.workspaceLimits?.limits);
  const now = new Date().toISOString();

  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        mctbNumberRetainedAt: now,
        trialNumberHoldUntil: null,
        trialNumberReleaseScheduled: false,
      },
    },
    update: {
      limits: {
        ...limits,
        mctbNumberRetainedAt: now,
        trialNumberHoldUntil: null,
        trialNumberReleaseScheduled: false,
        trialEndedAt: limits.trialEndedAt || null,
      },
    },
  });

  await recordFunnelEvent(workspaceId, "MCTB_PAID", { retainedNumber: true }).catch(() => undefined);
  await clearMctbServiceSuspension(workspaceId).catch(() => undefined);
}

/**
 * Trial ended without payment — pause MCTB, start 7-day TFN retention window.
 * Does NOT release the number.
 */
export async function markMctbTrialEndedWithoutPayment(workspaceId: string) {
  const hasPaid = await hasActiveMctbPaidEntitlement(workspaceId);
  if (hasPaid) return;

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { workspaceLimits: true, billingPlan: true },
  });
  const limits = asRecord(ws?.workspaceLimits?.limits);
  if (limits.trialEndedAt && limits.trialNumberHoldUntil) return;

  const endedAt = new Date();
  const holdUntil = new Date(endedAt.getTime() + MCTB_NUMBER_HOLD_DAYS * 24 * 60 * 60 * 1000);

  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        trialEndedAt: endedAt.toISOString(),
        trialNumberHoldUntil: holdUntil.toISOString(),
        trialNumberReleaseScheduled: true,
      },
    },
    update: {
      limits: {
        ...limits,
        trialEndedAt: endedAt.toISOString(),
        trialNumberHoldUntil: holdUntil.toISOString(),
        trialNumberReleaseScheduled: true,
      },
    },
  });

  await pauseMctbService(workspaceId);
}

export async function pauseMctbService(workspaceId: string) {
  await setMctbServiceStatus(workspaceId, "SUSPENDED_TRIAL_EXPIRED");
}

export async function isWorkspaceTollFreeInHoldWindow(workspaceId: string): Promise<boolean> {
  const hasPaid = await hasActiveMctbPaidEntitlement(workspaceId);
  if (hasPaid) return false;

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { workspaceLimits: true },
  });
  const limits = asRecord(ws?.workspaceLimits?.limits);
  const holdUntil = limits.trialNumberHoldUntil as string | undefined;
  if (!holdUntil) return false;
  return new Date(holdUntil).getTime() > Date.now();
}

/**
 * Release only when ALL are true:
 * - no active paid MCTB entitlement
 * - trial ended without payment (trialEndedAt set)
 * - hold window expired
 * - release not already completed
 */
export async function shouldReleaseWorkspaceTollFreeNumber(workspaceId: string): Promise<boolean> {
  if (await hasActiveMctbPaidEntitlement(workspaceId)) return false;

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, stripeSubscriptionId: true, workspaceLimits: true },
  });
  if (!ws) return false;

  // Bias toward retention when billing state is ambiguous.
  if (ws.stripeSubscriptionId) {
    const plan = String(ws.billingPlan || "").toLowerCase();
    if (plan !== "canceled" && plan !== "expired" && plan !== "suspended") {
      return false;
    }
  }

  const plan = String(ws.billingPlan || "").toLowerCase();
  if (plan === "trial" || plan === "onboarding" || plan === "growth") return false;

  const limits = asRecord(ws.workspaceLimits?.limits);
  if (!limits.trialEndedAt) return false;
  if (limits.trialNumberReleasedAt) return false;
  if (!limits.trialNumberReleaseScheduled) return false;

  const holdUntil = limits.trialNumberHoldUntil as string | undefined;
  if (!holdUntil) return false;
  return new Date(holdUntil).getTime() <= Date.now();
}

async function auditReleasedNumber(
  workspaceId: string,
  phoneNumberId: string,
  reason: import("@/lib/mctb/number-release-audit").NumberReleaseReason,
): Promise<void> {
  const prisma = getPrisma();
  const [ws, pn] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { billingPlan: true, stripeSubscriptionId: true, workspaceLimits: true },
    }),
    prisma.phoneNumber.findUnique({
      where: { id: phoneNumberId },
      select: { e164: true, twilioSid: true, provider: true },
    }),
  ]);
  if (!pn) return;
  const limits = asRecord(ws?.workspaceLimits?.limits);
  await recordNumberReleaseAudit({
    workspaceId,
    phoneNumberId,
    e164: pn.e164,
    twilioSid: pn.twilioSid,
    provider: pn.provider,
    reason,
    billingPlan: ws?.billingPlan,
    stripeSubscriptionId: ws?.stripeSubscriptionId,
    mctbServiceStatus: String(limits.mctbServiceStatus || ""),
    releasedBy: "system",
  });
}

/** End unpaid trials — pause service and start hold window. Never releases numbers here. */
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
    if (await hasActiveMctbPaidEntitlement(row.id)) continue;

    const limits = asRecord(row.workspaceLimits?.limits);
    const trialEndsAt = limits.trialEndsAt as string | undefined;
    if (!trialEndsAt || trialEndsAt > now) continue;

    await prisma.workspace.update({
      where: { id: row.id },
      data: { billingPlan: "expired" },
    });
    await markMctbTrialEndedWithoutPayment(row.id);
    ended += 1;
  }

  return { scanned: rows.length, ended };
}

/** Release held workspace TFNs only after hold expired and no paid entitlement. */
export async function processWorkspaceTollFreeReleases(limit = 50): Promise<{
  scanned: number;
  released: number;
  errors: string[];
}> {
  const prisma = getPrisma();
  const rows = await prisma.workspace.findMany({
    where: {
      billingPlan: { in: ["expired", "canceled", "suspended"] },
      workspaceLimits: { isNot: null },
    },
    select: { id: true },
    take: limit,
  });

  const errors: string[] = [];
  let released = 0;

  for (const row of rows) {
    const shouldRelease = await shouldReleaseWorkspaceTollFreeNumber(row.id);
    if (!shouldRelease) continue;

    const state = await loadMctbOnboardingState(row.id);
    const workspaceNumber = getWorkspaceTollFreeNumber(state);
    const phoneNumberId = workspaceNumber?.phoneNumberId;
    if (!phoneNumberId) continue;

    const result = await releaseWorkspaceNumber(row.id, phoneNumberId);
    if (result.ok) {
      released += 1;
      await auditReleasedNumber(row.id, phoneNumberId, "trial_hold_expired");
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

/**
 * Release TFNs from workspaces that provisioned a number but never submitted TFV.
 * Skips workspaces with TFV pending/in-review/approved/action-required.
 */
export async function shouldReleaseAbandonedOnboardingNumber(
  workspaceId: string,
): Promise<boolean> {
  if (await hasActiveMctbPaidEntitlement(workspaceId)) return false;

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      billingPlan: true,
      stripeSubscriptionId: true,
      workspaceLimits: { select: { limits: true } },
      customFieldsConfig: true,
    },
  });
  if (!ws) return false;

  const plan = String(ws.billingPlan || "").toLowerCase();
  if (plan === "trial" || plan === "trial_pending_card" || plan === "growth") return false;
  if (ws.stripeSubscriptionId) return false;

  const limits = asRecord(ws.workspaceLimits?.limits);
  if (limits.trialNumberReleasedAt) return false;
  if (limits.trialStartedAt || limits.trialEndsAt) return false;

  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  if (!workspaceNumber?.phoneNumberId) return false;

  const { loadWorkspaceTfvForPhone } = await import("@/lib/mctb/tfv/store");
  const tfv = await loadWorkspaceTfvForPhone(workspaceId, workspaceNumber.phoneNumberId);
  if (tfv && TFV_IN_FLIGHT_STATUSES.has(tfv.status)) return false;
  if (state.tfvSubmittedAt) return false;

  const provisionedAt =
    workspaceNumber.provisionedAt ||
    state.funnelEvents?.MCTB_TRIAL_NUMBER_PROVISIONED ||
    state.startedAt;
  if (!provisionedAt) return false;

  const cutoff = Date.now() - MCTB_ABANDONED_ONBOARDING_DAYS * 24 * 60 * 60 * 1000;
  return new Date(provisionedAt).getTime() <= cutoff;
}

export async function processAbandonedOnboardingReleases(limit = 50): Promise<{
  scanned: number;
  released: number;
  errors: string[];
}> {
  const prisma = getPrisma();
  const rows = await prisma.workspace.findMany({
    where: {
      billingPlan: { in: ["onboarding", "expired"] },
      workspaceLimits: { isNot: null },
    },
    select: { id: true },
    take: limit,
  });

  const errors: string[] = [];
  let released = 0;

  for (const row of rows) {
    const shouldRelease = await shouldReleaseAbandonedOnboardingNumber(row.id);
    if (!shouldRelease) continue;

    const state = await loadMctbOnboardingState(row.id);
    const workspaceNumber = getWorkspaceTollFreeNumber(state);
    const phoneNumberId = workspaceNumber?.phoneNumberId;
    if (!phoneNumberId) continue;

    const result = await releaseWorkspaceNumber(row.id, phoneNumberId);
    if (result.ok) {
      released += 1;
      await auditReleasedNumber(row.id, phoneNumberId, "abandoned_onboarding");
      const limitsRow = await prisma.workspaceLimits.findUnique({
        where: { workspaceId: row.id },
        select: { limits: true },
      });
      const limits = asRecord(limitsRow?.limits);
      const now = new Date().toISOString();
      await prisma.workspaceLimits.update({
        where: { workspaceId: row.id },
        data: {
          limits: {
            ...limits,
            trialNumberReleasedAt: now,
            abandonedOnboardingReleasedAt: now,
            abandonedOnboardingReleaseReason: "no_tfv_submitted",
          },
        },
      });
      await recordFunnelEvent(row.id, "MCTB_ABANDONED_ONBOARDING_RELEASED", {
        phoneNumberId,
        reason: "no_tfv_submitted",
      }).catch(() => undefined);
    } else if (result.error) {
      errors.push(`${row.id}: ${result.error}`);
    }
  }

  return { scanned: rows.length, released, errors };
}

export async function runMctbNumberLifecycleJobs(limit = 50) {
  const [expired, releases, abandoned, reminders] = await Promise.all([
    processExpiredMctbTrials(limit),
    processWorkspaceTollFreeReleases(limit),
    processAbandonedOnboardingReleases(limit),
    processAbandonedOnboardingReminders(limit),
  ]);
  return { expired, releases, abandoned, reminders };
}

// Backward-compatible aliases
export const MCTB_TRIAL_NUMBER_HOLD_DAYS = MCTB_NUMBER_HOLD_DAYS;
export const markTrialEnded = markMctbTrialEndedWithoutPayment;
export const shouldReleaseTrialNumber = shouldReleaseWorkspaceTollFreeNumber;
export const processMctbTrialNumberReleases = processWorkspaceTollFreeReleases;
export const runMctbTrialLifecycleJobs = runMctbNumberLifecycleJobs;
