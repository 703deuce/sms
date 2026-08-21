import { getPrisma } from "@/lib/db";
import { getTrialLimits } from "@/lib/platform-flags";
import { grantCredits } from "@/lib/settings/billing";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "./state";
import type { MctbOnboardingState } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type TrialActivationRequirements = {
  complianceApproved: boolean;
  numberConnected: boolean;
  liveTestPassed: boolean;
  missing: string[];
};

export async function getTrialActivationRequirements(
  workspaceId: string,
): Promise<TrialActivationRequirements> {
  const prisma = getPrisma();
  const [state, reg, phoneCount] = await Promise.all([
    loadMctbOnboardingState(workspaceId),
    prisma.messagingRegistration.findUnique({ where: { workspaceId } }),
    prisma.phoneNumber.count({
      where: { workspaceId, status: { not: "Released" } },
    }),
  ]);

  const brandOk = ["APPROVED", "VERIFIED"].includes(
    String(reg?.brandStatus || "").toUpperCase(),
  );
  const campaignOk = ["APPROVED", "VERIFIED"].includes(
    String(reg?.campaignStatus || "").toUpperCase(),
  );
  const complianceApproved = Boolean(
    state.complianceApprovedAt || (brandOk && campaignOk && reg?.registrationApprovedAt),
  );
  const numberConnected = Boolean(
    state.forwardingConnectedAt || state.businessNumberE164 || phoneCount > 0,
  );
  const liveTestPassed = Boolean(state.liveTestPassedAt);

  const missing: string[] = [];
  if (!complianceApproved) missing.push("compliance_approved");
  if (!numberConnected) missing.push("number_connected");
  if (!liveTestPassed) missing.push("live_test_passed");

  return {
    complianceApproved,
    numberConnected,
    liveTestPassed,
    missing,
  };
}

export async function activateMctbTrial(workspaceId: string): Promise<{
  ok: boolean;
  reason?: string;
  trialEndsAt?: string;
}> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, workspaceLimits: true },
  });
  if (!ws) return { ok: false, reason: "workspace_not_found" };

  const plan = String(ws.billingPlan || "").toLowerCase();
  if (plan === "trial" && ws.workspaceLimits) {
    const limits = asRecord(ws.workspaceLimits.limits);
    if (limits.trialStartedAt) {
      return { ok: true, trialEndsAt: String(limits.trialEndsAt || "") };
    }
  }

  const reqs = await getTrialActivationRequirements(workspaceId);
  if (reqs.missing.length > 0) {
    return { ok: false, reason: reqs.missing.join(",") };
  }

  const trial = await getTrialLimits();
  const trialDays = trial.days || 14;
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const existingLimits = asRecord(ws.workspaceLimits?.limits);
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        dailyCap: trial.messages || 500,
        maxNumbers: trial.numbers || 1,
        trialDays,
        requireCard: trial.requireCard,
        trialStartedAt: startedAt.toISOString(),
        trialEndsAt: endsAt.toISOString(),
      },
    },
    update: {
      limits: {
        ...existingLimits,
        trialStartedAt: startedAt.toISOString(),
        trialEndsAt: endsAt.toISOString(),
      },
    },
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      billingPlan: trial.requireCard ? "trial_pending_card" : "trial",
    },
  });

  if (trial.credits > 0) {
    const cents = Math.round(trial.credits * 100);
    try {
      await grantCredits(workspaceId, cents, `Trial credit grant ($${trial.credits})`, "trial");
    } catch {
      // credits may already exist from onboarding
    }
  }

  await saveMctbOnboardingState(workspaceId, {
    trialActivatedAt: startedAt.toISOString(),
    currentStep: "complete",
    completedSteps: [
      "business",
      "configure",
      "consent",
      "demo",
      "compliance",
      "pending",
      "connect",
      "live_test",
      "complete",
    ] as MctbOnboardingState["completedSteps"],
  });
  await recordFunnelEvent(workspaceId, "trial_activated", {
    trialStartedAt: startedAt.toISOString(),
    trialEndsAt: endsAt.toISOString(),
  });

  return { ok: true, trialEndsAt: endsAt.toISOString() };
}

export async function isWorkspaceInOnboarding(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, type: true },
  });
  if (!ws || ws.type === "PERSONAL") return false;
  const plan = String(ws.billingPlan || "").toLowerCase();
  return plan === "onboarding";
}

export async function getTrialInfo(workspaceId: string) {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, workspaceLimits: true },
  });
  const limits = asRecord(ws?.workspaceLimits?.limits);
  return {
    billingPlan: ws?.billingPlan || null,
    trialStartedAt: (limits.trialStartedAt as string) || null,
    trialEndsAt: (limits.trialEndsAt as string) || null,
    inOnboarding: String(ws?.billingPlan || "").toLowerCase() === "onboarding",
  };
}
