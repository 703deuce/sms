/**
 * Remind workspaces before abandoned-onboarding TFN cleanup (no silent release).
 */
import { getPrisma } from "@/lib/db";
import { loadMctbOnboardingState } from "./state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { loadWorkspaceTfvForPhone } from "@/lib/mctb/tfv/store";
import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";
import { MCTB_ABANDONED_ONBOARDING_DAYS } from "./number-lifecycle";

/** Send reminder this many days before release. */
export const MCTB_ABANDONED_REMINDER_DAYS_BEFORE = 3;

const TFV_IN_FLIGHT = new Set(["SUBMITTED", "PENDING", "APPROVED", "ACTION_REQUIRED"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function shouldSendAbandonedOnboardingReminder(
  workspaceId: string,
): Promise<boolean> {
  if (await hasActiveMctbPaidEntitlement(workspaceId)) return false;

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, stripeSubscriptionId: true, workspaceLimits: true },
  });
  if (!ws || ws.stripeSubscriptionId) return false;

  const limits = asRecord(ws.workspaceLimits?.limits);
  if (limits.abandonedOnboardingReminderSentAt) return false;
  if (limits.trialNumberReleasedAt) return false;
  if (limits.trialStartedAt || limits.trialEndsAt) return false;

  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  if (!workspaceNumber?.phoneNumberId) return false;

  const tfv = await loadWorkspaceTfvForPhone(workspaceId, workspaceNumber.phoneNumberId);
  if (tfv && TFV_IN_FLIGHT.has(tfv.status)) return false;
  if (state.tfvSubmittedAt) return false;

  const provisionedAt =
    workspaceNumber.provisionedAt ||
    state.funnelEvents?.MCTB_TRIAL_NUMBER_PROVISIONED ||
    state.startedAt;
  if (!provisionedAt) return false;

  const releaseAt =
    new Date(provisionedAt).getTime() + MCTB_ABANDONED_ONBOARDING_DAYS * 24 * 60 * 60 * 1000;
  const reminderAt =
    releaseAt - MCTB_ABANDONED_REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000;
  return Date.now() >= reminderAt && Date.now() < releaseAt;
}

export async function processAbandonedOnboardingReminders(limit = 50): Promise<{
  scanned: number;
  reminded: number;
}> {
  const prisma = getPrisma();
  const rows = await prisma.workspace.findMany({
    where: { billingPlan: { in: ["onboarding", "expired"] } },
    select: { id: true, name: true },
    take: limit,
  });

  let reminded = 0;
  for (const row of rows) {
    const shouldRemind = await shouldSendAbandonedOnboardingReminder(row.id);
    if (!shouldRemind) continue;

    const state = await loadMctbOnboardingState(row.id);
    const tfn = getWorkspaceTollFreeNumber(state)?.e164 || "your toll-free number";

    try {
      const { notifyWorkspace } = await import("@/lib/notifications/in-app");
      await notifyWorkspace(row.id, {
        type: "mctb_abandoned_onboarding",
        title: "Finish setup to keep your number",
        body: `Your number ${tfn} will be released in ${MCTB_ABANDONED_REMINDER_DAYS_BEFORE} days unless you submit toll-free verification.`,
        href: "/setup",
      });
    } catch {
      /* best effort */
    }

    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: row.id },
      select: { limits: true },
    });
    const limits = asRecord(limitsRow?.limits);
    const now = new Date().toISOString();
    await prisma.workspaceLimits.upsert({
      where: { workspaceId: row.id },
      create: {
        workspaceId: row.id,
        limits: { abandonedOnboardingReminderSentAt: now },
      },
      update: {
        limits: { ...limits, abandonedOnboardingReminderSentAt: now },
      },
    });

    reminded += 1;
  }

  return { scanned: rows.length, reminded };
}
