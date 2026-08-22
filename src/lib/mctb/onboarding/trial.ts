import { getPrisma } from "@/lib/db";
import { getTrialLimits } from "@/lib/platform-flags";
import { grantCredits } from "@/lib/settings/billing";
import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";
import { classifyProductionNumber } from "@/lib/messaging/compliance/phone-number-class";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "./state";
import { getTfvStatusForWorkspace } from "@/lib/mctb/tfv/service";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { evaluateTrialActivationGates } from "./trial-gates";
import { MCTB_ONBOARDING_STEP_ORDER } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function loadTrialNumberMessagingGate(workspaceId: string, phoneNumberId: string | null) {
  if (!phoneNumberId) {
    return { messagingApproved: false, numberClass: undefined as "TWILIO_TOLL_FREE" | "TELNYX_LOCAL_A2P" | undefined };
  }
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId },
    select: { e164: true, settingsJson: true, a2pStatus: true, type: true, provider: true },
  });
  if (!phone) {
    return { messagingApproved: false, numberClass: undefined };
  }
  return {
    messagingApproved: isPhoneMessagingApproved(phone),
    numberClass: classifyProductionNumber(phone),
  };
}

export type TrialActivationRequirements = {
  tfvApproved: boolean;
  forwardingConnected: boolean;
  liveTestPassed: boolean;
  missing: string[];
  /** @deprecated use tfvApproved */
  complianceApproved?: boolean;
};

export async function getTrialActivationRequirements(
  workspaceId: string,
): Promise<TrialActivationRequirements> {
  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  const tfv = await getTfvStatusForWorkspace(workspaceId);
  const messagingGate = await loadTrialNumberMessagingGate(
    workspaceId,
    workspaceNumber?.phoneNumberId || null,
  );

  const gate = evaluateTrialActivationGates({
    trialPhoneE164: workspaceNumber?.e164 || null,
    trialPhoneNumberId: workspaceNumber?.phoneNumberId || null,
    tfvPhoneNumberId: tfv.phoneNumberId ?? null,
    tfvStatus: tfv.status,
    forwardingConnected: Boolean(state.forwardingConnectedAt && state.businessNumberE164),
    liveTestPassed: Boolean(state.liveTestPassedAt),
    trialAlreadyStarted: false,
    messagingApproved: messagingGate.messagingApproved,
    numberClass: messagingGate.numberClass,
  });

  return {
    tfvApproved: tfv.approved || messagingGate.messagingApproved,
    forwardingConnected: Boolean(state.forwardingConnectedAt && state.businessNumberE164),
    liveTestPassed: Boolean(state.liveTestPassedAt),
    missing: gate.missing,
    complianceApproved: tfv.approved || messagingGate.messagingApproved,
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

  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  const tfv = await getTfvStatusForWorkspace(workspaceId);
  const messagingGate = await loadTrialNumberMessagingGate(
    workspaceId,
    workspaceNumber?.phoneNumberId || null,
  );
  const gate = evaluateTrialActivationGates({
    trialPhoneE164: workspaceNumber?.e164 || null,
    trialPhoneNumberId: workspaceNumber?.phoneNumberId || null,
    tfvPhoneNumberId: tfv.phoneNumberId ?? null,
    tfvStatus: tfv.status,
    forwardingConnected: Boolean(state.forwardingConnectedAt && state.businessNumberE164),
    liveTestPassed: Boolean(state.liveTestPassedAt),
    trialAlreadyStarted: false,
    messagingApproved: messagingGate.messagingApproved,
    numberClass: messagingGate.numberClass,
  });

  if (!gate.canActivate) {
    return { ok: false, reason: gate.missing.join(",") };
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
    completedSteps: [...MCTB_ONBOARDING_STEP_ORDER],
  });
  await recordFunnelEvent(workspaceId, "MCTB_TRIAL_ACTIVATED", {
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
