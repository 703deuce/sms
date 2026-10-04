import "server-only";

import { getPrisma } from "@/lib/db";
import { ensureBusinessWorkspaceForMctb } from "@/lib/mctb/ensure-business-workspace-for-mctb";
import {
  normalizeMctbConsentMode,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import type { MctbOnboardingState } from "@/lib/mctb/onboarding/types";
import { parseMctbOnboardingState } from "@/lib/mctb/onboarding/state";

const DEFAULT_MESSAGE =
  "Sorry we missed your call! Reply here and we'll get back to you shortly.";

/** Ensure a BUSINESS workspace has MCTB onboarding state and billing plan for wizard entry. */
export async function ensureMctbWorkspaceSeeded(workspaceId: string): Promise<void> {
  await ensureBusinessWorkspaceForMctb(workspaceId);
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true, billingPlan: true, type: true },
  });
  if (!ws || ws.type === "PERSONAL") return;

  const cfg =
    ws.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};

  const mctbCfg =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};
  const storedMctbConsent: MctbConsentMode | undefined =
    typeof mctbCfg.consentMode === "string"
      ? normalizeMctbConsentMode(mctbCfg.consentMode)
      : undefined;

  const existing = parseMctbOnboardingState(cfg);
  const hasOnboarding = Boolean((cfg as Record<string, unknown>).mctbOnboarding);

  const onboardingSeed: MctbOnboardingState = hasOnboarding
    ? {
        ...existing,
        ...(storedMctbConsent ? { consentMode: storedMctbConsent } : {}),
      }
    : {
        version: 2,
        currentStep: "business",
        completedSteps: [],
        startedAt: new Date().toISOString(),
        consentMode: storedMctbConsent ?? "press_1",
        messageTemplate: DEFAULT_MESSAGE,
      };

  const canonicalConsent: MctbConsentMode =
    storedMctbConsent ?? normalizeMctbConsentMode(onboardingSeed.consentMode);

  const plan = String(ws.billingPlan || "").toLowerCase();
  const preservePaidPlan =
    mctbCfg.adminTestAccount === true || mctbCfg.unlimitedMctbTesting === true;
  const billingPatch =
    !preservePaidPlan &&
    (plan === "trial" || plan === "trial_pending_card" || plan === "expired")
      ? { billingPlan: "onboarding" as const }
      : {};

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...billingPatch,
      customFieldsConfig: {
        ...cfg,
        mctbOnboarding: { ...onboardingSeed, consentMode: canonicalConsent },
        mctb: {
          ...(cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as object) : {}),
          consentMode: canonicalConsent,
        },
      },
    },
  });

}
